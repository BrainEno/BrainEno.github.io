/**
 * Combine independent visibility signals for the telephone-booth renderer.
 * The viewport observer and Page Visibility API describe different things;
 * neither is allowed to resume rendering while the other still says hidden.
 */
export function shouldPauseBooth(viewportVisible: boolean, documentVisible: boolean): boolean {
  return !viewportVisible || !documentVisible;
}

/** Keep hand-authored spin only when motion is allowed; zero disables bob too. */
export function boothSpinRate(reducedMotion: boolean, requestedSpin: number): number {
  return reducedMotion ? 0 : requestedSpin;
}
