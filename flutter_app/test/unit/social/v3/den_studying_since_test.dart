// The den's studying tag (4.2): "since {time}" is the server's own time in 12 hours, never a moment later than the den's
// clock, and the caption stays on one line at text 1.3.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/motion/reduced_motion.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/widgets/den_stage.dart';
import 'package:mockmob/features/social/v3/widgets/fold_puppet.dart';

import '../../../helpers/golden_harness.dart';
import 'mob_v3_test_kit.dart';

// 10:22 UTC is 3:52 PM in India (the tag reads IST).
final DateTime _since = DateTime.utc(2026, 10, 22, 10, 22);

void main() {
  final riya = MobV3Member(memberId: 'R', name: 'Riya', colour: 3, fold: FoldKey.patang);

  group('shownSince', () {
    test('the server time as it is when it is not ahead of the den clock', () {
      expect(StudyDesk.shownSince(_since, _since.add(const Duration(minutes: 20))), _since);
      expect(StudyDesk.shownSince(_since, _since), _since);
    });

    test('a start later than the den clock is the den clock, never a time in the future', () {
      final now = _since.subtract(const Duration(minutes: 7));
      expect(StudyDesk.shownSince(_since, now), now);
    });

    test('with no den clock the server time is shown as sent', () {
      expect(StudyDesk.shownSince(_since, null), _since);
    });
  });

  group('the tag', () {
    Future<void> pump(WidgetTester tester, {required DateTime? now, double textScale = 1}) async {
      loadFoldManifestForTest();
      await pumpMockmob(
        tester,
        Builder(
          builder: (context) => ColoredBox(
            color: context.mmColors.ground,
            child: SizedBox(
              width: 360,
              height: 220,
              // The app's own reduced-motion setting: the tag is on at once.
              child: ReducedMotionSetting(
                enabled: true,
                child: Stack(children: [
                  Offstage(child: FoldPuppet(fold: riya.fold, size: 61, pose: FoldPose.think)),
                  StudyDesk(member: riya, since: _since, now: now, size: 61, deskTop: const Offset(300, 110), width: 360, tagTop: 116),
                ]),
              ),
            ),
          ),
        ),
        size: const Size(360, 220),
        textScale: textScale,
      );
      await settleImages(tester);
      await tester.pump(const Duration(milliseconds: 400));
    }

    testWidgets('reads the server time in 12 hours', (tester) async {
      await pump(tester, now: _since.add(const Duration(hours: 1)));
      expect(find.text('since 3:52 PM'), findsOneWidget);
      expect(find.text(MobV4DenCopy.since(_since)), findsOneWidget);
    });

    testWidgets('a start after the den clock reads the den clock', (tester) async {
      final now = DateTime.utc(2026, 10, 22, 10, 15); // 3:45 PM in India
      await pump(tester, now: now);
      expect(find.text('since 3:45 PM'), findsOneWidget);
      expect(find.text('since 3:52 PM'), findsNothing);
    });

    testWidgets('at text 1.3 the caption is one line and the name is one line', (tester) async {
      await pump(tester, now: _since.add(const Duration(hours: 1)), textScale: 1.3);
      final since = find.text('since 3:52 PM');
      final name = find.text(MobV4DenCopy.studying('Riya'));
      expect(since, findsOneWidget);
      final caption = tester.widget<Text>(since);
      expect(caption.maxLines, 1);
      expect(caption.softWrap, isFalse);
      final lineHeight = tester.getSize(name).height;
      expect(tester.getSize(since).height, lessThanOrEqualTo(lineHeight + 1), reason: 'one line, no taller than the name above it');
      expect(tester.takeException(), isNull);
    });
  });
}
