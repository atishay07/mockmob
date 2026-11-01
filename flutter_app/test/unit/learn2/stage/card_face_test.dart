// The stage's Key card: it fits its words between clamp(300, 46%, 380) and the item area less the stamp line, a long
// back scrolls inside with a fade at its foot, the front is one tap target that a screen reader names, the turn takes
// 340 ms with the faces swapping at 90 degrees and one light haptic (a cross-fade under reduced motion), the stamp
// line says In Revise or the bad line, and there is no Must-know tag.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_cards.dart';
import 'support/stage_harness.dart';

/// A card on a pager page, the way the feed shows one, with the turn held by the host.
class _CardHost extends StatefulWidget {
  const _CardHost({required this.name, this.stamp, this.turned = false, this.extraKind});

  final String name;
  final StageStamp? stamp;
  final bool turned;
  final String? extraKind;

  @override
  State<_CardHost> createState() => _CardHostState();
}

class _CardHostState extends State<_CardHost> {
  late bool turned = widget.turned;
  int turns = 0;

  void turn() => setState(() {
    turns++;
    turned = !turned;
  });

  @override
  Widget build(BuildContext context) {
    return StagePager(
      count: 2,
      index: 0,
      onGo: (_) {},
      pageBuilder: (context, i) => i == 0
          ? StagePage.card(
              label: 'Card 1 of 2',
              child: CardFace.of(stageCard(widget.name), turned: turned, onTurn: turn, stamp: widget.stamp, extraKind: widget.extraKind),
            )
          : const StagePage.centre(label: 'Checkpoint after 1 of 2', child: Text('next')),
    );
  }
}

/// The card inside a 360 x 800 phone's item area (800 less the top bar, the action bar and the margins).
Widget _onStage(Widget child) => Column(children: [const SizedBox(height: 62), Expanded(child: child), const SizedBox(height: 104)]);

Finder get _cardBox => find.byType(CardFace);

/// Which faces are drawn (the hidden one keeps its size but is not painted).
({bool front, bool back}) _shown(WidgetTester tester) {
  final faces = tester.widgetList<Visibility>(find.descendant(of: _cardBox, matching: find.byType(Visibility))).toList();
  return (front: faces[0].visible, back: faces[1].visible);
}

double _cardHeight(WidgetTester tester) => tester.getSize(find.descendant(of: _cardBox, matching: find.byType(KeyedSubtree)).first).height;

void main() {
  setUpAll(loadAppFonts);

  test('the size rule: at least clamp(300, 46%, 380), at most the area less 28 and 4% of the screen', () {
    expect(CardFace.minHeightFor(600), 300);
    expect(CardFace.minHeightFor(800), moreOrLessEquals(368));
    expect(CardFace.minHeightFor(932), 380);
    expect(CardFace.maxHeightFor(634, 800), moreOrLessEquals(634 - 28 - 32));
    expect(CardFace.maxHeightFor(300, 800), CardFace.minHeightFor(800), reason: 'never under the least height');
    expect(CardFace.promptStyle('s', 390).size, 34);
    expect(CardFace.promptStyle('m', 390).size, 28);
    expect(CardFace.promptStyle('l', 390).size, 22);
    expect(CardFace.promptStyle('s', 360).size, 32);
    expect(CardFace.promptStyle('m', 360).size, 26);
    expect(CardFace.promptStyle('l', 360).size, 21);
  });

  testWidgets('the front: kind, prompt, source; no Must-know tag; one named tap target', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', extraKind: 'Back from earlier')));
    expect(find.text('Definition'), findsWidgets);
    expect(find.text('Back from earlier'), findsWidgets);
    expect(find.textContaining("What is the new partner's share of goodwill"), findsWidgets);
    expect(find.text('Accountancy Part 1, Ch 2, p. 64'), findsNWidgets(2), reason: 'on the front foot and under the back');
    expect(find.text('Must-know'), findsNothing);
    expect(find.bySemanticsLabel("Turn over: What is the new partner's share of goodwill (premium for goodwill)?"), findsOneWidget);
    expect(_cardHeight(tester), greaterThanOrEqualTo(CardFace.minHeightFor(800) - 0.5));
    handle.dispose();
  });

  testWidgets('a blank is spoken as "blank" on the turn target', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpStage(tester, _onStage(const _CardHost(name: 'paidPrivately')));
    expect(
      find.bySemanticsLabel('Turn over: If this amount is paid to the old partners directly (privately) by the new partner, blank is passed in the books of the firm.'),
      findsOneWidget,
    );
    handle.dispose();
  });

  testWidgets('a tap on the front turns it with one light haptic; the faces swap at 90 degrees; the size holds', (tester) async {
    final haptics = StageHaptics();
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium')), haptics: haptics);
    final before = _cardHeight(tester);
    await tester.tap(_cardBox);
    await tester.pump();
    expect(tester.state<_CardHostState>(find.byType(_CardHost)).turns, 1);
    expect(haptics.calls, ['light']);
    // Before 90 degrees the front still shows; after it, the back.
    await tester.pump(const Duration(milliseconds: 30));
    expect(_shown(tester), (front: true, back: false));
    await tester.pump(const Duration(milliseconds: 200));
    expect(_shown(tester), (front: false, back: true));
    await tester.pump(const Duration(milliseconds: 200));
    expect(_cardHeight(tester), before, reason: 'both faces are measured: the turn never changes the card');
    expect(find.text('Turn back'), findsOneWidget);
    await tester.tap(find.text('Turn back'));
    await tester.pumpAndSettle();
    expect(tester.state<_CardHostState>(find.byType(_CardHost)).turns, 2);
    expect(haptics.calls, ['light', 'light']);
  });

  testWidgets('under reduced motion the turn is a short cross-fade, with no rotation', (tester) async {
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium')), reduced: true);
    await tester.tap(_cardBox);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    final rotations = tester.widgetList<Transform>(find.descendant(of: _cardBox, matching: find.byType(Transform)));
    expect(rotations.where((t) => t.transform.getRotation().entry(0, 0) < 0.999), isEmpty);
    expect(find.descendant(of: _cardBox, matching: find.byType(Visibility)), findsNothing, reason: 'no 3D faces: both stay laid out and fade');
    await tester.pump(const Duration(milliseconds: 100));
    final fades = tester.widgetList<Opacity>(find.descendant(of: _cardBox, matching: find.byType(Opacity))).map((o) => o.opacity).toList();
    expect(fades, containsAll([0.0, 1.0]), reason: 'the front has faded out and the back in');
  });

  testWidgets('a long back fits up to the area, then scrolls inside with a fade at its foot', (tester) async {
    await pumpStage(tester, _onStage(const _CardHost(name: 'economic', turned: true)));
    await tester.pumpAndSettle();
    final area = StagePager.areaOf(tester.element(_cardBox))!;
    expect(_cardHeight(tester), moreOrLessEquals(CardFace.maxHeightFor(area, 800), epsilon: 0.5));
    final fade = find.descendant(of: _cardBox, matching: find.byType(AnimatedOpacity));
    expect(tester.widgetList<AnimatedOpacity>(fade).any((o) => o.opacity == 1), isTrue, reason: 'the foot fades while more is below');
    // The back scrolls inside before the pager takes anything (the edge rule holds inside the card).
    final scroll = find.descendant(of: _cardBox, matching: find.byType(Scrollable)).last;
    final position = tester.state<ScrollableState>(scroll).position;
    expect(position.maxScrollExtent, greaterThan(0));
    await tester.timedDrag(find.textContaining('Existing structure of the economy'), const Offset(0, -160), const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(position.pixels, greaterThan(100));
  });

  testWidgets('the stamp line: In Revise with the bookmark; a failed Keep in the bad colour, no bookmark', (tester) async {
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', stamp: StageStamp('In Revise'))));
    await tester.pumpAndSettle();
    expect(find.text('In Revise'), findsOneWidget);
    expect(find.descendant(of: _cardBox, matching: find.byType(StageBookmark)), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', stamp: StageStamp('Not kept. Try again.', bad: true))));
    await tester.pumpAndSettle();
    final text = tester.widget<Text>(find.text('Not kept. Try again.'));
    expect(text.style?.color, const Color(0xFFFFA396), reason: "Night's bad colour");
    expect(find.descendant(of: _cardBox, matching: find.byType(StageBookmark)), findsNothing);
  });

  testWidgets('every size step and the long back fit at text scale 1.3 on a 360 dp phone', (tester) async {
    for (final name in ['sacrificing', 'premium', 'paidPrivately', 'capitalAlt']) {
      await tester.pumpWidget(const SizedBox());
      await pumpStage(tester, _onStage(_CardHost(name: name)), textScale: 1.3);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: name);
    }
    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _onStage(const _CardHost(name: 'economic', turned: true)), textScale: 1.3);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
