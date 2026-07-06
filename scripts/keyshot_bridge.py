import json
import os
import sys
import traceback

try:
    import lux
except Exception as exc:
    lux = None
    LUX_IMPORT_ERROR = exc
else:
    LUX_IMPORT_ERROR = None


def main():
    args_path = sys.argv[-2]
    result_path = sys.argv[-1]

    with open(args_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    warnings = []
    output_files = []

    try:
        if lux is None:
            raise RuntimeError("Could not import KeyShot lux module: %s" % LUX_IMPORT_ERROR)

        operation = payload.get("operation")
        if operation == "status":
            data = status()
        elif operation == "inspect_scene":
            data = inspect_scene()
        elif operation == "render":
            data = render(payload, output_files, warnings)
        elif operation == "import_model":
            data = import_model(payload, output_files, warnings)
        elif operation == "apply_material":
            data = apply_material(payload, output_files, warnings)
        elif operation == "set_camera":
            data = set_camera(payload, output_files, warnings)
        elif operation == "set_environment":
            data = set_environment(payload, output_files, warnings)
        elif operation == "save_scene":
            data = save_scene(payload, output_files, warnings)
        else:
            raise RuntimeError("Unsupported operation: %s" % operation)

        write_result(result_path, True, data, output_files, warnings, None)
    except Exception as exc:
        warnings.append(traceback.format_exc())
        write_result(result_path, False, None, output_files, warnings, str(exc))


def status():
    return {
        "version": first_success(
            lambda: lux.getKeyShotVersion(),
            lambda: lux.getVersion(),
            lambda: lux.version(),
            default=None,
        ),
        "isHeadless": first_success(
            lambda: lux.isHeadless(),
            lambda: lux.is_headless(),
            default=True,
        ),
        "availableFunctions": sorted([name for name in dir(lux) if not name.startswith("_")]),
    }


def inspect_scene():
    objects = [describe_object(obj) for obj in safe_list_call("getObjects")]
    cameras = [serialize_value(camera) for camera in safe_list_call("getCameras")]
    model_sets = [serialize_value(model_set) for model_set in safe_list_call("getModelSets")]
    environments = [serialize_value(environment) for environment in safe_list_call("getEnvironments")]
    materials = []

    seen = set()
    for obj in objects:
        material = obj.get("material")
        key = json.dumps(material, sort_keys=True, default=str)
        if material is not None and key not in seen:
            seen.add(key)
            materials.append(material)

    return {
        "objects": objects,
        "cameras": cameras,
        "materials": materials,
        "modelSets": model_sets,
        "environments": environments,
        "externalFiles": serialize_value(first_success(lambda: lux.getExternalFiles(), default=[])),
    }


def render(payload, output_files, warnings):
    output_path = payload.get("outputPath") or default_output_path(payload, "render", payload.get("format") or "png")
    ensure_parent(output_path)

    camera = payload.get("camera")
    if camera:
        if hasattr(lux, "setCamera"):
            call_variants(
                "set camera",
                lambda: lux.setCamera(camera),
                lambda: lux.setCamera(str(camera)),
            )
        else:
            warnings.append("Camera selection was requested, but lux.setCamera is not available.")

    width = payload.get("width") or 1920
    height = payload.get("height") or 1080
    samples = payload.get("samples")
    max_time = payload.get("maxTimeSeconds")

    call_variants(
        "render image",
        lambda: lux.renderImage(output_path, width, height),
        lambda: lux.renderImage(output_path, width, height, samples) if samples else None,
        lambda: lux.renderImage(output_path, width, height, samples, max_time) if samples and max_time else None,
        lambda: lux.renderImage(output_path),
    )

    output_files.append(output_path)
    return {"rendered": output_path, "width": width, "height": height}


def import_model(payload, output_files, warnings):
    model_path = payload.get("modelPath")
    output_scene_path = payload.get("outputScenePath")
    if not model_path or not os.path.exists(model_path):
        raise RuntimeError("Model file not found: %s" % model_path)
    if not output_scene_path:
        raise RuntimeError("outputScenePath is required")

    call_variants(
        "import model",
        lambda: lux.importFile(model_path),
        lambda: lux.importFile(str(model_path)),
    )
    save_to(output_scene_path)
    output_files.append(output_scene_path)
    return {"importedModel": model_path, "savedScene": output_scene_path}


def apply_material(payload, output_files, warnings):
    output_scene_path = payload.get("outputScenePath")
    target = find_object(payload.get("objectName"), payload.get("objectPath"))
    if target is None:
        raise RuntimeError("Object not found. Provide a valid objectName or objectPath.")

    material = resolve_material(payload.get("materialName"), payload.get("materialPath"), warnings)
    call_variants(
        "set object material",
        lambda: lux.setObjectMaterial(target, material),
        lambda: lux.setObjectMaterial(target, payload.get("materialName")),
        lambda: lux.setObjectMaterial(target, payload.get("materialPath")),
    )

    save_to(output_scene_path)
    output_files.append(output_scene_path)
    return {
        "object": describe_object(target),
        "material": serialize_value(material),
        "savedScene": output_scene_path,
    }


def set_camera(payload, output_files, warnings):
    output_scene_path = payload.get("outputScenePath")
    camera_name = payload.get("cameraName") or "MCP Camera"
    position = payload.get("position")
    look_at = payload.get("lookAt")
    up = payload.get("up") or [0, 1, 0]

    if position is None or look_at is None:
        raise RuntimeError("position and lookAt are required")

    camera = first_success(
        lambda: lux.getCamera(camera_name),
        lambda: lux.newCamera(camera_name),
        lambda: lux.createCamera(camera_name),
        default=None,
    )

    if camera is None and hasattr(lux, "saveCamera"):
        camera = call_variants("save camera", lambda: lux.saveCamera(camera_name))

    call_variants(
        "set camera position",
        lambda: camera.setPosition(tuple(position)),
        lambda: lux.setCameraPosition(camera_name, tuple(position)),
        lambda: lux.setCameraPosition(tuple(position)),
    )
    call_variants(
        "set camera look-at",
        lambda: camera.setLookAt(tuple(look_at)),
        lambda: lux.setCameraLookAt(camera_name, tuple(look_at)),
        lambda: lux.setCameraLookAt(tuple(look_at)),
    )
    call_variants(
        "set camera up",
        lambda: camera.setUp(tuple(up)),
        lambda: lux.setCameraUp(camera_name, tuple(up)),
        lambda: lux.setCameraUp(tuple(up)),
    )

    save_to(output_scene_path)
    output_files.append(output_scene_path)
    return {
        "cameraName": camera_name,
        "position": position,
        "lookAt": look_at,
        "up": up,
        "savedScene": output_scene_path,
    }


def set_environment(payload, output_files, warnings):
    output_scene_path = payload.get("outputScenePath")
    environment_name = payload.get("environmentName")
    environment_path = payload.get("environmentPath")
    brightness = payload.get("brightness")

    changed = False
    if environment_path:
        if not os.path.exists(environment_path):
            raise RuntimeError("Environment file not found: %s" % environment_path)
        call_variants(
            "set environment file",
            lambda: lux.setEnvironment(environment_path),
            lambda: lux.loadEnvironment(environment_path),
            lambda: lux.importEnvironment(environment_path),
        )
        changed = True
    elif environment_name:
        call_variants(
            "set environment name",
            lambda: lux.setEnvironment(environment_name),
            lambda: lux.setEnvironmentByName(environment_name),
        )
        changed = True

    if brightness is not None:
        call_variants(
            "set environment brightness",
            lambda: lux.setEnvironmentBrightness(brightness),
            lambda: lux.setEnvironmentPower(brightness),
        )
        changed = True

    if not changed:
        raise RuntimeError("No supported environment change was requested.")

    save_to(output_scene_path)
    output_files.append(output_scene_path)
    return {
        "environmentName": environment_name,
        "environmentPath": environment_path,
        "brightness": brightness,
        "savedScene": output_scene_path,
    }


def save_scene(payload, output_files, warnings):
    output_scene_path = payload.get("outputScenePath")
    save_to(output_scene_path)
    output_files.append(output_scene_path)
    return {"savedScene": output_scene_path}


def safe_list_call(name):
    fn = getattr(lux, name, None)
    if fn is None:
        return []
    value = fn()
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return value
    try:
        return list(value)
    except TypeError:
        return [value]


def describe_object(obj):
    return {
        "name": first_success(lambda: obj.getName(), lambda: obj.name(), lambda: obj.name, default=repr(obj)),
        "path": first_success(lambda: obj.getPath(), lambda: obj.path(), lambda: obj.path, default=None),
        "type": first_success(lambda: obj.getType(), lambda: obj.type(), lambda: obj.type, default=type(obj).__name__),
        "material": serialize_value(
            first_success(lambda: obj.getMaterial(), lambda: obj.material(), lambda: obj.material, default=None)
        ),
        "children": len(first_success(lambda: obj.getChildren(), lambda: obj.children(), lambda: obj.children, default=[])),
    }


def find_object(name, path):
    for obj in safe_list_call("getObjects"):
        description = describe_object(obj)
        if name and description.get("name") == name:
            return obj
        if path and description.get("path") == path:
            return obj
    return None


def resolve_material(material_name, material_path, warnings):
    if material_path:
        if not os.path.exists(material_path):
            raise RuntimeError("Material file not found: %s" % material_path)
        return first_success(
            lambda: lux.importMaterial(material_path),
            lambda: lux.loadMaterial(material_path),
            default=material_path,
        )
    if material_name:
        return first_success(
            lambda: lux.getMaterial(material_name),
            lambda: lux.findMaterial(material_name),
            default=material_name,
        )
    raise RuntimeError("materialName or materialPath is required")


def save_to(output_scene_path):
    if not output_scene_path:
        raise RuntimeError("outputScenePath is required")
    ensure_parent(output_scene_path)
    call_variants(
        "save scene",
        lambda: lux.saveScene(output_scene_path),
        lambda: lux.saveFile(output_scene_path),
        lambda: lux.save(output_scene_path),
    )


def call_variants(label, *callbacks):
    errors = []
    for callback in callbacks:
        try:
            value = callback()
            if value is not None:
                return value
            return value
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("%s is unsupported or failed: %s" % (label, " | ".join(errors)))


def first_success(*callbacks, default=None):
    for callback in callbacks:
        try:
            return callback()
        except Exception:
            pass
    return default


def serialize_value(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): serialize_value(item) for key, item in value.items()}

    data = {
        "repr": repr(value),
        "type": type(value).__name__,
    }
    for attr in ("getName", "getPath", "getType"):
        if hasattr(value, attr):
            data[attr[3:].lower()] = first_success(lambda attr=attr: getattr(value, attr)(), default=None)
    return data


def default_output_path(payload, stem, extension):
    output_dir = payload.get("defaults", {}).get("outputDir") or os.getcwd()
    return os.path.join(output_dir, "%s.%s" % (stem, extension))


def ensure_parent(file_path):
    parent = os.path.dirname(os.path.abspath(file_path))
    if parent:
        os.makedirs(parent, exist_ok=True)


def unsupported(message):
    return {"unsupported": True, "reason": message}


def write_result(result_path, ok, data, output_files, warnings, error):
    ensure_parent(result_path)
    with open(result_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "ok": ok,
                "data": data,
                "outputFiles": output_files,
                "warnings": warnings,
                "keyshotStdoutTail": "",
                "error": error,
            },
            handle,
            ensure_ascii=False,
            indent=2,
            default=str,
        )


if __name__ == "__main__":
    main()
