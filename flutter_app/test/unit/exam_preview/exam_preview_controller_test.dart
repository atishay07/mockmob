import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/exam_preview/exam_preview_content.dart';
import 'package:mockmob/features/exam_preview/exam_preview_controller.dart';
import 'package:mockmob/features/runner/nta/nta_chip.dart';

ExamPreviewController _make() => ExamPreviewController(runClock: false);

void main() {
  group('sample paper', () {
    test('is fifteen questions, five to each of three sections, with four options each', () {
      expect(kPreviewSections.map((s) => s.name), ['English', 'Accountancy', 'General Test']);
      for (final s in kPreviewSections) {
        expect(s.questions, hasLength(5));
        for (final q in s.questions) {
          expect(q.options, hasLength(4), reason: q.id);
          expect(q.question, isNotEmpty);
        }
      }
      final ids = [for (final s in kPreviewSections) ...s.questions.map((q) => q.id)];
      expect(ids.toSet(), hasLength(15), reason: 'every question id is unique');
    });
  });

  group('walk', () {
    test('starts on question 1 of English, nothing answered, nothing tried, a full hour', () {
      final c = _make();
      expect(c.sectionIndex, 0);
      expect(c.index, 0);
      expect(c.answeredTotal, 0);
      expect(c.triedCount, 0);
      expect(c.nextStep, PreviewStep.answer);
      expect(c.remaining.value, const Duration(minutes: 60));
      expect(NtaChipState.of(c.cells.first), NtaChipState.notAnswered, reason: 'the open question counts as visited, not answered');
      expect(NtaChipState.of(c.cells[1]), NtaChipState.notVisited);
    });

    test('picking an answer is the first thing tried and the palette shows it answered', () {
      final c = _make()..select(1);
      expect(c.selected, 1);
      expect(c.tried, {PreviewStep.answer});
      expect(c.nextStep, PreviewStep.mark);
      expect(NtaChipState.of(c.cells[0]), NtaChipState.answered);
    });

    test('Mark for Review & Next marks the question, moves on, and shows purple in the palette', () {
      final c = _make()
        ..select(2)
        ..markAndNext();
      expect(c.index, 1);
      expect(c.tried, contains(PreviewStep.mark));
      expect(NtaChipState.of(c.cells[0]), NtaChipState.answeredMarked);
      // The question just opened was visited, the ones after it were not.
      expect(NtaChipState.of(c.cells[1]), NtaChipState.notAnswered);
      expect(NtaChipState.of(c.cells[2]), NtaChipState.notVisited);
    });

    test('a marked question with no answer is the plain marked state', () {
      final c = _make()..markAndNext();
      expect(NtaChipState.of(c.cells[0]), NtaChipState.marked);
    });

    test('Mark and Unmark on the paper toggle the mark without moving', () {
      final c = _make()..setMarked(true);
      expect(c.isMarked, isTrue);
      expect(c.index, 0);
      c.setMarked(false);
      expect(c.isMarked, isFalse);
    });

    test('Clear response removes the answer', () {
      final c = _make()
        ..select(0)
        ..clear();
      expect(c.selected, isNull);
      expect(c.answeredTotal, 0);
    });

    test('Save & Next at the end of a section opens the next section, Previous comes back', () {
      final c = _make();
      for (var i = 0; i < 4; i++) {
        c.saveAndNext();
      }
      expect(c.index, 4);
      expect(c.sectionIndex, 0);
      c.saveAndNext();
      expect((c.sectionIndex, c.index), (1, 0));
      c.previous();
      expect((c.sectionIndex, c.index), (0, 4));
    });

    test('the last question of the last section is the last, and Previous stops at the first', () {
      final c = _make()
        ..switchSection(2)
        ..jump(4);
      expect(c.isLast, isTrue);
      final first = _make();
      expect(first.isFirst, isTrue);
      first.previous();
      expect((first.sectionIndex, first.index), (0, 0));
    });

    test('switching section keeps the place in each, counts answers per section, and is tried', () {
      final c = _make()
        ..select(0)
        ..jump(3)
        ..switchSection(1);
      expect(c.section.name, 'Accountancy');
      expect(c.index, 0);
      expect(c.tried, contains(PreviewStep.section));
      c.select(1);
      c.switchSection(0);
      expect(c.index, 3, reason: 'English remembers question 4');
      expect(c.answeredIn(0), 1);
      expect(c.answeredIn(1), 1);
      expect(c.answeredTotal, 2);
    });

    test('opening the palette is tried once', () {
      final c = _make()..paletteOpened();
      expect(c.tried, {PreviewStep.palette});
      c.paletteOpened();
      expect(c.triedCount, 1);
    });

    test('jump ignores a question that is not in the section', () {
      final c = _make()..jump(9);
      expect(c.index, 0);
    });
  });

  group('clock', () {
    test('a tick takes one second off and the clock stops at 0:00', () {
      final c = _make();
      c.tick();
      expect(c.remaining.value, const Duration(minutes: 59, seconds: 59));
      c.remaining.value = const Duration(seconds: 1);
      c.tick();
      c.tick();
      expect(c.remaining.value, Duration.zero);
    });

    test('a tap on the clock shows the last minute and is tried; the next tap resets the hour', () {
      final c = _make()..toggleLastMinute();
      expect(c.remaining.value, ExamPreviewController.lastMinute);
      expect(c.remaining.value.inSeconds, lessThan(60));
      expect(c.tried, contains(PreviewStep.clock));
      c.toggleLastMinute();
      expect(c.remaining.value, ExamPreviewController.fullTime);
    });

    test('it runs only when asked: a controller built with runClock false never starts a timer', () {
      final c = _make()..select(0);
      expect(c.clockRunning, isFalse);
    });

    testWidgets('with the clock on, the first action starts it and it counts real seconds', (tester) async {
      final c = ExamPreviewController();
      addTearDown(c.dispose);
      expect(c.clockRunning, isFalse);
      c.select(0);
      expect(c.clockRunning, isTrue);
      await tester.pump(const Duration(seconds: 3));
      expect(c.remaining.value, const Duration(minutes: 59, seconds: 57));
      c.dispose();
    });
  });

  group('all five tried', () {
    test('walks the offer in order, then reports all tried and a fresh reset', () {
      final c = _make();
      expect(c.nextStep, PreviewStep.answer);
      c.select(0);
      expect(c.nextStep, PreviewStep.mark);
      c.markAndNext();
      expect(c.nextStep, PreviewStep.palette);
      c.paletteOpened();
      expect(c.nextStep, PreviewStep.section);
      c.switchSection(1);
      expect(c.nextStep, PreviewStep.clock);
      c.toggleLastMinute();
      expect(c.allTried, isTrue);
      expect(c.nextStep, isNull);

      c.reset();
      expect(c.triedCount, 0);
      expect(c.answeredTotal, 0);
      expect(c.markedTotal, 0);
      expect((c.sectionIndex, c.index), (0, 0));
      expect(c.remaining.value, ExamPreviewController.fullTime);
    });
  });
}
