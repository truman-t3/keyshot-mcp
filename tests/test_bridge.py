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


class FakeLux:
    def __init__(self, camera=None, has_save_camera=False):
        self.import_file_called = []
        self.open_scene_called = []
        self.save_scene_called = []
        self.set_camera_position = []
        self.set_camera_lookat = []
        self.set_camera_up = []
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
        if self._has_save_camera:
            return self._camera
        raise RuntimeError("saveCamera unsupported")

    def setCameraPosition(self, *args):
        self.set_camera_position.append(args)

    def setCameraLookAt(self, *args):
        self.set_camera_lookat.append(args)

    def setCameraUp(self, *args):
        self.set_camera_up.append(args)


class NamedCamera:
    def __init__(self, name):
        self._name = name

    def getName(self):
        return self._name


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
            self.assertEqual(len(cam.calls), 3)
            self.assertEqual(cam.calls[0][0], "setPosition")
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
            self.assertEqual(kb.lux.set_camera_position, [("MCP Camera", (1, 2, 3))])

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


if __name__ == "__main__":
    unittest.main()
