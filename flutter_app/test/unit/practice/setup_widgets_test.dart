// Walk-through round 3 on the practice setup page: the chosen subject tile is in view (P3-28)
// and a tap on a locked Pro difficulty answers (P3-6).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';
import 'package:mockmob/features/practice/widgets/composer_parts.dart';
import 'package:mockmob/features/practice/widgets/subject_tiles.dart';

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

const _choices = [
  SubjectChoice('accountancy', 'Accountancy'),
  SubjectChoice('business_studies', 'Business Studies'),
  SubjectChoice('economics', 'Economics'),
  SubjectChoice('mathematics', 'Mathematics'),
  SubjectChoice('physics', 'Physics'),
  SubjectChoice('chemistry', 'Chemistry'),
  SubjectChoice('english', 'English'),
];

Future<_Recorder> _pump(WidgetTester tester, Widget child, {Brightness brightness = Brightness.light}) async {
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
          theme: buildTheme(brightness),
          home: Scaffold(body: SafeArea(child: child)),
        ),
      ),
    ),
  );
  await tester.pump();
  return haptics;
}

void main() {
  setUpAll(loadAppFonts);

  group('the chosen subject tile is in view', () {
    Rect tile(WidgetTester tester, String id) => tester.getRect(find.byWidgetPredicate((w) => w is SubjectTile && w.id == id));

    void expectShown(WidgetTester tester, String id) {
      final r = tile(tester, id);
      expect(r.left, greaterThanOrEqualTo(0), reason: '$id starts on screen');
      expect(r.right, lessThanOrEqualTo(384), reason: '$id ends on screen');
    }

    testWidgets('a subject chosen elsewhere (Compass, a link) opens with its tile already scrolled to', (tester) async {
      await _pump(
        tester,
        SubjectTiles(choices: _choices, selectedId: 'english', onSelected: (_) {}, onMore: () {}),
      );
      expectShown(tester, 'english');
    });

    testWidgets('a later choice glides its tile into view', (tester) async {
      final selected = ValueNotifier('accountancy');
      addTearDown(selected.dispose);
      await _pump(
        tester,
        ValueListenableBuilder<String>(
          valueListenable: selected,
          builder: (context, id, _) => SubjectTiles(choices: _choices, selectedId: id, onSelected: (v) => selected.value = v),
        ),
      );
      expectShown(tester, 'accountancy');
      expect(find.byWidgetPredicate((w) => w is SubjectTile && w.id == 'english'), findsNothing, reason: 'English starts off screen');

      selected.value = 'english';
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump(const Duration(milliseconds: 600));
      expectShown(tester, 'english');
    });

    testWidgets('a subject that is already whole on screen does not move the strip', (tester) async {
      await _pump(
        tester,
        SubjectTiles(choices: _choices, selectedId: 'business_studies', onSelected: (_) {}),
      );
      expect(tile(tester, 'accountancy').left, MmSpace.gutter, reason: 'the strip stays at its start');
    });

    test('the offset shows a tile whole, with the gutter beside it, and never past the ends', () {
      double at(int index, {double offset = 0}) =>
          SubjectTiles.offsetToShow(index: index, offset: offset, viewport: 384, maxExtent: 700, gutter: 16);
      expect(at(0), 0);
      expect(at(1), 0, reason: 'second tile is whole already: 16 + 140 + 132 = 288 <= 384');
      expect(at(2), 16 + 2 * 140 + 132 + 16 - 384, reason: 'third tile ends at 428: scroll just enough');
      expect(
        SubjectTiles.offsetToShow(index: 6, offset: 0, viewport: 384, maxExtent: 500, gutter: 16),
        500,
        reason: 'clamped to how far the strip can go',
      );
      expect(at(0, offset: 300), 0, reason: 'back to the first tile');
    });
  });

  group('a tap on the locked difficulty answers', () {
    Future<_Recorder> pumpPicker(WidgetTester tester, {required bool isPro}) => _pump(
      tester,
      Padding(
        padding: const EdgeInsets.all(16),
        child: DifficultyPicker(value: PracticeDifficulty.balanced, isPro: isPro, onChanged: (_) {}),
      ),
    );

    Color noteColor(WidgetTester tester) => tester.widget<Text>(find.text(PracticeCopy.difficultyProNote)).style!.color!;

    testWidgets('a free account: a tick, and the reason lights up for a moment without moving anything', (tester) async {
      final haptics = await pumpPicker(tester, isPro: false);
      final resting = noteColor(tester);
      final before = tester.getRect(find.text(PracticeCopy.difficultyProNote));

      await tester.tap(find.text('Hard'));
      await tester.pump();
      expect(haptics.calls, ['selection']);
      await tester.pump(const Duration(milliseconds: 550));
      expect(noteColor(tester), isNot(resting), reason: 'the reason is lit at the peak');
      expect(tester.getRect(find.text(PracticeCopy.difficultyProNote)), before, reason: 'colour only: nothing shifts');

      await tester.pump(const Duration(milliseconds: 700));
      expect(noteColor(tester).toARGB32(), resting.toARGB32(), reason: 'and settles back');
    });

    testWidgets('a Pro account changes the level and gets no extra feedback', (tester) async {
      PracticeDifficulty? picked;
      final haptics = await _pump(
        tester,
        DifficultyPicker(value: PracticeDifficulty.balanced, isPro: true, onChanged: (d) => picked = d),
      );
      await tester.tap(find.text('Hard'));
      await tester.pump();
      expect(picked, PracticeDifficulty.hard);
      expect(haptics.calls, ['selection']);
      expect(find.text(PracticeCopy.difficultyProNote), findsNothing);
    });
  });
}
