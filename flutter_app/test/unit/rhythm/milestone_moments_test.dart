// Milestone moments (UI blitz, MOBI-06 and MOTION-08): Mobi stands proud where something the
// server dated has landed, and the monumental numbers on the rhythm screens tick once where they
// land. Nothing here shows before there is data.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/models/rhythm.dart';
import 'package:mockmob/features/rhythm/logic/dates.dart' show formatAchievedDate;
import 'package:mockmob/features/rhythm/logic/milestone_tracks.dart';
import 'package:mockmob/features/rhythm/screens/milestones_screen.dart';
import 'package:mockmob/features/rhythm/widgets/earned_token.dart';
import 'package:mockmob/features/rhythm/widgets/milestone_track_card.dart';
import 'package:mockmob/features/rhythm/widgets/proud_mobi.dart';

import '../../golden/rhythm/rhythm_test_kit.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

class _Driver implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<void> selectionClick() async => calls.add('tick');
}

final _at = DateTime.utc(2026, 10, 10, 6);

List<RhythmMilestone> _landed(int n) => [
      for (final step in milestoneSteps.take(n)) RhythmMilestone(id: step.id, achievedAt: _at),
    ];

Future<_Driver> _pumpTimeline(WidgetTester tester, List<RhythmMilestone> milestones, {bool disableAnimations = false}) async {
  final driver = _Driver();
  await pumpMockmob(
    tester,
    SingleChildScrollView(
      child: MilestoneTimeline(milestones: milestones, zone: 'Asia/Kolkata', now: kNow, onOpen: (_) {}),
    ),
    disableAnimations: disableAnimations,
    size: const Size(384, 1800),
    overrides: [
      ...rhythmOverrides(rhythm: loaded(rhythmFixture(milestones: milestones))),
      hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: driver)),
    ],
  );
  return driver;
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('proud Mobi plays the proud act and says its one line beside it', (tester) async {
    await pumpMockmob(tester, const Center(child: ProudMobi(size: 72, say: 'Every step is yours.')), disableAnimations: true);
    final character = tester.widget<MobiCharacter>(find.byType(MobiCharacter));
    expect(character.entrance, MobiAct.proud);
    expect(character.lite, isFalse);
    await tester.pump(const Duration(seconds: 2));
    expect(find.byType(MobiBubble), findsOneWidget);
  });

  testWidgets('a small proud Mobi uses the lite paint', (tester) async {
    await pumpMockmob(tester, const Center(child: ProudMobi(size: 56)), disableAnimations: true);
    expect(tester.widget<MobiCharacter>(find.byType(MobiCharacter)).lite, isTrue);
  });

  testWidgets('every step landed: Mobi is proud at the top of the milestones', (tester) async {
    await _pumpTimeline(tester, _landed(milestoneSteps.length), disableAnimations: true);
    expect(find.byType(ProudMobi), findsOneWidget);
  });

  testWidgets('some steps landed: no Mobi line, nothing guessed', (tester) async {
    await _pumpTimeline(tester, _landed(3), disableAnimations: true);
    expect(find.byType(ProudMobi), findsNothing);
  });

  testWidgets('the landed count ticks once where it lands', (tester) async {
    final driver = await _pumpTimeline(tester, _landed(3));
    expect(driver.calls, isEmpty, reason: 'nothing ticks before the number has landed');
    await tester.pump(const Duration(seconds: 2));
    expect(driver.calls.where((c) => c == 'tick'), hasLength(1));
  });

  testWidgets('with animations off the count is shown at once and does not tick', (tester) async {
    final driver = await _pumpTimeline(tester, _landed(3), disableAnimations: true);
    await tester.pump(const Duration(seconds: 2));
    expect(driver.calls, isEmpty);
    expect(find.text('3'), findsWidgets);
  });
  testWidgets('a landed step: Mobi stands beside the token, never over it (clipped logos, 21)', (tester) async {
    await pumpMockmob(
      tester,
      SingleChildScrollView(
        child: MilestoneTrackCard(
          track: milestoneTracks([
            RhythmMilestone(id: 'first_repair', achievedAt: DateTime.utc(2026, 10, 13, 15)),
            RhythmMilestone(id: 'repairs_5', achievedAt: DateTime.utc(2026, 10, 14, 4)),
          ])[1],
          dateOf: (d) => formatAchievedDate(d, 'Asia/Kolkata', kNow),
          freshIds: const {'repairs_5'},
          onOpen: () {},
        ),
      ),
      disableAnimations: true,
      size: const Size(384, 900),
    );
    final token = tester.getRect(find.byType(EarnedToken));
    final mobi = tester.getRect(find.byType(MobiCharacter));
    expect(mobi.left, greaterThanOrEqualTo(token.right), reason: 'the ring and the token never sit on his side');
    final title = tester.getRect(find.text('5 repairs').first);
    expect(mobi.right, lessThanOrEqualTo(title.left), reason: 'his antenna and mittens stay clear of the words');
  });
}
