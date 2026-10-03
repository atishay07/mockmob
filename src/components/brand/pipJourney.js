// Ordered anchors with a deadband: callback ordering cannot reverse a handoff.
export function stationIndex(anchors, focus, current = 0, hysteresis = 32) {
  if (!anchors.length) return -1;
  let next = Math.max(0, Math.min(current, anchors.length - 1));
  while (next < anchors.length - 1 && focus > (anchors[next] + anchors[next + 1]) / 2 + hysteresis) next++;
  while (next > 0 && focus < (anchors[next - 1] + anchors[next]) / 2 - hysteresis) next--;
  return next;
}
export const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
