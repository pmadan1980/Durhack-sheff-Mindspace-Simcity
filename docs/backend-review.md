# Backend review: scenario engine

Base: main at ae5abe7. Work is uncommitted. The approved frontend integration adds a separate council view and a link from the existing app. Existing simulation exports, dependencies and lockfiles are unchanged.

## Implemented

- Fifteen distinct authored scenario families, each with three options, four resident rationales, contextual rules, material questions and a reflection prompt.
- Pure TypeScript entry point: `src/engine/index.ts`. No React dependencies, external services, API keys, storage writes or network requests.
- Keyword-group routing returns a candidate requiring confirmation, multiple candidates, or unsupported. It never claims to interpret arbitrary language or turns negated keywords into facts.
- Runtime input validation, including unknown scenario/option/fact rejection, finite durations, provenance and preference weights.
- Total-time feasibility checks reserve protected commitments and include work/travel/setup in each supplied option estimate. Missing estimates and approvals produce conditional options; impossible plans do not receive ballots.
- Deterministic resident arguments, responses referencing a different resident's actual proposal, recorded ballots, ties and abstentions. Counts are calculated from ballots.
- Nondominated alternatives and optional personal-preference ranking. A popular option does not automatically become the user's recommendation.
- Independent before/after comparisons and explicit user-reported reflection updates. Reflections do not automatically train or silently alter the rules.
- A tested position reversal in every scenario, preventing fixed “Achievement always works” or “Connection always says yes” behaviour.

## What the existing app will show

The app now exposes the new scenario council at `/?council=1`, with a link from the original brain world. It supports scenario confirmation, editable facts and durations, resident arguments and ballots, changed-fact comparison, and session-only reflection. The original guided journey remains available at `/`.

A local browser smoke check passed scenario selection, council rendering, a changed-fact vote, reflection and disabled choices for impossible plans, with no browser errors. The production build and 18 tests passed (only 3 new smoke tests).

## Run the backend review

From the repository root:

```sh
npm test
npm run build
node_modules/.bin/vite-node scripts/review-scenario-engine.ts
```

The last command prints a Markdown report produced by the actual engine. All inputs in that report are explicitly hypothetical; they are not user records or measured outcomes. The report includes the catalogue, actual ballots before and after preparation changes, an impossible schedule and a reflection without new facts.

## Integration contract

```ts
import { routeThought, getScenario, evaluateDecision } from "../engine";

const candidate = routeThought("My friend invited me out before an exam.");
// Ask the user to select/confirm the scenario and its material facts.
const scenario = getScenario("test-and-invitation");
const result = evaluateDecision({
  scenarioId: scenario.id,
  availableMinutes: 300,
  reservedMinutes: 60,
  facts: {
    prepared: { value: false, source: "user" },
    restorative: { value: true, source: "user" },
    canLeaveEarly: { value: true, source: "user" },
  },
  estimates: {
    prepare: { minutes: 120, source: "user", includesTravelAndSetup: true },
    attend: { minutes: 180, source: "user", includesTravelAndSetup: true },
    brief: { minutes: 180, source: "user", includesTravelAndSetup: true },
  },
});
```

All estimates must cover the entire plan and use the same planning horizon. An option called “attend” must include any required preparation it promises to preserve, not just the event duration. Do not fill missing facts with false: omit them so they remain unknown. Source `hypothetical` enables an explicitly labelled what-if comparison; it is not a real-world confirmation. Keep `caveats`, `unknowns`, `status` and provenance in any eventual UI or API response.

## Limits and remaining work

This is an authored decision-support simulator, not trained AI or a separate HTTP server. Its comparison units are design choices, not empirical wellbeing scores or outcome probabilities. The scenario catalogue cover everyday dilemmas; unsupported subjects need explicit clarification rather than a forced match. The routing vocabulary is intentionally limited.

Time checks currently cover aggregate capacity, not calendar scheduling, overlapping events or computed multi-day dependencies. Relevant scenario flags such as “visit available” and “split possible” must be confirmed by the caller. Energy is not predicted. Restorative effects use self-report; other people's reactions remain unknown. Reflection data is returned, not persisted. No community voting, authentication, local language model or machine learning is included.

The council view now collects the confirmed family, facts and complete durations, then renders the result. The original 3D journey is still a separate experience. An HTTP adapter can be added later if the team needs shared sessions or community participation; it should call the same validated functions.

The larger 15-scenario product specification is in `docs/scenario-engine-spec.md`. It is a planning document created against the earlier reviewed branch, not a claim that every proposed feature is implemented here.
