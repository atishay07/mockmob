// The live home's own parts, as /home-next reuses them: one list, so the page's imports read as the sections it draws.
// Nothing here is changed or wrapped; each line re-exports a component of src/components/landing (or the brand folder)
// exactly as src/app/page.js imports it. Every one of them draws with the home sheet (src/app/home-sheets.css), which
// src/app/home-next/page.js imports after marketing.css, as "/" does (data/tests/home_next_1120.test.mjs holds that).
export { BrandTexture, PageGrid } from '../landing/BrandTexture';
export { CloseActions } from '../landing/CloseActions';
export { CollegeStrip } from '../landing/CollegeStrip';
export { default as CompassLadder } from '../landing/CompassLadder';
export { default as CreatorReels } from '../landing/CreatorReels';
export { DemoDrill } from '../landing/DemoDrill';
export { DemoJump } from '../landing/DemoJump';
export { default as DesktopCursor } from '../landing/DesktopCursor';
export { DesktopNote } from '../landing/DesktopNote';
export { HashSettle } from '../landing/HashSettle';
export { default as HeroBeatStrip } from '../landing/HeroBeatStrip';
export { HeroDockGate } from '../landing/HeroDockGate';
export { default as HeroFilm } from '../landing/HeroFilm';
export { default as HeroMark } from '../landing/HeroMark';
export { default as HeroMobi } from '../landing/HeroMobi';
export { HeroProof } from '../landing/HeroProof';
export { HeroRoom } from '../landing/HeroRoom';
export { default as HeroTyped } from '../landing/HeroTyped';
export { HomeFonts } from '../landing/HomeFonts';
export { HomePricing } from '../landing/HomePricing';
export { LandingDock } from '../landing/LandingDock';
export { default as MobiCompanion } from '../landing/MobiCompanion';
export { MobiPoster } from '../landing/MobiPoster';
export { default as OpeningMo } from '../landing/OpeningMo';
export { default as AskMobiSheet } from '../landing/AskMobiSheet';
export { Reveal } from '../landing/Reveal';
export { default as PipGuide } from '../brand/PipGuideLazy';
