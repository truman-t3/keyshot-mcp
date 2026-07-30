export type KeyShotOperation =
  | "status"
  | "inspect_scene"
  | "list_cameras"
  | "render"
  | "batch_render"
  | "render_all_cameras"
  | "product_render"
  | "import_model"
  | "apply_material"
  | "set_camera"
  | "set_standard_camera"
  | "set_environment"
  | "save_scene"
  | "live_status"
  | "live_inspect"
  | "live_snapshot"
  | "live_import_model"
  | "live_apply_material"
  | "live_set_camera"
  | "live_set_environment"
  | "live_render"
  | "live_save_scene"
  | "live_stop";

export type KeyShotRequest = {
  operation: KeyShotOperation;
  scenePath?: string;
  [key: string]: unknown;
};

export type KeyShotResult = {
  ok: boolean;
  data: unknown;
  outputFiles: string[];
  warnings: string[];
  keyshotStdoutTail: string;
  error: string | null;
  errorCode?: string | null;
  suggestions?: string[];
  imagePath?: string;
  imageMimeType?: string;
  deleteImageAfterRead?: boolean;
};
