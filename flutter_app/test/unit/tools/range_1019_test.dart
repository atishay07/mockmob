// 19 Oct, G18 and G19 (D109): the typed range reads one way everywhere, the rows and the headline
// count with one rule in the same two words, and "I don't know my range yet" leads a fresh student
// to an estimate from one full mock in each subject. Pure: no phone, no network.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show practiceSubjectsProvider;
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/estimate/estimate.dart';
import 'package:mockmob/features/tools/estimate/estimate_copy.dart';
import 'package:mockmob/features/tools/estimate/estimate_providers.dart';
import 'package:mockmob/features/tools/estimate/mock_estimate.dart';
import 'package:mockmob/features/tools/estimate/range_choice.dart';
import 'package:mockmob/features/tools/estimate/range_price.dart';

import 'tools_test_support.dart';

Attempt _full(String subject, {required int correct, required int wrong, int day = 12, String mode = 'full'}) => Attempt.fromJson({
      'id': '$subject-$day-$correct',
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': 50 - correct - wrong,
      'total': 50,
      'mode': mode,
      'completedAt': DateTime.utc(2026, 10, day).toIso8601String(),
    });

/// One full mock each: English 195, Accountancy 140, Business Studies 206, Economics 172 (713).
List<Attempt> _fourMocks({int day = 12}) => [
      _full('english', correct: 40, wrong: 5, day: day),
      _full('accountancy', correct: 30, wrong: 10, day: day),
      _full('business_studies', correct: 42, wrong: 4, day: day),
      _full('economics', correct: 36, wrong: 8, day: day),
    ];

const _five = ['english', 'accountancy', 'economics', 'business_studies', 'mathematics'];
const _sel5 = DuSelection(languages: ['english'], domains: ['accountancy', 'economics', 'business_studies', 'mathematics']);

void main() {
  group('G18: one parser for a typed range', () {
    test('900-920, 910-920, "900 to 920", 900–920 and a swapped 920-900 all read as ranges', () {
      expect(parseRange('900-920'), const ParsedRange.ok(900, 920));
      expect(parseRange('910-920'), const ParsedRange.ok(910, 920));
      expect(parseRange('900 to 920'), const ParsedRange.ok(900, 920));
      expect(parseRange('900 TO 920'), const ParsedRange.ok(900, 920));
      expect(parseRange('900–920'), const ParsedRange.ok(900, 920));
      expect(parseRange('900 — 920'), const ParsedRange.ok(900, 920));
      expect(parseRange('900 920'), const ParsedRange.ok(900, 920));
      expect(parseRange('920-900'), const ParsedRange.ok(900, 920), reason: 'a lower second figure swaps');
      expect(parseRange('907.5'), const ParsedRange.ok(907.5, 907.5));
      expect(parseRange('907.5').isPoint, isTrue);
    });

    test('a gap over 200 marks is refused with a plain reason; exactly 200 is fine', () {
      expect(parseRange('700-950').problem, RangeProblem.tooWide, reason: 'a gap of 250');
      expect(parseRange('700 to 900').ok, isTrue, reason: 'a gap of 200');
      expect(EstimateCopy.problem(RangeProblem.tooWide), 'That range is wider than 200 marks, so it can’t tell you much. Try one like 850 to 950.');
    });

    test('nothing, words, a minus sign, three figures or a figure past 1000 are not a range', () {
      expect(parseRange('').problem, RangeProblem.empty);
      expect(parseRange(null).problem, RangeProblem.empty);
      expect(parseRange('abc').problem, RangeProblem.notANumber);
      expect(parseRange('-5').problem, RangeProblem.notANumber);
      expect(parseRange('5..').problem, RangeProblem.notANumber);
      expect(parseRange('900 or 920').problem, RangeProblem.notANumber);
      expect(parseRange('900-920-940').problem, RangeProblem.notANumber);
      expect(parseRange('1200').problem, RangeProblem.outOfScale);
      expect(parseRange('900920').problem, RangeProblem.outOfScale, reason: 'the old field dropped the dash and read this');
    });

    test('the two fields read as one range; From may hold a whole range while To is empty', () {
      expect(parseRangeFields('900', '920'), const ParsedRange.ok(900, 920));
      expect(parseRangeFields('920', '900'), const ParsedRange.ok(900, 920));
      expect(parseRangeFields('900 to 920', ''), const ParsedRange.ok(900, 920));
      expect(parseRangeFields('900', ''), const ParsedRange.ok(900, 900));
      expect(parseRangeFields('700', '950').problem, RangeProblem.tooWide);
      expect(parseRangeFields('', '920').problem, RangeProblem.empty);
      expect(parseRangeFields('900', '1150').problem, RangeProblem.outOfScale);
      expect(parseRangeFields('900-910', '920').problem, RangeProblem.notANumber);
      expect(parseRangeFields('900', '920').link, '900-920');
      expect(parseRangeFields('912', '').link, '912');
    });
  });

  group('G18: the rows and the headline count with one rule, in the same words', () {
    // The owner's four colleges, B.Com. (Hons.) Round 1, 2026, UR.
    const hindu = 919.8738, lsr = 912.5385, hansraj = 907.5044, kmc = 903.7315;
    const mine = [hindu, lsr, hansraj, kmc];

    test('900 to 920: all four are in reach, never "0 of 4 clear" beside "Within your range"', () {
      const e = Estimate(source: EstimateSource.typed, low: 900, high: 920);
      final reach = reachOf(e, mine);
      expect(reach, const Reach(inReach: 4));
      expect(EstimateCopy.yourColleges(reach), 'All 4 of your colleges are in reach.');
      for (final c in mine) {
        expect(verdictFor(e, c).v, Verdict.within);
        expect(verdictWords(verdictFor(e, c)), startsWith('In reach if you score'));
      }
      expect(verdictWords(verdictFor(e, hansraj)), 'In reach if you score 907.5');
    });

    test('910 to 920: two safe and two in reach, the rows saying the same', () {
      const e = Estimate(source: EstimateSource.typed, low: 910, high: 920);
      final reach = reachOf(e, mine);
      expect(reach, const Reach(safe: 2, inReach: 2));
      expect(EstimateCopy.yourColleges(reach), 'Of your 4 colleges, 2 are safe and 2 are in reach.');
      expect(verdictWords(verdictFor(e, kmc)), 'Safe, with 6.3 marks to spare');
      expect(verdictWords(verdictFor(e, hansraj)), 'Safe, with 2.5 marks to spare');
      expect(verdictWords(verdictFor(e, lsr)), 'In reach if you score 912.5');
      expect(verdictWords(verdictFor(e, hindu)), 'In reach if you score 919.9');
    });

    test('a single figure is safe or not; out of reach names the gap; no seat is left out', () {
      const point = Estimate(source: EstimateSource.typed, low: 910, high: 910);
      expect(reachOf(point, [...mine, null]), const Reach(safe: 2, below: 2));
      expect(verdictWords(verdictFor(point, hindu)), 'Needs 9.9 more');
      expect(EstimateCopy.meaning(point, 'UR'), 'Safe means 910 clears the Round 1, 2026 cutoff (unreserved).');
      expect(verdictWords(verdictFor(point, 910)), 'Safe, right at the cutoff');
      const range = Estimate(source: EstimateSource.typed, low: 900, high: 920);
      expect(EstimateCopy.meaning(range, 'UR'), endsWith('In reach means 920 does.'));
    });

    test('the headline sentences are grammatical for every count', () {
      expect(EstimateCopy.yourColleges(const Reach(safe: 1)), 'Your college is safe.');
      expect(EstimateCopy.yourColleges(const Reach(inReach: 1)), 'Your college is in reach.');
      expect(EstimateCopy.yourColleges(const Reach(below: 1)), 'Your college is not in reach yet.');
      expect(EstimateCopy.yourColleges(const Reach(safe: 4)), 'All 4 of your colleges are safe.');
      expect(EstimateCopy.yourColleges(const Reach(below: 3)), 'None of your 3 colleges is in reach yet.');
      expect(EstimateCopy.yourColleges(const Reach(safe: 1, inReach: 1, below: 2)), 'Of your 4 colleges, 1 is safe and 1 is in reach.');
      expect(EstimateCopy.courseReach(const Reach(safe: 3, inReach: 5, below: 46), 'B.Com. (Hons.)'), 'Of the 54 B.Com. (Hons.) colleges, 3 are safe and 5 are in reach.');
      expect(EstimateCopy.programmeReach(const Reach(safe: 3, inReach: 5, below: 46)), 'Of the 54 colleges here, 3 are safe and 5 are in reach.');
      expect(EstimateCopy.programmeReach(const Reach(below: 54)), 'None of the 54 colleges here is in reach yet.');
    });
  });

  group('G19: the estimate from full mocks has a spread', () {
    test('one mock each: the total plus and minus its spread, rounded out to fives', () {
      final m = mockEstimate(_fourMocks(), const DuSelection(languages: ['english'], domains: ['accountancy', 'business_studies', 'economics']));
      expect(m, isNotNull);
      expect(m!.centre, 713);
      expect(m.spread, closeTo(47.63, 0.01));
      expect(m.low, 665);
      expect(m.high, 765);
      expect(m.estimate.source, EstimateSource.mocks);
      expect(estimateRange(m.estimate), '665 to 765');
      expect(m.mocks, 4);
    });

    test('a fifth subject picks the best three domain papers; mocks that swing widen the range', () {
      final five = mockEstimate([..._fourMocks(), _full('mathematics', correct: 20, wrong: 15)], _sel5)!;
      expect(five.papers.map((p) => p.id), ['english', 'business_studies', 'economics', 'accountancy']);
      expect(five.centre, 713);
      final steady = mockEstimate([..._fourMocks(day: 10), ..._fourMocks(day: 12)], _sel5)!;
      final swinging = mockEstimate([
        ..._fourMocks(day: 12),
        _full('english', correct: 20, wrong: 20, day: 10),
        _full('accountancy', correct: 45, wrong: 0, day: 10),
      ], _sel5)!;
      expect(swinging.high - swinging.low, greaterThan(steady.high - steady.low));
    });

    test('no estimate without a language and three domain papers; NTA-style mocks count, practice does not', () {
      expect(mockEstimate(_fourMocks().take(3), _sel5), isNull);
      expect(mockEstimate([..._fourMocks().take(3), _full('economics', correct: 36, wrong: 8, mode: 'nta')], _sel5), isNotNull);
      expect(mockEstimate([..._fourMocks().take(3), _full('economics', correct: 36, wrong: 8, mode: 'quick')], _sel5), isNull);
    });
  });

  group('G19: the way to a range, one full mock per subject', () {
    test('one subject: one mock, then a plain ask for the other papers DU adds up', () {
      const one = DuSelection(languages: ['english']);
      final before = rangeProgress(const [], one);
      expect(before.total, 1);
      expect(before.next, 'english');
      expect(before.canTotal, isFalse);
      expect(
        EstimateCopy.progressLine(done: const [], next: 'English', canTotal: false, total: 1),
        'Sit one full English mock and we’ll estimate your range. DU adds up four papers, a language and three subjects, so add the rest of your subjects too.',
      );
      final after = rangeProgress([_full('english', correct: 40, wrong: 5)], one);
      expect(after.complete, isTrue);
      expect(after.estimate, isNull);
      expect(
        EstimateCopy.progressLine(done: const ['English'], next: null, canTotal: false, total: 1),
        'You’ve sat a full mock in each subject. DU adds up four papers, a language and three subjects, so add your other subjects and we’ll estimate your range.',
      );
    });

    test('three subjects: partial progress names what is done and what is next', () {
      const three = DuSelection(languages: ['english'], domains: ['accountancy', 'economics']);
      final p = rangeProgress([_full('accountancy', correct: 30, wrong: 10)], three);
      expect(p.done, 1);
      expect(p.total, 3);
      expect(p.next, 'english');
      expect(p.canTotal, isFalse);
      expect(p.estimate, isNull);
    });

    test('five subjects: the owner\'s sentence, an early estimate after four, ready after five', () {
      final two = rangeProgress(_fourMocks().take(2), _sel5);
      expect(two.doneIds, ['english', 'accountancy']);
      expect(two.next, 'economics');
      expect(
        EstimateCopy.progressLine(done: const ['English', 'Accountancy'], next: 'Economics', canTotal: true, total: 5),
        'Sit one full mock in each subject and we’ll estimate your range: English done, Accountancy done, Economics next.',
      );
      expect(EstimateCopy.progressLine(done: const [], next: 'English', canTotal: true, total: 5), 'Sit one full mock in each subject and we’ll estimate your range. Start with English.');
      final four = rangeProgress(_fourMocks(), _sel5);
      expect(four.complete, isFalse);
      expect(four.next, 'mathematics');
      expect(four.estimate, isNotNull, reason: 'the four papers DU counts are there');
      expect(EstimateCopy.soFar(four.estimate!.estimate), 'Your four papers so far add up to about 665 to 765 out of 1000.');
      final five = rangeProgress([..._fourMocks(), _full('mathematics', correct: 20, wrong: 15)], _sel5);
      expect(five.complete, isTrue);
      expect(five.next, isNull);
      expect(five.mocks, 5);
      expect(five.newest, DateTime.utc(2026, 10, 12));
    });
  });

  group('G19: the copy is honest', () {
    test('the estimate is called one, with its spread and the mocks behind it', () {
      expect(EstimateCopy.readyTruth(5), 'We estimated this from your 5 full mocks. One paper can swing either way, so it’s a range, and it gets sharper with every mock you sit.');
      expect(EstimateCopy.mocksTruth, contains('how far one paper usually swings'));
      expect(EstimateCopy.sitKey('Economics'), 'Sit a full Economics mock');
      expect(EstimateCopy.count(2, 5), '2 of 5 subjects done');
      expect(EstimateCopy.planNote(const Estimate(source: EstimateSource.mocks, low: 665, high: 765)), '665 to 765 out of 1000, from your full mocks');
      expect(EstimateCopy.planNote(const Estimate(source: EstimateSource.typed, low: 900, high: 920)), '900 to 920 out of 1000, typed by you');
      expect(EstimateCopy.planFinding(2, 5), 'Your mocks are finding it: 2 of 5 done.');
    });

    test('no line promises admission or calls the estimate certain', () {
      final lines = [
        EstimateCopy.readyTruth(5),
        EstimateCopy.unknownBody,
        EstimateCopy.unknownRing,
        EstimateCopy.soFar(const Estimate(source: EstimateSource.mocks, low: 665, high: 765)),
        EstimateCopy.yourColleges(const Reach(safe: 2, inReach: 2)),
        EstimateCopy.fieldHelp,
      ];
      for (final l in lines) {
        for (final banned in ['guarantee', 'certain', 'definitely', 'will get', 'chance', 'predict', '!']) {
          expect(l.toLowerCase().contains(banned), isFalse, reason: '"$banned" in "$l"');
        }
      }
    });
  });

  group('G19: the price of the next mock comes only from its quote', () {
    PracticeQuote q({bool launchable = true, String reasonCode = 'ok', int? cost = 50, int? balance = 90, QuoteAllowance? allowance}) => PracticeQuote(
          state: launchable ? 'available' : 'blocked',
          launchable: launchable,
          reasonCode: reasonCode,
          creditCost: cost,
          creditBalance: balance,
          subjectName: 'English',
          modeId: 'full',
          count: 50,
          allowance: allowance,
        );

    test('the first full mock free: the key says free and one true line says why', () {
      final p = rangeMockPrice(q(reasonCode: firstFullMockFree, cost: 0));
      expect(p.kind, RangeMockPriceKind.firstFree);
      expect(p.isFree, isTrue);
      expect(p.line, 'Your first full mock in every subject is free.');
      expect(EstimateCopy.sitFreeKey('English'), 'Sit your free full mock in English');
      expect(rangeMockPrice(q(allowance: const QuoteAllowance(kind: 'first_full_mock:english', state: 'available'), cost: 0)).kind, RangeMockPriceKind.firstFree);
    });

    test('a priced mock prints the Practice cost line; an unknown quote prints nothing; never free without the quote', () {
      final priced = rangeMockPrice(q());
      expect(priced.kind, RangeMockPriceKind.other);
      expect(priced.isFree, isFalse);
      expect(priced.line, '50 credits. You have 90.');
      expect(rangeMockPrice(null).kind, RangeMockPriceKind.unknown);
      expect(rangeMockPrice(null).line, isNull);
      // The reason alone is not enough: it must also charge nothing and be able to start.
      expect(rangeMockPrice(q(reasonCode: firstFullMockFree)).isFree, isFalse);
      expect(rangeMockPrice(q(reasonCode: firstFullMockFree, cost: 0, launchable: false)).isFree, isFalse);
      // A Pro account (no credit balance) is never told a mock is "free".
      expect(rangeMockPrice(q(reasonCode: firstFullMockFree, cost: 0, balance: null)).kind, isNot(RangeMockPriceKind.firstFree));
    });
  });

  group('G19: when Today shows the range card', () {
    ProviderContainer container({List<String> sheet = _five, List<Attempt> attempts = const [], MemoryPrefsStore? prefs, DateTime? now}) {
      final c = ProviderContainer(overrides: [
        ...toolsOverrides(sheet: sheet, attempts: attempts, prefs: prefs ?? MemoryPrefsStore()),
        if (now != null) nowProvider.overrideWithValue(() => now),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    Future<RangeCard> card(ProviderContainer c) async {
      await c.read(rangeChoiceProvider.future);
      return c.read(rangeCardProvider);
    }

    test('a fresh account with subjects sees the way, five steps, English first', () async {
      final c = container();
      final shown = await card(c);
      expect(shown, isA<RangeCardSteps>());
      expect((shown as RangeCardSteps).progress.total, 5);
      expect(shown.progress.next, 'english');
    });

    test('a subject practice does not offer is left out of the way, so the card never dead-ends on it', () async {
      final c = ProviderContainer(overrides: toolsOverrides(sheet: _five, attempts: _fourMocks(), practiceSubjects: [
        for (final id in ['english', 'accountancy', 'economics', 'business_studies']) Subject(id: id, internalId: id, name: id, practice: 'supported'),
        const Subject(id: 'mathematics', internalId: 'mathematics', name: 'Mathematics', practice: 'not_offered'),
      ]));
      addTearDown(c.dispose);
      await c.read(practiceSubjectsProvider.future);
      await c.read(rangeChoiceProvider.future);
      final shown = c.read(rangeCardProvider);
      expect(shown, isA<RangeCardReady>(), reason: 'four subjects, all with a full mock: the estimate is ready');
      expect((shown as RangeCardReady).progress.total, 4);
    });

    test('no subjects, a typed range or a taken estimate: nothing', () async {
      expect(await card(container(sheet: const [])), isA<RangeCardHidden>());
      final typed = MemoryPrefsStore();
      await container(prefs: typed).read(rangeChoiceProvider.notifier).chooseTyped();
      expect(await card(container(prefs: typed)), isA<RangeCardHidden>());
      final legacy = savedCompass('english,accountancy,business_studies,economics', score: '640');
      expect(await card(container(prefs: legacy)), isA<RangeCardHidden>(), reason: 'a range typed before this card existed');
      final taken = MemoryPrefsStore();
      final c = container(prefs: taken, attempts: [..._fourMocks(), _full('mathematics', correct: 20, wrong: 15)]);
      expect(await card(c), isA<RangeCardReady>());
      await c.read(rangeChoiceProvider.notifier).accept();
      expect(c.read(rangeCardProvider), isA<RangeCardHidden>());
    });

    test('"I don\'t know my range yet" shows it again after a typed range; every subject done makes it ready', () async {
      final prefs = MemoryPrefsStore();
      final c = container(prefs: prefs, attempts: [..._fourMocks(), _full('mathematics', correct: 20, wrong: 15)]);
      await c.read(rangeChoiceProvider.notifier).chooseTyped();
      expect(c.read(rangeCardProvider), isA<RangeCardHidden>());
      await c.read(rangeChoiceProvider.notifier).chooseUnknown();
      final ready = c.read(rangeCardProvider);
      expect(ready, isA<RangeCardReady>());
      expect(estimateRange((ready as RangeCardReady).estimate.estimate), '665 to 765');
      expect(c.read(rangePlanNoteProvider), '665 to 765 out of 1000, from your full mocks');
    });

    test('"Sit more mocks first" rests it until a newer full mock, which brings it back', () async {
      final prefs = MemoryPrefsStore();
      final all = [..._fourMocks(), _full('mathematics', correct: 20, wrong: 15)];
      final c = container(prefs: prefs, attempts: all, now: DateTime.utc(2026, 10, 14));
      expect(await card(c), isA<RangeCardReady>());
      await c.read(rangeChoiceProvider.notifier).rest();
      expect(c.read(rangeCardProvider), isA<RangeCardHidden>());
      expect(await card(container(prefs: prefs, attempts: all)), isA<RangeCardHidden>(), reason: 'remembered on this phone');
      final newer = container(prefs: prefs, attempts: [...all, _full('economics', correct: 40, wrong: 4, day: 15)]);
      expect(await card(newer), isA<RangeCardReady>());
    });

    test('Your plan says how far the mocks have got before there is a range, and a saved typed range', () async {
      final c = container(attempts: _fourMocks().take(2).toList());
      // Today has read the mocks by the time Your plan opens.
      expect(await card(c), isA<RangeCardSteps>());
      expect(c.read(rangePlanNoteProvider), 'Your mocks are finding it: 2 of 5 done.');
      // A range typed earlier reads from this phone without starting Compass.
      final typed = container(prefs: savedCompass('english,accountancy,business_studies,economics', score: '900')..values['mm.tools.compass.v1'] = '{"s":"english","c":"UR","score":"900","scoreHigh":"920"}');
      await typed.read(savedTypedEstimateProvider.future);
      expect(typed.read(rangePlanNoteProvider), '900 to 920 out of 1000, typed by you');
    });
  });
}
