# Native desktop recordings for Works

[Capture run](https://github.com/BrainEno/BrainEno.github.io/actions/runs/44910363055) · [one-shot capture scripts](https://github.com/BrainEno/BrainEno.github.io/tree/9479298/scripts/capture-desktop). The three Windows applications were compiled and driven automatically. Each silent, 18-second H.264 clip samples the same running application at 10 frames per second. Posters and gallery images are frames from the corresponding take, not repository cards or mockups.

| Channel | Source revision | What the recording shows |
| --- | --- | --- |
| lyric-forge-ktv | [5830234](https://github.com/BrainEno/lyric-forge-ktv/commit/583023463cff3bcc8323287819245312c39ed841) | Two local demo projects; open 沿河灯火, inspect its timed lyrics, return to the dashboard. No vocals or playback are demonstrated. |
| ScribeForge | [1a0c51d](https://github.com/BrainEno/ScribeForge/commit/1a0c51d9ab9925b5093e6462ca9e4d6ba91241fc) | Import, processing status, review an OCR disagreement, then open export options. The native Flutter UI runs with the project's workflow-test file picker and CLI fixtures. This shows how the reviewer works, **not** a live OCR model run or a completed export. |
| win7-book-management | [7bb049f](https://github.com/BrainEno/win7-book-management/commit/7bb049f4d5a9d6fcbe3655dc6fd4a835cc0e48ce) | Open the dashboard, book records, inventory and reports in one WinForms session backed by the project's temporary, seeded SQLite database. |

Flutter captures the live render surface; WinForms paints its live window hierarchy into a bitmap on each tick. Only encoded media is shipped. The capture workflow was removed after importing the recordings: ordinary site builds do not need Windows, Flutter, or .NET.

## Television edits

The TV uses `video.previewSrc` when present; project pages keep the original, wider `video.src` for inspecting small text. Only the selected cut is loaded. The three `*-edit.mp4` files are silent fast-start H.264 at 1024 × 672, 20 fps. They cut the existing recordings, not the stills. Four numbered beats in a separate lower margin identify the current task; short reframes settle to let the viewer read before the next cut. The camera motion is editorial, not a simulated input or a newly recorded feature.

- **Elysium Player · 15.4 s:** workspace → project status → lyric timing → return.
- **ScribeForge · 15.5 s:** import → processing → review → export settings.
- **BOOK DESK · 15.9 s:** daily totals → catalogue → inventory → reports.
