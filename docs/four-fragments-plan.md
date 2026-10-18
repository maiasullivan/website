# Four fragments redesign — plan

Status: parked. A working home + career prototype is saved in a git stash:

```
git stash list                      # look for "four-fragments redesign (home + career)"
git stash apply stash@{N}           # restore it (keeps the stash too)
```

Restoring brings back `index.html`, `career.html`, `assets/site.css`, `assets/site.js` and a README section.
Preview with `npx serve .` (clean URLs, so `/career` resolves).

## Goal

The home page becomes four fragments, each leading somewhere:

| fragment  | links to                  | notes |
|-----------|---------------------------|-------|
| career    | `/career` → résumé        | uses the photo (path TBD) |
| writing   | `/writing`                | list page, empty state for now |
| projects  | `/projects`               | write-ups with GitHub repo links |
| holisticc | artist page (URL TBD)     | if it's on another domain, there's no morph (View Transitions are same-origin only) |

Keep the current palette (`--cream #f5f0e8`, `--ink #1a1612`, `--blue rgb(13,25,180)`, `--muted`, `--line`)
and type (Instrument Serif for display, Space Mono for body).

## Interaction

- **Hover / focus:** the fragment lifts, tilts towards the pointer (perspective rotateX/Y), and gets a
  hard ink shadow. The other three dim (opacity 0.4, partly greyscale), and a one-line caption fades in.
  Captions are always shown on touch devices.
- **Click:** cross-document View Transitions (`@view-transition { navigation: auto }`). The clicked
  fragment morphs into the destination page's hero, and the other three morph into a small nav dock.
- **How the morph works:** every page has all four section names exactly once, as a fragment (home),
  the hero (its own page) or a dock item (other pages). Each one gets `view-transition-name: frag-<section>`,
  and its `.frag-title` gets `title-<section>`. The career photo is named separately.
- **Hydra background:** a fixed `<canvas id="bg">` (multiply blend, ~0.2 opacity, half resolution)
  with one patch per section, each drawn as blue ink on white. On navigation, sessionStorage remembers
  the previous section and hydra's clock. The new page starts on the previous patch and `blend`s
  into its own over ~1.8s.
- **prefers-reduced-motion:** no view transitions, tilt or patch blending, and hydra's speed is 0.
  Hovering still dims the others and shows the caption.

## Gotchas found while prototyping

- The cream background must sit on `html` only. A `body` background paints over a `z-index:-1` canvas.
- The intro fade must animate `translate` with `backwards` fill. `transform` with `forwards` fill
  permanently overrides the hover transform and dim opacity.
- Titles need matching `line-height` on the fragment, hero and dock, or the morph ghosts. They also
  need `width: fit-content` so the snapshots stay tight to the text.
- Give the dock its own `view-transition-name` and fade it in late, so items land in it rather than
  flying into an empty frame.
- Headless `--virtual-time-budget` screenshots don't advance CSS animations while hydra is
  running. Test over CDP with real time instead.

## Open inputs

- Real photo path (the prototype uses `/images/dnn.jpg` with a tinted fallback)
- Résumé file (the prototype links `/resume.pdf`)
- Artist page URL for holisticc
- Where the mok link lives (the prototype puts it in the home header)

## Remaining phases

1. Review the feel of home + career (the prototype covers this).
2. `/writing`: list page with an empty state, hero + dock.
3. `/projects`: write-up cards with GitHub repo links, hero + dock.
4. holisticc: decide whether it's an on-site page (gets the morph) or an external link.
5. Tune the hydra patches per section once all pages exist.
