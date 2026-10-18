// The badge home on You (BADGES-REFINE-1018 1, 2, 4): the head, the shelf of earned coins newest first, the next coin
// as a ghost with its count line, a tap that opens the badge sheet, and the four states (no badges, some, all, the
// read failed) plus the one where a badge could not be read. Nothing here is a lock, a rank or a guess.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/core/repositories/attempts_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/logic/tokens.dart' show MilestoneToken;
import 'package:mockmob/features/rhythm/widgets/badge_home.dart';
import 'package:mockmob/features/rhythm/widgets/locked_coin.dart';
import 'package:mockmob/features/rhythm/widgets/medal.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

const _size = Size(412, 900);

RhythmMilestone _m(String id, DateTime at) => RhythmMilestone(id: id, achievedAt: at);

/// Three badges earned: a set on 14 Sep, a repair on 9 Oct, five repairs on 12 Oct (3:30 PM in India); seven repairs in all.
final _some = rhythmFixture(
  streak: 1,
  best: 2,
  counts: const RhythmCounts(sessions: 3, repairs: 7, weeksMet: 1),
  milestones: [
    _m('first_scored_session', DateTime.utc(2026, 9, 14, 10)),
    _m('first_repair', DateTime.utc(2026, 10, 9, 10)),
    _m('repairs_5', DateTime.utc(2026, 10, 12, 10)),
    const RhythmMilestone(id: 'first_hold'),
    const RhythmMilestone(id: 'run_weeks_3'),
  ],
);

/// All sixteen dated (the server may date the phone-made ones too, and then its date wins).
final _all = rhythmFixture(
  streak: 3,
  best: 3,
  milestones: [for (final (i, s) in milestoneSteps.indexed) _m(s.id, DateTime.utc(2026, 9, 1 + i, 10))],
);

List<Override> _overrides(RemoteState<Rhythm> rhythm, {List<Attempt> attempts = const [], bool attemptsUnread = false}) => [
      for (final o in rhythmOverrides(rhythm: rhythm, attempts: attempts))
        if (!attemptsUnread || !identical(o.origin, attemptsRepositoryProvider)) o,
      if (attemptsUnread) attemptsRepositoryProvider.overrideWith(() => FakeAttemptsRepo(const RemoteState<List<Attempt>>())),
    ];

void main() {
  setUpAll(loadAppFonts);

  Future<void> pump(WidgetTester tester, RemoteState<Rhythm> rhythm, {bool attemptsUnread = false}) async {
    await pumpMockmob(
      tester,
      const SingleChildScrollView(child: BadgeHomeSection(rule: false)),
      disableAnimations: true,
      size: _size,
      overrides: _overrides(rhythm, attemptsUnread: attemptsUnread),
    );
    await tester.pump(const Duration(milliseconds: 100));
  }

  group('some badges earned', () {
    testWidgets('the head counts them, the shelf is newest first with each day, and the next coin carries its count line', (tester) async {
      await pump(tester, loaded(_some));
      expect(find.text('Badges, 3 of 16'), findsOneWidget);
      expect(find.text('All badges'), findsOneWidget);
      // Newest first: 5 repairs (12 Oct), First repair (9 Oct), First scored set (14 Sep).
      final order = ['5 repairs', 'First repair', 'First scored set'];
      final xs = [for (final n in order) tester.getTopLeft(find.text(n)).dx];
      expect(xs[0], lessThan(xs[1]));
      expect(xs[1], lessThan(xs[2]));
      for (final day in ['12 Oct', '9 Oct', '14 Sep']) {
        expect(find.text(day), findsOneWidget, reason: day);
      }
      expect(find.text('Next badge'), findsOneWidget);
      expect(find.text('Repairs: 7 of 10. 3 more repairs.'), findsOneWidget);
    });

    testWidgets('the first coin stands on the 16 dp gutter, like every block of the page', (tester) async {
      await pump(tester, loaded(_some));
      final medal = tester.getTopLeft(find.byType(Medal).first).dx;
      expect(medal, 16);
      expect(tester.getTopLeft(find.text('Badges, 3 of 16')).dx, 16);
    });

    testWidgets('a coin opens its sheet with the day and time, and leads on to the next badge on its path', (tester) async {
      await pump(tester, loaded(_some));
      await tester.tap(find.text('5 repairs'));
      await tester.pumpAndSettle();
      expect(find.text('Earned Mon 12 Oct, 3:30 PM'), findsOneWidget);
      expect(find.text('Lands with your 5th finished repair.'), findsOneWidget);
      expect(find.text('Next on this path: 10 repairs'), findsOneWidget);
      expect(find.text('3 more repairs to go.'), findsOneWidget);
      expect(find.text('Open your mistakes'), findsOneWidget);
    });

    testWidgets('the ghost opens the sheet of the badge it stands for, with the count so far and the denominator', (tester) async {
      await pump(tester, loaded(_some));
      await tester.tap(find.text('Repairs: 7 of 10. 3 more repairs.'));
      await tester.pumpAndSettle();
      expect(find.text('10 repairs'), findsWidgets);
      expect(find.text('Not yet'), findsOneWidget);
      expect(find.text('7 of 10 repairs so far'), findsOneWidget);
    });

    testWidgets('every coin and the next coin are 44 dp targets or more, with spoken labels', (tester) async {
      await pump(tester, loaded(_some));
      for (final label in [RegExp(r'^5 repairs, earned 12 October'), RegExp(r'^First repair, earned 9 October'), RegExp(r'^Next badge: 10 repairs')]) {
        final size = tester.getSize(find.bySemanticsLabel(label));
        expect(size.width, greaterThanOrEqualTo(44), reason: '$label');
        expect(size.height, greaterThanOrEqualTo(44), reason: '$label');
      }
      // The quiet keys ("All badges", "Try again") paint at 40 dp and carry their own 48 dp hit slop (KeyButton).
    });

    testWidgets('no padlock, no rank, no flame anywhere', (tester) async {
      await pump(tester, loaded(_some));
      expect(find.byIcon(LucideIcons.lock), findsNothing);
      expect(find.byIcon(LucideIcons.lockKeyhole), findsNothing);
      expect(find.byIcon(LucideIcons.flame), findsNothing);
      expect(find.textContaining('locked'), findsNothing);
      expect(find.textContaining('rank'), findsNothing);
    });

    testWidgets('the ghost is the dashed coin with a thin ring only where the count is exact', (tester) async {
      await pump(tester, loaded(_some));
      final coin = tester.widget<LockedCoin>(find.byType(LockedCoin));
      expect(coin.arc, closeTo(0.7, 1e-9));
      expect(coin.token, MilestoneToken.firstRepair);
    });
  });

  group('no badges yet', () {
    testWidgets('says 0 of 16, shows only the ghost with what lands it, and the one thing to do', (tester) async {
      await pump(tester, loaded(rhythmFixture()));
      expect(find.text('Badges, 0 of 16'), findsOneWidget);
      expect(find.text('Papers. Lands when a set with 5 or more answers is scored.'), findsOneWidget);
      expect(find.text('Start a quick practice'), findsOneWidget);
      expect(find.byType(Medal), findsNothing, reason: 'no coin stands on a shelf with nothing earned');
      expect(tester.widget<LockedCoin>(find.byType(LockedCoin)).arc, isNull, reason: 'no exact count, so no ring');
    });
  });

  group('all badges earned', () {
    testWidgets('16 of 16, every coin newest first, and no ghost', (tester) async {
      await pump(tester, loaded(_all));
      expect(find.text('Badges, 16 of 16'), findsOneWidget);
      expect(find.text('Every badge is earned.'), findsOneWidget);
      expect(find.text('Next badge'), findsNothing);
      expect(find.byType(LockedCoin), findsNothing);
      // The shelf scrolls sideways, so a coin past the edge is still in the tree.
      expect(find.byType(Medal, skipOffstage: false), findsNWidgets(16));
      expect(find.text('New best'), findsOneWidget, reason: 'the newest, on the left');
    });
  });

  group('the read failed', () {
    testWidgets('says so in one line with Try again, no count in the head, and nothing called not yet', (tester) async {
      await pump(tester, kFailedRhythm);
      expect(find.text('We could not read your badges.'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(find.text('Badges'), findsOneWidget);
      expect(find.textContaining(' of 16'), findsNothing);
      expect(find.text('All badges'), findsNothing);
      expect(find.text('Next badge'), findsNothing);
      expect(find.textContaining('Not yet'), findsNothing);
    });

    testWidgets('while it is first loading, ghost coins stand where the badges will, announced as loading', (tester) async {
      await pump(tester, kLoadingRhythm);
      expect(find.byType(BadgeHomeSkeleton), findsOneWidget);
      expect(find.textContaining(' of 16'), findsNothing);
    });
  });

  group('a badge that could not be read', () {
    testWidgets('while the phone has no attempts list, the paper badges are not "not yet" and not next; the rest stand as read', (tester) async {
      await pump(tester, loaded(_some), attemptsUnread: true);
      expect(find.text('Some badges could not be checked just now.'), findsOneWidget);
      expect(find.text('Badges, 3 of 16'), findsOneWidget);
      // The ghost is still the repairs badge: it is read and has an exact count.
      expect(find.text('Repairs: 7 of 10. 3 more repairs.'), findsOneWidget);
      expect(find.textContaining('Exam-day rehearsal'), findsNothing);
    });
  });
}
