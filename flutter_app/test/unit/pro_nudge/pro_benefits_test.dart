// The Upgrade sheet's lines: each personal line only when it is true, never invented, ordered by
// relevance, the plain list as the fallback. And the copy keeps the store's rules.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/pro_nudge/copy.dart';
import 'package:mockmob/features/pro_nudge/data/pro_benefits.dart';

void main() {
  group('personal lines', () {
    test('nothing known: no personal line, and the sheet shows the plain list', () {
      expect(ProBenefits.personal(ProFacts.empty), isEmpty);
      expect(ProBenefits.lines(ProFacts.empty), ProNudgeCopy.plainBenefits);
      expect(ProBenefits.isPersonal(ProFacts.empty), isFalse);
    });

    test('each line appears only when its figure is true', () {
      String? idOf(ProFacts f, String id) => ProBenefits.personal(f, limit: 9).where((b) => b.id == id).map((b) => b.text).firstOrNull;

      expect(idOf(const ProFacts(mocksTaken: 0), 'mocks'), isNull);
      expect(idOf(const ProFacts(mocksTaken: 1), 'mocks'), contains('1 mock behind you'));
      expect(idOf(const ProFacts(mocksTaken: 4), 'mocks'), contains('4 mocks behind you'));

      expect(idOf(const ProFacts(weakestChapter: 'Accounting Ratios'), 'weakest'), contains('Accounting Ratios'));
      expect(idOf(const ProFacts(weakestSubject: 'Economics'), 'weakest'), contains('Economics'));
      expect(idOf(const ProFacts(weakestChapter: '  '), 'weakest'), isNull);

      // Credits used: unknown and zero say nothing; a floor says "at least".
      expect(idOf(const ProFacts(), 'used'), isNull);
      expect(idOf(const ProFacts(creditsUsed: 0), 'used'), isNull);
      expect(idOf(const ProFacts(creditsUsed: 120), 'used'), contains('used 120 practice credits'));
      expect(idOf(const ProFacts(creditsUsed: 30, creditsUsedAtLeast: true), 'used'), contains('at least 30 practice credits'));
      expect(idOf(const ProFacts(creditsUsed: 1), 'used'), contains('1 practice credit so far'));

      // Credits left: unknown says nothing; plenty says nothing; low says so.
      expect(idOf(const ProFacts(), 'left'), isNull);
      expect(idOf(const ProFacts(practiceCredits: ProBenefits.lowCredits), 'left'), isNull);
      expect(idOf(const ProFacts(practiceCredits: 8), 'left'), contains('only 8 practice credits left'));
      expect(idOf(const ProFacts(practiceCredits: 0), 'left'), contains('no practice credits left'));

      // Subjects: one subject says nothing.
      expect(idOf(const ProFacts(subjectCount: 1), 'subjects'), isNull);
      expect(idOf(const ProFacts(subjectCount: 3), 'subjects'), contains('all 3 of your subjects'));

      expect(idOf(const ProFacts(targetColleges: 0), 'colleges'), isNull);
      expect(idOf(const ProFacts(targetColleges: 1), 'colleges'), contains('your target college.'));
      expect(idOf(const ProFacts(targetColleges: 2), 'colleges'), contains('your 2 target colleges'));
    });

    test('a chapter is preferred to its subject, and the subject stands in when there is no chapter', () {
      final both = ProBenefits.personal(const ProFacts(weakestChapter: 'Ratios', weakestSubject: 'Accountancy'), limit: 9);
      expect(both.where((b) => b.id == 'weakest'), hasLength(1));
      expect(both.first.text, contains('Ratios'));
      expect(both.first.text, isNot(contains('Accountancy')));
    });

    test('ordered by relevance, and capped at three', () {
      const all = ProFacts(
        mocksTaken: 3,
        weakestChapter: 'Ratios',
        creditsUsed: 90,
        practiceCredits: 8,
        subjectCount: 3,
        targetColleges: 2,
      );
      final lines = ProBenefits.personal(all);
      expect(lines, hasLength(ProBenefits.maxPersonal));
      expect([for (final b in lines) b.id], ['weakest', 'left', 'used']);
      expect(ProBenefits.personal(all, limit: 9), hasLength(6));
    });

    test('the feature that asked for Pro lifts its own line', () {
      const f = ProFacts(mocksTaken: 3, weakestChapter: 'Ratios', creditsUsed: 90);
      expect(ProBenefits.personal(f).first.id, 'weakest');
      expect(ProBenefits.personal(f, reason: ProReason.ntaMode).first.id, 'mocks');
      expect(ProBenefits.personal(f, reason: ProReason.practiceCredits).first.id, 'used');
    });

    test('the sheet tops a short personal list up from the plain list, and never repeats a line', () {
      final lines = ProBenefits.lines(const ProFacts(mocksTaken: 2));
      expect(lines, hasLength(3));
      expect(lines.first, contains('2 mocks'));
      expect(lines.toSet(), hasLength(lines.length));
      expect(ProBenefits.isPersonal(const ProFacts(mocksTaken: 2)), isTrue);
    });
  });

  group('the copy keeps the rules', () {
    final all = <String>[
      ProNudgeCopy.sheetTitle,
      ProNudgeCopy.headlineB,
      ProNudgeCopy.headlineC,
      ProNudgeCopy.sheetLabel,
      ProNudgeCopy.forYouHeading,
      ProNudgeCopy.includesHeading,
      ProNudgeCopy.gateAction,
      ProNudgeCopy.nudgeAction,
      ProNudgeCopy.nudgeDismiss,
      ProNudgeCopy.unlimitedMocks,
      ProNudgeCopy.noCreditsForPractice,
      ProNudgeCopy.noCreditsForChapter,
      ProNudgeCopy.afterResult,
      ProNudgeCopy.creditsRunLow,
      ...ProNudgeCopy.plainBenefits,
      for (final r in ProReason.values) ProNudgeCopy.reasonLine(r),
      for (final s in ProNudgeSurface.values) ProNudgeCopy.lineFor(s),
      ProNudgeCopy.weakestChapter('Ratios'),
      ProNudgeCopy.weakestSubject('Economics'),
      ProNudgeCopy.mocksTaken(1),
      ProNudgeCopy.mocksTaken(7),
      ProNudgeCopy.creditsUsed(1, atLeast: false),
      ProNudgeCopy.creditsUsed(80, atLeast: true),
      ProNudgeCopy.creditsLeft(0),
      ProNudgeCopy.creditsLeft(1),
      ProNudgeCopy.creditsLeft(9),
      ProNudgeCopy.subjects(3),
      ProNudgeCopy.colleges(1),
      ProNudgeCopy.colleges(3),
    ];

    test('no exclamation marks, no emoji, no price, no mention of the website or checkout, no fake scarcity', () {
      final emoji = RegExp(r'[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]', unicode: true);
      final price = RegExp(r'[₹€£]|\$\d|\bRs\b|\bINR\b|\d+\s*(rupees|per month|a month)', caseSensitive: false);
      final steering = RegExp(r'website|\bweb\b|mockmob\.in|checkout|cheaper|discount', caseSensitive: false);
      final scarcity = RegExp(r'offer ends|only today|last chance|hurry|limited time|expires', caseSensitive: false);
      for (final line in all) {
        expect(line.contains('!'), isFalse, reason: line);
        expect(emoji.hasMatch(line), isFalse, reason: line);
        expect(price.hasMatch(line), isFalse, reason: line);
        expect(steering.hasMatch(line), isFalse, reason: line);
        expect(scarcity.hasMatch(line), isFalse, reason: line);
      }
    });

    test('every surface and every reason has its own words', () {
      for (final s in ProNudgeSurface.values) {
        expect(ProNudgeCopy.lineFor(s).trim(), isNotEmpty);
      }
      for (final r in ProReason.values) {
        expect(ProNudgeCopy.reasonLine(r).trim(), isNotEmpty);
      }
      expect({for (final s in ProNudgeSurface.values) s.key}, hasLength(ProNudgeSurface.values.length));
    });
  });
}
