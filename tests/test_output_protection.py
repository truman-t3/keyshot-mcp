import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts")))
import keyshot_bridge as kb  # noqa: E402
from test_bridge import AllCameraRenderLux, FakeLux, ProductRenderLux, RenderLux  # noqa: E402


class OutputProtectionTests(unittest.TestCase):
    def setUp(self):
        self.previous_lux = kb.lux
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.addCleanup(setattr, kb, "lux", self.previous_lux)
        self.root = self.directory.name

    def file(self, name, content="original"):
        target = os.path.join(self.root, name)
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(content)
        return target

    def test_saving_and_rendering_reject_existing_outputs_by_default(self):
        target = self.file("existing.bip")
        kb.lux = FakeLux()
        with self.assertRaisesRegex(RuntimeError, "Output already exists"):
            kb.save_to(target)
        self.assertEqual(kb.lux.save_scene_called, [])
        kb.lux = RenderLux()
        with self.assertRaisesRegex(RuntimeError, "Output already exists"):
            kb.render({"outputPath": target}, [], [])
        self.assertEqual(kb.lux.render_calls, [])
        with open(target, encoding="utf-8") as handle:
            self.assertEqual(handle.read(), "original")

    def test_explicit_overwrite_allows_only_distinct_outputs(self):
        target = self.file("copy.bip")
        source = self.file("source.bip")
        kb.lux = FakeLux()
        kb.save_to(target, {"scenePath": source, "overwrite": True})
        self.assertEqual(kb.lux.save_scene_called, [target])
        kb.lux = RenderLux()
        kb.render({"scenePath": source, "outputPath": target, "overwrite": True}, [], [])
        self.assertEqual(len(kb.lux.render_calls), 1)

    def test_all_declared_inputs_are_protected_even_with_overwrite(self):
        target = self.file("source.bip")
        for field in ("scenePath", "sourcePath", "modelPath", "baseScenePath", "materialPath", "environmentPath"):
            with self.subTest(field=field), self.assertRaisesRegex(RuntimeError, "Output must not replace an input"):
                kb.save_to(target, {field: target, "overwrite": True})
        with self.assertRaisesRegex(RuntimeError, "Output must not replace an input"):
            kb.render({"outputPath": target, "overwrite": True, "materialAssignments": [{"materialPath": target}]}, [], [])

    def test_hard_link_aliases_cannot_replace_inputs(self):
        source = self.file("source.bip")
        alias = os.path.join(self.root, "alias.bip")
        os.link(source, alias)
        with self.assertRaisesRegex(RuntimeError, "Output must not replace an input"):
            kb.save_to(alias, {"scenePath": source, "overwrite": True})

    def test_batch_and_all_cameras_check_each_generated_path(self):
        source = self.file("scene.bip")
        target = self.file("Front.png")
        for operation in (kb.batch_render, kb.render_all_cameras):
            kb.lux = AllCameraRenderLux(["Front"])
            payload = {"scenePath": source, "outputDir": self.root, "cameras": ["Front"]}
            with self.subTest(operation=operation.__name__):
                if operation == kb.batch_render:
                    with self.assertRaisesRegex(RuntimeError, "Output already exists"):
                        operation(payload, [], [])
                else:
                    self.assertEqual(operation(payload, [], [])["failed"], 1)
                self.assertEqual(kb.lux.render_calls, [])
        with open(target, encoding="utf-8") as handle:
            self.assertEqual(handle.read(), "original")

    def test_generated_camera_output_cannot_follow_hard_link_to_source(self):
        source = self.file("scene.bip")
        os.link(source, os.path.join(self.root, "Front.png"))
        kb.lux = AllCameraRenderLux(["Front"])
        result = kb.render_all_cameras({"scenePath": source, "outputDir": self.root, "overwrite": True}, [], [])
        self.assertEqual(result["failed"], 1)
        self.assertIn("Output must not replace an input", result["results"][0]["error"])
        self.assertEqual(kb.lux.render_calls, [])

    def test_selected_cameras_with_colliding_safe_names_get_separate_files(self):
        kb.lux = AllCameraRenderLux(["Hero/A", "Hero:A"])
        result = kb.batch_render({
            "scenePath": "source.bip", "outputDir": self.root,
            "cameras": ["Hero/A", "Hero:A"], "overwrite": True,
        }, [], [])
        self.assertEqual([os.path.basename(item["outputPath"]) for item in result["rendered"]], ["Hero_A.png", "Hero_A-2.png"])

    def test_generated_camera_output_cannot_escape_root_through_symlink(self):
        outside = self.file("outside.png")
        allowed = os.path.join(self.root, "allowed")
        os.mkdir(allowed)
        link = os.path.join(allowed, "Front.png")
        try:
            os.symlink(outside, link)
        except OSError as exc:
            self.skipTest("File symlinks require OS permission: %s" % exc)
        kb.lux = AllCameraRenderLux(["Front"])
        result = kb.render_all_cameras({
            "scenePath": "scene.bip", "outputDir": allowed, "overwrite": True,
            "defaults": {"outputDir": allowed},
        }, [], [])
        self.assertEqual(result["failed"], 1)
        self.assertIn("KEYSHOT_OUTPUT_DIR", result["results"][0]["error"])
        self.assertEqual(kb.lux.render_calls, [])

    def test_bridge_rechecks_if_output_appears_after_node_preflight(self):
        output = os.path.join(self.root, "late.bip")
        kb.lux = FakeLux()
        self.file("late.bip", "other writer")
        with self.assertRaisesRegex(RuntimeError, "Output already exists"):
            kb.save_to(output, {"overwrite": False})
        self.assertEqual(kb.lux.save_scene_called, [])

    def test_scene_and_image_outputs_must_be_distinct(self):
        output = os.path.join(self.root, "same.bip")
        with self.assertRaisesRegex(RuntimeError, "Output paths must refer to different files"):
            kb.save_to(output, {"outputPath": output, "overwrite": True})

    @unittest.skipUnless(hasattr(os, "mkfifo"), "Named-pipe creation requires POSIX")
    def test_existing_special_files_are_not_valid_overwrite_destinations(self):
        output = os.path.join(self.root, "pipe.bip")
        os.mkfifo(output)
        with self.assertRaisesRegex(RuntimeError, "must be a regular file"):
            kb.save_to(output, {"overwrite": True})

    def test_product_all_cameras_keeps_original_inputs_protected_after_save(self):
        source = self.file("Front.png")
        scene = os.path.join(self.root, "copy.bip")
        kb.lux = ProductRenderLux(cameras=["Front"])
        with patch.object(kb, "configure_product_camera", return_value=None):
            result = kb.product_render({
                "scenePath": source, "outputScenePath": scene, "outputDir": self.root,
                "renderMode": "allCameras", "overwrite": True,
            }, [], [])
        self.assertEqual(result["savedScene"], scene)
        self.assertIn("Output must not replace an input", result["renders"][0]["error"])


if __name__ == "__main__":
    unittest.main()
