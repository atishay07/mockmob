// Fixes from the tools bug hunt: shortlist rows name one college and programme row and say
// nothing about cutoffs until they have loaded; the cutoff table's sort stays honest when the
// score is cleared; programme cutoffs open from the bundled copy without waiting on the
// network; "See in Compass" shows a combination without overwriting the student's subjects.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/tools/combo/combo_screen.dart';
import 'package:mockmob/features/tools/compass/compass_controller.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/cutoff_table.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/data/du_repository.dart';
import 'package:mockmob/features/tools/data/tools_store.dart';
import 'package:mockmob/features/tools/domain/du_models.dart';
import 'package:mockmob/features/tools/pro/compass_pro_repository.dart';
import 'package:mockmob/features/tools/pro/compass_pro_section.dart';
import 'package:mockmob/features/tools/tools_paths.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

/// A source whose offerings never arrive (the loading state), for every file but the index.
class _SlowSource extends FakeSource {
  _SlowSource() : super(server: {'index.json': duIndexJson});

  final pending = Completer<String>();

  @override
  Future<String> fetch(String file) {
    if (file == 'index.json') return super.fetch(file);
    fetched.add(file);
    return pending.future;
  }
}

String _programmeJson() => File('assets/du/2026/offerings/b-a-programme.json').readAsStringSync();

/// The projection with all four papers ready, so a shortlist row states a verdict.
Map<String, Object?> _completeProjection() {
  final copy = jsonDecode(jsonEncode(compassProReady)) as Map<String, Object?>;
  final total = (copy['projection']! as Map<String, Object?>)['total']! as Map<String, Object?>;
  total['complete'] = true;
  return copy;
}

String _shortlistJson(List<Map<String, String>> rows) => jsonEncode(rows);

void main() {
  setUpAll(loadAppFonts);

  const subjects = 'english,accountancy,business_studies,economics';

  group('shortlist rows', () {
    Future<void> pumpCompass(WidgetTester tester, {required FakeSource source, required List<Map<String, String>> shortlist}) async {
      final prefs = savedCompass(subjects)..values['mm.tools.compass.shortlist.v1.u1'] = _shortlistJson(shortlist);
      await pumpMockmob(
        tester,
        const CompassScreen(),
        size: const Size(384, 9000),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: [
          ...toolsOverrides(prefs: prefs, source: source, pro: true),
          compassProRepositoryProvider.overrideWith(() => FakeCompassPro(_completeProjection())),
        ],
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pump();
    }

    testWidgets('while the cutoffs load a row shows a skeleton, not "Not listed" or a verdict', (tester) async {
      final source = _SlowSource();
      await pumpCompass(tester, source: source, shortlist: [
        {'g': 'b-com-hons', 'c': 'Shri Ram College of Commerce'},
      ]);
      expect(find.text('Shri Ram College of Commerce'), findsOneWidget);
      expect(find.text('Not listed'), findsNothing);
      expect(find.text(ToolsCopy.proNoCutoff), findsNothing);
      expect(find.text(ToolsCopy.proNeedsFull), findsNothing);
      expect(find.descendant(of: find.byType(MmRowGroup), matching: find.byType(SkeletonGroup)), findsWidgets);
    });

    testWidgets('when the cutoffs fail to load a row says so and offers Try again', (tester) async {
      // The server has no file for this programme and nothing is bundled.
      await pumpCompass(tester, source: FakeSource(server: {'index.json': duIndexJson}), shortlist: [
        {'g': 'b-com-hons', 'c': 'Shri Ram College of Commerce'},
      ]);
      expect(find.text(ToolsCopy.cutoffsError), findsOneWidget);
      expect(find.text(ToolsCopy.tryAgain), findsOneWidget);
      expect(find.text('Not listed'), findsNothing);
      expect(find.text(ToolsCopy.proNoCutoff), findsNothing);
    });

    testWidgets('two combinations at one college are one entry: My colleges holds a college once for each programme', (tester) async {
      final source = FakeSource(server: {'index.json': duIndexJson, 'offerings/b-a-programme.json': _programmeJson()});
      await pumpCompass(tester, source: source, shortlist: [
        {'g': 'b-a-programme', 'c': 'Aditi Mahavidyalaya (W)', 'p': 'Economics + Mathematics'},
        {'g': 'b-a-programme', 'c': 'Aditi Mahavidyalaya (W)', 'p': 'Economics + Psychology'},
      ]);
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();
      // The first row moved over keeps its own cutoffs; the second names the same college and programme.
      expect(find.text('Economics + Mathematics'), findsOneWidget);
      expect(find.text('Economics + Psychology'), findsNothing);
      // Round I, UR: 559.2583.
      expect(find.textContaining('559.3'), findsOneWidget);
      expect(find.textContaining('438.5'), findsNothing, reason: 'not the first row in the file');
    });
  });

  group('shortlist choices', () {
    late DuCatalog catalog;
    late DuOfferings offerings;
    setUpAll(() {
      catalog = DuCatalog.fromJson((jsonDecode(duIndexJson) as Map).cast<String, dynamic>());
      offerings = DuOfferings.fromJson((jsonDecode(_programmeJson()) as Map).cast<String, dynamic>());
    });

    test('a college with several rows for a programme offers each row', () {
      final group = catalog.group('b-a-programme')!;
      final choices = shortlistChoices(group, offerings.seats);
      final aditi = choices.where((t) => t.college == 'Aditi Mahavidyalaya (W)').toList();
      expect(aditi.length, 10);
      expect(aditi.map((t) => t.programme).toSet().length, 10);
      expect(choices.length, offerings.seats.length);
    });

    test('a target reads its own row, not the first row at the college', () {
      const target = ShortlistTarget(groupId: 'b-a-programme', college: 'Aditi Mahavidyalaya (W)', programme: 'Economics + Psychology');
      final seat = shortlistSeat(offerings.seats, target)!;
      expect(seat.programme, 'Economics + Psychology');
      expect(seat.rounds[0]!.first, closeTo(698.78, 0.01));
    });

    test('a target saved without a programme still reads the college\'s first row', () {
      const legacy = ShortlistTarget(groupId: 'b-a-programme', college: 'Aditi Mahavidyalaya (W)');
      expect(shortlistSeat(offerings.seats, legacy)!.programme, 'Community Science + Hindi / Sociology');
      expect(shortlistSeat(offerings.seats, const ShortlistTarget(groupId: 'b-a-programme', college: 'No such college')), isNull);
    });

    test('the programme is kept with the target, and an old saved target still reads', () async {
      final prefs = MemoryPrefsStore();
      final store = ToolsStore(prefs);
      await store.saveShortlist('u1', const [
        ShortlistTarget(groupId: 'g', college: 'C', programme: 'P1'),
        ShortlistTarget(groupId: 'g', college: 'C', programme: 'P2'),
      ]);
      final back = await store.shortlist('u1');
      expect(back.map((t) => t.programme), ['P1', 'P2']);
      expect(back[0] == back[1], isFalse);

      prefs.values['mm.tools.compass.shortlist.v1.u1'] = jsonEncode([
        {'g': 'g', 'c': 'C'},
      ]);
      final old = await store.shortlist('u1');
      expect(old.single.programme, '');
    });
  });

  group('cutoff table sort', () {
    testWidgets('clearing the score drops a chosen "Seats you clear first" and the key says what the list does', (tester) async {
      final catalog = DuCatalog.fromJson((jsonDecode(duIndexJson) as Map).cast<String, dynamic>());
      final group = catalog.group('b-com-hons')!;
      final score = ValueNotifier<String>('600');
      addTearDown(score.dispose);
      await pumpMockmob(
        tester,
        SingleChildScrollView(
          child: ValueListenableBuilder<String>(
            valueListenable: score,
            builder: (context, text, _) => CutoffTable(
              group: group,
              state: CompassState(catalog: catalog, selection: DuSelection.empty, scoreText: text),
            ),
          ),
        ),
        size: const Size(384, 2400),
        disableAnimations: true,
        overrides: toolsOverrides(),
      );
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.sortFit), findsOneWidget);

      // Choose Highest first, then Seats you clear first: an explicit choice of the score order.
      await tester.tap(find.text(ToolsCopy.sortFit));
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text(ToolsCopy.sortHigh)));
      await tester.pumpAndSettle();
      await tester.tap(find.text(ToolsCopy.sortHigh));
      await tester.pumpAndSettle();
      await tester.tap(find.descendant(of: find.byType(BottomSheet), matching: find.text(ToolsCopy.sortFit)));
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.sortFit), findsOneWidget);

      score.value = '';
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.sortFit), findsNothing, reason: 'there is no score to fit seats to');
      expect(find.text(ToolsCopy.sortHigh), findsOneWidget);

      // The sheet marks the order the list is in.
      await tester.tap(find.text(ToolsCopy.sortHigh));
      await tester.pumpAndSettle();
      final selected = tester.widgetList<MmSelectRow>(find.byType(MmSelectRow)).where((r) => r.selected).map((r) => r.title).toList();
      expect(selected, [ToolsCopy.sortHigh]);
    });
  });

  group('programme cutoffs', () {
    test('with nothing on the phone the bundled copy answers without waiting on the network', () async {
      final bundled = File('test/unit/tools/fixtures/b-com-hons.json').readAsStringSync();
      final slow = _SlowSource()..bundled = bundled;
      final repo = DuRepository(slow, const InlineDuDecoder());
      final offerings = await repo.offerings('b-com-hons').timeout(const Duration(seconds: 2));
      expect(offerings.seats, hasLength(55));
      // The server is still asked, in the background, so the copy on the phone is refreshed.
      await Future<void>.delayed(Duration.zero);
      expect(slow.fetched, contains('offerings/b-com-hons.json'));
    });

    test('with no bundled copy it still goes to the server', () async {
      final source = realDuServer();
      final offerings = await DuRepository(source, const InlineDuDecoder()).offerings('b-com-hons');
      expect(offerings.seats, hasLength(55));
      expect(source.written.keys, ['offerings/b-com-hons.json']);
    });
  });

  group('See in Compass', () {
    testWidgets('opens Compass on that combination and leaves the saved subjects alone', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (context, state) => const ComboScreen()),
          GoRoute(path: ToolsPaths.compass, builder: (context, state) => const CompassScreen()),
        ],
      );
      addTearDown(router.dispose);
      tester.view.physicalSize = const Size(384, 2400) * 2;
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.reset);
      final comboPrefs = savedCombo(
        ['b-com-hons', 'b-a-hons-economics'],
        ['language:english', 'domain:accountancy', 'domain:business_studies', 'domain:economics', 'domain:mathematics', 'gat:gat'],
      );
      comboPrefs.values['mm.tools.compass.v1'] = savedCompass(subjects).values['mm.tools.compass.v1']!;
      await tester.pumpWidget(
        ProviderScope(
          overrides: toolsOverrides(prefs: comboPrefs),
          child: DefaultAssetBundle(
            bundle: FileAssetBundle(),
            child: MaterialApp.router(
              theme: buildTheme(Brightness.light),
              routerConfig: router,
              builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(disableAnimations: true), child: app!),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final key = find.text(ToolsCopy.seeInCompass).first;
      await tester.ensureVisible(key);
      await tester.tap(key);
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 30)));
      await tester.pumpAndSettle();

      expect(find.text(ToolsCopy.fromCombo), findsOneWidget);
      expect(find.text(ToolsCopy.keepCombo), findsOneWidget);
      final saved = jsonDecode(comboPrefs.values['mm.tools.compass.v1']! as String) as Map;
      expect(saved['s'], subjects, reason: 'the student\'s own subjects are still what is saved');
    });
  });
}
