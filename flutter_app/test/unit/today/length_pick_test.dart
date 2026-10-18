// "How many questions?" on a card swapped in from the Suggested stack (C / D51 emulator walk, 18 Oct):
// the pick sized the recommended move (Revise's round) and the card on screen never changed. The pick
// belongs to the card on screen: a swapped-in practice card shows the new count and its key says it,
// and Revise's own round size is written only from a Revise card.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/repositories/local_scope.dart' show userIdProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/key_button.dart';
import 'package:mockmob/features/review/revise/revise_data.dart' show reviseCapProvider, revisePrefsStoreProvider;
import 'package:mockmob/features/today/copy_glance.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/widgets/suggested_stack.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/today_fixtures.dart';

/// Sunday 18 October 2026, 7:40 PM IST.
final DateTime _sunday = DateTime.utc(2026, 10, 18, 14, 10);

/// A first week with its repairs done and two cards due in Revise: Revise is the recommended
/// move (as on the walk), the weakest chapter waits in the stack.
TodayInputs _inputs({int? selectedMinutes, int reviseCap = 10}) {
  final q = paper(id: 'q1', completedAt: daysBefore(_sunday, 1), mode: 'quick', runs: const [('Partnership fundamentals', V.right, 8), ('Partnership fundamentals', V.wrong, 2)]);
  return ashaInputs(
    now: _sunday,
    attempts: [q],
    reviseDue: 2,
    repaired: const {'q1': {'q1-q9', 'q1-q10'}},
    reviseCap: reviseCap,
    selectedMinutes: selectedMinutes,
  );
}

/// Today's body with the screen's wiring: a pick goes through [TodayActions.chooseLength], whose two
/// settings feed the inputs the view is built from.
class _Harness extends StatefulWidget {
  const _Harness({required this.picks});

  final List<(int, MoveKind)> picks;

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  int? _minutes;
  int _cap = 10;

  @override
  Widget build(BuildContext context) => TodayBody(
        view: buildToday(_inputs(selectedMinutes: _minutes, reviseCap: _cap)),
        skeletonDelay: Duration.zero,
        callbacks: TodayCallbacks(
          onAction: (_) {},
          onTarget: (_) {},
          onMinutes: (m, shown) {
            widget.picks.add((m, shown));
            setState(() => shown == MoveKind.revise ? _cap = m : _minutes = m);
          },
        ),
      );
}

/// The card's key, by the label a screen reader hears (it is drawn as verb and length).
Finder _key(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.semanticsLabel == label);

final _overrides = [
  authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
];

void main() {
  setUpAll(loadAppFonts);
  setUp(debugResetTodayPicks);

  test('the fixture: Revise leads and the weakest chapter is in the stack', () {
    final view = buildToday(_inputs());
    expect((view.hero! as MoveHero).kind, MoveKind.revise);
    expect(view.choices.map((c) => c.key), contains('weakest'));
  });

  testWidgets('a card swapped in from the stack takes the pick: 5 questions, about 5 min, its key says 5', (tester) async {
    final picks = <(int, MoveKind)>[];
    await pumpMockmob(tester, _Harness(picks: picks), size: const Size(412, 2400), disableAnimations: true, overrides: _overrides);
    final weakest = buildToday(_inputs()).choices.firstWhere((c) => c.key == 'weakest').hero!;
    final chapter = weakest.numberLabel!.split('\n').last;

    // Bring the weakest chapter to the top of the stack and make it the lead card.
    final top = find.byKey(SuggestedStack.topKey);
    for (var i = 0; i < 5 && find.descendant(of: top, matching: find.text(GlanceCopy.titleWeakest)).evaluate().isEmpty; i++) {
      await tester.tap(find.descendant(of: top, matching: find.text(SuggestedCopy.skip)));
      await tester.pumpAndSettle();
    }
    await tester.tap(find.descendant(of: top, matching: find.text(SuggestedCopy.doThis)));
    await tester.pumpAndSettle();
    expect(_key('Start practice, 10 min'), findsOneWidget, reason: 'the weakest chapter ($chapter) is the lead card now');
    expect(find.text(GlanceCopy.lengthToken(10)), findsOneWidget);

    await tester.tap(find.text(GlanceCopy.lengthToken(10)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('5 questions').last);
    await tester.pumpAndSettle();

    expect(picks, [(5, MoveKind.weakest)], reason: 'the pick names the card on screen, not the recommended Revise');
    expect(find.text('5'), findsWidgets);
    expect(find.text(GlanceCopy.lengthToken(5)), findsOneWidget);
    expect(_key('Start practice, 5 min'), findsOneWidget);
    expect(_key('Start practice, 10 min'), findsNothing);
  });

  group('TodayActions.chooseLength', () {
    ProviderContainer container() {
      final c = ProviderContainer(overrides: [
        revisePrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
        userIdProvider.overrideWithValue('u'),
        todayStudentDayProvider.overrideWithValue('2026-10-18'),
      ]);
      addTearDown(c.dispose);
      return c;
    }

    test('a practice card takes the visit length and leaves Revise\'s round size alone', () async {
      final c = container();
      await c.read(reviseCapProvider.future);
      c.read(todayActionsProvider).chooseLength(5, MoveKind.weakest);
      expect(c.read(todayMinutesProvider), 5);
      expect(c.read(reviseCapProvider).value, 10);
    });

    test('only a Revise card on screen sizes the Revise round', () async {
      final c = container();
      await c.read(reviseCapProvider.future);
      c.read(todayActionsProvider).chooseLength(5, MoveKind.revise);
      expect(c.read(reviseCapProvider).value, 5);
      expect(c.read(todayMinutesProvider), isNull);
    });
  });
}
