# Issue triage: television interaction, reduced motion, and preview safety

This change set takes only open issues with a concrete user-facing or reproducible failure. It does **not** treat every audit observation as a confirmed production incident.

## Selected work

### #53 — video work cannot reliably be played

The visual glass is below the full-width work list, so the list's row hit target can intercept clicks intended for the screen. The row already delegates a glass click, but the delegated target was the `<video>` element itself; that leaves the playback affordance implicit and makes its keyboard and screen-reader contract fragile.

The screen now has an actual localized Play/Pause `<button>` with `aria-pressed`, an explicit control relationship, visible focus, and a polite status announcement. Each video work also has a separate localized row-level playback toggle in normal Tab order; it queues the explicit user request until that channel's video is ready, while the row's own button continues to open the theater. The pointer preview stays active across the cabinet and list gaps, and the row and theater overlay delegate a glass gesture to the screen control. A glass gesture never falls through to the row's theater-open action during a channel transition.

**Interaction constraint:** a work row continues to open the on-page television theater. It is not a link to a detail route.

### #49 — stale channel callbacks overwrite a rapid retune

`TvShowreel` now records the requested channel independently from the last painted channel. Each transition receives a monotonically increasing epoch; both delayed GSAP commits and `video.play()` promise results must still own the current epoch before they can change state. This covers A → B → A, A → B → C, and callbacks settling after unmount.

### #61 — reduced motion still builds pinned choreography

Reduced motion now selects a static, vertically flowing reading layout. The hero scrub, pinned story/gallery, television pin and camera dive are not created in that mode. Touch row preview uses a small `IntersectionObserver` band rather than a scrubbed animation. Automatic preview autoplay is disabled; explicit play remains available. Contact choreography and the Three.js booth's idle motion also honor the preference, including changes while the page is open. A policy module keeps the chosen behavior set explicit and unit-tested.

The story images remain available in an accessible, horizontally scrollable gallery, and the prose is in ordinary document flow. The theater can still be opened intentionally, but its camera transition resolves immediately.

### #18 — distinct accessibility gaps

The overlapping video/reduced-motion items above are addressed by #53 and #61. This change also adds the still-distinct skip link, a focusable main landmark, an announcement for the decorative loading overlay, native keyboard focus visibility before React runs, and a forced-colors rule that hides the custom cursor rather than competing with system colors.

### #62 — preview resolver can crash or escape `out/`

Malformed percent-encoding now resolves to an ordinary miss; containment is segment-aware (`path.relative`) and canonical paths are checked so same-prefix siblings and outside symlinks cannot be served. The smoke test requests a malformed URL, then proves the server still serves the home page.

### #50 — booth loading races viewport and document visibility

The viewport and Page Visibility API are now one pause decision: the render loop runs only when both are visible. It starts pessimistically paused, receives the current combined state after async load, and cannot be resumed by a `visibilitychange` event while still off-screen. GLTF fetch/decode now completes before WebGL/PMREM allocation; if the React owner unmounts during fetch, no renderer is created. Both observers and the visibility listener are disposed with the component.

## Deliberately not applied from issue suggestions

- No process-wide `uncaughtException` handler was added. It would hide programming errors rather than handle the one expected input error; decoding is contained at the resolver boundary instead.
- `preview.mjs` continues to honor `HOST` (default `0.0.0.0`). The Arena live preview requires a server bound to all interfaces; local-only binding would break the preview contract. Users can still set `HOST` explicitly for their own environment.
- No work-row route navigation was introduced. The row remains the theater button, per the maintainer's direction.
- #66, #76, and #80 describe plausible performance regressions, but their reports explicitly lack browser traces or device measurements. They are deferred until profiling confirms the magnitude and identifies safe budgets.
- #65 is a valid supply-chain review, but blanket upgrades of Next/sharp are a separate compatibility change. `npm ci` currently reports advisories; they need advisory-by-advisory applicability review for a static export, not a claim that the deployed site is remotely exploitable. This batch does not silently upgrade the framework or image stack.

## Tests added

- `npm run test:interactions`: full/reduced motion policy, stale transition epochs, row playback readiness, stale play promises, glass geometry, localized copy, and the booth viewport/document visibility truth table.
- `npm run test:preview`: malformed escapes, raw/encoded traversal, mount boundaries, symlink containment, static directory indexes, and fail-closed behavior.
- `npm run smoke`: malformed URL survival, skip-link/main/status markup, a server-rendered native video row control, and existing root/sub-path export checks.

The tests are intentionally browser-free to keep CI deterministic. A final real-browser keyboard/reduced-motion/forced-colors pass is still useful before release; the repository's verify job checks compilation, unit contracts, export, and HTTP behavior.
