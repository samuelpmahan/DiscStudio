# DiscStudio: staged build checklist

Status: product plan for Sam's review; this file does not assert implementation or acceptance.

## Current delivery: preserve and compare

Bring both existing frontends into this repository as rebuildable source. Publish distinct static URLs and point PageRouter at them. Preserve their independent behavior so Sam can select and refine the pieces he wants. Shared-core extraction is a subsequent change.

- [ ] Concept A builds and opens at its published URL.
- [ ] Concept B builds and opens at its published URL.
- [ ] PageRouter Single switches between both; Compare displays both.
- [ ] In each concept, add a disc and view its card.
- [ ] In each concept, edit a battle score and highlight/winner state.
- [ ] Check reload persistence and available export; record observed limitations.
- [ ] Preserve source branch and commit provenance.

Check completion in release evidence; do not infer it from source presence.

## mGM

minimal proves an independently inspectable result. Goldilocks is the useful increment we iterate toward. Maximal records a future possibility, not a commitment. Each row can progress independently subject to explicit dependencies. Implementation, execution, inspection, Sam's acceptance, and promotion remain separate facts.

| Tick / inspectable unit | minimal | Goldilocks | Maximal |
| --- | --- | --- | --- |
| Photo intake | Require a photo; decode and display it | Camera/file input, correct orientation, preserve original, retry clearly | Guided capture, multiple photos, blur/glare assessment |
| Disc framing | Move/resize circular crop | Manual ellipse adjustment for mild tilt, circularized preview, reset | Automatic rim detection and correction suggestions |
| Prepared image | Transparent circular cutout | Original plus reusable crop recipe, regenerate, check light/dark/checkerboard and real card | Edge refinement, export presets, batch regeneration |
| Shelf insertion | Save physical-disc identity, photo and entered metadata; retrieve it | Add/edit/remove, reload persistence, immediately reuse in DiscCard | Catalog assistance, filtering, multiple bags, backup/sync |
| DiscCard composition | Show chosen disc's image, manufacturer, mold and flight numbers | Refine hierarchy and placement against video context; usable transparent export | More visual themes and motion variants |
| DiscBattle composition | Compose cards, change score and active highlight, show winner | Polish readable score/highlight/winner states and export the selected state | Reusable round sequences and motion, if creator testing warrants them |

Photo is mandatory in the intended first-user workflow. Existing imported prototypes may not enforce this yet. Bags are named sets of references to physical discs, not copies. No arbitrary disc-count limit is a product requirement; existing prototype caps are recorded gaps.

## Inspection questions

1. Intake: is this the user's source photo, correctly oriented?
2. Framing: does the boundary follow the disc, and does the corrected preview look right?
3. Prepared image: is the edge clean and transparency correct on an actual card?
4. Shelf: does this exact physical disc survive reload and remain reusable?
5. Card: is it readable in its intended video corner at viewing size?
6. Battle: are the discs, scores, active disc and winner unambiguous at viewing size?

Correction inspection preserves visible source context. A cutout alone cannot prove the framing was correct.

## Object model direction

- PhysicalDisc: stable identity, manufacturer, mold, flight numbers, optional personal label; two discs of one mold remain separate objects.
- PhotoSource: original image and orientation information associated with the physical disc.
- CropRecipe: source reference and user-approved framing/correction parameters.
- PreparedDiscImage: derived transparent material associated with source and recipe.
- DiscShelf: collection of physical-disc references.
- DiscBag (later): named set of physical-disc references.
- CardAppearance / CardState: visual choices separated from physical-disc facts.
- Battle / BattleEntry: participants referencing discs, scores, active/winner state; temporal sequencing remains a later scope decision.

These are planning concepts, not a new serialized schema imposed on the imported implementations.

## Required execution foundation for subsequent work

PxC means Parts × Calculations: material and reusable calculations, with meaningful reuse and accounted execution. PQL is required. A PCR comprises Ticks; each Tick sequences reusable Calculations with a meaningfully inspectable result.

For each implemented Tick, identify input/output Parts, Calculation identities and arguments, actual execution testimony, and the inspection view. Requirements attach to those same identities. Shared Calculations are referenced across compositions, not copied into unrelated task hierarchies.

The rough frontend import is not proof of PxC/PQL adoption. Existing ChainSpot implementations are the reference for the subsequent integration; do not replace the core with a generic store and call it equivalent.

## Existing seams to revisit after the comparison is live

- The two concepts have independent models and persistence; data does not automatically transfer between them.
- Original-photo retention and transparent image preparation need explicit work; Concept B currently flattens imported images to JPEG.
- Existing shelf limits, score representations and winner rules differ.
- Both UIs must remain independently comparable while shared code is extracted deliberately.
- Tidy owns promotion; neat owns project state and matrices. Adopt their actual interfaces when available; do not build substitutes here.
