# Copilot review instructions

Strength 5x5 is a **browser-only PWA** (Vite + React 18, `vite-plugin-pwa`). There is no
Node/SSR runtime target and there never will be — see AGENTS.md's "no backend" rule. Do not
flag missing guards for standard browser APIs (`window.matchMedia`, `localStorage`,
`navigator.vibrate`, etc.) as unsafe "in non-browser environments" — that environment does
not exist for this app. `src/test/setup.js` already mocks the browser APIs the test suite
needs, so they're present there too.

Before suggesting a defensive guard (optional chaining, existence check, fallback value),
check whether the input or environment it guards against is actually reachable from the
call site — grep for callers, check the relevant `normalize*` function in `src/utils.js`,
or check `src/constants.js` for the value's possible range. A suggestion whose own example
doesn't hold (e.g. treating `{}` or `[]` as falsy — both are always truthy in JS) should not
be raised.

See AGENTS.md for the rest of this repo's architecture and conventions.
