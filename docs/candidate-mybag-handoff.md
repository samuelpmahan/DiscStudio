# Candidate MyBag handoff

## Status

The bounded two-page increment is implemented under `/candidate/`. This document records its domain contract and the work that remains.

## Target pages

1. **DiscShelf** is the first page. It uses Concept B's warm three-column shell:

- searchable physical-disc shelf on the left;
- named Bag composition with large photo cards in the center;
- selected physical-disc inspector on the right.

2. **On the Course** uses Concept A's footage canvas and graphics controls. It opens in Single Disc mode and can switch between Single Disc and Disc Battle. Both modes consume the shared physical shelf and saved Bags.

## Domain contract

- A `Bag` has its own stable identity and editable name.
- Bag membership stores references to physical shelf `Disc.id` values.
- One physical disc may belong to multiple Bags; membership never clones or changes the Disc.
- Bag membership is separate from Disc Battle lineup and visual state.
- Removing a membership does not remove the physical disc from the shelf or another Bag.
- Missing Disc references must fail visibly at the model boundary rather than disappear from the composition.

## View contract

- Center cards use Concept B's large-photo treatment.
- MyBag has no score, winner, authored highlight, or active-battle meaning.
- Ordinary editor selection is local view state. Selecting a shelf or Bag card may update the inspector, but it does not change Bag membership or exported/domain facts.
- Preserve the current candidate's separate browser keys for domain data, design preferences, and checklist state.

## Current implementation

- DiscShelf/MyBag is the first page with shared physical Disc references, Bag creation, membership changes, and a warm three-column view.
- On the Course defaults to Single Disc and switches to Disc Battle.
- Course design settings include theme, mode-specific layout, screen placement, overlay size, flight/nickname visibility, local image/video context, and transparent PNG export.
- Workspace, Bag state, course settings, navigation, and checklist state persist under separate candidate-specific keys.

## Deferred work

Implement in dependency order:

Define physical-disc editing, Bag rename/delete, and battle-lineup editing in later checkpoints. DiscShelf's large photo cards are a browser view; On the Course exports Concept A graphics. Preserve `/concept-a/`, `/concept-b/`, the candidate renderer bridge, and the shared checklist while adding later capabilities.
