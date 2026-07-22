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
        elif operation == "list_cameras":
            data = list_cameras()
        elif operation == "render":
            data = render(payload, output_files, warnings)
        elif operation == "batch_render":
            data = batch_render(payload, output_files, warnings)
        elif operation == "render_all_cameras":
            data = render_all_cameras(payload, output_files, warnings)
        elif operation == "product_render":
            data = product_render(payload, output_files, warnings)
        elif operation == "import_model":
            data = import_model(payload, output_files, warnings)
        elif operation == "apply_material":
            data = apply_material(payload, output_files, warnings)
        elif operation == "set_camera":
            data = set_camera(payload, output_files, warnings)
        elif operation == "set_standard_camera":
            data = set_standard_camera(payload, output_files, warnings)
        elif operation == "set_environment":
            data = set_environment(payload, output_files, warnings)
        elif operation == "save_scene":
            data = save_scene(payload, output_files, warnings)
        else:
            raise RuntimeError("Unsupported operation: %s" % operation)

        operation_error = None
        if operation == "render_all_cameras" and data.get("failed", 0) > 0:
            operation_error = "%s of %s camera render(s) failed." % (data["failed"], data["total"])
        elif operation == "product_render":
            operation_error = data.get("operationError")
        write_result(result_path, operation_error is None, data, output_files, warnings, operation_error)
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


def list_cameras():
    names = camera_names()
    return {"cameras": names, "count": len(names)}


def camera_names():
    raw = safe_list_call("getCameras")
    names = []
    for camera in raw:
        if isinstance(camera, str):
            name = camera
        else:
            name = first_success(
                lambda camera=camera: camera.getName(),
                lambda camera=camera: camera.name(),
                lambda camera=camera: camera.name,
                default=None,
            )
        if name is None:
            name = repr(camera)
        names.append(str(name))
    return names


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

    if samples is not None and max_time is not None:
        raise RuntimeError("samples and maxTimeSeconds cannot be used together; choose one render mode.")

    render_options = build_render_options(samples, max_time)

    if render_options is None:
        call_variants(
            "render image",
            lambda: lux.renderImage(output_path, width, height),
            lambda: lux.renderImage(output_path),
        )
    else:
        # Current KeyShot versions accept a RenderOptions object. Keep positional
        # and keyword variants for older headless scripting builds.
        call_variants(
            "render image with options",
            lambda: lux.renderImage(output_path, width, height, opts=render_options),
            lambda: lux.renderImage(output_path, width, height, render_options),
            lambda: lux.renderImage(output_path, opts=render_options),
        )

    output_files.append(output_path)
    return {
        "rendered": output_path,
        "width": width,
        "height": height,
        "samples": samples,
        "maxTimeSeconds": max_time,
        "qualityPreset": payload.get("qualityPreset"),
    }


def batch_render(payload, output_files, warnings):
    scene_path = payload.get("scenePath")
    output_dir = payload.get("outputDir")
    cameras = payload.get("cameras") or []
    width = payload.get("width") or 1920
    height = payload.get("height") or 1080
    image_format = payload.get("format") or "png"
    overwrite = bool(payload.get("overwrite", False))

    if not scene_path:
        raise RuntimeError("scenePath is required")
    if not output_dir:
        raise RuntimeError("outputDir is required")
    if not cameras:
        raise RuntimeError("cameras must contain at least one camera name")

    os.makedirs(output_dir, exist_ok=True)
    rendered = []

    for camera in cameras:
        safe_camera = safe_filename(camera)
        output_path = os.path.join(output_dir, "%s.%s" % (safe_camera, image_format))
        if os.path.exists(output_path) and not overwrite:
            raise RuntimeError("Output already exists and overwrite is false: %s" % output_path)

        render_payload = dict(payload)
        render_payload["camera"] = camera
        render_payload["outputPath"] = output_path
        render_payload["width"] = width
        render_payload["height"] = height
        render_payload["format"] = image_format

        result = render(render_payload, output_files, warnings)
        rendered.append({"camera": camera, "outputPath": result.get("rendered")})

    return {
        "scenePath": scene_path,
        "outputDir": output_dir,
        "cameras": cameras,
        "rendered": rendered,
        "width": width,
        "height": height,
        "format": image_format,
    }


def render_all_cameras(payload, output_files, warnings):
    scene_path = payload.get("scenePath")
    if not scene_path:
        raise RuntimeError("scenePath is required")
    return render_all_cameras_current(payload, output_files, warnings)


def render_all_cameras_current(payload, output_files, warnings):
    scene_path = payload.get("scenePath")
    output_dir = payload.get("outputDir")
    discovered_cameras = camera_names()
    excluded_cameras = [name for name in discovered_cameras if name.lower() == "last_active"]
    cameras = [name for name in discovered_cameras if name.lower() != "last_active"]
    width = payload.get("width") or 1920
    height = payload.get("height") or 1080
    image_format = payload.get("format") or "png"
    overwrite = bool(payload.get("overwrite", False))
    continue_on_error = payload.get("continueOnError", True) is not False

    if not output_dir:
        raise RuntimeError("outputDir is required")
    if not cameras:
        raise RuntimeError("No cameras were found in the scene.")

    if excluded_cameras:
        warnings.append("Skipped KeyShot internal camera placeholder(s): %s" % ", ".join(excluded_cameras))

    os.makedirs(output_dir, exist_ok=True)
    results = []
    used_stems = set()
    stopped = False

    for index, camera in enumerate(cameras):
        output_path = unique_camera_output_path(output_dir, camera, image_format, used_stems)
        if stopped:
            results.append(camera_render_result(index, camera, output_path, False, None, True))
            continue

        try:
            if os.path.exists(output_path) and not overwrite:
                raise RuntimeError("Output already exists and overwrite is false: %s" % output_path)

            render_payload = dict(payload)
            render_payload["camera"] = camera
            render_payload["outputPath"] = output_path
            render_payload["width"] = width
            render_payload["height"] = height
            render_payload["format"] = image_format
            rendered = render(render_payload, output_files, warnings)
            results.append(camera_render_result(index, camera, rendered.get("rendered"), True, None, False))
        except Exception as exc:
            error = str(exc)
            warnings.append("Camera %s (%s) failed: %s" % (index, camera, error))
            results.append(camera_render_result(index, camera, output_path, False, error, False))
            if not continue_on_error:
                stopped = True

    succeeded = len([item for item in results if item["ok"]])
    failed = len([item for item in results if not item["ok"] and not item["skipped"]])
    skipped = len([item for item in results if item["skipped"]])
    return {
        "scenePath": scene_path,
        "outputDir": output_dir,
        "cameras": cameras,
        "excludedCameras": excluded_cameras,
        "total": len(cameras),
        "succeeded": succeeded,
        "failed": failed,
        "skipped": skipped,
        "continueOnError": continue_on_error,
        "results": results,
        "width": width,
        "height": height,
        "format": image_format,
    }


def camera_render_result(index, camera, output_path, ok, error, skipped):
    return {
        "index": index,
        "camera": camera,
        "outputPath": output_path,
        "ok": ok,
        "error": error,
        "skipped": skipped,
    }


def unique_camera_output_path(output_dir, camera, image_format, used_stems):
    base = safe_filename(camera)
    stem = base
    suffix = 2
    while stem.lower() in used_stems:
        stem = "%s-%s" % (base, suffix)
        suffix += 1
    used_stems.add(stem.lower())
    return os.path.join(output_dir, "%s.%s" % (stem, image_format))


def product_render(payload, output_files, warnings):
    stages = []
    source_type = "model" if payload.get("modelPath") else "scene"
    source_path = payload.get("modelPath") or payload.get("scenePath")
    result = {
        "sourceType": source_type,
        "sourcePath": source_path,
        "savedScene": None,
        "renderMode": payload.get("renderMode") or "single",
        "renders": [],
        "materialAssignments": [],
        "camera": None,
        "environment": None,
        "stages": stages,
        "operationError": None,
    }

    try:
        if source_type == "model":
            source_data = import_model_current(payload, warnings)
        else:
            if not source_path:
                raise RuntimeError("scenePath is required")
            source_data = {"openedScene": source_path}
        stages.append(product_stage("source", True, source_data))
    except Exception as exc:
        return product_failure(result, stages, "source", exc, warnings)

    assignments = payload.get("materialAssignments") or []
    try:
        applied_materials = [apply_material_current(assignment, warnings) for assignment in assignments]
        result["materialAssignments"] = applied_materials
        stages.append(product_stage("materials", True, applied_materials, len(assignments) == 0))
    except Exception as exc:
        return product_failure(result, stages, "materials", exc, warnings)

    try:
        camera_data = configure_product_camera(payload, output_files, warnings)
        result["camera"] = camera_data
        stages.append(product_stage("camera", True, camera_data, camera_data is None))
    except Exception as exc:
        return product_failure(result, stages, "camera", exc, warnings)

    environment_requested = any(
        payload.get(name) is not None
        for name in ("environmentName", "environmentPath", "brightness", "rotation")
    )
    try:
        environment_data = set_environment(payload, output_files, warnings, persist=False) if environment_requested else None
        result["environment"] = environment_data
        stages.append(product_stage("environment", True, environment_data, not environment_requested))
    except Exception as exc:
        return product_failure(result, stages, "environment", exc, warnings)

    output_scene_path = payload.get("outputScenePath")
    try:
        if not output_scene_path:
            raise RuntimeError("outputScenePath is required")
        save_to(output_scene_path)
        output_files.append(output_scene_path)
        result["savedScene"] = output_scene_path
        stages.append(product_stage("save", True, {"savedScene": output_scene_path}))
    except Exception as exc:
        return product_failure(result, stages, "save", exc, warnings)

    try:
        if result["renderMode"] == "allCameras":
            render_payload = dict(payload)
            render_payload["scenePath"] = output_scene_path
            render_data = render_all_cameras_current(render_payload, output_files, warnings)
            result["renders"] = render_data.get("results", [])
            render_ok = render_data.get("failed", 0) == 0
            stages.append(product_stage("render", render_ok, render_data))
            if not render_ok:
                result["operationError"] = "%s of %s camera render(s) failed." % (
                    render_data.get("failed", 0),
                    render_data.get("total", 0),
                )
        else:
            output_path = payload.get("outputPath")
            if not output_path:
                raise RuntimeError("outputPath is required for single render mode")
            if os.path.exists(output_path) and not payload.get("overwrite", False):
                raise RuntimeError("Output already exists and overwrite is false: %s" % output_path)
            render_payload = dict(payload)
            if payload.get("cameraName"):
                render_payload["camera"] = payload.get("cameraName")
            render_data = render(render_payload, output_files, warnings)
            result["renders"] = [{"camera": render_payload.get("camera"), "outputPath": render_data["rendered"], "ok": True}]
            stages.append(product_stage("render", True, render_data))
    except Exception as exc:
        return product_failure(result, stages, "render", exc, warnings)

    return result


def configure_product_camera(payload, output_files, warnings):
    camera_name = payload.get("cameraName")
    standard_view = payload.get("standardView")
    transform_requested = payload.get("position") is not None
    lens_requested = any(payload.get(name) is not None for name in ("distance", "fieldOfView", "focalLength"))

    if standard_view:
        standard_data = set_standard_camera(payload, output_files, warnings, persist=False)
        if lens_requested:
            lens_payload = {
                "cameraName": camera_name,
                "distance": payload.get("distance"),
                "fieldOfView": payload.get("fieldOfView"),
                "focalLength": payload.get("focalLength"),
            }
            lens_data = set_camera(lens_payload, output_files, warnings, persist=False)
            standard_data.update({
                "distance": lens_data.get("distance"),
                "fieldOfView": lens_data.get("fieldOfView"),
                "focalLength": lens_data.get("focalLength"),
            })
        standard_data["presetName"] = payload.get("cameraPresetName")
        return standard_data

    if transform_requested or lens_requested:
        camera_data = set_camera(payload, output_files, warnings, persist=False)
        camera_data["presetName"] = payload.get("cameraPresetName")
        return camera_data

    if camera_name:
        if camera_name not in camera_names():
            raise RuntimeError("Camera not found: %s" % camera_name)
        call_non_false_variants("activate camera", lambda: lux.setCamera(camera_name))
        return {"cameraName": camera_name, "selected": True}

    return None


def product_stage(name, ok, data=None, skipped=False, error=None):
    return {"name": name, "ok": ok, "skipped": skipped, "data": data, "error": error}


def product_failure(result, stages, stage_name, error, warnings):
    message = "Product render stage '%s' failed: %s" % (stage_name, error)
    stages.append(product_stage(stage_name, False, error=str(error)))
    warnings.append(message)
    result["operationError"] = message
    return result


def import_model(payload, output_files, warnings):
    data = import_model_current(payload, warnings)
    output_scene_path = payload.get("outputScenePath")
    if not output_scene_path:
        raise RuntimeError("outputScenePath is required")
    save_to(output_scene_path)
    output_files.append(output_scene_path)
    data["savedScene"] = output_scene_path
    return data


def import_model_current(payload, warnings):
    model_path = payload.get("modelPath")
    base_scene_path = payload.get("baseScenePath")
    if not model_path or not os.path.exists(model_path):
        raise RuntimeError("Model file not found: %s" % model_path)

    if base_scene_path:
        if not os.path.exists(base_scene_path):
            raise RuntimeError("Base scene file not found: %s" % base_scene_path)
        open_scene(base_scene_path, warnings)
    else:
        new_scene(warnings)

    import_option_names = {
        "centerGeometry": "center_geometry",
        "snapToGround": "snap_to_ground",
        "adjustCameraLookAt": "adjust_camera_look_at",
        "adjustEnvironment": "adjust_environment",
    }
    requested_options = {
        option_name: payload[payload_name]
        for payload_name, option_name in import_option_names.items()
        if payload_name in payload and payload[payload_name] is not None
    }

    if requested_options:
        get_import_options = getattr(lux, "getImportOptions", None)
        if not callable(get_import_options):
            raise RuntimeError(
                "Advanced import options are unsupported because KeyShot lux.getImportOptions is not available."
            )
        options = call_variants(
            "read import options",
            lambda: get_import_options(ext=os.path.splitext(model_path)[1], getDefaults=True),
            lambda: get_import_options(os.path.splitext(model_path)[1], True),
            lambda: get_import_options(),
        )
        if not isinstance(options, dict):
            raise RuntimeError("KeyShot did not return a usable import options dictionary.")
        options.update(requested_options)
        call_variants(
            "import model with options",
            lambda: lux.importFile(model_path, opts=options),
            lambda: lux.importFile(model_path, False, True, options),
        )
    else:
        call_variants(
            "import model",
            lambda: lux.importFile(model_path),
            lambda: lux.importFile(str(model_path)),
        )
    return {
        "importedModel": model_path,
        "baseScene": base_scene_path,
        "importOptions": requested_options,
    }


def open_scene(scene_path, warnings):
    call_variants(
        "open base scene",
        lambda: lux.openScene(scene_path),
        lambda: lux.openFile(scene_path),
        lambda: lux.loadScene(scene_path),
        lambda: lux.openProject(scene_path),
    )


def new_scene(warnings):
    try:
        call_variants(
            "create new scene",
            lambda: lux.newScene(),
            lambda: lux.createScene(),
            lambda: lux.newProject(),
        )
    except RuntimeError:
        warnings.append("Started import into the current KeyShot scene (could not create a new scene).")


def apply_material(payload, output_files, warnings):
    data = apply_material_current(payload, warnings)
    output_scene_path = payload.get("outputScenePath")
    if not output_scene_path:
        raise RuntimeError("outputScenePath is required")
    save_to(output_scene_path)
    output_files.append(output_scene_path)
    data["savedScene"] = output_scene_path
    return data


def apply_material_current(payload, warnings):
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

    return {
        "object": describe_object(target),
        "material": serialize_value(material),
        "presetName": payload.get("presetName"),
    }


def set_camera(payload, output_files, warnings, persist=True):
    output_scene_path = payload.get("outputScenePath")
    camera_name = payload.get("cameraName") or "MCP Camera"
    position = payload.get("position")
    look_at = payload.get("lookAt")
    up = payload.get("up") or [0, 1, 0]
    distance = payload.get("distance")
    field_of_view = payload.get("fieldOfView")
    focal_length = payload.get("focalLength")

    if (position is None) != (look_at is None):
        raise RuntimeError("position and lookAt must be provided together")
    if field_of_view is not None and focal_length is not None:
        raise RuntimeError("fieldOfView and focalLength cannot be used together")
    if position is None and distance is None and field_of_view is None and focal_length is None:
        raise RuntimeError("No supported camera change was requested.")
    direction = (
        tuple(look_at[index] - position[index] for index in range(3))
        if position is not None
        else None
    )

    existing_camera = camera_name in camera_names()
    if existing_camera and hasattr(lux, "setCamera"):
        call_non_false_variants("activate camera", lambda: lux.setCamera(camera_name))

    if existing_camera:
        camera = first_camera_object(
            lambda: lux.getCamera(camera_name),
            lambda: lux.getCamera(),
        )
    else:
        camera = first_camera_object(
            lambda: lux.newCamera(camera_name),
            lambda: lux.createCamera(camera_name),
            lambda: lux.getCamera(camera_name),
            lambda: lux.getCamera(),
        )

    if camera is not None and position is not None:
        # Object-level API is available: drive the camera object directly.
        call_variants("set camera look-at", lambda: camera.setLookAt(tuple(look_at)))
        call_variants("set camera position", lambda: camera.setPosition(tuple(position)))
        if hasattr(camera, "setDirection"):
            call_variants("set camera direction", lambda: camera.setDirection(direction))
        call_variants("set camera up", lambda: camera.setUp(tuple(up)))
    elif position is not None:
        # No camera object could be obtained: fall back to the lux-level setters,
        # which operate on the active camera. Existing named cameras are activated
        # first. Missing cameras are saved under their new name after the transform
        # is set; saveCamera is a snapshot operation, not a camera constructor.
        call_variants(
            "set camera look-at",
            lambda: lux.setCameraLookAt(pt=tuple(look_at)),
            lambda: lux.setCameraLookAt(0, tuple(look_at)),
            lambda: lux.setCameraLookAt(camera_name, tuple(look_at)),
        )
        call_variants(
            "set camera position",
            lambda: lux.setCameraPosition(pos=tuple(position)),
            lambda: lux.setCameraPosition(tuple(position)),
            lambda: lux.setCameraPosition(camera_name, tuple(position)),
        )
        if hasattr(lux, "setCameraDirection"):
            call_variants(
                "set camera direction",
                lambda: lux.setCameraDirection(dir=direction),
                lambda: lux.setCameraDirection(direction),
            )
        call_variants(
            "set camera up",
            lambda: lux.setCameraUp(up=tuple(up)),
            lambda: lux.setCameraUp(tuple(up)),
            lambda: lux.setCameraUp(camera_name, tuple(up)),
        )
    if distance is not None:
        call_variants(
            "set camera distance",
            lambda: lux.setCameraDistance(dist=distance),
            lambda: lux.setCameraDistance(distance),
        )
    if field_of_view is not None:
        call_variants(
            "set camera field of view",
            lambda: lux.setCameraFieldOfView(deg=field_of_view),
            lambda: lux.setCameraFieldOfView(field_of_view),
        )
    if focal_length is not None:
        call_variants(
            "set camera focal length",
            lambda: lux.setCameraFocalLength(length=focal_length),
            lambda: lux.setCameraFocalLength(focal_length),
        )

    if hasattr(lux, "saveCamera"):
        try:
            call_variants(
                "save named camera",
                lambda: lux.saveCamera(),
                lambda: lux.saveCamera(camera_name),
            )
        except RuntimeError:
            warnings.append("The camera was updated, but this KeyShot version could not save the named view.")

    data = {
        "cameraName": camera_name,
        "position": position,
        "lookAt": look_at,
        "up": up,
        "distance": distance,
        "fieldOfView": field_of_view,
        "focalLength": focal_length,
    }
    if persist:
        if not output_scene_path:
            raise RuntimeError("outputScenePath is required")
        save_to(output_scene_path)
        output_files.append(output_scene_path)
        data["savedScene"] = output_scene_path
    return data


def set_standard_camera(payload, output_files, warnings, persist=True):
    output_scene_path = payload.get("outputScenePath")
    camera_name = payload.get("cameraName") or "MCP Camera"
    standard_view = str(payload.get("standardView") or "").lower()
    view_constants = {
        "front": "VIEW_FRONT",
        "back": "VIEW_BACK",
        "left": "VIEW_LEFT",
        "right": "VIEW_RIGHT",
        "top": "VIEW_TOP",
        "bottom": "VIEW_BOTTOM",
        "isometric": "VIEW_ISOMETRIC",
    }

    constant_name = view_constants.get(standard_view)
    if constant_name is None:
        raise RuntimeError("Unsupported standard camera view: %s" % standard_view)
    if not hasattr(lux, "setStandardView"):
        raise RuntimeError("KeyShot lux.setStandardView is not available.")
    if not hasattr(lux, constant_name):
        raise RuntimeError("KeyShot camera constant is not available: %s" % constant_name)

    if camera_name in camera_names():
        if not hasattr(lux, "setCamera"):
            raise RuntimeError("KeyShot cannot activate the existing camera: %s" % camera_name)
        call_non_false_variants("activate camera", lambda: lux.setCamera(camera_name))
    else:
        call_non_false_variants(
            "create camera",
            lambda: lux.newCamera(camera_name),
            lambda: lux.createCamera(camera_name),
        )

    call_variants("set standard camera view", lambda: lux.setStandardView(getattr(lux, constant_name)))
    call_variants(
        "save standard camera",
        lambda: lux.saveCamera(),
        lambda: lux.saveCamera(camera_name),
    )
    data = {
        "cameraName": camera_name,
        "standardView": standard_view,
    }
    if persist:
        if not output_scene_path:
            raise RuntimeError("outputScenePath is required")
        save_to(output_scene_path)
        output_files.append(output_scene_path)
        data["savedScene"] = output_scene_path
    return data


def set_environment(payload, output_files, warnings, persist=True):
    output_scene_path = payload.get("outputScenePath")
    environment_name = payload.get("environmentName")
    environment_path = payload.get("environmentPath")
    brightness = payload.get("brightness")
    rotation = payload.get("rotation")

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
            lambda: lux.setActiveEnvironment(environment_name),
            lambda: lux.setEnvironment(environment_name),
            lambda: lux.setEnvironmentByName(environment_name),
        )
        changed = True

    if brightness is not None:
        environment = active_environment()
        if environment is not None and hasattr(environment, "setBrightness"):
            call_variants("set environment brightness", lambda: environment.setBrightness(brightness))
        else:
            call_variants(
                "set environment brightness",
                lambda: lux.setEnvironmentBrightness(brightness),
                lambda: lux.setEnvironmentPower(brightness),
            )
        changed = True

    if rotation is not None:
        environment = active_environment()
        if environment is not None and hasattr(environment, "setRotation"):
            call_variants("set environment rotation", lambda: environment.setRotation(rotation))
        else:
            call_variants(
                "set environment rotation",
                lambda: lux.setEnvironmentRotation(rotation),
                lambda: lux.rotateEnvironment(rotation),
            )
        changed = True

    if not changed:
        raise RuntimeError("No supported environment change was requested.")

    data = {
        "environmentName": environment_name,
        "environmentPath": environment_path,
        "brightness": brightness,
        "rotation": rotation,
    }
    if persist:
        if not output_scene_path:
            raise RuntimeError("outputScenePath is required")
        save_to(output_scene_path)
        output_files.append(output_scene_path)
        data["savedScene"] = output_scene_path
    return data


def active_environment():
    fn = getattr(lux, "getActiveEnvironment", None)
    if not callable(fn):
        return None
    try:
        return fn()
    except Exception:
        return None


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
    """Try each callback in order. The first one that does not raise wins, even
    if it returns None (KeyShot setters typically return nothing). Only if every
    callback raises do we report the combined errors."""
    errors = []
    for callback in callbacks:
        try:
            return callback()
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("%s is unsupported or failed: %s" % (label, " | ".join(errors)))


def call_non_false_variants(label, *callbacks):
    errors = []
    for callback in callbacks:
        try:
            value = callback()
            if value is not False:
                return value
            errors.append("returned false")
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


def first_non_none(*callbacks, default=None):
    for callback in callbacks:
        try:
            value = callback()
            if value is not None:
                return value
        except Exception:
            pass
    return default


def first_camera_object(*callbacks):
    for callback in callbacks:
        try:
            value = callback()
            if is_camera_object(value):
                return value
        except Exception:
            pass
    return None


def is_camera_object(value):
    if value is None or value is False or value is True:
        return False
    return any(hasattr(value, method) for method in ("setPosition", "setLookAt", "setUp"))


def build_render_options(samples, max_time):
    if samples is None and max_time is None:
        return None

    get_options = getattr(lux, "getRenderOptions", None)
    if get_options is None:
        raise RuntimeError("KeyShot lux.getRenderOptions is not available for advanced render settings.")

    options = get_options()
    if options is None:
        raise RuntimeError("KeyShot returned no RenderOptions object for advanced render settings.")

    if samples is not None:
        call_variants(
            "set render samples",
            lambda: options.setMaxSamplesRendering(samples),
            lambda: options.setAdvancedRendering(samples),
        )

    if max_time is not None:
        call_variants(
            "set render max time",
            lambda: options.setMaxTimeRendering(max_time),
        )

    return options


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


def safe_filename(value):
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in str(value))
    return safe.strip("._") or "camera"


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
