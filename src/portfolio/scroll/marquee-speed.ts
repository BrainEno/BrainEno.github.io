/** Convert scroll velocity into a bounded marquee playback multiplier. */
export function marqueeBoostFromVelocity(velocity: number): number {
  if (!Number.isFinite(velocity)) return 1;
  return 1 + Math.min(Math.abs(velocity) / 320, 5);
}
