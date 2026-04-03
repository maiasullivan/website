// main.js — mok application logic
import { createEditor, preprocessSliders, sliderRegistry } from './editor.js'

// ── STATE ─────────────────────────────────────────────────────────────────────
let panes = [], paneCount = 0, logVis = false
let hydraInstance = null
let strudelPrebake = '', hydraPrebake = ''
let currentPbTarget = 'strudel'

const STARTERS = {
  strudel: '// strudel — ctrl+enter to play\n',
  hydra:   'osc(10, 0.1, 1.5)\n  .color(0.05, 0.1, 0.7)\n  .rotate([0.2,0.4], 0.01)\n  .out()',
  tidal:   '-- needs local SuperCollider + flok-eval\nd1 $ s "bd ~ sd ~"',
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  addPane('strudel')
  buildPal()
  setupEventListeners()
})

// ── HYDRA ─────────────────────────────────────────────────────────────────────
function getHydra() {
  if (hydraInstance) return hydraInstance
  const canvas = document.getElementById('hc')
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.display = 'block'
  hydraInstance = new Hydra({ canvas, detectAudio: false, makeGlobal: true })
  return hydraInstance
}

window.addEventListener('resize', () => {
  const c = document.getElementById('hc')
  c.width = window.innerWidth; c.height = window.innerHeight
  if (hydraInstance) { try { hydraInstance.setResolution(window.innerWidth, window.innerHeight) } catch(e) {} }
})

function syncHydra() {
  document.getElementById('hc').style.display =
    panes.some(p => p.target === 'hydra') ? 'block' : 'none'
}

// ── PANE MANAGEMENT ───────────────────────────────────────────────────────────
function addPane(target = 'strudel') {
  if (panes.length >= 3) return
  const id = ++paneCount

  // Header tab
  const ph = document.createElement('div')
  ph.className = 'ph'; ph.id = `ph-${id}`

  const tBtn = document.createElement('button')
  tBtn.className = 'target-btn'
  tBtn.innerHTML = `<span class="tlbl">${target === 'tidal' ? 'TidalCycles' : target}</span><span class="caret">▾</span>`
  tBtn.onclick = e => { e.stopPropagation(); toggleDD(id) }

  const dd = document.createElement('div')
  dd.className = 'target-dd'; dd.id = `dd-${id}`
  document.body.appendChild(dd)

  ;['strudel','hydra','tidal'].forEach(t => {
    const o = document.createElement('div')
    o.className = 'topt' + (t === target ? ' active' : '')
    o.textContent = t === 'tidal' ? 'TidalCycles' : t
    o.dataset.t = t
    o.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation() })
    o.addEventListener('click',     e => { e.preventDefault(); e.stopPropagation(); setPaneTarget(id, t) })
    dd.appendChild(o)
  })

  const closeBtn = document.createElement('button')
  closeBtn.className = 'ph-close'; closeBtn.textContent = '✕'
  closeBtn.onclick = () => removePane(id)

  ph.appendChild(tBtn); ph.appendChild(closeBtn)
  document.getElementById('pane-headers').appendChild(ph)

  // Editor pane — CodeMirror replaces textarea
  const paneEl = document.createElement('div')
  paneEl.className = 'pane' + (target === 'hydra' ? ' is-hydra' : '')
  paneEl.id = `pane-${id}`

  const editorWrap = document.createElement('div')
  editorWrap.className = 'cm-wrap'
  paneEl.appendChild(editorWrap)

  // Hidden strudel engine
  const se = document.createElement('div')
  se.className = 'se'; se.id = `se-${id}`
  paneEl.appendChild(se)

  document.getElementById('panes').appendChild(paneEl)

  // Create CodeMirror editor
  const cmEditor = createEditor(
    editorWrap,
    STARTERS[target] || '',
    {
      onChange: () => {} // future: live collab sync
    },
    () => {
      // Slider dragged — re-eval this pane
      evalPane(id)
    }
  )

  // Bind Ctrl+Enter and Ctrl+. inside CM
  cmEditor.dom.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); evalPane(id) }
    if ((e.ctrlKey || e.metaKey) && e.key === '.')     { e.preventDefault(); silenceAll() }
  })

  const pane = { id, target, ph, paneEl, cmEditor, strudelEl: null, strudelReady: false }
  panes.push(pane)

  if (target === 'strudel') initStrudel(pane)
  syncHydra()
  return pane
}

function removePane(id) {
  if (panes.length <= 1) return
  const idx = panes.findIndex(p => p.id === id)
  if (idx < 0) return
  const p = panes[idx]
  stopStrudel(p)
  p.ph.remove()
  p.paneEl.remove()
  document.getElementById(`dd-${id}`)?.remove()
  panes.splice(idx, 1)
  syncHydra()
}

function setPaneTarget(id, target) {
  const p = panes.find(p => p.id === id)
  if (!p) return; closeAllDD()
  if (p.target === target) return
  if (p.target === 'strudel') stopStrudel(p)
  p.target = target
  // Replace editor content with starter
  p.cmEditor.dispatch({ changes: { from: 0, to: p.cmEditor.state.doc.length, insert: STARTERS[target] || '' } })
  p.ph.querySelector('.tlbl').textContent = target === 'tidal' ? 'TidalCycles' : target
  p.ph.querySelectorAll('.topt').forEach(o => o.classList.toggle('active', o.dataset.t === target))
  p.paneEl.classList.toggle('is-hydra', target === 'hydra')
  if (target === 'strudel' && !p.strudelReady) initStrudel(p)
  syncHydra()
}

// ── STRUDEL ───────────────────────────────────────────────────────────────────
function initStrudel(pane) {
  customElements.whenDefined('strudel-editor').then(() => {
    if (pane.strudelEl) return
    const wrap = document.getElementById(`se-${pane.id}`)
    const el = document.createElement('strudel-editor')
    el.setAttribute('code', '-- ready')
    wrap.appendChild(el)
    pane.strudelEl = el; pane.strudelReady = true
  }).catch(e => log('strudel: ' + e.message, 'err'))
}

function stopStrudel(pane) {
  if (!pane.strudelEl) return
  try {
    const inst = pane.strudelEl.editor || pane.strudelEl
    if (typeof inst.stop === 'function') inst.stop()
    else if (typeof pane.strudelEl.stop === 'function') pane.strudelEl.stop()
  } catch(e) {}
}

// ── EVAL ──────────────────────────────────────────────────────────────────────
async function evalPane(id) {
  const p = panes.find(p => p.id === id)
  if (!p) return
  doFlash()

  // Get code from CodeMirror
  const raw = p.cmEditor.state.doc.toString()
  if (!raw.trim()) return

  // Preprocess slider() calls — substitutes values for eval
  const processed = preprocessSliders(raw, p.target)

  if (p.target === 'strudel') {
    const code = strudelPrebake ? strudelPrebake + '\n' + processed : processed
    await evalStrudel(p, code)
  } else if (p.target === 'hydra') {
    const stripped = processed.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim()
    const code = hydraPrebake ? hydraPrebake + '\n' + stripped : stripped
    evalHydra(code)
  } else {
    log('TidalCycles: needs local SuperCollider + flok-eval relay', 'info')
  }
}

async function evalStrudel(p, code) {
  if (!p.strudelReady || !p.strudelEl) { log('strudel loading…', 'err'); return }
  try {
    p.strudelEl.setAttribute('code', code)
    if (p.strudelEl.updateComplete) await p.strudelEl.updateComplete.catch(() => {})
    let evaluated = false
    const inst = p.strudelEl.editor || p.strudelEl
    if (typeof inst.evaluate === 'function')            { await inst.evaluate(code); evaluated = true }
    else if (typeof p.strudelEl.evaluate === 'function') { await p.strudelEl.evaluate(code); evaluated = true }
    if (!evaluated) log('strudel: evaluate() not found', 'info')
    setStatus('playing'); log('eval → strudel', 'ok')
  } catch(e) { setStatus('error'); log('strudel: ' + e.message, 'err') }
}

function evalHydra(code) {
  if (!code) return
  try {
    getHydra()
    new Function(code)()
    setStatus('playing'); log('eval → hydra', 'ok')
  } catch(e) { setStatus('error'); log('hydra: ' + e.message, 'err') }
}

function silenceAll() {
  panes.forEach(p => { if (p.target === 'strudel') stopStrudel(p) })
  setStatus('idle'); log('silence', 'err')
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function toggleDD(id) {
  const dd = document.getElementById(`dd-${id}`)
  const was = dd.classList.contains('open')
  closeAllDD()
  if (!was) {
    const btn = document.querySelector(`#ph-${id} .target-btn`)
    const rect = btn.getBoundingClientRect()
    dd.style.top  = rect.bottom + 'px'
    dd.style.left = rect.left + 'px'
    dd.classList.add('open')
  }
}

function closeAllDD() {
  document.querySelectorAll('.target-dd').forEach(d => d.classList.remove('open'))
}

function setStatus(s) {
  document.getElementById('sdot').className = 'sdot' + (s !== 'idle' ? ' ' + s : '')
}

function doFlash() {
  const f = document.getElementById('flash')
  f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120)
}

function log(msg, type = '') {
  const wrap = document.getElementById('log')
  const line = document.createElement('div')
  line.className = 'll' + (type ? ' ' + type : '')
  line.textContent = `[${new Date().toTimeString().slice(0,8)}] ${msg}`
  wrap.prepend(line)
  if (type === 'err' || type === 'info') showLog()
}

function showLog() { logVis = true; document.getElementById('log').classList.add('vis') }
function toggleLog() { logVis = !logVis; document.getElementById('log').classList.toggle('vis', logVis) }

function getActive() {
  return panes.find(p => p.paneEl.contains(document.activeElement)) || panes[0]
}

// ── PREBAKE ───────────────────────────────────────────────────────────────────
function openPbModal() {
  const target = getActive()?.target || 'strudel'
  switchPbTab(target === 'hydra' ? 'hydra' : 'strudel', null)
  document.getElementById('pb-code').value = currentPbTarget === 'hydra' ? hydraPrebake : strudelPrebake
  updatePbPill()
  document.getElementById('pb-overlay').classList.add('open')
}

function closePbModal() { document.getElementById('pb-overlay').classList.remove('open') }

function switchPbTab(target, el) {
  currentPbTarget = target
  document.querySelectorAll('.pb-tab').forEach(t => t.classList.remove('active'))
  ;(el || document.querySelector(`.pb-tab[data-pb="${target}"]`))?.classList.add('active')
  document.getElementById('pb-code').value = target === 'hydra' ? hydraPrebake : strudelPrebake
  document.getElementById('pb-url-status').textContent = ''
}

function updatePbPill() {
  const active = currentPbTarget === 'hydra' ? hydraPrebake : strudelPrebake
  document.getElementById('pb-active-pill').classList.toggle('visible', active.length > 0)
}

// ── PALETTE ───────────────────────────────────────────────────────────────────
const CMDS = [
  { sec:'Panes',    ico:'+', label:'Add Strudel pane',     action:() => { addPane('strudel');  closePal() } },
  { sec:'Panes',    ico:'+', label:'Add Hydra pane',       action:() => { addPane('hydra');    closePal() } },
  { sec:'Panes',    ico:'+', label:'Add TidalCycles pane', action:() => { addPane('tidal');    closePal() } },
  { sec:'Panes',    ico:'✕', label:'Remove active pane',   action:() => { const p=getActive(); if(p) removePane(p.id); closePal() } },
  { sec:'Prebake',  ico:'⚙', label:'Load prebake…',        action:() => { openPbModal(); closePal() } },
  { sec:'Session',  ico:'⎘', label:'Copy session link',    action:() => { navigator.clipboard.writeText(location.href).then(()=>log('link copied','ok')); closePal() } },
  { sec:'Playback', ico:'■', label:'Silence all', sc:'Ctrl+.', action:() => { silenceAll(); closePal() } },
]

let filtered = [...CMDS], focusIdx = 0

function buildPal(q = '') {
  filtered = CMDS.filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()))
  focusIdx = 0
  const body = document.getElementById('pal-body')
  body.innerHTML = ''
  let lastSec = ''
  filtered.forEach((cmd, i) => {
    if (cmd.sec !== lastSec) {
      const s = document.createElement('div'); s.className = 'ps'; s.textContent = cmd.sec
      body.appendChild(s); lastSec = cmd.sec
    }
    const item = document.createElement('div')
    item.className = 'pi' + (i === 0 ? ' focused' : '')
    item.innerHTML = `<span class="ico">${cmd.ico}</span>${cmd.label}<span class="sc">${cmd.sc||''}</span>`
    item.onclick = cmd.action
    body.appendChild(item)
  })
}

function openPal() {
  document.getElementById('pal-bg').classList.add('open')
  document.getElementById('pal-in').value = ''
  buildPal()
  setTimeout(() => document.getElementById('pal-in').focus(), 40)
}

function closePal() { document.getElementById('pal-bg').classList.remove('open') }

// ── EVENT LISTENERS ───────────────────────────────────────────────────────────
function setupEventListeners() {
  // Global keyboard
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
      e.preventDefault()
      document.getElementById('pal-bg').classList.contains('open') ? closePal() : openPal()
    }
    if (e.key === 'Escape') { closePal(); closePbModal() }
  })

  document.addEventListener('click', e => {
    if (!e.target.closest('.target-dd') && !e.target.closest('.target-btn'))
      setTimeout(closeAllDD, 50)
  })

  // Chrome buttons
  document.getElementById('cmd-btn').onclick    = openPal
  document.getElementById('log-btn').onclick    = toggleLog
  document.getElementById('silence-btn').onclick = silenceAll

  // Palette input
  const palIn = document.getElementById('pal-in')
  palIn.addEventListener('input', e => buildPal(e.target.value))
  palIn.addEventListener('keydown', e => {
    const items = document.querySelectorAll('.pi')
    if (e.key === 'ArrowDown') focusIdx = Math.min(focusIdx+1, filtered.length-1)
    else if (e.key === 'ArrowUp') focusIdx = Math.max(focusIdx-1, 0)
    else if (e.key === 'Enter') { filtered[focusIdx]?.action(); return }
    else return
    items.forEach((el,i) => el.classList.toggle('focused', i === focusIdx))
  })

  document.getElementById('pal-bg').addEventListener('click', e => {
    if (e.target === document.getElementById('pal-bg')) closePal()
  })

  // Prebake modal
  document.getElementById('pb-close').onclick    = closePbModal
  document.getElementById('pb-apply-btn').onclick = () => {
    const code = document.getElementById('pb-code').value.trim()
    if (currentPbTarget === 'hydra') hydraPrebake = code
    else strudelPrebake = code
    updatePbPill()
    log(`prebake applied (${currentPbTarget})`, 'ok')
    closePbModal()
  }
  document.getElementById('pb-clear-btn').onclick = () => {
    document.getElementById('pb-code').value = ''
    document.getElementById('pb-url-status').textContent = ''
    if (currentPbTarget === 'hydra') hydraPrebake = ''
    else strudelPrebake = ''
    updatePbPill()
    log(`prebake cleared (${currentPbTarget})`, 'info')
  }

  document.querySelectorAll('.pb-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPbTab(tab.dataset.pb, tab))
  })

  document.getElementById('pb-file').addEventListener('change', function() {
    const file = this.files[0]; if (!file) return
    const status = document.getElementById('pb-url-status')
    const reader = new FileReader()
    reader.onload = e => {
      document.getElementById('pb-code').value = e.target.result
      status.textContent = `✓ ${file.name}`; status.className = 'pb-status ok'
    }
    reader.readAsText(file)
  })

  document.getElementById('pb-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('pb-overlay')) closePbModal()
  })
}
