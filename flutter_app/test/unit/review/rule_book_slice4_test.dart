import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/models/lab_loop.dart';
import 'package:mockmob/core/models/mistake_lab_traps.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/rules/data/rules_data.dart';
import 'package:mockmob/features/rules/data/traps_data.dart';
import 'package:mockmob/features/rules/screens/rule_book_screen.dart';
import 'package:mockmob/features/rules/widgets/interval_band.dart';
import 'package:mockmob/features/rules/widgets/same_mistakes_later_view.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// A key by its label (its face keeps a second copy of the label to hold its width).
Finder keyLabelled(String label) => find.byWidgetPredicate((w) => w is KeyButton && w.label == label);

Map<String, dynamic> contract(String name) =>
    jsonDecode(File('test/fixtures/mistake_lab/contract_${name}_v1.json').readAsStringSync()) as Map<String, dynamic>;

/// The website's `GET /api/me/traps` as the test sends it: the sheet (rows) or the empty one, or a failure.
class FakeTrapsApi implements TrapsApi {
  FakeTrapsApi({this.body, this.failures = 0});

  final Object? body;

  /// How many reads fail before one succeeds.
  int failures;
  int reads = 0;

  @override
  Future<TrapsMeet> read() async {
    reads++;
    if (failures > 0) {
      failures--;
      throw const ApiError(kind: ApiErrorKind.unavailable, code: 'unavailable', status: 503);
    }
    return TrapsMeet.tryParse(body ?? contract('traps')['sheet'])!;
  }
}

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> pumpBook(WidgetTester tester, {FakeTrapsApi? traps, Size size = const Size(390, 3200), bool reduced = true}) async {
  tester.view.physicalSize = size * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        rulesRepositoryProvider.overrideWithBuild(
          (ref, n) => RemoteState(
            value: RulesRead.parse({'book': contract('rules')['book'], 'acrossMocks': contract('across')}),
            fetchedAt: DateTime.utc(2026, 10, 15, 9),
          ),
        ),
        trapsApiProvider.overrideWithValue(traps ?? FakeTrapsApi()),
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: reduced), child: app!),
          home: const RuleBookScreen(),
        ),
      ),
    ),
  );
  await settle(tester);
}

/// The Rule book's slice 3 gap and slice 4 part: the 95% interval drawn as a band under each
/// habit's evidence (as the website does), and "Traps you meet" behind a disclosure.
void main() {
  setUpAll(loadAppFonts);

  final book = RuleBook.tryParse(contract('rules')['book'])!;

  group('the 95% interval band', () {
    testWidgets('one band under each habit that passed its gate, with the interval in words', (tester) async {
      await pumpBook(tester);
      final withInterval = [for (final h in book.habits.rules) if (!h.gated && h.interval != null) h];
      expect(withInterval.length, 3);
      expect(find.byType(IntervalBand), findsNWidgets(3));
      for (final h in withInterval) {
        expect(find.text(IntervalBand.lineOf(h.interval!)), findsOneWidget, reason: h.id);
      }
      expect(find.text('8 of 23 (35%). At this count, the 95% interval runs from 19% to 55%.'), findsOneWidget);
      expect(find.text('14 of 150 (9%). At this count, the 95% interval runs from 6% to 15%.'), findsOneWidget);
    });

    testWidgets('a gated habit says its gate and draws no band', (tester) async {
      await pumpBook(tester);
      final gated = book.habits.rules.firstWhere((h) => h.gated);
      expect(find.text(gated.evidence), findsOneWidget);
      // Three bands for four habits: the gated one has none.
      expect(find.byType(IntervalBand), findsNWidgets(3));
      final bandTop = tester.getTopLeft(find.text(IntervalBand.lineOf(book.habits.rules.first.interval!))).dy;
      final gatedTop = tester.getTopLeft(find.text(gated.evidence)).dy;
      expect(gatedTop > bandTop, isTrue, reason: 'the gated habit is the last row, with no band above its evidence');
    });

    testWidgets('the band sits under the evidence and never over it', (tester) async {
      await pumpBook(tester);
      final h = book.habits.rules.first;
      final evidence = tester.getRect(find.text(h.evidence));
      final band = tester.getRect(find.byType(IntervalBand).first);
      expect(band.top, greaterThanOrEqualTo(evidence.bottom));
      // It stays inside the screen at 390 dp, with the gutter.
      expect(band.left, greaterThanOrEqualTo(16));
      expect(band.right, lessThanOrEqualTo(390 - 16));
    });

    testWidgets('the whole band row is one target whose label carries the interval sentence', (tester) async {
      final handle = tester.ensureSemantics();
      await pumpBook(tester);
      final h = book.habits.rules.first;
      expect(
        find.bySemanticsLabel(RegExp(RegExp.escape(IntervalBand.lineOf(h.interval!)))),
        findsWidgets,
      );
      handle.dispose();
    });

    testWidgets('with motion on the band draws in over about 780 ms and ends complete', (tester) async {
      await pumpBook(tester, reduced: false);
      await tester.pump(const Duration(milliseconds: 900));
      expect(find.byType(IntervalBand), findsWidgets);
      expect(tester.takeException(), isNull);
      await tester.pumpAndSettle();
    });

    testWidgets('a narrow band is still drawn: a range under 1.5% is held at 1.5%, and 0 and 100 stay in the track', (tester) async {
      tester.view.physicalSize = const Size(360, 400) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(Brightness.dark),
          builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
          home: const Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  IntervalBand(interval: RuleInterval(k: 0, n: 3, pct: 0, low: 0, high: 0)),
                  IntervalBand(interval: RuleInterval(k: 3, n: 3, pct: 100, low: 100, high: 100)),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.byType(IntervalBand), findsNWidgets(2));
    });
  });

  group('Traps you meet', () {
    testWidgets('a section in the Rule book, closed: nothing is read until it opens', (tester) async {
      final api = FakeTrapsApi();
      await pumpBook(tester, traps: api);
      expect(find.text('Traps you meet'), findsOneWidget);
      expect(find.text('Your traps across mocks'), findsOneWidget);
      expect(find.text('A look-alike term: caught 5 of 10 times.'), findsNothing);
      expect(api.reads, 0);
      // After the habits, never before the repairs.
      expect(tester.getTopLeft(find.text('Traps you meet')).dy > tester.getTopLeft(find.text('From how you take papers')).dy, isTrue);
    });

    testWidgets('opened, it reads once and lists each trap in the server\'s words with its label and split', (tester) async {
      final api = FakeTrapsApi();
      await pumpBook(tester, traps: api);
      await tester.ensureVisible(find.text('Your traps across mocks'));
      await tester.tap(find.text('Your traps across mocks'));
      await settle(tester);
      expect(api.reads, 1);
      final t = TrapsMeet.tryParse(contract('traps')['sheet'])!;
      for (final r in t.rows) {
        expect(find.text(r.text), findsOneWidget);
        if (r.periods != null) expect(find.text(r.periods!.text), findsOneWidget);
      }
      expect(find.text('Falling'), findsOneWidget);
      expect(find.text('Still catching you'), findsOneWidget);
      expect(find.text(t.basis!), findsOneWidget);
      expect(find.text(t.fine!), findsOneWidget);
      // Closing and opening again does not need a second read while it stays alive in the tree.
      await tester.tap(find.text('Your traps across mocks'));
      await settle(tester);
      expect(find.text('Falling'), findsNothing);
    });

    testWidgets('the label has words and an icon, never colour alone: the third row, below its gate, has none', (tester) async {
      await pumpBook(tester);
      await tester.ensureVisible(find.text('Your traps across mocks'));
      await tester.tap(find.text('Your traps across mocks'));
      await settle(tester);
      expect(find.text('The assertion and reason link: caught 2 of 3 times.'), findsOneWidget);
      expect(find.text('Falling'), findsOneWidget);
      expect(find.text('Still catching you'), findsOneWidget);
    });

    testWidgets('the empty sheet: the sentence for how a trap shows up, and the basis', (tester) async {
      await pumpBook(tester, traps: FakeTrapsApi(body: contract('traps')['empty']));
      await tester.ensureVisible(find.text('Your traps across mocks'));
      await tester.tap(find.text('Your traps across mocks'));
      await settle(tester);
      expect(find.text('Your traps show here once a named trap has been a wrong option on 3 questions you answered.'), findsOneWidget);
      expect(find.text('A look-alike term: caught 5 of 10 times.'), findsNothing);
    });

    testWidgets('a failed read says so and Try again reads once more', (tester) async {
      final api = FakeTrapsApi(failures: 1);
      await pumpBook(tester, traps: api);
      await tester.ensureVisible(find.text('Your traps across mocks'));
      await tester.tap(find.text('Your traps across mocks'));
      await settle(tester);
      expect(find.text('Your traps could not be loaded. Try again shortly.'), findsOneWidget);
      expect(api.reads, 1);
      await tester.ensureVisible(keyLabelled('Try again'));
      await tester.tap(keyLabelled('Try again'));
      await settle(tester);
      expect(api.reads, 2);
      expect(find.text('A look-alike term: caught 5 of 10 times.'), findsOneWidget);
      expect(find.text('Your traps could not be loaded. Try again shortly.'), findsNothing);
    });

    testWidgets('the head is a 56 dp target', (tester) async {
      await pumpBook(tester);
      final head = tester.getSize(find.ancestor(of: find.text('Your traps across mocks'), matching: find.byType(ConstrainedBox)).first);
      expect(head.height, greaterThanOrEqualTo(56));
    });
  });

  group('Same mistakes later', () {
    Future<void> pumpLater(WidgetTester tester, SameMistakesLater later, {VoidCallback? onOpen}) async {
      tester.view.physicalSize = const Size(360, 500) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
            home: Scaffold(body: SingleChildScrollView(child: Padding(padding: const EdgeInsets.all(16), child: SameMistakesLaterView(later: later, onOpen: onOpen)))),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('tomorrow: the line, the one honest difference and the fine print, no key yet', (tester) async {
      final later = SameMistakesLater.tryParse(contract('later')['prove'])!;
      await pumpLater(tester, later);
      expect(find.text('Same mistakes later'), findsOneWidget);
      expect(find.text('7 of these come back tomorrow, Fri 16 Oct.'), findsOneWidget);
      expect(find.text('Same questions, so this checks memory. Fresh questions check the idea.'), findsOneWidget);
      expect(find.text(later.fine!), findsOneWidget);
      expect(find.text('Open Revise'), findsNothing);
    });

    testWidgets('ready now: the key opens Revise', (tester) async {
      final later = SameMistakesLater.tryParse(contract('later')['proveWithCards'])!;
      var opened = 0;
      await pumpLater(tester, later, onOpen: () => opened++);
      expect(find.text('5 of these are ready to revise now.'), findsOneWidget);
      await tester.tap(keyLabelled('Open Revise'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(opened, 1);
    });
  });
}
