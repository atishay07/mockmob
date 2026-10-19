// The smart layer's lines where the student meets them, at 360 dp in Night and Day: the length
// panel (why the plan is this long, today's progress, "Not quite right?") and the Why sheet's
// learned lines, for a new, a regular and an irregular student. Nothing overflows; a new student is
// told only that Mobi is learning; the correction sheet forgets.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/today/copy_pattern.dart';
import 'package:mockmob/features/today/data/study_log_store.dart';
import 'package:mockmob/features/today/logic/move_builder.dart' show buildMove;
import 'package:mockmob/features/today/logic/pattern_fixtures.dart';
import 'package:mockmob/features/today/logic/study_pattern.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/features/today/screens/why_sheet.dart';
import 'package:mockmob/features/today/widgets/length_pill.dart';
import 'package:mockmob/features/today/widgets/pattern_insight.dart';

import '../../helpers/fonts.dart';
import 'support/today_fixtures.dart';

final DateTime clock = DateTime.utc(2026, 10, 19, 16, 30);

const _durations = [
  DurationChoice(minutes: 5, questions: 5),
  DurationChoice(minutes: 10, questions: 10),
  DurationChoice(minutes: 15, questions: 15),
  DurationChoice(minutes: 20, questions: 20),
  DurationChoice.fullMock(questions: 50),
];

class _MemoryPrefs implements PrefsStore {
  final Map<String, Object> _m = {};
  @override
  Future<bool?> getBool(String key) async => _m[key] as bool?;
  @override
  Future<int?> getInt(String key) async => _m[key] as int?;
  @override
  Future<String?> getString(String key) async => _m[key] as String?;
  @override
  Future<List<String>?> getStringList(String key) async => _m[key] as List<String>?;
  @override
  Future<void> setBool(String key, bool value) async => _m[key] = value;
  @override
  Future<void> setInt(String key, int value) async => _m[key] = value;
  @override
  Future<void> setString(String key, String value) async => _m[key] = value;
  @override
  Future<void> setStringList(String key, List<String> value) async => _m[key] = value;
  @override
  Future<void> remove(String key) async => _m.remove(key);
}

Future<void> _panel(WidgetTester tester, StudyPattern p, Brightness b) async {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: [studyLogPrefsProvider.overrideWithValue(_MemoryPrefs())],
    child: MaterialApp(
      theme: buildTheme(b),
      home: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: LengthPanel(
            title: 'How many questions?',
            durations: _durations,
            selected: 20,
            inSheet: true,
            // The lines the lead move carries for this student (buildMove puts them on the hero).
            insight: buildMove(ashaInputs(now: clock, attempts: [accountancyMock('a', daysBefore(clock, 1))], pattern: p)).lengthInsight,
            onPick: (_) {},
          ),
        ),
      ),
    ),
  ));
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  setUpAll(loadAppFonts);

  for (final b in Brightness.values) {
    testWidgets('new student, ${b.name}: only that Mobi is learning, with the goal', (tester) async {
      await _panel(tester, PatternFixtures.fresh().pattern(clock), b);
      expect(tester.takeException(), isNull);
      expect(find.text("I'm still learning how you study. For now, tonight's plan follows your 20-minute goal."), findsOneWidget);
      expect(find.text(PatternCopy.notQuiteRight), findsOneWidget);
      expect(find.textContaining('usually'), findsNothing);
    });

    testWidgets('regular student, ${b.name}: the usual length and time, and what the plan is', (tester) async {
      await _panel(tester, PatternFixtures.regular(clock).pattern(clock), b);
      expect(tester.takeException(), isNull);
      expect(find.textContaining('You usually practise about 40 minutes after 9:30 PM'), findsOneWidget);
    });

    testWidgets('irregular student, ${b.name}: no single time is claimed', (tester) async {
      await _panel(tester, PatternFixtures.irregular(clock).pattern(clock), b);
      expect(tester.takeException(), isNull);
      expect(find.textContaining(' after '), findsNothing);
    });

    testWidgets('the Why sheet carries the learned lines, ${b.name}', (tester) async {
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final p = PatternFixtures.regular(clock).pattern(clock);
      await tester.pumpWidget(ProviderScope(
        overrides: [studyLogPrefsProvider.overrideWithValue(_MemoryPrefs())],
        child: MaterialApp(
          theme: buildTheme(b),
          home: Scaffold(
            body: SingleChildScrollView(
              child: WhySheetBody(
                model: WhyModel(attemptId: 'a', source: 'Mock 1', subject: 'Accountancy', date: DateTime(2026, 10, 18), wrong: 4, correct: 40, blank: 6, chapters: const [], early: false, isMock: true),
                learned: whyLines(p),
              ),
            ),
          ),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
      expect(find.text('You pick chapter practice most often, so it comes first when nothing else is more urgent.'), findsOneWidget);
      expect(find.text(PatternCopy.notQuiteRight), findsOneWidget);
    });
  }

  testWidgets('Not quite right? opens the correction and "Forget it and learn again" forgets the facts', (tester) async {
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final container = ProviderContainer(overrides: [studyLogPrefsProvider.overrideWithValue(_MemoryPrefs())]);
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: buildTheme(Brightness.dark),
        home: Scaffold(body: PatternCorrection(facts: const {PatternFact.time, PatternFact.length}, onDone: () {})),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text(PatternCopy.correctTime), findsOneWidget);
    expect(find.text(PatternCopy.correctLength), findsOneWidget);
    await tester.tap(find.text(PatternCopy.correctLength));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text(PatternCopy.askLength), findsOneWidget);
    await tester.tap(find.text('45 min'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text(PatternCopy.forgotLength(45)), findsOneWidget);
  });
}
