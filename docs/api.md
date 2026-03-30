# API

## Factory

```ts
const doc = ByeText.create({
  canvas,
  text: 'Hello world',
  width: 320,
  height: 180,
  font: { family: 'system-ui', size: 16 }
})
```

## High-level methods

- `setText(text)`
- `setWidth(width)`
- `setHeight(height)`
- `layout()`
- `render()`

## Query methods

- `getLineCount()`
- `getTotalHeight()`
- `getLine(index)`
- `charToPosition(index)`
- `positionToChar(x, y)`
- `getRunAt(index)`

## Edit methods

- `insert(charIndex, text)`
- `delete(charStart, charEnd)`
- `setStyle(style, range)`
- `layoutRange(charStart, charEnd)`
- `invalidateMeasurements()`

## Plugins

Install plugins with `doc.use(plugin)` and retrieve exposed plugin facades with `doc.getPlugin(name)`.
