// Fine-tune is scoped by the mode (owner, 17 Oct, F8 and F9): chapters and difficulty in Quick
// practice, difficulty alone in a Full mock, nothing in Smart practice and NTA mode, where we
// choose. The same table protects the request the app sends.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/model/practice_link.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/widgets/fine_tune.dart';

Widget _app(Widget child, {double textScale = 1, Brightness brightness = Brightness.light}) => ProviderScope(
  child: MaterialApp(
    theme: buildTheme(brightness),
    builder: (context, app) => MediaQuery(data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)), child: app!),
    home: Scaffold(body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: child)),
  ),
);

FineTune _block(PracticeMode mode, {List<String> chapters = const [], bool isPro = false, bool showLevel = true}) => FineTune(
  mode: mode,
  chapters: chapters,
  difficulty: PracticeDifficulty.balanced,
  isPro: isPro,
  showLevel: showLevel,
  onPickChapters: () {},
  onRemoveChapter: (_) {},
  onDifficulty: (_) {},
);

void main() {
  group('the scope table', () {
    test('which controls each mode offers', () {
      expect(PracticeMode.quick.fineTune, FineTuneScope.chaptersAndLevel);
      expect(PracticeMode.chapter.fineTune, FineTuneScope.chaptersAndLevel, reason: 'By chapter is Quick practice with chapters asked first');
      expect(PracticeMode.full.fineTune, FineTuneScope.levelOnly);
      expect(PracticeMode.smart.fineTune, FineTuneScope.none);
      expect(PracticeMode.nta.fineTune, FineTuneScope.none);
    });

    test('chapters belong to Quick practice only; the level to Quick and Full', () {
      expect([for (final m in PracticeMode.values) if (m.allowsChapters) m], [PracticeMode.quick, PracticeMode.chapter]);
      expect([for (final m in PracticeMode.values) if (m.allowsDifficulty) m], [PracticeMode.full, PracticeMode.quick, PracticeMode.chapter]);
    });

    test('the request never carries chapters for a mode that does not take them', () {
      const chosen = ['Goodwill', 'Issue of shares'];
      for (final mode in PracticeMode.values) {
        final fields = PracticeSelection(mode: mode, subjectId: 'accountancy', chapters: chosen, difficulty: PracticeDifficulty.hard).sessionFields;
        expect(fields.containsKey('chapters') || fields.containsKey('chapter'), mode.allowsChapters, reason: '${mode.name} chapters');
        expect(fields.containsKey('difficulty'), mode.allowsDifficulty, reason: '${mode.name} difficulty');
      }
    });

    test('Quick practice with chapters asks for exactly them; a Full mock from the same link drops them', () {
      const link = PracticeLink(subject: 'accountancy', chapters: ['Goodwill'], difficulty: 'easy');
      final quick = link.selectionFor(PracticeMode.quick)!;
      expect(quick.sessionFields['chapter'], 'Goodwill');
      expect(quick.isComplete, isTrue, reason: 'chapters are optional in Quick practice');
      final full = link.selectionFor(PracticeMode.full)!;
      expect(full.effectiveChapters, isEmpty);
      expect(full.sessionFields.containsKey('chapter'), isFalse);
      expect(full.sessionFields['difficulty'], 'easy');
      final smart = link.selectionFor(PracticeMode.smart)!;
      expect(smart.sessionFields.containsKey('difficulty'), isFalse);
    });

    test('By chapter still cannot start before a chapter is chosen', () {
      expect(PracticeSelection(mode: PracticeMode.chapter, subjectId: 'accountancy').isComplete, isFalse);
      expect(PracticeSelection(mode: PracticeMode.quick, subjectId: 'accountancy').isComplete, isTrue);
    });
  });

  group('the Fine-tune block', () {
    testWidgets('Quick practice: chapters and difficulty, open, under the scope sentence', (tester) async {
      await tester.pumpWidget(_app(_block(PracticeMode.quick)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text(PracticeCopy.fineTuneLabel), findsOneWidget);
      expect(find.text(PracticeCopy.fineTuneQuick), findsOneWidget);
      expect(find.text(PracticeCopy.chapterLabel), findsOneWidget);
      expect(find.text(PracticeCopy.difficultyLabel), findsOneWidget);
    });

    testWidgets('By chapter: the same controls, said in its own name (walk 20 Oct)', (tester) async {
      await tester.pumpWidget(_app(_block(PracticeMode.chapter)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text(PracticeCopy.fineTuneChapter), findsOneWidget);
      expect(find.text(PracticeCopy.fineTuneQuick), findsNothing);
    });

    testWidgets('Full mock: the difficulty alone, and it says every chapter is covered', (tester) async {
      await tester.pumpWidget(_app(_block(PracticeMode.full)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text(PracticeCopy.fineTuneFull), findsOneWidget);
      expect(find.text(PracticeCopy.chapterLabel), findsNothing);
      expect(find.text(PracticeCopy.difficultyLabel), findsOneWidget);
    });

    for (final mode in [PracticeMode.smart, PracticeMode.nta]) {
      testWidgets('${mode.name}: no controls, one calm line that says nothing needs choosing', (tester) async {
        await tester.pumpWidget(_app(_block(mode)));
        await tester.pump(const Duration(milliseconds: 400));
        expect(find.text(fineTuneSentence(mode)), findsOneWidget);
        expect(fineTuneSentence(mode), endsWith("You don't need to choose anything."));
        if (mode == PracticeMode.nta) expect(fineTuneSentence(mode), "We build it exactly the NTA way. You don't need to choose anything.");
        expect(find.text(PracticeCopy.chapterLabel), findsNothing);
        expect(find.text(PracticeCopy.difficultyLabel), findsNothing);
      });
    }

    testWidgets('the level steps aside when credits are short; the chapters stay', (tester) async {
      await tester.pumpWidget(_app(_block(PracticeMode.quick, showLevel: false)));
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text(PracticeCopy.chapterLabel), findsOneWidget);
      expect(find.text(PracticeCopy.difficultyLabel), findsNothing);
    });

    testWidgets('1.3x text on a narrow phone: nothing overflows in any mode', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      for (final mode in PracticeMode.values) {
        await tester.pumpWidget(_app(_block(mode, chapters: const ['Goodwill', 'Issue of shares', 'Admission of a partner']), textScale: 1.3));
        await tester.pump(const Duration(milliseconds: 400));
        expect(tester.takeException(), isNull, reason: mode.name);
      }
    });
  });
}
