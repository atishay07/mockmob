// D96 final fix pass (18 Oct, final walk) on the "Suggested for you" deck:
// - the card's object has its own corner: the title wraps before it at 360 dp and at large text (37);
// - the art is chosen by the card's kind, never the same object on every card (37, 43);
// - the coach line swaps by fade-through, never two lines readable at once (53);
// - the end card says the passed cards wait, as Not now promised (L).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/art/mm_art.dart';
import 'package:mockmob/features/today/copy_suggested.dart';
import 'package:mockmob/features/today/logic/suggested_deck.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/screens/today_body.dart' show debugResetTodayPicks;
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

TodayView _view() => buildToday(ashaInputs(now: _sunday, attempts: ashaRecord(_sunday), week: _week, reviseDue: 6));

String _artKey(SuggestedCard c) => '${c.art}:${c.art == SuggestedArt.subject ? c.subjectId : c.art == SuggestedArt.mobi ? c.pose : ''}';

void main() {
  setUpAll(loadAppFonts);
  setUp(() {
    debugResetTodayPicks();
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = MemoryPrefsStore();
    DeckMemoryStore.store = MemoryPrefsStore();
    DeckMemoryStore.clock = () => _sunday;
  });
  tearDown(() {
    DeckCoach.debugReset();
    DeckMemoryStore.debugReset();
    SuggestedStack.debugReset();
    DeckCoach.store = null;
    DeckMemoryStore.store = null;
  });

  group('the art by kind', () {
    test('every card of the deck shows its own art', () {
      final view = _view();
      final deck = buildSuggestedDeck(view.choices, glance: view.glance);
      final keys = [for (final c in deck) _artKey(c)];
      expect(keys.toSet().length, keys.length, reason: 'never the same object twice in one deck: $keys');
    });

    test('a card whose object is already on the deck takes a Mobi pose not used yet', () {
      final view = _view();
      final base = buildSuggestedDeck(view.choices, glance: view.glance).first;
      final same = [
        base.withArt(SuggestedArt.subject),
        base.withArt(SuggestedArt.subject),
        base.withArt(SuggestedArt.mobi, pose: MmArt.mobiPoint),
        base.withArt(SuggestedArt.subject),
      ];
      final out = distinctArt(same);
      expect(out[0].art, SuggestedArt.subject);
      expect(out[1].art, SuggestedArt.mobi);
      expect(out[1].pose, MmArt.mobiPoint);
      expect(out[2].pose, MmArt.mobiThink, reason: 'the point pose is taken, so the next one');
      expect(out[3].pose, MmArt.mobiRead);
      expect(out.map(_artKey).toSet().length, 4);
    });
  });

  group('the object keeps its corner', () {
    for (final scale in [1.0, 1.3]) {
      testWidgets('at 360 dp and text x$scale the title never runs under the object', (tester) async {
        final view = _view();
        final cards = buildSuggestedDeck(view.choices, glance: view.glance);
        await pumpMockmob(
          tester,
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(alignment: Alignment.topCenter, child: SuggestedStack(cards: cards, onChoose: (_) {}, onMore: () {})),
          ),
          size: const Size(360, 900),
          textScale: scale,
          disableAnimations: true,
          overrides: [
            authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
          ],
        );
        await tester.pumpAndSettle();
        final top = find.byKey(SuggestedStack.topKey);
        final corner = find.descendant(of: top, matching: find.byWidgetPredicate((w) => w is Positioned && w.top == 12 && w.right == 10));
        expect(corner, findsOneWidget);
        final art = tester.getRect(corner);
        final card = tester.getRect(top);
        expect(art.right, lessThanOrEqualTo(card.right), reason: 'the object stays on the card');
        for (final text in [cards.first.title, if (cards.first.cost != null) cards.first.cost!]) {
          final words = tester.getRect(find.descendant(of: top, matching: find.text(text)));
          expect(words.right, lessThanOrEqualTo(art.left), reason: '"$text" wraps before the object');
        }
        final foot = tester.getRect(find.descendant(of: top, matching: find.text(cards.first.line)));
        expect(foot.top, greaterThanOrEqualTo(art.bottom - 1), reason: 'the evidence line runs under the object, never beside it');
      });
    }
  });

  testWidgets('the coach line swaps by fade-through, never by an overlap', (tester) async {
    final view = _view();
    await pumpMockmob(
      tester,
      Padding(
        padding: const EdgeInsets.all(16),
        child: Align(
          alignment: Alignment.topCenter,
          child: SuggestedStack(cards: buildSuggestedDeck(view.choices, glance: view.glance), onChoose: (_) {}, onMore: () {}),
        ),
      ),
      size: const Size(412, 900),
      disableAnimations: true,
      overrides: [
        authSnapshotProvider.overrideWithBuild((ref, notifier) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u', name: 'Asha Verma')),
      ],
    );
    await tester.pumpAndSettle();
    final coach = find.byKey(SuggestedStack.coachKey).first;
    expect(find.ancestor(of: coach, matching: find.byType(MmFadeThrough)), findsOneWidget);
    expect(find.ancestor(of: coach, matching: find.byType(MmOverlapSwitcher)), findsNothing);
  });

  test('the end says the passed cards wait, as Not now promised; the count never says none are left', () {
    expect(SuggestedCopy.coachLeft, contains('It waits at the back'));
    expect(SuggestedCopy.allSeen(3), 'You passed all three. They wait here.');
    expect(SuggestedCopy.noneLeft, isNot(contains('None')));
    expect(SuggestedCopy.allSeen(3), isNot(contains('!')));
  });
}
