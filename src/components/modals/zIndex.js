// Centralises the modal/sheet stacking order -- preserves the app's existing z-index
// ladder exactly (Edit entry lowest, most alerts share the top layer over it).
// Tailwind needs the literal `z-[N]` string to appear in scanned source to generate
// the utility, so these stay as full class names rather than bare numbers that a
// consumer would have to interpolate into a class string at runtime.
export const Z_EDIT_ENTRY = 'z-[250]';
export const Z_RESTORE_PROMPT = 'z-[300]';
export const Z_CSV_IMPORT = 'z-[300]';
export const Z_RESUME_PROMPT = 'z-[350]';
export const Z_DELOAD_ALERT = 'z-[400]';
export const Z_WORKOUT_PICKER = 'z-[400]';
// Discard workout, completion summary, failure deload, help sheet, stale-backup
// warnings, and the Drive sync conflict prompt all share the top layer.
export const Z_TOP = 'z-[500]';
