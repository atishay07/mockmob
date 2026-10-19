// I5 (owner, 19 Oct 11:42 pm, on version 11): "if I go to edit subjects, five are chosen at most, but if I,
// in the practice section, add more subjects, I can add up to six ... If the five subjects have been
// fulfilled ... just restrict it to five only. It can just change the last subject, whatever it is."
//
// Practice never shows a sixth tile, and a sixth subject picked from More subjects offers one swap: the
// last of the five for the new one, saved to the profile (so Edit subjects agrees), or the new one just
// this once (it takes the last tile's place; the profile keeps its five).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/domain/cuet_rules.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/features/practice/copy.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart';
import 'package:mockmob/features/practice/widgets/other_subjects_sheet.dart';
import 'package:mockmob/features/you/data/profile_editor.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

const _five = ['physics', 'chemistry', 'biology', 'computer_science', 'mathematics'];

const _catalog = [
  Subject(id: 'physics', internalId: 'physics', name: 'Physics', practice: 'supported'),
  Subject(id: 'chemistry', internalId: 'chemistry', name: 'Chemistry', practice: 'supported'),
  Subject(id: 'biology', internalId: 'biology', name: 'Biology', practice: 'supported'),
  Subject(id: 'computer_science', internalId: 'computer_science', name: 'Computer Science', practice: 'supported'),
  Subject(id: 'mathematics', internalId: 'mathematics', name: 'Mathematics', practice: 'supported'),
  Subject(id: 'english', internalId: 'english', name: 'English', practice: 'supported'),
];

class _Editor extends ProfileEditor {
  _Editor(super.ref, {this.fail = false});

  final bool fail;
  final List<List<String>> saves = [];

  @override
  Future<List<String>> saveSubjects(List<String> ids) async {
    saves.add(ids);
    if (fail) throw StateError('offline');
    return ids;
  }
}

void main() {
  setUpAll(loadAppFonts);

  group('the tiles', () {
    test('five chosen and a sixth picked from More subjects: still five tiles, the last one swapped', () {
      final tiles = subjectChoices(chosen: _five, selected: 'english', catalog: _catalog).map((c) => c.id).toList();
      expect(tiles, hasLength(kCuetMaxSubjects));
      expect(tiles, ['physics', 'chemistry', 'biology', 'computer_science', 'english']);
    });

    test('a pick that is one of the five changes nothing', () {
      expect(subjectChoices(chosen: _five, selected: 'biology', catalog: _catalog).map((c) => c.id), _five);
    });

    test('fewer than five: the pick joins as a tile, still within five', () {
      expect(subjectChoices(chosen: const ['physics', 'chemistry'], selected: 'english').map((c) => c.id), ['physics', 'chemistry', 'english']);
    });

    test('a profile holding more than five (older data) still shows five', () {
      final tiles = subjectChoices(chosen: [..._five, 'english'], selected: 'physics', catalog: _catalog);
      expect(tiles, hasLength(kCuetMaxSubjects));
    });

    test('the swapped-out subject is offered back under More subjects', () {
      final shown = subjectChoices(chosen: _five, selected: 'english', catalog: _catalog);
      expect(otherSubjects(shown: shown, catalog: _catalog).map((c) => c.id), ['mathematics']);
    });
  });

  group('More subjects with five chosen', () {
    late _Editor editor;
    String? result;
    var done = false;

    Future<void> open(WidgetTester tester, {bool fail = false, List<String> chosen = _five}) async {
      result = null;
      done = false;
      await pumpMockmob(
        tester,
        Consumer(
          builder: (context, ref, _) => Center(
            child: TextButton(
              onPressed: () async {
                result = await pickOtherSubject(context, ref, const [SubjectChoice('english', 'English')]);
                done = true;
              },
              child: const Text('more'),
            ),
          ),
        ),
        size: const Size(360, 800),
        disableAnimations: true,
        overrides: [
          authSnapshotProvider.overrideWithBuild((ref, n) => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', subjects: chosen)),
          practiceSubjectsProvider.overrideWith((ref) async => _catalog),
          profileEditorProvider.overrideWith((ref) => editor = _Editor(ref, fail: fail)),
        ],
      );
      await tester.tap(find.text('more'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();
    }

    testWidgets('Swap saves the last subject out and the new one in, to the profile', (tester) async {
      await open(tester);
      expect(find.text(PracticeCopy.swapTitle), findsOneWidget, reason: 'never a sixth tile: the student is asked');
      expect(find.text(PracticeCopy.swapBody('Mathematics', 'English')), findsOneWidget);
      await tester.tap(find.text(PracticeCopy.swapKey('Mathematics', 'English')));
      await tester.pumpAndSettle();
      expect(editor.saves, [
        ['physics', 'chemistry', 'biology', 'computer_science', 'english'],
      ]);
      expect(done, isTrue);
      expect(result, 'english');
    });

    testWidgets('Just practise it once saves nothing and still practises the new subject', (tester) async {
      await open(tester);
      await tester.tap(find.text(PracticeCopy.swapOnce));
      await tester.pumpAndSettle();
      expect(editor.saves, isEmpty);
      expect(result, 'english');
    });

    testWidgets('a swap the server did not take says so and keeps the sheet open', (tester) async {
      await open(tester, fail: true);
      await tester.tap(find.text(PracticeCopy.swapKey('Mathematics', 'English')));
      await tester.pumpAndSettle();
      expect(find.text(PracticeCopy.swapFailed), findsOneWidget);
      expect(find.text(PracticeCopy.swapTitle), findsOneWidget);
      expect(done, isFalse);
    });

    testWidgets('with four chosen there is room: no swap sheet', (tester) async {
      await open(tester, chosen: _five.take(4).toList());
      expect(find.text(PracticeCopy.swapTitle), findsNothing);
      expect(result, 'english');
    });
  });
}
