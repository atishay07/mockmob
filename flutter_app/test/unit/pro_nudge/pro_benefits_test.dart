// The Upgrade sheet's lines: each personal line only when it is true, never invented, ordered by
// relevance, standing in for its plain line, four at most, the plain list as the fallback. And the copy
// keeps the store's rules and the website's voice.

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
      expect(idOf(const ProFacts(mocksTaken: 1), 'mocks'), contains('sat 1 full mock.'));
      expect(idOf(const ProFacts(mocksTaken: 4), 'mocks'), contains('sat 4 full mocks.'));

      expect(idOf(const ProFacts(weakestChapter: 'Accounting Ratios'), 'weakest'), startsWith('Accounting Ratios cost you the most.'));
      expect(idOf(const ProFacts(weakestSubject: 'Economics'), 'weakest'), contains('your Economics sets'));
      expect(idOf(const ProFacts(weakestChapter: '  '), 'weakest'), isNull);

      // Credits spent: unknown and zero say nothing; a floor says "at least".
      expect(idOf(const ProFacts(), 'used'), isNull);
      expect(idOf(const ProFacts(creditsUsed: 0), 'used'), isNull);
      expect(idOf(const ProFacts(creditsUsed: 120), 'used'), contains('spent 120 credits on practice'));
      expect(idOf(const ProFacts(creditsUsed: 30, creditsUsedAtLeast: true), 'used'), contains('at least 30 credits'));
      expect(idOf(const ProFacts(creditsUsed: 1), 'used'), contains('spent 1 credit on practice'));

      // Credits left: unknown says nothing; enough for a Full mock says nothing; low says so.
      expect(idOf(const ProFacts(), 'left'), isNull);
      expect(idOf(const ProFacts(practiceCredits: ProBenefits.lowCredits), 'left'), isNull);
      expect(idOf(const ProFacts(practiceCredits: 8), 'left'), contains('Only 8 credits left, not enough for a Full mock'));
      expect(idOf(const ProFacts(practiceCredits: 1), 'left'), contains('Only 1 credit left'));
      expect(idOf(const ProFacts(practiceCredits: 0), 'left'), contains('No credits left'));

      // Subjects: one subject says nothing.
      expect(idOf(const ProFacts(subjectCount: 1), 'subjects'), isNull);
      expect(idOf(const ProFacts(subjectCount: 3), 'subjects'), contains('all 3 of your subjects'));

      expect(idOf(const ProFacts(targetColleges: 0), 'colleges'), isNull);
      expect(idOf(const ProFacts(targetColleges: 1), 'colleges'), contains('your target college.'));
      expect(idOf(const ProFacts(targetColleges: 2), 'colleges'), contains('your 2 target colleges'));
    });

    test('a Full mock costs 50 credits, so "not enough for a Full mock" is said only below 50', () {
      expect(ProBenefits.lowCredits, 50);
      expect(ProNudgeCopy.fullMockCredits, 50);
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
      const f = ProFacts(mocksTaken: 3, weakestChapter: 'Ratios', creditsUsed: 90, subjectCount: 3);
      expect(ProBenefits.personal(f).first.id, 'weakest');
      expect(ProBenefits.personal(f, reason: ProReason.unlimitedMocks).first.id, 'mocks');
      expect(ProBenefits.personal(f, reason: ProReason.practiceCredits).first.id, 'used');
      const g = ProFacts(subjectCount: 3, targetColleges: 2);
      expect(ProBenefits.personal(g).first.id, 'colleges');
      expect(ProBenefits.personal(g, reason: ProReason.ntaMode).first.id, 'subjects');
    });
  });

  group('the sheet\'s lines', () {
    test('four at most, the student\'s own first, topped up from the plain list', () {
      final lines = ProBenefits.lines(const ProFacts(mocksTaken: 2));
      expect(lines, hasLength(ProBenefits.maxLines));
      expect(ProBenefits.maxLines, 4);
      expect(lines.first, contains('2 full mocks'));
      expect(lines.toSet(), hasLength(lines.length));
      expect(ProBenefits.isPersonal(const ProFacts(mocksTaken: 2)), isTrue);
    });

    test('a personal line stands in for its plain line, so one benefit is never said twice', () {
      final mocks = ProBenefits.lines(const ProFacts(mocksTaken: 2));
      expect(mocks, isNot(contains(ProNudgeCopy.plainBenefits[0])));
      expect(mocks.sublist(1), ProNudgeCopy.plainBenefits.sublist(1));

      final chapter = ProBenefits.lines(const ProFacts(weakestChapter: 'Ratios'));
      expect(chapter, isNot(contains(ProNudgeCopy.plainBenefits[3])));

      final subjects = ProBenefits.lines(const ProFacts(subjectCount: 3));
      expect(subjects.where((l) => l.startsWith('NTA mode')), hasLength(1));

      // Both credit lines speak for the one plain credits line.
      final credits = ProBenefits.lines(const ProFacts(creditsUsed: 40, practiceCredits: 10));
      expect(credits, hasLength(4));
      expect(credits, isNot(contains(ProNudgeCopy.plainBenefits[1])));
    });

    test('everything known: four lines, three of them the student\'s own', () {
      final lines = ProBenefits.lines(const ProFacts(mocksTaken: 3, weakestChapter: 'Ratios', creditsUsed: 90, practiceCredits: 8, subjectCount: 3, targetColleges: 2));
      expect(lines, hasLength(4));
      expect(lines.take(3).every((l) => !ProNudgeCopy.plainBenefits.contains(l)), isTrue);
    });
  });

  group('the copy keeps the rules', () {
    final all = <String>[
      ...ProNudgeCopy.headlineOptions,
      ProNudgeCopy.sheetLabel,
      ProNudgeCopy.forYouHeading,
      ProNudgeCopy.includesHeading,
      ProNudgeCopy.notNow,
      ProNudgeCopy.gateAction,
      ProNudgeCopy.goUnlimited,
      ProNudgeCopy.seePro,
      ProNudgeCopy.nudgeDismiss,
      ProNudgeCopy.unlimitedMocks,
      ProNudgeCopy.noCreditsForPractice,
      ProNudgeCopy.noCreditsForChapter,
      ProNudgeCopy.afterResult,
      ProNudgeCopy.creditsRunLow,
      ...ProNudgeCopy.plainBenefits,
      for (final r in ProReason.values) ...[ProNudgeCopy.head(r).title, ProNudgeCopy.head(r).lede],
      for (final s in ProNudgeSurface.values) ...[ProNudgeCopy.lineFor(s), ProNudgeCopy.actionFor(s)],
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
      final price = RegExp(r'[₹€£]|\$\d|\bRs\b|\bINR\b|\b99\b|\d+\s*(rupees|per month|a month)', caseSensitive: false);
      final steering = RegExp(r'website|\bweb\b|mockmob\.in|checkout|cheaper|discount|pricing', caseSensitive: false);
      final scarcity = RegExp(r'offer ends|only today|last chance|hurry|limited time|expires|left today|countdown|before it', caseSensitive: false);
      for (final line in all) {
        expect(line.contains('!'), isFalse, reason: line);
        expect(emoji.hasMatch(line), isFalse, reason: line);
        expect(price.hasMatch(line), isFalse, reason: line);
        expect(steering.hasMatch(line), isFalse, reason: line);
        expect(scarcity.hasMatch(line), isFalse, reason: line);
      }
    });

    test('the owner\'s words are in it (D79, D80): unlimited mocks, no credits for practice, Upgrade to Pro', () {
      expect(ProNudgeCopy.unlimitedMocks, startsWith('Get unlimited mocks'));
      expect(ProNudgeCopy.noCreditsForPractice, startsWith('No credits needed for practice with Pro'));
      expect(ProNudgeCopy.gateAction, 'Upgrade to Pro');
      expect(ProNudgeCopy.sheetLabel, 'Upgrade to Pro');
    });

    test('the same voice as the website: its headlines, its first-session words, its NTA paper', () {
      expect(ProNudgeCopy.sheetTitle, 'Practise without limits');
      expect(ProNudgeCopy.head(ProReason.general).title, ProNudgeCopy.sheetTitle);
      expect(ProNudgeCopy.head(ProReason.firstSession).title, 'That is one paper done. Keep going without limits.');
      expect(ProNudgeCopy.head(ProReason.ntaMode).title, 'Sit the exam before the exam');
      expect(ProNudgeCopy.head(ProReason.ntaMode).lede, contains('not official ones'));
      expect(ProNudgeCopy.plainBenefits[2], contains('50 questions in 60 minutes'));
    });

    test('every surface and every reason has its own words', () {
      for (final s in ProNudgeSurface.values) {
        expect(ProNudgeCopy.lineFor(s).trim(), isNotEmpty);
        expect(ProNudgeCopy.actionFor(s), anyOf(ProNudgeCopy.goUnlimited, ProNudgeCopy.seePro));
      }
      for (final r in ProReason.values) {
        expect(ProNudgeCopy.head(r).title.trim(), isNotEmpty);
        expect(ProNudgeCopy.head(r).lede.trim(), isNotEmpty);
      }
      expect({for (final s in ProNudgeSurface.values) s.key}, hasLength(ProNudgeSurface.values.length));
    });
  });
}
