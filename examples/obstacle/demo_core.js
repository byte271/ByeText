import { ByeText } from '/packages/core/src/api.ts'
import { createFlowPlugin } from '/packages/plugins/flow/src/index.ts'

const title = 'An Article About Making Space'
const standfirst = 'A page feels most alive when it can yield without surrendering its voice.'
const text = [title, standfirst, ...[
  'When a dark sphere drifts across a field of language, it should not bully every sentence toward a single margin. A better page negotiates. It keeps the line intact where it can, then opens a measured pocket of air, letting one phrase settle to the left and another remain visible on the right.',
  'That small act of courtesy changes the feeling of the whole composition. The article stops behaving like a rigid column and starts acting like a surface with awareness. Form is no longer a fixed promise made in advance; it becomes a decision made in the presence of motion.',
  'This is the kind of restraint I want from a text runtime. It should move cleanly, preserve rhythm, and make room with precision rather than spectacle. Even while the obstacle glides through the center, the prose should keep its balance, as if it had expected interruption all along.'
]].join('\n\n')

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const dpr = () => Math.max(1, window.devicePixelRatio || 1)

export function initDemo() {
  const $ = (id) => document.getElementById(id)
  const paper = $('paper')
  const content = $('content')
  const textCanvas = $('text-layer')
  const overlayCanvas = $('overlay-layer')
  const handle = $('resize-handle')
  const overlay = overlayCanvas.getContext('2d')
  const rect = () => content.getBoundingClientRect()
  const flow = createFlowPlugin()
  const doc = ByeText.create({
    canvas: textCanvas,
    text,
    width: 640,
    height: 540,
    font: {
      family: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
      size: 19
    },
    plugins: [flow]
  })

  doc.setStyle({ size: 40, weight: 700, lineHeight: 46, color: '#111111' }, { start: 0, end: title.length })
  doc.setStyle(
    { size: 18, style: 'italic', lineHeight: 30, color: '#5d5d57' },
    { start: title.length + 2, end: title.length + 2 + standfirst.length }
  )

  const state = {
    minW: 420,
    minH: 420,
    maxW: 1180,
    maxH: 860,
    w: Math.min(window.innerWidth - 40, 860),
    h: Math.min(window.innerHeight - 40, 720),
    tw: Math.min(window.innerWidth - 40, 860),
    th: Math.min(window.innerHeight - 40, 720),
    cw: 0,
    ch: 0,
    ratio: 0,
    inside: false,
    drag: null
  }

  const ball = { r: 28, p: 18, x: 0, y: 0, tx: 0, ty: 0, hx: 0, hy: 0 }
  let obstacle = null

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
