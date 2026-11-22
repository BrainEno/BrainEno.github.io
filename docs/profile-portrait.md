# Intro portrait · pen self-portrait on the night stage

`public/images/profilephoto.jpg` (1000×1400) is a processed derivative of the
pen self-portrait supplied as `IMG_2847.jpeg` (2465×2589). The previous teal
painting was retired: its saturated wash formed a hard rectangle on the black
stage and the black ink sank into the dark background, so the face lost
contrast next to the white type.

## Why this source

- `IMG_2847.jpeg` — original pen on paper. Highest resolution and the full
  range of pen pressure; the only source that survives the portrait crop
  (frame aspect ≈ 0.72) without going soft.
- `IMG_2848.jpeg` — the same drawing as clean green lines on white. Rejected
  as the delivery file: 1008 px wide, and the green reads as a new accent
  colour the UI does not use.
- `IMG_2850.jpeg` — coloured crayon on kraft paper. Rejected: warm tan paper
  and the rust/navy blocks clash with the cool night palette, and at
  663×966 it is too small for the frame.

## Processing (deterministic, no redrawn lines)

1. Estimate the paper tone with a wide Gaussian blur and derive ink coverage
   from the local difference, so the photo's uneven lighting and the shadow
   in the lower-right corner do not print as a grey wash.
2. Composite the ink as a pale duotone (`#e8eef8`) over a near-black ground
   (`#04070d`, the site's `--night`), with a faint paper-tooth grain. The
   ground is close enough to the stage that the rotated frame's edge
   effectively disappears; the existing `grayscale(40%)` on the mask only
   softens the duotone slightly.
3. Centre-crop to the frame aspect and export at 1000×1400, matching the
   previous file's dimensions so `intro.portrait` and the manifest contract
   are unchanged. Run `npm run images` to regenerate the WebP variants.

To redo it, re-run the same steps on the original photo; no line work was
added, removed or moved.
