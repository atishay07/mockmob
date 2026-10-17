// Design critic packet B (16 Oct): the Start sheet's before-mock row (12), the setup rail on the
// shared ChipRail (15), the Practice tab's one-primary pair and one-line reason (18), the chapter
// setup that shows each chapter once with a pill length row (19), and the Day bolt (30).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show SubjectChoice;
import 'package:mockmob/features/practice/model/practice_selection.dart' show maxChapters;
import 'package:mockmob/features/practice/widgets/chapter_picker.dart';
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/features/practice/widgets/composer_parts.dart';
import 'package:mockmob/features/practice/widgets/composer_ticket.dart';
import 'package:mockmob/features/practice/widgets/length_dial.dart';
import 'package:mockmob/features/practice/widgets/quick_start_deck.dart' show QuickStartDeck;
import 'package:mockmob/features/practice/widgets/suggestion_card.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;

Future<void> _pump(WidgetTester tester, Widget child, {double textScale = 1, double width = 384, Brightness brightness = Brightness.dark}) async {
  tester.view.physicalSize = Size(width, 853) * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(const Haptics(enabled: false))],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(brightness),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: app!),
          home: Scaffold(
            body: SafeArea(
              child: Padding(padding: const EdgeInsets.all(16), child: SingleChildScrollView(child: child)),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 600));
}

ChoiceOption _o(String id, ChoiceGlyphKind glyph) => ChoiceOption(id: id, glyph: glyph, title: 'Title $id', note: 'Note $id', onTap: () {});

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

  group('12: the before-mock notes are one row', () {
    testWidgets('the timer, Submit and Do Not Disturb sit on one line, with no orphan aside under them (AP3-08, A25)', (tester) async {
      await _pump(tester, const MockLines());
      final timer = tester.getRect(find.text(PracticeCopy.ruleTimer));
      final submit = tester.getRect(find.text(PracticeCopy.ruleSubmit));
      final silence = tester.getRect(find.text(PracticeCopy.ruleSilence));
      expect(timer.top, submit.top);
      expect(submit.top, silence.top);
      expect(timer.right <= submit.left && submit.right <= silence.left, isTrue, reason: 'three columns, left to right');
      expect(find.text('Water, pencil, rough sheet.'), findsNothing);
      // The old stacked notes are gone from the screen.
      expect(find.text(PracticeCopy.sheetDnd), findsNothing);
      expect(find.text(PracticeCopy.sheetTimer), findsNothing);
    });

    testWidgets('a screen reader still hears both full sentences', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, const MockLines());
      expect(find.bySemanticsLabel('${PracticeCopy.sheetTimer} ${PracticeCopy.sheetDnd}'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('the row is shorter than the three stacked notes were', (tester) async {
      await _pump(tester, const MockRulesRow());
      expect(tester.getSize(find.byType(MockRulesRow)).height, lessThan(80));
    });
  });

  group('15: the setup subject rail rides the shared ChipRail', () {
    testWidgets('it is a ChipRail, with every chip on it', (tester) async {
      final choices = [
        for (final id in ['accountancy', 'english', 'economics', 'business_studies', 'maths']) SubjectChoice(id, id[0].toUpperCase() + id.substring(1)),
      ];
      await _pump(tester, SubjectChips(choices: choices, selectedId: 'accountancy', onSelected: (_) {}, onMore: () {}));
      expect(find.descendant(of: find.byType(SubjectChips), matching: find.byType(ChipRail)), findsOneWidget);
      expect(find.text('Accountancy'), findsOneWidget);
    });

    testWidgets('the rail runs to the screen edge while the first chip stays on the gutter', (tester) async {
      final choices = [for (final id in ['accountancy', 'english', 'economics']) SubjectChoice(id, id)];
      await _pump(tester, SubjectChips(choices: choices, selectedId: 'accountancy', onSelected: (_) {}));
      final rail = tester.getRect(find.byType(ChipRail));
      expect(rail.left, 0);
      expect(rail.width, 384);
      final first = tester.getRect(find.byType(SubjectChips).first);
      expect(first.left, lessThanOrEqualTo(16));
    });
  });

  group('18: the Practice tab pair has one primary and one secondary', () {
    testWidgets('the leading tile is wider, both are as tall', (tester) async {
      await _pump(
        tester,
        ChoiceDeck(
          animateIn: false,
          rows: [ChoiceRow.pair(_o('quick', ChoiceGlyphKind.quick), _o('chapter', ChoiceGlyphKind.chapter), weighted: true)],
        ),
      );
      final first = tester.getRect(find.byKey(const ValueKey('choice-quick')));
      final second = tester.getRect(find.byKey(const ValueKey('choice-chapter')));
      expect(first.width, greaterThan(second.width));
      expect(first.height, second.height);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an unweighted pair stays two equals (the quick-start sheet)', (tester) async {
      await _pump(
        tester,
        ChoiceDeck(animateIn: false, rows: [ChoiceRow.pair(_o('mock', ChoiceGlyphKind.mock), _o('nta', ChoiceGlyphKind.nta))]),
      );
      final first = tester.getRect(find.byKey(const ValueKey('choice-mock')));
      final second = tester.getRect(find.byKey(const ValueKey('choice-nta')));
      expect(first.width, second.width);
    });

    testWidgets('a suggestion without an eyebrow starts at its title, and its reason is one line', (tester) async {
      await _pump(
        tester,
        SuggestionCard(
          subjectId: 'accountancy',
          number: '10',
          unit: PracticeCopy.questionsUnit,
          title: 'Your starting point',
          kicker: 'Accountancy, mixed chapters',
          reason: PracticeCopy.startingReason('Accountancy'),
          actionLabel: 'Start',
          onAction: () {},
        ),
      );
      expect(find.text(PracticeCopy.suggestedOverline), findsNothing);
      final reason = tester.getRect(find.text(PracticeCopy.startingReason('Accountancy')));
      expect(reason.height, lessThan(24), reason: 'one line of 14 sp text');
    });

    test('the reasons are written to fit one line', () {
      final lines = [
        PracticeCopy.startingReason('Accountancy'),
        PracticeCopy.pickedStartReason('Business Studies'),
        PracticeCopy.subjectReason(34, 50, 'yesterday'),
        PracticeCopy.subjectReason(100, 100, 'on Wednesday'),
        PracticeCopy.chapterReasonPractice(12),
        PracticeCopy.chapterReasonMock(148, 'Mock 12'),
        PracticeCopy.resumeMockReason(DateTime(2026, 10, 12, 23, 47)),
      ];
      for (final l in lines) {
        expect(l.length, lessThanOrEqualTo(44), reason: l);
      }
    });
  });

  group('19: chapter setup shows each chapter once', () {
    Widget field(List<String> chapters) => ChapterField(chapters: chapters, onTap: () {}, onRemove: (_) {});

    testWidgets('chosen chapters are chips only, with an Add chapters row and the count against the most', (tester) async {
      await _pump(tester, field(['Admission of a partner', 'Goodwill', 'Retirement and death of a partner']));
      await tester.pumpAndSettle();
      expect(find.text('Admission of a partner'), findsOneWidget);
      expect(find.text('Goodwill'), findsOneWidget);
      // The old summary row ("Admission of a partner, Goodwill and 1 more") is gone.
      expect(find.textContaining('and 1 more'), findsNothing);
      expect(find.text(PracticeCopy.addChapters), findsOneWidget);
      expect(find.text(PracticeCopy.chaptersChosen(3, maxChapters)), findsOneWidget);
    });

    testWidgets('with none chosen it is one row that says what to do', (tester) async {
      await _pump(tester, field(const []));
      expect(find.text(PracticeCopy.chooseChapter), findsOneWidget);
      expect(find.text(PracticeCopy.addChapters), findsNothing);
    });

    testWidgets('at the most it offers to change instead of add', (tester) async {
      await _pump(tester, field([for (var i = 0; i < maxChapters; i++) 'Chapter $i']));
      await tester.pumpAndSettle();
      expect(find.text(PracticeCopy.editChapters), findsOneWidget);
    });

    testWidgets('the length is one row of four pills with no box around them, and every pill is a 48 dp target', (tester) async {
      await _pump(tester, const _Dial());
      for (final n in ['5', '10', '15', '20']) {
        expect(find.text(n), findsOneWidget);
      }
      expect(LengthDial.pillHeight(TextScaler.noScaling), greaterThanOrEqualTo(48));
      final tops = {for (final n in ['5', '10', '15', '20']) tester.getRect(find.text(n)).top.roundToDouble()};
      expect(tops.length, 1, reason: 'one row');
      // No sunken well: nothing draws a box the whole width of the dial behind the pills.
      final dial = tester.getRect(find.byType(LengthDial));
      final wells = tester.widgetList<DecoratedBox>(find.descendant(of: find.byType(LengthDial), matching: find.byType(DecoratedBox))).where((b) {
        final r = tester.getRect(find.byWidget(b));
        return r.width >= dial.width - 1 && r.height > 40;
      });
      expect(wells, isEmpty);
    });

    testWidgets('only the chosen length hangs its dot sheet under its pill', (tester) async {
      await _pump(tester, const _Dial());
      final lit = tester.widgetList<AnimatedOpacity>(find.descendant(of: find.byType(LengthDial), matching: find.byType(AnimatedOpacity))).where((o) => o.opacity == 1);
      expect(lit.length, 1);
    });

    testWidgets('at 1.3x text the pills still fit', (tester) async {
      await _pump(tester, const _Dial(), textScale: 1.3);
      expect(tester.takeException(), isNull);
      final dial = tester.getRect(find.byType(LengthDial));
      for (final n in ['5', '10', '15', '20']) {
        expect(dial.contains(tester.getRect(find.text(n)).bottomCenter), isTrue, reason: n);
      }
    });
  });

  group('30: the lit bolt holds on Day', () {
    test('Day paints the lit bolt in the darker volt, Night in volt', () {
      final day = MmColors.light;
      final night = MmColors.dark;
      expect(day.voltEdge, isNot(day.volt));
      // The Day bolt's body is the darker volt: its luminance sits well under the cream ground's.
      expect(day.voltEdge.computeLuminance(), lessThan(day.volt.computeLuminance()));
      expect(night.volt.computeLuminance(), greaterThan(0.5));
    });
  });

  group('30: one NTA entry per sheet, the same subject in every sample line', () {
    int ntaGlyphs(WidgetTester tester) =>
        tester.widgetList<ChoiceGlyph>(find.byType(ChoiceGlyph)).where((g) => g.kind == ChoiceGlyphKind.nta).length;

    testWidgets('the Practice tab exam band has one NTA tile and nothing floating in the band', (tester) async {
      await _pump(
        tester,
        ChoiceDeck(
          animateIn: false,
          rows: [
            ChoiceRow.band(
              title: 'Exam conditions',
              rows: [ChoiceRow.pair(_o('full', ChoiceGlyphKind.mock), ChoiceOption(id: 'nta', glyph: ChoiceGlyphKind.nta, title: 'NTA mode', note: 'Note', onTap: () {}))],
            ),
          ],
        ),
      );
      expect(find.text('NTA mode'), findsOneWidget);
      expect(ntaGlyphs(tester), 1, reason: 'the palette glyph is drawn inside its own tile only');
    });

    testWidgets('the Start sheet deck has one NTA row, and its glyph is inside that row', (tester) async {
      final options = [
        ChoiceOption(id: 'quick', glyph: ChoiceGlyphKind.quick, title: 'Quick 10', note: '10 Accountancy questions, about 10 minutes.', onTap: () {}),
        ChoiceOption(id: 'mock', glyph: ChoiceGlyphKind.mock, title: 'Full mock', note: '50 questions, 60 minutes, timed like the exam.', onTap: () {}),
        ChoiceOption(id: 'nta', glyph: ChoiceGlyphKind.nta, title: 'NTA mode', note: 'The exam-day screen in Accountancy, as on the day.', onTap: () {}),
      ];
      await _pump(tester, QuickStartDeck(options: options, animateIn: false));
      expect(find.text('NTA mode'), findsOneWidget);
      expect(ntaGlyphs(tester), 1);
      final row = tester.getRect(find.byKey(const ValueKey('choice-nta')));
      final glyph = tester.getRect(find.byWidgetPredicate((w) => w is ChoiceGlyph && w.kind == ChoiceGlyphKind.nta));
      expect(row.contains(glyph.center), isTrue, reason: 'no NTA glyph floats outside its row');
    });
  });
}
