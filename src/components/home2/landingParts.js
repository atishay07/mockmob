// The live home's sections that draw only with the home sheet (src/app/home-sheets.css), as /home-next imports them. Each
// line re-exports a component of src/components/landing exactly as src/app/page.js imports it, by relative path:
// data/tests/css_split.test.mjs guards the '@/' form of these imports for pages that would draw them without the home sheet,
// and src/app/home-next/page.js imports that sheet after marketing.css, as "/" does (data/tests/home_next_1120.test.mjs).
export { CloseActions } from '../landing/CloseActions';
export { default as CreatorReels } from '../landing/CreatorReels';
export { DemoDrill } from '../landing/DemoDrill';
export { HeroDockGate } from '../landing/HeroDockGate';
export { default as LabCinema } from '../landing/LabCinema';
