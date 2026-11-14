# MINDSPACE — a decision, composed.

A playable DurHack 2026 browser experience: a presentation deadline and a fleeting visit become four connected districts. Twenty-four residents elect a daily time budget. Their choices create a numerical history, procedural SVG artwork and a synthesised soundtrack. Replay one decision as a second world and listen between them.

**A fictional model, not psychological scoring, therapy, advice or prediction.** All units and preferences are authored game parameters.

## Run locally

Node.js 22.12+ (or current Node 24/26), npm, and a browser with Web Audio support are recommended. No account, API key, database, external font or downloaded audio sample is required.

```sh
npm install
npm run dev
```

Vite serves at **http://localhost:5173**; if occupied it reports the next available port. The server binds to `0.0.0.0` to support orb portals; use `npm run dev -- --host 127.0.0.1` for loopback-only development on your laptop.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Production preview: **http://localhost:4173**. There are six focused simulation/audio-projection tests in one file; no broad browser-test framework.

## A two-minute judge demo

1. Click **Try a demo dilemma** to restore the reproducible `presentation-and-friend` fixture (seed 4242, energy 8/12, task progress 0). Enter world with **Enable sound** checked. The 30-second daily cycle starts automatically; speed changes do not change the music’s 88 BPM.
2. Watch Campaign → Voting → Resolution, or click **Step day** for an immediate result. The unedited first election is **4 / 12 / 8**, so **Protect the visit** wins. The day ends with **3 presentation points, 3 visit points, 8.4 energy and 1× method**. Step pauses playback; click Play world to hear its resulting pattern, or branch to hear frozen loops.
3. Click **Explore another choice**. The default intervention is **Prepare now**: **6 presentation points, 0 visit points, 7.4 energy, 1× method**. Both worlds start from the same snapshot and see the same event. The original votes are preserved, not relabelled as a mandate for the intervention.
4. Move the A/B mixer to either endpoint. Click a musical part or a “Compare this district” headphone button to solo it across both worlds. Numbers stay fixed while sound changes. Select **Improve the method** to explore the third allocation. Choosing the original policy gives a labelled identical comparison.
5. Return to World A (paused). Step day 2 and inspect **Observatory**. Select a resident to inspect their weights, normalised signals, utilities and actual vote. Select a completed day in the memory strip to inspect/branch that snapshot.
6. **Edit assumptions**, choose **A little head start**, or change starting progress to 10. The first forecast becomes **0 / 16 / 8**. Pause during Campaign to edit any budget; an invalid sum is rejected without replacing the last valid proposal.

## Implementation and rules

- `src/simulation.ts`: central typed config, authored scenarios, stable residents, validation, forecasts, election, pure resolution and independent one-round branches. `judgeSetup` is the saved reproducible judge fixture; refresh begins a known fresh world. No sensitive text is collected or stored.
- `src/App.tsx`: one authoritative reducer for playback and resolution. The phase clock never drives individual notes. Snapshots are deep-cloned; a branch is bounded to one completed day, not a speculative long-term prediction. Fourteen days maximum, then clean pause/reset. Edits apply to the current uncommitted Campaign; next day begins with fresh authored proposals.
- `src/WorldArt.tsx`: local procedural isometric SVG. Shared state changes its labels; resolved activity changes trail brightness, thickness and speed. Residents animate during playback. Districts retain stable sizes and shapes, so both worlds have a common visual reference.
- `src/audio.ts`: native Web Audio synthesis (rather than adding Tone.js), with one lazily-created context and one audio-clock lookahead scheduler. Four compatible voices, fixed tempo, bar-boundary score swaps, smooth equal-power A/B gains, conservative headroom and a compressor. No samples, no network requests. Discovery only changes music when an acquired method is subsequently used; prior replenishment raises a later Achievement opening by an octave.
- `src/Observatory.tsx`: substituted live equations, immutable numerical events, fixed-scale history chart, voter calculation and shared audio mappings. Presentation/visit charts clip at the goal for a fixed reference; raw numerical progress is not clipped.

All productivity uses **start-of-action** energy/method. Recovery and Discovery act later. Energy has a 0.25 productivity floor and is clamped to the editable cap. On day 2 an indexed event adds one energy token; on day 3 it removes one, before forecasts. The visit closes after day 1. Authored budgets then deterministically move Connection blocks to Achievement; explicitly edited closed-window allocations remain valid but ineffective and warned. End-of-day milestones latch once, even if progress later exceeds the goal. Voters use the displayed one-round utility, not hidden urgency or forced winners. Ties use stable proposal order.

### Sound and lifecycle

Sound requires an explicit gesture. Silent mode remains fully playable. Repeated sound clicks reuse the same context. Pausing/reset stops pending notes; comparison loops can play while its numerical worlds are frozen. World ↔ Observatory navigation does not restart the transport. Switching to Compare pauses the source world. Hiding the browser tab stops simulation/audio without catch-up; return and explicitly resume. Audio output can be blocked by the browser or operating system: use Enable sound again. A synth/context failure leaves a visible status and silent mode.

Four parts are event-derived, not prerecorded loops. The initial unresolved world has a quiet starting motif (explained in the guide), not fabricated activity. Subsequent loops reflect the latest completed round. Recovery’s audible/visual contribution is `clamp(energy + recovery − costs) − clamp(energy − costs)`: replenishment surviving the cap, not phantom gains at full energy. Scores use eight eighth-note positions per four-beat bar. The decorative mini-wave indicators indicate playback, not a measured audio waveform. Physical speaker output, audio hardware differences and Safari-specific policies need a real-device listen; automated numerical checks cannot establish subjective musical quality.

## Cloudflare, when ready

The static-only SPA is prepared for **Cloudflare Workers Static Assets** in `wrangler.jsonc`, including SPA fallback. No Worker script or cloud resources are needed. First verify locally:

```sh
npm run build
npm run cf:dev
```

Wrangler serves at **http://localhost:8787**. A Wrangler release with an older local workerd runtime may warn that it is using its newest supported compatibility date locally; the committed intended deployment date is 2026-11-14.

Only after authorising a real deployment, authenticate interactively and deploy:

```sh
npx wrangler login
npm run build
npm run deploy
```

Deployment is not part of the local build. No deployed URL is claimed. `.env.example` documents that the core needs no environment. Optional AI generation was intentionally cut: there is no billable endpoint, secret or personal-text submission path.

## Deliberate limitations

- Two authored starting variants of the same dilemma; no arbitrary text-to-world generation.
- One-round frozen comparisons. Later elections are not replayed in B. Reset/scenario changes clear branches. Refresh does not persist histories.
- Six preference archetypes mixed across four district identities; deterministic, short-horizon voting, not realistic political modelling.
- Local generated SVG and oscillator audio, not a 3D engine or recorded orchestra. Audio transitions are quantised; a changed score may wait until the next bar.
- Desktop-first, with stacked narrow layouts and reduced-motion support. Browser automation at a narrow viewport is not a native phone/device test.

## Initial build verification — 14 November 2026

`npm run typecheck`, all six `npm test` checks and `npm run build` passed. The browser pass exercised the authored demo, repeated sound enable (same context, no multiplied scheduler), the real 4/12/8 vote, branch policies including identical replay, A/B endpoints, Connection solo, invalid budget rejection, changed initial progress (0/16/8), reset, the empty and resolved Observatory, and actual tab-away pause/resume. A Web Audio analyser measured nonzero generated output; this is not a physical-speaker listening test. Moving the mixer left numerical metrics unchanged. Desktop and 390px-wide Chromium layouts were inspected with no horizontal overflow. The built production preview was opened and the local Cloudflare runtime returned the SPA for a direct `/observatory` request (HTTP 200). Nothing was deployed.
