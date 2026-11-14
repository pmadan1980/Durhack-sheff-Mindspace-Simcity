# MINDSPACE: scenario engine and 15-scenario library

Status: proposed specification, not implemented or trained. Prepared 14 November 2026 against the reviewed feature/mindspace-demo snapshot 73092a9 and Mindspace_Hackathon_Brainstorm.md. No application code changed.

## Product promise

Four voices. One mind. Better decisions.

Help users compare feasible actions, understand competing values and reflect on their own decisions. Show conditional consequences, not predictions of someone's future. Achievement, Recovery, Discovery and Connection have enduring priorities, but their preferred actions change with the facts.

## What exists and what needs to change

The reviewed TypeScript implementation already computes resource changes, resident ballots and alternate branches. Its scenario library contains two variants of the presentation-and-visit dilemma. Its text interpreter checks a few literal phrases. Most importantly, its setup is specific to one task deadline and one visit window. Fifteen labels alone would still produce the same underlying story.

Replace this narrow setup with configurable goals, action durations, availability windows, dependencies, user priorities and explicit unknowns. Keep the existing deterministic engine and journey as foundations, but generalise their assumptions. These are proposed changes, not existing capabilities.

The current 24 synthetic residents are simulation agents, not community voters. For the brainstorm's council, use four visible resident ballots. If retaining the 24-agent population, label and display that as a separate simulated population. Real community voting needs separate human vote records and participation controls.

## No API key required

Recommended MVP: a rules-based scenario engine plus an authored argument library. This is configuration and evaluation, not machine-learning training. Fifteen well-designed scenarios are useful coverage; they are not evidence that a model can predict human outcomes.

Use templates to identify a dilemma family, collect missing facts, construct feasible options, evaluate trade-offs, select grounded arguments and run a conditional comparison. A new situation can reuse a family without sharing its exact wording: an exam, job interview and performance rehearsal all involve preparation before a deadline.

Optional later: run an open-weight language model locally to extract structured information or paraphrase grounded arguments. Ollama's local API requires no authentication; hosted services have different requirements. Hardware capacity, download size and latency must be checked before choosing a model. An LLM does not make the numerical simulator empirically accurate. Source: https://docs.ollama.com/api/authentication

Classical machine learning is another future option for routing scenarios or estimating outcomes from suitable labelled observations. Training and held-out evaluation would be required; authored examples and synthetic outcomes cannot establish real-world predictive accuracy. Decision trees can overfit small datasets. Source: https://scikit-learn.org/stable/modules/tree

## Common scenario contract

Every scenario stores:

- ID, version, family, neutral summary and supported scope.
- Facts with their source: user supplied, user confirmed or hypothetical.
- Unknowns and explicit editable assumptions, kept separate from facts.
- Goals with deadlines, required effort, progress and importance.
- Available time, travel/setup time, optional self-reported energy, fixed commitments and spending limits where relevant.
- Options with durations, prerequisites, availability windows and resource costs.
- Conditional effects, their rationale and whether they are arithmetic or authored assumptions.
- Argument rules for all four residents, including opposing arguments and conditions that reverse a position.
- A feasible compromise when one exists; otherwise an honest explanation of the conflict.
- A reflection question and a changed-context branch.

Do not force all dilemmas into an energy meter. Time arithmetic can be exact within the supplied inputs; feelings and other people's reactions remain unknown. Do not turn illustrative priority scores into psychological measurements.

## The 15 scenarios

All conditions below are authored design rules for evaluation, not claims about how people necessarily behave. Ask at most two material clarification questions initially, then let the user edit the remaining assumptions. A blocked calculation may require an additional fact.

### 01 — Test tomorrow, invitation tonight

- Prompt: “My friend invited me out, but I have a test tomorrow.”
- Ask: How much preparation remains? How long would the outing, including travel, take?
- Options: prepare; attend; attend briefly with protected preparation and rest.
- Debate: Achievement protects preparation; Connection asks about the occasion; Recovery considers whether the outing is restorative or tiring; Discovery explores a shorter format.
- Position change: Achievement can support attending when preparation is already complete. Connection can support declining with a concrete alternative arrangement.
- Feasibility: a short outing is only a compromise when travel, preparation and the user's protected rest fit.
- Reflection/branch: What happened to the plan? Compare the same scenario with preparation complete versus incomplete.

### 02 — Presentation and a friend's last day in town

- Prompt: “My presentation is due in three days, and my friend leaves tomorrow.”
- Ask: What work remains? Is another meeting genuinely available?
- Options: prepare now; meet now and schedule preparation; split today's time.
- Debate: Achievement considers remaining capacity across all three days; Connection values the expiring opportunity; Discovery suggests a smaller presentation scope or different meeting format; Recovery checks workload concentration.
- Position change: Achievement can support meeting today when later preparation capacity is sufficient.
- Feasibility: show missed visit windows explicitly; do not offer tomorrow's visit after departure.
- Reflection/branch: Did preparation take longer than expected? Re-run with a head start or reduced available time.

### 03 — Extra shift versus coursework

- Prompt: “I've been offered an extra shift, but coursework is due soon.”
- Ask: Is the shift optional? How much coursework and usable time remain?
- Options: accept; decline; request a shorter or swapped shift.
- Debate: Achievement weighs both responsibilities; Recovery checks load; Connection considers commitments to colleagues; Discovery explores a schedule change.
- Position change: Achievement need not choose coursework when the user states that the shift meets a more important obligation.
- Feasibility: do not assume a manager approves a change. Mark that option conditional.
- Reflection/branch: Was a swap accepted? Reconsider when the shift becomes fixed. Do not turn this into financial advice.

### 04 — Another hackathon feature versus stabilising the demo

- Prompt: “We could add one more feature before judging.”
- Ask: How long until judging? Which existing demo steps currently fail?
- Options: build the feature; fix failures; time-box a small experiment with a rollback point.
- Debate: Discovery values novelty; Achievement values a demonstrable result; Recovery checks remaining capacity; Connection considers team agreement and ownership.
- Position change: Discovery can favour stabilisation when it unlocks an existing novel feature for demonstration.
- Feasibility: reserve explicit rehearsal time; do not assume implementation estimates are guaranteed.
- Reflection/branch: Did the trial meet its checkpoint? Compare one hour remaining with four hours remaining.

### 05 — Study alone versus with a group

- Prompt: “Should I revise alone or join my study group?”
- Ask: What task needs completing? What has the user actually observed about previous group sessions?
- Options: solo work; group work; solo preparation then a short question session.
- Debate: Achievement considers task fit; Connection values collaboration; Discovery values alternative explanations; Recovery considers distraction and social effort as reported by the user.
- Position change: Connection can support solo work followed by a check-in when the group format is unhelpful.
- Feasibility: do not invent a productivity bonus for group study.
- Reflection/branch: What was completed? Compare an available quiet group with an unstructured social session.

### 06 — Familiar approach versus learning a new tool

- Prompt: “Should I use what I know or learn a new tool for this project?”
- Ask: How much time remains? Is the familiar approach sufficient for the requirement?
- Options: familiar route; new route; time-boxed trial with a fallback.
- Debate: Discovery values learning; Achievement asks whether learning advances the goal; Recovery considers frustration and capacity; Connection considers team support and handover.
- Position change: Discovery supports the familiar route when it frees time for another exploration the user values.
- Feasibility: include setup and switching time; a fallback must leave time to finish.
- Reflection/branch: What did the trial reveal? Reconsider if the familiar tool cannot meet the requirement.

### 07 — Help a friend move versus personal work

- Prompt: “My friend needs help moving, but I have work to finish.”
- Ask: Was help already promised? What time windows are fixed?
- Options: help fully; decline; offer a bounded useful task.
- Debate: Connection weighs the commitment; Achievement protects work; Recovery checks effort; Discovery seeks another practical way to contribute.
- Position change: Connection can favour an honest decline over promising unavailable time.
- Feasibility: include travel; thirty minutes is not useful if the required task needs two hours.
- Reflection/branch: Was the bounded help useful? Reconsider if another helper becomes available.

### 08 — Social invitation when feeling drained

- Prompt: “I feel drained but don't want to miss tonight.”
- Ask: Does this type of activity usually feel restorative to you? Can you leave early?
- Options: attend; decline; choose a shorter or quieter meeting.
- Debate: Recovery uses self-report rather than assuming all socialising drains energy; Connection considers meaningful contact; Discovery proposes a different setting; Achievement considers tomorrow's commitments.
- Position change: Recovery may support a quiet meeting when the user describes it as restorative.
- Feasibility: no early-exit compromise if transport makes it impossible.
- Reflection/branch: How did you feel afterwards? Compare fixed transport with flexible departure.

### 09 — Team member asks you to take on more work

- Prompt: “My teammate wants me to take their part as well.”
- Ask: What capacity remains? What responsibilities and deadlines were agreed?
- Options: accept; decline with explanation; negotiate scope or redistribute tasks.
- Debate: Achievement considers delivery; Connection considers fairness and communication; Recovery checks capacity; Discovery looks for simpler scope.
- Position change: Connection supports boundaries when taking over would create an unreliable commitment.
- Feasibility: redistribution requires agreement, not an invented acceptance.
- Reflection/branch: What did the team agree? Reconsider after scope reduction.

### 10 — Family occasion versus project deadline

- Prompt: “A family occasion overlaps with my project deadline.”
- Ask: Which time windows are fixed? How important is attendance to you?
- Options: attend; prioritise work; attend part if travel and timing permit.
- Debate: Connection reflects the user's stated importance; Achievement checks work remaining; Recovery checks travel load; Discovery explores remote participation or earlier preparation.
- Position change: Achievement can support attendance with sufficient advance preparation.
- Feasibility: do not assume relatives will be upset or that partial attendance is possible.
- Reflection/branch: Which trade-off felt important afterwards? Compare local versus lengthy travel.

### 11 — Scroll for a break versus return to a task

- Prompt: “I keep scrolling when I meant to take a quick break.”
- Ask: Is there an immediate deadline? What break would the user like to try?
- Options: continue intentionally for a bounded time; take another kind of break; restart with a small task.
- Debate: Recovery checks whether the break feels restorative; Achievement suggests a manageable next step; Discovery offers alternatives; Connection distinguishes meaningful contact from passive scrolling without judging either.
- Position change: Achievement can support a break when no urgent task competes and the user wants one.
- Feasibility: a timer is a plan, not a guarantee of behaviour.
- Reflection/branch: Did the planned duration hold? Compare with and without an urgent deadline.

### 12 — New club versus an already full week

- Prompt: “I'd love to join a club, but my week is packed.”
- Ask: What recurring time does it require? What could be reduced if the user joins?
- Options: join; defer; attend a trial session.
- Debate: Discovery values exploration; Connection values belonging; Achievement checks commitments; Recovery asks whether the schedule has room.
- Position change: Recovery may support replacing a draining optional activity with a user-described restorative one.
- Feasibility: distinguish one trial from a recurring commitment; do not hide future time costs.
- Reflection/branch: Was it worth making room? Reconsider if trial attendance creates no ongoing obligation.

### 13 — Raise a small housemate issue versus postpone

- Prompt: “The kitchen mess bothers me, but I don't want an awkward conversation.”
- Ask: What specific change is wanted? Is a calm conversation practical now?
- Options: talk now; schedule a conversation; send a neutral request.
- Debate: Connection values respectful communication; Recovery considers timing; Achievement seeks a concrete agreement; Discovery explores different ways to raise the issue.
- Position change: Connection can favour postponing briefly when a calmer time is available.
- Feasibility: simulate the user's communication plan, never the housemate's guaranteed reaction. Threats or immediate safety concerns are outside this everyday scenario.
- Reflection/branch: Was a request made and what response was actually received? Update from that report only.

### 14 — Perfect a finished assignment versus submit

- Prompt: “It meets the requirements, but I keep polishing it.”
- Ask: Which requirements remain unmet, if any? What is the submission deadline?
- Options: submit after a check; time-box a specific improvement; continue revising.
- Debate: Achievement checks concrete quality gains; Recovery considers the cost of more work; Discovery tests whether the proposed improvement adds value; Connection considers other commitments displaced.
- Position change: Achievement supports submitting when required checks pass and further changes have no identified purpose.
- Feasibility: reserve upload time; do not predict a grade.
- Reflection/branch: Did extra work fix a real issue? Reconsider when a missing requirement is discovered.

### 15 — Two invitations at the same time

- Prompt: “Two friends invited me to different things on the same evening.”
- Ask: Have you committed to either? Are the timings and locations compatible?
- Options: choose one; decline both; split time only if practical.
- Debate: Connection considers existing promises without ranking friendships; Discovery considers novelty; Recovery considers travel and energy; Achievement considers other obligations.
- Position change: Discovery can favour a familiar event when the alternative adds no opportunity the user values.
- Feasibility: model travel and minimum useful attendance; two overlapping fixed events may have no compromise.
- Reflection/branch: Did the chosen plan match what mattered to you? Reconsider after one event changes time.

## Decision and debate pipeline

1. Route to a supported family using explicit phrases and structured selection. Show the candidate summary for confirmation. A word such as “friend” alone must not force the presentation scenario.
2. Extract only supported facts. Handle negation: “I am not tired” must not set tired=true. Ambiguous dates, conflicting deadlines and unrecognised wording trigger clarification.
3. Ask for the missing facts that change feasible options. If routing fails, offer a scenario picker or structured custom comparison; do not fabricate a match.
4. Generate options from action templates, including conditional options awaiting another person's agreement.
5. Reject time/resource violations before scoring. A compromise is not automatically available or preferable.
6. Evaluate options against explicit goals and user preferences. Keep each priority's assessment visible; do not hide all trade-offs inside one score.
7. Select resident arguments from matching rules. Every argument references a fact or a labelled assumption. A rebuttal references a previous argument ID and responds to its actual concern.
8. Record four resident ballots against action IDs. Ties and abstention are allowed; store the reason. Aggregate counts in code. Keep personal choice and any real community votes separate.
9. Present feasible alternatives and why each serves or sacrifices a priority. The user accepts, modifies or challenges the plan.
10. Freeze the starting state for alternate comparisons. Change only the selected action or fact; if stochastic events are later added, use the same event samples for both worlds.
11. Store optional reflection separately from the simulated outcome. Day 2 revises the debate only when facts, preferences or user-reported experience change.

## What simulation can legitimately show

Example: a user confirms five available hours, two hours of preparation, one hour of travel and a three-hour outing. Total demand is six hours, so the combined plan does not fit. A one-hour outing reduces demand to four hours and leaves one hour unallocated. This is a useful computed consequence, without AI or a claim about exam performance.

If effort is uncertain, compare explicit low/base/high assumptions. Show “fits if preparation takes two hours; does not fit if it takes four” rather than an unsupported success probability. Monte Carlo simulation is an optional extension only once event distributions have a defensible source; random numbers alone add no knowledge about real outcomes.

New scenarios generalise through shared constraints and action types. They do not generalise indefinitely: unknown mechanics should be marked unsupported. An LLM may improve language coverage but must not silently invent the missing rules.

## Suggested implementation boundaries

- Scenario catalogue: versioned data, argument rules and scenario-specific conditions.
- Interpreter: text to draft facts, with a confirmation step and fallback selection.
- Constraint engine: available time, deadlines, dependencies and option feasibility.
- Council engine: grounded arguments, responsive rebuttals and structured ballots.
- Comparison engine: immutable baseline and explainable changes between alternatives.
- Reflection store: user-reported observations with edit/delete support; no automatic claim of model training.
- Optional language adapter: interchangeable local or hosted model for extraction and phrasing. Validation and arithmetic stay in application code.

These modules can run locally in TypeScript. A separate server becomes useful for shared voting, syncing and hosted model secrets; adding a server alone does not strengthen reasoning. Start with local decision history and explicitly disclose its storage. No human community totals until that feature exists.

## Evaluation and demo priorities

For each of the 15 families, prepare a canonical input plus: a paraphrase, a negation, missing context, a fact that reverses one resident's stance, and an infeasible-compromise case. This yields 90 initial test cases. Add mixed-family and out-of-scope cases separately. Hold out additional phrasings from rule development so routing tests are not merely copied keywords.

Acceptance criteria: no impossible option presented as feasible; no unsupported fact attributed to the user; ballot totals match records; the same state produces the same deterministic result; branch comparison preserves its starting state; no-reflection Day 2 invents no new evidence; changed priorities can change recommendations; both alternatives and declined compromises remain available where valid.

First implement three complete journeys: test/invitation, hackathon feature/stability, and housemate conversation. They exercise time allocation, uncertain effort, and interpersonal unknowns. Then extend the remaining twelve through the common schema. This recommendation deliberately avoids pretending all 15 already work.

For judging: show one dilemma, change one material fact, let a resident explain its changed position, compare two feasible actions, then add a clearly labelled demo reflection. Explain the authored rules openly. Suggested pitch: “MINDSPACE uses a transparent scenario engine to make competing priorities visible, explore conditional trade-offs, and revisit choices through reflection.” Use “AI-assisted” only when an actual model is integrated.
