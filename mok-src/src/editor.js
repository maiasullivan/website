// editor.js — CodeMirror 6 setup with inline slider widgets
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import {
  EditorView, WidgetType, Decoration,
  keymap, ViewPlugin, ViewUpdate
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { yCollab } from 'y-codemirror.next'

// ── Slider Widget ─────────────────────────────────────────────────────────────
// Renders an inline <input type="range"> at the position of slider() args

class SliderWidget extends WidgetType {
  constructor({ name, value, min, max, step, onChange }) {
    super()
    this.name = name
    this.value = value
    this.min = min
    this.max = max
    this.step = step
    this.onChange = onChange
  }

  eq(other) {
    return other.value === this.value &&
           other.min === this.min &&
           other.max === this.max
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-slider-wrap'

    const input = document.createElement('input')
    input.type = 'range'
    input.className = 'cm-slider'
    input.min = this.min
    input.max = this.max
    input.step = this.step
    input.value = this.value

    const val = document.createElement('span')
    val.className = 'cm-slider-val'
    val.textContent = formatVal(this.value)

    input.addEventListener('input', e => {
      const v = parseFloat(e.target.value)
      val.textContent = formatVal(v)
      this.onChange(this.name, v)
    })

    // Prevent CM from stealing click events
    input.addEventListener('mousedown', e => e.stopPropagation())
    input.addEventListener('touchstart', e => e.stopPropagation(), { passive: true })

    wrap.appendChild(input)
    wrap.appendChild(val)
    return wrap
  }

  ignoreEvent(e) {
    return e.type !== 'mousedown' && e.type !== 'touchstart'
  }
}

function formatVal(v) {
  if (Number.isInteger(v)) return String(v)
  return parseFloat(v.toPrecision(4)).toString()
}

// ── Slider State ──────────────────────────────────────────────────────────────
export const sliderRegistry = {}  // { name: { value, min, max, step } }

function smartRange(val) {
  if (val === 0) return { mn: -1, mx: 1, st: 0.001 }
  if (val > 0) {
    const order = Math.pow(10, Math.floor(Math.log10(Math.abs(val))))
    return { mn: 0, mx: val * 4, st: Math.max(order / 1000, 0.0001) }
  }
  const order = Math.pow(10, Math.floor(Math.log10(Math.abs(val))))
  return { mn: val * 4, mx: 0, st: Math.max(order / 1000, 0.0001) }
}

function parseSliderCall(argsStr) {
  // Returns { name, def, min, max, step } from the args string
  const args = []
  let current = '', inStr = false, strChar = ''
  for (const c of argsStr) {
    if (inStr) {
      if (c === strChar) inStr = false
      else current += c
    } else if (c === '"' || c === "'") {
      inStr = true; strChar = c
    } else if (c === ',') {
      args.push(coerce(current.trim())); current = ''
    } else {
      current += c
    }
  }
  if (current.trim()) args.push(coerce(current.trim()))

  let name, def, min, max, step
  if (!args.length) {
    name = null; def = 0.5
  } else if (typeof args[0] === 'string') {
    [name, def, min, max, step] = args
    if (def === undefined) def = 0.5
  } else {
    name = null
    ;[def, min, max, step] = args
    if (def === undefined) def = 0.5
  }
  return { name, def, min, max, step }
}

function coerce(s) {
  if (!s) return undefined
  const n = parseFloat(s)
  return isNaN(n) ? s : n
}

// ── Slider Decoration Extension ───────────────────────────────────────────────
// Scans the document for slider(...) calls and inserts widgets

export function sliderExtension(onSliderChange) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = this.buildDecos(view)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecos(update.view)
      }
    }

    buildDecos(view) {
      const decos = []
      let autoIdx = 0
      const doc = view.state.doc.toString()
      const re = /slider\(([^)]*)\)/g
      let m

      while ((m = re.exec(doc)) !== null) {
        const { name: parsedName, def, min, max, step } = parseSliderCall(m[1])
        const name = parsedName || ('s' + (++autoIdx))
        const smart = smartRange(def ?? 0.5)
        const rMin  = min  !== undefined ? min  : smart.mn
        const rMax  = max  !== undefined ? max  : smart.mx
        const rStep = step !== undefined ? step : smart.st

        // Register slider if new
        if (!sliderRegistry[name]) {
          sliderRegistry[name] = { value: def ?? 0.5, min: rMin, max: rMax, step: rStep }
        } else {
          sliderRegistry[name].min  = rMin
          sliderRegistry[name].max  = rMax
          sliderRegistry[name].step = rStep
        }

        // Place widget AFTER the closing paren of slider(...)
        const from = m.index
        const to   = m.index + m[0].length

        const widget = new SliderWidget({
          name,
          value: sliderRegistry[name].value,
          min: rMin, max: rMax, step: rStep,
          onChange: (n, v) => {
            sliderRegistry[n].value = v
            onSliderChange()
          }
        })

        // Replace the entire slider(...) call with the widget
        decos.push(
          Decoration.replace({
            widget,
            inclusive: false,
          }).range(from, to)
        )
      }

      return Decoration.set(decos, true)
    }
  }, { decorations: v => v.decorations })
}

// ── Preprocessor ──────────────────────────────────────────────────────────────
// Called before eval — substitutes slider() with current values
export function preprocessSliders(code, target) {
  let autoIdx = 0
  return code.replace(/slider\(([^)]*)\)/g, (match, argsStr) => {
    const { name: parsedName, def } = parseSliderCall(argsStr.trim())
    const name = parsedName || ('s' + (++autoIdx))
    const val = sliderRegistry[name]?.value ?? (def ?? 0.5)
    return target === 'strudel' ? `steady(${val})` : String(val)
  })
}

// ── Theme ─────────────────────────────────────────────────────────────────────
export const mokTheme = EditorView.theme({
  '&': {
    height: '100%',
    background: 'transparent',
    fontSize: '0.88rem',
    fontFamily: "'Space Mono', monospace",
  },
  '.cm-scroller': {
    overflow: 'auto',
    lineHeight: '1.75',
    padding: '1.4rem 2rem 4rem',
    fontFamily: "'Space Mono', monospace",
  },
  '.cm-content': {
    caretColor: 'rgb(13, 25, 180)',
    color: '#f0ebe0',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'rgb(13, 25, 180)', borderLeftWidth: '2px' },
  '.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(13,25,180,0.25) !important' },
  // Slider widgets
  '.cm-slider-wrap': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    verticalAlign: 'middle',
    marginLeft: '0.25rem',
    background: 'rgba(18,16,14,0.82)',
    padding: '0.05rem 0.5rem 0.05rem 0.45rem',
    borderRadius: '3px',
  },
  '.cm-slider': {
    WebkitAppearance: 'none',
    appearance: 'none',
    width: '80px',
    height: '3px',
    background: 'rgba(255,255,255,0.18)',
    outline: 'none',
    cursor: 'pointer',
    verticalAlign: 'middle',
    borderRadius: '2px',
    flexShrink: '0',
  },
  '.cm-slider::-webkit-slider-thumb': {
    WebkitAppearance: 'none',
    width: '12px',
    height: '12px',
    background: '#fff',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  '.cm-slider-val': {
    fontSize: '0.68em',
    color: 'rgba(240,235,224,0.5)',
    fontFamily: "'Space Mono', monospace",
    minWidth: '2.6rem',
  },
  // Syntax highlighting
  '.cm-comment':   { color: '#5a5550', fontStyle: 'italic' },
  '.cm-string':    { color: '#a8c8a0' },
  '.cm-number':    { color: '#c0a070' },
  '.cm-keyword':   { color: 'rgb(13,25,180)' },
  '.cm-operator':  { color: '#8888cc' },
  '.cm-variableName': { color: '#f0ebe0' },
  '.cm-function':  { color: '#d0c080' },
}, { dark: true })

// ── Create Editor ─────────────────────────────────────────────────────────────
export function createEditor(parent, initialDoc, extraKeys, onSliderChange, ytext, awareness) {
  const extensions = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    javascript(),
    syntaxHighlighting(defaultHighlightStyle),
    sliderExtension(onSliderChange),
    mokTheme,
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged && extraKeys.onChange) {
        extraKeys.onChange(update.view.state.doc.toString())
      }
    }),
  ]

  if (ytext && awareness) {
    extensions.push(yCollab(ytext, awareness))
  }

  return new EditorView({
    state: EditorState.create({
      doc: ytext ? ytext.toString() || initialDoc : initialDoc,
      extensions,
    }),
    parent,
  })
}
