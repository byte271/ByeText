import { ByeText } from '/packages/core/src/api.ts'
import { createFlowPlugin } from '/packages/plugins/flow/src/index.ts'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const dpr = () => Math.max(1, window.devicePixelRatio || 1)
const baseW = () => Math.min(window.innerWidth - 40, 860)
const baseH = () => Math.min(window.innerHeight - 40, 720)
const compose = ({ title, standfirst, body }) => [title, standfirst, ...body].join('\n\n')
const tests = [
  {
    name: 'Latin flow',
    title: 'An Article About Making Space',
    standfirst: 'A page feels most alive when it can yield without surrendering its voice.',
    body: [
      'When a dark sphere drifts across a field of language, it should not bully every sentence toward a single margin. A better page negotiates. It keeps the line intact where it can, then opens a measured pocket of air, letting one phrase settle to the left and another remain visible on the right.',
      'That small act of courtesy changes the feeling of the whole composition. The article stops behaving like a rigid column and starts acting like a surface with awareness. Form is no longer a fixed promise made in advance; it becomes a decision made in the presence of motion.',
      'This is the kind of restraint I want from a text runtime. It should move cleanly, preserve rhythm, and make room with precision rather than spectacle. Even while the obstacle glides through the center, the prose should keep its balance, as if it had expected interruption all along.'
    ]
  },
  {
    name: 'Dense latin',
    title: 'Stress Testing a Dense Column',
    standfirst: 'Compact prose is useful because tiny propagation mistakes become visible almost immediately.',
    body: [
      'A narrow measure, a faster cursor, and a little more verbal density create a better stress case than a theatrical layout ever could. If the system hesitates, the rhythm of the column gives it away.',
      'What matters here is not decoration but discipline. Each small edit should disturb the current line, maybe a neighbor or two, and then stop. A runtime that keeps scanning long after the page has stabilized is wasting attention.',
      'The ideal result feels unremarkable in the best sense. The text remains composed, the moving obstacle feels local, and the page reads as though its flexibility had been planned from the first sentence.'
    ]
  },
  {
    name: 'Unicode breaks',
    title: 'Unicode Break Behavior',
    standfirst: 'CJK text, soft break opportunities, and non-breaking pairs should remain calm under pressure.',
    body: [
      '漢字かな交じりの文章に English phrases and soft\u200Bbreak hints can share a single surface without turning the line breaker into a blunt instrument. The page should still feel deliberate when scripts change cadence.',
      'A non-breaking pair such as Hello\u00A0world should keep its promise, while a zero-width break should open a graceful exit only where it was invited. Those are small rules, but together they decide whether the layout feels literate.',
      'When the ball crosses the center of this article, the split should still look authored rather than accidental: one fragment left, another right, and enough white space in the middle to make the interruption readable.'
    ]
  },
  {
    name: 'Emoji clusters',
    title: 'Emoji as Intentional Units',
    standfirst: 'Joined emoji should behave like complete ideas, not as pieces that happen to sit beside one another.',
    body: [
      'A family glyph like 👨‍👩‍👧‍👦, a launch like 👨🏽‍🚀, or a flag like 🇺🇸 should survive layout pressure as a single decision. Once those clusters start splintering, the interface stops feeling careful.',
      'The point is not novelty. Emoji simply expose the same rule as typography: if a unit carries meaning as one piece, the engine should preserve it as one piece while it measures, wraps, and redraws.',
      'That makes this article useful as a test. The motion is playful, but the requirement is serious: joined symbols should remain whole even while the page is actively making room around the moving obstacle.'
    ]
  },
  {
    name: 'Mixed bidi',
    title: 'Mixed Direction Text',
    standfirst: 'A resilient line should stay legible when English, العربية, and שלום occupy the same thought.',
    body: [
      'Direction changes are easy to fake until punctuation and numbers begin to mingle. An honest test mixes scripts inside the same sentence and asks the renderer to stay composed while meaning moves in more than one direction.',
      'In a line such as English meets العربية beside שלום and then returns to English 2026, the transition should feel measured rather than improvised. Readers notice uncertainty immediately, even when they cannot name it.',
      'The moving ball makes that challenge visible. If the flow still looks balanced with bidirectional text on both sides of the gap, the runtime is starting to earn trust.'
    ]
  },
  {
    name: 'Narrow relayout',
    title: 'Relayout Under Pressure',
    standfirst: 'A tighter column exaggerates instability, which makes it a useful place to verify the engine stays composed.',
    width: 560,
    body: [
      'Shrinking the available width is a blunt but valuable test because it forces the engine to reveal how much work it truly needs to do. A disciplined incremental layout should adapt quickly rather than panic and start over.',
      'That is why this mode begins with a narrower article. It turns tiny changes into visible reflow pressure, then asks the page to keep moving without losing rhythm, spacing, or clarity.',
      'If the runtime can remain smooth here, it is much more likely to behave well in ordinary layouts where the constraints are looser and the user is less forgiving of sudden jumps.'
    ]
  }
]

export function initDemo() {
  const $ = (id) => document.getElementById(id)
  const paper = $('paper')
  const hud = $('hud')
  const content = $('content')
  const textCanvas = $('text-layer')
  const overlayCanvas = $('overlay-layer')
  const handle = $('resize-handle')
  const overlay = overlayCanvas.getContext('2d')
  const rect = () => content.getBoundingClientRect()
  const flow = createFlowPlugin()
  let active = 0
  const article = () => compose(tests[active])
  const doc = ByeText.create({
    canvas: textCanvas,
    text: article(),
    width: 640,
    height: 540,
    font: {
      family: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
      size: 19
    },
    plugins: [flow]
  })

  const state = {
    minW: 420,
    minH: 420,
    maxW: 1180,
    maxH: 860,
    w: baseW(),
    h: baseH(),
    tw: baseW(),
    th: baseH(),
    cw: 0,
    ch: 0,
    ratio: 0,
    inside: false,
    drag: null
  }

  const ball = { r: 28, p: 18, x: 0, y: 0, tx: 0, ty: 0, hx: 0, hy: 0 }
  let obstacle = null

  const applyArticleStyles = () => {
    const { title, standfirst } = tests[active]
    doc.setStyle({ size: 40, weight: 700, lineHeight: 46, color: '#111111' }, { start: 0, end: title.length })
    doc.setStyle(
      { size: 18, style: 'italic', lineHeight: 30, color: '#5d5d57' },
      { start: title.length + 2, end: title.length + 2 + standfirst.length }
    )
  }

  const updateHud = () => {
    hud.innerHTML = `
      <strong>Test ${active + 1}: ${tests[active].name}</strong>
      <span>Press 1-6 to switch scenarios.</span>
      <div class="hud-keys">${tests.map((test, index) => `<kbd class="${index === active ? 'active' : ''}">${index + 1}</kbd>`).join('')}</div>
    `
  }

  const applyTest = (index) => {
    const next = tests[index]
    if (!next) {
      return
    }

    active = index
    doc.setText(article())
    applyArticleStyles()
    state.tw = clamp(next.width ?? baseW(), state.minW, Math.min(state.maxW, window.innerWidth - 20))
    state.th = clamp(next.height ?? baseH(), state.minH, Math.min(state.maxH, window.innerHeight - 20))
    updateHud()
    doc.render()
  }

  const setPaper = () => {
    paper.style.width = `${state.w}px`
    paper.style.height = `${state.h}px`
  }

  const syncOverlay = () => {
    const { width, height } = rect()
    overlayCanvas.width = Math.max(1, Math.round(width * state.ratio))
    overlayCanvas.height = Math.max(1, Math.round(height * state.ratio))
    overlayCanvas.style.width = `${width}px`
    overlayCanvas.style.height = `${height}px`
    overlay.setTransform(state.ratio, 0, 0, state.ratio, 0, 0)
  }

  const syncSize = (force = false) => {
    const { width, height } = rect()
    const nextW = Math.max(240, Math.round(width))
    const nextH = Math.max(260, Math.round(height))
    const nextRatio = dpr()
    if (!force && nextW === state.cw && nextH === state.ch && nextRatio === state.ratio) {
      return false
    }

    Object.assign(state, { cw: nextW, ch: nextH, ratio: nextRatio })
    doc.setWidth(nextW)
    doc.setHeight(nextH)
    syncOverlay()

    ball.hx = nextW * 0.72
    ball.hy = nextH * 0.44
    for (const key of ['x', 'tx', 'hx']) {
      ball[key] = clamp(ball[key] || ball.hx, ball.r, nextW - ball.r)
    }
    for (const key of ['y', 'ty', 'hy']) {
      ball[key] = clamp(ball[key] || ball.hy, ball.r, nextH - ball.r)
    }

    return true
  }

  const syncObstacle = () => {
    if (obstacle === null) {
      obstacle = flow.addObstacle({ type: 'circle', cx: ball.x, cy: ball.y, r: ball.r }, { padding: ball.p, side: 'both' })
    } else {
      flow.updateObstacle(obstacle, { cx: ball.x, cy: ball.y, r: ball.r })
    }
  }

  const drawBall = () => {
    const halo = overlay.createRadialGradient(ball.x, ball.y, ball.r * 0.25, ball.x, ball.y, ball.r * 2.4)
    halo.addColorStop(0, 'rgba(17, 17, 17, 0.18)')
    halo.addColorStop(1, 'rgba(17, 17, 17, 0)')
    overlay.clearRect(0, 0, state.cw, state.ch)
    overlay.fillStyle = halo
    overlay.beginPath()
    overlay.arc(ball.x, ball.y, ball.r * 2.3, 0, Math.PI * 2)
    overlay.fill()
    overlay.fillStyle = '#111111'
    overlay.beginPath()
    overlay.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
    overlay.fill()
    overlay.strokeStyle = 'rgba(255, 255, 255, 0.88)'
    overlay.lineWidth = 2
    overlay.beginPath()
    overlay.arc(ball.x, ball.y, ball.r - 1, 0, Math.PI * 2)
    overlay.stroke()
  }

  const point = ({ clientX, clientY }) => {
    const { left, top, width, height } = rect()
    return {
      x: clamp(clientX - left, ball.r, width - ball.r),
      y: clamp(clientY - top, ball.r, height - ball.r)
    }
  }

  paper.addEventListener('pointermove', (event) => {
    if (state.drag) {
      state.tw = clamp(state.drag.w + event.clientX - state.drag.x, state.minW, Math.min(state.maxW, window.innerWidth - 20))
      state.th = clamp(state.drag.h + event.clientY - state.drag.y, state.minH, Math.min(state.maxH, window.innerHeight - 20))
      return
    }

    state.inside = true
    const next = point(event)
    ball.tx = next.x
    ball.ty = next.y
  })

  paper.addEventListener('pointerleave', () => {
    if (!state.drag) {
      state.inside = false
    }
  })

  handle.addEventListener('pointerdown', (event) => {
    state.drag = { x: event.clientX, y: event.clientY, w: state.tw, h: state.th }
    handle.setPointerCapture(event.pointerId)
    event.preventDefault()
  })

  for (const type of ['pointerup', 'pointercancel']) {
    handle.addEventListener(type, (event) => {
      state.drag = null
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId)
      }
    })
  }

  window.addEventListener('resize', () => {
    state.tw = clamp(state.tw, state.minW, Math.min(state.maxW, window.innerWidth - 20))
    state.th = clamp(state.th, state.minH, Math.min(state.maxH, window.innerHeight - 20))
  })

  window.addEventListener('keydown', (event) => {
    const index = Number(event.key) - 1
    if (index >= 0 && index < tests.length) {
      applyTest(index)
    }
  })

  applyArticleStyles()
  updateHud()
  setPaper()
  syncSize(true)
  syncObstacle()

  const frame = (now) => {
    let changed = syncSize(state.ratio !== dpr())

    const dw = state.tw - state.w
    const dh = state.th - state.h
    if (Math.abs(dw) > 0.2 || Math.abs(dh) > 0.2) {
      state.w = Math.abs(dw) < 0.8 ? state.tw : state.w + dw * 0.22
      state.h = Math.abs(dh) < 0.8 ? state.th : state.h + dh * 0.22
      changed = true
    }

    if (!state.inside && !state.drag) {
      ball.tx = ball.hx
      ball.ty = ball.hy
    }

    const ease = 0.18
    const nx = ball.x + (ball.tx - ball.x) * ease
    const ny = ball.y + (ball.ty - ball.y) * ease
    if (Math.abs(nx - ball.x) > 0.08 || Math.abs(ny - ball.y) > 0.08) {
      ball.x = nx
      ball.y = ny
      syncObstacle()
      changed = true
    }

    if (changed) {
      setPaper()
      doc.render()
    }

    drawBall()
    requestAnimationFrame(frame)
  }

  doc.render()
  drawBall()
  requestAnimationFrame(frame)
}
