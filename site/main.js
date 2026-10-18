// site/main.js — the landing page: a hydra-only mok with an old-html document beside it.
//
// hydra on the left, the document on the right.
// behind each open section (each is a <details>) the patch drops to contrast 0.1 inside a
// soft-edged "bubble", easing back to the patch's own contrast outside it. the user's code
// is never touched: it renders to o0 as written, and a compositing pass (out to o3) does
// the bubbles using a mask canvas fed in as s0. so o3 and s0 are reserved by the page.
import { createEditor, preprocessSliders } from './editor.js'

const DEFAULT_CODE = `// edit this code, press ctrl+enter
osc(6,.1).modulate(noise(6), () => mouse.x/width * .4).diff(o0)
      .modulateScrollY(osc(2).modulate(osc().rotate(),.11))
    .scale(.7).color(0.95,0.9,1).contrast(.75)
      .out()`

const BUBBLE_CONTRAST = 0.1
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// ── HYDRA ─────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('hc')
const errLine = document.getElementById('err')
let hydra = null

function getHydra() {
  if (hydra) return hydra
  canvas.width = innerWidth
  canvas.height = innerHeight
  hydra = new Hydra({ canvas, detectAudio: false, makeGlobal: false })
  // linear filtering so the tiny mask upscales into a smooth gradient, not 8px steps
  hydra.synth.s0.init({ src: mask, dynamic: true }, { min: 'linear', mag: 'linear' })
  // the default patch is a fast feedback loop — calm it down for reduced motion
  if (reduceMotion) hydra.synth.speed = 0.2
  return hydra
}

addEventListener('resize', () => {
  canvas.width = innerWidth; canvas.height = innerHeight
  sizeMask()
  hydra?.setResolution(innerWidth, innerHeight)
})

// ── BUBBLES ───────────────────────────────────────────────────────────────────
// a small greyscale canvas: white where a bubble is, black elsewhere, with blurred
// edges. it's uploaded to hydra every frame as s0, and the gpu's linear filtering
// smooths the upscale, so it can stay tiny.
const MASK_SCALE = 1 / 8
const BUBBLE_PAD = 24    // px of breathing room around the text
const BUBBLE_SOFT = 90   // px of gradient from the bubble back to full contrast
const FADE_MS = 280      // time constant for a bubble swelling in / fading out

const mask = document.createElement('canvas')
const mctx = mask.getContext('2d')
const sheet = document.getElementById('sheet')
const bubbles = new Map() // <details> → { alpha, rect }

function sizeMask() {
  mask.width = Math.ceil(innerWidth * MASK_SCALE)
  mask.height = Math.ceil(innerHeight * MASK_SCALE)
}
sizeMask()

function drawMask(now) {
  const dt = now - (drawMask.last ?? now)
  drawMask.last = now
  const view = sheet.getBoundingClientRect() // text scrolled out of the sheet gets no bubble

  mctx.globalCompositeOperation = 'source-over'
  mctx.shadowColor = 'transparent'
  mctx.fillStyle = '#000'
  mctx.fillRect(0, 0, mask.width, mask.height)
  mctx.globalCompositeOperation = 'lighten' // overlapping bubbles merge instead of stacking

  for (const d of sections) {
    const b = bubbles.get(d) ?? { alpha: 0, rect: null }
    bubbles.set(d, b)
    if (d.open) b.rect = d.getBoundingClientRect() // live: follows scrolling and reflow
    const target = d.open ? 1 : 0
    b.alpha = reduceMotion ? target : b.alpha + (target - b.alpha) * (1 - Math.exp(-dt / FADE_MS))
    if (b.alpha < 0.005 || !b.rect) continue

    const top = Math.max(b.rect.top, view.top) - BUBBLE_PAD
    const bottom = Math.min(b.rect.bottom, view.bottom) + BUBBLE_PAD
    if (bottom <= top) continue
    const left = b.rect.left - BUBBLE_PAD
    const right = b.rect.right + BUBBLE_PAD

    // blurred rectangle via its shadow (ctx.filter isn't in Safari): draw the box
    // off-canvas and let only its soft shadow land in place
    const off = mask.width * 2
    mctx.shadowColor = `rgba(255,255,255,${b.alpha})`
    mctx.shadowBlur = BUBBLE_SOFT * MASK_SCALE
    mctx.shadowOffsetX = off
    mctx.fillStyle = '#fff'
    mctx.fillRect(left * MASK_SCALE - off, top * MASK_SCALE,
                  (right - left) * MASK_SCALE, (bottom - top) * MASK_SCALE)
  }
  requestAnimationFrame(drawMask)
}

// the patch's own contrast: its last numeric .contrast(n), or 1 if there isn't one
function baseContrast(code) {
  const m = [...code.matchAll(/\.contrast\(\s*(-?\d*\.?\d+)\s*\)/g)].at(-1)
  return m ? parseFloat(m[1]) : 1
}

// hydra's contrast is (c - 0.5) * amount + 0.5, so contrasts multiply: a second pass
// of BUBBLE_CONTRAST / base lands at exactly BUBBLE_CONTRAST inside the bubble.
// out = o0 · (1 − mask) + o0.contrast(k) · mask
function composite(synth, base) {
  const { src, o0, o3, s0, render } = synth
  const k = base ? BUBBLE_CONTRAST / base : 1
  src(o0).mult(src(s0).invert())
    .add(src(o0).contrast(k).mult(src(s0)))
    .out(o3)
  render(o3)
}

// ── EVAL ──────────────────────────────────────────────────────────────────────
// new Function() offsets line numbers: +2 in Chrome, +1 in Firefox (same as mok)
const FN_LINE_OFFSET = /Chrome/.test(navigator.userAgent) ? 2 : 1

function fmtErr(e) {
  const m = (e.stack || '').match(/<anonymous>:(\d+):(\d+)/)
  const line = m ? ` — line ${Math.max(1, parseInt(m[1]) - FN_LINE_OFFSET)}` : ''
  return (e.message || String(e)) + line
}

// only errors are shown — a quiet line under the code, gone on the next good run
function showError(msg) {
  errLine.textContent = msg
  errLine.hidden = !msg
}

function evalHydra() {
  const raw = editor.state.doc.toString()
  if (!raw.trim()) return
  try {
    const code = preprocessSliders(raw, 'hydra')
    const synth = getHydra().synth
    const keys = Object.keys(synth).filter(k => typeof synth[k] !== 'undefined')
    new Function(...keys, code)(...keys.map(k => synth[k]))
    composite(synth, baseContrast(code))
    showError('')
    flash()
  } catch (e) {
    showError(fmtErr(e)) // keep the last good patch on screen
  }
}

function hush() {
  hydra?.synth.hush()
}

function flash() {
  const f = document.getElementById('flash')
  f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120)
}

// ── EDITOR ────────────────────────────────────────────────────────────────────
const run = () => { evalHydra(); return true }
const editor = createEditor(
  document.getElementById('editor'),
  DEFAULT_CODE,
  () => evalHydra(), // slider moved
  [
    // Mod is cmd on mac, so ctrl is listed too — the page tells people "ctrl+enter"
    { key: 'Mod-Enter', run },
    { key: 'Ctrl-Enter', run },
    { key: 'Alt-Enter', run },  // mok's binding
    { key: 'Shift-Enter', run },
    { key: 'Mod-.', run: () => { hush(); return true } },
    { key: 'Ctrl-.', run: () => { hush(); return true } },
  ],
)

// ── SECTIONS ──────────────────────────────────────────────────────────────────
const sections = [...document.querySelectorAll('#nav details')]

// /#career etc. opens that section on arrival
document.getElementById(location.hash.slice(1))?.setAttribute('open', '')

// ── BOOT ──────────────────────────────────────────────────────────────────────
requestAnimationFrame(drawMask)
evalHydra()
