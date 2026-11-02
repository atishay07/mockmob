// The stage's pager with real drags: 18% of the item area or 0.35 px/ms moves one item and never more, a slower or
// shorter drag springs back, the ends give with 0.35 resistance, a page whose content scrolls keeps the gesture (the
// edge rule), far pages are not built, a move from a key slides in 320 ms (at once under reduced motion), and a
// screen reader gets each page's name, Next and Previous, and an announcement after each move.
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';

import 'support/stage_harness.dart';

const double _area = 600;

/// A pager host that owns the index, as a screen does.
class _Host extends StatefulWidget {
  const _Host({required this.count, this.start = 0, this.tall = const {}, this.cards = const {}, this.log, this.taps});

  final int count;
  final int start;

  /// Pages whose content is taller than the area (a long question).
  final Set<int> tall;

  /// Key card pages: a flashcard that fills its page and has no scroll view of its own (its front).
  final Set<int> cards;
  final List<int>? log;

  /// The cards' taps (the turn), by page.
  final List<int>? taps;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  late int index = widget.start;

  void go(int i) {
    widget.log?.add(i);
    setState(() => index = i.clamp(0, widget.count - 1));
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: SizedBox(
        height: _area,
        width: 360,
        child: StagePager(
          count: widget.count,
          index: index,
          onGo: go,
          feedLabel: 'Test feed, ${widget.count} items',
          pageBuilder: (context, i) => widget.cards.contains(i)
              ? StagePage.card(
                  label: 'Card ${i + 1} of ${widget.count}',
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => widget.taps?.add(i),
                    child: SizedBox.expand(key: ValueKey('page-$i'), child: Center(child: Text('card $i'))),
                  ),
                )
              : widget.tall.contains(i)
              ? StagePage.question(
                  label: 'Question ${i + 1} of ${widget.count}',
                  child: SizedBox(
                    key: ValueKey('page-$i'),
                    height: 900,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [Text('top of $i'), Text('foot of $i')],
                    ),
                  ),
                )
              : StagePage.centre(
                  label: 'Card ${i + 1} of ${widget.count}',
                  child: SizedBox(key: ValueKey('page-$i'), height: 200, width: 300, child: Text('page $i')),
                ),
        ),
      ),
    );
  }
}

int _index(WidgetTester tester) => tester.state<_HostState>(find.byType(_Host)).index;

/// Where page [i]'s slot sits now, relative to the item area's top.
double _pageTop(WidgetTester tester, int i) =>
    tester.getTopLeft(find.byKey(ValueKey<Object>(i), skipOffstage: false)).dy - tester.getTopLeft(find.byType(StagePager)).dy;

/// The track's opacity over page [i].
double _trackOpacity(WidgetTester tester, int i) =>
    tester.widget<Opacity>(find.ancestor(of: find.byKey(ValueKey<Object>(i), skipOffstage: false), matching: find.byType(Opacity)).first).opacity;

Finder get _pager => find.byType(StagePager);

void main() {
  testWidgets('a drag that starts on a Key card\'s front moves the pager; a tap on it is still the card\'s', (tester) async {
    // The card has no scroll view of its own: the scroll view around its page must claim the swipe, or nothing would (the first
    // R4 build of the card page had none, and a swipe that began on a card did nothing).
    final log = <int>[];
    final taps = <int>[];
    await pumpStage(tester, _Host(count: 4, cards: const {0, 1, 2, 3}, log: log, taps: taps));
    await tester.timedDrag(find.text('card 0'), const Offset(0, -0.3 * _area), const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(_index(tester), 1);
    expect(log, [1]);
    await tester.fling(find.text('card 1'), const Offset(0, -40), 1000);
    await tester.pumpAndSettle();
    expect(_index(tester), 2);
    await tester.timedDrag(find.text('card 2'), const Offset(0, 0.3 * _area), const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(_index(tester), 1);
    expect(taps, isEmpty, reason: 'a drag is never a tap');
    await tester.tap(find.text('card 1'));
    await tester.pumpAndSettle();
    expect(taps, [1]);
    expect(_index(tester), 1);
  });

  testWidgets('a slow drag of 17% of the area springs back; 19% moves one item', (tester) async {
    final log = <int>[];
    await pumpStage(tester, _Host(count: 5, log: log));
    await tester.timedDrag(_pager, const Offset(0, -0.17 * _area), const Duration(milliseconds: 1000));
    await tester.pumpAndSettle();
    expect(_index(tester), 0);
    expect(log, isEmpty);
    expect(_pageTop(tester, 0), moreOrLessEquals(0, epsilon: 0.5), reason: 'the track sprang back home');

    await tester.timedDrag(_pager, const Offset(0, -0.19 * _area), const Duration(milliseconds: 1000));
    await tester.pumpAndSettle();
    expect(_index(tester), 1);
    expect(log, [1]);
    expect(_pageTop(tester, 1), moreOrLessEquals(0, epsilon: 0.5));

    // And back: 19% down from page 2 returns to page 1.
    await tester.timedDrag(_pager, const Offset(0, 0.19 * _area), const Duration(milliseconds: 1000));
    await tester.pumpAndSettle();
    expect(_index(tester), 0);
  });

  testWidgets('a fast short flick moves one item; a long fast fling still moves exactly one', (tester) async {
    final log = <int>[];
    await pumpStage(tester, _Host(count: 6, start: 1, log: log));
    // 40 dp at 1000 dp/s: well under 18%, well over 0.35 px/ms.
    await tester.fling(_pager, const Offset(0, -40), 1000);
    await tester.pumpAndSettle();
    expect(_index(tester), 2);
    // 500 dp at 4000 dp/s: one item, never two.
    await tester.fling(_pager, const Offset(0, -500), 4000);
    await tester.pumpAndSettle();
    expect(_index(tester), 3);
    expect(log, [2, 3]);
    // A slow short drag back is neither: it springs back.
    await tester.timedDrag(_pager, const Offset(0, 40), const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(_index(tester), 3);
  });

  testWidgets('the track follows the finger 1:1, with 0.35 resistance before the first page and after the last', (tester) async {
    await pumpStage(tester, const _Host(count: 3, start: 1));
    final middle = await tester.startGesture(tester.getCenter(_pager));
    await middle.moveBy(const Offset(0, 20));
    await tester.pump();
    await middle.moveBy(const Offset(0, 100));
    await tester.pump();
    expect(_pageTop(tester, 1), moreOrLessEquals(100, epsilon: 1), reason: 'in the middle the track moves 1:1 once it is taken');
    await middle.up();
    await tester.pumpAndSettle();
    expect(_index(tester), 0, reason: '120 dp down (20% of 600) moves to the previous page');

    final first = await tester.startGesture(tester.getCenter(_pager));
    await first.moveBy(const Offset(0, 20));
    await tester.pump();
    await first.moveBy(const Offset(0, 100));
    await tester.pump();
    expect(_pageTop(tester, 0), moreOrLessEquals(35, epsilon: 1), reason: 'before the first page the track gives 0.35');
    await first.up();
    await tester.pumpAndSettle();
    expect(_index(tester), 0);
    expect(_pageTop(tester, 0), moreOrLessEquals(0, epsilon: 0.5), reason: 'it springs back');

    // To the last page, then past it.
    await tester.fling(_pager, const Offset(0, -60), 1500);
    await tester.pumpAndSettle();
    await tester.fling(_pager, const Offset(0, -60), 1500);
    await tester.pumpAndSettle();
    expect(_index(tester), 2);
    final last = await tester.startGesture(tester.getCenter(_pager));
    await last.moveBy(const Offset(0, -20));
    await tester.pump();
    await last.moveBy(const Offset(0, -100));
    await tester.pump();
    expect(_pageTop(tester, 2), moreOrLessEquals(-35, epsilon: 1), reason: 'after the last page the track gives 0.35');
    await last.up();
    await tester.pumpAndSettle();
    expect(_index(tester), 2);
  });

  testWidgets('the edge rule: a tall page scrolls inside first, and only a fresh drag from its edge moves the pager', (tester) async {
    final log = <int>[];
    await pumpStage(tester, _Host(count: 3, tall: const {0}, log: log));
    ScrollPosition position() => tester.state<ScrollableState>(find.ancestor(of: find.text('top of 0'), matching: find.byType(Scrollable))).position;

    // A drag up scrolls the question, not the pager.
    await tester.timedDrag(_pager, const Offset(0, -150), const Duration(milliseconds: 600));
    await tester.pumpAndSettle();
    expect(position().pixels, greaterThan(100));
    expect(_index(tester), 0);
    expect(log, isEmpty);

    // One long drag that reaches the content's end and goes on: still the content's, the pager stays.
    await tester.timedDrag(_pager, const Offset(0, -450), const Duration(milliseconds: 900));
    await tester.pumpAndSettle();
    expect(position().pixels, moreOrLessEquals(position().maxScrollExtent, epsilon: 0.5));
    expect(_index(tester), 0, reason: 'a gesture that scrolled the content first is the content\'s to the end');
    expect(log, isEmpty);

    // A fresh drag from the edge moves the pager.
    await tester.timedDrag(_pager, const Offset(0, -140), const Duration(milliseconds: 800));
    await tester.pumpAndSettle();
    expect(_index(tester), 1);
    expect(log, [1]);

    // Back on the tall page from below: it is still at its end; a drag down scrolls it back first.
    await tester.timedDrag(_pager, const Offset(0, 140), const Duration(milliseconds: 800));
    await tester.pumpAndSettle();
    expect(_index(tester), 0);
    final end = position().pixels;
    await tester.timedDrag(_pager, const Offset(0, 140), const Duration(milliseconds: 800));
    await tester.pumpAndSettle();
    expect(position().pixels, lessThan(end));
    expect(_index(tester), 0);
  });

  testWidgets('while the pager holds a gesture the content does not move or fling', (tester) async {
    await pumpStage(tester, const _Host(count: 3, start: 1, tall: {1}));
    ScrollPosition position() => tester.state<ScrollableState>(find.ancestor(of: find.text('top of 1'), matching: find.byType(Scrollable))).position;
    expect(position().pixels, 0);
    // At the top, a drag down is the pager's; turning round mid-gesture must not scroll the question.
    final g = await tester.startGesture(tester.getCenter(_pager));
    await g.moveBy(const Offset(0, 30));
    await tester.pump();
    await g.moveBy(const Offset(0, 40));
    await tester.pump();
    await g.moveBy(const Offset(0, -150));
    await tester.pump();
    expect(position().pixels, 0, reason: 'the question never scrolled while the pager held the drag');
    await g.up();
    await tester.pumpAndSettle();
    expect(position().pixels, 0);
    expect(_index(tester), 1, reason: 'the net travel (80 dp up) is under 18%');
  });

  testWidgets('a tap and a sideways drag are not the pager\'s', (tester) async {
    final log = <int>[];
    await pumpStage(tester, _Host(count: 3, log: log));
    await tester.tap(_pager);
    await tester.pumpAndSettle();
    await tester.timedDrag(_pager, const Offset(-200, -40), const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
    expect(log, isEmpty);
    expect(_index(tester), 0);
  });

  testWidgets('pages more than 2 away are not built', (tester) async {
    await pumpStage(tester, const _Host(count: 10, start: 4));
    for (final i in [2, 3, 4, 5, 6]) {
      expect(find.text('page $i', skipOffstage: false), findsOneWidget, reason: 'page $i is near');
    }
    for (final i in [0, 1, 7, 8, 9]) {
      expect(find.text('page $i', skipOffstage: false), findsNothing, reason: 'page $i is far');
    }
  });

  testWidgets('a move from a key slides in 320 ms on the drawer curve; under reduced motion it is at once', (tester) async {
    await pumpStage(tester, const _Host(count: 4));
    tester.state<_HostState>(find.byType(_Host)).go(1);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    final mid = _pageTop(tester, 1);
    expect(mid, greaterThan(0));
    expect(mid, lessThan(_area));
    // The drawer curve is front-loaded: by 100 of 320 ms the page has come more than a third of the way.
    expect(mid, lessThan(_area * 0.66));
    await tester.pump(const Duration(milliseconds: 230));
    expect(_pageTop(tester, 1), moreOrLessEquals(0, epsilon: 0.5));

    await tester.pumpWidget(const SizedBox());
    await pumpStage(tester, const _Host(count: 4), reduced: true);
    tester.state<_HostState>(find.byType(_Host)).go(1);
    await tester.pump();
    expect(_pageTop(tester, 1), 0, reason: 'reduced motion switches at once');
    expect(_trackOpacity(tester, 1), lessThan(1), reason: 'with a short cross-fade');
    await tester.pump(const Duration(milliseconds: 130));
    expect(_trackOpacity(tester, 1), 1);
  });

  testWidgets('a jump of more than one item cross-fades instead of sliding through', (tester) async {
    await pumpStage(tester, const _Host(count: 12));
    tester.state<_HostState>(find.byType(_Host)).go(9);
    await tester.pump();
    expect(_pageTop(tester, 9), 0);
    await tester.pumpAndSettle();
    expect(find.text('page 9'), findsOneWidget);
  });

  testWidgets('a screen reader hears each page by name, has Next and Previous, and hears each move', (tester) async {
    final handle = tester.ensureSemantics();
    final said = captureAnnouncements(tester);
    await pumpStage(tester, const _Host(count: 3));
    expect(find.bySemanticsLabel('Card 1 of 3'), findsOneWidget);
    expect(find.bySemanticsLabel('Card 2 of 3'), findsNothing, reason: 'only the current page is read');

    SemanticsNode node(String label) => tester.getSemantics(find.bySemanticsLabel(label));
    final first = node('Card 1 of 3').getSemanticsData();
    expect(first.customSemanticsActionIds, hasLength(1), reason: 'the first page has Next only');

    void act(String label, String action) {
      final n = node(label);
      n.owner!.performAction(n.id, SemanticsAction.customAction, CustomSemanticsAction.getIdentifier(CustomSemanticsAction(label: action)));
    }

    act('Card 1 of 3', 'Next');
    await tester.pumpAndSettle();
    expect(_index(tester), 1);
    expect(said, contains('Card 2 of 3'));
    expect(node('Card 2 of 3').getSemanticsData().customSemanticsActionIds, hasLength(2), reason: 'Next and Previous');

    act('Card 2 of 3', 'Previous');
    await tester.pumpAndSettle();
    expect(_index(tester), 0);
    expect(said.last, 'Card 1 of 3');
    expect(find.bySemanticsLabel('Test feed, 3 items'), findsOneWidget);
    handle.dispose();
  });

  group('the peek (R2 ruling 7, R3 L3)', () {
    Widget host({int index = 0, Widget? chip, double peek = StagePager.peekHeight, List<String?> caps = const ['Definition', 'Question', 'So far', null]}) => Align(
      alignment: Alignment.topCenter,
      child: SizedBox(
        height: _area,
        width: 360,
        child: StagePager(
          count: caps.length,
          index: index,
          onGo: (_) {},
          peek: peek,
          chip: chip,
          pageBuilder: (context, i) => StagePage.centre(
            label: 'Card ${i + 1} of ${caps.length}',
            cap: caps[i],
            child: SizedBox(key: ValueKey('page-$i'), height: 100, width: 100, child: Text('page $i')),
          ),
        ),
      ),
    );

    testWidgets('a page is the area less 40 dp; the next page shows its top 40 dp as a card edge with its label', (tester) async {
      await pumpStage(tester, host());
      await tester.pumpAndSettle();
      expect(_pageTop(tester, 0), 0);
      expect(_pageTop(tester, 1), _area - 40, reason: 'one page (area less peek) below, so its top 40 dp is in the area');
      expect(tester.getSize(find.byKey(ValueKey<Object>(0), skipOffstage: false)).height, _area - 40);
      expect(find.text('Question'), findsOneWidget, reason: 'the next page label sits on its edge');
      Opacity edge(String label) => tester.widget<Opacity>(find.ancestor(of: find.text(label, skipOffstage: false), matching: find.byType(Opacity)).first);
      expect(edge('Question').opacity, 1);
      expect(find.text('So far', skipOffstage: false), findsOneWidget, reason: 'built, but not yet the next one');
      expect(find.byType(AnimatedOpacity), findsWidgets);
    });

    testWidgets('the label is hidden while the first visit chip covers the strip; the chip sits in the strip, centred', (tester) async {
      await pumpStage(tester, host(chip: const SizedBox(key: ValueKey('chip'), width: 200, height: 36)));
      await tester.pumpAndSettle();
      final chip = tester.getRect(find.byKey(const ValueKey('chip')));
      final pager = tester.getRect(_pager);
      expect(chip.bottom, pager.bottom - 2, reason: 'the chip foot is 2 dp above the area foot');
      expect(chip.height, 36);
      expect(chip.center.dx, moreOrLessEquals(pager.center.dx, epsilon: 0.5));
      final label = tester.widgetList<AnimatedOpacity>(find.ancestor(of: find.text('Question'), matching: find.byType(AnimatedOpacity)));
      expect(label.any((o) => o.opacity == 0), isTrue, reason: 'the type label hides while the chip shows');
    });

    testWidgets('a move slides one page (area less peek): the next page comes to the top, the one after peeks', (tester) async {
      await pumpStage(tester, host(index: 1));
      expect(_pageTop(tester, 1), 0);
      expect(_pageTop(tester, 2), _area - 40);
      expect(_pageTop(tester, 0), -(_area - 40));
    });

    testWidgets('a pager without a peek (the run one page) puts a whole area per page and draws no edge', (tester) async {
      await pumpStage(tester, host(peek: 0));
      expect(_pageTop(tester, 1), _area);
      expect(tester.getSize(find.byKey(ValueKey<Object>(0), skipOffstage: false)).height, _area);
      expect(find.text('Question', skipOffstage: false), findsNothing, reason: 'no edge, no label');
    });
  });
}
