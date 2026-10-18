// The lead card's title is never cut (v15.1 walk, 18 Oct): after a Suggested card became the lead at 360 dp the title read
// "Practise your / weakest cha..." (two lines, an ellipsis), the same class as the failure card's "did no...". Every card the
// deck can lead with, at 360 and 412 dp and 1.0 and 1.3 text, shows its whole title.
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart' show TodayWeek;
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart' show MoveHeroCard;
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

const TodayWeek _week = TodayWeek(
  studied: [true, false, false, true, false, true, false],
  todayIndex: 6,
  label: '3 of 4 study days',
  goal: 4,
  planned: {0, 3, 5, 6},
  dates: [12, 13, 14, 15, 16, 17, 18],
);

void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    debugResetTodayPicks();
    SuggestedHint.debugReset();
    SuggestedHint.store = MemoryPrefsStore();
  });
  tearDown(() {
    SuggestedHint.debugReset();
    SuggestedHint.store = null;
  });

  for (final scale in const [1.0, 1.3]) {
    for (final width in const [360.0, 412.0]) {
      testWidgets('at ${width.toInt()} dp and ${scale}x text every card that can lead shows its whole title', (tester) async {
        final view = buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _week, reviseDue: 6));
        await pumpMockmob(
          tester,
          TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
          size: Size(width, 2600),
          textScale: scale,
          disableAnimations: true,
          overrides: [authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'))],
        );
        await tester.pumpAndSettle();
        final seen = <String>{};
        for (var k = 0; k < 6; k++) {
          final title = tester.widget<MoveHeroCard>(find.byType(MoveHeroCard)).move.title!;
          seen.add(title);
          final paragraph = tester.renderObject<RenderParagraph>(find.descendant(of: find.byType(MoveHeroCard), matching: find.text(title)).first);
          expect(paragraph.didExceedMaxLines, isFalse, reason: '"$title" is never cut with an ellipsis');
          final at = tester.getCenter(find.byKey(SuggestedStack.topKey));
          final g = await tester.startGesture(at);
          for (var s = 0; s < 10; s++) {
            await g.moveBy(const Offset(20, 0), timeStamp: Duration(milliseconds: 40 * s));
            await tester.pump(const Duration(milliseconds: 16));
          }
          await g.up();
          await tester.pumpAndSettle();
        }
        expect(seen, contains(GlanceCopy.titleWeakest), reason: 'the title that was cut at 360 dp was one of those led');
        expect(seen.length, greaterThanOrEqualTo(2));
      });
    }
  }
}
