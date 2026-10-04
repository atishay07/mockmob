// Economics: original MockMob teaching, reconciled against NCERT Introductory Macroeconomics ch. 2
// (Reprint 2026-27): final/intermediate goods p.3-4, value added and depreciation p.9-10,
// nominal/real GDP and deflator p.21-22, non-monetary exchanges p.23.
import { unitBase, makeCard, choice, rupees } from './helpers.mjs';

const NCERT_MACRO = { id: 'ncert-macro-national-income', url: 'https://ncert.nic.in/textbook/pdf/leec102.pdf', label: 'NCERT Introductory Macroeconomics, ch. 2 National Income Accounting', permission: 'reference only; MockMob explanations and examples are original' };
const chapter = 'National Income & Related Aggregates';

// ---------- What GDP counts ----------
const gdpUnit = unitBase({
  subject: 'economics', chapter, conceptId: 'national_income', id: 'economics-what-gdp-counts', version: 1, order: 10,
  title: 'What GDP counts: final goods and value added', minutes: 7, skill: 'Classification',
  summary: 'Count each product once: final goods only, or the value each firm adds.',
  objectives: ['Classify a good as final or intermediate from how it is used', 'Calculate value added and avoid double counting', 'Separate gross and net value added', 'Recognise activity that GDP leaves out'],
  examLink: 'CUET Economics asks you to classify goods, calculate value added, and spot what national income misses.',
  sourceRefs: [NCERT_MACRO],
});
const chain = [{ who: 'Cotton farmer', output: 40, input: 0 }, { who: 'Spinner (buys cotton)', output: 70, input: 40 }, { who: 'Weaver (buys yarn)', output: 120, input: 70 }];
const vaVariant = (firm, output, input) => ({ type: 'numeric', prompt: `${firm} produces goods worth ${rupees(output)} and uses up inputs bought from other firms worth ${rupees(input)}. What is its value added (in ₹)?`, inputHint: 'Type the amount in rupees',
  answer: String(output - input), explanation: `Value added = value of output − intermediate goods used = ${rupees(output)} − ${rupees(input)} = ${rupees(output - input)}.`, calc: { op: 'value_added', output, input } });
const gvaVariant = (output, input, dep, ask) => ({ type: 'numeric', prompt: `A firm produces goods worth ${rupees(output)} in a year, uses intermediate goods worth ${rupees(input)}, and its machines wear out by ${rupees(dep)}. What is its ${ask === 'gross' ? 'gross' : 'net'} value added (in ₹)?`, inputHint: 'Type the amount in rupees',
  answer: String(ask === 'gross' ? output - input : output - input - dep), explanation: `Gross value added = ${rupees(output)} − ${rupees(input)} = ${rupees(output - input)}. Net value added also subtracts depreciation: ${rupees(output - input)} − ${rupees(dep)} = ${rupees(output - input - dep)}.`, calc: { op: ask === 'gross' ? 'gva' : 'nva', output, input, dep } });
const usageVariant = (text, final, why, wrong) => choice(`${text}. In GDP, is this a final good or an intermediate good?`, ['Final good', 'Intermediate good'], final ? 0 : 1, why, { optionNotes: final ? [null, wrong] : [wrong, null] });
const countedVariant = (text, counted, why) => choice(`${text}. Is it counted in GDP as usually measured?`, ['Counted', 'Not counted'], counted ? 0 : 1, why, { optionNotes: counted ? [null, 'It is produced and sold for money in the period, so it is measured.'] : ['No money changes hands, so it is not registered as economic activity.', null] });
gdpUnit.blocks = [
  { id: 'gdp-what', type: 'reading', kind: 'explanation', title: 'GDP adds up final goods, measured in money',
    body: 'Final goods are not transformed any further: consumption goods for households and capital goods such as machines that firms keep using. Intermediate goods are inputs used up in making something else, such as steel sheets for cars or copper for utensils. Money is the common measuring rod, because tonnes of rice and metres of cloth cannot be added directly.' },
  { id: 'gdp-double', type: 'reading', kind: 'explanation', title: 'Why intermediate goods are left out',
    body: 'The price of a final good already includes the inputs that went into it. Counting the inputs separately as well would count them twice — the error called double counting.' },
  { id: 'gdp-chain', type: 'reading', kind: 'worked_example', title: 'Value added: count each firm’s own contribution',
    body: `Add up every firm’s output and you get ${rupees(chain.reduce((s, f) => s + f.output, 0))} — too much, because cotton and yarn are counted again inside the cloth. Count only value added (output − inputs bought): ${chain.map(f => rupees(f.output - f.input)).join(' + ')} = ${rupees(chain.reduce((s, f) => s + f.output - f.input, 0))}, exactly the value of the final cloth.`,
    rows: [['Firm', 'Output', 'Inputs bought', 'Value added'], ...chain.map(f => [f.who, rupees(f.output), rupees(f.input), rupees(f.output - f.input)]), ['Total', '', '', rupees(chain.reduce((s, f) => s + f.output - f.input, 0))]],
    calc: { op: 'value_chain', chain: chain.map(({ output, input }) => ({ output, input })), expect: '120' } },
  { id: 'gdp-gross-net', type: 'reading', kind: 'explanation', title: 'Gross or net: what happens to wear and tear',
    body: 'Machines wear out as they are used. This wear and tear is depreciation, also called consumption of fixed capital. Gross value added includes it; net value added subtracts it.',
    formula: 'Gross value added = Output − Intermediate goods · Net value added = Gross value added − Depreciation' },
  { id: 'gdp-missing', type: 'reading', kind: 'mistake', title: 'What GDP misses',
    body: 'Activity that is not exchanged for money is not registered: domestic work done at home without pay, and barter exchanges where goods are swapped directly. GDP therefore underestimates such activity. That is one reason GDP is not a complete measure of welfare.' },
  { id: 'gdp-check-use', type: 'choice', kind: 'knowledge_check', title: 'Try it', prompt: 'Flour bought by a bakery and used up in making bread this year is…', options: ['An intermediate good', 'A final good', 'A capital good', 'Not part of production'], answer: 0,
    optionNotes: [null, 'The flour is transformed into bread, so it is not final.', 'Capital goods are kept and used over years; flour is used up.', 'It is produced, but its value reaches GDP through the bread.'], explanation: 'It is used up as an input, so its value is already inside the bread. This is an unscored learning check.' },
  { id: 'gdp-check-va', ...vaVariant('A bakery', 300, 120), kind: 'knowledge_check', title: 'Calculate value added' },
];
const gdpCards = [
  makeCard(gdpUnit, { id: 'economics-gdp-final-intermediate', objective: 'Classify by use, not by the product’s name', title: 'Final or intermediate', cue: 'Ask: is it used up to make something else this period?', variants: [
    usageVariant('Steel sheets bought by a car maker and used up making cars', false, 'They are inputs transformed into cars, so they are intermediate.', 'The steel is transformed into cars, so it is not final.'),
    usageVariant('A machine bought by a factory to use for many years', true, 'Capital goods are final goods: they are not transformed into the output.', 'The machine is not used up in one round of production; it is a capital good.'),
    usageVariant('Bread bought by a household for its meals', true, 'It reaches its final user and is not transformed further.', 'No further production uses it, so it is final.'),
    usageVariant('Copper bought by a firm to make utensils', false, 'It is a material input used up in making utensils.', 'The copper becomes part of the utensils, so it is intermediate.'),
  ] }),
  makeCard(gdpUnit, { id: 'economics-gdp-value-added', objective: 'Calculate value added', title: 'Value added', cue: 'Output minus inputs bought from other firms.', variants: [vaVariant('A tailoring firm', 900, 550), vaVariant('A furniture maker', 2400, 1500), vaVariant('A juice company', 650, 260)] }),
  makeCard(gdpUnit, { id: 'economics-gdp-gross-net', objective: 'Separate gross and net value added', title: 'Gross and net value added', cue: 'Net = gross − depreciation.', variants: [gvaVariant(500, 200, 30, 'net'), gvaVariant(800, 350, 50, 'gross'), gvaVariant(1200, 700, 80, 'net')] }),
  makeCard(gdpUnit, { id: 'economics-gdp-double-counting', objective: 'Explain why only final goods count', title: 'Why only final goods count', cue: 'The final price already contains the inputs.', variants: [
    { type: 'reveal', prompt: 'Why does GDP leave out intermediate goods?', answer: 'Their value is already included in the final goods; counting them again would be double counting.', explanation: 'Value added gives the same total without counting any input twice.' },
    choice('Adding every firm’s total output in a production chain would…', ['Count inputs more than once and overstate production', 'Understate production', 'Give the same total as value added', 'Measure only capital goods'], 0, 'Each input’s value appears again inside the next firm’s output.', { optionNotes: [null, 'It overstates, because inputs are counted again.', 'Value added removes the repeated inputs, so the totals differ.', 'Output totals include consumption goods too.'] }),
  ] }),
  makeCard(gdpUnit, { id: 'economics-gdp-counted', objective: 'Recognise what GDP leaves out', title: 'Counted in GDP or not', cue: 'No money exchanged: not registered.', variants: [
    countedVariant('Cooking and cleaning done at home without payment', false, 'Unpaid domestic work is a non-monetary activity, so GDP does not register it.'),
    countedVariant('Two farmers swap rice for vegetables without using money', false, 'Barter exchanges are not registered as economic activity.'),
    countedVariant('Bread produced by a bakery and sold to households this year', true, 'It is a final good produced and sold for money in the period.'),
  ] }),
];

// ---------- Nominal and real GDP ----------
const realUnit = unitBase({
  subject: 'economics', chapter, conceptId: 'nominal_real', id: 'economics-nominal-real', version: 1, order: 20,
  title: 'Nominal GDP, real GDP and the deflator', minutes: 7, skill: 'Calculation',
  summary: 'Separate a change in production from a change in prices.',
  objectives: ['Calculate nominal and real GDP from quantities and prices', 'Calculate and interpret the GDP deflator', 'Explain why real GDP is used for comparison'],
  examLink: 'CUET questions give two of nominal GDP, real GDP and the deflator and ask for the third, or ask what a change means.',
  sourceRefs: [NCERT_MACRO],
});
const example = { q0: 200, p0: 20, q1: 220, p1: 25 };
const nominal1 = example.q1 * example.p1, real1 = example.q1 * example.p0, deflator1 = nominal1 * 100 / real1;
const deflatorVariant = (nominal, real) => ({ type: 'numeric', prompt: `Nominal GDP is ${rupees(nominal)} crore and real GDP is ${rupees(real)} crore. What is the GDP deflator (as an index, base = 100)?`, inputHint: 'Type a number',
  answer: String(nominal * 100 / real), explanation: `Deflator = nominal ÷ real × 100 = ${nominal} ÷ ${real} × 100 = ${nominal * 100 / real}.`, calc: { op: 'deflator', nominal, real } });
const realVariant = (nominal, deflator) => ({ type: 'numeric', prompt: `Nominal GDP is ${rupees(nominal)} crore and the GDP deflator is ${deflator}. What is real GDP (in ₹ crore)?`, inputHint: 'Type the amount',
  answer: String(nominal * 100 / deflator), explanation: `Real GDP = nominal ÷ deflator × 100 = ${nominal} ÷ ${deflator} × 100 = ${nominal * 100 / deflator}.`, calc: { op: 'real_gdp', nominal, deflator } });
const fromQuantities = (q, p, base, ask) => ({ type: 'numeric', prompt: `A country produces only notebooks. This year it makes ${q} notebooks at ₹${p} each. In the base year a notebook cost ₹${base}. What is this year’s ${ask} GDP (in ₹)?`, inputHint: 'Type the amount in rupees',
  answer: String(q * (ask === 'nominal' ? p : base)), explanation: ask === 'nominal' ? `Nominal GDP uses current prices: ${q} × ₹${p} = ${rupees(q * p)}.` : `Real GDP uses base-year prices: ${q} × ₹${base} = ${rupees(q * base)}.`, calc: { op: ask === 'nominal' ? 'nominal_q' : 'real_q', q, p, base } });
realUnit.blocks = [
  { id: 'real-problem', type: 'reading', kind: 'explanation', title: 'A bigger GDP number is not always more production',
    body: 'If GDP measured at this year’s prices doubles, production might have doubled — or prices alone might have doubled while output stayed the same. To compare years, or countries, we need a measure that holds prices fixed.' },
  { id: 'real-definitions', type: 'reading', kind: 'contrast', title: 'Nominal and real',
    rows: [['', 'Nominal GDP', 'Real GDP'], ['Prices used', 'Current year’s prices', 'Constant base-year prices'], ['Changes when', 'Output or prices change', 'Only output changes'], ['Use it to', 'Know today’s money value', 'Compare production over time']] },
  { id: 'real-worked', type: 'reading', kind: 'worked_example', title: 'Notebook country',
    body: `Base year: ${example.q0} notebooks at ₹${example.p0}. This year: ${example.q1} notebooks at ₹${example.p1}. Nominal GDP = ${example.q1} × ₹${example.p1} = ${rupees(nominal1)}. Real GDP = ${example.q1} × ₹${example.p0} = ${rupees(real1)}. Deflator = ${nominal1} ÷ ${real1} × 100 = ${deflator1}: prices are ${deflator1 / 100} times the base year.`,
    rows: [['Measure', 'Working', 'Value'], ['Nominal GDP', `${example.q1} × ₹${example.p1}`, rupees(nominal1)], ['Real GDP', `${example.q1} × ₹${example.p0}`, rupees(real1)], ['GDP deflator', `${nominal1} ÷ ${real1} × 100`, String(deflator1)]],
    calc: { op: 'deflator', nominal: nominal1, real: real1, expect: String(deflator1) } },
  { id: 'real-formulas', type: 'reading', kind: 'steps', title: 'Two formulas, rearranged',
    steps: ['GDP deflator = Nominal GDP ÷ Real GDP × 100', 'Real GDP = Nominal GDP ÷ GDP deflator × 100', 'A deflator of 100 means current prices equal base-year prices.'] },
  { id: 'real-mistake', type: 'reading', kind: 'mistake', title: 'Reading the deflator',
    body: 'A deflator of 125 does not mean production rose 25%. It means the price level is 1.25 times the base year’s. Output change is read from real GDP.' },
  { id: 'real-check-deflator', ...deflatorVariant(6000, 5000), kind: 'knowledge_check', title: 'Try it' },
  { id: 'real-check-real', ...realVariant(9000, 150), kind: 'knowledge_check', title: 'Rearrange it' },
];
const realCards = [
  makeCard(realUnit, { id: 'economics-real-deflator', objective: 'Calculate the GDP deflator', title: 'GDP deflator', cue: 'Nominal over real, times 100.', variants: [deflatorVariant(4400, 4000), deflatorVariant(7500, 6000), deflatorVariant(3600, 4000)] }),
  makeCard(realUnit, { id: 'economics-real-gdp', objective: 'Calculate real GDP from nominal and the deflator', title: 'Real GDP from the deflator', cue: 'Divide by the deflator, then × 100.', variants: [realVariant(5000, 125), realVariant(8800, 110), realVariant(4800, 80)] }),
  makeCard(realUnit, { id: 'economics-real-quantities', objective: 'Use the right prices for each measure', title: 'Nominal or real from quantities', cue: 'Nominal: today’s prices. Real: base-year prices.', variants: [fromQuantities(300, 15, 12, 'real'), fromQuantities(150, 40, 30, 'nominal'), fromQuantities(500, 9, 10, 'real')] }),
  makeCard(realUnit, { id: 'economics-real-interpret', objective: 'Interpret changes correctly', title: 'What a change means', cue: 'Real moves only with output; the deflator moves with prices.', variants: [
    choice('Nominal GDP rose this year but real GDP did not change. What happened?', ['Prices rose; production stayed the same', 'Production rose; prices stayed the same', 'Both production and prices fell', 'The base year changed'], 0, 'Real GDP holds prices fixed, so an unchanged real GDP means unchanged production; the rise came from prices.', { optionNotes: [null, 'Then real GDP would have risen.', 'Nominal GDP would not rise if both fell.', 'Nothing in the question says the base year changed.'] }),
    choice('The GDP deflator is 125. What does it tell you?', ['The price level is 1.25 times the base year’s', 'Production rose 25%', 'Real GDP is 125', 'Prices fell 25%'], 0, 'The deflator is an index of prices relative to the base year.', { optionNotes: [null, 'Production changes are read from real GDP, not the deflator.', 'The deflator is an index, not real GDP.', 'Above 100 means prices are higher, not lower.'] }),
  ] }),
  makeCard(realUnit, { id: 'economics-real-definition', objective: 'Recall the definitions', title: 'Nominal and real GDP', cue: 'Real = constant prices.', variants: [
    { type: 'reveal', prompt: 'What prices does real GDP use?', answer: 'Constant prices of a chosen base year', explanation: 'Because prices are fixed, a change in real GDP reflects a change in the volume of production.' },
    choice('Which measure should you use to compare production between two years?', ['Real GDP', 'Nominal GDP', 'The GDP deflator', 'Either; they always move together'], 0, 'Real GDP removes the effect of price changes.', { optionNotes: [null, 'Nominal GDP also moves with prices.', 'The deflator measures prices, not production.', 'They move apart whenever prices change.'] }),
  ] }),
];

export const economics = { units: [gdpUnit, realUnit], cards: [...gdpCards, ...realCards] };
