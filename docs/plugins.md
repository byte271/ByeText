# Plugins

ByeText plugins register through typed extension points:

- `onMeasure`
- `onBreak`
- `onLayout`
- `onObstacle`
- `onRender`
- `onAnimate`
- `onEdit`

Implemented packages in this repository:

- `flow`: obstacle-aware line constraints and reflow triggers.
- `motion`: animation state generation and scheduling helpers.
- `debug`: lightweight document inspection.
- `bench`: scenario timing helpers.
- `selection`: selection state facade.
- `bidi`, `grapheme`, `emoji`: roadmap scaffolds for future completeness work.
