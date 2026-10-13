import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))
import keyshot_bridge as kb  # noqa: E402


class MaterialNode:
    def __init__(self, material='Original'):
        self.material = material

    def getID(self):
        return 42

    def getMaterial(self):
        return self.material

    def getName(self):
        return 'Body'

    def getChildren(self):
        return []


class MaterialLux:
    def __init__(self, node):
        self.node = node
        self.scene_names = ['Original']
        self.library_names = ['Steel Brushed', 'Glass Basic White']
        self.calls = []
        self.saved = []
        self.loaded = []
        self.no_op = False

    def getSceneMaterials(self):
        return self.scene_names

    def getLibraryMaterials(self):
        return self.library_names

    def loadMaterials(self, *, file):
        self.loaded.append(file)
        return ['Loaded Glass']

    def setObjectMaterial(self, *, mat, obj):
        self.calls.append((mat, obj))
        if not self.no_op:
            self.node.material = mat + ' #1'

    def saveScene(self, path):
        self.saved.append(path)


class MaterialTest(unittest.TestCase):
    def setUp(self):
        self.previous_lux = kb.lux
        self.previous_find = kb.find_object
        self.node = MaterialNode()
        self.lux = MaterialLux(self.node)
        kb.lux = self.lux
        kb.find_object = lambda name, path: self.node

    def tearDown(self):
        kb.lux = self.previous_lux
        kb.find_object = self.previous_find

    def test_library_name_is_verified_and_actual_duplicate_is_returned(self):
        result = kb.apply_material_current({'materialName': 'Steel Brushed'}, [])
        self.assertEqual(result['previousMaterial'], 'Original')
        self.assertEqual(result['appliedMaterial'], 'Steel Brushed #1')
        self.assertEqual(self.lux.calls, [('Steel Brushed', 42)])

    def test_existing_scene_material_needs_no_library_lookup(self):
        self.lux.getLibraryMaterials = lambda: self.fail('unnecessary library lookup')
        self.assertEqual(kb.resolve_material('Original', None, []), 'Original')

    def test_missing_name_fails_before_assignment_and_save(self):
        with self.assertRaisesRegex(RuntimeError, 'Material not found'):
            kb.apply_material({'materialName': 'Glass Clear', 'outputScenePath': 'x.bip'}, [], [])
        self.assertEqual(self.lux.calls, [])
        self.assertEqual(self.lux.saved, [])

    def test_none_returning_no_op_is_rejected_before_save(self):
        self.lux.no_op = True
        with self.assertRaisesRegex(RuntimeError, 'Material assignment not applied'):
            kb.apply_material({'materialName': 'Steel Brushed', 'outputScenePath': 'x.bip'}, [], [])
        self.assertEqual(self.lux.saved, [])

    def test_already_requested_material_is_success(self):
        self.node.material = 'Steel Brushed #1'
        self.lux.no_op = True
        kb.apply_material_current({'materialName': 'Steel Brushed'}, [])

    def test_similar_name_is_not_accepted_as_duplicate(self):
        self.assertFalse(kb.material_assignment_matches('Steel Brushed Heavy', 'Steel Brushed'))
        self.assertFalse(kb.material_assignment_matches('Steel Brushed #wrong', 'Steel Brushed'))

    def test_material_file_uses_plural_loader_and_returned_name(self):
        with tempfile.NamedTemporaryFile(suffix='.mtl') as source:
            result = kb.apply_material_current({'materialPath': source.name}, [])
            self.assertEqual(self.lux.loaded, [source.name])
            self.assertEqual(result['appliedMaterial'], 'Loaded Glass #1')
            self.assertEqual(self.lux.calls, [('Loaded Glass', 42)])

    def test_multi_material_file_is_rejected(self):
        self.lux.loadMaterials = lambda **kwargs: ['One', 'Two']
        with tempfile.NamedTemporaryFile(suffix='.mtl') as source:
            with self.assertRaisesRegex(RuntimeError, 'multiple materials'):
                kb.resolve_material(None, source.name, [])
        self.assertEqual(self.lux.calls, [])

    def test_empty_load_is_rejected(self):
        self.lux.loadMaterials = lambda **kwargs: None
        with tempfile.NamedTemporaryFile(suffix='.mtl') as source:
            with self.assertRaisesRegex(RuntimeError, 'did not return any'):
                kb.resolve_material(None, source.name, [])

    def test_corrupt_file_is_not_used_as_a_material_name(self):
        def fail(*args, **kwargs):
            raise RuntimeError('invalid material data')
        self.lux.loadMaterials = fail
        with tempfile.NamedTemporaryFile(suffix='.mtl') as source:
            with self.assertRaisesRegex(RuntimeError, 'invalid material data'):
                kb.resolve_material(None, source.name, [])
        self.assertEqual(self.lux.calls, [])

    def test_missing_file_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'Material file not found'):
            kb.resolve_material(None, '/missing/keyshot-material.mtl', [])

    def test_unreadable_assignment_cannot_report_success(self):
        self.node.getMaterial = lambda: None
        with self.assertRaisesRegex(RuntimeError, 'cannot be verified'):
            kb.apply_material_current({'materialName': 'Steel Brushed'}, [])

    def test_empty_original_material_can_be_assigned(self):
        self.node.material = None
        result = kb.apply_material_current({'materialName': 'Steel Brushed'}, [])
        self.assertIsNone(result['previousMaterial'])

    def test_sync_runs_before_verification(self):
        self.lux.no_op = True
        self.lux.sync = lambda: setattr(self.node, 'material', 'Steel Brushed #2')
        result = kb.apply_material_current({'materialName': 'Steel Brushed'}, [])
        self.assertEqual(result['appliedMaterial'], 'Steel Brushed #2')

    def test_library_failure_is_not_disguised_as_missing_name(self):
        def fail():
            raise RuntimeError('library unavailable')
        self.lux.getLibraryMaterials = fail
        with self.assertRaisesRegex(RuntimeError, 'Material lookup failed'):
            kb.resolve_material('Steel Brushed', None, [])

    def test_native_object_material_getter_is_a_verification_fallback(self):
        self.node.getMaterial = lambda: None
        self.lux.getObjectMaterial = lambda *, obj: self.node.material
        result = kb.apply_material_current({'materialName': 'Steel Brushed'}, [])
        self.assertEqual(result['appliedMaterial'], 'Steel Brushed #1')

    def test_no_lookup_api_cannot_claim_material_exists(self):
        self.lux.getSceneMaterials = None
        self.lux.getLibraryMaterials = None
        with self.assertRaisesRegex(RuntimeError, 'lookup is unsupported'):
            kb.resolve_material('Steel Brushed', None, [])


if __name__ == '__main__':
    unittest.main()
