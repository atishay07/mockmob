// Today's hero in motion (15 Oct evening pass): a change of hero kind is one overlap on the shared
// rule, never a hard cut and never two move cards holding the same keys; a rebuilt hero rolls on
// from the count it last showed instead of from 0.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/today/widgets/reel_hero.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/widgets/count_up.dart' show MmNumberMemory;
import 'package:mockmob/core/widgets/monumental_number.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/move_hero.dart';

import '../../golden/today/today_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

void main() {
  setUpAll(loadAppFonts);
  setUp(MmNumberMemory.clear);

  final auth = authSnapshotProvider.overrideWithBuild(
    (ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma'),
  );

  TodayView sealedView() {
    final newest = ashaRecord(tuesdayEvening).first;
    return buildToday(ashaInputs(unopened: [(attemptId: newest.id, receivedAt: tuesdayEvening)]));
  }

  Future<StateSetter> pumpSwitchable(WidgetTester tester, TodayView Function() view) async {
    late StateSetter set;
    await pumpMockmob(
      tester,
      StatefulBuilder(builder: (context, setState) {
        set = setState;
        return TodayBody(view: view(), callbacks: noopCallbacks, skeletonDelay: Duration.zero);
      }),
      size: const Size(384, 1900),
      overrides: [auth],
    );
    return set;
  }

  /// Real frames (50 ms apart) for [d]: a swap lands, then drops its leaver on the next frame.
  Future<void> frames(WidgetTester tester, Duration d) async {
    for (var t = Duration.zero; t < d; t += const Duration(milliseconds: 50)) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Finder heroFigure(String value) => find.descendant(
        of: find.byType(MoveHeroCard),
        matching: find.byWidgetPredicate((w) => w is MonumentalNumber && w.value == value),
      );

  testWidgets('move, sealed and move again inside one overlap: the cards cross, no key clash', (tester) async {
    final move = buildToday(ashaInputs());
    final sealed = sealedView();
    expect(move.hero, isA<MoveHero>());
    expect(sealed.hero, isA<SealedHero>());

    var view = move;
    final set = await pumpSwitchable(tester, () => view);
    await tester.pump(const Duration(seconds: 2));

    set(() => view = sealed);
    await tester.pump(const Duration(milliseconds: 60));
    expect(find.byType(ReelHeroCard), findsOneWidget);
    expect(find.byType(MoveHeroCard), findsOneWidget, reason: 'the move card leaves on the overlap, not in one frame');

    set(() => view = move);
    await tester.pump(const Duration(milliseconds: 60));
    expect(tester.takeException(), isNull, reason: 'the arriving move card has keys of its own');

    await frames(tester, const Duration(seconds: 2));
    expect(find.byType(MoveHeroCard), findsOneWidget);
    expect(find.byType(ReelHeroCard), findsNothing);
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('a rebuilt hero rolls on from the count it showed, not from 0', (tester) async {
    final whole = buildToday(ashaInputs(selectedMinutes: 15));
    final part = buildToday(ashaInputs(selectedMinutes: 5));
    expect((whole.hero! as MoveHero).number, '4');
    expect((part.hero! as MoveHero).number, '2');

    var view = whole;
    final set = await pumpSwitchable(tester, () => view);
    await tester.pump(const Duration(seconds: 2));
    expect(heroFigure('4'), findsOneWidget);

    set(() => view = sealedView());
    await frames(tester, const Duration(seconds: 2));
    expect(find.byType(MoveHeroCard), findsNothing);

    set(() => view = part);
    await tester.pump();
    expect(heroFigure('4'), findsOneWidget, reason: 'the first frame of the rebuilt card shows the remembered 4');
    await tester.pump();
    expect(heroFigure('2'), findsOneWidget, reason: 'then it rolls on to the real 2');
    await tester.pump(const Duration(seconds: 10));
  });
}
