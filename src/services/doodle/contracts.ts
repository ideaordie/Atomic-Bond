export const DOODLE_ACTIONS = {
  read: "read_doodles",
  replay: "doodle_replay",
  submit: "submit_doodle",
  publish: "publish_doodle",
  vote: "appreciate_doodle",
  report: "report_doodle",
  queue: "doodle_admin_queue",
  review: "doodle_admin_replay",
  moderate: "moderate_doodle",
  threshold: "doodle_admin_settings",
  restrict: "restrict_doodle_author",
  restrictAtom: "doodle_admin_restrict_atom",
  pause: "doodle_admin_pause",
  history: "doodle_admin_history",
} as const;
export function doodleRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid request");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some((k) => !["action", "args"].includes(k)) ||
    typeof v.action !== "string" ||
    !Object.hasOwn(DOODLE_ACTIONS, v.action) ||
    !Array.isArray(v.args) ||
    v.args.length > 3
  )
    throw new Error("Invalid request");
  return {
    operation: DOODLE_ACTIONS[v.action as keyof typeof DOODLE_ACTIONS],
    args: v.args,
  };
}
