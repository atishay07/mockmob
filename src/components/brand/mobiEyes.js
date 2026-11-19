// Eye boxes measured from the delivered WebPs: [left, top, width, height] in % of the art, one per
// eye. Only the open-eyed poses have them. A lid is drawn in the visor colour over the baked eye
// (a blink, or heavy lids when he is sleepy), so the raster itself is never stretched.
export const EYES = {
  greeting: [[35.6, 33.4, 7.6, 11.2], [59.6, 35.2, 8, 11.4]],
  pointing: [[30, 33.4, 7.4, 11], [50.6, 31.8, 6.8, 10.9]],
  encouraging: [[32.1, 33.1, 9, 12.3], [59.4, 31.3, 9.9, 11.4]],
  attentive: [[29.2, 33.2, 8.6, 11.6], [55.8, 35, 9.2, 10.4]],
  // 19 Nov 2026 (owner LK343: "replaced with static images, with no floating eyes"): the working poses the desktop guide
  // stands in had no boxes, so his eyes could not move in them. Measured from the WebPs (the cream ellipses on the visor,
  // tmp/1119-phone: a tight box, then the same small margin the four above carry).
  reading: [[28.7, 39.6, 7.7, 10.1], [51.3, 40.8, 8, 10]],
  camera: [[29.2, 41.2, 7.8, 10], [49.9, 41.7, 8, 10.5]],
  calendar: [[49.2, 39.2, 6.6, 10.1], [66.1, 41.4, 6.6, 10.1]],
};
