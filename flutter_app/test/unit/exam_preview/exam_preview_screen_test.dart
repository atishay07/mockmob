import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/exam_preview/exam_preview_controller.dart';
import 'package:mockmob/features/exam_preview/exam_preview_copy.dart';
import 'package:mockmob/features/exam_preview/exam_preview_routes.dart';
import 'package:mockmob/features/exam_preview/exam_preview_screen.dart';
import 'package:mockmob/features/runner/nta/nta_integrity.dart' show ntaPrefsProvider;

const Size _phone = Size(390, 844);

/// The preview alone: the only provider it may need is the phone's key-value store (the exam
/// look switch in the palette). No session, no network, no account.
Future<ExamPreviewController> _pump(WidgetTester tester, {Brightness brightness = Brightness.light, bool runClock = false}) async {
  tester.view.physicalSize = _phone * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  final c = ExamPreviewController(runClock: runClock);
  addTearDown(c.dispose);
  final router = GoRouter(
    initialLocation: '/start',
    routes: [
      GoRoute(path: '/start', builder: (_, _) => const Scaffold(body: Text('start'))),
      GoRoute(path: '/practice', builder: (_, _) => const Scaffold(body: Text('practice page'))),
      GoRoute(path: ExamPreviewRoutes.path, builder: (_, _) => ExamPreviewScreen(controller: c)),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [ntaPrefsProvider.overrideWithValue(MemoryPrefsStore())],
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: brightness == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
        routerConfig: router,
      ),
    ),
  );
  router.go(ExamPreviewRoutes.path);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  return c;
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  for (final b in [Brightness.light, Brightness.dark]) {
    group(b.name, () {
      testWidgets('opens on English question 1 with the real exam keys, the clock and the first thing to try', (tester) async {
        await _pump(tester, brightness: b);
        expect(find.text('English'), findsWidgets);
        expect(find.text('Question 1 of 5'), findsOneWidget);
        expect(find.text('60:00'), findsOneWidget);
        expect(find.text('Mark for Review & Next'), findsOneWidget);
        expect(find.text('Save & Next'), findsOneWidget);
        expect(find.text('Clear response'), findsOneWidget);
        expect(find.text(ExamPreviewCopy.stepAnswer), findsOneWidget);
        expect(find.text('0 of 5'), findsOneWidget);
        expect(find.text('Choose the option nearest in meaning to CANDID:'), findsOneWidget);
      });

      testWidgets('answering, marking, the palette, a section and the clock each move the walk on', (tester) async {
        final c = await _pump(tester, brightness: b);

        await tester.tap(find.text('Frank'));
        await _settle(tester);
        expect(c.selected, 1);
        expect(find.text(ExamPreviewCopy.stepMark), findsOneWidget);
        expect(find.text('1 of 5'), findsOneWidget);
        expect(find.text('1 answered'), findsOneWidget);

        await tester.tap(find.text('Mark for Review & Next'));
        await _settle(tester);
        expect(find.text('Question 2 of 5'), findsOneWidget);
        expect(c.markedTotal, 1);
        expect(find.text(ExamPreviewCopy.stepPalette), findsOneWidget);

        await tester.tap(find.byIcon(LucideIcons.layoutGrid));
        await _settle(tester);
        expect(find.text('1/5 answered'), findsOneWidget);
        expect(find.text('Answered & marked for review'), findsOneWidget);
        expect(find.text('Section: English'), findsOneWidget);
        await tester.tap(find.byTooltip('Close'));
        await _settle(tester);
        expect(find.text(ExamPreviewCopy.stepSection), findsOneWidget);

        await tester.tap(find.text('Accountancy'));
        await _settle(tester);
        expect(find.text('Which of these is a current asset?'), findsOneWidget);
        expect(find.text(ExamPreviewCopy.stepClock), findsOneWidget);

        await tester.tap(find.text('60:00'));
        await _settle(tester);
        expect(find.text('0:54'), findsOneWidget);
        expect(find.text(ExamPreviewCopy.allTried(5)), findsOneWidget);
        expect(find.text('5 of 5'), findsOneWidget);

        await tester.tap(find.text('0:54'));
        await _settle(tester);
        expect(find.text('60:00'), findsOneWidget);
      });

      testWidgets('Submit Test on the very last question ends the walk, then Walk through again starts clean', (tester) async {
        final c = await _pump(tester, brightness: b);
        c
          ..select(1)
          ..switchSection(2)
          ..jump(4);
        await _settle(tester);
        expect(find.text('Submit Test'), findsOneWidget);
        await tester.tap(find.text('Submit Test'));
        await _settle(tester);
        expect(find.text(ExamPreviewCopy.endTitle), findsOneWidget);
        expect(
          find.text(ExamPreviewCopy.endBody(answered: 1, total: 15, marked: 0)),
          findsOneWidget,
          reason: 'the numbers come from the walk, with their denominator',
        );
        await tester.tap(find.text(ExamPreviewCopy.again));
        await _settle(tester);
        expect(c.answeredTotal, 0);
        expect((c.sectionIndex, c.index), (0, 0));
        expect(find.text('Question 1 of 5'), findsOneWidget);
      });

      testWidgets('Back to Practice from the end sheet leaves the preview', (tester) async {
        final c = await _pump(tester, brightness: b);
        c
          ..switchSection(2)
          ..jump(4);
        await _settle(tester);
        await tester.tap(find.text('Submit Test'));
        await _settle(tester);
        await tester.tap(find.text(ExamPreviewCopy.back));
        await _settle(tester);
        expect(find.text('Question 5 of 5'), findsNothing);
        expect(find.text('start'), findsOneWidget);
      });
    });
  }

  testWidgets('the clock counts in real time once the walk starts, and turns to the red low state under a minute', (tester) async {
    final c = await _pump(tester, runClock: true);
    await tester.tap(find.text('Frank'));
    await tester.pump(const Duration(seconds: 5));
    expect(find.text('59:55'), findsOneWidget);
    c.toggleLastMinute();
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('0:52'), findsOneWidget);
    c.dispose();
  });

  testWidgets('every key meets a 48 dp touch target, and the section tabs and clock are reachable by semantics', (tester) async {
    final handle = tester.ensureSemantics();
    await _pump(tester);
    for (final label in ['Mark for Review & Next', 'Save & Next', 'Question palette', ExamPreviewCopy.back]) {
      final size = tester.getSize(find.bySemanticsLabel(label).first);
      expect(size.height, greaterThanOrEqualTo(47.9), reason: label);
    }
    expect(find.bySemanticsLabel('Section 2 of 3, Accountancy'), findsOneWidget);
    expect(find.bySemanticsLabel(ExamPreviewCopy.clockTip), findsOneWidget);
    handle.dispose();
  });

  testWidgets('text at 1.3x does not overflow at 390 wide', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await _pump(tester);
    await tester.tap(find.text('Frank'));
    await _settle(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the entry row opens the preview route', (tester) async {
    tester.view.physicalSize = _phone * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, _) => const Scaffold(body: ExamPreviewEntry())),
        GoRoute(path: ExamPreviewRoutes.path, builder: (_, _) => const Scaffold(body: Text('preview opened'))),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(theme: buildTheme(Brightness.light), routerConfig: router));
    await tester.pump();
    expect(find.text(ExamPreviewCopy.entryTitle), findsOneWidget);
    await tester.tap(find.text(ExamPreviewCopy.entryTitle));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('preview opened'), findsOneWidget);
  });
}
