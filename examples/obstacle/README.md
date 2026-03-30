# Obstacle Example

Run the local demo server so the browser can load the actual ByeText TypeScript source:

```bash
node examples/obstacle/server.mjs
```

Then open:

[http://127.0.0.1:4173/examples/obstacle/index.html](http://127.0.0.1:4173/examples/obstacle/index.html)

The demo uses the real core and flow plugin modules from:

- [api.ts](/D:/ByeText/packages/core/src/api.ts)
- [break.ts](/D:/ByeText/packages/core/src/break.ts)
- [render.ts](/D:/ByeText/packages/core/src/render.ts)
- [index.ts](/D:/ByeText/packages/plugins/flow/src/index.ts)

What to try:

- move the mouse across the article and watch the text split around the ball on both sides
- drag the curved corner handle to resize the article
- press `1` through `6` to switch between the different article stress cases
- keep moving while resizing to test continuous layout and rendering updates

If you want to tweak behavior, edit [demo.js](/D:/ByeText/examples/obstacle/demo.js).
