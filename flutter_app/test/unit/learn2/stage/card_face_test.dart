// The stage's Key card, a flashcard (R3 L1): it fills its page less the 28 dp stamp line, the words centred between the kind
// line and the source, a long back scrolls inside with a fade at its foot, the front is one tap target that a screen reader names,
// the turn takes 340 ms with the faces swapping at 90 degrees and one light haptic (a cross-fade under reduced motion), the stamp
// line says In Revise (a check) or the bad line, blanks keep the punctuation that touches them, a chemistry card draws its
// notation, and there is no Must-know tag.
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/keycards/data/keycards_models.dart';
import 'package:mockmob/features/learn2/stage/card_face.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';
import 'package:mockmob/features/learn2/stage/stage_sci.dart';

import '../../../helpers/fonts.dart';
import 'support/stage_cards.dart';
import 'support/stage_harness.dart';

/// A card on a pager page, the way the feed shows one, with the turn held by the host.
class _CardHost extends StatefulWidget {
  const _CardHost({required this.name, this.stamp, this.turned = false, this.extraKind, this.tagRight = false, this.card, this.sci = false});

  final String name;

  /// A card of the test's own (a chemistry one) instead of a named real card.
  final KeyCard? card;
  final bool sci;
  final StageStamp? stamp;
  final bool turned;
  final String? extraKind;
  final bool tagRight;

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
              child: CardFace.of(widget.card ?? stageCard(widget.name), turned: turned, onTurn: turn, stamp: widget.stamp, extraKind: widget.extraKind, tagRight: widget.tagRight, sci: widget.sci),
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

  test('the size rule outside a pager: at least clamp(300, 46%, 380), at most the area less 28 and 4% of the screen', () {
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
    for (final step in ['s', 'm', 'l']) {
      expect(CardFace.promptStyle(step, 390).height, 1.15, reason: 'line height 1.15 at every step');
    }
  });

  testWidgets('a flashcard fills its page: all the height less the 28 dp stamp line, whatever the words', (tester) async {
    for (final name in ['sacrificing', 'premium', 'paidPrivately']) {
      await tester.pumpWidget(const SizedBox());
      await pumpStage(tester, _onStage(_CardHost(name: name)));
      await tester.pumpAndSettle();
      final area = StagePager.areaOf(tester.element(_cardBox))!;
      // The page is the area less the 40 dp peek; the card sits 4 dp under its top and 12 above its foot, and the stamp line is under it.
      expect(area, 634 - 40, reason: name);
      expect(_cardHeight(tester), moreOrLessEquals(area - 16 - 28, epsilon: 0.5), reason: name);
    }
  });

  testWidgets('the words sit centred between the kind line and the source', (tester) async {
    await pumpStage(tester, _onStage(const _CardHost(name: 'sacrificing')));
    await tester.pumpAndSettle();
    final kind = tester.getRect(find.text('Definition').first);
    final source = tester.getRect(find.text('Accountancy Part 1, Ch 2, p. 52').first);
    final words = tester.getRect(find.textContaining('What is the sacrificing ratio?').first);
    final above = words.top - kind.bottom;
    final below = source.top - words.bottom;
    expect((above - below).abs(), lessThan(24), reason: 'about as much room above the words as below them');
    expect(above, greaterThan(100), reason: 'a flashcard, not a card with its words at the top');
  });

  testWidgets('the extra kind sits beside the kind on a feed card and at the right edge on a run card (the stage tag, like the web)', (tester) async {
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', extraKind: 'Back from earlier')));
    await tester.pumpAndSettle();
    final card = tester.getRect(find.byType(CardFace));
    final kind = tester.getRect(find.text('Definition').first);
    final beside = tester.getRect(find.text('Back from earlier').first);
    expect(beside.left - kind.right, closeTo(12, 1), reason: 'the feed: 12 dp after the kind');
    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', extraKind: 'Due today', tagRight: true)));
    await tester.pumpAndSettle();
    final tag = tester.getRect(find.text('Due today').first);
    expect(tag.right, closeTo(card.right - 20, 3), reason: 'the run: at the right edge of the card, inside its padding');
    final paragraph = tester.renderObject<RenderParagraph>(find.text('Due today').first);
    final glyphs = paragraph.getBoxesForSelection(const TextSelection(baseOffset: 0, extentOffset: 9));
    final glyphsLeft = paragraph.localToGlobal(Offset(glyphs.first.left, 0)).dx;
    expect(glyphsLeft, greaterThan(tester.getRect(find.text('Definition').first).right + 60), reason: 'the words are at the right, far from the kind');
    expect(tester.getRect(find.text('Definition').first).left, closeTo(card.left + 20, 3), reason: 'the kind stays top-left');
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

  testWidgets('a blank keeps the punctuation that touches it: one unbreakable run, the gap read as blank', (tester) async {
    final handle = tester.ensureSemantics();
    final card = KeyCard.tryParse({
      'id': 'x',
      'kind': 'key_line',
      'front': 'The partners share ____, and the firm keeps ("____") for the year.',
      'back': 'The partners share profits, and the firm keeps ("goodwill") for the year.',
      'blanks': ['profits', 'goodwill'],
    })!;
    await pumpStage(tester, _onStage(_CardHost(name: 'x', card: card)));
    await tester.pumpAndSettle();
    final rich = tester.widgetList<RichText>(find.descendant(of: _cardBox, matching: find.byType(RichText))).map((r) => r.text.toPlainText(includeSemanticsLabels: false)).toList();
    final front = rich.firstWhere((t) => t.contains('The partners share'));
    expect(front, contains('\u00A0,'), reason: 'the comma follows the gap with no word space, so a line never starts with a comma');
    expect(front, contains('("\u00A0'), reason: 'an opening bracket and quote stay on the gap');
    expect(front, contains('\u00A0")'), reason: 'and the closing ones');
    expect(front.contains(' ,'), isFalse);
    handle.dispose();
  });

  testWidgets('a chemistry card draws subscripts and superscripts; the same words read plain for a screen reader', (tester) async {
    final handle = tester.ensureSemantics();
    final card = KeyCard.tryParse({
      'id': 'c',
      'kind': 'definition',
      'subject': 'chemistry',
      'chapterKey': 'chemistry.solutions',
      'front': 'What is the charge on SO42- in H2SO4?',
      'back': 'The sulphate ion, SO42-, comes from H2SO4.',
      'blanks': [],
    })!;
    await pumpStage(tester, _onStage(_CardHost(name: 'c', card: card, sci: true)));
    await tester.pumpAndSettle();
    final spans = <StageSciSpan>[];
    for (final r in tester.widgetList<RichText>(find.descendant(of: _cardBox, matching: find.byType(RichText), skipOffstage: false))) {
      r.text.visitChildren((s) {
        if (s is StageSciSpan) spans.add(s);
        return true;
      });
    }
    expect(spans.map((s) => s.run), containsAll(['2', '4']));
    expect(spans.where((s) => s.raised).map((s) => s.run), contains('2-'.replaceAll('-', '\u2212')), reason: 'the charge is raised');
    expect(find.bySemanticsLabel(RegExp('SO42')), findsWidgets, reason: 'a screen reader reads the same characters');
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
    expect(_cardHeight(tester), moreOrLessEquals(area - 16 - 28, epsilon: 0.5), reason: 'a long back never grows the card: it scrolls inside');
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

  testWidgets('the stamp line: In Revise with a check; a failed add in the bad colour, no check', (tester) async {
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', stamp: StageStamp('In Revise'))));
    await tester.pumpAndSettle();
    expect(find.text('In Revise'), findsOneWidget);
    expect(find.descendant(of: _cardBox, matching: find.byIcon(LucideIcons.check)), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, _onStage(const _CardHost(name: 'premium', stamp: StageStamp('Not added. Try again.', bad: true))));
    await tester.pumpAndSettle();
    final text = tester.widget<Text>(find.text('Not added. Try again.'));
    expect(text.style?.color, const Color(0xFFFFA396), reason: "Night's bad colour");
    expect(find.descendant(of: _cardBox, matching: find.byIcon(LucideIcons.check)), findsNothing);
  });

  testWidgets('a card with no stamp line (the run puts its stamp under its keys) gives the 28 dp back to the card', (tester) async {
    await pumpStage(
      tester,
      _onStage(
        StagePager(
          count: 1,
          index: 0,
          peek: 0,
          onGo: (_) {},
          pageBuilder: (context, i) => StagePage.card(label: 'Card 1 of 1', child: CardFace.of(stageCard('premium'), stampLine: false)),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final area = StagePager.areaOf(tester.element(_cardBox))!;
    expect(area, 634);
    expect(_cardHeight(tester), moreOrLessEquals(area - 16, epsilon: 0.5));
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
