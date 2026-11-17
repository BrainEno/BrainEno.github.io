# Issue triage: television interaction, reduced motion, and preview safety

This change set takes only open issues with a concrete user-facing or reproducible failure. It does **not** treat every audit observation as a confirmed production incident.

## Selected work

### #53 — accessible television playback and work-row interaction

The TV keeps its localized Play/Pause `<button>` with `aria-pressed`, visible focus, a polite playback-status announcement, and keyboard activation. A click on the glass is delegated to that television control rather than to a raw `<video>` element.

The separate play/pause button that had been added beside video work rows has been removed at the maintainer's request. A work row remains a native keyboard-operable button that opens the on-page theater; the TV's own playback control remains available inside the theater. The pointer preview still follows the row and the glass without allowing a glass gesture to fall through to the row-open action during a channel transition.

**Interaction constraint:** a work row continues to open the on-page television theater. It is not a link to a detail route, and the list does not add a second playback control beside it.

### #54 — public section hashes with ScrollSmoother

`/#intro`, `/#works` and `/#contact` are resolved only after the preloader releases scrolling. The portfolio refreshes ScrollTrigger geometry and then calls its smoother-aware `scrollToSection`; later `hashchange` events use the same path. A browser back/forward restoration is left at its restored offset instead of being overwritten by a stale hash.

The older report's Contact top overlap and unreachable `top -4%` claims are stale: the current layout reserves top safe space and its entry timeline ends at the clamped reachable top. Responsive and visual behavior still needs a real viewport pass.

### #55 / #19 — scope-safe, bounded offline caches

The worker derives URLs/cache namespaces from its registration scope, precaches the canonical `/offline/` page in the page bucket and the icon in the static bucket. Updates wait for old documents to close instead of immediately controlling them; cache names are derived from exported bytes during `build:static`, and FIFO limits cap media at 60, pages at 20 and other static resources at 128. The static deployment has no `/api/media/*` route. A user-facing update toast and browser-level two-deployment/chunk test remain deferred.

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
- #76's two clear high-frequency allocation paths now have structural safeguards: scroll-driven pointer re-hit-testing is leading/trailing rate-limited to 100 ms and only runs in the work-row phase; marquee speed changes reuse prebuilt tweens and a single `scrollEnd` recovery listener. Deterministic contract tests cover scheduling and tween reuse. No browser trace or device measurement was available, so the size of any frame-time or battery improvement remains unverified.
- #80's one-shot reveals now live in a stable effect separate from the geometry choreography. Completed reveals retain terminal-state memory across language/resize rebuilds; reversible work/contact triggers are recreated at their final frame so their later reverse behavior remains available. Source/contract tests cover that lifecycle, but the reported visual no-flash acceptance still needs a browser run.
- #66 remains deferred: its layer-memory and off-screen CSS-animation claims need paint/layer inspection on target devices before removing composition hints or changing the booth animation policy.
- #65 remains a valid supply-chain review. On 2026-11-12, `npm ci` reported 10 advisories (7 moderate, 2 high, 1 critical); `npm audit --omit=dev` reported 3 (Next.js critical, PostCSS high, sharp high). Several Next advisories target runtime features absent from this static export, while sharp processes repository-controlled build inputs. A blanket dependency upgrade is still a separate compatibility/security change; this batch does not silently upgrade the framework or image stack.

## Tests added

- `npm run test:interactions`: full/reduced motion policy, stale TV transition epochs and play promises, glass geometry, localized TV-control copy, and the booth viewport/document visibility truth table.
- `npm run test:scroll`: bounded pointer hit-test scheduling, marquee tween reuse, and one-shot reveal lifecycle memory across choreography rebuilds.
- `npm run test:service-worker`: scope-derived cache isolation, canonical offline fallback, redirect caching, timeout behavior, and request filtering.
- `npm run test:art`: comment-aware artwork path extraction, traversal rejection, and proof that `npm run art` does not modify media.
- `npm run test:docs && npm run check:docs`: concrete source path checks plus current image, export, responsive-image and PWA documentation facts.
- `npm run test:preview`: malformed escapes, raw/encoded traversal, mount boundaries, symlink containment, static directory indexes, and fail-closed behavior.
- `npm run smoke`: malformed URL survival, skip-link/main/status markup, no extra work-row playback button, keyboard-operable theater buttons, and root/sub-path export checks.

The automated checks are intentionally browser-free to keep CI deterministic. A final real-browser keyboard/reduced-motion/forced-colors pass and the visual/performance verification called out in #76/#80 are still useful before release; the repository's verify job checks compilation, unit contracts, export, and HTTP behavior.
