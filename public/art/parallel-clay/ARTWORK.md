# Parallel Worlds artwork

Built-in image-generation tool used: `image_gen.imagegen`.

Files in `public/art/parallel-clay/`:

- `reference.png`: user-provided two-panel clay diorama, copied unchanged. CSS displays the left panel for work and right panel for meeting a friend.
- `rest.png`: generated matching rest pose.
- `ideas.png`: generated matching ideas pose.

Images are local project assets, with no external asset service dependency. The renderer crossfades scene states and adds small CSS lighting, steam and camera effects. It does not claim to be a rigged 3D character animation.

## Final generation prompts

The following common prompt was sent for both generated assets with the user's image supplied as the reference:

> Use case: illustration-story. Project-bound game scene asset for MINDSPACE. Image 1 is the exact visual and composition reference, not a UI to reproduce. Generate ONE landscape scene, 3:2 aspect ratio, matching ONE HALF of the reference image, NOT a split-screen or collage. Preserve the same straight-on three-quarter miniature clay diorama: mauve textured curved walls, left wooden study desk and yellow articulated lamp, books, potted plant, central arched sunset window, right cafe table with two chairs and coral striped awning, hanging warm yellow flower-shaped lamp, small chalkboard and purple plinth. Same adorable young adult woman with short dark bob, round face, tiny eyes, lavender cable-knit sweater, dark trousers and cream shoes. Soft handmade polymer-clay material, beautifully rounded geometry, tactile subtle grain, warm peach dusk and glowing honey lights, soft contact shadows, cosy premium stop-motion film craftsmanship. Deep midnight plum background #110e22, no lettering, no UI, no borders, whole plinth visible. Fill the frame like the reference; avoid large empty margins. Render an original matching scene with identical camera, room layout and main character proportions.

Rest suffix:

> This is the REST state. The main woman sits alone on the right cafe chair with eyes gently closed and a peaceful smile, hands around a warm mug, shoulders relaxed. The other chair is empty. Desk is unoccupied, closed notebook on desk, no second person. Restful mood, small wisps of steam. Keep all architecture and furniture precisely in the reference locations.

Ideas suffix:

> This is the IDEAS state. The main woman sits at the LEFT desk, eyes bright and smiling as she discovers a new approach; a small warm glowing lightbulb beside a few colourful blank note cards at the desk. One hand holds a pencil above her open notebook, the other lightly raised in a tiny aha gesture. Cafe chairs are both empty. No second person. Keep all architecture and furniture precisely in the reference locations.

## Neutral unavailable/waiting state

`empty.png` was generated with the built-in image tool from the original reference, with this prompt:

> Create one landscape 3:2 game scene asset, matching exactly ONE HALF of the attached reference's cute handmade polymer clay diorama. Same mauve curved textured walls, left wooden study desk with yellow lamp, books and open notebook, central arched sunset window, right cafe table with two empty wooden chairs, coral striped awning, hanging honey-yellow flower lamp, plant and purple plinth. Premium warm soft clay textures and rounded miniature forms, dark midnight plum #110e22 background. IMPORTANT: the entire room is empty, NO people or characters anywhere, no mugs being held, no movement or outcome implied. This is a neutral waiting state before a plan's availability is confirmed. Preserve the reference camera and complete room layout. No text, UI, borders, badges or symbols. Full miniature and base visible with the reference's framing.
