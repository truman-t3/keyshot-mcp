import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.abspath(os.path.join(HERE, "..", "scripts"))
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)

import keyshot_bridge as kb  # noqa: E402


class FakeCamera:
    def __init__(self):
        self.calls = []

    def setPosition(self, pos):
        self.calls.append(("setPosition", pos))

    def setLookAt(self, la):
        self.calls.append(("setLookAt", la))

    def setUp(self, up):
        self.calls.append(("setUp", up))

    def setDirection(self, direction):
        self.calls.append(("setDirection", direction))


class FakeLux:
    def __init__(self, camera=None, has_save_camera=False):
        self.import_file_called = []
        self.open_scene_called = []
        self.save_scene_called = []
        self.set_camera_position = []
        self.set_camera_lookat = []
        self.set_camera_up = []
        self.set_camera_direction = []
        self.save_camera_called = []
        self._camera = camera
        self._has_save_camera = has_save_camera

    def importFile(self, path):
        self.import_file_called.append(path)

    def openScene(self, path):
        self.open_scene_called.append(path)

    def openFile(self, path):
        self.open_scene_called.append(path)

    def loadScene(self, path):
        self.open_scene_called.append(path)

    def openProject(self, path):
        self.open_scene_called.append(path)

    def saveScene(self, path):
        self.save_scene_called.append(path)
        # Simulate KeyShot writing the scene file to disk.
        with open(path, "w") as handle:
            handle.write("fake keyshot scene")

    def getCamera(self, name):
        return self._camera

    def newCamera(self, name):
        return self._camera

    def createCamera(self, name):
        return self._camera

    def saveCamera(self, name):
        self.save_camera_called.append(name)
        if self._has_save_camera:
            return self._camera
        raise RuntimeError("saveCamera unsupported")

    def setCameraPosition(self, *args):
        self.set_camera_position.append(args)

    def setCameraLookAt(self, *args):
        self.set_camera_lookat.append(args)

    def setCameraUp(self, *args):
        self.set_camera_up.append(args)

    def setCameraDirection(self, *args, **kwargs):
        self.set_camera_direction.append((args, kwargs))


class NamedCamera:
    def __init__(self, name):
        self._name = name

    def getName(self):
        return self._name


class FakeRenderOptions:
    def __init__(self):
        self.max_samples = None
        self.advanced_samples = None
        self.max_time = None

    def setMaxSamplesRendering(self, samples):
        self.max_samples = samples

    def setAdvancedRendering(self, samples):
        self.advanced_samples = samples

    def setMaxTimeRendering(self, seconds):
        self.max_time = seconds


class RenderLux:
    def __init__(self):
        self.options = FakeRenderOptions()
        self.render_calls = []

    def getRenderOptions(self):
        return self.options

    def renderImage(self, *args, **kwargs):
        self.render_calls.append((args, kwargs))


class AllCameraRenderLux(RenderLux):
    def __init__(self, cameras, failing=None):
        super().__init__()
        self.cameras = cameras
        self.failing = set(failing or [])
        self.current_camera = None

    def getCameras(self):
        return self.cameras

    def setCamera(self, camera):
        self.current_camera = camera

    def renderImage(self, *args, **kwargs):
        if self.current_camera in self.failing:
            raise RuntimeError("simulated render failure")
        super().renderImage(*args, **kwargs)


class CreateCameraLux(FakeLux):
    def getCamera(self, name):
        return None

    def newCamera(self, name):
        self._camera = FakeCamera()
        return self._camera


class BooleanCreateCameraLux(FakeLux):
    def getCamera(self, name):
        return None

    def newCamera(self, name):
        return True


class StandardCameraLux(FakeLux):
    VIEW_FRONT = 1
    VIEW_BACK = 2
    VIEW_LEFT = 3
    VIEW_RIGHT = 4
    VIEW_TOP = 5
    VIEW_BOTTOM = 6
    VIEW_ISOMETRIC = 7

    def __init__(self, cameras=None):
        super().__init__()
        self.cameras = list(cameras or [])
        self.active_camera = None
        self.new_camera_calls = []
        self.standard_view_calls = []

    def getCameras(self):
        return self.cameras

    def setCamera(self, name):
        if name not in self.cameras:
            return False
        self.active_camera = name
        return True

    def newCamera(self, name):
        self.cameras.append(name)
        self.active_camera = name
        self.new_camera_calls.append(name)
        return True

    def setStandardView(self, view):
        self.standard_view_calls.append(view)

    def saveCamera(self, *args):
        self.save_camera_called.append(args)


class StandardCameraWithoutConstantLux(FakeLux):
    def setStandardView(self, view):
        pass


class ListCamerasTest(unittest.TestCase):
    def test_reads_camera_objects(self):
        lux = FakeLux()
        lux.getCameras = lambda: [NamedCamera("Front"), NamedCamera("Back")]
        kb.lux = lux
        data = kb.list_cameras()
        self.assertEqual(data["cameras"], ["Front", "Back"])
        self.assertEqual(data["count"], 2)

    def test_handles_plain_string_camera_names(self):
        lux = FakeLux()
        lux.getCameras = lambda: ["Top", "Bottom"]
        kb.lux = lux
        data = kb.list_cameras()
        self.assertEqual(data["cameras"], ["Top", "Bottom"])

    def test_returns_empty_when_no_getCameras(self):
        kb.lux = FakeLux()  # no getCameras attribute
        data = kb.list_cameras()
        self.assertEqual(data["cameras"], [])
        self.assertEqual(data["count"], 0)


class RenderTest(unittest.TestCase):
    def test_applies_max_samples_through_render_options(self):
        lux = RenderLux()
        kb.lux = lux
        output_files = []
        kb.render({"outputPath": "render.png", "samples": 64}, output_files, [])

        self.assertEqual(lux.options.max_samples, 64)
        self.assertIsNone(lux.options.max_time)
        self.assertEqual(lux.render_calls[0][1]["opts"], lux.options)

    def test_applies_max_time_through_render_options(self):
        lux = RenderLux()
        kb.lux = lux
        kb.render({"outputPath": "render.png", "maxTimeSeconds": 10}, [], [])

        self.assertEqual(lux.options.max_time, 10)
        self.assertEqual(lux.render_calls[0][1]["opts"], lux.options)

    def test_rejects_conflicting_render_modes(self):
        kb.lux = RenderLux()
        with self.assertRaisesRegex(RuntimeError, "cannot be used together"):
            kb.render({"outputPath": "render.png", "samples": 64, "maxTimeSeconds": 10}, [], [])


class RenderAllCamerasTest(unittest.TestCase):
    def test_discovers_and_renders_every_camera(self):
        kb.lux = AllCameraRenderLux(["Front", "Back"])
        with tempfile.TemporaryDirectory() as d:
            output_files = []
            data = kb.render_all_cameras(
                {"scenePath": "scene.bip", "outputDir": d, "width": 320, "height": 240},
                output_files,
                [],
            )
            self.assertEqual(data["succeeded"], 2)
            self.assertEqual(data["failed"], 0)
            self.assertEqual(len(output_files), 2)
            self.assertEqual([item["camera"] for item in data["results"]], ["Front", "Back"])

    def test_rejects_a_scene_without_cameras(self):
        kb.lux = AllCameraRenderLux([])
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(RuntimeError, "No cameras"):
                kb.render_all_cameras({"scenePath": "scene.bip", "outputDir": d}, [], [])

    def test_skips_keyshot_internal_last_active_placeholder(self):
        kb.lux = AllCameraRenderLux(["last_active", "Front"])
        with tempfile.TemporaryDirectory() as d:
            warnings = []
            data = kb.render_all_cameras({"scenePath": "scene.bip", "outputDir": d}, [], warnings)
            self.assertEqual(data["cameras"], ["Front"])
            self.assertEqual(data["excludedCameras"], ["last_active"])
            self.assertIn("internal camera placeholder", warnings[0])

    def test_continues_after_a_camera_failure_by_default(self):
        kb.lux = AllCameraRenderLux(["Front", "Broken", "Back"], failing=["Broken"])
        with tempfile.TemporaryDirectory() as d:
            data = kb.render_all_cameras({"scenePath": "scene.bip", "outputDir": d}, [], [])
            self.assertEqual(data["succeeded"], 2)
            self.assertEqual(data["failed"], 1)
            self.assertEqual(data["skipped"], 0)
            self.assertFalse(data["results"][1]["ok"])

    def test_stops_and_marks_remaining_cameras_when_requested(self):
        kb.lux = AllCameraRenderLux(["Front", "Broken", "Back"], failing=["Broken"])
        with tempfile.TemporaryDirectory() as d:
            data = kb.render_all_cameras(
                {"scenePath": "scene.bip", "outputDir": d, "continueOnError": False}, [], []
            )
            self.assertEqual(data["succeeded"], 1)
            self.assertEqual(data["failed"], 1)
            self.assertEqual(data["skipped"], 1)
            self.assertTrue(data["results"][2]["skipped"])

    def test_existing_output_is_a_per_camera_failure(self):
        kb.lux = AllCameraRenderLux(["Front", "Back"])
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "Front.png"), "w").close()
            data = kb.render_all_cameras({"scenePath": "scene.bip", "outputDir": d}, [], [])
            self.assertEqual(data["failed"], 1)
            self.assertEqual(data["succeeded"], 1)
            self.assertIn("already exists", data["results"][0]["error"])

    def test_special_and_duplicate_names_get_unique_safe_files(self):
        kb.lux = AllCameraRenderLux(["Hero / Front", "Hero ? Front", "Hero / Front"])
        with tempfile.TemporaryDirectory() as d:
            data = kb.render_all_cameras({"scenePath": "scene.bip", "outputDir": d}, [], [])
            names = [os.path.basename(item["outputPath"]) for item in data["results"]]
            self.assertEqual(names, ["Hero___Front.png", "Hero___Front-2.png", "Hero___Front-3.png"])


class ImportModelTest(unittest.TestCase):
    def test_opens_base_scene_when_provided(self):
        kb.lux = FakeLux()
        with tempfile.TemporaryDirectory() as d:
            model = os.path.join(d, "m.obj")
            base = os.path.join(d, "base.bip")
            out = os.path.join(d, "out.bip")
            open(model, "w").close()
            open(base, "w").close()
            payload = {"modelPath": model, "baseScenePath": base, "outputScenePath": out}
            result = kb.import_model(payload, [], [])
            self.assertTrue(os.path.exists(out))
            self.assertEqual(kb.lux.open_scene_called, [base])
            self.assertEqual(result["baseScene"], base)

    def test_creates_new_scene_when_no_base(self):
        kb.lux = FakeLux()
        with tempfile.TemporaryDirectory() as d:
            model = os.path.join(d, "m.obj")
            out = os.path.join(d, "out.bip")
            open(model, "w").close()
            kb.import_model({"modelPath": model, "outputScenePath": out}, [], [])
            self.assertEqual(kb.lux.import_file_called, [model])


class SetCameraTest(unittest.TestCase):
    def test_uses_object_api_when_camera_returned(self):
        cam = FakeCamera()
        kb.lux = FakeLux(camera=cam)
        with tempfile.TemporaryDirectory() as d:
            payload = {
                "scenePath": "a.bip",
                "outputScenePath": os.path.join(d, "out.bip"),
                "cameraName": "MCP Camera",
                "position": [1, 2, 3],
                "lookAt": [0, 0, 0],
            }
            kb.set_camera(payload, [], [])
            self.assertEqual(len(cam.calls), 4)
            self.assertEqual(
                [call[0] for call in cam.calls],
                ["setLookAt", "setPosition", "setDirection", "setUp"],
            )
            self.assertEqual(kb.lux.set_camera_position, [])

    def test_falls_back_to_lux_api_when_camera_is_none(self):
        kb.lux = FakeLux(camera=None, has_save_camera=False)
        with tempfile.TemporaryDirectory() as d:
            payload = {
                "scenePath": "a.bip",
                "outputScenePath": os.path.join(d, "out.bip"),
                "cameraName": "MCP Camera",
                "position": [1, 2, 3],
                "lookAt": [0, 0, 0],
            }
            kb.set_camera(payload, [], [])  # must not raise
            self.assertEqual(kb.lux.set_camera_position, [((1, 2, 3),)])
            self.assertEqual(kb.lux.set_camera_direction, [((), {"dir": (-1, -2, -3)})])

    def test_creates_camera_when_named_camera_does_not_exist(self):
        kb.lux = CreateCameraLux()
        with tempfile.TemporaryDirectory() as d:
            payload = {
                "scenePath": "a.bip",
                "outputScenePath": os.path.join(d, "out.bip"),
                "cameraName": "New Camera",
                "position": [1, 2, 3],
                "lookAt": [0, 0, 0],
            }
            kb.set_camera(payload, [], [])
            self.assertEqual(
                [call[0] for call in kb.lux._camera.calls],
                ["setLookAt", "setPosition", "setDirection", "setUp"],
            )
            self.assertEqual(kb.lux.set_camera_position, [])

    def test_uses_lux_api_when_camera_creation_returns_boolean(self):
        kb.lux = BooleanCreateCameraLux()
        with tempfile.TemporaryDirectory() as d:
            payload = {
                "scenePath": "a.bip",
                "outputScenePath": os.path.join(d, "out.bip"),
                "cameraName": "New Camera",
                "position": [1, 2, 3],
                "lookAt": [0, 0, 0],
            }
            kb.set_camera(payload, [], [])
            self.assertEqual(kb.lux.set_camera_position, [((1, 2, 3),)])

    def test_saves_a_named_camera_after_setting_its_transform(self):
        kb.lux = FakeLux(camera=None, has_save_camera=True)
        with tempfile.TemporaryDirectory() as d:
            payload = {
                "scenePath": "a.bip",
                "outputScenePath": os.path.join(d, "out.bip"),
                "cameraName": "Saved Camera",
                "position": [1, 2, 3],
                "lookAt": [0, 0, 0],
            }
            kb.set_camera(payload, [], [])
            self.assertEqual(kb.lux.save_camera_called, ["Saved Camera"])

    def test_raises_when_position_missing(self):
        kb.lux = FakeLux(camera=FakeCamera())
        with tempfile.TemporaryDirectory() as d:
            payload = {
                "scenePath": "a.bip",
                "outputScenePath": os.path.join(d, "out.bip"),
                "lookAt": [0, 0, 0],
            }
            with self.assertRaises(RuntimeError):
                kb.set_camera(payload, [], [])


class SetStandardCameraTest(unittest.TestCase):
    def test_creates_and_saves_every_standard_view(self):
        expected = {
            "front": 1,
            "back": 2,
            "left": 3,
            "right": 4,
            "top": 5,
            "bottom": 6,
            "isometric": 7,
        }
        for view, constant in expected.items():
            with self.subTest(view=view), tempfile.TemporaryDirectory() as d:
                kb.lux = StandardCameraLux()
                output = os.path.join(d, "%s.bip" % view)
                result = kb.set_standard_camera(
                    {
                        "standardView": view,
                        "cameraName": view.title(),
                        "outputScenePath": output,
                    },
                    [],
                    [],
                )
                self.assertEqual(kb.lux.new_camera_calls, [view.title()])
                self.assertEqual(kb.lux.standard_view_calls, [constant])
                self.assertEqual(kb.lux.save_camera_called, [()])
                self.assertTrue(os.path.exists(output))
                self.assertEqual(result["standardView"], view)

    def test_updates_an_existing_named_camera(self):
        kb.lux = StandardCameraLux(cameras=["Front"])
        with tempfile.TemporaryDirectory() as d:
            kb.set_standard_camera(
                {
                    "standardView": "front",
                    "cameraName": "Front",
                    "outputScenePath": os.path.join(d, "out.bip"),
                },
                [],
                [],
            )
            self.assertEqual(kb.lux.active_camera, "Front")
            self.assertEqual(kb.lux.new_camera_calls, [])

    def test_rejects_an_unknown_standard_view(self):
        kb.lux = StandardCameraLux()
        with self.assertRaisesRegex(RuntimeError, "Unsupported standard camera view"):
            kb.set_standard_camera(
                {"standardView": "diagonal", "outputScenePath": "out.bip"}, [], []
            )

    def test_reports_missing_standard_view_api(self):
        kb.lux = FakeLux()
        with self.assertRaisesRegex(RuntimeError, "setStandardView"):
            kb.set_standard_camera(
                {"standardView": "front", "outputScenePath": "out.bip"}, [], []
            )

    def test_reports_missing_view_constant(self):
        kb.lux = StandardCameraWithoutConstantLux()
        with self.assertRaisesRegex(RuntimeError, "VIEW_FRONT"):
            kb.set_standard_camera(
                {"standardView": "front", "outputScenePath": "out.bip"}, [], []
            )


if __name__ == "__main__":
    unittest.main()
