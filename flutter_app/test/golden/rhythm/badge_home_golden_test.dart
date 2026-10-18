// Goldens of the badge home, the badge sheet and the "Badge earned" row (BADGES-REFINE-1018) at 412 dp wide, Night
// and Day: the Badges section of You with no badges, some, all sixteen, a read that failed and a badge that could not
// be read; the sheet of an earned badge (the paper, the next badge on its path), of one not yet earned (its count and
// key), of a later one and of one that could not be read; and the "Badge earned" row on the result, with one badge and
// with two. Each image is opened and looked at before it is accepted.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/repositories/rhythm_repository.dart';
import 'package:mockmob/core/repositories/rhythm_seen_repository.dart';
import 'package:mockmob/core/widgets/widgets.dart' show StudyWeekLegendMemory;
import 'package:mockmob/features/result/data/result_providers.dart' show RecapData;
import 'package:mockmob/features/rhythm/logic/badge_record.dart';
import 'package:mockmob/features/rhythm/logic/badge_shelf.dart';
import 'package:mockmob/features/rhythm/logic/derived_badges.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/widgets/badge_home.dart';
import 'package:mockmob/features/rhythm/widgets/badge_sheet.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/result/support/fixtures.dart' as result_fixtures;
import '../../unit/result/support/harness.dart';
import '../you/you_golden_kit.dart' show loadMaterialIcons;
import 'rhythm_test_kit.dart';

const _width = 412.0;

Attempt _attempt(
  String id, {
  required DateTime at,
  String subject = 'accountancy',
  String mode = 'quick',
  int correct = 7,
  int wrong = 2,
  int total = 10,
  String? formatId,
}) =>
    Attempt.fromJson({
      'id': id,
      'subject': subject,
      'score': 0,
      'correct': correct,
      'wrong': wrong,
      'unattempted': total - correct - wrong,
      'total': total,
      'details': const [],
      'questionsSnapshot': const [],
      'selectionMeta': {'mode': mode, 'scoringVersion': 'server_practice_v1'},
      'formatId': ?formatId,
      'completedAt': at.millisecondsSinceEpoch,
    });

/// A clean set of ten (3 Sep) and two full mocks of one kind (6 and 12 Sep): the phone works out Clean set and New best.
List<Attempt> _attempts() => [
      _attempt('s1', at: DateTime.utc(2026, 9, 1, 6)),
      _attempt('s2', at: DateTime.utc(2026, 9, 2, 6), subject: 'english'),
      _attempt('s3', at: DateTime.utc(2026, 9, 3, 6), subject: 'business_studies', correct: 10, wrong: 0),
      _attempt('m1', at: DateTime.utc(2026, 9, 6, 6), mode: 'full', total: 50, correct: 30, wrong: 6, formatId: 'full:accountancy:q50:server_snapshot_v1'),
      _attempt('m2', at: DateTime.utc(2026, 9, 12, 6), mode: 'full', total: 50, correct: 33, wrong: 5, formatId: 'full:accountancy:q50:server_snapshot_v1'),
    ];

RhythmMilestone _m(String id, DateTime at) => RhythmMilestone(id: id, achievedAt: at);

/// Six earned (four from the server, Clean set and New best from the papers), 4 of 5 repairs counted by the server.
final _some = rhythmFixture(
  streak: 2,
  best: 2,
  counts: const RhythmCounts(sessions: 5, repairs: 4, weeksMet: 1),
  milestones: [
    _m('first_scored_session', DateTime.utc(2026, 9, 1, 6)),
    _m('first_full_mock', DateTime.utc(2026, 9, 6, 6)),
    _m('first_week_met', DateTime.utc(2026, 9, 13, 10)),
    _m('first_repair', DateTime.utc(2026, 10, 9, 10)),
    const RhythmMilestone(id: 'repairs_5'),
    const RhythmMilestone(id: 'sessions_10'),
    const RhythmMilestone(id: 'first_hold'),
    const RhythmMilestone(id: 'run_weeks_3'),
  ],
);

/// A new account: the server lists the two new ids (the repairs check, 3 in a row) with no date, and nothing else.
final _none = rhythmFixture(milestones: const [RhythmMilestone(id: 'first_hold'), RhythmMilestone(id: 'run_weeks_3')]);

/// All sixteen dated, one a day.
final _all = rhythmFixture(
  streak: 3,
  best: 3,
  milestones: [for (final (i, s) in milestoneSteps.indexed) _m(s.id, DateTime.utc(2026, 9, 1 + i, 10))],
);

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadMaterialIcons();
  });
  setUp(StudyWeekLegendMemory.session.reset);

  String tag(Brightness b) => b == Brightness.dark ? 'night' : 'day';

  // --------------------------------------------------------------------------------------------------------
  // The Badges section of You.

  Future<void> home(
    WidgetTester tester,
    String name,
    Brightness brightness,
    RemoteState<Rhythm> rhythm, {
    List<Attempt>? attempts,
    bool attemptsUnread = false,
    double height = 330,
    double width = _width,
  }) async {
    await pumpMockmob(
      tester,
      const SingleChildScrollView(physics: NeverScrollableScrollPhysics(), child: BadgeHomeSection(rule: false)),
      brightness: brightness,
      size: Size(width, height),
      disableAnimations: true,
      overrides: [
        for (final o in rhythmOverrides(rhythm: rhythm, attempts: attempts ?? const []))
          if (!attemptsUnread || !identical(o.origin, attemptsRepositoryProvider)) o,
        if (attemptsUnread) attemptsRepositoryProvider.overrideWith(() => FakeAttemptsRepo(const RemoteState<List<Attempt>>())),
      ],
    );
    await tester.pump(const Duration(milliseconds: 100));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${width.round()}_${tag(brightness)}.png'));
  }

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final t = tag(brightness);
    testWidgets('badge home, no badges, $t', (tester) async {
      await home(tester, 'badge_home_none', brightness, loaded(_none), height: 230);
    });
    testWidgets('badge home, some earned, $t', (tester) async {
      await home(tester, 'badge_home_some', brightness, loaded(_some), attempts: _attempts(), height: 290);
    });
    testWidgets('badge home, some earned on a 360 dp phone, $t', (tester) async {
      await home(tester, 'badge_home_some', brightness, loaded(_some), attempts: _attempts(), height: 300, width: 360);
    });
    testWidgets('badge home, all sixteen, $t', (tester) async {
      await home(tester, 'badge_home_all', brightness, loaded(_all), attempts: _attempts(), height: 290);
    });
    testWidgets('badge home, the read failed, $t', (tester) async {
      await home(tester, 'badge_home_failed', brightness, kFailedRhythm, height: 130);
    });
    testWidgets('badge home, a badge that could not be read, $t', (tester) async {
      await home(tester, 'badge_home_unread', brightness, loaded(_some), attemptsUnread: true, height: 320);
    });
  }

  // --------------------------------------------------------------------------------------------------------
  // The badge sheet.

  List<TrackView> board(List<RhythmMilestone> milestones, {Set<String> unreadable = const {}}) =>
      milestoneTracks(mergeDerived(milestones, deriveBadges(_attempts()), derivedIds: derivedBadgeIdsForTest), unreadable: unreadable);

  Future<void> sheet(WidgetTester tester, String name, Brightness brightness, BadgeDetail detail, {double height = 560}) async {
    await pumpMockmob(
      tester,
      Material(
        type: MaterialType.transparency,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: SheetFrame(child: BadgeSheetBody(detail: detail, onGo: (_) {}, onClose: () {})),
        ),
      ),
      brightness: brightness,
      size: Size(_width, height),
      disableAnimations: true,
      overrides: rhythmOverrides(rhythm: loaded(_some)),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_412_${tag(brightness)}.png'));
  }

  final tracks = board(_some.milestones);
  final derived = deriveBadges(_attempts());
  final records = badgeRecords(derived, _attempts());

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final t = tag(brightness);
    testWidgets('badge sheet, earned with its paper and the next badge, $t', (tester) async {
      await sheet(tester, 'badge_sheet_earned', brightness, detailOf(tracks, 'new_best', progress: const {'four_subjects': 3}, records: records, zone: 'Asia/Kolkata')!, height: 600);
    });
    testWidgets('badge sheet, earned and on to the next on its path, $t', (tester) async {
      await sheet(tester, 'badge_sheet_earned_path', brightness, detailOf(tracks, 'first_repair', progress: const {'repairs_5': 4}, zone: 'Asia/Kolkata')!, height: 540);
    });
    testWidgets('badge sheet, not yet with its count and key, $t', (tester) async {
      await sheet(tester, 'badge_sheet_notyet', brightness, detailOf(tracks, 'repairs_5', progress: const {'repairs_5': 4}, zone: 'Asia/Kolkata')!, height: 520);
    });
    testWidgets('badge sheet, a later badge, $t', (tester) async {
      await sheet(tester, 'badge_sheet_later', brightness, detailOf(tracks, 'repairs_10', progress: const {'repairs_5': 4}, zone: 'Asia/Kolkata')!, height: 520);
    });
    testWidgets('badge sheet, a badge that could not be read, $t', (tester) async {
      final unread = board(_some.milestones, unreadable: const {'four_subjects'});
      await sheet(tester, 'badge_sheet_unknown', brightness, detailOf(unread, 'four_subjects', zone: 'Asia/Kolkata')!, height: 430);
    });
  }

  // --------------------------------------------------------------------------------------------------------
  // The earned row, in its place on the result.

  Future<void> resultRow(WidgetTester tester, String name, Brightness brightness, List<String> ids) async {
    final d = result_fixtures.detail();
    final done = d.attempt.completedAt;
    final seen = MemorySeen();
    await pumpResultRoute(
      tester,
      location: '/result/a7',
      brightness: brightness,
      size: const Size(_width, 853),
      disableAnimations: true,
      overrides: resultOverrides(
        attemptId: 'a7',
        data: RecapData(model: result_fixtures.mock7(withDetail: d), attempt: d.attempt, detail: d, fetchedAt: DateTime(2026, 10, 12, 22, 44)),
        extra: [
          rhythmRepositoryProvider.overrideWith(
            () => FakeRhythmRepo(
              loaded(
                rhythmFixture(
                  milestones: [
                    for (final (i, id) in ids.indexed) _m(id, done.add(Duration(seconds: 20 + i * 5))),
                    const RhythmMilestone(id: 'first_hold'),
                    const RhythmMilestone(id: 'run_weeks_3'),
                  ],
                ),
              ),
            ),
          ),
          rhythmSeenRepositoryProvider.overrideWithValue(seen),
        ],
      ),
    );
    await tester.pump(const Duration(seconds: 2));
    // The row grows in and its coin fades in a frame later: give both their frames.
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await expectLater(find.byKey(resultGoldenKey), matchesGoldenFile('goldens/${name}_412_${tag(brightness)}.png'));
  }

  for (final brightness in [Brightness.dark, Brightness.light]) {
    final t = tag(brightness);
    testWidgets('the result with one badge earned, $t', (tester) async {
      await resultRow(tester, 'result_badge_earned_one', brightness, const ['first_full_mock']);
    });
    testWidgets('the result with two badges earned, $t', (tester) async {
      await resultRow(tester, 'result_badge_earned_two', brightness, const ['first_scored_session', 'first_full_mock']);
    });
  }
}

/// The ids `derivedBadgeIds` holds (the five the phone works out), without reading the providers file in a test of widgets.
const derivedBadgeIdsForTest = ['first_nta', 'full_mocks_5', 'clean_set', 'four_subjects', 'new_best'];
