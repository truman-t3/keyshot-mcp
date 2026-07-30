import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.abspath(os.path.join(HERE, "..", "scripts"))
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)

os.environ["KEYSHOT_MCP_LIVE_NO_AUTOSTART"] = "1"
import keyshot_bridge as core  # noqa: E402
import keyshot_live_bridge as live  # noqa: E402


class FakeNode:
    def __init__(self, name, selected=False, object_id=4):
        self.name = name
        self.selected = selected
        self.object_id = object_id
        self.material = "Original"

    def getID(self):
        return self.object_id

    def getName(self):
        return self.name

    def getPath(self):
        return self.name

    def getType(self):
        return "object"

    def getMaterial(self):
        return self.material

    def getChildren(self):
        return []

    def setMaterial(self, material):
        self.material = material


class FakeRoot:
    def __init__(self, selected):
        self.selected = selected

    def getSelected(self):
        return self.selected

    def find(self):
        return self.selected


class FakeLux:
    VIEW_ISOMETRIC = 7

    def __init__(self, screenshot_path=None):
        self.node = FakeNode("Cube", True)
        self.root = FakeRoot([self.node])
        self.screenshot_path = screenshot_path
        self.imported = []
        self.saved = []
        self.undo_enabled = True
        self.camera_ops = []

    def isHeadless(self):
        return False

    def getKeyShotVersion(self):
        return "14.1"

    def getSceneInfo(self):
        return {"name": "Demo", "fileName": "demo.bip"}

    def isSceneChanged(self):
        return True

    def isUndoEnabled(self):
        return self.undo_enabled

    def setUndoEnabled(self, enabled):
        self.undo_enabled = enabled

    def getSceneTree(self):
        return self.root

    def getObjects(self):
        return [self.node]

    def getObject(self, object_id):
        return object_id

    def getCameras(self):
        return ["Camera 1"]

    def getModelSets(self):
        return []

    def getEnvironments(self):
        return []

    def screenshot(self):
        return self.screenshot_path

    def importFile(self, model_path, *args, **kwargs):
        self.imported.append((model_path, args, kwargs))

    def saveScene(self, output_path):
        self.saved.append(output_path)

    def setStandardView(self, view):
        self.camera_ops.append(("standardView", view))

    def setCameraDistance(self, distance):
        self.camera_ops.append(("distance", distance))

    def setCameraFocalLength(self, focal_length):
        self.camera_ops.append(("focalLength", focal_length))

    def saveCamera(self):
        self.camera_ops.append(("save", None))


class LiveBridgeTests(unittest.TestCase):
    def setUp(self):
        self.old_live_lux = live.lux
        self.old_core_lux = core.lux

    def tearDown(self):
        live.lux = self.old_live_lux
        core.lux = self.old_core_lux

    def use_lux(self, fake):
        live.lux = fake
        core.lux = fake

    def test_rejects_unknown_fields_and_invalid_token(self):
        request = {"protocolVersion": 1, "id": "1", "token": "good", "operation": "live_status", "params": {}}
        operation, params = live.validate_request(request, "good")
        self.assertEqual(operation, "live_status")
        self.assertEqual(params, {})
        with self.assertRaisesRegex(RuntimeError, "token"):
            live.validate_request(dict(request, token="bad"), "good")
        with self.assertRaisesRegex(RuntimeError, "Unsupported Live request field"):
            live.validate_request(dict(request, code="print(1)"), "good")
        request["params"] = {"code": "print(1)"}
        with self.assertRaisesRegex(RuntimeError, "Unsupported parameter"):
            live.validate_request(request, "good")

    def test_status_and_inspect_include_current_unsaved_state(self):
        fake = FakeLux()
        self.use_lux(fake)
        status = live.live_status()
        self.assertFalse(status["isHeadless"])
        self.assertTrue(status["sceneChanged"])
        self.assertTrue(status["undoEnabled"])
        inspected = live.live_inspect()
        self.assertEqual(inspected["selection"][0]["name"], "Cube")

    def test_inspect_resolves_gui_object_ids(self):
        fake = FakeLux()
        fake.getObjects = lambda: [4]
        self.use_lux(fake)
        inspected = live.live_inspect()
        self.assertEqual(inspected["objects"][0]["name"], "Cube")

    def test_material_defaults_to_current_selection(self):
        fake = FakeLux()
        self.use_lux(fake)
        result = live.live_apply_material({"materialName": "Blue Plastic"}, [])
        self.assertEqual(fake.node.material, "Blue Plastic")
        self.assertEqual(result["objects"][0]["name"], "Cube")
        self.assertFalse(result["saved"])

    def test_snapshot_returns_image_and_optional_copy(self):
        with tempfile.TemporaryDirectory() as root:
            source = os.path.join(root, "source.png")
            target = os.path.join(root, "copy.png")
            with open(source, "wb") as handle:
                handle.write(b"png")
            fake = FakeLux(source)
            self.use_lux(fake)
            data, image = live.live_snapshot({"saveCopy": True, "outputPath": target}, [])
            self.assertTrue(os.path.exists(target))
            self.assertTrue(data["savedCopy"])
            self.assertFalse(image["deleteImageAfterRead"])

    def test_import_preserves_current_scene(self):
        with tempfile.TemporaryDirectory() as root:
            model = os.path.join(root, "cube.obj")
            with open(model, "w", encoding="utf-8") as handle:
                handle.write("o cube")
            fake = FakeLux()
            self.use_lux(fake)
            result = live.live_import_model({"modelPath": model})
            self.assertEqual(fake.imported[0][0], model)
            self.assertFalse(result["saved"])

    def test_mutation_enables_undo_before_import(self):
        with tempfile.TemporaryDirectory() as root:
            model = os.path.join(root, "cube.obj")
            with open(model, "w", encoding="utf-8") as handle:
                handle.write("o cube")
            fake = FakeLux()
            fake.undo_enabled = False
            self.use_lux(fake)
            data, _files, _warnings, _image = live.dispatch("live_import_model", {"modelPath": model})
            self.assertTrue(fake.undo_enabled)
            self.assertEqual(data["importedModel"], model)

    def test_mutation_is_blocked_when_undo_cannot_be_enabled(self):
        fake = FakeLux()
        fake.undo_enabled = False
        fake.setUndoEnabled = lambda _enabled: None
        self.use_lux(fake)
        with self.assertRaisesRegex(RuntimeError, "Undo is unavailable"):
            live.dispatch("live_set_environment", {"brightness": 1.0})

    def test_standard_view_applies_distance_and_lens_overrides(self):
        fake = FakeLux()
        self.use_lux(fake)
        result = live.live_set_camera(
            {"standardView": "isometric", "distance": 3, "focalLength": 55},
            [],
            [],
        )
        self.assertEqual(result["standardView"], "isometric")
        self.assertIn(("standardView", fake.VIEW_ISOMETRIC), fake.camera_ops)
        self.assertIn(("distance", 3), fake.camera_ops)
        self.assertIn(("focalLength", 55), fake.camera_ops)

    def test_save_requires_explicit_path_or_overwrite(self):
        fake = FakeLux()
        self.use_lux(fake)
        with self.assertRaisesRegex(RuntimeError, "outputScenePath"):
            live.live_save_scene({}, [])
        output = os.path.join(tempfile.gettempdir(), "live-test.bip")
        files = []
        live.live_save_scene({"outputScenePath": output}, files)
        self.assertEqual(files, [output])

    def test_discovery_path_uses_installer_config_before_local_app_data(self):
        old_core_file = core.__file__
        old_override = os.environ.pop("KEYSHOT_LIVE_DISCOVERY_FILE", None)
        try:
            with tempfile.TemporaryDirectory() as root:
                core.__file__ = os.path.join(root, "_keyshot_mcp_core.py")
                expected = os.path.join(root, "shared", "live-session.json")
                with open(os.path.join(root, "_keyshot_mcp_live_config.json"), "w", encoding="utf-8") as handle:
                    json.dump({"discoveryPath": expected}, handle)
                self.assertEqual(live.default_discovery_path(), os.path.abspath(expected))
        finally:
            core.__file__ = old_core_file
            if old_override is not None:
                os.environ["KEYSHOT_LIVE_DISCOVERY_FILE"] = old_override

    def test_default_discovery_path_uses_home_directory(self):
        old_override = os.environ.pop("KEYSHOT_LIVE_DISCOVERY_FILE", None)
        old_installer_path = live.INSTALLER_DISCOVERY_PATH
        old_core_file = core.__file__
        try:
            live.INSTALLER_DISCOVERY_PATH = None
            core.__file__ = os.path.join(tempfile.gettempdir(), "missing", "_keyshot_mcp_core.py")
            self.assertEqual(
                live.default_discovery_path(),
                os.path.join(os.path.expanduser("~"), ".keyshot-mcp", "live-session.json"),
            )
        finally:
            live.INSTALLER_DISCOVERY_PATH = old_installer_path
            core.__file__ = old_core_file
            if old_override is not None:
                os.environ["KEYSHOT_LIVE_DISCOVERY_FILE"] = old_override


if __name__ == "__main__":
    unittest.main()
