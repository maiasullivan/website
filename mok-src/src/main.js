// main.js — mok application logic
import { createEditor, preprocessSliders, sliderRegistry } from './editor.js'

// ── STATE ─────────────────────────────────────────────────────────────────────
let panes = [], paneCount = 0, logVis = false
let hydraInstance = null
let lastHydraCode = ''
let strudelPrebake = `//TODO: find a better way to do this
window.registerFunc = (name, func) => {
  //ensures it will work in mondo notation
  strudelScope[name] = func
  //ensures it will work in mini notation
  window[name] = func
}

window.DX = (env=8, fm = 2, harm = 2) => s("sine")
  .fm(fm).fmenv(env).fmh(harm).fmdecay(.2)

// tb303 style filter envelope control between 0 & 1 values for useful range
register('acidenv', (x, pat) => pat.lpf(100)
  .lpenv(x * 9).lps(.2).lpd(.12).lpq(2)
)

setGainCurve(x => Math.pow(x, 2))

window.soloedOrbits = []
window.soloOrbit = (...orbits) => {
  window.soloedOrbits = orbits
}
window.mutedOrbits = []
window.solo = (...orbits) => {
  window.soloedOrbits = orbits
}
window.mute = (...orbits) => {
  window.mutedOrbits = orbits
}
register('o', (orbit, pat) => {
  pat = pat.orbit(orbit)
  if (mutedOrbits.includes(orbit)) {
    return pat.hush()
  }
  if (!soloedOrbits.length || soloedOrbits.includes(orbit)) {
    return pat
  }
  return pat.hush()

})

//tracker style arrangement
window.track = function(...input) {
  const patterns = input.shift()
  let mods = Array.isArray(input.at(-1)) ? input.pop() : undefined
  if (input.length % 2 !== 0) {
    throw new Error('Arrange needs a length paramter for each pattern (length, pattern, length, pattern)');
  }
  let sects = [];
  let total = 0;
  for (let i = 0; i < input.length; i += 2) {
    let inp = [input.at(i)].flat()
    let cycles = inp.at(0);
    let start = inp.at(1) ?? 0

    total += cycles;

    let cpat = input.at(i + 1).innerBind((str, pat) => {

      const pats = []
      str.split(/-+/).forEach((val, index) => {
        if (val == false ){
        return
        }
        let newPat = patterns.at(index)
         mods?.forEach(([mod, callback]) => {
            if (val != mod) {
              return
            }
            newPat = callback(newPat)
         })

          pats.push(newPat)
      })
      return stack(...pats)
    });

    sects.push([cycles, cpat.ribbon(start, cycles).fast(cycles)]);
  }
  return stepcat(...sects).slow(total);
}

window.ar = function(...input) {

  if (input.length % 2 !== 0) {
    throw new Error('Arrange needs a length paramter for each pattern (length, pattern, length, pattern)');
  }
  let sects = [];
  let total = 0;
  for (let i = 0; i < input.length; i += 2) {
    let inp = [input.at(i)].flat()
    let cycles = inp.at(0);
    let start = inp.at(1) ?? 0
    total += cycles;

    let pattern = input.at(i + 1);
    sects.push([cycles, pattern.ribbon(start, cycles).fast(cycles)]);
  }
  return stepcat(...sects).slow(total);
}


window.p = stack

window.blockArrange = function (patArr, modifiers = []) {
  return stack(
    ...patArr.map(([pat, maskPat]) => {
      pat = [pat].flat()

      return maskPat.fmap(m => {
        return stack(...pat.map(p => {

          if (m == 0) {
            return
          }
          const ms = m.toString()
          let newPat = p

          if (ms.includes('R')) {
            newPat = newPat.restart(1)
          }
          if (ms.includes('B')) {
            newPat = newPat.rev().speed(-1)
          }
          modifiers.forEach(([mod, callback]) => {
            if (mod(ms)) {
              newPat = callback(newPat)
            }
          })
          return newPat
        }).filter(Boolean))
      }).innerJoin()
    }).flat()
  )
}

register('fill', function (pat) {
  return new Pattern(function (state) {
    const lookbothways = 1;
    const haps = pat.query(state.withSpan(span => new TimeSpan(span.begin.sub(lookbothways), span.end.add(lookbothways))));
    const onsets = haps.map(hap => hap.whole.begin)
      .sort((a, b) => a.compare(b))
      .filter((x, i, arr) => i == (arr.length - 1) || x.ne(arr[i + 1]));
    const newHaps = [];
    for (const hap of haps) {
      if (hap.part.begin.gte(state.span.end)) {
        continue;
      }
      const next = onsets.find(onset => onset.gte(hap.whole.end));
      if (next === undefined) {
        continue;
      }
      if (next.lte(state.span.begin)) {
        continue;
      }
      const whole = new TimeSpan(hap.whole.begin, next);
      const part = new TimeSpan(hap.part.begin.max(state.span.begin), next.min(state.span.end));
      newHaps.push(new Hap(whole, part, hap.value, hap.context, hap.stateful));
    }
    return newHaps;
  });
});

register('trancegate', (density, seed, length, x) => {
  density = reify(density).add(.5)
  return x.struct(rand.mul(density).round().seg(16).rib(seed, length)).fill().clip(.7)
})

register('tgate', (amt, cycle,length, pat) => {
  const cycleSubstitute = new Map([
    [0, 45],[1, 116],[2, 99],[3, 100],[4, 107],[5, 53],[6, 57],[7, 58],
    [8, 67],[9, 81],[10, 89],[11, 115],[12, 8],[13, 118],[14, 120],[15, 144],
    [16, 149],[17, 161],[18, 197],[19, 206],[20, 209],[21, 230],[22, 269],
    [23, 274],[24, 293],[24, 295],[25, 308],[31, 37],[32, 40],[33, 59],
    [34, 63],[35, 65],[36, 68],[37, 70],[37, 225],
  ])
  cycle = reify(cycle).withValue(v => { console.info(v); return cycleSubstitute.get(v) ?? v })
  amt = reify(amt)
  return pat.seg(16).degradeBy(amt.mul(-1).add(1)).rib(cycle,length).fill().clip(.7)
})

register('dly', (amt, x) =>{
  amt = reify(amt)
  return  x.delay(amt.mul(.8)).delayfeedback(amt.pow(2)).mask(amt.floor().inv())
})

register('colorparty', (p, pat) => {
 const colors = ['blue', 'yellow', 'violet', 'green', 'orange', 'cyan', 'magenta', 'white']
   return pat.color(colors.at(Math.floor(p * colors.length)))
})

register('grab', function (scale, pat) {
  scale = (Array.isArray(scale) ? scale.flat() : [scale]).flatMap((val) =>
    typeof val === 'number' ? val : noteToMidi(val) - 48
  );
  return pat.withHap((hap) => {
    const isObject = typeof hap.value === 'object';
    let note = isObject ? hap.value.n : hap.value;
    if (typeof note === 'string') note = noteToMidi(note);
    if (isObject) delete hap.value.n;
    const octave = (note / 12) >> 0;
    const transpose = octave * 12;
    const goal = note - transpose;
    note = scale.reduce((prev, curr) => Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev) + transpose;
    return hap.withValue(() => (isObject ? { ...hap.value, note } : note));
  });
});

setDefault('gain', 1)

register('mpan', (orbits, amount, pat) => {
  const index = Math.round(amount * (orbits.length - 1))
  const orbit = orbits[index]
  const pamt = (amount * orbits.length) % 1
  return pat.orbit(orbit).pan(pamt)
})

register('rlpf', (x, pat) => { return pat.lpf(pure(x).mul(12).pow(4)) })
register('rhpf', (x, pat) => { return pat.hpf(pure(x).mul(12).pow(4)) })

register('vstruct', (ipat,pat) => {
  return ipat.outerBind(vel => {
    return pat.keepif.out(Math.ceil(vel)).velocity(vel)
  })
},false)

register('voc', (key, x) => {
  let value;
  switch (key.toLowerCase()) {
    case 'c': value = 0; break; case 'c#': value = 0.2; break;
    case 'd': value = 0.25; break; case 'd#': value = 0.3; break;
    case 'e': value = 0.4; break; case 'f': value = 0.5; break;
    case 'f#': value = 0.6; break; case 'g': value = 0.7; break;
    case 'g#': value = 0.75; break; case 'a': value = 0.8; break;
    case 'a#': value = 0.9; break; case 'b': value = 1; break;
    default: value = 0;
  }
  return x.ccn(34).ccv(value).midi('tout');
});

register('fmtime', (start,length, pat) => {
  let modu = time.mod(length).add(start)
  return pat.fm(modu).fmh(modu)
})

window.irando = (ipat) => reify(ipat).fmap(_irand).outerJoin()
window.randm = (division) => irand(division).div(16)
window.pk = function (...args) {
  const control = args.length > 2 ? args.pop() : 0
  return pick(args, control)
}

register('acid', (pat) => {
  return pat.s('supersaw').detune(.5).unison(1).lpf(100)
    .lpsustain(0.2).lpd(.2).lpenv(2).lpq(12)
})

register('stxt', (text, pat) => {
  const RANGE = 'range', SELECTION = 'selection'
  const params = {
    lpf: { type: RANGE, val: [100, 3000] },
    room: { type: RANGE, val: [0, 1] },
    vib: { type: RANGE, val: [0, 16] },
    vibmod: { type: RANGE, val: [0, .3] },
    wt: { type: RANGE, val: [0, 1] },
    note: { type: RANGE, transform: x => Math.round(x), val: [-12, 8] },
    wtrate: { type: RANGE, val: [0, 3] },
    wtdepth: { type: RANGE, val: [0, 1] },
    delay: { type: RANGE, val: [0, 1] },
    delaytime: { type: RANGE, val: [0, .66] },
    delayfeedback: { type: RANGE, val: [0, .6] },
    decay: { type: RANGE, val: [.1, 1] },
    attack: { type: RANGE, val: [0, .1] },
    lpenv: { type: RANGE, val: [0, 8] },
    lpd: { type: RANGE, val: [0, 1] },
    lpa: { type: RANGE, val: [0, .5] },
    detune: { type: RANGE, val: [0, .8] },
    s: { type: SELECTION, val: ['sawtooth','supersaw','wt_digital','wt_digital_bad_day','wt_digital_basique','wt_digital_echoes','sine','triangle','pulse'] }
  };
  const encoder = new TextEncoder('utf-8');
  const byteArray = Array.from(encoder.encode(text));
  const byteSize = 255;
  let acc = 0;
  Object.keys(params).forEach((p, i) => {
    const { type, transform = (x) => x, val } = params[p];
    let byteVal = byteArray[i % byteArray.length];
    acc += byteVal; byteVal = [byteVal + acc] % byteSize;
    if (type === SELECTION) {
      pat = pat[p](transform(val[byteVal % val.length]))
    } else {
      const min = val.at(0), max = val.at(-1), pTotal = max - min;
      pat = pat[p](transform(((pTotal / byteSize) * byteVal) + min))
    }
  })
  return pat
})

register('sf', (cycles,x) => {
  const segments = 16;
  cycles = reify(cycles)
  return x.scrub(saw.seg(cycles.mul(segments)).slow(cycles))
})

register('swap', (find, rep, x) => {
  return x.withValue(v => v === find ? rep : v)
})

Pattern.prototype.over = function(...inp) {
  return this.set.out(stack(...inp))
}

Pattern.prototype.overin = function(...inp) {
  return this.set.in(stack(...inp))
}

window.sb = register('sb', (p, cb, pat) => pat.sometimesBy(p, cb))

window.SCALE = 'e:minor'
window.setScale = (sc) => { window.SCALE = sc }

register('sc', (pat) => pat.scale(window.SCALE))

register('ifit', (cycles, pat) => pat.inside(cycles,fit))

window.trancearp = function(notes,rst = 0 ,rytm = 0) {
  const rstPresets = ["F","B","F B F B","F@3 B@3 F F","F@12 F@2 F@2"]
  const rytmPresets = ["x!16","<1 1@2 1 1@2 1 1@2 1 1@2 1 1 1 1>*16","<1 1 _ 1 1 1 1 1>*16"]
  if (typeof rst == 'number') rst = pickmod(rstPresets, rst)
  if (typeof rytm == 'number') rytm = pickmod(rytmPresets, rytm)
  const pats = {
    F: "<0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15>*16",
    B: "<15 14 13 12 11 10 9 8 7 6 5 4 3 2 1 0>*16"
  }
  return pickmod(notes, pickRestart(pats, rst)).struct(rytm)
}

window._comb = register('comb', (inp, pat) => {
  let [delay, feedback = .6] = [inp].flat()
  delay = reify(delay).div(100)
  return pat.FX(K(() => {
    const d = S(delay), q = S(feedback);
    return audioin()
      .add(x => x.delay(d).mul(q))
      .add(x => x.delay(2 * d).mul(q * q))
      .add(x => x.delay(3 * d).mul(q * q * q))
      .add(x => x.delay(4 * d).mul(q * q * q * q))
      .out();
  })).fxr(1)
});

registerFunc('noisehat', (seg = 16, modu = tri, speed = 4, min = .05, max = .12) => s('white').seg(seg).dec(modu.fast(4).range(min,max)))
registerFunc('zap', (amount = .8, speed = .1,note = 'c3', ) => s("sine").penv(reify(amount).mul(120)).note(note).pdec(speed).dec(speed).o(8))
window.roller = (wt = 0) => s("wt_digi")
  .wt(wt).wtenv(0).wtdecay(.2).warp(0).warpmode(7).warpenv(.5).warpdec(.1)
  .dec(.2).lpq(0).dly(.8).room(.7).roomsize(4).diode("1").acidenv(.44)

window.spinor = (alive = 1, dead = 0) => s("wt_digital").lfo({ dr: 0.05 })
  .wtrate(alive).unison(3).detune(alive).compressor(-20)
  .fm(dead).fmh(4)
  .FX(lpf(200).lpe(4).lpa(0.5).lps(1).K(() => {
    audioin().sub(x => x.bpf(sine(0.13).mul(S(rand)))).out()
  }).asym("0.3".mul(dead)), diode(0.7), gain(0.3)).fxr(1)

window.roller2 = (acidenv = .5) => {
  return s("bstab:1:.6,supersaw:1:.6,white:0:.3").detune(rand)
    .begin("<0 .02>/4").room(.5).acidenv(acidenv).lpq(0).postgain(1.2).diode([2.5,.6])
  .sustain(.45).dec(.2)
}

window.up = register('up', (vals, pat) =>
  pat.withValue((v) => (vNew) => {
    const vUp = Object.fromEntries(Object.entries(vNew).filter(([_, val]) => val !== undefined));
    return { ...v, ...vUp };
  }).appBoth(vals), false);

register('oneshot', (grid, pat) => {
  const t = getTime();
  const qt = Math.ceil(t / grid) * grid;
  return pat.filterWhen((t) => t >= qt && t < qt + 1);
});

register('filtval', (key, val, func, pat) => {
  return pat.when(pat.fmap((v) => v[key] === val), func);
});

register('glide', (time, pat) => {
  let curr = [], prev = [], lastT = null;
  const query = (state) => {
    const trig = !!state.controls._cps;
    const haps = pat.query(state);
    const output = [];
    haps.map((hap) => {
      const { value, whole } = hap;
      const t = Number(whole.begin);
      if (trig && (lastT == null || lastT !== t)) { prev = curr; curr = []; lastT = t; }
      const glideHaps = time.query(state.setSpan(hap.wholeOrPart()));
      glideHaps.map((glideHap) => {
        const part = hap.part.intersection(glideHap.part);
        if (!part) return;
        const context = hap.combineContext(glideHap);
        const glideT = glideHap.value;
        const freqF = getFrequencyFromValue(value, value.s === 'sbd' ? 29 : 36);
        const freqI = prev.length
          ? prev.reduce((closest, v) => {
              const phase = glideT > 0 ? Math.min((t - v.t) / glideT, 1) : 1;
              const cand = v.freqI + phase * (v.freqF - v.freqI);
              if (closest == null) return cand;
              return Math.abs(cand - freqF) < Math.abs(closest - freqF) ? cand : closest;
            }, null)
          : freqF;
        if (trig) curr.push({ freqI, freqF, t });
        let newVal = value;
        if (Math.abs(freqF - freqI) > 1e-6) {
          newVal = { ...value, panchor: 0, psustain: 0, pattack: 0, pdecay: glideT, penv: -12 * Math.log2(freqF / freqI) };
        }
        output.push(new Hap(whole, part, newVal, context));
      });
    });
    return output;
  };
  return new Pattern(query);
}, false);

register('glitch', (amt, pat) => {
  return pat.fmap((v) => {
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (['orbit', 'duckorbit'].includes(k)) continue;
      const rand = 2 * Math.random() - 1;
      const val = v[k];
      const isNumber = typeof val === 'number';
      if (k === 'note' && !isNumber) {
        v[k] = Math.round(Math.max(noteToMidi(val) * (1 + amt * 0.5 * Math.random()), 24));
      } else if (isNumber) { v[k] *= 1 + rand * amt; }
    }
    return v;
  });
});

register('sq', (pat) => pat.fmap((v) => v * v));

register('strum', (amt, pat) => {
  return pat.collect().withHaps((haps) => {
    return flatten(haps.map((hap) => {
      const collected = hap.value;
      if (collected.length <= 1) return group;
      const l = collected.length - 1;
      return collected.map((hap, idx) => {
        const offset = amt * (2 * idx / l - 1);
        return hap.withSpan((span) => span.withTime((t) => t + offset));
      });
    }));
  });
});

register('humanize', (amt, pat) => {
  const amtC = clamp(amt, 0, 1);
  return pat.withHaps((haps) => {
    return haps.map((hap) => {
      const offset = 0.1 * amtC * (2 * Math.random() - 1);
      return hap.withSpan((span) => span.withTime(t => t + offset));
    })
  }).withValue((v) => ({ ...v, velocity: (v.velocity ?? 1) + 0.5 * amtC * (2 * Math.random() - 1) }));
});

const __semitoneBend = Math.pow(2, 1 / 12);
Pattern.prototype.bend = function (bends = 0, speedUp = 0.05, speedDown = 0.05) {
  window.__legatoBusID ??= 0;
  const uuid = window.__legatoBusID++;
  bends = reify(bends); speedUp = reify(speedUp); speedDown = reify(speedDown);
  bends.fmap((b) => (su) => (sd) => ({
    s: 'one', attack: su, release: sd, bus: uuid, sustain: 1, dry: 0,
    gain: __semitoneBend ** b - 1, dc: 0,
  })).appBoth(speedUp).appBoth(speedDown).p('bend_' + uuid);
  return this.bmod({ c: 's', b: uuid, dr: 1 });
}
`, hydraPrebake = ''
let currentPbTarget = 'strudel'

const STARTERS = {
  strudel: '// strudel — opt+enter to play\n',
  hydra:   'osc(10, 0.1, 1.5)\n  .color(0.05, 0.1, 0.7)\n  .rotate([0.2,0.4], 0.01)\n  .out()',
  tidal:   '-- needs local SuperCollider + flok-eval\nd1 $ s "bd ~ sd ~"',
}

const DOCS = {
  strudel: 'https://strudel.cc/functions/intro/',
  hydra:   'https://hydra.ojack.xyz/functions/',
  tidal:   'https://tidalcycles.org/docs/',
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  addPane('strudel')
  buildPal()
  setupEventListeners()
  updatePbPill()
})

// ── HYDRA ─────────────────────────────────────────────────────────────────────
function getHydra() {
  if (hydraInstance) return hydraInstance
  const canvas = document.getElementById('hc')
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.display = 'block'
  hydraInstance = new Hydra({ canvas, detectAudio: false, makeGlobal: false })

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault()
    hydraInstance = null
    log('hydra: WebGL context lost — re-eval to restore', 'err')
  })
  canvas.addEventListener('webglcontextrestored', () => {
    log('hydra: WebGL context restored, restarting…', 'info')
    hydraInstance = null
    if (lastHydraCode) setTimeout(() => evalHydra(lastHydraCode), 100)
  })

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

  // Bind Option+Enter (eval) and Ctrl+. (silence) inside CM
  cmEditor.dom.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'Enter') { e.preventDefault(); evalPane(id) }
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

    // Strudel's connectedCallback can briefly disrupt Hydra's render loop.
    // Re-eval the last hydra code after init settles to restore visuals.
    if (lastHydraCode) setTimeout(() => {
      if (lastHydraCode && panes.some(p => p.target === 'hydra')) evalHydra(lastHydraCode)
    }, 300)
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
  } catch(e) {
    setStatus('error')
    // Strudel errors are often nested — unwrap to the most useful message
    const msg = e?.cause?.message || e?.message || String(e)
    log('strudel: ' + msg, 'err')
  }
}

// new Function() wraps code starting at line 3 in Chrome, line 2 in Firefox
const FN_LINE_OFFSET = /Chrome/.test(navigator.userAgent) ? 2 : 1

function fmtErr(e, lineOffset = 0) {
  const base = e.message || String(e)
  // Pull line/col from stack trace (works in Chrome & Firefox)
  const m = (e.stack || '').match(/<anonymous>:(\d+):(\d+)/)
  if (m) {
    const line = Math.max(1, parseInt(m[1]) - lineOffset)
    return `${base} — line ${line}`
  }
  return base
}

function evalHydra(code) {
  if (!code) return
  try {
    lastHydraCode = code
    const h = getHydra()
    const synth = h.synth || window
    const keys = Object.keys(synth).filter(k => typeof synth[k] !== 'undefined')
    const vals = keys.map(k => synth[k])
    const fn = new Function(...keys, code)
    fn(...vals)
    setStatus('playing'); log('eval → hydra', 'ok')
  } catch(e) {
    setStatus('error')
    log('hydra: ' + fmtErr(e, FN_LINE_OFFSET), 'err')
  }
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
  { sec:'Docs', ico:'?', label:'Strudel docs',      action:() => { window.open(DOCS.strudel, '_blank'); closePal() } },
  { sec:'Docs', ico:'?', label:'Hydra docs',        action:() => { window.open(DOCS.hydra,   '_blank'); closePal() } },
  { sec:'Docs', ico:'?', label:'TidalCycles docs',  action:() => { window.open(DOCS.tidal,   '_blank'); closePal() } },
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
