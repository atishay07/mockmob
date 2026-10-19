// I1 (owner, 19 Oct 11:42 pm, on version 11): "In the search courses, every course is still glitching.
// I'm unable to select or type anything there." The same bug as G3 ("my keyboard gets cut off again and
// again"). Root cause (V11-TRUTH-AUDIT section 3): MmSheetScaffold built a different widget tree with the
// keyboard up than with it down, so the moment the keys rose the sheet's body was thrown away and built
// again: the typed text and the field's focus went with it, the keyboard closed, and the tree flipped back.
//
// Every test here STARTS with the keyboard down, as on the phone: the sheet opens, the student taps the
// field and types, and only then does the system report the keyboard's height. The field must be the same
// field (not a new one), keep its text and its focus, keep the keyboard up, and a result must still be
// tappable above the keys. The tests that opened the sheet with the keyboard already up (H1) could not see
// this. The onboarding college search (not a sheet) has the same check in
// test/unit/onboarding/college_search_keyboard_test.dart.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart' show DuCourse;
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/widgets/course_list_sheet.dart';
import 'package:mockmob/features/onboarding/widgets/subject_picker.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show practiceChaptersProvider;
import 'package:mockmob/features/practice/widgets/chapter_picker.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/social/widgets/mob_extras.dart' show MobChapterList;
import 'package:mockmob/features/social/widgets/mob_join_code.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// The 360 dp emulator, and its keyboard (about 280 dp, the lower third of the screen).
const Size _screen = Size(360, 800);
const double _keyboard = 280;

Future<void> _frames(WidgetTester tester, [int n = 8]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// Opens the sheet with no keyboard: a button on a page, as the app does.
Future<void> _open(WidgetTester tester, Future<Object?> Function(BuildContext context) open, {List<Override> overrides = const []}) async {
  await pumpMockmob(
    tester,
    Builder(builder: (context) => Center(child: TextButton(onPressed: () => open(context), child: const Text('open')))),
    size: _screen,
    disableAnimations: true,
    overrides: overrides,
  );
  expect(tester.view.viewInsets.bottom, 0, reason: 'the test starts with the keyboard down');
  await tester.tap(find.text('open'));
  await _frames(tester, 12);
}

Finder get _field => find.descendant(of: find.byType(BottomSheet), matching: find.byType(EditableText));

EditableTextState _state(WidgetTester tester) => tester.state<EditableTextState>(_field);

/// The keyboard rises: the system reports its height, in the steps Android does.
Future<void> _raiseKeyboard(WidgetTester tester) async {
  addTearDown(tester.view.resetViewInsets);
  for (final h in [_keyboard * 0.3, _keyboard * 0.7, _keyboard]) {
    tester.view.viewInsets = FakeViewPadding(bottom: h * 2);
    await tester.pump(const Duration(milliseconds: 16));
  }
  await _frames(tester);
}

/// Taps the field, types [first] with the keyboard still down, raises the keyboard, then types [more].
/// The field must be the same field throughout, with its text, its focus and the keyboard.
Future<void> _typeThroughKeyboard(WidgetTester tester, {required String first, required String more}) async {
  expect(_field, findsOneWidget);
  await tester.tap(_field);
  await tester.pump();
  tester.testTextInput.enterText(first);
  await _frames(tester, 2);
  final before = _state(tester);
  expect(before.widget.focusNode.hasFocus, isTrue);

  await _raiseKeyboard(tester);

  final after = _state(tester);
  expect(identical(before, after), isTrue, reason: 'the keyboard opening must not rebuild the field (I1: its text and focus went with it)');
  expect(after.widget.controller.text, first, reason: 'the typed text survives the keyboard opening');
  expect(after.widget.focusNode.hasFocus, isTrue, reason: 'the field keeps its focus when the keyboard opens');
  expect(tester.testTextInput.isVisible, isTrue, reason: 'the keyboard stays up');

  tester.testTextInput.enterText(more);
  await _frames(tester, 4);
  expect(identical(_state(tester), before), isTrue);
  expect(_state(tester).widget.controller.text, more);
  expect(_state(tester).widget.focusNode.hasFocus, isTrue, reason: 'typing with the keyboard up keeps the focus');
  expect(tester.testTextInput.isVisible, isTrue);
}

/// The part of the screen the keyboard leaves.
const double _keysTop = 800 - _keyboard;

void main() {
  setUpAll(loadAppFonts);

  testWidgets('More courses: type "physics" as the keyboard opens, and pick B.Sc (Hons) Physics above the keys', (tester) async {
    DuCourse? picked;
    var closed = false;
    await _open(tester, (context) async {
      picked = await showCourseList(context);
      closed = true;
      return picked;
    });
    await _typeThroughKeyboard(tester, first: 'ph', more: 'physics');
    final row = find.text('B.Sc (Hons) Physics');
    expect(row, findsOneWidget, reason: 'the search filters as it is typed');
    expect(tester.getRect(row).bottom, lessThanOrEqualTo(_keysTop), reason: 'the result shows above the keyboard');
    await tester.tap(row);
    await _frames(tester, 12);
    expect(closed, isTrue, reason: 'a tap on a result picks it with the keyboard up');
    expect(picked?.short, 'B.Sc (Hons) Physics');
  });

  testWidgets('More subjects (onboarding): type "phy" as the keyboard opens, and tick Physics above the keys', (tester) async {
    await _open(
      tester,
      (context) => showSubjectPicker(context),
      overrides: onboardingOverrides(answers: studentUpTo(Steps.stage, step: Steps.course)),
    );
    await _typeThroughKeyboard(tester, first: 'p', more: 'phy');
    final row = find.descendant(of: find.byType(BottomSheet), matching: find.text('Physics'));
    expect(row, findsWidgets);
    expect(tester.getRect(row.first).bottom, lessThanOrEqualTo(_keysTop), reason: 'the result shows above the keyboard');
  });

  testWidgets('Choose chapters (Practice): type "optics" as the keyboard opens, and a chapter is still a tap away', (tester) async {
    List<String>? picked;
    await _open(
      tester,
      (context) async => picked = await showChapterPicker(context, subjectId: 'physics'),
      overrides: [
        practiceChaptersProvider('physics').overrideWith(
          (ref) async => const ChapterCatalog(
            units: [
              ChapterUnit(id: 'u1', name: 'Optics', chapters: [ChapterEntry(id: 'c1', name: 'Ray Optics'), ChapterEntry(id: 'c2', name: 'Wave Optics')]),
              ChapterUnit(id: 'u2', name: 'Magnetism', chapters: [ChapterEntry(id: 'c3', name: 'Electromagnetic Induction')]),
            ],
          ),
        ),
      ],
    );
    await _typeThroughKeyboard(tester, first: 'op', more: 'optics');
    final row = find.descendant(of: find.byType(BottomSheet), matching: find.text('Ray Optics'));
    expect(row, findsOneWidget);
    expect(find.descendant(of: find.byType(BottomSheet), matching: find.text('Electromagnetic Induction')), findsNothing, reason: 'the search filters');
    expect(tester.getRect(row).bottom, lessThanOrEqualTo(_keysTop));
    await tester.tap(row);
    await _frames(tester, 4);
    expect(_state(tester).widget.controller.text, 'optics', reason: 'a tap on a row keeps the search');
    expect(picked, isNull, reason: 'the sheet stays open until Use is pressed');
  });

  testWidgets('a Mob paper\'s chapter list: type "ray" as the keyboard opens, and pick it above the keys', (tester) async {
    String? picked;
    await _open(
      tester,
      (context) async => picked = await showMmSheet<String>(
        context: context,
        title: 'Chapter',
        heightFactor: 0.86,
        builder: (_) => const MobChapterList(
          chapters: MobChapters(chapters: [MobChapter(chapter: 'Ray Optics', ready: 40), MobChapter(chapter: 'Electrostatics', ready: 40)]),
        ),
      ),
    );
    await _typeThroughKeyboard(tester, first: 'r', more: 'ray');
    final row = find.descendant(of: find.byType(BottomSheet), matching: find.text('Ray Optics'));
    expect(row, findsOneWidget);
    expect(tester.getRect(row).bottom, lessThanOrEqualTo(_keysTop));
    await tester.tap(row);
    await _frames(tester, 12);
    expect(picked, 'Ray Optics');
  });

  testWidgets('Join with a code: the code typed as the keyboard opens is kept, and Find their Mob checks it', (tester) async {
    await _open(tester, (context) => showJoinWithCodeSheet(context));
    // The field asks for focus itself (autofocus); the keyboard has not risen yet.
    await _typeThroughKeyboard(tester, first: 'K7', more: 'K7P2');
    final key = find.text('Find their Mob');
    expect(key, findsOneWidget);
    expect(tester.getRect(key).bottom, lessThanOrEqualTo(_keysTop), reason: 'the key sits above the keyboard');
    await tester.tap(key);
    await _frames(tester, 2);
    expect(tester.takeException(), isNull, reason: 'the shared code field was disposed by the body the keyboard threw away');
    expect(_state(tester).widget.controller.text, 'K7P2');
  });
}
