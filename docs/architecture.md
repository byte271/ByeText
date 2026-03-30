# Architecture

ByeText is structured as a stateful text engine:

- `document.ts` owns runs, dirty ranges, caches, and active plugins.
- `measure.ts` wraps canvas measurement with a two-level cache and deterministic keys.
- `break.ts` tokenizes measured runs into segment widths and computes line boundaries with prefix sums and binary search.
- `layout.ts` performs full or incremental relayout and rebuilds lookup indices.
- `render.ts` redraws only dirty regions on a single 2D canvas.
- `plugin.ts` exposes structural extension points instead of method monkey-patching.

The core package stays dependency-free and tree-shakeable. Optional behavior lives in plugin packages.
