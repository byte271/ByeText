# Migration

ByeText is a new runtime rather than a DOM wrapper. Migrating from DOM- or editor-centric text systems usually means:

1. Move text rendering into a canvas owned by your app.
2. Model text as runs with explicit styles instead of DOM nodes.
3. Ask ByeText for layout and hit-testing rather than relying on browser selection APIs.
4. Add optional plugins only when you need the capability.

For early integrations, start with the core package and a single document instance per surface.
