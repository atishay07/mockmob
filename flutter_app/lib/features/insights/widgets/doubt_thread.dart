import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/data/practice_catalog.dart' show practiceChaptersProvider;
import '../../review/widgets/check_card.dart';
import '../data/ask_controller.dart';
import '../data/ask_doors.dart';
import '../data/chapter_ties.dart' show byMarksLost;
import '../data/insights_models.dart';
import '../data/subject_names.dart';

/// What a doubt's credit bought, under Mobi's answer (MOBI-CONTRACT 2 and 3; C-dec 3): the 2 new CUET-style questions that
/// test it, answered right there and marked by the server with the bank's own explanation. When the doubt named no
/// chapter, the student picks one (a chip each) and the 2 questions come from it. Nothing here costs a credit.
class DoubtChecks extends StatelessWidget {
  const DoubtChecks({super.key, required this.thread, required this.onAnswer, required this.onChapter, this.record});

  final DoubtThread thread;
  final void Function(String checkQuestionId, int pick) onAnswer;
  final void Function(String subject, String chapter) onChapter;

  /// The record, for the chapter chips when the doubt named none.
  final PrepInsights? record;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final checks = thread.checks;
    final right = [for (final c in checks) if (thread.marks[c.id]?.right ?? false) c].length;
    final answered = [for (final c in checks) if (thread.marks.containsKey(c.id)) c].length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, child: Text(DoubtCopy.title, style: type.cardTitle)),
        const SizedBox(height: MmSpace.s4),
        Text(DoubtCopy.lead, style: type.small.copyWith(color: colors.ink2)),
        if (checks.isEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          _ChapterPicker(thread: thread, recordChips: _chapters(), onChapter: onChapter),
        ] else
          for (final (i, c) in checks.indexed) ...[
            SizedBox(height: i == 0 ? MmSpace.s20 : MmSpace.s32),
            CheckCard(
              key: ValueKey('doubt-check-${c.id}'),
              number: i + 1,
              of: checks.length,
              question: c.question,
              passage: c.passage,
              mark: thread.marks[c.id],
              marking: thread.answering.contains(c.id),
              pending: thread.picks[c.id],
              error: thread.marks.containsKey(c.id) ? null : thread.error,
              onAnswer: (pick) => onAnswer(c.id, pick),
            ),
          ],
        if (checks.isNotEmpty && answered == checks.length) ...[
          const SizedBox(height: MmSpace.s24),
          Semantics(
            liveRegion: true,
            child: Text(DoubtCopy.tally(right, checks.length), style: type.body.copyWith(fontWeight: FontWeight.w600)),
          ),
        ],
      ],
    );
  }

  /// The chapters a chip can name: the record's own, for the doubt's subject when it has one, costliest first.
  List<({String subject, String chapter})> _chapters() {
    final r = record;
    if (r == null || !r.isReady) return const [];
    final subject = thread.info.subject ?? thread.askedSubject;
    return [
      for (final c in byMarksLost(r.ranked))
        if (c.chapter.trim().isNotEmpty && c.chapter != 'Unmapped chapter' && (subject == null || canonicalSubjectId(c.subject) == canonicalSubjectId(subject)))
          (subject: canonicalSubjectId(c.subject), chapter: c.chapter.trim()),
    ].take(4).toList();
  }
}

/// The server's note about a doubt's questions, in the app's words where the live server still says "real CUET
/// questions" (L-02: they are new CUET-style questions from the checked bank).
String plainCheckNote(String note) => note.replaceAll('real CUET questions', 'new CUET-style questions');

/// Where a doubt that named no chapter gets one (app-mobi H1): the record's own chapters for the doubt's subject first;
/// on a fresh account (no record yet) the subject's syllabus chapters, the ones practice offers; and when the doubt
/// named no subject either, the student's subjects first. So the 2 questions the credit bought are always one tap away.
class _ChapterPicker extends ConsumerStatefulWidget {
  const _ChapterPicker({required this.thread, required this.recordChips, required this.onChapter});

  final DoubtThread thread;
  final List<({String subject, String chapter})> recordChips;
  final void Function(String subject, String chapter) onChapter;

  @override
  ConsumerState<_ChapterPicker> createState() => _ChapterPickerState();
}

class _ChapterPickerState extends ConsumerState<_ChapterPicker> {
  String? _picked;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = widget.thread;
    final serverNote = t.checksNote;
    // The server's "pick the chapter" note is said in the app's own words; any other note (none left, could not load)
    // is the server's, made plain.
    final pickNote = serverNote == null || serverNote.startsWith('Pick the chapter');
    final mine = ref.watch(authSnapshotProvider.select((a) => a.subjects));
    final asked = t.info.subject ?? t.askedSubject;
    final subject = _picked ?? (asked == null ? (mine.length == 1 ? mine.first : null) : canonicalSubjectId(asked));

    final List<Widget> chips;
    String? waiting;
    String? failed;
    if (widget.recordChips.isNotEmpty) {
      chips = [for (final c in widget.recordChips) _chip(c.subject, c.chapter)];
    } else if (subject == null) {
      // No subject yet: the student's own subjects, then that subject's chapters.
      chips = [
        for (final s in mine)
          MmChip(label: subjectDisplayName(s), selected: false, showBubble: false, onTap: t.attaching ? null : () => setState(() => _picked = canonicalSubjectId(s))),
      ];
    } else {
      final catalog = ref.watch(practiceChaptersProvider(subject));
      final entries = catalog.value?.allChapters;
      final names = [
        if (entries != null)
          for (final c in entries)
            if (c.name.trim().isNotEmpty) c.name.trim(),
      ];
      chips = [for (final n in names) _chip(subject, n)];
      if (catalog.isLoading && names.isEmpty) waiting = DoubtCopy.loadingChapters;
      if (catalog.hasError && names.isEmpty) failed = DoubtCopy.chaptersFailed;
    }
    final lead = pickNote ? (subject == null && widget.recordChips.isEmpty && chips.isNotEmpty ? DoubtCopy.pickSubject : DoubtCopy.pickChapter) : plainCheckNote(serverNote);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(lead, style: type.body.copyWith(color: colors.ink)),
        if (chips.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          Wrap(spacing: MmSpace.s8, runSpacing: MmSpace.s8, children: chips),
        ],
        if (waiting != null) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(waiting, style: type.caption.copyWith(color: colors.ink2))),
        ],
        if (failed != null && subject != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(failed, style: type.small.copyWith(color: colors.ink2)),
          Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(label: DoubtCopy.tryAgain, onPressed: () => ref.invalidate(practiceChaptersProvider(subject))),
          ),
        ],
        if (t.attaching) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(DoubtCopy.finding, style: type.caption.copyWith(color: colors.ink2))),
        ],
        if (t.error != null) ...[
          const SizedBox(height: MmSpace.s8),
          Semantics(liveRegion: true, child: Text(t.error!, style: type.small.copyWith(color: colors.badText, fontWeight: FontWeight.w600))),
        ],
      ],
    );
  }

  Widget _chip(String subject, String chapter) => MmChip(
        label: chapter,
        selected: widget.thread.info.chapter == chapter,
        showBubble: false,
        onTap: widget.thread.attaching ? null : () => widget.onChapter(subject, chapter),
      );
}

/// The foot of the screen once a doubt's follow-up is used: the thread is closed, and a new doubt says its price.
class DoubtClosed extends StatelessWidget {
  const DoubtClosed({super.key, required this.onNew, this.bottomInset = 0});

  final VoidCallback onNew;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.ground, border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12 + bottomInset),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(liveRegion: true, child: Text(AskDoorCopy.threadDone, style: type.body.copyWith(fontWeight: FontWeight.w600))),
            const SizedBox(height: MmSpace.s2),
            Text(AskDoorCopy.threadDoneBody, style: type.small.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            KeyButton(label: AskDoorCopy.newDoubt, minHeight: 52, onPressed: onNew),
          ],
        ),
      ),
    );
  }
}

abstract final class DoubtCopy {
  static const title = 'Test it on 2 new CUET-style questions';
  static const lead = 'They come with this doubt, so they use no extra credit. Your first answer counts.';
  static const pickChapter = 'Pick the chapter and Mobi adds 2 new CUET-style questions on it.';
  static const pickSubject = 'Pick the subject, then the chapter, and Mobi adds 2 new CUET-style questions on it.';
  static const loadingChapters = 'Loading the chapters.';
  static const chaptersFailed = 'The chapters did not load. Nothing was charged.';
  static const tryAgain = 'Try again';
  static const finding = 'Finding 2 questions you have not seen.';
  static String tally(int right, int of) => right == of
      ? (of == 2 ? 'You got both right. This doubt is settled.' : 'You got it right. This doubt is settled.')
      : right == 0
          ? (of == 2 ? 'You got neither right yet. The explanations show where the idea breaks.' : 'Not yet. The explanation shows where the idea breaks.')
          : 'You got $right of $of right. Read the explanation of the one you missed.';
}
