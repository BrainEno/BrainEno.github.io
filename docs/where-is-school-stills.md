# Where Is School · intro gallery stills

The intro gallery and coda accents are development screenshots from
**Where Is School**, shown in the site's original rail presentation: on
desktop the pinned track traverses frame by frame, on narrow screens and
under reduced motion it is a native horizontal scroll. The two Sureshot
website images that used to sit in this gallery are gone; the Sureshot
Works entry is independent and unchanged.

Three additional selections were identified in the Drive collection
**where-is-school 视觉实验精选（PR196 & PR200）**. The repository
screenshots used below matched the Drive JPEG checksums byte-for-byte. No
Drive sharing settings or source files were changed.

| Drive selection | Original under `docs/screenshots/visual_experiments/` in the game repo | File in `public/images/` |
| --- | --- | --- |
| 01_PR196_门槛画框_走廊被画进画里 | `compatibility/10_threshold_painted.jpg` | `game-painted-threshold.jpg` |
| 07_PR200_窗帘撕开_纸面裂口 | `biology_classroom/compatibility/07_curtain_tearing.jpg` | `game-paper-tear.jpg` |
| 06_PR196_失真走廊_巨门 | `compatibility/05_corridor_giant_door.jpg` | `game-giant-door.jpg` |

Edit the order and labels in `intro.gallery` / `intro.accentImages`; run
`npm run images` after changing the originals. WebP variants are for
delivery only; the source colours and aspect ratios are preserved.
