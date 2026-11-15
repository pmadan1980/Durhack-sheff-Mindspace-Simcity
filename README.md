# MINDSPACE - the universe within

An explorable, procedural 3D inner world for DurHack 2026. Enter a luminous neural brain, travel between floating districts, release a thought at Headquarters, watch 24 residents make a decision, collect actual memories, and hear or compare its consequences.

**A fictional, authored model—not psychological scoring, therapy, advice, prediction or an AI system.** All preferences and units are game parameters. There is no backend or existing AI integration to preserve; thoughts stay in browser memory and are never sent or persisted.

## Run locally

Use Node.js 22.12+ with npm, and a modern browser. WebGL2 enables the full 3D world; an illustrated mode preserves the controls without it. Sound requires Web Audio and a user gesture. No account, API key, database, remote font, downloaded model or audio sample is needed.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the URL Vite prints (normally **http://localhost:5173**). For an orb portal, `npm run dev` binds to `0.0.0.0`. Never expose a development server publicly without appropriate access controls.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Production preview normally uses **http://localhost:4173**. Twelve focused tests cover the engine, branches, memory projection, audio projection, disclosed thought presets, the guided journey (real ballot reveal, commit-once, pause/reset) and the counterfactual replay. There is no broad browser-test framework.

## The guided journey

1. **Landing.** A glowing point-cloud brain with four voice regions. Drag to rotate, scroll to zoom, hover or pick a voice to hear what it wants, tap to light its memory orb.
2. **ENTER YOUR MIND** flies into Thought Headquarters. Pick **A deadline & a friend** and **RELEASE THOUGHT** (literal, disclosed keyword rules, not AI: “almost done” → 10 progress, “tired” → up to 4 energy). **Or skip the story and explore freely** opens the original free-play world.
3. **Briefing → Voices → Debate → Your edit → Polls → Result → Consequences → Reflection**, one primary button per scene. The world clock never runs in the guided story. The debate is generated locally from the same forecasts the election uses; you can ask any voice two questions. Before the polls you keep or edit a plan with a six-block tray. The polls freeze one election and reveal its real 24 ballots over ~10 seconds (pause, reveal all, click a resident to see why). The day is resolved exactly once, then a ledger and music captions explain the change. Unedited day 1: **4 / 12 / 8**, **Protect the visit** wins, giving **3 presentation, 3 visit, 8.4 energy, 1× method**.
4. Days 2 and 3 recap what changed. After day 3: a three-day story summary, then **What if another plan had won?** replays from a chosen day to day 3 with one plan forced and compares both worlds over the same days in Parallel Worlds.
5. **Explore manually** pauses the journey at any time; **Resume journey** returns to the same scene.

## The four districts

The four voices use the model's names everywhere: **Achievement** (gold spark-star), **Connection** (coral heart), **Discovery** (blue teardrop wisp) and **Recovery** (mint sleepy cloud). They are original animated characters: they blink, talk (simple mouth movement while their line is shown, not audio lip-sync), nod while listening and react to edits and results.

Buildings respond to actual progress, method and energy. Original geometric personas react to resources and completed choices. Neural pulses connect the floating islands. Decision lights use actual ballots and the Voting clock. Memory orbs represent completed events, never forecasts or invented milestones.

## Implementation

- `src/MindScene.tsx`: lazy-loaded React Three Fiber / Three.js environment with Drei labels, lines and particles. A single camera travels through a connected coordinate space. Geometry and glow textures are generated locally; atmospheric fog, emissive materials and additive light sprites avoid expensive full-screen postprocessing. DPR is capped at 1.5; no shadows, external models or asset-service dependency. Only the current chamber is instantiated. Hidden tabs stop rendering.
- `src/MindUniverse.tsx` and `src/universe.css`: cinematic entrance, Motion transitions, destination dock/Atlas, contextual thought/persona/memory panels, accessible equivalents for canvas interactions, explicit motion and lightweight settings. System reduced-motion is respected. Reduced motion snaps the camera and uses on-demand rendering. A renderer error or context loss switches to illustrated mode without resetting the simulation; users can also choose it manually.
- `src/App.tsx`: the existing authoritative playback/resolution reducer and functional election, comparison, sound and history panels, now revealed at their locations rather than in a global dashboard. Location is the navigation source of truth. Starting a world does not automatically enable sound or advance time.
- `src/WorldArt.tsx`: original procedural SVG headquarters retained as the lightweight fallback. It needs no 3D renderer or network asset.
- `src/journey.ts`, `src/GuidedJourney.tsx`, `src/dialogue.ts`: the guided journey reducer (scene gating, locked election, reveal, commit-once), its story panels, and authored dialogue templates driven by the model's forecasts.
- `src/LandingBrain.tsx`, `src/brainShape.ts`, `src/VoiceIcon.tsx`: the point-cloud landing brain, its outlines, and the 2D voice characters.
- `src/simulation.ts`: typed configuration, authored scenarios, disclosed local thought presets, deterministic residents/elections, pure resolution and independent one-round branches. The numerical engine is unchanged by the 3D presentation.
- `src/memories.ts`: actual half/full presentation milestones, visit gains, newly acquired method and replenishment surviving the energy cap. A missed deadline stays missed even if progress reaches its goal later. No forecast, closed-window visit, zero gain or capped-away replenishment creates a memory.
- `src/audio.ts`: one lazy native Web Audio context and lookahead clock, four synthesized voices, bar-boundary score swaps, equal-power crossfade, solo gates, conservative headroom and compressor. Lightweight analysers expose actual post-crossfade channel energy for the 3D room; no second audio engine or timer is introduced.
- `src/Observatory.tsx`: actual mathematics, immutable events, fixed-scale history chart, individual voter calculation and event-to-music mapping.

### Numerical and lifecycle invariants

24 residents, six daily time blocks, a maximum of 14 days/history entries. Productivity uses **start-of-action** energy and method. Recovery and Discovery act later; method gains are not retroactive. Energy has a 0.25 productivity floor and is clamped to the editable cap. The day-2 external event adds one energy token; day 3 removes one before forecasts. The visit closes after day 1. Authored visit allocations then move to Achievement; explicitly edited closed-window blocks remain valid but ineffective and warned. End-of-day deadline results latch once. Utility decides the election; ties use stable proposal order.

Each comparison replays **one completed round** from identical starting data with the same external event and preserved election. Changing the intervention does not mutate A. It does not predict later elections. The source pauses on entering Parallel Worlds and stays paused on return. Audio-only A/B mixing changes no numerical state. Both visual worlds use the same district layout and geometry, driven by their own numerical snapshots.

Hiding the tab pauses simulation and sound without catch-up. Return and explicitly resume. Refresh starts a fresh world. Sound initialization failure leaves the silent visual model usable. Music is generated, not prerecorded; a score change can wait until the next bar. Analyser activity proves generated signal, not physical speaker output or subjective musical quality.

## Build and browser checks

The implementation is checked with TypeScript, the seven contract tests and a Vite production build. Three.js is split into a lazy scene chunk; Vite can warn that the engine chunk exceeds 500 kB uncompressed. This is not an asset download loop or build failure. The dependency lockfile is tracked; no billable service or deployment is introduced.

Visual and interaction checks should exercise the neural entrance, hub, each room and district, a thought reset, valid/invalid budgets, the exact first-day and alternate outcomes, selected memory → Observatory, solo/mute/mixer, system and manual reduced motion, repeated 3D/illustrated switching, renderer failure and a narrow layout. Browser emulation is not a real phone or Safari test. Hardware GPU performance and physical audio still need a device check.

## Cloudflare, only when authorised

The static SPA remains configured for Cloudflare Workers Static Assets in `wrangler.jsonc`, with SPA fallback. No Worker script, environment secret or cloud resource is needed to run locally.

```sh
npm run build
npm run cf:dev
```

Only after separately authorising a deployment, authenticate with `npx wrangler login` and run `npm run deploy`. Nothing about a successful local build implies a push or deployment.
