// The rig table (data/mobi_rig.v2.json, the app's mobiRigSpec exported byte for byte) compiled once for
// the page. Everything that draws or moves Mobi reads this one book; the pure engines are in
// mobiRig.js (the table's rules) and mobiSim.js (time).
import spec from '@/../data/mobi_rig.v2.json';
import { createBook, createMoves } from './mobiRig.js';

export const book = createBook(spec);
export const moves = createMoves(book);
export { spec as rigSpec };
