import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import { createClient } from '@supabase/supabase-js';
import { CANONICAL_SYLLABUS, getCanonicalChapters, isValidCanonicalChapter } from '../../../data/canonical_syllabus.js';
import { toInternalSubjectId, validateTraceability } from '../../../data/cuet_controls.js';
import { evaluateGeneratedQuestionAnswerGuard, scoreAnswerLocalConfidence } from '../../../data/answer_integrity.js';
import { deduplicateAgainst, deduplicateBatch, getSimilarity } from './dedupe.mjs';
import { getStemShape, runSelfCheck, summarizeSelfCheckResults } from './selfCheck.mjs';
import { publicationEligibility } from '../../../data/evidence_registry.js';

try {
  loadEnvFile('.env.local');
} catch {
  // Offline scripts can also receive environment through the parent process.
}

try {
  const systemCertificates = getCACertificates('system');
  if (systemCertificates.length > 0) {
    setDefaultCACertificates([...getCACertificates('default'), ...systemCertificates]);
  }
} catch {
  // Node --use-system-ca remains a fallback on runtimes without TLS CA helpers.
}

const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const ALLOWED_RAW_TYPES = new Set([
  'statement_based',
  'assertion_reason',
  'application_based',
  'case_based',
  'comparison_based',
  'match_the_following',
  'simple_numerical',
]);

const DEFAULT_ROUTE = Object.freeze({
  subject: 'Economics',
  subjectId: 'economics',
  chapter: 'Money & Banking',
  quality: 'balanced',
});

const REPORT_FILE_NAMES = Object.freeze({
  normalized: 'normalized_candidates.json',
  schemaErrors: 'schema_errors.json',
  alignment: 'alignment_results.json',
  selfcheck: 'selfcheck_results.json',
  validator: 'validator_results.json',
  realValidationSample: 'real_validation_sample_results.json',
  accepted: 'accepted_candidates.json',
  rejected: 'rejected_candidates.json',
  import: 'import_results.json',
});

const MONEY_KEYWORDS = [
  'money', 'bank', 'banking', 'currency', 'deposit', 'deposits', 'demand deposit',
  'm1', 'm2', 'm3', 'cash', 'reserve', 'crr', 'slr', 'repo', 'reverse repo',
  'monetary', 'central bank', 'rbi', 'credit', 'liquidity', 'legal tender',
  'high powered money', 'money multiplier', 'commercial bank',
];

const WRONG_CHAPTER_SIGNALS = [
  'fiscal deficit', 'budget deficit', 'government budget', 'tax revenue',
  'national income', 'gdp', 'nnp', 'consumer equilibrium', 'marginal utility',
  'indifference curve', 'production function', 'average cost', 'balance of payments',
];

const META_CLASSIFICATION_PATTERNS = [
  /which comparison best captures/i,
  /belongs to money\s*&?\s*banking/i,
  /should be read through money,\s*credit,\s*liquidity/i,
  /a common error is to treat this area as separate from money\s*&?\s*banking/i,
  /linked to money\s*&?\s*banking/i,
  /compare the four explanations/i,
];

const MONETARY_TERMS = new Set([
  'money', 'bank', 'banks', 'banking', 'rbi', 'currency', 'deposit', 'deposits',
  'demand', 'time', 'm1', 'm2', 'm3', 'cash', 'reserve', 'reserves', 'crr', 'slr',
  'repo', 'reverse', 'monetary', 'credit', 'liquidity', 'legal', 'tender',
  'multiplier', 'lending', 'loan', 'loans', 'securities', 'omo', 'inflation',
  'policy', 'commercial', 'central', 'high', 'powered',
]);

const CONCEPTS = [
  {
    id: 'money_supply_components',
    label: 'Money Supply Components',
    core: 'M1 includes currency with the public, demand deposits with banks, and other deposits with the RBI',
    correct: 'M1 includes currency with the public, demand deposits with banks, and other deposits with the RBI because all are immediately spendable monetary assets.',
    misconceptions: [
      'M1 includes fixed deposits because all bank deposits are counted as immediately spendable money.',
      'M1 excludes demand deposits because cheques and digital transfers are not physical currency.',
      'M1 counts government cash holdings because all currency printed by the RBI is treated as public money.',
    ],
    trap: 'M1 excludes demand deposits because cheques and digital transfers are not physical currency.',
    note: 'Tests the narrow-money composition used in NCERT macroeconomics.',
  },
  {
    id: 'broad_money_m3',
    label: 'M3 Broad Money',
    core: 'M3 is broader than M1 because it adds time deposits with banks to the liquid components of M1',
    correct: 'M3 is broader than M1 because it adds time deposits with banks while retaining currency and demand-deposit components.',
    misconceptions: [
      'M3 is narrower than M1 because time deposits are less liquid than currency.',
      'M3 removes demand deposits because they are already included in commercial bank balance sheets.',
      'M3 is the same as high powered money because both are monetary aggregates.',
    ],
    trap: 'M3 is narrower than M1 because time deposits are less liquid than currency.',
    note: 'Keeps the distinction between liquidity and aggregate coverage clear.',
  },
  {
    id: 'legal_tender',
    label: 'Legal Tender',
    core: 'Legal tender is money that cannot be refused in settlement of debt within the legal framework',
    correct: 'Legal tender has compulsory acceptability for settling debt because law backs its use as money.',
    misconceptions: [
      'Legal tender means every store must accept cheques because cheques are bank money.',
      'Legal tender means money has intrinsic metal value because people trust coins more than deposits.',
      'Legal tender means any asset that stores value, including shares, can settle debt.',
    ],
    trap: 'Legal tender means every store must accept cheques because cheques are bank money.',
    note: 'Separates legal acceptability from common banking instruments.',
  },
  {
    id: 'demand_deposits',
    label: 'Demand Deposits',
    core: 'Demand deposits are accepted as money because they are withdrawable on demand and transferable by cheque or digital instruction',
    correct: 'Demand deposits act as money because they are payable on demand and can transfer purchasing power through banking instruments.',
    misconceptions: [
      'Demand deposits are not money because they do not exist as printed notes.',
      'Demand deposits are time deposits because the bank uses them to create loans.',
      'Demand deposits are central bank money because the RBI directly maintains household accounts.',
    ],
    trap: 'Demand deposits are not money because they do not exist as printed notes.',
    note: 'Connects bank deposits to medium-of-exchange function without overclaiming legal tender status.',
  },
  {
    id: 'commercial_bank_credit_creation',
    label: 'Commercial Bank Credit Creation',
    core: 'Commercial banks create credit by lending a part of deposits while keeping required reserves',
    correct: 'Credit is created when banks lend excess reserves and the loan returns to the banking system as new deposits.',
    misconceptions: [
      'Credit creation requires banks to lend the entire original deposit with no reserve kept aside.',
      'Credit creation means banks print currency notes after receiving fresh deposits.',
      'Credit creation happens only when the central bank directly gives cash to households.',
    ],
    trap: 'Credit creation requires banks to lend the entire original deposit with no reserve kept aside.',
    note: 'Uses the textbook deposit-loan-deposit chain at CUET level.',
  },
  {
    id: 'money_multiplier',
    label: 'Money Multiplier',
    core: 'The simple deposit multiplier is inversely related to the reserve ratio',
    correct: 'A lower required reserve ratio raises the simple money multiplier because a larger share of deposits can be lent again.',
    misconceptions: [
      'A lower reserve ratio reduces the multiplier because banks hold less cash for withdrawals.',
      'A higher reserve ratio raises the multiplier because reserves are safer than loans.',
      'The multiplier is unrelated to reserves because only the RBI can affect money supply.',
    ],
    trap: 'A higher reserve ratio raises the multiplier because reserves are safer than loans.',
    note: 'Tests reserve-ratio intuition rather than long derivation.',
  },
  {
    id: 'crr',
    label: 'Cash Reserve Ratio',
    core: 'CRR is the share of net demand and time liabilities kept by commercial banks as cash balance with the central bank',
    correct: 'A rise in CRR reduces lendable resources because banks must keep a larger cash balance with the RBI.',
    misconceptions: [
      'A rise in CRR increases lending because banks receive more interest from the RBI.',
      'CRR is the share of assets banks must hold in gold or approved securities.',
      'CRR directly changes government tax revenue because it is a budget instrument.',
    ],
    trap: 'CRR is the share of assets banks must hold in gold or approved securities.',
    note: 'Distinguishes CRR from SLR and fiscal tools.',
  },
  {
    id: 'slr',
    label: 'Statutory Liquidity Ratio',
    core: 'SLR requires banks to hold a prescribed share of liabilities in liquid assets such as cash, gold, or approved securities',
    correct: 'A higher SLR restricts credit expansion because more bank resources are locked in specified liquid assets.',
    misconceptions: [
      'A higher SLR expands credit because approved securities can always be lent to households.',
      'SLR is the cash balance that banks must keep only with the RBI.',
      'SLR is the interest rate at which the RBI lends overnight money to banks.',
    ],
    trap: 'SLR is the cash balance that banks must keep only with the RBI.',
    note: 'Separates SLR from CRR and repo rate.',
  },
  {
    id: 'repo_rate',
    label: 'Repo Rate',
    core: 'Repo rate is the rate at which the central bank lends short-term funds to commercial banks against securities',
    correct: 'A higher repo rate can reduce borrowing by banks and cool credit growth because RBI funds become costlier.',
    misconceptions: [
      'A higher repo rate makes bank borrowing cheaper and therefore raises credit growth.',
      'Repo rate is the rate banks pay households on savings deposits.',
      'Repo rate is a government tax rate used to finance budget expenditure.',
    ],
    trap: 'A higher repo rate makes bank borrowing cheaper and therefore raises credit growth.',
    note: 'Targets the transmission logic from policy rate to credit conditions.',
  },
  {
    id: 'reverse_repo_rate',
    label: 'Reverse Repo Rate',
    core: 'Reverse repo rate is the rate at which the central bank borrows from commercial banks',
    correct: 'A higher reverse repo rate can absorb liquidity because banks find it attractive to park surplus funds with the RBI.',
    misconceptions: [
      'A higher reverse repo rate injects liquidity because the RBI lends more to banks.',
      'Reverse repo rate is the rate households pay on consumer loans.',
      'Reverse repo rate is the legal minimum share of deposits kept as cash reserves.',
    ],
    trap: 'A higher reverse repo rate injects liquidity because the RBI lends more to banks.',
    note: 'Tests the direction of liquidity flow under reverse repo.',
  },
  {
    id: 'monetary_policy_inflation',
    label: 'Monetary Policy And Inflation',
    core: 'Contractionary monetary policy can reduce inflationary pressure by lowering credit and aggregate demand',
    correct: 'Raising policy rates or reserve requirements can reduce inflationary pressure by making credit costlier or less available.',
    misconceptions: [
      'Contractionary monetary policy controls inflation mainly by increasing government spending.',
      'Lowering CRR is contractionary because it makes banks keep fewer reserves.',
      'Inflation control through monetary policy works only by changing direct taxes.',
    ],
    trap: 'Lowering CRR is contractionary because it makes banks keep fewer reserves.',
    note: 'Keeps inflation control inside monetary, not fiscal, instruments.',
  },
  {
    id: 'central_bank_function',
    label: 'Central Bank Function',
    core: 'The central bank regulates money supply and credit conditions through policy instruments and banking supervision',
    correct: 'The central bank manages monetary stability by regulating currency, credit, reserves, and policy rates.',
    misconceptions: [
      'The central bank mainly maximises profit like a commercial bank by lending to retail customers.',
      'The central bank directly decides every household loan because commercial banks cannot lend independently.',
      'The central bank is responsible for preparing the Union Budget and collecting income tax.',
    ],
    trap: 'The central bank directly decides every household loan because commercial banks cannot lend independently.',
    note: 'Distinguishes central banking from commercial banking and fiscal authority.',
  },
  {
    id: 'lender_of_last_resort',
    label: 'Lender Of Last Resort',
    core: 'The central bank supports solvent banks facing temporary liquidity stress to prevent panic from spreading',
    correct: 'As lender of last resort, the RBI can provide liquidity support to banks facing temporary cash pressure.',
    misconceptions: [
      'Lender of last resort means the RBI guarantees profits of every commercial bank.',
      'Lender of last resort means the RBI gives direct consumption loans to all households.',
      'Lender of last resort means banks can ignore reserve requirements during normal times.',
    ],
    trap: 'Lender of last resort means banks can ignore reserve requirements during normal times.',
    note: 'Uses a banking-stability application without becoming current-affairs heavy.',
  },
  {
    id: 'bankers_bank',
    label: "Banker's Bank",
    core: 'The central bank acts as banker to commercial banks by holding reserves and providing settlement/liquidity facilities',
    correct: 'The RBI is a banker to banks because it holds bank reserves and supports interbank settlement and liquidity.',
    misconceptions: [
      'The RBI is a banker to banks because it opens savings accounts for all households.',
      'The RBI is a banker to banks because it replaces every commercial bank branch.',
      'The RBI is a banker to banks because it fixes the selling price of all goods.',
    ],
    trap: 'The RBI is a banker to banks because it opens savings accounts for all households.',
    note: 'Tests institutional role rather than a bare definition.',
  },
  {
    id: 'high_powered_money',
    label: 'High Powered Money',
    core: 'High powered money is monetary base: currency with the public plus reserves held by banks',
    correct: 'High powered money is the monetary base because currency and bank reserves support deposit expansion.',
    misconceptions: [
      'High powered money is the same as M3 because both include all bank time deposits.',
      'High powered money excludes bank reserves because reserves are not used by the public for payments.',
      'High powered money is only the profits of the central bank.',
    ],
    trap: 'High powered money excludes bank reserves because reserves are not used by the public for payments.',
    note: 'Connects monetary base to money creation.',
  },
  {
    id: 'open_market_operations',
    label: 'Open Market Operations',
    core: 'Open market operations change liquidity through central bank purchase or sale of government securities',
    correct: 'RBI purchase of government securities injects liquidity because it pays banks or the public for those securities.',
    misconceptions: [
      'RBI purchase of securities absorbs liquidity because securities move out of the market.',
      'Open market operations are changes in income tax rates.',
      'Open market operations mean commercial banks decide the legal tender status of currency.',
    ],
    trap: 'RBI purchase of securities absorbs liquidity because securities move out of the market.',
    note: 'Uses liquidity direction in OMO without drifting into government budget.',
  },
  {
    id: 'currency_with_public',
    label: 'Currency With The Public',
    core: 'Money supply measures include currency held by the public, not cash held by the government or banks as reserves',
    correct: 'Currency with the public is counted in money supply because it is available for spending outside the banking and government cash balances.',
    misconceptions: [
      'All currency issued by the RBI is counted as currency with the public, including cash in bank vaults.',
      'Currency with the public excludes coins because only paper notes count as money.',
      'Currency with the public means only digital balances held in savings accounts.',
    ],
    trap: 'All currency issued by the RBI is counted as currency with the public, including cash in bank vaults.',
    note: 'Targets a common aggregate-measurement mistake.',
  },
  {
    id: 'near_money_liquidity',
    label: 'Near Money And Liquidity',
    core: 'Time deposits are less liquid than demand deposits but are included in broader money aggregates',
    correct: 'Time deposits are less liquid than demand deposits, yet they enter broader money because they are monetary savings claims.',
    misconceptions: [
      'Time deposits are more liquid than demand deposits because they usually earn higher interest.',
      'Time deposits are excluded from every money aggregate because they cannot be used like cash instantly.',
      'Demand deposits are excluded from money because banks can use them for loans.',
    ],
    trap: 'Time deposits are excluded from every money aggregate because they cannot be used like cash instantly.',
    note: 'Tests liquidity ranking and aggregate inclusion together.',
  },
  {
    id: 'policy_rate_transmission',
    label: 'Policy Rate Transmission',
    core: 'Changes in policy rates influence bank lending rates, credit demand, and spending with a lag',
    correct: 'A repo-rate increase may reduce credit demand because banks often pass higher funding costs into lending rates.',
    misconceptions: [
      'A repo-rate increase immediately raises household income because deposits become legal tender.',
      'A repo-rate increase must increase credit demand because people borrow before rates rise further.',
      'Policy-rate transmission is unrelated to banks because only fiscal policy affects aggregate demand.',
    ],
    trap: 'A repo-rate increase must increase credit demand because people borrow before rates rise further.',
    note: 'Applies monetary transmission at a CUET-appropriate level.',
  },
  {
    id: 'reserve_leakages',
    label: 'Leakages In Credit Creation',
    core: 'Credit creation is limited by cash withdrawals, excess reserves, and required reserve ratios',
    correct: 'Cash withdrawals and excess reserves reduce credit creation because less of each deposit returns as lendable bank reserves.',
    misconceptions: [
      'Cash withdrawals increase credit creation because currency outside banks creates more deposits automatically.',
      'Excess reserves increase the maximum multiplier because banks lend less than the required minimum.',
      'Required reserves do not matter once the first loan is made.',
    ],
    trap: 'Cash withdrawals increase credit creation because currency outside banks creates more deposits automatically.',
    note: 'Adds a realistic limitation to the simple multiplier idea.',
  },
];

const NUMERICAL_CASES = [
  {
    template_id: 'deposit_multiplier',
    variants: [
      { reserve: 20, multiplier: 5, wrong: [4, 6, 20] },
      { reserve: 10, multiplier: 10, wrong: [5, 9, 11] },
    ],
  },
  {
    template_id: 'crr_lendable_change',
    variants: [
      { deposit: 1000, oldRate: 10, newRate: 20, correct: 100, wrong: [200, 900, 800] },
      { deposit: 2000, oldRate: 5, newRate: 10, correct: 100, wrong: [200, 1900, 1800] },
    ],
  },
  {
    template_id: 'new_deposit_credit_capacity',
    variants: [
      { deposit: 500, reserve: 20, correct: 400, wrong: [100, 500, 2500] },
      { deposit: 800, reserve: 25, correct: 600, wrong: [200, 800, 3200] },
    ],
  },
  {
    template_id: 'cash_reserve_required',
    variants: [
      { deposit: 1200, reserve: 15, correct: 180, wrong: [150, 1020, 1380] },
      { deposit: 600, reserve: 10, correct: 60, wrong: [540, 600, 66] },
    ],
  },
  {
    template_id: 'omo_liquidity_change',
    variants: [
      { amount: 500, action: 'purchases', correct: 500, wrong: [-500, 0, 1000] },
      { amount: 300, action: 'sells', correct: -300, wrong: [300, 0, -600] },
    ],
  },
];

const COMPARISON_CASES = [
  {
    concept: 'Repo Rate vs Reverse Repo Rate',
    stem: 'Compare repo rate and reverse repo rate in a banking liquidity situation. Which option is correct?',
    correct: 'Repo rate applies when banks borrow short-term funds from the RBI; reverse repo applies when banks park surplus funds with the RBI.',
    wrong1: 'Repo rate is paid by households on bank loans; reverse repo is paid by firms on working-capital loans.',
    wrong2: 'Repo rate absorbs liquidity from banks; reverse repo injects liquidity into banks in the same way as a fresh RBI loan.',
    wrong3: 'Repo and reverse repo are both reserve ratios that require banks to keep deposits idle.',
    note: 'Tests two close monetary-policy instruments through direction of funds.',
  },
  {
    concept: 'CRR vs SLR',
    stem: 'Compare CRR and SLR for a commercial bank that must follow both rules. Which option is most accurate?',
    correct: 'CRR is the cash balance kept with the RBI, while SLR is a required holding of liquid assets such as cash, gold, or approved securities.',
    wrong1: 'CRR is maintained as gold and securities, while SLR is maintained only as cash with the RBI.',
    wrong2: 'CRR is a policy interest rate, while SLR is the rate at which banks borrow from the RBI.',
    wrong3: 'CRR and SLR both mean the bank can lend the entire deposit base after reporting it to the RBI.',
    note: 'Targets the common CRR-SLR confusion.',
  },
  {
    concept: 'M1 vs M3',
    stem: 'Compare narrow money (M1) and broad money (M3). Which option correctly states the difference?',
    correct: 'M1 focuses on the most liquid components such as currency and demand deposits, while M3 adds time deposits to make a broader aggregate.',
    wrong1: 'M1 includes time deposits, while M3 excludes demand deposits because they are cheque-based money.',
    wrong2: 'M1 is the monetary base held by the RBI, while M3 is only government cash balance.',
    wrong3: 'M1 and M3 are identical because all bank deposits have the same liquidity.',
    note: 'Tests liquidity ranking and aggregate coverage.',
  },
  {
    concept: 'Legal Tender vs Bank Money',
    stem: 'Compare legal tender and bank money in a payment situation. Which distinction is correct?',
    correct: 'Currency has legal-tender status for settling debts, while demand deposits work as bank money through cheques or digital transfers.',
    wrong1: 'Demand deposits are legal tender in exactly the same way as currency notes and coins.',
    wrong2: 'Currency is not money unless it earns interest in a bank account.',
    wrong3: 'Bank money means only fixed deposits because they are safer than demand deposits.',
    note: 'Separates legal backing from bank-transfer money.',
  },
  {
    concept: 'OMO Purchase vs OMO Sale',
    stem: 'Compare an RBI open-market purchase with an open-market sale of government securities. Which liquidity effect is correct?',
    correct: 'A purchase injects liquidity because the RBI pays for securities; a sale absorbs liquidity because buyers pay funds to the RBI.',
    wrong1: 'A purchase absorbs liquidity because securities leave the market; a sale injects liquidity because securities enter the market.',
    wrong2: 'Both purchase and sale increase bank reserves by the same amount.',
    wrong3: 'Open market operations change only the maturity of securities and leave banking-system liquidity unchanged.',
    note: 'Tests direction of liquidity under OMO.',
  },
];

export function parseCliArgs(argv = process.argv.slice(2)) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const [rawKey, inlineValue] = token.slice(2).split(/=(.*)/s).filter((part) => part !== undefined);
    const key = rawKey.trim();
    if (!key) continue;
    if (inlineValue !== undefined) {
      result[key] = stripQuotes(inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = stripQuotes(next);
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export function generateOfflineQuestionFiles(options = {}) {
  const subject = String(options.subject || DEFAULT_ROUTE.subject).trim();
  const chapter = String(options.chapter || DEFAULT_ROUTE.chapter).trim();
  const quality = String(options.quality || DEFAULT_ROUTE.quality).trim().toLowerCase();
  const count = Number(options.count || 100);
  const batchSize = Number(options.batchSize || options['batch-size'] || 10);
  const outDir = resolve(String(options.out || 'data/offline_question_batches/economics_money_banking'));

  if (!Number.isInteger(count) || count <= 0) throw new Error('count must be a positive integer');
  if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error('batch-size must be a positive integer');
  if (count % batchSize !== 0) throw new Error('count must be divisible by batch-size');

  ensureDir(outDir);
  ensureDir(join(outDir, 'raw_batches'));

  const questions = buildOfflineQuestions({ subject, chapter, quality, count });
  const filePaths = [];
  const batches = count / batchSize;

  for (let batchIndex = 0; batchIndex < batches; batchIndex += 1) {
    const batchNumber = batchIndex + 1;
    const batchQuestions = questions.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    const payload = {
      metadata: {
        source: 'codex_offline_generation',
        subject,
        chapter,
        quality_mode: quality,
        batch_number: batchNumber,
        question_count: batchQuestions.length,
      },
      questions: batchQuestions,
    };
    const name = `batch_${String(batchNumber).padStart(3, '0')}.json`;
    const rootPath = join(outDir, name);
    const rawPath = join(outDir, 'raw_batches', name);
    writeJson(rootPath, payload);
    writeJson(rawPath, payload);
    filePaths.push(rootPath);
  }

  return {
    outDir,
    subject,
    chapter,
    quality,
    count,
    batchSize,
    batches,
    files: filePaths,
  };
}

export function buildOfflineQuestions({ subject = DEFAULT_ROUTE.subject, chapter = DEFAULT_ROUTE.chapter, quality = DEFAULT_ROUTE.quality, count = 100 } = {}) {
  const questions = [];
  for (let index = 0; index < count; index += 1) {
    const slot = index % 10;
    const batchIndex = Math.floor(index / 10);
    const conceptIndex = [0, 5].includes(slot)
      ? (batchIndex * 2) + (slot === 5 ? 1 : 0)
      : (index * 7) + batchIndex;
    const concept = CONCEPTS[conceptIndex % CONCEPTS.length];
    const cycle = Math.floor(index / CONCEPTS.length);
    const batchNumber = batchIndex + 1;
    const questionNumber = slot + 1;
    const localId = `economics_money_banking_batch_${String(batchNumber).padStart(3, '0')}_q${String(questionNumber).padStart(3, '0')}`;
    questions.push(buildRawQuestion({
      localId,
      subject,
      chapter,
      quality,
      concept,
      cycle,
      index,
    }));
  }
  return questions;
}

export async function validateOfflineQuestionBatch(options = {}) {
  const dir = resolve(String(options.dir || 'data/offline_question_batches/economics_money_banking'));
  const quality = String(options.quality || DEFAULT_ROUTE.quality).trim().toLowerCase();
  const batchFiles = listBatchFiles(dir);
  const rawEntries = loadRawEntries(batchFiles);
  const schemaErrors = [];
  const structurallyValid = [];
  const rejected = [];

  for (const entry of rawEntries) {
    const errors = validateRawQuestionSchema(entry.question, entry.payload?.metadata);
    if (errors.length > 0) {
      const record = { ...entryMeta(entry), stage: 'schema', reasons: errors };
      schemaErrors.push(record);
      rejected.push({ ...record, raw_question: entry.question });
    } else {
      structurallyValid.push(entry);
    }
  }

  const normalizedEntries = structurallyValid.map((entry) => {
    const alignment = alignOfflineQuestion(entry.question, {
      expectedSubject: entry.payload.metadata.subject,
      expectedChapter: entry.payload.metadata.chapter,
    });
    const candidate = normalizeRawQuestion(entry.question, alignment, quality);
    return { ...entry, candidate, alignment };
  });

  const alignmentResults = normalizedEntries.map((entry) => ({
    ...entryMeta(entry),
    chapter_alignment: entry.alignment.chapter_alignment,
    resolved_subject: entry.alignment.resolved_subject,
    resolved_chapter: entry.alignment.resolved_chapter,
    alignment_confidence: entry.alignment.alignment_confidence,
    alignment_reason: entry.alignment.alignment_reason,
    accepted_for_route: isAlignmentAccepted(entry.alignment, DEFAULT_ROUTE.chapter),
  }));

  const alignmentAccepted = [];
  for (const entry of normalizedEntries) {
    if (isAlignmentAccepted(entry.alignment, DEFAULT_ROUTE.chapter)) {
      alignmentAccepted.push(entry);
    } else {
      rejected.push({
        ...entryMeta(entry),
        stage: 'alignment',
        reasons: [entry.alignment.alignment_reason || entry.alignment.chapter_alignment],
        alignment: entry.alignment,
        raw_question: entry.question,
      });
    }
  }

  const selfCheckContext = buildSelfCheckContext(alignmentAccepted.map((entry) => entry.candidate));
  const selfcheckResults = alignmentAccepted.map((entry) => {
    const result = runSelfCheck(entry.candidate, selfCheckContext);
    return { ...entry, selfcheck: result };
  });

  const selfcheckAccepted = [];
  for (const entry of selfcheckResults) {
    if (entry.selfcheck.pass) {
      selfcheckAccepted.push({
        ...entry,
        candidate: {
          ...entry.candidate,
          selfcheck_passed: true,
          selfcheck_reasons: entry.selfcheck.reasons,
          selfcheck_distractor_quality: entry.selfcheck.distractor_quality,
          selfcheck_trap_quality: entry.selfcheck.trap_quality,
          selfcheck_obviousness_risk: entry.selfcheck.obviousness_risk,
          selfcheck_cuet_pattern: entry.selfcheck.cuet_pattern,
        },
      });
    } else {
      rejected.push({
        ...entryMeta(entry),
        stage: 'selfCheck',
        reasons: entry.selfcheck.reasons,
        selfcheck: entry.selfcheck,
        candidate: entry.candidate,
      });
    }
  }

  const templatePolicy = applyTemplatePolicy(selfcheckAccepted);
  for (const entry of templatePolicy.rejected) {
    rejected.push({
      ...entryMeta(entry),
      stage: 'template_policy',
      reasons: entry.templatePolicyReasons,
      candidate: entry.candidate,
    });
  }
  const templateAccepted = templatePolicy.accepted;

  const { unique: batchUnique, removed: batchDuplicates } = deduplicateBatch(templateAccepted.map((entry) => entry.candidate));
  const uniqueIds = new Set(batchUnique.map((candidate) => candidate.candidate_id));
  for (const entry of templateAccepted) {
    if (!uniqueIds.has(entry.candidate.candidate_id)) {
      rejected.push({
        ...entryMeta(entry),
        stage: 'dedupe',
        reasons: ['duplicate_within_batch'],
        candidate: entry.candidate,
      });
    }
  }
  const dedupedEntries = templateAccepted.filter((entry) => uniqueIds.has(entry.candidate.candidate_id));

  const validatorEntries = dedupedEntries.map((entry) => {
    const mini = runOfflineMiniValidator(entry.candidate, entry.alignment);
    const strictRequired = shouldRunOfflineStrictValidator(entry.candidate, mini, entry.alignment);
    const strict = strictRequired ? runOfflineStrictValidator(entry.candidate, mini, entry.alignment) : null;
    const finalValidation = strict || mini;
    const finalDecision = isFinalOfflineApproval(entry.candidate, finalValidation, entry.alignment, quality);
    return {
      ...entry,
      mini_validation: mini,
      strict_required: strictRequired,
      strict_validation: strict,
      final_validation: finalValidation,
      final_decision: finalDecision,
    };
  });

  const acceptedCandidates = [];
  for (const entry of validatorEntries) {
    const decorated = {
      ...entry.candidate,
      strict_cuet_validated: entry.final_decision.accepted,
      mini_validation: entry.mini_validation,
      strict_required: entry.strict_required,
      strict_validation: entry.strict_validation,
      final_validation: entry.final_validation,
      chapter_alignment: entry.alignment.chapter_alignment,
      resolved_subject: entry.alignment.resolved_subject,
      resolved_chapter: entry.alignment.resolved_chapter,
      alignment_confidence: entry.alignment.alignment_confidence,
      alignment_reason: entry.alignment.alignment_reason,
      offline_source_file: basename(entry.filePath),
    };
    if (entry.final_decision.accepted) {
      acceptedCandidates.push(decorated);
    } else {
      rejected.push({
        ...entryMeta(entry),
        stage: 'validator',
        reasons: entry.final_decision.reasons,
        mini_validation: entry.mini_validation,
        strict_validation: entry.strict_validation,
        candidate: decorated,
      });
    }
  }

  const normalizedCandidates = normalizedEntries.map((entry) => ({
    ...entry.candidate,
    chapter_alignment: entry.alignment.chapter_alignment,
    resolved_subject: entry.alignment.resolved_subject,
    resolved_chapter: entry.alignment.resolved_chapter,
    alignment_confidence: entry.alignment.alignment_confidence,
    alignment_reason: entry.alignment.alignment_reason,
    offline_source_file: basename(entry.filePath),
  }));

  const validatorResults = {
    quality_mode: quality,
    raw_count: rawEntries.length,
    schema_valid_count: structurallyValid.length,
    alignment_pass_count: alignmentAccepted.length,
    selfcheck_pass_count: selfcheckAccepted.length,
    batch_duplicate_count: batchDuplicates,
    mini_validator_sent_count: dedupedEntries.length,
    mini_validator_accepted_count: validatorEntries.filter((entry) => entry.mini_validation.verdict === 'accept').length,
    strict_validator_sent_count: validatorEntries.filter((entry) => entry.strict_required).length,
    strict_validator_accepted_count: validatorEntries.filter((entry) => entry.strict_required && entry.strict_validation?.verdict === 'accept').length,
    final_accepted_count: acceptedCandidates.length,
    final_rejected_count: rawEntries.length - acceptedCandidates.length,
    candidates: validatorEntries.map((entry) => ({
      candidate_id: entry.candidate.candidate_id,
      local_id: entry.question.local_id,
      mini_validation: entry.mini_validation,
      strict_required: entry.strict_required,
      strict_validation: entry.strict_validation,
      final_validation: entry.final_validation,
      final_decision: entry.final_decision,
    })),
  };

  const realSampleSize = Number(options.realSampleSize ?? 0);
  const realValidationSample = realSampleSize > 0
    ? await runRealValidationSample(acceptedCandidates, { sampleSize: realSampleSize, dir })
    : readJsonIfExists(join(dir, REPORT_FILE_NAMES.realValidationSample));

  writeJson(join(dir, REPORT_FILE_NAMES.normalized), normalizedCandidates);
  writeJson(join(dir, REPORT_FILE_NAMES.schemaErrors), schemaErrors);
  writeJson(join(dir, REPORT_FILE_NAMES.alignment), alignmentResults);
  writeJson(join(dir, REPORT_FILE_NAMES.selfcheck), {
    summary: summarizeSelfCheckResults(selfcheckResults.map((entry) => entry.selfcheck)),
    results: selfcheckResults.map((entry) => ({
      ...entryMeta(entry),
      pass: entry.selfcheck.pass,
      reasons: entry.selfcheck.reasons,
      distractor_quality: entry.selfcheck.distractor_quality,
      trap_quality: entry.selfcheck.trap_quality,
      obviousness_risk: entry.selfcheck.obviousness_risk,
      cuet_pattern: entry.selfcheck.cuet_pattern,
    })),
  });
  writeJson(join(dir, REPORT_FILE_NAMES.validator), validatorResults);
  if (realValidationSample) writeJson(join(dir, REPORT_FILE_NAMES.realValidationSample), realValidationSample);
  writeJson(join(dir, REPORT_FILE_NAMES.accepted), acceptedCandidates);
  writeJson(join(dir, REPORT_FILE_NAMES.rejected), rejected);

  const report = buildOfflineBatchReport({
    dir,
    quality,
    raw_count: rawEntries.length,
    schema_valid_count: structurallyValid.length,
    alignment_pass_count: alignmentAccepted.length,
    selfcheck_pass_count: selfcheckAccepted.length,
    mini_validator_accepted_count: validatorResults.mini_validator_accepted_count,
    strict_validator_accepted_count: validatorResults.strict_validator_accepted_count,
    final_accepted_count: acceptedCandidates.length,
    final_rejected_count: rejected.length,
    accepted_candidates: acceptedCandidates,
    rejected_candidates: rejected,
    validator_results: validatorResults,
    real_validation_sample: realValidationSample,
    import_results: readJsonIfExists(join(dir, REPORT_FILE_NAMES.import)),
  });
  writeOfflineBatchReport(dir, report);

  return {
    dir,
    rawEntries,
    schemaErrors,
    alignmentResults,
    selfcheckResults,
    validatorResults,
    realValidationSample,
    acceptedCandidates,
    rejectedCandidates: rejected,
    report,
  };
}

export async function importOfflineQuestionBatch(options = {}) {
  const dir = resolve(String(options.dir || 'data/offline_question_batches/economics_money_banking'));
  const quality = String(options.quality || DEFAULT_ROUTE.quality).trim().toLowerCase();
  const dryRun = options.dryRun === true || options['dry-run'] === true || String(process.env.OFFLINE_IMPORT_DRY_RUN || 'true').toLowerCase() === 'true';
  const writeRequested = options.write === true || options.dryRun === false;
  const allowWrite = String(process.env.OFFLINE_IMPORT_ALLOW_DB_WRITE || 'false').toLowerCase() === 'true';
  const acceptedPath = join(dir, REPORT_FILE_NAMES.accepted);

  if (!existsSync(acceptedPath)) {
    await validateOfflineQuestionBatch({ dir, quality });
  }

  const legacyAccepted = readJson(acceptedPath);
  const evidenceResults=readJsonIfExists(join(dir,'evidence_results.json')) || [];
  const checkedCandidates=evidenceResults.filter(r=>r.state==='eligible' && r.question).map(r=>r.question);
  // Item-level evidence replaces the old small-sample shortcut. Never transplant
  // a verdict onto normalized content: its signed hash must survive unchanged.
  const acceptedCandidates=checkedCandidates.filter(q=>publicationEligibility(q).eligible);
  const existing = await loadExistingDbQuestions(DEFAULT_ROUTE.subjectId, DEFAULT_ROUTE.chapter);
  const { unique, rejected: duplicateRows } = dedupeCandidatesWithReasons(acceptedCandidates, existing.questions);
  const passageChildRejects = unique.filter((candidate) => isPassageChild(candidate));
  const importable = unique.filter((candidate) => !isPassageChild(candidate));
  const blockedReasons = [];
  if(!evidenceResults.length)blockedReasons.push('item_evidence_missing');
  if(!acceptedCandidates.length)blockedReasons.push('no_publishable_item_evidence');
  if (writeRequested && !allowWrite) blockedReasons.push('OFFLINE_IMPORT_ALLOW_DB_WRITE_not_true');
  if (!writeRequested) blockedReasons.push('write_flag_not_passed');
  if (dryRun) blockedReasons.push('dry_run_enabled');
  const realValidationSample = readJsonIfExists(join(dir, REPORT_FILE_NAMES.realValidationSample));

  const importResults = {
    dir,
    quality_mode: quality,
    dry_run: dryRun || !writeRequested || !allowWrite || blockedReasons.length > 0,
    write_requested: writeRequested,
    allow_db_write: allowWrite,
    db_lookup: existing.meta,
    accepted_candidates_count: acceptedCandidates.length,
    legacy_heuristic_accepted_count: legacyAccepted.length,
    evidence_checked_count: checkedCandidates.length,
    db_duplicate_count: duplicateRows.length,
    passage_child_rejected_count: passageChildRejects.length,
    importable_count: importable.length,
    inserted_count: 0,
    skipped_count: acceptedCandidates.length - importable.length,
    blocked_reasons: blockedReasons,
    real_validation_sample: realValidationSample ? {
      status: realValidationSample.status,
      sample_size: realValidationSample.sample_size,
      accepted_count: realValidationSample.accepted_count,
      average_score: realValidationSample.average_score,
      average_distractor_quality: realValidationSample.average_distractor_quality,
    } : null,
    duplicate_rejections: duplicateRows,
    passage_child_rejections: passageChildRejects.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      reason: 'passage_child_cannot_import_standalone',
    })),
    inserted: [],
    failed: [],
  };

  if (writeRequested && allowWrite && !dryRun && blockedReasons.length === 0) {
    const { publishQuestion } = await import('./publish.mjs');
    for (const candidate of importable) {
      const result = await publishQuestion(candidate, process.env.INTERNAL_API_SECRET || 'offline-import', {
        expectedChapter: DEFAULT_ROUTE.chapter,
      });
      if (result.success) {
        importResults.inserted_count += 1;
        importResults.inserted.push({ candidate_id: candidate.candidate_id, question_id: result.id });
      } else {
        importResults.failed.push({ candidate_id: candidate.candidate_id, error: result.error || 'publish_failed' });
      }
    }
  }

  writeJson(join(dir, REPORT_FILE_NAMES.import), importResults);
  const rejectedCandidates = readJsonIfExists(join(dir, REPORT_FILE_NAMES.rejected)) || [];
  const validatorResults = readJsonIfExists(join(dir, REPORT_FILE_NAMES.validator)) || {};
  const report = buildOfflineBatchReport({
    dir,
    quality,
    accepted_candidates: importable,
    rejected_candidates: [
      ...rejectedCandidates,
      ...duplicateRows.map((row) => ({ stage: 'db_dedupe', reasons: [row.reason], ...row })),
      ...passageChildRejects.map((candidate) => ({ stage: 'import', reasons: ['passage_child_cannot_import_standalone'], candidate })),
    ],
    validator_results: validatorResults,
    real_validation_sample: realValidationSample,
    import_results: importResults,
  });
  writeOfflineBatchReport(dir, report);

  return { importResults, report };
}

export function buildOfflineBatchReport(input = {}) {
  const dir = resolve(String(input.dir || 'data/offline_question_batches/economics_money_banking'));
  const validator = input.validator_results || readJsonIfExists(join(dir, REPORT_FILE_NAMES.validator)) || {};
  const accepted = input.accepted_candidates || readJsonIfExists(join(dir, REPORT_FILE_NAMES.accepted)) || [];
  const rejected = input.rejected_candidates || readJsonIfExists(join(dir, REPORT_FILE_NAMES.rejected)) || [];
  const importResults = input.import_results || readJsonIfExists(join(dir, REPORT_FILE_NAMES.import)) || null;
  const realValidationSample = input.real_validation_sample || readJsonIfExists(join(dir, REPORT_FILE_NAMES.realValidationSample)) || null;
  const rawCount = Number(input.raw_count ?? validator.raw_count ?? countRawQuestions(dir));
  const finalAccepted = importResults ? Number(importResults.importable_count || 0) : Number(input.final_accepted_count ?? validator.final_accepted_count ?? accepted.length);
  const finalRejected = importResults
    ? Math.max(0, rawCount - finalAccepted)
    : Number(input.final_rejected_count ?? validator.final_rejected_count ?? rejected.length);
  const topReasons = topRejectionReasons(rejected);
  const avgScore = averageMetric(accepted, 'score');
  const avgDistractor = averageMetric(accepted, 'distractor_quality');
  const avgExam = averageMetric(accepted, 'exam_quality');
  const realSamplePassRate = realValidationSample?.sample_size > 0
    ? Number(realValidationSample.accepted_count || 0) / Number(realValidationSample.sample_size)
    : 0;
  const realSampleStrong = realValidationSample?.status === 'completed' &&
    realValidationSample.sample_size >= 20 &&
    realSamplePassRate >= 0.6 &&
    Number(realValidationSample.average_distractor_quality || 0) >= 0.7;
  const goodEnough = finalAccepted >= 30 &&
    avgScore >= 7.5 &&
    avgDistractor >= 7.0 &&
    realSampleStrong &&
    topReasons.every((entry) => !['wrong_chapter', 'meta_chapter_classification_stem', 'rationale_option_mismatch'].includes(entry.reason));

  return {
    generated_at: new Date().toISOString(),
    route: {
      subject: DEFAULT_ROUTE.subject,
      chapter: DEFAULT_ROUTE.chapter,
      quality_mode: input.quality || validator.quality_mode || DEFAULT_ROUTE.quality,
      directory: dir,
    },
    counts: {
      raw_questions: rawCount,
      schema_valid: Number(input.schema_valid_count ?? validator.schema_valid_count ?? 0),
      alignment_pass: Number(input.alignment_pass_count ?? validator.alignment_pass_count ?? 0),
      selfcheck_pass: Number(input.selfcheck_pass_count ?? validator.selfcheck_pass_count ?? 0),
      mini_validator_accepted: Number(input.mini_validator_accepted_count ?? validator.mini_validator_accepted_count ?? 0),
      strict_validator_accepted: Number(input.strict_validator_accepted_count ?? validator.strict_validator_accepted_count ?? 0),
      final_accepted: finalAccepted,
      final_rejected: finalRejected,
    },
    quality: {
      scoring_method: 'deterministic_heuristic_screen',
      heuristic_average_score: avgScore,
      heuristic_average_exam_quality: avgExam,
      heuristic_average_distractor_quality: avgDistractor,
      heuristic_average_answer_confidence: averageMetric(accepted, 'answer_confidence'),
      note: 'Heuristic scores are local screening scores, not real validator scores.',
    },
    real_validation_sample: realValidationSample,
    top_rejection_reasons: topReasons,
    cost_estimate: {
      generator: 'deterministic_codex_file_factory',
      external_llm_calls: realValidationSample?.status === 'completed' ? Number(realValidationSample.sample_size || 0) : 0,
      estimated_usd: estimateRealValidationCostUsd(realValidationSample),
    },
    import_results: importResults,
    recommendation: {
      good_enough_to_import: goodEnough,
      reason: goodEnough
        ? 'Heuristic screening passes and the real-validator sample is strong enough for review.'
        : 'Do not import yet; heuristic acceptance or real-validator sample evidence is below the requested threshold.',
      real_import_command: 'OFFLINE_IMPORT_ALLOW_DB_WRITE=true node scripts/pipeline/tools/importOfflineQuestionBatch.mjs --dir="data/offline_question_batches/economics_money_banking" --quality=balanced --write',
    },
  };
}

export function writeOfflineBatchReport(dir, report = buildOfflineBatchReport({ dir })) {
  const reportDir = join('logs', 'offline_batches', basename(resolve(dir)));
  ensureDir(reportDir);
  writeJson(join(reportDir, 'latest_report.json'), report);
  writeFileSync(join(reportDir, 'latest_report.md'), renderMarkdownReport(report), 'utf8');
  return {
    json: resolve(join(reportDir, 'latest_report.json')),
    markdown: resolve(join(reportDir, 'latest_report.md')),
  };
}

export function validateRawQuestionSchema(question, metadata = {}) {
  const errors = [];
  const required = [
    'local_id',
    'subject',
    'chapter',
    'question_type',
    'difficulty',
    'concept',
    'question_text',
    'options',
    'correct_option',
    'answer_explanation',
    'answer_check',
    'trap_option',
    'strong_distractors',
    'distractor_rationales',
    'pattern_tags',
    'ncert_alignment',
    'chapter_alignment_note',
    'why_this_is_cuet_level',
  ];
  for (const field of required) {
    if (question?.[field] == null || question[field] === '') errors.push(`missing_${field}`);
  }
  if (!ALLOWED_RAW_TYPES.has(String(question?.question_type || ''))) errors.push('invalid_question_type');
  if (!['easy', 'medium', 'hard'].includes(String(question?.difficulty || ''))) errors.push('invalid_difficulty');
  if (!question?.options || typeof question.options !== 'object' || Array.isArray(question.options)) {
    errors.push('invalid_options_object');
  } else {
    for (const key of OPTION_KEYS) {
      if (!String(question.options[key] || '').trim()) errors.push(`missing_option_${key}`);
      if (hasOffRouteDistractorText(question.options[key])) errors.push(`off_route_option_concept_${key}`);
    }
    const optionTexts = OPTION_KEYS.map((key) => normalizeComparable(question.options[key]));
    if (new Set(optionTexts).size !== 4) errors.push('duplicate_option_text');
    if (OPTION_KEYS.some((key) => hasMetaClassificationText(question.options[key]))) errors.push('meta_chapter_classification_option');
  }
  if (hasMetaClassificationText(question?.question_text)) errors.push('meta_chapter_classification_stem');
  if (hasMetaClassificationText(question?.answer_explanation) || hasMetaClassificationText(question?.answer_check)) {
    errors.push('meta_chapter_classification_explanation');
  }
  if (!OPTION_KEYS.includes(String(question?.correct_option || '').trim().toUpperCase())) errors.push('invalid_correct_option');
  if (!OPTION_KEYS.includes(String(question?.trap_option || '').trim().toUpperCase())) errors.push('invalid_trap_option');
  if (question?.trap_option && question.trap_option === question.correct_option) errors.push('trap_option_equals_answer');
  if (!Array.isArray(question?.strong_distractors) || question.strong_distractors.length < 2) errors.push('missing_two_strong_distractors');
  if (Array.isArray(question?.strong_distractors) && question.strong_distractors.includes(question?.correct_option)) errors.push('strong_distractor_points_to_answer');
  if (!question?.distractor_rationales || typeof question.distractor_rationales !== 'object') {
    errors.push('invalid_distractor_rationales');
  } else {
    for (const key of OPTION_KEYS) {
      if (!String(question.distractor_rationales[key] || '').trim()) errors.push(`missing_rationale_${key}`);
      if (question?.options?.[key] && question.distractor_rationales[key] && !isRationaleConsistentWithOption(question.options[key], question.distractor_rationales[key])) {
        errors.push(`rationale_option_mismatch_${key}`);
      }
    }
  }
  if (!Array.isArray(question?.pattern_tags) || question.pattern_tags.length === 0) errors.push('missing_pattern_tags');
  if (metadata?.question_count !== undefined && Number(metadata.question_count) <= 0) errors.push('invalid_metadata_question_count');
  return [...new Set(errors)];
}

export function alignOfflineQuestion(question, context = {}) {
  const rawSubject = String(question?.subject || context.expectedSubject || '').trim();
  const subjectId = normalizeSubjectId(rawSubject);
  const expectedSubjectId = normalizeSubjectId(context.expectedSubject || DEFAULT_ROUTE.subject);
  const rawChapter = String(question?.chapter || '').trim();
  const expectedChapter = String(context.expectedChapter || DEFAULT_ROUTE.chapter).trim();
  const text = [
    question?.question_text,
    question?.concept,
    question?.answer_explanation,
    question?.answer_check,
    ...Object.values(question?.options || {}),
  ].join(' ');
  const coreText = [
    question?.question_text,
    question?.concept,
    question?.answer_explanation,
    question?.answer_check,
  ].join(' ');
  const textLower = text.toLowerCase();
  const coreTextLower = coreText.toLowerCase();
  const hasMoneySignal = MONEY_KEYWORDS.some((keyword) => textLower.includes(keyword));
  const wrongSignals = WRONG_CHAPTER_SIGNALS.filter((signal) => textLower.includes(signal));
  const wrongCoreSignals = WRONG_CHAPTER_SIGNALS.filter((signal) => coreTextLower.includes(signal));

  if (subjectId !== expectedSubjectId) {
    return {
      chapter_alignment: 'invalid',
      resolved_subject: subjectId || rawSubject,
      resolved_chapter: rawChapter,
      alignment_confidence: 0,
      alignment_reason: 'outside_economics_subject',
    };
  }

  if (wrongCoreSignals.length > 0 || (wrongSignals.length > 0 && !hasMoneySignal)) {
    const signal = wrongCoreSignals[0] || wrongSignals[0];
    return {
      chapter_alignment: 'invalid',
      resolved_subject: subjectId,
      resolved_chapter: inferEconomicsChapterFromSignals([signal]) || rawChapter,
      alignment_confidence: 0.92,
      alignment_reason: `wrong_chapter_signal:${signal}`,
    };
  }

  if (rawChapter === expectedChapter && hasMoneySignal) {
    return {
      chapter_alignment: 'exact',
      resolved_subject: subjectId,
      resolved_chapter: expectedChapter,
      alignment_confidence: 0.98,
      alignment_reason: 'subject_chapter_exact_with_money_banking_signals',
    };
  }

  if (rawChapter !== expectedChapter && hasMoneySignal) {
    return {
      chapter_alignment: 'close_remap',
      resolved_subject: subjectId,
      resolved_chapter: expectedChapter,
      alignment_confidence: 0.88,
      alignment_reason: 'chapter_label_remapped_to_money_banking_from_content',
    };
  }

  if (isValidCanonicalChapter(subjectId, rawChapter)) {
    return {
      chapter_alignment: 'weak',
      resolved_subject: subjectId,
      resolved_chapter: rawChapter,
      alignment_confidence: rawChapter === expectedChapter ? 0.62 : 0.48,
      alignment_reason: 'canonical_chapter_but_insufficient_money_banking_signal',
    };
  }

  return {
    chapter_alignment: 'invalid',
    resolved_subject: subjectId,
    resolved_chapter: rawChapter,
    alignment_confidence: 0.2,
    alignment_reason: 'chapter_not_in_platform_taxonomy',
  };
}

export function normalizeRawQuestion(question, alignment, quality = DEFAULT_ROUTE.quality) {
  const subjectId = alignment?.resolved_subject || normalizeSubjectId(question?.subject);
  const chapter = alignment?.resolved_chapter || String(question?.chapter || '').trim();
  const options = OPTION_KEYS.map((key) => ({ key, text: String(question.options?.[key] || '').trim() }));
  const patternTags = Array.isArray(question.pattern_tags) ? question.pattern_tags : [];
  return {
    candidate_id: question.local_id,
    local_id: question.local_id,
    source: 'codex_offline_generation',
    subject: subjectId,
    chapter,
    body: String(question.question_text || '').trim(),
    options,
    correct_answer: String(question.correct_option || '').trim().toUpperCase(),
    explanation: `${question.answer_explanation} ${question.answer_check}`.trim(),
    answer_check: String(question.answer_check || '').trim(),
    difficulty: String(question.difficulty || 'medium').trim(),
    question_type: String(question.question_type || 'statement_based').trim(),
    concept: chapter,
    concept_pattern: String(question.concept || '').trim(),
    sub_concept: String(question.concept || '').trim(),
    template_id: String(question.template_id || inferTemplateSignature(question.question_text, question.question_type)).trim(),
    trap_option: String(question.trap_option || '').trim().toUpperCase(),
    strong_distractors: Array.isArray(question.strong_distractors) ? question.strong_distractors.map((key) => String(key).trim().toUpperCase()) : [],
    distractor_rationale: question.distractor_rationales || {},
    tags: [
      'codex_offline_generation',
      `quality:${quality}`,
      `pattern:${question.question_type}`,
      `sub_concept:${slug(question.concept)}`,
      ...patternTags.map((tag) => `pattern_tag:${slug(tag)}`),
    ],
    pattern_tags: patternTags,
    ncert_alignment: question.ncert_alignment,
    chapter_alignment_note: question.chapter_alignment_note,
    why_this_is_cuet_level: question.why_this_is_cuet_level,
    pyq_anchor_id: `offline_seed:${question.local_id}`,
    anchor_tier: 3,
    anchor_source_quality: 'manual_seed',
    anchor_confidence: alignment?.alignment_confidence >= 0.95 ? 'high' : 'medium',
    concept_mismatch_risk: alignment?.alignment_confidence >= 0.85 ? 'low' : 'medium',
    fallback_used: false,
  };
}

export function runOfflineMiniValidator(candidate, alignment = {}) {
  const issues = [];
  const seed = deterministicUnit(candidate.candidate_id || candidate.body);
  let score = 8.05 + seed * 1.15;
  let examQuality = 7.8 + seed * 1.05;
  let distractorQuality = 7.7 + seed * 1.1;
  let conceptualDepth = 7.45 + seed * 0.95;
  let answerConfidence = 0.87 + seed * 0.1;
  const self = runSelfCheck(candidate, { batchSize: 1 });
  const answerGuard = evaluateGeneratedQuestionAnswerGuard(candidate, { subjectId: candidate.subject });
  const localConfidence = scoreAnswerLocalConfidence({
    ...candidate,
    quality_score: score / 10,
    validation_confidence: answerConfidence,
  });

  if (!self.pass) {
    issues.push(...self.reasons);
    score -= Math.min(3.5, self.reasons.length * 0.6);
    distractorQuality -= self.reasons.includes('weak_distractors') ? 2.4 : 0.5;
    examQuality -= 0.7;
  }
  if (!answerGuard.accepted) {
    issues.push(...(answerGuard.check?.reasons || ['answer_integrity_guard_failed']));
    score -= 3;
    answerConfidence = 0.55;
  } else {
    answerConfidence = Math.max(answerConfidence, localConfidence.confidence);
  }
  if (!isAlignmentAccepted(alignment, DEFAULT_ROUTE.chapter)) {
    issues.push(alignment.alignment_reason || 'alignment_failed');
    score -= 3;
    examQuality -= 2;
  }
  if (alignment.alignment_confidence < 0.9) {
    issues.push('alignment_confidence_below_high');
    score -= 0.25;
  }
  if (hasWeakDistractorEvidence(candidate)) {
    issues.push('weak_distractors');
    score -= 2.5;
    distractorQuality -= 3;
  }
  if (hasNonCuetSignal(candidate.body)) {
    issues.push('non_cuet_or_too_advanced');
    score -= 3;
    examQuality -= 2.2;
  }
  if (hasMetaClassificationText(candidate.body)) {
    issues.push('meta_chapter_classification_stem');
    score -= 4;
    examQuality -= 3;
  }
  if ((candidate.options || []).some((option) => hasMetaClassificationText(option.text))) {
    issues.push('meta_chapter_classification_option');
    score -= 3;
    distractorQuality -= 2.5;
  }
  if ((candidate.options || []).some((option) => hasOffRouteDistractorText(option.text))) {
    issues.push('off_route_option_concept');
    score -= 2.8;
    distractorQuality -= 2.5;
  }
  for (const option of candidate.options || []) {
    const rationale = candidate.distractor_rationale?.[option.key] || '';
    if (rationale && !isRationaleConsistentWithOption(option.text, rationale)) {
      issues.push(`rationale_option_mismatch_${option.key}`);
      score -= 1.2;
      distractorQuality -= 1.2;
    }
  }
  if (!answerExplanationProvesKey(candidate)) {
    issues.push('explanation_does_not_prove_answer');
    score -= 1.3;
    answerConfidence -= 0.12;
  }

  score = clampScore(score);
  examQuality = clampScore(Math.min(examQuality, score + 0.3));
  distractorQuality = clampScore(Math.min(distractorQuality, score + 0.4));
  conceptualDepth = clampScore(Math.min(conceptualDepth, score));
  answerConfidence = clampUnit(answerConfidence);
  const verdict = score >= 8.0 && examQuality >= 7.2 && distractorQuality >= 7.2 && answerConfidence >= 0.85 && issues.length === 0
    ? 'accept'
    : score >= 6.5 && answerConfidence >= 0.78
      ? 'borderline'
      : 'reject';
  return {
    layer: 'heuristic_mini',
    scoring_method: 'deterministic_heuristic',
    verdict,
    score,
    exam_quality: examQuality,
    distractor_quality: distractorQuality,
    conceptual_depth: conceptualDepth,
    answer_confidence: answerConfidence,
    factual_accuracy: issues.some((issue) => /answer|multiple|contradict|integrity/i.test(issue)) ? false : true,
    factual_accuracy_level: issues.some((issue) => /answer|multiple|contradict|integrity/i.test(issue)) ? 'low' : 'high',
    cuet_alignment: !issues.some((issue) => /non_cuet|alignment_failed|wrong_chapter/i.test(issue)),
    trap_quality: candidate.selfcheck_trap_quality || self.trap_quality || 'high',
    issues: [...new Set(issues)],
  };
}

export function shouldRunOfflineStrictValidator(candidate, mini, alignment = {}) {
  const type = String(candidate?.question_type || '');
  const score = Number(mini?.score || 0);
  const issues = (mini?.issues || []).join(' ');
  return type === 'simple_numerical' ||
    type === 'assertion_reason' ||
    score < 8.0 ||
    (score >= 6.5 && score <= 8.0) ||
    Number(alignment?.alignment_confidence || 0) < 0.9 ||
    /\b(answer|ambiguity|multiple|alignment|factual)\b/i.test(issues);
}

export function runOfflineStrictValidator(candidate, mini, alignment = {}) {
  const issues = [...(mini?.issues || [])];
  let score = Number(mini?.score || 0);
  let examQuality = Number(mini?.exam_quality || score);
  let distractorQuality = Number(mini?.distractor_quality || score);
  let conceptualDepth = Number(mini?.conceptual_depth || score);
  let answerConfidence = Number(mini?.answer_confidence || 0);

  const optionTexts = candidate.options.map((option) => option.text);
  const correct = candidate.options.find((option) => option.key === candidate.correct_answer)?.text || '';
  const incorrect = candidate.options.filter((option) => option.key !== candidate.correct_answer).map((option) => option.text);
  if (incorrect.some((text) => normalizeComparable(text) === normalizeComparable(correct))) {
    issues.push('multiple_correct_or_duplicate_option');
    score -= 4;
    answerConfidence = Math.min(answerConfidence, 0.55);
  }
  if (candidate.question_type === 'simple_numerical' && !/\b(multiplier|reserve|ratio|1\s*\/|percent|%)\b/i.test(candidate.explanation)) {
    issues.push('numerical_explanation_missing_working');
    score -= 1.5;
    answerConfidence -= 0.12;
  }
  if (candidate.question_type === 'assertion_reason' && !/assertion|reason|explains/i.test(candidate.explanation)) {
    issues.push('assertion_reason_explanation_incomplete');
    score -= 1.2;
    answerConfidence -= 0.08;
  }
  if (new Set(optionTexts.map(normalizeComparable)).size !== 4) {
    issues.push('non_unique_options');
    score -= 3;
  }
  const traceability = validateTraceability(candidate, candidate.subject, candidate.chapter);
  if (!traceability.valid) {
    issues.push(`traceability_${traceability.reason}`);
    score -= 3;
  }
  if (!isAlignmentAccepted(alignment, DEFAULT_ROUTE.chapter)) {
    issues.push('strict_alignment_failed');
    score -= 2.5;
  }

  score = clampScore(score);
  examQuality = clampScore(Math.min(examQuality, score + 0.2));
  distractorQuality = clampScore(Math.min(distractorQuality, score + 0.25));
  conceptualDepth = clampScore(Math.min(conceptualDepth, score));
  answerConfidence = clampUnit(answerConfidence);
  const hardIssues = issues.filter((issue) => /multiple|duplicate|traceability|alignment_failed|answer_integrity|direct_definition|weak_distractors|non_cuet/i.test(issue));
  return {
    layer: 'heuristic_strict',
    scoring_method: 'deterministic_heuristic',
    verdict: hardIssues.length === 0 && score >= 7.5 && examQuality >= 7.0 && distractorQuality >= 7.0 && answerConfidence >= 0.85 ? 'accept' : 'reject',
    score,
    exam_quality: examQuality,
    distractor_quality: distractorQuality,
    conceptual_depth: conceptualDepth,
    answer_confidence: answerConfidence,
    factual_accuracy: !hardIssues.some((issue) => /answer_integrity|multiple|traceability/i.test(issue)),
    factual_accuracy_level: !hardIssues.some((issue) => /answer_integrity|multiple|traceability/i.test(issue)) ? 'high' : 'low',
    cuet_alignment: !hardIssues.some((issue) => /non_cuet|alignment_failed|traceability/i.test(issue)),
    trap_quality: candidate.selfcheck_trap_quality || mini?.trap_quality || 'high',
    issues: [...new Set(issues)],
  };
}

export function isFinalOfflineApproval(candidate, validation, alignment = {}, quality = DEFAULT_ROUTE.quality) {
  const reasons = [];
  if (validation.verdict !== 'accept') reasons.push('validator_not_accept');
  if (Number(validation.score || 0) < 7.5) reasons.push('score_below_7_5');
  if (Number(validation.exam_quality || 0) < 7.0) reasons.push('exam_quality_below_7_0');
  if (Number(validation.distractor_quality || 0) < 7.0) reasons.push('distractor_quality_below_7_0');
  if (Number(validation.answer_confidence || 0) < 0.85) reasons.push('answer_confidence_below_0_85');
  if (validation.factual_accuracy !== true) reasons.push('factual_accuracy_not_high');
  if (validation.cuet_alignment !== true) reasons.push('cuet_alignment_false');
  if (!isAlignmentAccepted(alignment, DEFAULT_ROUTE.chapter)) reasons.push('chapter_alignment_not_accepted');
  if (quality === 'balanced' && Number(validation.score || 0) < 7.5) reasons.push('balanced_score_floor_failed');
  if (isPassageChild(candidate)) reasons.push('passage_child_cannot_import_standalone');
  for (const issue of validation.issues || []) {
    if (/direct_definition|weak_distractors|multiple_correct|answer_integrity|non_cuet|too_advanced|wrong_chapter/i.test(issue)) {
      reasons.push(issue);
    }
  }
  return {
    accepted: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export function dedupeCandidatesWithReasons(candidates, existingQuestions = []) {
  const seen = [...existingQuestions];
  const unique = [];
  const rejected = [];
  for (const candidate of candidates || []) {
    const duplicate = findDuplicateReason(candidate, seen);
    if (duplicate) {
      rejected.push({
        candidate_id: candidate.candidate_id,
        reason: duplicate.reason,
        match: duplicate.match,
      });
    } else {
      unique.push(candidate);
      seen.push(candidate);
    }
  }
  return { unique, rejected };
}

export function renderMarkdownReport(report) {
  const c = report.counts;
  const q = report.quality;
  const real = report.real_validation_sample;
  const lines = [
    '# Offline CUET Batch Report',
    '',
    `Route: ${report.route.subject} / ${report.route.chapter}`,
    `Quality mode: ${report.route.quality_mode}`,
    `Generated at: ${report.generated_at}`,
    '',
    '## Counts',
    `- Raw questions: ${c.raw_questions}`,
    `- Schema valid: ${c.schema_valid}`,
    `- Alignment pass: ${c.alignment_pass}`,
    `- SelfCheck pass: ${c.selfcheck_pass}`,
    `- Mini validator accepted: ${c.mini_validator_accepted}`,
    `- Strict validator accepted: ${c.strict_validator_accepted}`,
    `- Final accepted: ${c.final_accepted}`,
    `- Final rejected: ${c.final_rejected}`,
    '',
    '## Heuristic Screening',
    `- Scoring method: ${q.scoring_method}`,
    `- Heuristic average score: ${q.heuristic_average_score}`,
    `- Heuristic average exam quality: ${q.heuristic_average_exam_quality}`,
    `- Heuristic average distractor quality: ${q.heuristic_average_distractor_quality}`,
    `- Heuristic average answer confidence: ${q.heuristic_average_answer_confidence}`,
    `- Note: ${q.note}`,
    '',
    '## Real Validator Sample',
    `- Status: ${real?.status || 'missing'}`,
    `- Sample size: ${real?.sample_size || 0}`,
    `- Accepted: ${real?.accepted_count ?? 'n/a'}`,
    `- Rejected: ${real?.rejected_count ?? 'n/a'}`,
    `- Average score: ${real?.average_score ?? 'n/a'}`,
    `- Average distractor quality: ${real?.average_distractor_quality ?? 'n/a'}`,
    '',
    '## Top Rejection Reasons',
  ];
  if (report.top_rejection_reasons.length === 0) {
    lines.push('- None');
  } else {
    for (const entry of report.top_rejection_reasons) {
      lines.push(`- ${entry.reason}: ${entry.count}`);
    }
  }
  lines.push(
    '',
    '## Cost Estimate',
    `- External LLM calls: ${report.cost_estimate.external_llm_calls}`,
    `- Estimated USD: ${report.cost_estimate.estimated_usd}`,
    '',
    '## Import Recommendation',
    `- Good enough to import: ${report.recommendation.good_enough_to_import ? 'yes' : 'no'}`,
    `- Reason: ${report.recommendation.reason}`,
    `- Real import command: ${report.recommendation.real_import_command}`,
  );
  if (report.import_results) {
    lines.push(
      '',
      '## Dry Run / Import',
      `- Dry run: ${report.import_results.dry_run ? 'yes' : 'no'}`,
      `- DB duplicate count: ${report.import_results.db_duplicate_count}`,
      `- Importable count: ${report.import_results.importable_count}`,
      `- Inserted count: ${report.import_results.inserted_count}`,
      `- Blocked reasons: ${report.import_results.blocked_reasons.length ? report.import_results.blocked_reasons.join(', ') : 'none'}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function runRealValidationSample(candidates = [], options = {}) {
  const sampleSize = Math.min(Number(options.sampleSize || 20), candidates.length);
  const sample = selectValidationSample(candidates, sampleSize);
  if (sample.length === 0) {
    return {
      requested_sample_size: sampleSize,
      sample_size: 0,
      status: 'skipped',
      reason: 'no_candidates',
      results: [],
    };
  }
  if (process.env.MOCK_AI === 'true') {
    return {
      requested_sample_size: sampleSize,
      sample_size: sample.length,
      status: 'skipped',
      reason: 'MOCK_AI_true_not_real_validation',
      results: [],
    };
  }

  try {
    const { validateMiniBatch } = await import('./llm.mjs');
    const subjectContext = {
      id: DEFAULT_ROUTE.subjectId,
      subject_id: DEFAULT_ROUTE.subjectId,
      name: DEFAULT_ROUTE.subject,
      chapters: [DEFAULT_ROUTE.chapter],
    };
    const startedAt = new Date().toISOString();
    const results = await validateMiniBatch(sample, subjectContext);
    const rows = sample.map((candidate, index) => {
      const result = results[index] || {};
      return {
        candidate_id: candidate.candidate_id,
        local_id: candidate.local_id,
        question_type: candidate.question_type,
        verdict: result.verdict || 'missing',
        score: result.score,
        exam_quality: result.exam_quality,
        distractor_quality: result.distractor_quality,
        conceptual_depth: result.conceptual_depth,
        trap_quality: result.trap_quality,
        answer_confidence: result.answer_confidence,
        factual_accuracy: result.factual_accuracy,
        cuet_alignment: result.cuet_alignment,
        issues: result.issues || result.reasons || [],
      };
    });
    const accepted = rows.filter((row) => row.verdict === 'accept' && Number(row.score || 0) >= 0.72 && row.cuet_alignment === true);
    return {
      requested_sample_size: sampleSize,
      sample_size: sample.length,
      status: 'completed',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      validator: 'validateMiniBatch',
      scoring_scale: '0_to_1_real_validator',
      accepted_count: accepted.length,
      rejected_count: rows.length - accepted.length,
      average_score: averageRows(rows, 'score'),
      average_exam_quality: averageRows(rows, 'exam_quality'),
      average_distractor_quality: averageRows(rows, 'distractor_quality'),
      results: rows,
    };
  } catch (error) {
    return {
      requested_sample_size: sampleSize,
      sample_size: sample.length,
      status: 'failed',
      reason: error.message,
      results: sample.map((candidate) => ({
        candidate_id: candidate.candidate_id,
        local_id: candidate.local_id,
      })),
    };
  }
}

async function loadExistingDbQuestions(subject, chapter) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      questions: [],
      meta: { available: false, reason: 'supabase_env_missing', count: 0 },
    };
  }

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('questions')
      .select('id, body, correct_answer, subject, chapter, concept')
      .eq('subject', subject)
      .eq('chapter', chapter)
      .limit(5000);
    if (error) throw error;
    return {
      questions: (data || []).map((row) => ({
        id: row.id,
        body: row.body,
        correct_answer: row.correct_answer,
        subject: row.subject,
        chapter: row.chapter,
        concept_pattern: row.concept || chapter,
      })),
      meta: { available: true, reason: null, count: (data || []).length },
    };
  } catch (error) {
    return {
      questions: [],
      meta: { available: false, reason: error.message, count: 0 },
    };
  }
}

function buildRawQuestion({ localId, subject, chapter, quality, concept, index }) {
  const slot = index % 10;
  const builder = slot === 4
    ? buildNumericalQuestion
    : [0, 5].includes(slot)
      ? buildStatementQuestion
      : [1, 6].includes(slot)
        ? buildApplicationQuestion
        : [2, 7].includes(slot)
          ? buildAssertionReasonQuestion
          : [3, 8].includes(slot)
            ? buildComparisonQuestion
            : buildCaseQuestion;
  return builder({ localId, subject, chapter, quality, concept, index });
}

function buildStatementQuestion({ localId, subject, chapter, concept, index }) {
  const correctKey = rotateCorrectKey(index);
  const statement = statementPairForConcept(concept, index);
  const optionTexts = {
    correct: 'Both Statement I and Statement II are correct',
    wrong1: 'Statement I only is correct',
    wrong2: 'Statement II only is correct',
    wrong3: 'Neither Statement I nor Statement II is correct',
  };
  const stem = `Read the following statements about ${concept.label}. Statement I: ${statement.one}. Statement II: ${statement.two}. Which option is correct?`;
  return assembleRawQuestion({
    localId,
    subject,
    chapter,
    questionType: 'statement_based',
    difficulty: index % 4 === 0 ? 'hard' : 'medium',
    concept,
    stem,
    optionTexts,
    correctKey,
    answerExplanation: `Option ${correctKey} is correct because Statement I states the rule accurately and Statement II gives the related monetary effect without changing the concept.`,
    answerCheck: `The correct key is ${correctKey}: ${statement.answerCheck}`,
    patternTags: ['statement-based', 'elimination', 'trap'],
    templateId: `statement_${concept.id}`,
  });
}

function buildApplicationQuestion({ localId, subject, chapter, concept, index }) {
  const correctKey = rotateCorrectKey(index);
  const scenario = scenarioForConcept(concept, index);
  const optionTexts = plausibleOptionsForConcept(concept, scenario.correct);
  return assembleRawQuestion({
    localId,
    subject,
    chapter,
    questionType: index % 2 === 0 ? 'application_based' : 'case_based',
    difficulty: 'medium',
    concept,
    stem: scenario.stem,
    optionTexts,
    correctKey,
    answerExplanation: `Option ${correctKey} is correct because ${scenario.explanation}`,
    answerCheck: `The correct key is ${correctKey}: ${scenario.correct}`,
    patternTags: ['application', 'elimination', 'money-banking'],
    templateId: `application_${concept.id}_${index % 2}`,
  });
}

function buildAssertionReasonQuestion({ localId, subject, chapter, concept, index }) {
  const correctKey = rotateCorrectKey(index);
  const assertion = assertionReasonForConcept(concept, index);
  const optionTexts = {
    correct: 'Both Assertion and Reason are true, and the Reason correctly explains the Assertion',
    wrong1: 'Both Assertion and Reason are true, but the Reason does not correctly explain the Assertion',
    wrong2: 'Assertion is true, but Reason is false',
    wrong3: 'Assertion is false, but Reason is true',
  };
  const stem = `${assertionLead(index)} Assertion (A): ${assertion.assertion}. Reason (R): ${assertion.reason}. Which option correctly evaluates the Assertion and Reason?`;
  return assembleRawQuestion({
    localId,
    subject,
    chapter,
    questionType: 'assertion_reason',
    difficulty: 'hard',
    concept,
    stem,
    optionTexts,
    correctKey,
    answerExplanation: `Option ${correctKey} is correct because ${assertion.explanation}`,
    answerCheck: `The correct key is ${correctKey}: ${assertion.answerCheck}`,
    patternTags: ['assertion-reason', 'reasoning', 'trap'],
    templateId: `assertion_${concept.id}`,
  });
}

function buildComparisonQuestion({ localId, subject, chapter, concept, index }) {
  const slotOffset = index % 10 === 8 ? 1 : 0;
  const comparison = COMPARISON_CASES[((Math.floor(index / 10) * 2) + slotOffset) % COMPARISON_CASES.length];
  const correctKey = rotateCorrectKey(index);
  const optionTexts = {
    correct: comparison.correct,
    wrong1: comparison.wrong1,
    wrong2: comparison.wrong2,
    wrong3: comparison.wrong3,
  };
  return assembleRawQuestion({
    localId,
    subject,
    chapter,
    questionType: index % 3 === 0 ? 'match_the_following' : 'comparison_based',
    difficulty: 'medium',
    concept: { ...concept, label: comparison.concept, correct: comparison.correct, note: comparison.note },
    stem: comparisonStem(comparison.stem, index),
    optionTexts,
    correctKey,
    answerExplanation: `Option ${correctKey} is correct because ${comparison.correct}`,
    answerCheck: `The correct key is ${correctKey}: ${comparison.correct}`,
    patternTags: ['comparison', 'elimination', 'trap'],
    templateId: `comparison_${slug(comparison.concept)}`,
  });
}

function buildCaseQuestion({ localId, subject, chapter, concept, index }) {
  const correctKey = rotateCorrectKey(index);
  const scenario = caseScenarioForConcept(concept, index);
  const optionTexts = plausibleOptionsForConcept(concept, scenario.correct);
  return assembleRawQuestion({
    localId,
    subject,
    chapter,
    questionType: 'case_based',
    difficulty: index % 3 === 0 ? 'hard' : 'medium',
    concept,
    stem: scenario.stem,
    optionTexts,
    correctKey,
    answerExplanation: `Option ${correctKey} is correct because ${scenario.explanation}`,
    answerCheck: `The correct key is ${correctKey}: ${scenario.correct}`,
    patternTags: ['case-based', 'monetary-policy', 'trap'],
    templateId: `case_${concept.id}_${index % 3}`,
  });
}

function buildNumericalQuestion({ localId, subject, chapter, concept, index }) {
  const numericalIndex = Math.floor(index / 10);
  const group = NUMERICAL_CASES[Math.floor(numericalIndex / 2) % NUMERICAL_CASES.length];
  const numerical = group.variants[numericalIndex % group.variants.length];
  const correctKey = rotateCorrectKey(index);
  const numericalItem = numericalQuestionFrame(group.template_id, numerical);
  return assembleRawQuestion({
    localId,
    subject,
    chapter,
    questionType: 'simple_numerical',
    difficulty: 'medium',
    concept: { ...concept, label: numericalItem.concept, correct: numericalItem.correctText, note: numericalItem.note },
    stem: numericalItem.stem,
    optionTexts: numericalItem.optionTexts,
    correctKey,
    answerExplanation: `Option ${correctKey} is correct because ${numericalItem.explanation}`,
    answerCheck: `The correct key is ${correctKey}: ${numericalItem.correctText}`,
    patternTags: ['simple-numerical', 'money-multiplier', 'trap'],
    templateId: `numerical_${group.template_id}`,
  });
}

function assembleRawQuestion({
  localId,
  subject,
  chapter,
  questionType,
  difficulty,
  concept,
  stem,
  optionTexts,
  correctKey,
  answerExplanation,
  answerCheck,
  patternTags,
  templateId,
}) {
  const wrongKeys = OPTION_KEYS.filter((key) => key !== correctKey);
  const ordered = {
    [correctKey]: optionTexts.correct,
    [wrongKeys[0]]: optionTexts.wrong1,
    [wrongKeys[1]]: optionTexts.wrong2,
    [wrongKeys[2]]: optionTexts.wrong3,
  };
  const trapKey = wrongKeys[1];
  const rationales = buildRationalesForOptions(ordered, correctKey, trapKey, concept);
  return {
    local_id: localId,
    subject,
    chapter,
    question_type: questionType,
    difficulty,
    concept: concept.label,
    question_text: stem,
    options: ordered,
    correct_option: correctKey,
    answer_explanation: answerExplanation,
    answer_check: answerCheck,
    trap_option: trapKey,
    strong_distractors: [wrongKeys[0], trapKey],
    distractor_rationales: rationales,
    template_id: templateId || `template_${slug(questionType)}_${slug(concept.label)}`,
    pattern_tags: patternTags,
    ncert_alignment: `${concept.label} is part of Class 12 Introductory Macroeconomics under Money & Banking.`,
    chapter_alignment_note: concept.note,
    why_this_is_cuet_level: 'The item uses NCERT concepts with one-step reasoning, close distractors, and a CUET-style elimination pattern rather than a direct definition.',
  };
}

function statementPairForConcept(concept, index) {
  const secondStatements = {
    money_supply_components: 'Demand deposits are included because they can transfer purchasing power through cheques or digital instructions.',
    broad_money_m3: 'Time deposits make M3 less liquid than M1 but broader in coverage.',
    legal_tender: 'A cheque is bank money, but it does not have the same compulsory acceptability as currency.',
    demand_deposits: 'A demand deposit can function as money even though it is not printed currency.',
    commercial_bank_credit_creation: 'The credit-creation process is limited by required reserves and cash leakages.',
    money_multiplier: 'When the reserve ratio rises, the maximum deposit multiplier falls.',
    crr: 'A higher CRR leaves commercial banks with fewer funds for lending.',
    slr: 'SLR can restrict credit because banks must hold a part of liabilities in specified liquid assets.',
    repo_rate: 'A rise in repo rate can make bank borrowing from the RBI costlier.',
    reverse_repo_rate: 'A higher reverse repo rate can encourage banks to park surplus funds with the RBI.',
    monetary_policy_inflation: 'Contractionary monetary policy tries to reduce inflationary pressure by restraining credit growth.',
    central_bank_function: 'The central bank influences the cost and availability of credit rather than lending retail loans like a commercial bank.',
    lender_of_last_resort: 'Liquidity support under this role is meant to protect banking stability, not to remove normal prudential requirements.',
    bankers_bank: 'Commercial banks keep reserves with the RBI because it acts as a banker to banks.',
    high_powered_money: 'Bank reserves are part of the monetary base even though the public does not use them directly for retail payments.',
    open_market_operations: 'An RBI purchase of government securities injects funds into the banking system.',
    currency_with_public: 'Cash in bank vaults is not the same as currency held by the public for spending.',
    near_money_liquidity: 'Time deposits are less liquid than demand deposits but are still part of broader monetary aggregates.',
    policy_rate_transmission: 'Changes in the repo rate may influence lending rates with a lag.',
    reserve_leakages: 'Cash withdrawals reduce the amount returning to banks as deposits for further lending.',
  };
  const two = secondStatements[concept.id] || 'The concept affects bank lending or liquidity through a monetary channel.';
  return {
    one: concept.core,
    two,
    answerCheck: `${concept.core}; ${two}`,
    templateSuffix: index % 2,
  };
}

function assertionLead(index) {
  const leads = [
    'In a CUET monetary reasoning item,',
    'For a banking-mechanism question,',
    'In a liquidity-policy application,',
    'For an RBI policy transmission case,',
    'In a money-supply reasoning question,',
    'For a commercial-bank credit case,',
    'In an inflation-control monetary case,',
    'For a reserve-management application,',
  ];
  return leads[index % leads.length];
}

function comparisonStem(stem, index) {
  const leads = [
    'During a bank liquidity review,',
    'In a CUET elimination item,',
    'For an RBI policy application,',
    'In a commercial-bank decision case,',
    'During a money-supply revision drill,',
    'In a monetary-instruments comparison,',
    'For a credit-conditions case,',
    'In a banking operations scenario,',
  ];
  return `${leads[index % leads.length]} ${stem.charAt(0).toLowerCase()}${stem.slice(1)}`;
}

function assertionReasonForConcept(concept) {
  const pairs = {
    money_supply_components: {
      assertion: 'Demand deposits are included in M1.',
      reason: 'They are payable on demand and can be used for payments through banking instruments.',
      explanation: 'both A and R are true, and R explains why demand deposits enter narrow money.',
    },
    broad_money_m3: {
      assertion: 'M3 is broader than M1.',
      reason: 'M3 includes time deposits with banks in addition to the components of M1.',
      explanation: 'the Reason gives the exact addition that makes M3 broader.',
    },
    legal_tender: {
      assertion: 'Currency notes and coins have legal-tender status.',
      reason: 'They are backed by law for settlement of debts within the monetary system.',
      explanation: 'the Reason explains compulsory acceptability of legal tender.',
    },
    demand_deposits: {
      assertion: 'Demand deposits can act as money.',
      reason: 'They are withdrawable on demand and can transfer purchasing power without first converting into a time deposit.',
      explanation: 'the Reason explains the medium-of-exchange function of demand deposits.',
    },
    commercial_bank_credit_creation: {
      assertion: 'Commercial banks can create credit from an initial deposit.',
      reason: 'They keep required reserves and lend the excess, which can return as new deposits.',
      explanation: 'the Reason correctly gives the deposit-loan-deposit mechanism.',
    },
    money_multiplier: {
      assertion: 'A higher reserve ratio lowers the simple money multiplier.',
      reason: 'A larger required reserve leaves a smaller share of each deposit available for further lending.',
      explanation: 'the Reason gives the causal link between reserves and the multiplier.',
    },
    crr: {
      assertion: 'An increase in CRR can reduce credit creation.',
      reason: 'Banks must keep a larger cash balance with the RBI and have fewer lendable resources.',
      explanation: 'the Reason explains the lending constraint created by CRR.',
    },
    slr: {
      assertion: 'A higher SLR can restrain bank credit.',
      reason: 'Banks must hold more liquid assets instead of using that portion for loans.',
      explanation: 'the Reason explains why specified liquid-asset holdings reduce lending capacity.',
    },
    repo_rate: {
      assertion: 'A rise in repo rate can make credit conditions tighter.',
      reason: 'Commercial banks may face a higher cost of short-term borrowing from the RBI.',
      explanation: 'the Reason gives the policy-rate transmission channel.',
    },
    reverse_repo_rate: {
      assertion: 'A higher reverse repo rate can absorb liquidity from banks.',
      reason: 'Banks may prefer parking surplus funds with the RBI when the return is more attractive.',
      explanation: 'the Reason explains why funds move from banks to the RBI.',
    },
    monetary_policy_inflation: {
      assertion: 'Tighter monetary policy can reduce inflationary pressure.',
      reason: 'Higher rates or reserve requirements can reduce credit growth and aggregate demand.',
      explanation: 'the Reason states the monetary transmission logic.',
    },
    central_bank_function: {
      assertion: 'The central bank is not a profit-maximising commercial bank.',
      reason: 'Its role includes currency issue, reserve regulation, and monetary stability.',
      explanation: 'the Reason correctly distinguishes central-bank functions from retail banking.',
    },
    lender_of_last_resort: {
      assertion: 'The RBI can act as lender of last resort for banks.',
      reason: 'It can provide liquidity support during temporary banking stress to protect confidence.',
      explanation: 'the Reason explains the stability purpose of the role.',
    },
    bankers_bank: {
      assertion: 'Commercial banks maintain reserve and settlement accounts with the RBI.',
      reason: 'Commercial banks hold reserves with the RBI and use it for settlement support.',
      explanation: 'the Reason explains the banker-to-banks role.',
    },
    high_powered_money: {
      assertion: 'High powered money includes bank reserves.',
      reason: 'Bank reserves support deposit expansion even though they are not retail currency.',
      explanation: 'the Reason explains why reserves are part of the monetary base.',
    },
    open_market_operations: {
      assertion: 'An RBI purchase of government securities injects liquidity.',
      reason: 'The RBI pays for the securities, increasing funds held by sellers or banks.',
      explanation: 'the Reason explains the liquidity direction in an OMO purchase.',
    },
    currency_with_public: {
      assertion: 'Currency with the public excludes cash held by banks.',
      reason: 'Cash in bank vaults is not currently available to the public for direct spending.',
      explanation: 'the Reason explains the measurement boundary.',
    },
    near_money_liquidity: {
      assertion: 'Time deposits are less liquid than demand deposits.',
      reason: 'They usually require maturity or withdrawal conditions before use as spending power.',
      explanation: 'the Reason explains liquidity ranking.',
    },
    policy_rate_transmission: {
      assertion: 'Repo-rate changes can influence bank lending rates.',
      reason: 'A change in banks borrowing cost can be passed into loan pricing over time.',
      explanation: 'the Reason explains policy-rate transmission.',
    },
    reserve_leakages: {
      assertion: 'Cash leakages reduce the deposit multiplier.',
      reason: 'Money withdrawn as currency may not return to banks as deposits for further lending.',
      explanation: 'the Reason explains the leakage from the credit-creation chain.',
    },
  };
  const item = pairs[concept.id] || {
    assertion: concept.core,
    reason: concept.correct,
    explanation: 'the Reason explains the monetary mechanism in the Assertion.',
  };
  return {
    ...item,
    answerCheck: `both A and R are true; ${item.explanation}`,
  };
}

function scenarioForConcept(concept, index) {
  const correct = optionCorrectForConcept(concept);
  const leads = [
    'In a CUET banking case',
    'In a monetary-policy situation',
    'During an RBI policy review',
    'In a commercial-bank balance-sheet situation',
    'In a credit-creation case',
    'During a liquidity-management situation',
    'In a money-supply application',
    'For an inflation-control case',
  ];
  const stems = {
    money_supply_components: 'A household shifts money from wallet cash to a current-account balance that can be used by cheque. How should this be treated in narrow money?',
    broad_money_m3: 'A bank reports a rise in one-year fixed deposits while currency and demand deposits are unchanged. Which money aggregate is most directly widened?',
    legal_tender: 'A shopkeeper refuses a cheque but accepts currency notes for an old debt settlement. Which idea best explains the difference?',
    demand_deposits: 'A student pays exam fees through a bank transfer from a demand deposit account. Why can the deposit perform a money function?',
    commercial_bank_credit_creation: 'A bank receives a fresh deposit and keeps the required reserve before issuing a loan. What is the immediate monetary implication?',
    money_multiplier: 'The RBI raises the reserve ratio during a period of rapid credit growth. What happens to the simple money multiplier?',
    crr: 'The RBI raises CRR for commercial banks. What is the likely first-round effect on their lending capacity?',
    slr: 'A bank must hold a larger share of its liabilities in approved securities. Which effect is most likely?',
    repo_rate: 'The RBI increases the repo rate while banks rely on short-term RBI borrowing. What is the likely effect on credit conditions?',
    reverse_repo_rate: 'Banks have surplus funds and the RBI raises the reverse repo rate. Which response is most likely?',
    monetary_policy_inflation: 'Inflation is rising and the RBI wants to restrain demand using monetary policy. Which action best fits the objective?',
    central_bank_function: 'A learner says the RBI is just like a commercial bank because both deal with money. Which correction is best?',
    lender_of_last_resort: 'A solvent bank faces temporary liquidity pressure because depositors are withdrawing funds quickly. Which RBI role is relevant?',
    bankers_bank: 'Commercial banks settle claims among themselves through accounts maintained with the RBI. Which role does this show?',
    high_powered_money: 'A rise in bank reserves occurs after RBI liquidity support. Why can this affect deposit expansion?',
    open_market_operations: 'The RBI buys government securities from the market. What is the expected liquidity effect?',
    currency_with_public: 'A bank moves cash from its vault to ATMs used by customers. Which measurement idea is involved?',
    near_money_liquidity: 'A student compares a savings-account balance with a fixed deposit. Which liquidity statement is correct?',
    policy_rate_transmission: 'After a repo-rate hike, banks revise some lending rates upward. Which mechanism is being illustrated?',
    reserve_leakages: 'Borrowers withdraw part of loan proceeds as currency and keep it outside banks. What happens to credit creation?',
  };
  const baseStem = stems[concept.id] || `A CUET-level case involves ${concept.label.toLowerCase()} and bank credit. Which option gives the correct monetary effect?`;
  return {
    stem: `${leads[index % leads.length]}, ${baseStem}`,
    correct,
    explanation: `${correct.charAt(0).toLowerCase()}${correct.slice(1)}`,
    templateSuffix: index % 2,
  };
}

function caseScenarioForConcept(concept, index) {
  const scenario = scenarioForConcept(concept, index);
  return {
    ...scenario,
    stem: `${scenario.stem} Choose the option that best follows from the case.`,
  };
}

function optionCorrectForConcept(concept) {
  const correctByConcept = {
    money_supply_components: 'It remains within M1 because both currency with the public and demand deposits are narrow-money components.',
    broad_money_m3: 'M3 rises because time deposits are added to M1 in the broad-money measure.',
    legal_tender: 'Currency has compulsory legal acceptability for debt settlement, while a cheque depends on bank acceptance and account conditions.',
    demand_deposits: 'The demand deposit works as money because it can transfer purchasing power on demand.',
    commercial_bank_credit_creation: 'The bank can create credit by lending excess reserves, and that loan can become a deposit elsewhere.',
    money_multiplier: 'The multiplier falls because a higher reserve ratio reduces the portion available for repeated lending.',
    crr: 'Lendable resources fall because a larger cash balance must be kept with the RBI.',
    slr: 'Credit expansion is restrained because more resources must be held in specified liquid assets.',
    repo_rate: 'Borrowing from the RBI becomes costlier, so banks may reduce credit growth or raise lending rates.',
    reverse_repo_rate: 'Banks may park more surplus funds with the RBI, reducing liquidity available for lending.',
    monetary_policy_inflation: 'A contractionary step such as raising rates or reserve requirements can reduce credit and demand.',
    central_bank_function: 'The RBI regulates currency, reserves, and credit conditions rather than operating as a retail profit-maximising lender.',
    lender_of_last_resort: 'The lender-of-last-resort role allows liquidity support to banks facing temporary stress.',
    bankers_bank: 'It shows the RBI as banker to banks because banks maintain reserve and settlement accounts with it.',
    high_powered_money: 'Bank reserves are part of the monetary base and can support multiple deposit creation.',
    open_market_operations: 'Liquidity increases because the RBI pays for securities and funds enter the banking system.',
    currency_with_public: 'The boundary is whether cash is held by the public for spending rather than by banks as vault cash.',
    near_money_liquidity: 'The savings or demand balance is more liquid, while the fixed deposit is less liquid but part of broader money.',
    policy_rate_transmission: 'It illustrates policy-rate transmission from RBI borrowing cost to bank lending rates.',
    reserve_leakages: 'Credit creation weakens because withdrawn currency does not immediately return as deposits for further lending.',
  };
  return correctByConcept[concept.id] || concept.correct;
}

function plausibleOptionsForConcept(concept, correct) {
  const wrongByConcept = {
    money_supply_components: [
      'It leaves M1 because chequeable deposits are not physical currency.',
      'It enters only M3 because every bank balance is treated as a time deposit.',
      'It becomes high powered money because the commercial bank now holds the account.',
    ],
    broad_money_m3: [
      'Only M1 rises because time deposits are the most liquid form of money.',
      'High powered money rises by the same amount because fixed deposits are RBI reserves.',
      'Demand deposits fall automatically because time deposits are included in M3.',
    ],
    legal_tender: [
      'A cheque is compulsory legal tender whenever the payer has a bank account.',
      'Currency loses legal-tender status when digital payments are available.',
      'Fixed deposits have stronger legal-tender status than currency because they earn interest.',
    ],
    demand_deposits: [
      'It cannot be money because no currency note changes hands.',
      'It is a time deposit because the bank can use part of it for loans.',
      'It is high powered money because it is recorded in a commercial bank ledger.',
    ],
    commercial_bank_credit_creation: [
      'Credit creation means the bank prints new currency notes for the borrower.',
      'The bank must lend the entire deposit for credit creation to occur.',
      'Credit creation stops after the first loan because loans cannot become deposits.',
    ],
    money_multiplier: [
      'The multiplier rises because banks become more cautious and hold more reserves.',
      'The multiplier is unchanged because only currency printing changes money supply.',
      'The multiplier equals the reserve percentage, so a higher reserve ratio always means a higher multiplier.',
    ],
    crr: [
      'Lendable resources rise because the RBI pays high interest on CRR balances.',
      'The effect is the same as lowering SLR because both release bank resources.',
      'CRR changes only the composition of government securities and not cash reserves.',
    ],
    slr: [
      'Credit expansion rises because approved securities can be lent directly to households.',
      'SLR is the same as CRR because both are cash balances kept only with the RBI.',
      'A higher SLR lowers the repo rate automatically and therefore expands credit.',
    ],
    repo_rate: [
      'Borrowing from the RBI becomes cheaper, so credit expands immediately.',
      'Banks must hold more gold and securities because repo rate is a liquidity ratio.',
      'Households receive a higher legal-tender value for currency because repo rises.',
    ],
    reverse_repo_rate: [
      'The RBI lends more to banks, so liquidity available for lending rises.',
      'Banks reduce parking funds with the RBI because reverse repo becomes more attractive.',
      'The cash reserve ratio falls automatically when reverse repo rises.',
    ],
    monetary_policy_inflation: [
      'Lowering CRR would be contractionary because banks keep fewer reserves.',
      'Cutting the repo rate would normally restrain credit demand during inflation.',
      'Selling fewer securities through OMO always absorbs more liquidity.',
    ],
    central_bank_function: [
      'The RBI mainly competes with commercial banks because it accepts ordinary household savings accounts.',
      'The RBI approves each individual consumer loan because commercial banks cannot judge borrowers independently.',
      'The RBI creates demand deposits directly in every household account because it issues currency.',
    ],
    lender_of_last_resort: [
      'It means the RBI guarantees bank profits even when loans are bad.',
      'It means banks do not need CRR or SLR in normal times.',
      'It means households borrow directly from the RBI when commercial banks refuse.',
    ],
    bankers_bank: [
      'It means the RBI replaces commercial banks because it accepts all household deposits directly.',
      'It means commercial banks can ignore settlement obligations because the RBI will settle every claim automatically.',
      'It means the RBI fixes every branch deposit rate because it is a banker to banks.',
    ],
    high_powered_money: [
      'Bank reserves are excluded because only the public uses money for payments.',
      'High powered money is identical to M3 because both include time deposits.',
      'The monetary base falls whenever commercial banks hold higher reserves.',
    ],
    open_market_operations: [
      'Liquidity falls because securities leave the market after an RBI purchase.',
      'Liquidity is unchanged because securities and currency are both the same asset.',
      'A purchase works like a reverse repo because banks park more surplus funds with the RBI.',
    ],
    currency_with_public: [
      'Vault cash is counted as currency with the public because the bank can dispense it later.',
      'Coins are excluded because only paper notes count in money supply.',
      'All currency issued by the RBI is counted, regardless of who holds it.',
    ],
    near_money_liquidity: [
      'A fixed deposit is more liquid because it normally pays a higher interest rate.',
      'Demand deposits are excluded from money because banks use them for loans.',
      'Time deposits are high powered money because they are held inside banks.',
    ],
    policy_rate_transmission: [
      'Repo-rate changes affect only RBI accounting and cannot affect lending rates.',
      'A repo-rate hike must increase loan demand because borrowers rush to borrow.',
      'Transmission means CRR and SLR become legally identical after a policy change.',
    ],
    reserve_leakages: [
      'Credit creation strengthens because currency outside banks automatically multiplies deposits.',
      'Leakages do not matter once the first bank has created a loan.',
      'Excess reserves raise the multiplier because banks lend less than they can.',
    ],
  };
  const wrongs = wrongByConcept[concept.id] || concept.misconceptions || [];
  return {
    correct,
    wrong1: wrongs[0],
    wrong2: wrongs[1],
    wrong3: wrongs[2],
  };
}

function numericalQuestionFrame(templateId, numerical) {
  if (templateId === 'deposit_multiplier') {
    const reserveDecimal = numerical.reserve / 100;
    const wrongReserve = Math.round(100 / numerical.wrong[0]);
    return {
      concept: 'Deposit Multiplier',
      stem: `If the required reserve ratio is ${numerical.reserve} percent and banks do not hold excess reserves, what is the simple deposit multiplier?`,
      correctText: `${numerical.multiplier}, because multiplier = 1 / ${reserveDecimal}`,
      optionTexts: {
        correct: `${numerical.multiplier}, because multiplier = 1 / ${reserveDecimal}`,
        wrong1: `${numerical.wrong[0]}, because it treats the reserve ratio as about ${wrongReserve} percent`,
        wrong2: `${numerical.wrong[1]}, because it adjusts the multiplier by one lending round instead of using the reserve ratio`,
        wrong3: `${numerical.wrong[2]}, because it mistakes the ${numerical.reserve} percent reserve ratio for the multiplier`,
      },
      explanation: `the multiplier is 1 divided by the reserve ratio, so 1 / ${numerical.reserve / 100} = ${numerical.multiplier}.`,
      note: 'Uses a one-step multiplier calculation.',
    };
  }
  if (templateId === 'crr_lendable_change') {
    return {
      concept: 'CRR And Lendable Resources',
      stem: `A bank receives Rs ${numerical.deposit} crore in deposits. CRR rises from ${numerical.oldRate} percent to ${numerical.newRate} percent. By how much do required cash reserves rise?`,
      correctText: `Rs ${numerical.correct} crore, because the extra reserve is ${numerical.newRate - numerical.oldRate} percent of deposits`,
      optionTexts: {
        correct: `Rs ${numerical.correct} crore, because the extra reserve is ${numerical.newRate - numerical.oldRate} percent of deposits`,
        wrong1: `Rs ${numerical.wrong[0]} crore, because it uses the new CRR on the full deposit instead of the increase`,
        wrong2: `Rs ${numerical.wrong[1]} crore, because it treats lendable balance as the reserve increase`,
        wrong3: `Rs ${numerical.wrong[2]} crore, because it subtracts reserves from deposits instead of finding the rise`,
      },
      explanation: `required reserves rise by ${numerical.newRate - numerical.oldRate} percent of Rs ${numerical.deposit} crore, which is Rs ${numerical.correct} crore.`,
      note: 'Tests CRR impact on required reserves.',
    };
  }
  if (templateId === 'new_deposit_credit_capacity') {
    return {
      concept: 'New Deposit Lending Capacity',
      stem: `A bank receives a new deposit of Rs ${numerical.deposit} crore and the reserve ratio is ${numerical.reserve} percent. If it keeps only required reserves, what is the maximum first-round loan it can make?`,
      correctText: `Rs ${numerical.correct} crore, because the bank can lend the deposit left after required reserves`,
      optionTexts: {
        correct: `Rs ${numerical.correct} crore, because the bank can lend the deposit left after required reserves`,
        wrong1: `Rs ${numerical.wrong[0]} crore, because it confuses the reserve kept with the loan made`,
        wrong2: `Rs ${numerical.wrong[1]} crore, because it ignores the required reserve ratio`,
        wrong3: `Rs ${numerical.wrong[2]} crore, because it applies the full deposit multiplier to the first-round loan`,
      },
      explanation: `the bank keeps ${numerical.reserve} percent as reserves and can lend the remaining ${100 - numerical.reserve} percent, or Rs ${numerical.correct} crore.`,
      note: 'Tests first-round lending after required reserves.',
    };
  }
  if (templateId === 'cash_reserve_required') {
    return {
      concept: 'Required Cash Reserve',
      stem: `A commercial bank has Rs ${numerical.deposit} crore of deposits and the CRR is ${numerical.reserve} percent. What cash reserve must it keep with the RBI?`,
      correctText: `Rs ${numerical.correct} crore, because CRR is applied to the bank deposit base`,
      optionTexts: {
        correct: `Rs ${numerical.correct} crore, because CRR is applied to the bank deposit base`,
        wrong1: `Rs ${numerical.wrong[0]} crore, because it uses the lendable balance instead of cash reserve`,
        wrong2: `Rs ${numerical.wrong[1]} crore, because it subtracts the reserve from deposits`,
        wrong3: `Rs ${numerical.wrong[2]} crore, because it adds a small adjustment instead of applying CRR`,
      },
      explanation: `CRR required cash reserve is ${numerical.reserve} percent of Rs ${numerical.deposit} crore, which equals Rs ${numerical.correct} crore.`,
      note: 'Tests direct CRR reserve calculation.',
    };
  }
  return {
    concept: 'OMO Liquidity Effect',
    stem: `The RBI ${numerical.action} government securities worth Rs ${numerical.amount} crore in an open market operation. What is the first-round effect on banking-system liquidity?`,
    correctText: numerical.correct > 0
      ? `Liquidity increases by Rs ${numerical.correct} crore, because RBI purchase payments add funds`
      : `Liquidity decreases by Rs ${Math.abs(numerical.correct)} crore, because RBI sale payments absorb funds`,
    optionTexts: {
      correct: numerical.correct > 0
        ? `Liquidity increases by Rs ${numerical.correct} crore, because RBI purchase payments add funds`
        : `Liquidity decreases by Rs ${Math.abs(numerical.correct)} crore, because RBI sale payments absorb funds`,
      wrong1: numerical.wrong[0] > 0
        ? `Liquidity increases by Rs ${numerical.wrong[0]} crore, because it reverses the OMO liquidity direction`
        : `Liquidity decreases by Rs ${Math.abs(numerical.wrong[0])} crore, because it reverses the OMO liquidity direction`,
      wrong2: `Liquidity is unchanged, because it wrongly treats securities and bank reserves as the same liquid asset`,
      wrong3: numerical.wrong[2] > 0
        ? `Liquidity increases by Rs ${numerical.wrong[2]} crore, because it double-counts the RBI security transaction`
        : `Liquidity decreases by Rs ${Math.abs(numerical.wrong[2])} crore, because it double-counts the RBI security transaction`,
    },
    explanation: numerical.action === 'purchases'
      ? `an RBI purchase pays funds into the market, increasing liquidity by Rs ${numerical.amount} crore.`
      : `an RBI sale takes funds from buyers, decreasing liquidity by Rs ${numerical.amount} crore.`,
    note: 'Tests OMO direction numerically.',
  };
}

function buildRationalesForOptions(options, correctKey, trapKey, concept) {
  const rationales = {};
  for (const key of OPTION_KEYS) {
    const text = options[key];
    if (key === correctKey) {
      rationales[key] = `Option ${key} states "${text}". It is correct because it matches the monetary rule tested in ${concept.label}.`;
    } else if (key === trapKey) {
      rationales[key] = `Option ${key} states "${text}". It is a trap because it uses a nearby banking idea but reverses or confuses the actual ${concept.label} mechanism.`;
    } else {
      rationales[key] = `Option ${key} states "${text}". It is tempting because it uses monetary vocabulary, but it misstates the ${concept.label} relationship.`;
    }
  }
  return rationales;
}

function rotateCorrectKey(index) {
  return OPTION_KEYS[index % OPTION_KEYS.length];
}

function listBatchFiles(dir) {
  if (!existsSync(dir)) throw new Error(`batch directory not found: ${dir}`);
  return readdirSync(dir)
    .filter((name) => /^batch_\d{3}\.json$/i.test(name))
    .sort()
    .map((name) => join(dir, name));
}

function loadRawEntries(files) {
  const entries = [];
  for (const filePath of files) {
    const payload = readJson(filePath);
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];
    questions.forEach((question, index) => {
      entries.push({ filePath, payload, question, index });
    });
  }
  return entries;
}

function buildSelfCheckContext(candidates) {
  const stemShapeCounts = {};
  for (const candidate of candidates) {
    const shape = getStemShape(candidate.body);
    stemShapeCounts[shape] = (stemShapeCounts[shape] || 0) + 1;
  }
  return { stemShapeCounts, batchSize: candidates.length };
}

function applyTemplatePolicy(entries) {
  const accepted = [];
  const rejected = [];
  const numericalTemplateCounts = new Map();
  const statementTwoCounts = new Map();

  for (const entry of entries) {
    const reasons = [];
    const candidate = entry.candidate;
    const templateId = String(candidate.template_id || inferTemplateSignature(candidate.body, candidate.question_type));

    if (hasMetaClassificationText(candidate.body)) reasons.push('meta_chapter_classification_stem');
    if ((candidate.options || []).some((option) => hasMetaClassificationText(option.text))) reasons.push('meta_chapter_classification_option');
    if ((candidate.options || []).some((option) => hasOffRouteDistractorText(option.text))) reasons.push('off_route_option_concept');
    for (const option of candidate.options || []) {
      const rationale = candidate.distractor_rationale?.[option.key] || '';
      if (rationale && !isRationaleConsistentWithOption(option.text, rationale)) {
        reasons.push(`rationale_option_mismatch_${option.key}`);
      }
    }

    if (candidate.question_type === 'simple_numerical') {
      const count = (numericalTemplateCounts.get(templateId) || 0) + 1;
      numericalTemplateCounts.set(templateId, count);
      if (count > 2) reasons.push(`numerical_template_repeated:${templateId}`);
    }

    if (/compare the four explanations|which comparison best captures/i.test(candidate.body)) {
      reasons.push('banned_compare_explanations_template');
    }

    const statementTwo = extractStatementTwo(candidate.body);
    if (statementTwo) {
      const normalized = normalizeComparable(statementTwo);
      const count = (statementTwoCounts.get(normalized) || 0) + 1;
      statementTwoCounts.set(normalized, count);
      if (count > 1) reasons.push('repeated_statement_ii_template');
    }

    if (reasons.length > 0) rejected.push({ ...entry, templatePolicyReasons: [...new Set(reasons)] });
    else accepted.push(entry);
  }

  return { accepted, rejected };
}

function isAlignmentAccepted(alignment, expectedChapter) {
  return ['exact', 'close_remap'].includes(alignment?.chapter_alignment) &&
    alignment.resolved_chapter === expectedChapter &&
    Number(alignment.alignment_confidence || 0) >= 0.85;
}

function findDuplicateReason(candidate, existing) {
  const direct = deduplicateAgainst([candidate], existing, {
    jaccardThreshold: 0.82,
    sortedTokenThreshold: 0.9,
    bigramThreshold: 0.72,
  });
  if (direct.removed > 0) {
    const match = existing
      .map((row) => ({ row, similarity: getSimilarity(candidate.body, row.body) }))
      .sort((a, b) => b.similarity - a.similarity)[0];
    return {
      reason: 'duplicate_against_db_or_batch',
      match: match ? { id: match.row.id || match.row.candidate_id || null, similarity: Number(match.similarity.toFixed(3)) } : null,
    };
  }
  return null;
}

function isPassageChild(candidate) {
  return Boolean(candidate?.is_passage_linked || candidate?.passage_id || candidate?.passage_group_id || candidate?.temporary_group_key);
}

function answerExplanationProvesKey(candidate) {
  const text = `${candidate.explanation || ''} ${candidate.answer_check || ''}`;
  return new RegExp(`\\b(?:option\\s*)?${candidate.correct_answer}\\b`, 'i').test(text) &&
    /because|follows|therefore|so|explains|equals|correct/i.test(text);
}

function hasWeakDistractorEvidence(candidate) {
  if (hasStatementCombinationOptions(candidate)) return false;
  const correct = candidate.options.find((option) => option.key === candidate.correct_answer)?.text || '';
  const distractors = candidate.options.filter((option) => option.key !== candidate.correct_answer);
  // Detect an extreme answer-length giveaway, not missing trap annotations or
  // low word overlap. Semantic plausibility requires independent challenges.
  return correct.length>40 && distractors.every(option=>option.text.length<10);
}

function hasStatementCombinationOptions(candidate) {
  const body = String(candidate?.body || '');
  if (!/\bStatement\s+I\b/i.test(body) || !/\bStatement\s+II\b/i.test(body)) return false;
  return (candidate.options || []).filter((option) => (
    /both\s+statement\s+i\s+and\s+statement\s+ii/i.test(option.text) ||
    /statement\s+i\s+only/i.test(option.text) ||
    /statement\s+ii\s+only/i.test(option.text) ||
    /neither\s+statement\s+i\s+nor\s+statement\s+ii/i.test(option.text)
  )).length >= 3;
}

function isDirectDefinitionText(text) {
  return /^(what is|define|meaning of|which term)\b/i.test(String(text || '').trim()) ||
    /\b(best definition|correct definition|is called|known as|refers to)\b/i.test(String(text || ''));
}

function hasNonCuetSignal(text) {
  return /\b(derive|prove|econometrics|is-lm|graduate|b\.com|olympiad|matrix algebra|regression coefficient)\b/i.test(String(text || ''));
}

function hasMetaClassificationText(value) {
  return META_CLASSIFICATION_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

function hasOffRouteDistractorText(value) {
  const text = String(value || '').toLowerCase();
  return WRONG_CHAPTER_SIGNALS.some((signal) => text.includes(signal));
}

function estimateRealValidationCostUsd(realValidationSample) {
  if (realValidationSample?.status !== 'completed') return 0;
  const sampleSize = Number(realValidationSample.sample_size || 0);
  if (!sampleSize) return 0;
  return Number((sampleSize * 0.0008).toFixed(4));
}

function isRationaleConsistentWithOption(optionText, rationaleText) {
  const optionComparable = normalizeComparable(optionText);
  const rationaleComparable = normalizeComparable(rationaleText);
  const rationaleWithoutQuote = normalizeComparable(String(rationaleText || '').replace(/"[^"]+"/g, ' '));
  for (const signal of WRONG_CHAPTER_SIGNALS) {
    if (rationaleWithoutQuote.includes(normalizeComparable(signal)) && !optionComparable.includes(normalizeComparable(signal))) {
      return false;
    }
  }
  if (optionComparable && rationaleComparable.includes(optionComparable.slice(0, Math.min(36, optionComparable.length)))) return true;
  const optionTokens = tokenize(optionText).filter((token) => !MONETARY_TERMS.has(token));
  const rationaleTokens = new Set(tokenize(rationaleText));
  if (optionTokens.length === 0) return tokenOverlap(optionText, rationaleText) >= 2;
  const overlap = optionTokens.filter((token) => rationaleTokens.has(token)).length;
  if (overlap >= Math.min(3, optionTokens.length)) return true;
  const quotedOption = normalizeComparable(String(rationaleText || '').match(/"([^"]+)"/)?.[1] || '');
  return Boolean(quotedOption) && normalizeComparable(optionText).includes(quotedOption.slice(0, 24));
}

function inferTemplateSignature(body, questionType = '') {
  const text = String(body || '')
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?\s*(?:percent|crore|rs)?/g, '#')
    .replace(/\bm1\b|\bm2\b|\bm3\b/g, 'm#')
    .replace(/\s+/g, ' ')
    .trim();
  if (/simple deposit multiplier|required reserve ratio/.test(text)) return 'numerical_deposit_multiplier';
  if (/compare the four explanations|which comparison best captures/.test(text)) return 'meta_compare_explanations';
  if (/statement i:.*statement ii:/i.test(body)) return `statement_${normalizeComparable(extractStatementTwo(body)).slice(0, 80)}`;
  return `${questionType}:${text.split(' ').slice(0, 14).join('_')}`;
}

function extractStatementTwo(body) {
  const match = String(body || '').match(/Statement\s+II:\s*(.+?)(?:\s+Which option|\s*$)/i);
  return match ? match[1].trim() : '';
}

function deterministicUnit(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function normalizeSubjectId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (normalized === 'economics_business_economics') return 'economics';
  return toInternalSubjectId(normalized);
}

function inferEconomicsChapterFromSignals(signals) {
  const joined = signals.join(' ');
  if (/fiscal|budget|tax/.test(joined)) return 'Government Budget & the Economy';
  if (/national income|gdp|nnp/.test(joined)) return 'National Income & Related Aggregates';
  if (/consumer|utility|indifference/.test(joined)) return 'Introduction & Theory of Consumer Behaviour';
  if (/production|cost/.test(joined)) return 'Production & Costs';
  if (/balance of payments/.test(joined)) return 'Balance of Payments';
  return null;
}

function countRawQuestions(dir) {
  try {
    return loadRawEntries(listBatchFiles(dir)).length;
  } catch {
    return 0;
  }
}

function averageMetric(candidates, field) {
  const values = (candidates || [])
    .map((candidate) => Number((candidate.final_validation || candidate.mini_validation || {})[field]))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(field === 'answer_confidence' ? 3 : 2));
}

function averageRows(rows, field) {
  const values = (rows || [])
    .map((row) => Number(row?.[field]))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function selectValidationSample(candidates, sampleSize) {
  if (!Array.isArray(candidates) || sampleSize <= 0) return [];
  const byType = new Map();
  for (const candidate of candidates) {
    const type = candidate.question_type || 'unknown';
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(candidate);
  }
  const selected = [];
  while (selected.length < sampleSize && [...byType.values()].some((rows) => rows.length > 0)) {
    for (const rows of byType.values()) {
      if (rows.length > 0 && selected.length < sampleSize) {
        selected.push(rows.shift());
      }
    }
  }
  return selected;
}

function topRejectionReasons(rejected) {
  const counts = new Map();
  for (const row of rejected || []) {
    for (const reason of row.reasons || []) {
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
}

function tokenOverlap(left, right) {
  const leftTokens = new Set(tokenize(left));
  return tokenize(right).filter((token) => leftTokens.has(token)).length;
}

function tokenize(value) {
  return normalizeComparable(value)
    .split(' ')
    .filter((token) => token.length > 3 && !['because', 'correct', 'wrong', 'option', 'money', 'banking'].includes(token));
}

function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return normalizeComparable(value).replace(/\s+/g, '_');
}

function stripQuotes(value) {
  return String(value ?? '').replace(/^['"]|['"]$/g, '');
}

function clampScore(value) {
  return Number(Math.max(0, Math.min(10, Number(value || 0))).toFixed(2));
}

function clampUnit(value) {
  return Number(Math.max(0, Math.min(1, Number(value || 0))).toFixed(3));
}

function entryMeta(entry) {
  return {
    file: basename(entry.filePath),
    index: entry.index,
    local_id: entry.question?.local_id || null,
  };
}

function readJsonIfExists(path) {
  return existsSync(path) ? readJson(path) : null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}
