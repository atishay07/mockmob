// Eye boxes measured from the delivered WebPs: [left, top, width, height] in % of the art, one per
// eye. Only the open-eyed poses have them. A lid is drawn in the visor colour over the baked eye
// (a blink, or heavy lids when he is sleepy), so the raster itself is never stretched.
export const EYES = {
  greeting: [[35.6, 33.4, 7.6, 11.2], [59.6, 35.2, 8, 11.4]],
  pointing: [[30, 33.4, 7.4, 11], [50.6, 31.8, 6.8, 10.9]],
  encouraging: [[32.1, 33.1, 9, 12.3], [59.4, 31.3, 9.9, 11.4]],
  attentive: [[29.2, 33.2, 8.6, 11.6], [55.8, 35, 9.2, 10.4]],
};
