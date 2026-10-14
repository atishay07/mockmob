// UI blitz, practice track (14 Oct): the chooser's layout rules, the length dial's semantics,
// taps, drag and haptics, and the filed-sheet ending after "Finish for now".
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderParagraph;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show SubjectChoice;
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';
import 'package:mockmob/features/practice/widgets/length_dial.dart';
import 'package:mockmob/features/practice/widgets/quick_start_deck.dart';
import 'package:mockmob/features/practice/widgets/result_states.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;

class _Recorder implements HapticDriver {
  final List<String> calls = [];

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<void> selectionClick() async => calls.add('selection');
}

Future<_Recorder> _pump(WidgetTester tester, Widget child, {double textScale = 1, bool reduceMotion = false}) async {
  tester.view.physicalSize = const Size(384, 853) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final haptics = _Recorder();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.dark),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale), disableAnimations: reduceMotion),
            child: child!,
          ),
          home: Scaffold(
            body: SafeArea(
              child: Padding(padding: const EdgeInsets.all(16), child: child),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  return haptics;
}

ChoiceOption _o(String id, {VoidCallback? onTap}) =>
    ChoiceOption(id: id, glyph: QuickStartDeck.glyphFor(id), title: 'Title $id', note: 'Note $id', onTap: onTap ?? () {});

class _Dial extends StatefulWidget {
  const _Dial();

  @override
  State<_Dial> createState() => _DialState();
}

class _DialState extends State<_Dial> {
  int count = 10;

  @override
  Widget build(BuildContext context) =>
      LengthDial(count: count, counts: const [5, 10, 15, 20], semanticsLabel: 'Questions', onChanged: (c) => setState(() => count = c));
}

void main() {
  setUpAll(loadAppFonts);

  group('the chooser is laid out by role, not as identical rows', () {
    test('the first choice leads, the rest pair up, an odd one runs wide, the quiet one closes', () {
      final rows = arrangeChoices([_o('quick'), _o('mock'), _o('nta'), _o('repair'), _o('ask')], quiet: const {'ask'});
      expect(rows.map((r) => r.runtimeType), [LeadRow, PairRow, WideRow, QuietRow]);
      expect((rows[0] as LeadRow).option.id, 'quick');
      expect((rows[1] as PairRow).first.id, 'mock');
      expect((rows[1] as PairRow).second.id, 'nta');
      expect((rows[2] as WideRow).option.id, 'repair');
      expect((rows[3] as QuietRow).option.id, 'ask');
    });

    test('a resume leads and Ask gives way: the order the sheet hands in is kept', () {
      final rows = arrangeChoices([_o('resume'), _o('quick'), _o('mock'), _o('nta'), _o('repair')], quiet: const {'ask'});
      expect(rows.map((r) => r.runtimeType), [LeadRow, PairRow, PairRow]);
      expect([for (final r in rows) ...r.options.map((o) => o.id)], ['resume', 'quick', 'mock', 'nta', 'repair']);
    });

    test('every quick-start id draws its own glyph', () {
      final kinds = {
        for (final id in ['resume', 'quick', 'mock', 'nta', 'repair', 'ask']) QuickStartDeck.glyphFor(id),
      };
      expect(kinds.length, 6);
      expect(QuickStartDeck.glyphFor('ask'), ChoiceGlyphKind.ask);
    });

    testWidgets('a tap gives a light tick and opens the choice; each tile is one named button', (tester) async {
      final opened = <String>[];
      final haptics = await _pump(
        tester,
        SingleChildScrollView(
          child: QuickStartDeck(
            options: [
              for (final id in ['quick', 'mock', 'nta', 'repair', 'ask']) _o(id, onTap: () => opened.add(id)),
            ],
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.byWidgetPredicate((w) => w is MmPressable && w.semanticsLabel == 'Title mock. Note mock'), findsOneWidget);
      await tester.tap(find.text('Title nta'));
      await tester.pump(const Duration(milliseconds: 700));
      expect(opened, ['nta']);
      expect(haptics.calls, ['light']);
    });

    testWidgets('no choice carries a watermark behind its text: each object sits clear of the copy', (tester) async {
      await _pump(
        tester,
        SingleChildScrollView(
          child: QuickStartDeck(
            options: [
              for (final id in ['quick', 'mock', 'nta', 'repair', 'ask']) _o(id),
            ],
          ),
        ),
        reduceMotion: true,
      );
      for (final id in ['mock', 'nta']) {
        final tile = tester.getRect(find.byKey(ValueKey('choice-$id')));
        final glyph = tester.getRect(find.descendant(of: find.byKey(ValueKey('choice-$id')), matching: find.byType(ChoiceGlyph)));
        final title = tester.getRect(find.text('Title $id'));
        expect(tile.contains(glyph.center), isTrue, reason: id);
        expect(glyph.bottom <= title.top, isTrue, reason: '$id: the object ends above its title');
      }
    });

    testWidgets('a band runs past the deck by its bleed and keeps its tiles on the deck width', (tester) async {
      await _pump(
        tester,
        SingleChildScrollView(
          child: ChoiceDeck(
            bleed: 16,
            animateIn: false,
            rows: [
              ChoiceRow.band(title: 'Exam conditions', rows: [ChoiceRow.pair(_o('mock'), _o('nta'))]),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      // The page pads the deck by 16, so a band bled by 16 reaches the screen edges.
      final band = tester.getRect(find.ancestor(of: find.text('Exam conditions'), matching: find.byType(DecoratedBox)).first);
      expect(band.left, 0);
      expect(band.right, 384);
      expect(tester.getRect(find.byKey(const ValueKey('choice-mock'))).left, 16);
    });

    testWidgets('under reduced motion the deck is in place on the first frame', (tester) async {
      await _pump(tester, QuickStartDeck(options: [_o('quick'), _o('mock'), _o('nta')]), reduceMotion: true);
      final opacities = tester.widgetList<Opacity>(find.ancestor(of: find.byType(LeadChoice), matching: find.byType(Opacity)));
      expect(opacities.every((o) => o.opacity == 1), isTrue);
    });
  });

  group('the length dial', () {
    testWidgets('each stop is a selectable button that says its length', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const _Dial());
      expect(tester.getSemantics(find.bySemanticsLabel('10 questions')), isSemantics(isButton: true, isSelected: true));
      expect(tester.getSemantics(find.bySemanticsLabel('5 questions')), isSemantics(isButton: true, isSelected: false));
      handle.dispose();
    });

    testWidgets('a tap chooses with a selection tick; the chosen stop again does nothing', (tester) async {
      final haptics = await _pump(tester, const _Dial());
      await tester.tap(find.text('20'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.state<_DialState>(find.byType(_Dial)).count, 20);
      await tester.tap(find.text('20'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(haptics.calls, ['selection']);
    });

    testWidgets('a drag scrubs across the stops, ticking once per stop crossed', (tester) async {
      final haptics = await _pump(tester, const _Dial());
      final from = tester.getCenter(find.text('10'));
      final to = tester.getCenter(find.text('20'));
      final gesture = await tester.startGesture(from);
      const steps = 12;
      for (var i = 1; i <= steps; i++) {
        await gesture.moveTo(Offset.lerp(from, to, i / steps)!);
        await tester.pump(const Duration(milliseconds: 16));
      }
      await gesture.up();
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.state<_DialState>(find.byType(_Dial)).count, 20);
      // From the chosen 10: one tick for 15 and one for 20.
      expect(haptics.calls, ['selection', 'selection']);
    });

    testWidgets('at 1.3x text every stop fits whole', (tester) async {
      await _pump(tester, const _Dial(), textScale: 1.3);
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
      final dial = tester.getRect(find.byType(LengthDial));
      for (final n in ['5', '10', '15', '20']) {
        expect(dial.contains(tester.getRect(find.text(n)).bottomCenter), isTrue, reason: n);
      }
    });
  });

  group('the ticket', () {
    for (final scale in [1.0, 1.3]) {
      testWidgets('at ${scale}x text a long name wraps between words and the stub stays whole', (tester) async {
        await _pump(
          tester,
          const ComposerTicket(
            subjectId: 'bst',
            eyebrow: 'Quick practice',
            subject: 'Business Studies',
            count: 20,
            semanticsLabel: 'Quick practice, Business Studies',
          ),
          textScale: scale,
        );
        await tester.pump(const Duration(milliseconds: 500));
        expect(tester.takeException(), isNull);
        final name = tester.getRect(find.text('Business Studies'));
        final card = tester.getRect(find.byType(ComposerTicket));
        expect(card.contains(name.bottomRight), isTrue);
        // The stub's number sits right of the perforation, the name left of it.
        expect(name.right <= tester.getRect(find.text('20')).left, isTrue);
        // No word is cut: each word of the name fits on its own line.
        final paragraph = tester.renderObject<RenderParagraph>(find.text('Business Studies'));
        expect(paragraph.didExceedMaxLines, isFalse);
      });
    }

    testWidgets('the number on the stub rolls when the length changes', (tester) async {
      Widget ticket(int n) =>
          ComposerTicket(subjectId: 'acc', eyebrow: 'Quick practice', subject: 'Accountancy', count: n, semanticsLabel: 'x');
      await _pump(tester, ticket(10));
      await tester.pump(const Duration(milliseconds: 500));
      await _pump(tester, ticket(15));
      await tester.pump(const Duration(milliseconds: 80));
      // Mid-roll both numbers are in the tree.
      expect(find.text('10'), findsOneWidget);
      expect(find.text('15'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text('10'), findsNothing);
      expect(find.text('15'), findsOneWidget);
    });

    testWidgets('the ticket shape has a notch cut into its top and bottom edge', (tester) async {
      const shape = TicketBorder(stub: 80, notch: 9);
      const rect = Rect.fromLTWH(0, 0, 300, 120);
      final path = shape.getOuterPath(rect);
      expect(path.contains(const Offset(220, 0.5)), isFalse, reason: 'the top notch');
      expect(path.contains(const Offset(220, 119.5)), isFalse, reason: 'the bottom notch');
      expect(path.contains(const Offset(150, 0.5)), isTrue);
      expect(path.contains(const Offset(220, 60)), isTrue);
    });
  });

  group('the subject strip', () {
    testWidgets('fades where chips wait past the edge', (tester) async {
      final choices = [
        for (final id in ['accountancy', 'english', 'economics', 'business', 'maths'])
          SubjectChoice(id, id[0].toUpperCase() + id.substring(1)),
      ];
      await _pump(tester, SubjectChips(choices: choices, selectedId: 'accountancy', onSelected: (_) {}, onMore: () {}));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.descendant(of: find.byType(SubjectChips), matching: find.byType(ShaderMask)), findsOneWidget);
    });
  });

  group('Finish for now files the sheet', () {
    testWidgets('the receipt is there from the first frame and the seal lands', (tester) async {
      await _pump(
        tester,
        const ResultClosing(text: 'Practice recorded at 11:51 PM.', cells: [QuestionCell.right, QuestionCell.wrong, QuestionCell.blank]),
      );
      expect(find.text('Practice recorded at 11:51 PM.'), findsOneWidget);
      expect(find.byType(QuestionStrip), findsOneWidget);
      // The card says the score and numbers its bubbles; the counts line sits under it.
      expect(find.text('1'), findsWidgets);
      expect(find.text('1 right, 1 wrong, 1 not attempted'), findsOneWidget);
      await tester.pump(ResultClosing.duration);
      await tester.pump(const Duration(milliseconds: 100));
      final line = tester.widget<Opacity>(find.ancestor(of: find.byType(ReceiptLine), matching: find.byType(Opacity)).first);
      expect(line.opacity, 1);
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
