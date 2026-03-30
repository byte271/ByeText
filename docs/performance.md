# Performance

The current core follows the design document's performance posture:

- Measurements are cached by fully normalized style + text keys.
- Line fit uses prefix sums and binary search.
- Dirty ranges are merged rather than accumulated as lists.
- Relayout starts from the first overlapping dirty line and searches for a stable tail.
- Rendering clears and redraws only dirty regions.

The benchmark runner in `benchmarks/runner.ts` gives a starting point for tracking cold layout, width changes, and edit performance over time.
