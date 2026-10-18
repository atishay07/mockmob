// The failure card's title at 360 dp (v15.1 walk, 18 Oct): beside Mobi it read "Tonight's / move did
// no..." because the title held two lines. It now takes a third and is never cut, at 1.0 and 1.3 text.
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/screens/today_body.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// Sunday 18 October 2026, 7:40 PM IST.
final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

void main() {
  setUpAll(loadAppFonts);

  for (final scale in const [1.0, 1.3]) {
    for (final width in const [360.0, 412.0]) {
      testWidgets('at ${width.toInt()} dp and ${scale}x text the failure title is whole', (tester) async {
        final view = buildToday(TodayInputs(now: _sunday, firstName: 'Asha', attemptsFailed: true, readProblem: LoadProblem.busy));
        await pumpMockmob(
          tester,
          TodayBody(view: view, skeletonDelay: Duration.zero, callbacks: TodayCallbacks(onAction: (_) {}, onTarget: (_) {})),
          size: Size(width, 900),
          textScale: scale,
          disableAnimations: true,
          overrides: [authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'))],
        );
        final title = find.text(TodayCopy.failTitle);
        expect(title, findsOneWidget);
        final paragraph = tester.renderObject<RenderParagraph>(title);
        expect(paragraph.didExceedMaxLines, isFalse, reason: 'the title is never cut with an ellipsis');
      });
    }
  }
}
