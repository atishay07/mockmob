import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

// This builder is intentionally local-only. It reads registered source certificates
// and writes only to this benchmark directory; it never contacts a model/provider.
const ROOT = path.resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4');
const registry = JSON.parse(fs.readFileSync('data/source_registry.json', 'utf8'));
const { expectedReleaseBinding } = await import(pathToFileURL(path.join(process.cwd(), 'scripts/pipeline/lib/releaseEvidenceV7.mjs')).href);
const hash = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const excerpt = (sourceId, locator) => registry.sources[sourceId]?.facts?.[locator]?.text;
const syllabi = {
  english: 'cuet2026-english-syllabus',
  accountancy: 'cuet2026-accountancy-syllabus',
  business_studies: 'cuet2026-business_studies-syllabus',
  economics: 'cuet2026-economics-syllabus',
};

const items = [];
function add(subject, rootId, partition, spec) {
  const already = items.filter((x) => x.subject === subject).length;
  const correctIndex = already % 4;
  const correct = spec.options[0];
  const rest = spec.options.slice(1);
  const options = [...rest.slice(0, correctIndex), correct, ...rest.slice(correctIndex)];
  items.push({ subject, rootId, partition, ...spec, options, key: String.fromCharCode(65 + correctIndex) });
}

// English passages are original, self-contained stimuli, each within the official
// 300-word passage ceiling. The passage—not outside vocabulary knowledge—is truth.
const passages = [
  ['A factual', 'At a small coastal station, volunteers record the tide at six-hour intervals. They place a marked pole in the water and note the height where the surface meets it. After three months, the team noticed that the highest readings clustered around the full and new moons. The log did not show that the moon alone caused every change; wind and local weather also affected the water.', 'What pattern did the volunteers notice in the highest readings?', 'They clustered around full and new moons.', ['They occurred only during storms.', 'They appeared at exactly the same height every day.', 'They stopped when the weather changed.'], 'The passage reports the clustering and explicitly notes other influences, so it does not claim a single cause.'],
  ['A narrative', 'When Mira joined the school radio club, she spoke so quickly that the opening announcement ended before the music cue was ready. Her partner, Dev, suggested placing a pencil mark after each sentence in the script. Mira tried it the next day. The pauses felt awkward at first, but listeners could understand the announcements more easily. By the end of the month, she was making the pauses without looking at the marks.', 'What practical change helped Mira pace her announcement?', 'She marked pauses between sentences in the script.', ['She removed all music from the broadcast.', 'She asked Dev to read every announcement.', 'She shortened the school day.'], 'The story says Dev suggested a pencil mark after each sentence, which Mira used to pace herself.'],
  ['A factual', 'A neighbourhood library began lending seed packets alongside books. Each packet carried the plant name, sowing season, and a note asking borrowers to return a few seeds if their harvest allowed. The librarian kept a simple record of which packets were borrowed. The library did not require a seed return, because weather, soil, and household space varied from one borrower to another.', 'Why was returning seeds optional?', 'Harvest conditions varied among borrowers.', ['The library had no record of its packets.', 'Borrowers were forbidden to grow the seeds.', 'The packets contained no plant names.'], 'The passage directly gives differences in weather, soil, and household space as the reason.'],
  ['A narrative', 'During the first rehearsal, the theatre group could not agree on where to place a wooden bench. Ishan wanted it near the door; Leela thought the light from the window made the other corner better. They set the bench in both places and watched the scene from the back row. From there, the window corner left the actors’ faces visible. The group chose that position, though Ishan still preferred the door.', 'How did the group settle the disagreement?', 'They tested both positions from the audience’s viewpoint.', ['They followed Ishan’s preference without testing.', 'They chose the darkest corner.', 'They asked the audience to move the window.'], 'The passage states that they tried both positions and viewed the scene from the back row.'],
  ['A factual', 'A town repaired a footpath using small sections rather than closing the whole route. Workers blocked one section at a time and placed a temporary ramp beside it. A notice at each end showed which section was closed that day. The project took longer than a full closure might have, but people using wheelchairs could still pass the worksite with assistance.', 'What was the main access measure during repairs?', 'A temporary ramp was placed beside each closed section.', ['The entire route was permanently closed.', 'Workers removed every notice.', 'Repairs were done only at night.'], 'The text explicitly says a temporary ramp was placed beside each blocked section.'],
  ['A narrative', 'Rafi wanted to identify a bird he had heard before sunrise. He first guessed from the sound alone, then recorded the call on his phone. At the nature centre, a volunteer compared the rhythm with two field recordings. The volunteer did not name the bird immediately; she asked Rafi to listen for a repeated three-note ending. When he heard it, he revised his guess.', 'What evidence led Rafi to revise his guess?', 'The repeated three-note ending in the call.', ['The bird’s colour in a photograph.', 'The time the centre opened.', 'A label written on Rafi’s phone.'], 'The volunteer directed him to a repeated three-note ending, which changed his interpretation.'],
  ['A factual', 'The school greenhouse uses a paper chart to track watering. Each class records the date, the bed watered, and whether the soil felt dry before watering. The chart is not intended to measure plant growth; students use a separate ruler for that. After several weeks, the chart helped the classes notice that beds near the glass dried faster on sunny days.', 'What does the paper chart track?', 'Watering dates, beds, and soil dryness before watering.', ['Plant height in centimetres.', 'The number of sunny days each month.', 'The temperature inside every classroom.'], 'The passage lists the three chart entries and distinguishes them from growth measurements.'],
  ['A narrative', 'The bus was late, so Nila reached the examination hall with only a few minutes to spare. She did not rush into the room. At the entrance, she checked the seat number printed on her admit card against the list posted on the wall. The numbers matched. She then put her phone away and followed the invigilator’s directions.', 'What did Nila do before entering the room?', 'She checked her seat number against the posted list.', ['She called the bus driver.', 'She changed the number on her admit card.', 'She began writing before the invigilator arrived.'], 'The passage directly describes her comparing the admit-card number with the wall list.'],
  ['A literary', 'At dusk the market folded its bright awnings, one colour at a time. A vendor rinsed the last clay cups while the lane held the day’s warmth. Above the rooftops, the first lamp in the station tower blinked awake. Arun waited beneath it, not because the train was late, but because he had promised his sister he would walk home with her.', 'Why was Arun waiting beneath the tower lamp?', 'He had promised to walk home with his sister.', ['He was waiting for a market stall to reopen.', 'He had missed the last train.', 'He was watching the vendor close the market.'], 'The closing sentence gives his promise as the reason; the train was not late.'],
  ['A factual', 'A museum label for a repaired brass compass includes two dates: the year the compass was made and the year it was restored. The conservator kept both dates because restoration changes the object’s condition but does not change when it was originally made. A small diagram beside the label shows which parts were replaced.', 'Why does the label keep both dates?', 'They distinguish original manufacture from later restoration.', ['The object was made twice.', 'The restoration date replaces the original date.', 'The diagram records the compass direction each day.'], 'The passage says restoration and original manufacture are different events and dates.'],
];
for (let i = 0; i < passages.length; i++) {
  const [kind, passage, stem, key, wrong, explanation] = passages[i];
  add('english', `EN-${String(i + 1).padStart(2, '0')}`, i < 5 ? 'development' : 'release', {
    kind, passage, stem, options: [key, ...wrong], key: 'A', explanation,
    support: { sourceId: 'benchmark-authored-english-passages-v1', locator: `passage-${String(i + 1).padStart(2, '0')}`, text: passage, author: 'benchmark designer', sourceType: 'original stimulus' },
    syllabusClause: 'There will be three types of passages (maximum 300 words): a. Factual b. Narrative c. Literary',
    rootType: 'passage-root',
  });
}

// Accountancy: each fact is within current CUET Unit I. Numeric cases are explicit
// applications over facts stated in the stem; no unstated accounting convention is used.
const acc = [
  ['AC-01','quality-v4-168ad6e0001c','Which statement about a partnership agreement is supported by the source?','The agreement may be oral or written.',['It must always be registered before the firm exists.','It can be altered by one partner acting alone.','It cannot address profit sharing.'],'The source says the agreement may be oral or written; registration is described as preferable, not a condition of existence.'],
  ['AC-02','quality-v4-168ad6e0001c','Which item is commonly included in a written partnership deed?','The ratio in which partners share profits and losses.',['A guarantee that profits will never fall.','A rule that capital contributions must be identical.','A prohibition on changing any clause.'],'The cited deed excerpt lists the partners’ profit-and-loss sharing ratio among its usual contents.'],
  ['AC-03','quality-v4-63927dc5d1aa','If a partnership deed is silent about the profit-sharing ratio, what does the cited rule prescribe?','Partners share profits and losses equally.',['They share in proportion to their capital contributions.','The senior partner receives all profits.','The firm must retain all profits.'],'The exact cited rule says profits and losses are shared equally, irrespective of capital contribution.'],
  ['AC-04','quality-v4-63927dc5d1aa','When the deed is silent about interest on capital, which conclusion follows from the cited rule?','Interest on capital is not payable as a matter of right.',['Interest is automatically payable at 6% per annum.','Interest is calculated from each partner’s drawings.','The highest-capital partner sets the rate unilaterally.'],'The source says no interest is payable if the deed is silent; it requires express agreement.'],
  ['AC-05','quality-v4-63927dc5d1aa','Under the cited rule, when is interest charged on partners’ drawings?','When the deed mentions it.',['Whenever a partner withdraws cash, even if the deed is silent.','Only when the firm earns a loss.','Only after the partnership is dissolved.'],'The text states that no interest is charged on drawings if the deed does not mention it.'],
  ['AC-06','quality-v4-63927dc5d1aa','Which statement about partner remuneration is supported by the source?','A partner is not entitled to salary unless the deed provides for it.',['Every working partner is automatically entitled to salary.','Salary is always deducted from drawings.','A partner may set their own remuneration.'],'The cited clause requires a provision in the Partnership Deed for salary or other remuneration.'],
  ['AC-07','quality-v4-2981d89b7e0e','Match each capital method with the number of partner accounts described in the source.','Fixed capital: two accounts; fluctuating capital: one account.',['Fixed capital: one account; fluctuating capital: two accounts.','Both methods use two capital accounts and no current account.','Both methods use one account, with no difference in balance behaviour.'],'The source states two accounts for fixed capital (capital and current) and one account for fluctuating capital.'],
  ['AC-08','quality-v4-58bcdd89a054','What is the stated purpose of the Profit and Loss Appropriation Account?','It shows how firm profits are appropriated or distributed among partners.',['It records only cash sales.','It replaces the firm’s balance sheet.','It records only partners’ personal assets.'],'The source calls it an extension of the Profit and Loss Account that shows distribution/appropriation.'],
  ['AC-09','quality-v4-45047abeb583','A partner’s ratio-based profit share is below a guaranteed minimum. What does the cited rule require?','The shortfall is borne by the partner or partners who gave the guarantee.',['The shortfall is automatically shared by every partner equally.','The guarantee is ignored whenever the firm has profit.','The shortfall is charged to a customer.'],'The guarantee passage says the shortfall is borne by the guaranteeing partners, in their agreed ratio, or solely by one guarantor.'],
  ['AC-10','quality-v4-4386d49f5b11','What kind of issue does the source identify as a past adjustment?','An omission or error found after accounts are prepared and profits distributed.',['A routine estimate made before the accounting period.','A change to the firm’s name before its formation.','A forecast of future sales.'],'The source defines past adjustments as omissions or errors discovered after final accounts and profit distribution.'],
];
for (let i = 0; i < acc.length; i++) {
  const [id, locator, stem, keyText, wrong, explanation] = acc[i];
  add('accountancy', id, i < 5 ? 'development' : 'release', {
    stem, options: [keyText, ...wrong], key: 'A', explanation,
    support: { sourceId: 'ncert-leac101', locator, text: excerpt('ncert-leac101', locator) },
    syllabusClause: i < 2 ? 'Nature of Partnership Firm: Partnership deed (meaning, importance).' : 'Fixed v/s Fluctuating capital, Division of profit among partners, Profit and Loss Appropriation account, guarantee of profit to a partner, past adjustments.',
    rootType: 'textbook-rule',
  });
}

const bs = [
  ['BS-01','p26-c0','Which description of staffing is supported by the source?','It is the practice of finding, evaluating, and establishing a working relationship with people.',['Preparing an organisation’s financial statements.','Dismissing surplus employees only.','Appraising performance only after an employee leaves.'],'The cited source describes staffing as finding, evaluating, and establishing a working relationship with people for a purpose.'],
  ['BS-02','p26-c0','What does the source identify as the prime concern of staffing?','Timely fulfilment of manpower requirements.',['Increasing the firm’s selling price.','Preparing the balance sheet.','Reducing every job to a temporary contract.'],'The source states that staffing’s prime concern is timely fulfilment of manpower requirements.'],
  ['BS-03','p26-c0','According to the source, which statement about staffing is correct?','It is a function which all managers need to perform.',['It is performed only by a separate human resource department.','It is performed only by external recruitment agencies.','It begins only after an employee is hired.'],'The cited sentence explicitly says staffing is a function all managers need to perform.'],
  ['BS-04','p27-c0','Which option best states the source definition of recruitment?','Searching for prospective employees and stimulating them to apply for jobs.',['Choosing one candidate from the pool developed during recruitment.','Introducing a selected employee to organisational rules.','Increasing employees’ ability to perform specific jobs.'],'The source defines recruitment as searching for prospective employees and stimulating applications.'],
  ['BS-05','p27-c0','Selection is the process of choosing from which group, according to the source?','The pool of prospective job candidates developed at the recruitment stage.',['All employees who have already completed training.','Only candidates who have accepted a job offer.','People outside the organisation who have not applied.'],'The selection definition identifies the prospective-candidate pool created at recruitment as the group from which to choose.'],
  ['BS-06','p27-c0','Which activity does the source identify as orientation?','Introducing the selected employee to colleagues and familiarising the employee with organisational rules and policies.',['Searching for prospective employees and encouraging them to apply.','Choosing from the pool of prospective candidates.','Moving an employee to a different post.'],'The source defines orientation as introducing the selected employee to other employees and familiarising them with rules and policies.'],
  ['BS-07','p27-c0','Which pair does the source identify as the two important sources of internal recruitment?','Transfers and promotions.',['Advertisements and campus recruitment.','Employment exchanges and placement agencies.','Casual callers and labour contractors.'],'The cited passage explicitly names transfers and promotions as the two important internal sources.'],
  ['BS-08','p28-c0','Match the method to its category: Job Rotation; Case Study.','On-the-job; Off-the-job.',['Off-the-job; On-the-job.','On-the-job; On-the-job.','Off-the-job; Off-the-job.'],'The source lists Job Rotation under on-the-job methods and Case Study under off-the-job methods.'],
  ['BS-09','p28-c0','What does the source say training increases?','Employees’ aptitudes, skills and abilities to perform specific jobs.',['Only employees’ knowledge of organisational rules.','Only the number of employees in an organisation.','Employees’ salary without affecting job performance.'],'The cited definition says training increases aptitudes, skills and abilities for specific jobs.'],
  ['BS-10','p28-c0','What does development refer to in the cited passage?','Learning opportunities designed to help employees grow.',['A process limited to selecting candidates from a recruitment pool.','A method for increasing only the output of machines.','A rule that prevents employees from changing jobs.'],'The source directly defines development as learning opportunities designed to help employees grow.'],
];
for (let i = 0; i < bs.length; i++) {
  const [id, locator, stem, keyText, wrong, explanation] = bs[i];
  add('business_studies', id, i < 5 ? 'development' : 'release', {
    stem, options: [keyText, ...wrong], key: 'A', explanation,
    support: { sourceId: 'ncert-lebs106', locator, text: excerpt('ncert-lebs106', locator) },
    syllabusClause: ['Meaning, need and importance of staffing.','Meaning, need and importance of staffing.','Meaning, need and importance of staffing.','Recruitment – meaning, process and sources, Merits and demerits of internal and external sources of recruitment.','Selection – meaning and process.','Selection – meaning and process.','Selection – meaning and process.','Training and Development – meaning, need, methods – on the job and off the job methods of training.','Training and Development – meaning, need, methods – on the job and off the job methods of training.','Training and Development – meaning, need, methods – on the job and off the job methods of training.'][i],
    rootType: 'textbook-rule',
  });
}

const econ = [
  ['EC-01','ncert-keec106','p3-c1792','What does the source say about people who are self-employed?','They are also engaged in an economic activity.',['They are excluded from economic activity.','They are counted only if they work for an employer.','They are not included among workers.'],'The source states that people who are self-employed are also in an economic activity.'],
  ['EC-02','ncert-keec106','p4-c1872','What does a higher worker-population ratio indicate in the cited explanation?','A greater engagement of people in economic activity.',['A larger share of people is outside economic activity.','A higher price level.','A larger population, regardless of work.'],'The source interprets a higher ratio as greater engagement of people in economic activity.'],
  ['EC-03','ncert-keec106','p6-c1582','A person owns and runs a small cement shop. Which employment status does the source use for the shop owner?','Self-employed.',['Regular salaried employee.','Casual wage labourer.','Unemployed by definition.'],'The cited example identifies the cement-shop owner as self-employed.'],
  ['EC-04','ncert-keec106','p16-c1771','Why may agricultural workers migrate temporarily to urban areas during part of the year?','Agricultural work is seasonal, leaving periods without village farm work.',['Agriculture offers work in every village during every month.','Urban areas prohibit all temporary work.','The worker-population ratio is always zero in rural areas.'],'The passage explains that agriculture is seasonal and people seek urban work when farm work is unavailable.'],
  ['EC-05','ncert-keec106','p13-c0','Which benefit does the text associate with workers in the formal sector?','They enjoy social security benefits.',['They necessarily earn less than informal-sector workers.','They have no employment protections.','They are all self-employed.'],'The source directly states formal-sector workers enjoy social security benefits.'],
  ['EC-06','ncert-keec104','p4-c1815','Why does the source identify health expenditure as a source of human capital formation?','Sound health supports work and productivity.',['Health expenditure makes physical capital immobile.','It guarantees equal incomes for all workers.','It replaces education in every case.'],'The passage links ill health and lost productivity and identifies health expenditure as human-capital formation.'],
  ['EC-07','ncert-keec104','p6-c1905','Which comparison between physical and human capital is stated in the source?','Physical capital is separable from its owner; human capital is inseparable.',['Both are always inseparable from their owners.','Human capital is completely mobile across countries.','Physical capital creates only social benefits.'],'The source states this distinction explicitly.'],
  ['EC-08','ncert-keec105','p8-c1668','Which two changes make up diversification, according to the source?','A change in cropping pattern and a shift of workers to allied or non-agricultural activities.',['A change in currency and a shift from rural to foreign markets.','A change in school subjects and a shift of capital to cash.','A reduction in crops with no change in employment.'],'The cited paragraph names both cropping-pattern change and workforce shifts.'],
  ['EC-09','ncert-keec107','p2-c1870','Which resource is described as non-renewable in the source?','Fossil fuel.',['Trees in forests.','Fish in the ocean.','A resource that renews naturally without extraction.'],'The source gives fossil fuel as an example of non-renewable resources.'],
  ['EC-10','ncert-keec107','p14-c1876','Which idea is central to the cited account of sustainable development?','Meet present needs while minimising environmental damage and preserving future generations’ ability to meet their needs.',['Maximise present output regardless of future costs.','Stop all economic activity immediately.','Use resources only when they have no current value.'],'The cited source defines sustainable development by balancing current needs with the ability of future generations to meet theirs.'],
];
for (let i = 0; i < econ.length; i++) {
  const [id, sourceId, locator, stem, keyText, wrong, explanation] = econ[i];
  add('economics', id, i < 5 ? 'development' : 'release', {
    stem, options: [keyText, ...wrong], key: 'A', explanation,
    support: { sourceId, locator, text: excerpt(sourceId, locator) },
    syllabusClause: i < 5 ? 'Employment: Growth and changes in work force participation rate in formal and informal sectors; problems and policies' : i < 7 ? 'Human Capital Formation: How people become resource; Role of human capital in economic development; Growth of Education Sector in India' : i === 7 ? 'Rural development: Key issues - credit and marketing - role of cooperatives; agricultural market system, Agriculture diversification; alternative farming - organic farming' : 'Environment and Sustainable Development: Definition and Functions, State of India’s environment, Strategies for sustainable development.',
    rootType: 'textbook-rule',
  });
}

// Short, exact proof spans tie each authored key to a decisive part of its
// registered source. The full excerpt and source hashes are also frozen below.
const keyProofs = {
  'EN-01':'the highest readings clustered around the full and new moons.',
  'EN-02':'placing a pencil mark after each sentence in the script.',
  'EN-03':'weather, soil, and household space varied from one borrower to another.',
  'EN-04':'From there, the window corner left the actors’ faces visible.',
  'EN-05':'placed a temporary ramp beside it.',
  'EN-06':'a repeated three-note ending.',
  'EN-07':'the date, the bed watered, and whether the soil felt dry before watering.',
  'EN-08':'she checked the seat number printed on her admit card against the list posted on the wall.',
  'EN-09':'he had promised his sister he would walk home with her.',
  'EN-10':'restoration changes the object’s condition but does not change when it was originally made.',
  'AC-01':'The agreement can be either oral or written.',
  'AC-02':'ratio in which the profits and the losses will be shared by the partners',
  'AC-03':'the profits and losses of the firm are to be shared equally by partners',
  'AC-04':'no interest on capital is payable if the partnership deed is silent on the issue.',
  'AC-05':'No interest is to be charged on the drawings made by the partners, if there is no mention in the Deed.',
  'AC-06':'No partner is entitled to get salary or other remuneration for taking part in the conduct of the business of the firm unless there is a provision for the same in the Partnership Deed.',
  'AC-07':'capital account’ and ‘current account',
  'AC-08':'It shows how the profits are appropriated or distributed among the partners.',
  'AC-09':'This shall be borne by the guaranteeing partners',
  'AC-10':'omissions or errors in the recording of transactions or the preparation of summary statements are found after the final accounts have been prepared and the profits distributed among the partners.',
  'AC-COND-CAPITAL-INTEREST':'no interest on capital is payable if the partnership deed is silent on the issue.',
  'BS-01':'the practice of finding, evaluating and establishing a working relationship with people, for a purpose.',
  'BS-02':'The prime concern of the staffing function in the management process is the timely fulfillment of the manpower requirements within an organisation.',
  'BS-03':'Staffing is a function which all managers need to perform.',
  'BS-04':'Recruitment may be defined as the process of searching for prospective employees and stimulating them to apply for jobs in the organisation.',
  'BS-05':'Selection is the process of choosing from among the pool of the prospective job candidates developed at the stage of recruitment.',
  'BS-06':'Orientation is introducing the selected employee to other employees and familiarising him with the rules and policies of the organisation.',
  'BS-07':'There are two important sources of internal recruitment, namely, transfers and promotions.',
  'BS-08':'(iv) Job Rotation Off the Job Methods (i) Class Room Lectures/Conferences (ii) Films (iii) Case Study',
  'BS-09':'Training is any process by which the aptitudes, skills and abilities of employees to perform specific jobs are increased.',
  'BS-10':'Development refers to the learning opportunities designed to help employees grow.',
  'EC-01':'Those who are self-employed are also in an economic activity.',
  'EC-02':'engagement of people is greater;',
  'EC-03':'owner is self- employed.',
  'EC-04':'work in agriculture is seasonal;',
  'EC-05':'enjoy social security benefits.',
  'EC-06':'health is an important source of',
  'EC-07':'human capital is inseparable from its owner.',
  'EC-08':'Diversification includes two aspects - one relates to change in cropping pattern and the other relates to a shift of workforce from agriculture to other allied activities',
  'EC-09':'which get exhausted with extraction',
  'EC-10':'minimises environmental problems',
};

const subjects = ['english','accountancy','business_studies','economics'];
const defectKinds = ['wrong_key','overlapping_options','missing_decisive_condition','unsupported_explanation','syllabus_mismatch','numeric_error'];
const cases = [];
function certificate(item, caseId, label, defect = null, answerEvidence = null) {
  const src = item.support.sourceId === 'benchmark-authored-english-passages-v1' ? null : registry.sources[item.support.sourceId];
  const syllId = syllabi[item.subject];
  const syll = registry.sources[syllId];
  const fullSyllabus = syll.facts['full-syllabus'].text;
  const clause = item.syllabusClause;
  const normalize = (s) => s.replace(/\s+/g, ' ').trim().replace(/[–—]/g, '-').toLowerCase();
  const clauseFound = normalize(fullSyllabus).includes(normalize(clause));
  return {
    benchmarkId: caseId, rootFamily: item.rootId, partition: item.partition, subject: item.subject,
    label, defectCategory: defect,
    question: { stem: item.stem, passage: item.passage ?? null, options: item.options.map((text, i) => ({ id: String.fromCharCode(65+i), text })), proposedKey: item.proposedKey ?? item.key, explanation: item.explanation },
    certificate: {
      source: item.support.sourceId === 'benchmark-authored-english-passages-v1' ? {
        id: item.support.sourceId, type: 'benchmark-authored stimulus', locator: item.support.locator,
        identitySha256: hash(item.support.text), extractionSha256: hash(item.support.text), excerptSha256: hash(item.support.text), exactExcerpt: item.support.text,
        independenceNote: 'Authored by the benchmark designer; source truth is exact entailment from this sealed passage, not independent factual authority.'
      } : {
        id: item.support.sourceId, type: src.kind, url: src.url, locator: item.support.locator,
        identitySha256: src.identity_sha256, extractionSha256: src.extraction_sha256,
        excerptSha256: hash(item.support.text), exactExcerpt: item.support.text,
        version: src.version, permission: src.permission
      },
      syllabus: {
        sourceId: syllId, officialUrl: syll.url, identitySha256: syll.identity_sha256,
        extractionSha256: syll.extraction_sha256, exactEntitlement: clause,
        fullSyllabusExcerptSha256: hash(fullSyllabus), entitlementMatched: clauseFound,
        note: 'Official 2026 CUET syllabus used as the documented baseline; it is provisional for CUET UG 2027.'
      },
      decisiveAssumptions: item.decisiveAssumptions ?? [],
      groundTruthKey: item.groundTruthKey ?? item.key,
      derivation: item.derivation ?? item.explanation,
      answerEvidence: answerEvidence ?? (item.keyProof || keyProofs[item.rootId] ? {
        mode: item.keyProof ? 'deterministic-arithmetic' : 'exact-source-span',
        decisiveText: item.keyProof ?? keyProofs[item.rootId],
        excerptSha256: hash(item.support.text),
      } : null),
      defectCertificate: defect ? item.defectCertificate : null,
      rootIndependence: 'One source/concept family; dependent controlled cases in the same family are not independent n.'
    }
  };
}

// One valid original per family. The three test variants are controlled defects,
// not extra independent roots. The public report will retain this distinction.
for (const item of items) {
  const family = item.rootId;
  const baseId = `${item.subject}-${family}-valid`;
  cases.push(certificate(item, baseId, 'valid'));
  const correctIndex = item.key.charCodeAt(0) - 65;
  const wrongKey = String.fromCharCode(65 + ((correctIndex + 1) % 4));
  cases.push(certificate({ ...item, proposedKey: wrongKey, defectCertificate: { actualKey: item.key, proposedKey: wrongKey, reason: 'Proposed key conflicts with the source-supported unique answer.' } }, `${item.subject}-${family}-wrong-key`, 'invalid', 'wrong_key'));
  const duplicateOptions = [...item.options];
  const duplicateIndex = (correctIndex + 1) % 4;
  duplicateOptions[duplicateIndex] = duplicateOptions[correctIndex];
  const secondKey = String.fromCharCode(65 + duplicateIndex);
  cases.push(certificate({ ...item, options: duplicateOptions, groundTruthKey: [item.key, secondKey], defectCertificate: { defensibleKeys: [item.key, secondKey], reason: 'A distractor duplicates the keyed answer in meaning, creating two correct choices.' } }, `${item.subject}-${family}-overlap`, 'invalid', 'overlapping_options'));
  cases.push(certificate({ ...item, explanation: `${item.explanation} The source also says the opposite of the keyed statement.`, defectCertificate: { unsupportedClaim: 'The source also says the opposite of the keyed statement.', evidenceLocator: item.support.locator, reason: 'The explanation adds a contradictory claim not entailed by its cited evidence.' } }, `${item.subject}-${family}-unsupported-explanation`, 'invalid', 'unsupported_explanation'));
}

// Additional tightly controlled cases only where the official syllabus itself
// supplies a decisive boundary or a scenario supplies every numeric input.
const accSyllabus = registry.sources['cuet2026-accountancy-syllabus'];
const exclusions = [
  ['AC-EX-01','Piecemeal distribution of cash among partners.','excluding piecemeal distribution',15000,2,1],
  ['AC-EX-02','Sale of the firm to a company on dissolution.','excluding ... sale to a company',24000,1,2],
  ['AC-EX-03','Insolvency of a partner during dissolution.','excluding ... insolvency of a Partner',18000,3,1],
];
for (let i = 0; i < exclusions.length; i++) {
  const [exId, excludedTopic, excludedPhrase, total, firstShare, secondShare] = exclusions[i];
  const unitClause = 'Unit III:  Dissolution of Partnership Firm  • Meaning, Settlement of accounts: Preparation of Realisation Account and related Accounts (excluding piecemeal distribution, sale to a company and insolvency of a Partner).';
  const value = total * firstShare / (firstShare + secondShare);
  const distractors = [value + 1000, total, total * secondShare / (firstShare + secondShare)];
  const item = { subject: 'accountancy', rootId: exId, partition: i < 2 ? 'development' : 'release', stem: `During ${excludedTopic.toLowerCase()} a stated amount of ₹${total} is allocated between two partners in the explicit ratio ${firstShare}:${secondShare}. How much does the first partner receive?`, options: [`₹${value}`, ...distractors.map(x => `₹${x}`)], key: 'A', proposedKey: 'A', explanation: `The prompt supplies the allocation ratio, so the first partner receives ${firstShare}/${firstShare+secondShare} of ₹${total} = ₹${value}. The accounting subtopic is explicitly excluded.`, groundTruthKey: 'A', derivation: `${total} × ${firstShare}/${firstShare+secondShare} = ${value}; no unstated accounting convention is needed.`, keyProof: `${total}*${firstShare}/${firstShare+secondShare}=${value}`, syllabusClause: unitClause, support: { sourceId: 'cuet2026-accountancy-syllabus', locator: 'full-syllabus', text: accSyllabus.facts['full-syllabus'].text }, defectCertificate: { correctValue: value, excludedPhrase, exactSyllabusText: 'excluding piecemeal distribution, sale to a company and insolvency of a Partner', reason: 'The tested accounting context is explicitly excluded from Unit III; arithmetic alone does not make the topic CUET-entitled.' } };
  const c = certificate(item, `accountancy-${exId}`, 'invalid', 'syllabus_mismatch', { mode: 'deterministic-arithmetic', decisiveText: item.keyProof, excerptSha256: hash(item.support.text) });
  cases.push(c);
}

// One under-specified case: the supplied NCERT default only applies when the
// deed is silent. The prompt omits whether a written rate is present; the stem
// itself does not provide a uniquely determined answer.
{
  const sourceText = excerpt('ncert-leac101','quality-v4-63927dc5d1aa');
  const item = { subject:'accountancy', rootId:'AC-COND-CAPITAL-INTEREST', partition:'development', stem: 'A partner contributes capital to a firm. What annual rate of interest should be credited to the capital account?', options: ['0%.', '6%.', '12%.', 'The rate agreed by the partners.'], key: null, proposedKey: null, explanation: 'The cited rule makes interest conditional on express agreement, but the prompt omits whether such an agreement exists and gives no agreed rate.', groundTruthKey: null, decisiveAssumptions: ['Whether the partnership deed expressly provides for interest on capital.', 'The agreed rate, if a provision exists.'], derivation: 'The source says interest is allowed when expressly agreed and is not payable if the deed is silent. Because the prompt gives no deed term or rate, none of the proposed specific rates can be uniquely selected.', support: { sourceId: 'ncert-leac101', locator: 'quality-v4-63927dc5d1aa', text: sourceText }, syllabusClause: 'Fixed v/s Fluctuating capital, Division of profit among partners, Profit and Loss Appropriation account, guarantee of profit to a partner, past adjustments.', defectCertificate: { omittedFact: 'Whether the deed expressly provides for interest on capital and what rate it specifies.', sourceRule: 'No interest on capital is payable if the deed is silent; interest may be allowed when expressly agreed.', alternativeReasonableReading: 'The deed may be silent (no interest), or may specify a rate (the specified amount applies).', reason: 'Missing decisive condition/value changes the answer.' } };
  cases.push(certificate(item, 'accountancy-AC-COND-CAPITAL-INTEREST', 'invalid', 'missing_decisive_condition'));
}

// Numeric fault set: prompt facts make the arithmetic deterministic; one false
// keyed result per item. The numbers are designed stimuli, not NCERT-sourced data.
for (let i = 0; i < 30; i++) {
  const profit = 42000 + i * 3000;
  const numerator = i % 2 === 0 ? 2 : 3;
  const denominator = 5;
  const correct = profit * numerator / denominator;
  const wrong = correct - 1000;
  const item = {
    subject: 'accountancy', rootId: 'AC-NUM-PROFIT-SHARE-ARITHMETIC', partition: 'development',
    stem: `Two partners share profit in the stated ratio ${numerator}:${denominator-numerator}. The firm has distributable profit of ₹${profit}. Using only these facts, what is the first partner’s share?`,
    options: [`₹${correct}`, `₹${wrong}`, `₹${profit}`, `₹${Math.round(profit/2)}`], key: 'A', proposedKey: 'B',
    explanation: `The first partner receives ${numerator}/${denominator} of ₹${profit}, which is ₹${correct}.`, keyProof: `${profit}*${numerator}/${denominator}=${correct}`,
    groundTruthKey: 'A', derivation: `${profit} × ${numerator}/${denominator} = ${correct}.`, decisiveAssumptions: [],
    support: { sourceId: 'ncert-leac101', locator: 'quality-v4-2981d89b7e0e', text: excerpt('ncert-leac101','quality-v4-2981d89b7e0e') },
    syllabusClause: 'Division of profit among partners',
    defectCertificate: { correctValue: correct, computed: `${profit}*${numerator}/${denominator}`, proposedKey: 'B', proposedValue: wrong, reason: 'The proposed key points to an arithmetically incorrect value; the stem supplies all inputs.' }
  };
  cases.push(certificate(item, `accountancy-AC-NUM-${String(i+1).padStart(2,'0')}`, 'invalid', 'numeric_error', { mode: 'deterministic-arithmetic', decisiveText: item.keyProof, correctValue: correct, excerptSha256: hash(item.support.text) }));
}

// Validate inputs and exact source binding before freezing.
const knownCounts = Object.fromEntries(subjects.map(s => [s, { valid: 0, invalid: 0, roots: new Set() }]));
for (const c of cases) {
  if (!c.certificate.source.exactExcerpt || !c.certificate.source.excerptSha256) throw new Error(`Missing source evidence ${c.benchmarkId}`);
  if (!c.certificate.syllabus.entitlementMatched) throw new Error(`Syllabus clause check failed ${c.benchmarkId}`);
  const stat = knownCounts[c.subject]; stat[c.label]++; stat.roots.add(c.rootFamily);
}
const devRoots = new Set(cases.filter(c => c.partition === 'development').map(c => c.rootFamily));
const releaseRoots = new Set(cases.filter(c => c.partition === 'release').map(c => c.rootFamily));
for (const root of devRoots) if (releaseRoots.has(root)) throw new Error(`Root leakage across partitions: ${root}`);
const summary = Object.fromEntries(subjects.map(s => [s, { valid: knownCounts[s].valid, invalid: knownCounts[s].invalid, rootFamilies: knownCounts[s].roots.size }]));
const defects = Object.fromEntries(defectKinds.map(k => [k, cases.filter(c => c.defectCategory === k).length]));
const dev = cases.filter(c => c.partition === 'development');
const release = cases.filter(c => c.partition === 'release');
const index = {
  benchmark: 'verified-rule-v4', status: 'PRE-JUDGMENT / LABELS-FROZEN', cases: cases.length,
  subjects: summary, defectCategories: defects,
  rootFamilies: [...new Set(cases.map(c => c.rootFamily))].length,
  partitions: { development: { cases: dev.length, roots: [...new Set(dev.map(c => c.rootFamily))].length }, release: { cases: release.length, roots: [...new Set(release.map(c => c.rootFamily))].length } },
  designDisclosure: 'Benchmark designed by the same agent that contributed to validator design. It is independent of generation authoring and uses no paid model judgments, but it is not an independent external audit. Controlled variants share a root and are not independent n.',
  roots: [...new Set(cases.map(c => c.rootFamily))].sort(),
  payloadSha256: hash(JSON.stringify([...dev, ...release])),
  developmentSha256: hash(JSON.stringify(dev)),
  releaseSha256: hash(JSON.stringify(release)),
  sourceRegistryVersion: registry.version,
  noProviderCalls: true,
  evaluationStatus: 'not_evaluated',
  releaseResult: null,
  release_eligibility: {
    scope: 'diagnostic', classification: 'fresh',
    preregistration_id: 'verified-rule-v4-diagnostic-2026-10-08-01',
    approved_before_evaluation: true, previously_read: false, tuned_on: false,
  },
  verifier_version: expectedReleaseBinding().verifier_version,
  contract_binding: expectedReleaseBinding(),
  frozenAt: new Date().toISOString(),
};
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'development'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'release-sealed'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'development', 'cases.json'), JSON.stringify(dev, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'release-sealed', 'cases.json'), JSON.stringify(release, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'freeze.json'), JSON.stringify(index, null, 2) + '\n');
console.log(JSON.stringify({ ...index, roots: `(${index.roots.length} root ids omitted in console)` }, null, 2));
