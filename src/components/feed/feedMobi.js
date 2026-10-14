// One Mobi in the Explore stream: only the question answered most recently shows him. Answering a
// new card hands him over, so a long scroll of answered cards never turns into a crowd of Mobis.
let owner = null;
const listeners = new Set();

export const claimFeedMobi = (id) => { owner = id; listeners.forEach((fn) => fn()); };
export const subscribeFeedMobi = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const feedMobiOwner = () => owner;
export const feedMobiServerOwner = () => null;
