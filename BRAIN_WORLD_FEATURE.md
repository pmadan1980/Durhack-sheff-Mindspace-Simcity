# Brain world animation experiment

Branch: `codex/thought-pathways`.

Thought release opens a short scene with four clay priority regions. Explicit text cues activate regions; users can correct the visual selection. These switches affect the illustration only. The existing scenario setup remains the source of confirmed facts. The scene has Pause, Skip, Escape, a continue button and reduced-motion support. Time stops when the browser tab is hidden. Transitions never advance simulation time or change a vote.

The guided daily journey also has a live speaking pathway, editable six-block bridges, a chosen-path transition, memory orbs made from recorded rounds, a two-window counterfactual transition, and a night replay with a short resolving chord when sound is enabled. Catalogue comparisons have the same two-window transition and retain their existing scenario-specific facts and artwork. The daily memory replay is not fabricated for catalogue scenarios that do not simulate days.

Neon signals are SVG paths over the generated artwork. Only active regions receive illumination. CSS animates light movement rather than updating React every animation frame. The artwork has a stationary camera; short camera movements happen in transitions, not while filling forms. This is a visual metaphor, not anatomical localisation, EEG, a diagnosis or an inferred chemical measurement.

## Artwork

Built-in image generation, not an API-key/CLI workflow. Both original PNGs are retained as project assets at `public/art/brain-world/dormant.png` and `public/art/brain-world/awake.png`. The latter is a lighting-only edit of the former. Exact prompts are in `public/art/brain-world/PROMPTS.json`.

## Try it

Enter: “I’m exhausted, but my assignment is due tonight.” Achievement and Recovery activate; Connection and Discovery remain quiet. Pause to inspect the neon pulses. Skip continues to the existing assignment setup. Try a second thought mentioning a friend, or a new tool, to see the other regions activate.
