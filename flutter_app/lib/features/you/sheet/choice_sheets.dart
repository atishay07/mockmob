// The choice sheets of the sheet editor. Each writes straight to the phone's sheet through
// [SheetEditor]; none of these has an endpoint, so each says "Kept on this phone."
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/copy.dart' show joinWithAnd;

import '../../../core/art/art.dart' show EmblemSizes;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/data/du_catalog.dart';
import '../../onboarding/data/subjects.dart' show Confidence;
import '../../onboarding/model/choices.dart' show Stage, Worry;
import '../copy.dart';
import '../data/sheet_editor.dart';
import '../data/student_target.dart';
import '../edit_copy.dart';
import '../widgets/subject_art.dart';

const _letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

Widget _phoneNote(BuildContext context) => Padding(
      padding: const EdgeInsets.only(top: MmSpace.s16),
      child: Text(EditCopy.keptOnPhone, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
    );

Widget _note(BuildContext context, String text) => Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Text(text, style: context.mmType.small.copyWith(color: context.mmColors.ink2)),
    );

/// One answer per sheet, written like the onboarding's answer rows: tap to choose and close.
/// [onPick] may ask first; false keeps the sheet open (the student chose to stay).
Future<void> _pickOne<T>(
  BuildContext context, {
  required String title,
  required List<(T, String, String?)> options,
  required T? current,
  required FutureOr<bool> Function(BuildContext sheet, T value) onPick,
  String? note,
}) {
  return showMmSheet<void>(
    context: context,
    title: title,
    builder: (sheet) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (note != null) _note(sheet, note),
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          MmSelectRow(
            letter: _letters[i % _letters.length],
            title: options[i].$2,
            note: options[i].$3,
            selected: options[i].$1 == current,
            onTap: () async {
              final done = await onPick(sheet, options[i].$1);
              if (done && sheet.mounted) Navigator.of(sheet).maybePop();
            },
          ),
        ],
        _phoneNote(sheet),
      ],
    ),
  );
}

Future<void> showStageSheet(BuildContext context, WidgetRef ref) => _pickOne<Stage>(
      context,
      title: EditCopy.stageSheet,
      options: [for (final s in Stage.values) (s, s.option, null)],
      current: ref.read(studentTargetProvider).stage,
      onPick: (_, stage) {
        ref.read(sheetEditorProvider).setStage(stage);
        return true;
      },
    );

/// The course, or "Not sure yet" (null). A different course removes the saved colleges, so with
/// colleges set the choice is confirmed first ("Keep course" or "Change course"). Returns what the
/// sheet looked like before a change that removed colleges, for the undo receipt; null when
/// nothing was removed.
Future<CourseSnapshot?> showCourseSheet(BuildContext context, WidgetRef ref) async {
  final editor = ref.read(sheetEditorProvider);
  final current = ref.read(studentTargetProvider).courseId;
  CourseSnapshot? removed;
  await _pickOne<String?>(
    context,
    title: EditCopy.courseSheet,
    note: EditCopy.courseNote,
    options: [
      for (final c in DuCatalog.courses) (c.id, c.short, '${c.collegeCount} colleges'),
      (null, EditCopy.courseNotSure, null),
    ],
    current: current,
    onPick: (sheet, courseId) async {
      final lost = editor.collegesLostBy(courseId);
      if (lost.isEmpty) {
        editor.setCourse(courseId);
        return true;
      }
      final target = courseId == null ? EditCopy.courseNotSure : (DuCatalog.course(courseId)?.short ?? courseId);
      final confirmed = await showMmSheet<bool>(
        context: sheet,
        title: EditCopy.courseConfirmTitle(lost.length),
        builder: (confirm) => _CourseConfirm(courseName: target, colleges: lost),
      );
      if (confirmed != true) return false;
      removed = editor.courseSnapshot();
      editor.setCourse(courseId);
      return true;
    },
  );
  return removed;
}

/// "Remove your 3 colleges?": the consequence in words, Keep course as the dominant key.
class _CourseConfirm extends StatelessWidget {
  const _CourseConfirm({required this.courseName, required this.colleges});

  final String courseName;
  final List<String> colleges;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(EditCopy.courseConfirmBody(courseName, joinWithAnd(colleges)), style: type.body),
        const SizedBox(height: MmSpace.s8),
        Text(EditCopy.courseConfirmUndo, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s24),
        KeyButton(label: EditCopy.courseKeep, onPressed: () => Navigator.of(context).pop(false)),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: EditCopy.courseChange, onPressed: () => Navigator.of(context).pop(true)),
      ],
    );
  }
}

Future<void> showWorrySheet(BuildContext context, WidgetRef ref) => _pickOne<Worry>(
      context,
      title: EditCopy.worrySheet,
      options: [for (final w in Worry.values) (w, w.option, null)],
      current: ref.read(studentTargetProvider).worry,
      onPick: (_, worry) {
        ref.read(sheetEditorProvider).setWorry(worry);
        return true;
      },
    );

Future<void> showCategorySheet(BuildContext context, WidgetRef ref) => _pickOne<String>(
      context,
      title: EditCopy.categorySheet,
      note: EditCopy.categoryNote,
      options: [for (final c in DuCatalog.categories) (c, categoryTitle(c), null)],
      current: ref.read(sheetEditorProvider).current.category,
      onPick: (_, category) {
        ref.read(sheetEditorProvider).setCategory(category);
        return true;
      },
    );

/// Up to eight colleges of the chosen course, highest Round 1 figure first for the category.
Future<void> showCollegesSheet(BuildContext context) => showMmSheet<void>(
      context: context,
      title: EditCopy.collegesSheet,
      heightFactor: 0.88,
      footer: (sheet) => KeyButton(label: EditCopy.done, onPressed: () => Navigator.of(sheet).maybePop()),
      builder: (_) => const _CollegesBody(),
    );

class _CollegesBody extends ConsumerStatefulWidget {
  const _CollegesBody();

  @override
  ConsumerState<_CollegesBody> createState() => _CollegesBodyState();
}

class _CollegesBodyState extends ConsumerState<_CollegesBody> {
  bool _capped = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    ref.watch(studentTargetProvider);
    final editor = ref.read(sheetEditorProvider);
    final answers = editor.current;
    final course = answers.course;
    if (course == null) return _note(context, EditCopy.collegesNeedCourse);
    final category = answers.category;
    final picks = answers.colleges;
    final ladder = course.ladder(category);
    final unranked = [for (final o in course.offerings) if (o.scoreFor(category) == null) o];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _note(context, EditCopy.collegesNote(category)),
        if (_capped) ...[
          const InlineBanner(message: EditCopy.collegesCap, tone: BannerTone.warning),
          const SizedBox(height: MmSpace.s12),
        ],
        for (final o in [...ladder, ...unranked]) ...[
          MmSelectRow(
            multi: true,
            title: o.college,
            note: o.scoreFor(category) == null ? EditCopy.noSeat : DuCatalog.format(o.scoreFor(category)!),
            selected: picks.contains(o.college),
            trailing: picks.contains(o.college)
                ? Text('${picks.indexOf(o.college) + 1}', style: type.labelLarge.copyWith(color: colors.ink2))
                : null,
            onTap: () => setState(() => _capped = !editor.toggleCollege(o.college)),
          ),
          const SizedBox(height: MmSpace.s8),
        ],
        _phoneNote(context),
      ],
    );
  }
}

/// How solid each profile subject feels: Shaky, Okay or Strong.
Future<void> showConfidenceSheet(BuildContext context, List<String> subjects) => showMmSheet<void>(
      context: context,
      title: EditCopy.confidenceSheet,
      heightFactor: subjects.length > 3 ? 0.8 : null,
      footer: (sheet) => KeyButton(label: EditCopy.done, onPressed: () => Navigator.of(sheet).maybePop()),
      builder: (_) => _ConfidenceBody(subjects: subjects),
    );

class _ConfidenceBody extends ConsumerWidget {
  const _ConfidenceBody({required this.subjects});

  final List<String> subjects;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final levels = ref.watch(studentTargetProvider.select((t) => t.confidence));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _note(context, EditCopy.confidenceNote),
        for (final id in subjects) ...[
          const SizedBox(height: MmSpace.s12),
          Row(
            children: [
              SubjectArt(id, size: EmblemSizes.chip),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(subjectDisplayName(id), style: type.labelLarge.copyWith(fontSize: 16))),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          // Unrated reads as Okay, as in setup.
          MmSegmented<Confidence>(
            semanticsLabel: subjectDisplayName(id),
            segments: [for (final c in Confidence.values) MmSegment(c, c.label)],
            value: levels[id] ?? Confidence.okay,
            onChanged: (c) => ref.read(sheetEditorProvider).setConfidence(id, c),
          ),
        ],
        _phoneNote(context),
      ],
    );
  }
}
