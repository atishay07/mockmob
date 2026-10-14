// UI blitz, practice track (14 Oct): the chooser's layout rules, the length dial's semantics,
// taps, drag and haptics, and the filed-sheet ending after "Finish for now".
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
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
            body: SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: child)),
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
  Widget build(BuildContext context) => LengthDial(
    count: count,
    counts: const [5, 10, 15, 20],
    semanticsLabel: 'Questions',
    onChanged: (c) => setState(() => count = c),
  );
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
      final kinds = {for (final id in ['resume', 'quick', 'mock', 'nta', 'repair', 'ask']) QuickStartDeck.glyphFor(id)};
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

    testWidgets('under reduced motion the deck is in place on the first frame', (tester) async {
      await _pump(tester, QuickStartDeck(options: [_o('quick'), _o('mock'), _o('nta')]), reduceMotion: true);
      final opacities = tester.widgetList<Opacity>(
        find.ancestor(of: find.byType(LeadChoice), matching: find.byType(Opacity)),
      );
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

  group('Finish for now files the sheet', () {
    testWidgets('the receipt is there from the first frame and the seal lands', (tester) async {
      await _pump(
        tester,
        const ResultClosing(
          text: 'Practice recorded at 11:51 PM.',
          cells: [QuestionCell.right, QuestionCell.wrong, QuestionCell.blank],
        ),
      );
      expect(find.text('Practice recorded at 11:51 PM.'), findsOneWidget);
      expect(find.byType(QuestionStrip), findsOneWidget);
      await tester.pump(ResultClosing.duration);
      await tester.pump(const Duration(milliseconds: 100));
      final line = tester.widget<Opacity>(
        find.ancestor(of: find.byType(ReceiptLine), matching: find.byType(Opacity)).first,
      );
      expect(line.opacity, 1);
      await tester.pump(const Duration(seconds: 3));
    });
  });
}
