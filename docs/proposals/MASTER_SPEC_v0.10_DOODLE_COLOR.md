# Proposed Master Spec v0.10: Section 48A color amendment

Status: PROPOSED ONLY. Task #20.1 local review; not frozen or published.
Frozen v0.9 and all earlier specifications remain unchanged.

Replace only the opening paragraph of Section 48A with the following:

> Global Doodle lets authenticated ACTIVE Atoms share temporary 64 x 64 dot
> drawings. Existing version 1 monochrome drawings retain their original 512-byte
> bitmap and theme-adaptive appearance. Version 2 drawings use a fixed eight-color
> palette: Black (#000000), White (#FFFFFF), Red (#CF5A53), Orange (#B86B00),
> Yellow (#E3C32E), Green (#438B52), Blue (#4A7FC1), and Purple (#9A66CC).
> Their bitmap is exactly 2,048 bytes, with two four-bit pixel indices per byte;
> the first pixel occupies the low nibble. Index 0 is empty/erased, indices 1-8
> identify the listed colors in order, and indices 9-15 are invalid. Palette values
> and encoding identification are immutable for each version. A contrasting inset
> edge may distinguish a colored dot from the canvas without changing its stored
> color or outside geometry. Drawing, erasing, undo, clear, accessible named palette
> controls and Light/Dark presentation are supported. The canvas is the preview;
> SEND is the final publication action. Complete bounded replay remains available
> to authorized moderators, not ordinary user-facing interfaces. Every rendering
> path interprets the same versioned data. Server-side validation checks the
> encoding, permitted indices, replay bounds and exact reconstruction. No confirmed
> Bond is required to create, view, appreciate or report a drawing. Anonymous access
> is not part of this feature.

All remaining Section 48A text and every unrelated requirement remain unchanged.
A future authorized freeze would update only required document version/status
metadata plus this paragraph. This proposal does not change authority references
in AGENTS.md or the Build Blueprint.
