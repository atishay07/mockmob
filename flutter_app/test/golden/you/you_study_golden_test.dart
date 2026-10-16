// Goldens of You as the student's study (app-you-1016): the first screen at 360x800 and 390x844,
// the whole page, and the day-one page, in Night and Day. A study week of 3 of 4 days, 16 badges
// with six earned, three personal bests, and a fresh account with nothing yet.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/data/reminder_store.dart' show reminderPrefsStoreProvider;
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rhythm/data/bests.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../unit/you/you_test_support.dart';
import 'you_golden_kit.dart';

Attempt _attempt(
  String id, {
  required int day,
  String subject = 'accountancy',
  String mode = 'quick',
  int correct = 7,
  int wrong = 2,
  int total = 10,
  String? formatId,
  List<Map<String, Object?>> details = const [],
}) =>
    Attempt.fromJson({
      'id': id,
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': total - correct - wrong,
      'total': total,
      'details': details,
      'questionsSnapshot': const [],
      'selectionMeta': {'mode': mode, 'scoringVersion': 'server_practice_v1'},
      'formatId': ?formatId,
      'completedAt': DateTime.utc(2026, 9, day, 6).millisecondsSinceEpoch,
    });

/// Six scored sets in three subjects (one clean), and two full mocks of the same kind.
List<Attempt> _attempts() => [
      _attempt('s1', day: 21),
      _attempt('s2', day: 22, subject: 'english'),
      _attempt(
        's3',
        day: 23,
        subject: 'business_studies',
        correct: 10,
        wrong: 0,
        details: const [
          {'qid': 'q1', 'givenIndex': 1, 'isCorrect': true, 'timeMs': 21000},
          {'qid': 'q2', 'givenIndex': 0, 'isCorrect': true, 'timeMs': 9000},
        ],
      ),
      _attempt('s4', day: 24),
      _attempt('s5', day: 25),
      _attempt('s6', day: 26, subject: 'english'),
      _attempt('m1', day: 27, mode: 'full', total: 50, correct: 30, wrong: 6, formatId: 'full:accountancy:q50:server_snapshot_v1'),
      _attempt('m2', day: 29, mode: 'full', total: 50, correct: 33, wrong: 5, formatId: 'full:accountancy:q50:server_snapshot_v1'),
    ];

final _bests = [
  PersonalBest(
    formatId: 'full:accountancy:q50:server_snapshot_v1',
    subject: 'accountancy',
    mode: 'full',
    attempts: 2,
    best: BestMark(marks: 160, max: 250, attemptId: 'm2', completedAt: DateTime.utc(2026, 9, 29, 6)),
    latest: BestMark(marks: 160, max: 250, attemptId: 'm2', completedAt: DateTime.utc(2026, 9, 29, 6)),
  ),
];

List<Override> _study({bool fresh = false}) => [
      ...youOverrides(
        target: ashaTarget,
        now: DateTime(2026, 10, 14, 19, 40),
        rhythm: FakeRhythm(
          fresh
              ? rhythmState(streak: 0, best: 0, studyDayDates: const [])
              : rhythmState(
                  streak: 2,
                  best: 5,
                  studyDayDates: const ['2026-10-12', '2026-10-13', '2026-10-14'],
                  milestones: [
                    ...earnedMilestones,
                    RhythmMilestone(id: 'sessions_10', achievedAt: DateTime.utc(2026, 10, 10, 8)),
                  ],
                ),
        ),
        bests: RemoteState(value: fresh ? const [] : _bests),
        attempts: RemoteState(value: fresh ? const <Attempt>[] : _attempts()),
      ),
    ];

/// Android has not been asked yet, so the reminders invitation shows under This week (L19).
class _NotAsked implements PermissionRequester {
  const _NotAsked();

  @override
  Future<NotificationPermission> notificationPermission() async => NotificationPermission.notAsked;

  @override
  Future<NotificationPermission> requestNotificationPermission() async => NotificationPermission.notAsked;
}

void main() {
  setUpGoldenFonts();

  sheetGolden('study_hub_390', () => const YouHubScreen(), size: const Size(390, 844), overrides: _study);
  sheetGolden('study_hub_360', () => const YouHubScreen(), size: const Size(360, 800), overrides: _study);
  sheetGolden('study_hub_full_390', () => const YouHubScreen(), size: const Size(390, 3000), overrides: _study);
  sheetGolden(
    'study_hub_invite_390',
    () => const YouHubScreen(),
    size: const Size(390, 1500),
    overrides: () => [
      ..._study(),
      permissionRequesterProvider.overrideWithValue(const _NotAsked()),
      reminderPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
    ],
  );
  sheetGolden('study_hub_new_390', () => const YouHubScreen(), size: const Size(390, 3000), overrides: () => _study(fresh: true));
}
