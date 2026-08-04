// Standard plate colours, muted for the dark UI. Scoped to the bar-load diagram and the
// idle-row plate strip -- the rest of the app stays mono-accent. Fixed hex, not theme
// tokens, so the diagram reads the same in light and dark mode.
export const PLATE_STYLES = {
  25:   { height: 118, bg: '#a8403e', text: '#e9e9ed' },
  20:   { height: 112, bg: '#37628f', text: '#e9e9ed' },
  15:   { height: 100, bg: '#b8971f', text: '#1a1608' },
  10:   { height: 88,  bg: '#3a7a53', text: '#e9e9ed' },
  5:    { height: 70,  bg: '#2a2c38', text: '#e9e9ed' },
  2.5:  { height: 56,  bg: '#5f636f', text: '#e9e9ed' },
  1.25: { height: 44,  bg: '#7c8090', text: '#e9e9ed' },
};
