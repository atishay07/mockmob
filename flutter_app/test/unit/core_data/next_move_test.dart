import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/domain/domain.dart';
import 'package:mockmob/core/notifications/timezones.dart';

void main() {
  group('nextMoveState precedence', () {
    test('the documented order', () {
      expect(nextMovePrecedence, [
        NextMoveState.historyUnavailable,
        NextMoveState.newUser,
        NextMoveState.subjectChanged,
        NextMoveState.stale,
        NextMoveState.noEligibleContent,
        NextMoveState.thinHistory,
        NextMoveState.ready,
        NextMoveState.repairedCheckNotDue,
        NextMoveState.noStrongWeakness,
      ]);
    });

    final rows = <(String, NextMoveInputs, NextMoveState)>[
      ('history unavailable', const NextMoveInputs(historyUnavailable: true), NextMoveState.historyUnavailable),
      ('no attempts', const NextMoveInputs(hasAttempts: false), NextMoveState.newUser),
      ('subjects changed', const NextMoveInputs(subjectsChangedWithoutAttempt: true), NextMoveState.subjectChanged),
      ('basis older than 14 days', const NextMoveInputs(basisAgeDays: 15), NextMoveState.stale),
      ('no eligible content', const NextMoveInputs(noEligibleContent: true), NextMoveState.noEligibleContent),
      ('thin evidence', const NextMoveInputs(thinEvidence: true), NextMoveState.thinHistory),
      ('ready action', const NextMoveInputs(hasReadyAction: true), NextMoveState.ready),
      ('repaired, check not due', const NextMoveInputs(repairedCheckNotDue: true), NextMoveState.repairedCheckNotDue),
      ('nothing matches', const NextMoveInputs(), NextMoveState.noStrongWeakness),
    ];

    for (final (name, inputs, expected) in rows) {
      test(name, () => expect(nextMoveState(inputs), expected));
    }

    test('a higher priority beats every lower one set together', () {
      const all = NextMoveInputs(
        historyUnavailable: true,
        hasAttempts: false,
        subjectsChangedWithoutAttempt: true,
        basisAgeDays: 40,
        noEligibleContent: true,
        thinEvidence: true,
        hasReadyAction: true,
        repairedCheckNotDue: true,
      );
      expect(nextMoveState(all), NextMoveState.historyUnavailable);
      const noHistoryFlag = NextMoveInputs(
        hasAttempts: false,
        subjectsChangedWithoutAttempt: true,
        basisAgeDays: 40,
        noEligibleContent: true,
        thinEvidence: true,
        hasReadyAction: true,
        repairedCheckNotDue: true,
      );
      expect(nextMoveState(noHistoryFlag), NextMoveState.newUser);
      expect(
        nextMoveState(const NextMoveInputs(subjectsChangedWithoutAttempt: true, basisAgeDays: 40, noEligibleContent: true)),
        NextMoveState.subjectChanged,
      );
      expect(nextMoveState(const NextMoveInputs(basisAgeDays: 40, noEligibleContent: true, thinEvidence: true, hasReadyAction: true)), NextMoveState.stale);
      expect(nextMoveState(const NextMoveInputs(noEligibleContent: true, thinEvidence: true, hasReadyAction: true)), NextMoveState.noEligibleContent);
      expect(nextMoveState(const NextMoveInputs(thinEvidence: true, hasReadyAction: true, repairedCheckNotDue: true)), NextMoveState.thinHistory);
      expect(nextMoveState(const NextMoveInputs(hasReadyAction: true, repairedCheckNotDue: true)), NextMoveState.ready);
    });

    test('exactly 14 days is not stale', () {
      expect(nextMoveState(const NextMoveInputs(basisAgeDays: 14)), NextMoveState.noStrongWeakness);
    });
  });

  group('default minutes', () {
    final noon = DateTime(2026, 10, 12, 12);
    final late = DateTime(2026, 10, 12, 23, 30);
    final early = DateTime(2026, 10, 12, 4, 59);

    test('returning gets 5, then late night 10, then the plan minutes', () {
      expect(defaultNextMoveMinutes(returning: true, localNow: noon, planMinutes: 20), 5);
      expect(defaultNextMoveMinutes(returning: true, localNow: late, planMinutes: 20), 5);
      expect(defaultNextMoveMinutes(returning: false, localNow: late, planMinutes: 20), 10);
      expect(defaultNextMoveMinutes(returning: false, localNow: early, planMinutes: 30), 10);
      expect(defaultNextMoveMinutes(returning: false, localNow: noon, planMinutes: 20), 20);
    });

    test('late night runs 11 PM to 5 AM', () {
      expect(isLateNight(DateTime(2026, 1, 1, 22, 59)), isFalse);
      expect(isLateNight(DateTime(2026, 1, 1, 23)), isTrue);
      expect(isLateNight(DateTime(2026, 1, 1, 0)), isTrue);
      expect(isLateNight(DateTime(2026, 1, 1, 4, 59)), isTrue);
      expect(isLateNight(DateTime(2026, 1, 1, 5)), isFalse);
      expect(isLateNight(DateTime(2026, 1, 1, 6, 58)), isFalse);
    });
  });

  group('dismissalExpiry (4:00 AM in the student timezone)', () {
    final kolkata = locationFor('Asia/Kolkata');

    // The wall-clock time in IST expressed as the matching UTC instant.
    DateTime ist(int y, int m, int d, int h, [int min = 0]) => DateTime.utc(y, m, d, h, min).subtract(const Duration(hours: 5, minutes: 30));

    test('before 4 AM expires at 4 AM the same day', () {
      expect(dismissalExpiry(ist(2026, 10, 12, 1), kolkata).toUtc(), ist(2026, 10, 12, 4));
    });

    test('after 4 AM expires at 4 AM the next day', () {
      expect(dismissalExpiry(ist(2026, 10, 12, 21, 30), kolkata).toUtc(), ist(2026, 10, 13, 4));
    });

    test('exactly 4 AM rolls to the next day', () {
      expect(dismissalExpiry(ist(2026, 10, 12, 4), kolkata).toUtc(), ist(2026, 10, 13, 4));
    });

    test('rolls over a month end', () {
      expect(dismissalExpiry(ist(2026, 10, 31, 22), kolkata).toUtc(), ist(2026, 11, 1, 4));
    });
  });
}
