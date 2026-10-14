// Profile has two places Mobi could stand: beside the name, and in the Look and feel card where he
// previews a setting. One Mobi per screen: while the card is on screen he is the card's, and the
// one beside the name steps aside (its space is kept, nothing moves).
let active = false;
const listeners = new Set();

export const setLookMobiActive = (next) => {
  if (next === active) return;
  active = next;
  listeners.forEach((fn) => fn());
};
export const subscribeLookMobi = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const lookMobiActive = () => active;
export const lookMobiServer = () => false;
