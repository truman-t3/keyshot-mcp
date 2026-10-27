import math
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import keyshot_bridge as bridge


class CameraFramingTests(unittest.TestCase):
    def frame(self, bounds=((-1, -1, -1), (1, 1, 1)), width=640, height=480, fov=40):
        return bridge.product_camera_frame(bounds, (3, 3, 3), (0, 0, 0), (0, 1, 0), fov, width, height)

    def test_all_corners_fit_with_padding_for_shapes_and_aspect_ratios(self):
        for bounds in (((-1, -1, -1), (1, 1, 1)), ((0, 0, 0), (1, 12, 1)),
                       ((40, 12, 5), (52, 12.25, 13)), ((-6, 0, -1), (6, 4, 1))):
            for width, height in ((640, 480), (480, 640), (1920, 540)):
                for fov in (10, 40, 100):
                    with self.subTest(bounds=bounds, size=(width, height), fov=fov):
                        result = self.frame(bounds, width, height, fov)
                        distance = result["distance"]
                        center = result["lookAt"]
                        backward = (1 / math.sqrt(3),) * 3
                        right = (1 / math.sqrt(2), 0, -1 / math.sqrt(2))
                        up = (-1 / math.sqrt(6), 2 / math.sqrt(6), -1 / math.sqrt(6))
                        for x in (bounds[0][0], bounds[1][0]):
                            for y in (bounds[0][1], bounds[1][1]):
                                for z in (bounds[0][2], bounds[1][2]):
                                    q = tuple(v - center[i] for i, v in enumerate((x, y, z)))
                                    depth = distance - sum(q[i] * backward[i] for i in range(3))
                                    self.assertGreater(depth, 0)
                                    tangent = math.tan(math.radians(fov) / 2)
                                    self.assertLessEqual(abs(sum(q[i] * right[i] for i in range(3))) / depth / tangent, .800001)
                                    self.assertLessEqual(abs(sum(q[i] * up[i] for i in range(3))) / depth / tangent * width / height, .800001)

    def test_invalid_geometry_and_projection(self):
        for bounds in (((0, 0, 0), (0, 0, 0)), ((1, 0, 0), (0, 1, 1)),
                       ((float("nan"), 0, 0), (1, 1, 1))):
            with self.assertRaises(RuntimeError):
                self.frame(bounds)
        for fov in (0, 180, float("inf")):
            with self.assertRaises(RuntimeError):
                self.frame(fov=fov)
        with self.assertRaises(RuntimeError):
            self.frame(width=0)
        with self.assertRaisesRegex(RuntimeError, "nonzero"):
            bridge.product_camera_frame(((0, 0, 0), (1, 1, 1)), (0, 0, 0), (0, 0, 0), (0, 1, 0), 40, 640, 480)

    def test_native_vectors_with_named_components(self):
        lower = SimpleNamespace(x=-1, y=0, z=-1)
        upper = SimpleNamespace(x=lambda: 1, y=lambda: 2, z=lambda: 1)
        self.assertEqual(self.frame((lower, upper))["bounds"], ((-1, 0, -1), (1, 2, 1)))

    def test_applies_world_bounds_and_saves_named_camera(self):
        tree = SimpleNamespace(getBoundingBox=Mock(return_value=((-1, 0, -1), (1, 2, 1))))
        lux = SimpleNamespace(
            CAMERA_TYPE_PERSPECTIVE=1, getSceneTree=lambda: tree,
            getCameraPosition=lambda: (3, 4, 3), getCameraLookAt=lambda: (0, 1, 0),
            getCameraUp=lambda: (0, 1, 0), getCameraFieldOfView=lambda: 40,
            getCameraLens=lambda: {"lens": 1}, setCameraLookAt=Mock(),
            setCameraPosition=Mock(), saveCamera=Mock(),
        )
        with patch.object(bridge, "lux", lux):
            result = bridge.fit_product_camera({"width": 640, "height": 480, "cameraName": "Hero"})
        tree.getBoundingBox.assert_called_once_with(world=True)
        lux.setCameraLookAt.assert_called_once_with(pt=result["lookAt"])
        lux.setCameraPosition.assert_called_once_with(pos=result["position"])
        lux.saveCamera.assert_called_once()
        lux.getCameraLens = lambda: {"lens": 2}
        with patch.object(bridge, "lux", lux):
            with self.assertRaisesRegex(RuntimeError, "perspective cameras only"):
                bridge.fit_product_camera({"width": 640, "height": 480})

    def test_fit_not_requested_preserves_standard_camera(self):
        with patch.object(bridge, "set_standard_camera", return_value={"standardView": "front"}), \
             patch.object(bridge, "fit_product_camera") as fit:
            result = bridge.configure_product_camera({"standardView": "front"}, [], [])
        fit.assert_not_called()
        self.assertNotIn("fit", result)

    def test_missing_api_is_explicit(self):
        with patch.object(bridge, "lux", SimpleNamespace()):
            with self.assertRaisesRegex(RuntimeError, "does not support"):
                bridge.fit_product_camera({})

    def test_standard_view_lens_then_fit_order(self):
        order = []
        with patch.object(bridge, "set_standard_camera", side_effect=lambda *a, **k: order.append("view") or {}), \
             patch.object(bridge, "set_camera", side_effect=lambda *a, **k: order.append("lens") or {}), \
             patch.object(bridge, "fit_product_camera", side_effect=lambda *a: order.append("fit") or {"padding": .1}):
            result = bridge.configure_product_camera({"standardView": "isometric", "focalLength": 85, "_fitProductCamera": True}, [], [])
        self.assertEqual(order, ["view", "lens", "fit"])
        self.assertEqual(result["fit"]["padding"], .1)


if __name__ == "__main__":
    unittest.main()
