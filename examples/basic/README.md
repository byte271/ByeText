# Basic Example

Create a single document, call `layout()`, then `render()`:

```ts
const doc = ByeText.create({
  canvas,
  text: 'Hello ByeText',
  width: 320,
  height: 180,
  font: { family: 'system-ui', size: 16 }
})

doc.render()
```
