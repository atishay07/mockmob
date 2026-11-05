// The dated price comparison on the home page's #pricing (R3-D8, owner LK111, 5 Nov 2026: "show that on platform X you pay 5,500
// for this. Meanwhile on our platform, you say this much"). Every rival figure here was read on the platform's own page on
// 5 Nov 2026 (IST) and is copied from the research, never rounded or estimated:
//   tmp-night/r3-research/ALL.md, prices P3 (Adda247) and P4 (Oswaal360), preparoo B6 (Preparoo, prp-390-light/report.json).
// Rules (spec R3-D8, owner UI standards): sale price as listed, never an MRP or a struck price; every row carries its platform,
// product, page and the read date; the page prints "Prices as listed on each platform's page, 5 Nov 2026" with the sources in
// a disclosure; MockMob's own row is computed from the offer over the same period (src/lib/payments/value.mjs proToExam);
// nothing ever says "cheapest". Prices change: re-read every page before this is shown again after a price review, and update
// readOn with the rows. data/tests/pricing_value_1105.test.mjs holds these rules.
// Pure: no imports.

export const PRICE_COMPARISON = Object.freeze({
  readOn: '2026-11-05',
  readOnLabel: '5 Nov 2026',
  // The period every row is set against: to CUET UG 2027, planned for May 2027 (the month the all-access course's own access ends).
  exam: Object.freeze({ year: 2027, month: 5 }),
  rows: Object.freeze([
    Object.freeze({
      id: 'all-access',
      what: 'An all-access CUET course',
      gets: 'Notes, flashcards and 100+ full mocks, up to 5 subjects',
      pricePaise: 549900,
      term: 'once, access until May 2027',
      platform: 'Preparoo',
      product: 'CUET All Access',
      url: 'https://ug.preparoo.app/',
      readOn: '2026-11-05',
    }),
    Object.freeze({
      id: 'science-series',
      what: 'A science mock series',
      gets: '23 full mocks among 298 tests',
      pricePaise: 116800,
      term: 'once, valid 9 months',
      platform: 'Adda247',
      product: 'CUET UG 2027 Science ACE Mock Test Series',
      url: 'https://www.adda247.com/product-testseries/93065/cuet-ug-2027-science-ace-mock-test-series-biology-physics-chemistry-maths-gat-english-and-hindi-online-test-series-by-adda-247',
      readOn: '2026-11-05',
    }),
    Object.freeze({
      id: 'subject-packs',
      what: 'Per-subject mock packs',
      gets: '3 full mocks in each pack',
      pricePaise: 9900,
      term: 'a subject, validity not stated',
      platform: 'Oswaal360',
      product: 'CUET Exclusive Online Mock Tests, one pack per subject',
      url: 'https://www.oswaal360.com/mod/page/view.php?id=24791',
      readOn: '2026-11-05',
    }),
  ]),
});

/** "ug.preparoo.app": the page a source was read on, as the disclosure prints it. */
export const sourceHost = (url) => new URL(url).host.replace(/^www\./, '');
