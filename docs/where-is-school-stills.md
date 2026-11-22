# Where Is School · intro contact sheet

The six frames are development screenshots, not concept illustrations. The intro no longer features the two Sureshot website images; the Sureshot Works entry is independent. Desktop scrolls the sheet into position and holds it still. On narrow screens and under reduced motion the grid stays in normal document flow. Each button opens the entire frame and one bilingual selection note. The dialog also supports arrow keys and Escape.

Three additional selections were identified in the Drive collection **where-is-school 视觉实验精选（PR196 & PR200）**. The repository screenshots used below matched the Drive JPEG checksums byte-for-byte. No Drive sharing settings or source files were changed.

| Drive selection | Original under `docs/screenshots/visual_experiments/` in the game repo | File in `public/images/` |
| --- | --- | --- |
| 01_PR196_门槛画框_走廊被画进画里 | `compatibility/10_threshold_painted.jpg` | `game-painted-threshold.jpg` |
| 07_PR200_窗帘撕开_纸面裂口 | `biology_classroom/compatibility/07_curtain_tearing.jpg` | `game-paper-tear.jpg` |
| 06_PR196_失真走廊_巨门 | `compatibility/05_corridor_giant_door.jpg` | `game-giant-door.jpg` |

Edit the order, labels and notes in `intro.gallery` and the collection label in `intro.galleryTitle`; run `npm run images` after changing the originals. WebP variants are for delivery only; the source colours and aspect ratios are preserved.
