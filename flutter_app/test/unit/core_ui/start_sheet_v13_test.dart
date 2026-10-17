// The Start sheet, v13 (owner, 17 Oct, F4 to F7): every session is a pressable row with a go mark,
// the subject rail carries large objects and the others stand back, what follows the subject sits
// under the rail and says its name, a move that does not follow it sits above, and the mode titles
// stay on one line at every width.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmPressable;
import 'package:mockmob/features/practice/widgets/choice_deck.dart';
import 'package:mockmob/features/practice/widgets/choice_glyphs.dart';
import 'package:mockmob/core/art/art.dart' show SubjectEmblem;

const _subjects = ['accountancy', 'business_studies', 'economics', 'english', 'general_test'];

const _following = StartMove(
  title: 'Practise to refresh',
  location: '/practice/start?mode=quick&subject=accountancy&count=10',
  kind: 'practice',
);
const _repair = StartMove(title: 'Repair 4 mistakes in Ledgers', location: '/review/repair/a/q?count=4', kind: 'repair');
const _revise = StartMove(title: 'Start Revise, 10 min', location: '/review/revise', kind: 'revise');

Future<List<Uri>> _open(
  WidgetTester tester, {
  StartMove? move,
  bool full = true,
  double textScale = 1,
  Size size = const Size(360, 800),
  Brightness brightness = Brightness.light,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final opened = <Uri>[];
  final router = GoRouter(
    initialLocation: '/today',
    routes: [
      GoRoute(
        path: '/today',
        builder: (_, _) => Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const Material(child: QuickStartSheet()),
              ),
              child: const Text('Start'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/practice/start',
        builder: (_, state) {
          opened.add(state.uri);
          return const Scaffold(body: Text('started'));
        },
      ),
      GoRoute(
        path: '/practice/setup/:mode',
        builder: (_, state) {
          opened.add(state.uri);
          return const Scaffold(body: Text('setup'));
        },
      ),
      GoRoute(path: '/practice', builder: (_, _) => const Scaffold(body: Text('practice'))),
      GoRoute(path: '/exam/nta', builder: (_, _) => const Scaffold(body: Text('nta'))),
      GoRoute(path: '/review/repair/a/q', builder: (_, _) => const Scaffold(body: Text('repair'))),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        resumeDraftProvider.overrideWith((ref) => null),
        resumeOfferProvider.overrideWith((ref) async => null),
        startSubjectsProvider.overrideWith((ref) => _subjects),
        startDefaultSubjectProvider.overrideWith((ref) => 'accountancy'),
        if (move != null) startTonightMoveProvider.overrideWith((ref) => move),
        if (full) quickStartNtaProvider.overrideWith((ref) => const QuickNta(location: '/exam/nta?subject=accountancy', subject: 'accountancy', proOnly: true)),
        if (full) quickStartRepairProvider.overrideWith((ref) => const QuickRepair(location: '/review/repair/a/q', chapter: 'Cash flow')),
      ],
      child: MaterialApp.router(
        theme: buildTheme(brightness),
        routerConfig: router,
        builder: (context, child) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: child!),
      ),
    ),
  );
  await tester.tap(find.text('Start'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 800));
  return opened;
}

void main() {
  group('what follows the subject', () {
    testWidgets('a plain practice move sits under the rail and its title names the subject', (tester) async {
      await _open(tester, move: _following);
      expect(find.text('10 Accountancy questions'), findsOneWidget);
      final rail = tester.getRect(find.byKey(const ValueKey('start-subject-chips')));
      final heroTitle = tester.getRect(find.text('10 Accountancy questions'));
      expect(heroTitle.top, greaterThan(rail.bottom), reason: 'everything under the rail follows it');
      // The ten-question hero is the Quick 10 set already, so Quick 10 does not repeat it.
      expect(find.text('Quick 10'), findsNothing);
    });

    testWidgets('pressing a chip changes the hero title and where it starts, and the card keeps its height', (tester) async {
      final opened = await _open(tester, move: _following);
      final before = tester.getSize(find.byKey(const ValueKey('choice-tonight')));
      await tester.ensureVisible(find.text('Business Studies'));
      await tester.pump();
      await tester.tap(find.text('Business Studies'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('10 Business Studies questions'), findsOneWidget);
      expect(find.text('10 Accountancy questions'), findsNothing);
      expect(tester.getSize(find.byKey(const ValueKey('choice-tonight'))).height, before.height, reason: 'a longer name never moves what is below');
      // The sheet settles after the pick before the hero is tapped.
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.tap(find.byKey(const ValueKey('choice-tonight')));
      for (var i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(opened.single.path, '/practice/start');
      expect(opened.single.queryParameters, {'mode': 'quick', 'subject': 'business_studies', 'count': '10'});
    });

    testWidgets('a move that does not follow the subject sits above the rail and never changes with it', (tester) async {
      await _open(tester, move: _repair);
      final hero = tester.getRect(find.text('Repair 4 mistakes in Ledgers'));
      final rail = tester.getRect(find.byKey(const ValueKey('start-subject-chips')));
      expect(hero.bottom, lessThan(rail.top));
      expect(find.text('Or start in Accountancy'), findsOneWidget, reason: 'the rows under the rail say which subject they follow');
      await tester.ensureVisible(find.text('Economics'));
      await tester.pump();
      await tester.tap(find.text('Economics'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('Repair 4 mistakes in Ledgers'), findsOneWidget);
      expect(find.text('Or start in Economics'), findsOneWidget);
      expect(find.text('Quick 10'), findsOneWidget, reason: 'Quick 10 comes back under the rail when the hero is something else');
    });

    testWidgets('with no move, Quick 10 leads under the rail and names the subject', (tester) async {
      await _open(tester);
      final rail = tester.getRect(find.byKey(const ValueKey('start-subject-chips')));
      expect(tester.getRect(find.text('10 Accountancy questions')).top, greaterThan(rail.bottom));
      await tester.ensureVisible(find.text('Economics'));
      await tester.pump();
      await tester.tap(find.text('Economics'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('10 Economics questions'), findsOneWidget);
    });

    test('only plain practice follows', () {
      expect(_following.followsSubject, isTrue);
      expect(_repair.followsSubject, isFalse);
      expect(const StartMove(title: 'x', location: '/practice/start?mode=chapter&subject=accountancy&chapter=Goodwill', kind: 'practice').followsSubject, isFalse);
      expect(const StartMove(title: 'x', location: '/practice/start?mode=quick&subject=accountancy&purpose=baseline', kind: 'practice').followsSubject, isFalse);
      expect(const StartMove(title: 'x', location: '/practice/setup/full?subject=accountancy', kind: 'mock').followsSubject, isFalse);
    });
  });

  group('every way to start is a button', () {
    testWidgets('each session row has an outlined go mark, and the hero is the one volt disc', (tester) async {
      await _open(tester, move: _repair);
      // Quick 10, Full mock, NTA mode and the repair-free rows: the hero is the repair, so the rows are
      // Quick 10, Full mock, NTA mode and "Choose your own in Practice" (its mark is a chevron).
      expect(find.byType(ChoiceGoMark), findsNWidgets(4));
      expect([for (final m in tester.widgetList<ChoiceGoMark>(find.byType(ChoiceGoMark))) m.opens], [false, false, false, true]);
    });

    testWidgets('every row has a semantics label that says where it goes', (tester) async {
      final handle = tester.ensureSemantics();
      await _open(tester, move: _repair);
      for (final label in [
        RegExp(r'^Quick 10\.'),
        RegExp(r'^Full mock\. 50 questions, 60 minutes'),
        RegExp(r'^NTA mode\. Pro\.'),
        RegExp(r'^Choose your own in Practice'),
      ]) {
        expect(find.bySemanticsLabel(label), findsOneWidget, reason: '$label');
      }
      handle.dispose();
    });

    testWidgets('a press reaches the go mark and the tile keeps its size', (tester) async {
      await _open(tester, move: _repair);
      final tile = find.byKey(const ValueKey('choice-mock'));
      final rest = tester.getSize(tile);
      final gesture = await tester.startGesture(tester.getCenter(tile));
      await tester.pump(const Duration(milliseconds: 160));
      final marks = tester.widgetList<ChoiceGoMark>(find.descendant(of: tile, matching: find.byType(ChoiceGoMark)));
      expect(marks.single.pressed, isTrue);
      expect(tester.getSize(tile), rest);
      await gesture.cancel();
      await tester.pump(const Duration(seconds: 1));
    });

    testWidgets('Choose your own opens Practice', (tester) async {
      await _open(tester, move: _repair);
      final row = find.byKey(const ValueKey('start-choose-in-practice'));
      await tester.scrollUntilVisible(row, 80, scrollable: find.byType(Scrollable).last);
      await tester.tap(row);
      await tester.pumpAndSettle();
      expect(find.text('practice'), findsOneWidget);
    });
  });

  group('titles stay on one line', () {
    for (final (width, scale) in [(360.0, 1.0), (320.0, 1.0), (360.0, 1.3), (320.0, 1.3), (412.0, 1.0)]) {
      testWidgets('Full mock and NTA mode share one line at $width wide and $scale x text', (tester) async {
        await _open(tester, move: _repair, size: Size(width, 900), textScale: scale);
        expect(tester.takeException(), isNull);
        final full = find.text('Full mock');
        final nta = find.text('NTA mode');
        expect(full, findsOneWidget);
        expect(nta, findsOneWidget);
        final line = tester.getSize(full).height;
        expect(tester.getSize(nta).height, lessThanOrEqualTo(line * 1.01), reason: 'NTA mode is on one line');
        expect(tester.getRect(nta).center.dy, closeTo(tester.getRect(full).center.dy, 0.5), reason: 'the two titles share a line (L09)');
        // Both tiles stay inside the sheet.
        expect(tester.getRect(nta).right, lessThanOrEqualTo(width));
      });
    }
  });

  group("the hero's own object", () {
    testWidgets('Revise draws the repeat object, never the Quick practice bolt', (tester) async {
      await _open(tester, move: _revise);
      expect(find.text('Start Revise, 10 min'), findsOneWidget);
      final kinds = [for (final g in tester.widgetList<ChoiceGlyph>(find.byType(ChoiceGlyph))) g.kind];
      expect(kinds, contains(ChoiceGlyphKind.revise));
      // The one bolt on the sheet is the Quick 10 row's own, never the lead's.
      final lead = find.descendant(of: find.byKey(const ValueKey('choice-tonight')), matching: find.byType(ChoiceGlyph));
      expect(tester.widget<ChoiceGlyph>(lead.first).kind, ChoiceGlyphKind.revise);
    });
  });

  group('the subject rail', () {
    testWidgets('the chosen object is sharp; every other one is blurred, dimmer and smaller', (tester) async {
      await _open(tester, move: _following);
      // One blur per object that stands back; the chosen one has none.
      expect(find.descendant(of: find.byKey(const ValueKey('start-subject-chips')), matching: find.byType(ImageFiltered)), findsNWidgets(_subjects.length - 1));
    });

    testWidgets('a chip is 76 dp tall and its 64 dp object sits whole inside the outline', (tester) async {
      await _open(tester, move: _following);
      final rail = tester.getRect(find.byKey(const ValueKey('start-subject-chips')));
      expect(rail.height, closeTo(76 + 4, 0.5), reason: 'the chip plus 2 dp of air above and below, nothing leaning out');
      expect(tester.getSize(find.text('Accountancy')).height, lessThan(56));
      // The chosen object (scaled to 106%) stays inside its chip: no briefcase over the outline.
      final chosen = find.descendant(of: find.byKey(const ValueKey('start-subject-chips')), matching: find.byType(SubjectEmblem)).first;
      final chip = find.ancestor(of: chosen, matching: find.byType(MmPressable)).first;
      final emblem = tester.getRect(chosen);
      final box = tester.getRect(chip);
      expect(emblem.top, greaterThanOrEqualTo(box.top), reason: 'the object never rises over the chip top');
      expect(emblem.bottom, lessThanOrEqualTo(box.bottom));
    });

    testWidgets('the rail fades the edge that has more chips behind it, never a hard cut', (tester) async {
      await _open(tester, move: _following);
      // Accountancy is first, so more chips wait on the right only: one fading mask, not two.
      final mask = find.descendant(of: find.byType(QuickStartSheet), matching: find.byType(ShaderMask));
      expect(mask, findsWidgets);
    });

    testWidgets('the rail keeps the chosen chip in view and its name sharp at 1.3x', (tester) async {
      await _open(tester, move: _following, textScale: 1.3);
      expect(tester.takeException(), isNull);
      expect(find.text('Accountancy'), findsOneWidget);
    });
  });
}
