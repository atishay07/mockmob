import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/features/practice/data/launch_flow.dart';
import 'package:mockmob/features/practice/model/cost_line.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';

PracticeQuote q({
  String state = 'available',
  bool launchable = true,
  String reasonCode = 'ok',
  String? reason,
  int? cost,
  int? balance,
  Map<String, dynamic>? allowance,
  String entitlement = 'free',
  String subject = 'Accountancy',
}) => PracticeQuote.fromJson({
  'state': state,
  'launchable': launchable,
  'reasonCode': reasonCode,
  'reason': reason,
  'creditCost': cost,
  'creditBalance': balance,
  'allowance': allowance,
  'entitlement': {'kind': entitlement},
  'subject': {'id': 'accountancy', 'name': subject},
  'expiresAt': '2026-10-12T16:01:00Z',
});

void main() {
  group('costLineFor (every word comes from the quote)', () {
    test('daily practice is "Free today"', () {
      final line = costLineFor(q(cost: 0, balance: 100, allowance: {'kind': 'daily_practice', 'state': 'available'}));
      expect(line.kind, CostKind.freeToday);
      expect(line.text, 'Free today');
    });

    test('a first-use allowance names the subject', () {
      final baseline = costLineFor(q(cost: 0, balance: 100, allowance: {'kind': 'baseline:accountancy', 'state': 'available'}));
      expect(baseline.text, 'Free, your first one in Accountancy');
      final sample = costLineFor(
        q(cost: 0, balance: 100, allowance: {'kind': 'full_sample:economics', 'state': 'available'}, subject: 'Economics'),
      );
      expect(sample.text, 'Free, your first one in Economics');
    });

    test('credits are quoted with the balance', () {
      final line = costLineFor(q(cost: 50, balance: 120));
      expect(line.kind, CostKind.credits);
      expect(line.text, 'Uses 50 credits. You have 120.');
    });

    test('a used allowance falls back to the ordinary cost', () {
      final line = costLineFor(q(cost: 10, balance: 100, allowance: {'kind': 'daily_practice', 'state': 'used'}));
      expect(line.text, 'Uses 10 credits. You have 100.');
    });

    test('Pro has no cost line', () {
      expect(costLineFor(q(cost: 0, entitlement: 'access')).kind, CostKind.none);
    });

    test('access_required is the Pro gate, with no price anywhere', () {
      final line = costLineFor(q(state: 'blocked', launchable: false, reasonCode: 'access_required', reason: 'NTA Mode needs Pro.'));
      expect(line.kind, CostKind.proGated);
      expect(line.text, 'Part of Pro');
      expect(line.text, isNot(contains('Rs')));
    });

    test('a blocked quote shows words chosen by its reason code, never the server text', () {
      final line = costLineFor(
        q(state: 'unavailable', launchable: false, reasonCode: 'inventory_insufficient', reason: 'Economics has 3 usable questions.'),
      );
      expect(line.kind, CostKind.blocked);
      expect(line.text, 'We do not have enough questions for this yet.');
    });

    test('insufficient credits still states the cost and the balance', () {
      final line = costLineFor(
        q(state: 'blocked', launchable: false, reasonCode: 'insufficient_credits', reason: 'costs 10', cost: 10, balance: 8),
      );
      expect(line.kind, CostKind.credits);
      expect(line.text, 'Uses 10 credits. You have 8.');
    });
  });

  group('credits low', () {
    final low = q(state: 'blocked', launchable: false, reasonCode: 'insufficient_credits', cost: 10, balance: 8);

    test('quick and chapter practice use the exact spec sentence', () {
      final c = creditsLowFor(low)!;
      expect(c.message(PracticeMode.quick), 'You have 8 credits. A Quick practice costs 10, and chapter practice costs the same.');
      expect(c.message(PracticeMode.chapter), c.message(PracticeMode.quick));
    });

    test('only an insufficient_credits quote is credits low', () {
      expect(creditsLowFor(q(cost: 10, balance: 100)), isNull);
      expect(creditsLowFor(q(state: 'blocked', launchable: false, reasonCode: 'access_required')), isNull);
    });
  });

  group('NTA-style visibility', () {
    test('shown when the quote returns the mode, hidden when it does not', () {
      expect(quoteOffersMode(q(state: 'blocked', launchable: false, reasonCode: 'access_required')), isTrue);
      expect(quoteOffersMode(q(cost: 0)), isTrue);
      expect(quoteOffersMode(q(state: 'unavailable', launchable: false, reasonCode: 'mode_unavailable')), isFalse);
      expect(quoteOffersMode(q(state: 'unavailable', launchable: false, reasonCode: 'mode_unknown')), isFalse);
    });
  });

  group('launch purpose', () {
    test('comes only from an available allowance', () {
      expect(launchPurposeFor(q(allowance: {'kind': 'baseline:accountancy', 'state': 'available'})), 'baseline');
      expect(launchPurposeFor(q(allowance: {'kind': 'full_sample:accountancy', 'state': 'available'})), 'full_sample');
      expect(launchPurposeFor(q(allowance: {'kind': 'daily_practice', 'state': 'available'})), isNull);
      expect(launchPurposeFor(q(allowance: {'kind': 'full_sample:accountancy', 'state': 'used'})), isNull);
      expect(launchPurposeFor(q()), isNull);
    });
  });

  group('selection', () {
    test('count is only ever 5, 10, 15 or 20', () {
      expect(practiceCounts, [5, 10, 15, 20]);
      expect(nearestPracticeCount(null), 10);
      expect(nearestPracticeCount(7), 5);
      expect(nearestPracticeCount(13), 15);
      expect(nearestPracticeCount(50), 20);
    });

    test('a Full mock asks the quote with full_sample, Quick practice with nothing', () {
      expect(
        const PracticeSelection(mode: PracticeMode.full, subjectId: 'accountancy').quoteQuery,
        const QuoteQuery(subject: 'accountancy', apiMode: 'full', count: 50, purpose: 'full_sample'),
      );
      expect(
        const PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy', count: 15).quoteQuery,
        const QuoteQuery(subject: 'accountancy', apiMode: 'quick', count: 15),
      );
    });

    test('chapter practice quotes exactly like Quick practice', () {
      const a = PracticeSelection(mode: PracticeMode.chapter, subjectId: 'economics', chapter: 'Money', count: 10);
      const b = PracticeSelection(mode: PracticeMode.quick, subjectId: 'economics', count: 10);
      expect(a.quoteQuery, b.quoteQuery);
      expect(a.mode.apiMode, 'quick');
    });

    test('chapter practice is incomplete until a chapter is chosen', () {
      expect(const PracticeSelection(mode: PracticeMode.chapter, subjectId: 'economics').isComplete, isFalse);
      expect(const PracticeSelection(mode: PracticeMode.chapter, subjectId: 'economics', chapter: 'Money').isComplete, isTrue);
      expect(const PracticeSelection(mode: PracticeMode.quick, subjectId: 'economics').isComplete, isTrue);
    });
  });

  group('cost changes between the quote shown and the fresh one', () {
    test('only a dearer fresh quote counts as a change', () {
      final free = q(cost: 0, balance: 100, allowance: {'kind': 'daily_practice', 'state': 'available'});
      final paid = q(cost: 10, balance: 100);
      expect(costWentUp(free, paid), isTrue);
      expect(costWentUp(paid, free), isFalse);
      expect(costWentUp(paid, paid), isFalse);
    });
  });

  group('quote expiry', () {
    test('a quote is expired from its expiresAt', () {
      final quote = q();
      expect(quote.isExpiredAt(DateTime.utc(2026, 10, 12, 16, 0, 59)), isFalse);
      expect(quote.isExpiredAt(DateTime.utc(2026, 10, 12, 16, 1)), isTrue);
    });
  });
}
