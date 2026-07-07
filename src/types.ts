export type KeyShotOperation =
  | "status"
  | "inspect_scene"
  | "render"
  | "batch_render"
  | "import_model"
  | "apply_material"
  | "set_camera"
  | "set_environment"
  | "save_scene";

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
};
