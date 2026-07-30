# -*- coding: utf-8 -*-
# AUTHOR truman-t3
# VERSION 0.10.0
# Starts the local KeyShot MCP Live Companion for the current GUI scene.

"""KeyShot MCP Live Companion.

Install this file as ``Start KeyShot MCP Live.py`` in the KeyShot Scripts
folder. Networking runs on a worker thread; every lux call is dispatched on
the script thread so the KeyShot API is never called concurrently.
"""

import json
import importlib
import os
import queue
import secrets
import shutil
import socket
import tempfile
import threading
import time
import traceback

try:
    import lux
except Exception as exc:
    lux = None
    LUX_IMPORT_ERROR = exc
else:
    LUX_IMPORT_ERROR = None

try:
    import _keyshot_mcp_core as core
except ImportError:
    try:
        import keyshot_bridge as core
    except ImportError as exc:
        core = None
        CORE_IMPORT_ERROR = exc
    else:
        core = importlib.reload(core)
        CORE_IMPORT_ERROR = None
else:
    core = importlib.reload(core)
    CORE_IMPORT_ERROR = None


PROTOCOL_VERSION = 1
INSTALLER_DISCOVERY_PATH = None
MAX_REQUEST_BYTES = 1024 * 1024
MAX_QUEUE_SIZE = 16
NETWORK_WAIT_SECONDS = 1800
ALLOWED_REQUEST_KEYS = {"protocolVersion", "id", "token", "operation", "params"}
ALLOWED_PARAMS = {
    "live_status": set(),
    "live_inspect": set(),
    "live_snapshot": {"saveCopy", "outputPath"},
    "live_import_model": {"modelPath", "centerGeometry", "snapToGround", "adjustCameraLookAt", "adjustEnvironment"},
    "live_apply_material": {"objectName", "objectPath", "presetName", "materialName", "materialPath"},
    "live_set_camera": {"cameraName", "cameraPresetName", "standardView", "position", "lookAt", "up", "distance", "fieldOfView", "focalLength"},
    "live_set_environment": {"environmentName", "environmentPath", "brightness", "rotation"},
    "live_render": {"outputPath", "width", "height", "samples", "maxTimeSeconds", "format", "qualityPreset", "overwrite"},
    "live_save_scene": {"outputScenePath", "overwriteCurrent"},
    "live_stop": set(),
}
UNDO_REQUIRED_OPERATIONS = {
    "live_import_model",
    "live_apply_material",
    "live_set_camera",
    "live_set_environment",
}


class PendingRequest:
    def __init__(self, request):
        self.request = request
        self.event = threading.Event()
        self.response = None


class LiveBridge:
    def __init__(self, discovery_path=None):
        self.discovery_path = discovery_path or default_discovery_path()
        self.token = secrets.token_urlsafe(32)
        self.requests = queue.Queue(maxsize=MAX_QUEUE_SIZE)
        self.stop_requested = False
        self.listener = None
        self.listener_thread = None
        self.port = None

    def start(self):
        require_runtime()
        core.lux = lux
        is_headless = core.first_success(lambda: lux.isHeadless(), lambda: lux.is_headless(), default=False)
        if is_headless:
            raise RuntimeError("KeyShot MCP Live Companion must run inside the KeyShot GUI.")

        self.listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.listener.bind(("127.0.0.1", 0))
        self.listener.listen(4)
        self.listener.settimeout(0.5)
        self.port = self.listener.getsockname()[1]
        self.write_discovery()
        self.listener_thread = threading.Thread(target=self.accept_loop, name="KeyShotMCPLiveNetwork", daemon=True)
        self.listener_thread.start()

        print("KeyShot MCP Live Companion started on 127.0.0.1:%s" % self.port)
        try:
            self.main_loop()
        finally:
            self.close()

    def main_loop(self):
        while not self.stop_requested:
            try:
                pending = self.requests.get(timeout=0.03)
            except queue.Empty:
                pending = None

            if pending is not None:
                pending.response = self.execute(pending.request)
                pending.event.set()

            try:
                lux.sync()
            except Exception:
                pass
            time.sleep(0.01)

    def execute(self, request):
        request_id = request.get("id") if isinstance(request, dict) else None
        try:
            operation, params = validate_request(request, self.token)
            data, output_files, warnings, image = dispatch(operation, params)
            if operation == "live_stop":
                self.stop_requested = True
            response = {
                "id": request_id,
                "ok": True,
                "data": data,
                "outputFiles": output_files,
                "warnings": warnings,
                "error": None,
            }
            if image:
                response.update(image)
            return response
        except Exception as exc:
            return {
                "id": request_id,
                "ok": False,
                "data": None,
                "outputFiles": [],
                "warnings": [traceback.format_exc()],
                "error": str(exc),
            }

    def accept_loop(self):
        while not self.stop_requested:
            try:
                connection, _address = self.listener.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            with connection:
                try:
                    request = read_request(connection)
                    pending = PendingRequest(request)
                    self.requests.put(pending, timeout=1)
                    if not pending.event.wait(NETWORK_WAIT_SECONDS):
                        raise RuntimeError("KeyShot Live operation exceeded the bridge time limit.")
                    send_response(connection, pending.response)
                except Exception as exc:
                    send_response(connection, {
                        "id": None,
                        "ok": False,
                        "data": None,
                        "outputFiles": [],
                        "warnings": [],
                        "error": str(exc),
                    })

    def write_discovery(self):
        payload = {
            "protocolVersion": PROTOCOL_VERSION,
            "pid": os.getpid(),
            "port": self.port,
            "token": self.token,
            "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "keyshotVersion": core.first_success(lambda: lux.getKeyShotVersion(), lambda: lux.getVersion(), default=None),
        }
        parent = os.path.dirname(self.discovery_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        temporary = self.discovery_path + ".tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        try:
            os.chmod(temporary, 0o600)
        except Exception:
            pass
        os.replace(temporary, self.discovery_path)

    def close(self):
        self.stop_requested = True
        if self.listener is not None:
            try:
                self.listener.close()
            except Exception:
                pass
        remove_own_discovery(self.discovery_path, self.token)
        print("KeyShot MCP Live Companion stopped.")


def validate_request(request, token):
    if not isinstance(request, dict):
        raise RuntimeError("Live request must be a JSON object.")
    unknown = set(request.keys()) - ALLOWED_REQUEST_KEYS
    if unknown:
        raise RuntimeError("Unsupported Live request field(s): %s" % ", ".join(sorted(unknown)))
    if request.get("protocolVersion") != PROTOCOL_VERSION:
        raise RuntimeError("KeyShot Live protocol version mismatch.")
    if not secrets.compare_digest(str(request.get("token") or ""), token):
        raise RuntimeError("KeyShot Live session token is invalid.")
    operation = request.get("operation")
    if operation not in ALLOWED_PARAMS:
        raise RuntimeError("Unsupported KeyShot Live operation: %s" % operation)
    params = request.get("params") or {}
    if not isinstance(params, dict):
        raise RuntimeError("Live request params must be a JSON object.")
    unknown_params = set(params.keys()) - ALLOWED_PARAMS[operation]
    if unknown_params:
        raise RuntimeError("Unsupported parameter(s) for %s: %s" % (operation, ", ".join(sorted(unknown_params))))
    return operation, params


def dispatch(operation, params):
    warnings = []
    output_files = []
    image = None
    if operation in UNDO_REQUIRED_OPERATIONS:
        ensure_undo_enabled()
    if operation == "live_status":
        data = live_status()
    elif operation == "live_inspect":
        data = live_inspect()
    elif operation == "live_snapshot":
        data, image = live_snapshot(params, output_files)
    elif operation == "live_import_model":
        data = live_import_model(params)
    elif operation == "live_apply_material":
        data = live_apply_material(params, warnings)
    elif operation == "live_set_camera":
        data = live_set_camera(params, output_files, warnings)
    elif operation == "live_set_environment":
        data = core.set_environment(params, output_files, warnings, persist=False)
    elif operation == "live_render":
        output_path = params.get("outputPath")
        if not output_path:
            raise RuntimeError("outputPath is required")
        if os.path.exists(output_path) and not params.get("overwrite", False):
            raise RuntimeError("Output already exists and overwrite is false: %s" % output_path)
        data = core.render(params, output_files, warnings)
    elif operation == "live_save_scene":
        data = live_save_scene(params, output_files)
    elif operation == "live_stop":
        data = {"stopping": True}
    else:
        raise RuntimeError("Unsupported KeyShot Live operation: %s" % operation)
    return data, output_files, warnings, image


def ensure_undo_enabled():
    enabled = core.first_success(lambda: lux.isUndoEnabled(), default=None)
    if enabled is not True:
        core.first_success(lambda: lux.setUndoEnabled(True), default=None)
        enabled = core.first_success(lambda: lux.isUndoEnabled(), default=None)
    if enabled is not True:
        raise RuntimeError(
            "KeyShot Undo is unavailable in this script context. Live editing was blocked to protect the current scene."
        )


def live_status():
    info = core.serialize_value(core.first_success(lambda: lux.getSceneInfo(), default={}))
    return {
        "connected": True,
        "protocolVersion": PROTOCOL_VERSION,
        "version": core.first_success(lambda: lux.getKeyShotVersion(), lambda: lux.getVersion(), default=None),
        "isHeadless": core.first_success(lambda: lux.isHeadless(), lambda: lux.is_headless(), default=False),
        "scene": info,
        "sceneChanged": core.first_success(lambda: lux.isSceneChanged(), default=None),
        "undoEnabled": core.first_success(lambda: lux.isUndoEnabled(), default=None),
    }


def live_inspect():
    data = core.inspect_scene()
    data.update({
        "selection": [core.describe_object(item) for item in selected_objects()],
        "scene": core.serialize_value(core.first_success(lambda: lux.getSceneInfo(), default={})),
        "sceneChanged": core.first_success(lambda: lux.isSceneChanged(), default=None),
        "undoEnabled": core.first_success(lambda: lux.isUndoEnabled(), default=None),
        "activeEnvironment": core.serialize_value(core.active_environment()),
    })
    return data


def live_snapshot(params, output_files):
    screenshot_path = core.call_variants("capture realtime screenshot", lambda: lux.screenshot())
    if not screenshot_path:
        raise RuntimeError("KeyShot did not return a screenshot path.")
    screenshot_path = os.path.abspath(str(screenshot_path))
    if not os.path.exists(screenshot_path):
        raise RuntimeError("KeyShot screenshot file was not found: %s" % screenshot_path)
    save_copy = bool(params.get("saveCopy", False))
    if save_copy:
        output_path = params.get("outputPath")
        if not output_path:
            raise RuntimeError("outputPath is required when saveCopy is true")
        core.ensure_parent(output_path)
        shutil.copy2(screenshot_path, output_path)
        output_files.append(output_path)
        image_path = output_path
        delete_after_read = False
    else:
        image_path = screenshot_path
        delete_after_read = True
    return {
        "snapshot": image_path,
        "savedCopy": save_copy,
        "sceneChanged": core.first_success(lambda: lux.isSceneChanged(), default=None),
    }, {
        "imagePath": image_path,
        "imageMimeType": mime_type(image_path),
        "deleteImageAfterRead": delete_after_read,
    }


def live_import_model(params):
    model_path = params.get("modelPath")
    if not model_path or not os.path.exists(model_path):
        raise RuntimeError("Model file not found: %s" % model_path)
    option_names = {
        "centerGeometry": "center_geometry",
        "snapToGround": "snap_to_ground",
        "adjustCameraLookAt": "adjust_camera_look_at",
        "adjustEnvironment": "adjust_environment",
    }
    requested = {option_names[key]: params[key] for key in option_names if params.get(key) is not None}
    if requested:
        getter = getattr(lux, "getImportOptions", None)
        if not callable(getter):
            raise RuntimeError("Advanced import options are unsupported because KeyShot lux.getImportOptions is not available.")
        options = core.call_variants(
            "read import options",
            lambda: getter(ext=os.path.splitext(model_path)[1], getDefaults=True),
            lambda: getter(os.path.splitext(model_path)[1], True),
            lambda: getter(),
        )
        if not isinstance(options, dict):
            raise RuntimeError("KeyShot did not return a usable import options dictionary.")
        options.update(requested)
        core.call_variants(
            "import model with options",
            lambda: lux.importFile(model_path, opts=options),
            lambda: lux.importFile(model_path, False, True, options),
        )
    else:
        core.call_variants("import model", lambda: lux.importFile(model_path), lambda: lux.importFile(str(model_path)))
    return {"importedModel": model_path, "importOptions": requested, "saved": False}


def live_apply_material(params, warnings):
    if params.get("objectName") or params.get("objectPath"):
        targets = [core.find_object(params.get("objectName"), params.get("objectPath"))]
        if targets[0] is None:
            raise RuntimeError("Object not found. Provide a valid objectName or objectPath.")
    else:
        targets = selected_objects()
        if not targets:
            raise RuntimeError("No object is selected in KeyShot. Select an object or provide objectName/objectPath.")
    material = core.resolve_material(params.get("materialName"), params.get("materialPath"), warnings)
    applied = []
    for target in targets:
        core.call_variants(
            "set selected object material",
            lambda target=target: target.setMaterial(material),
            lambda target=target: lux.setObjectMaterial(target, material),
            lambda target=target: lux.setObjectMaterial(target, params.get("materialName") or params.get("materialPath")),
        )
        applied.append(core.describe_object(target))
    return {"objects": applied, "material": core.serialize_value(material), "presetName": params.get("presetName"), "saved": False}


def live_set_camera(params, output_files, warnings):
    request = dict(params)
    if not request.get("cameraName"):
        camera = core.first_camera_object(lambda: lux.getCamera())
        camera_name = core.first_success(lambda: camera.getName(), default=None) if camera is not None else None
        if camera_name:
            request["cameraName"] = str(camera_name)
        elif request.get("standardView"):
            view_name = str(request["standardView"]).lower()
            constant_name = {
                "front": "VIEW_FRONT", "back": "VIEW_BACK", "left": "VIEW_LEFT", "right": "VIEW_RIGHT",
                "top": "VIEW_TOP", "bottom": "VIEW_BOTTOM", "isometric": "VIEW_ISOMETRIC",
            }.get(view_name)
            if not constant_name or not hasattr(lux, constant_name):
                raise RuntimeError("Unsupported standard camera view: %s" % view_name)
            core.call_variants("set active standard view", lambda: lux.setStandardView(getattr(lux, constant_name)))
            result = set_active_camera_values(request)
            result["standardView"] = view_name
            result["saved"] = False
            return result
        else:
            return set_active_camera_values(request)

    if request.get("standardView"):
        result = core.set_standard_camera(request, output_files, warnings, persist=False)
    else:
        result = core.set_camera(request, output_files, warnings, persist=False)
    result["saved"] = False
    return result


def set_active_camera_values(params):
    position = params.get("position")
    look_at = params.get("lookAt")
    up = params.get("up") or [0, 1, 0]
    if position is not None:
        core.call_variants("set active camera look-at", lambda: lux.setCameraLookAt(pt=tuple(look_at)), lambda: lux.setCameraLookAt(0, tuple(look_at)))
        core.call_variants("set active camera position", lambda: lux.setCameraPosition(pos=tuple(position)), lambda: lux.setCameraPosition(tuple(position)))
        core.call_variants("set active camera up", lambda: lux.setCameraUp(up=tuple(up)), lambda: lux.setCameraUp(tuple(up)))
    if params.get("distance") is not None:
        core.call_variants("set active camera distance", lambda: lux.setCameraDistance(params["distance"]))
    if params.get("fieldOfView") is not None:
        core.call_variants("set active camera field of view", lambda: lux.setCameraFieldOfView(params["fieldOfView"]))
    if params.get("focalLength") is not None:
        core.call_variants("set active camera focal length", lambda: lux.setCameraFocalLength(params["focalLength"]))
    core.call_variants("save active camera", lambda: lux.saveCamera())
    return {
        "cameraName": None,
        "activeCamera": True,
        "position": position,
        "lookAt": look_at,
        "up": up,
        "distance": params.get("distance"),
        "fieldOfView": params.get("fieldOfView"),
        "focalLength": params.get("focalLength"),
        "saved": False,
    }


def live_save_scene(params, output_files):
    if params.get("overwriteCurrent"):
        core.call_variants("save current scene", lambda: lux.saveFile(), lambda: lux.saveScene())
        return {"savedCurrentScene": True}
    output_path = params.get("outputScenePath")
    if not output_path:
        raise RuntimeError("outputScenePath is required unless overwriteCurrent is true")
    core.save_to(output_path)
    output_files.append(output_path)
    return {"savedScene": output_path, "savedCurrentScene": False}


def selected_objects():
    root = core.first_success(lambda: lux.getSceneTree(), default=None)
    if root is None:
        return []
    selected = core.first_success(lambda: root.getSelected(), default=[])
    return list(selected or [])


def read_request(connection):
    connection.settimeout(10)
    chunks = bytearray()
    while True:
        chunk = connection.recv(8192)
        if not chunk:
            break
        chunks.extend(chunk)
        if len(chunks) > MAX_REQUEST_BYTES:
            raise RuntimeError("KeyShot Live request exceeded the 1 MB safety limit.")
        if b"\n" in chunk:
            break
    line = bytes(chunks).split(b"\n", 1)[0]
    if not line:
        raise RuntimeError("KeyShot Live request was empty.")
    return json.loads(line.decode("utf-8"))


def send_response(connection, response):
    try:
        connection.sendall((json.dumps(response, ensure_ascii=False, default=str) + "\n").encode("utf-8"))
    except Exception:
        pass


def default_discovery_path():
    override = os.environ.get("KEYSHOT_LIVE_DISCOVERY_FILE")
    if override:
        return os.path.abspath(override)
    if INSTALLER_DISCOVERY_PATH:
        return os.path.abspath(INSTALLER_DISCOVERY_PATH)
    try:
        support_dir = os.path.dirname(os.path.abspath(core.__file__))
        config_path = os.path.join(support_dir, "_keyshot_mcp_live_config.json")
        with open(config_path, "r", encoding="utf-8") as handle:
            configured = json.load(handle).get("discoveryPath")
        if configured:
            return os.path.abspath(configured)
    except Exception:
        pass
    return os.path.join(os.path.expanduser("~"), ".keyshot-mcp", "live-session.json")


def remove_own_discovery(path, token):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            current = json.load(handle)
        if secrets.compare_digest(str(current.get("token") or ""), token):
            os.remove(path)
    except Exception:
        pass


def mime_type(path):
    extension = os.path.splitext(path)[1].lower()
    return "image/jpeg" if extension in (".jpg", ".jpeg") else "image/png"


def require_runtime():
    if lux is None:
        raise RuntimeError("Could not import KeyShot lux module: %s" % LUX_IMPORT_ERROR)
    if core is None:
        raise RuntimeError("Could not import KeyShot MCP support module: %s" % CORE_IMPORT_ERROR)


def write_startup_log(message):
    """Record early GUI startup failures without writing the session token."""
    try:
        path = os.path.join(os.path.dirname(default_discovery_path()), "live-startup.log")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as handle:
            handle.write("[%s] %s\n" % (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), message))
    except Exception:
        pass


def main():
    LiveBridge().start()


if __name__ == "__main__" or (lux is not None and not os.environ.get("KEYSHOT_MCP_LIVE_NO_AUTOSTART")):
    try:
        main()
    except Exception:
        write_startup_log(traceback.format_exc())
        raise
