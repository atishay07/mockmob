import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/concepts_pick.dart';
import '../models/learn_catalog.dart';
import '../../../core/art/art.dart' show EmblemSizes;
import 'lesson_ring.dart';
import 'subject_mark.dart';
import 'reveal_in.dart';

// The pieces of the Learn library (LEARN-REVIEW-1017 5.9, P-LR6): the one panel, quiet link rows, the search field,
// chapter rows with their lessons, and the marks tag. Hairlines and type, no nested boxes, no icon tiles.

const String _minus = '−';

/// "Read this next": the one lime key on Learn. The lesson, why it is next, the key with the time it covers, and
/// what it costs (nothing; its cards then join Revise).
class ReadNextPanel extends StatelessWidget {
  const ReadNextPanel({super.key, required this.pick, required this.onStart, this.busy = false, this.message, this.subjectName});

  final ConceptsPick pick;

  /// The lesson's subject by name: its drawn object stands beside the title.
  final String? subjectName;
  final VoidCallback onStart;
  final bool busy;

  /// A start that failed says why, under the key.
  final String? message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmSurface.hero(
      lit: true,
      padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (pick.lead.isNotEmpty) ...[
                      Text(pick.lead, style: type.label.copyWith(color: colors.ink2)),
                      const SizedBox(height: MmSpace.s4),
                    ],
                    Semantics(header: true, child: Text(pick.title, style: type.title)),
                  ],
                ),
              ),
              // The lesson's subject, as its drawn object under the lamp (the app's own voice, 5.13).
              if (subjectName != null && pick.unit != null) ...[
                const SizedBox(width: MmSpace.s12),
                SubjectMark(subjectId: pick.unit!.subject, name: subjectName!, size: EmblemSizes.tile),
              ],
            ],
          ),
          if (pick.reason.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s8),
            Text(pick.reason, style: type.body.copyWith(color: colors.ink2)),
          ],
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: pick.key, onPressed: busy ? null : onStart, loading: busy),
          if (message != null || pick.cost != null) ...[
            const SizedBox(height: MmSpace.s8),
            Semantics(
              liveRegion: message != null,
              child: Text(
                message ?? pick.cost!,
                style: type.small.copyWith(color: message != null ? colors.warnText : colors.ink3),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A quiet row: a title, one line under it, a chevron. The whole row is the control (48 dp and up).
class LearnLinkRow extends StatelessWidget {
  const LearnLinkRow({super.key, required this.title, required this.onTap, this.note, this.trailing});

  final String title;
  final String? note;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: [title, ?note].join('. '),
      focusRadius: MmRadius.panelAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                    if (note != null) Text(note!, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              trailing ?? Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

/// One field: search chapters and lessons across subjects (48 dp).
class LearnSearchField extends StatelessWidget {
  const LearnSearchField({super.key, required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    OutlineInputBorder border(Color c, double w) => OutlineInputBorder(borderRadius: MmRadius.keyAll, borderSide: BorderSide(color: c, width: w));
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: MmTarget.min),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        style: type.body,
        cursorColor: colors.ink,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: LearnCopy.searchHint,
          hintStyle: type.body.copyWith(color: colors.ink3),
          prefixIcon: Icon(LucideIcons.search, size: 18, color: colors.ink2),
          filled: true,
          fillColor: colors.raised,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
          enabledBorder: border(colors.lineStrong, 1),
          focusedBorder: border(colors.ink, 1.5),
        ),
      ),
    );
  }
}

/// "−18": the marks a chapter's open mistakes cost, in tabular figures, said in full to TalkBack.
class MarksLost extends StatelessWidget {
  const MarksLost({super.key, required this.marks});

  final int marks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      label: '$marks marks slipped',
      child: ExcludeSemantics(
        child: Text(
          '$_minus$marks',
          style: context.mmType.label.copyWith(color: colors.wrongText, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
      ),
    );
  }
}

/// A section's heading on the gutter with one plain line beside or under it.
class LearnSectionHead extends StatelessWidget {
  const LearnSectionHead({super.key, required this.title, this.note, this.subjectId, this.subjectName});

  final String title;
  final String? note;

  /// A subject's section leads with the subject's own drawn emblem.
  final String? subjectId;
  final String? subjectName;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(title, style: type.subhead)),
        if (note != null && note!.isNotEmpty) Text(note!, style: type.small.copyWith(color: colors.ink2)),
      ],
    );
    if (subjectId == null) return text;
    return Row(
      children: [
        SubjectMark(subjectId: subjectId!, name: subjectName ?? subjectId!, size: EmblemSizes.tile),
        const SizedBox(width: MmSpace.s12),
        Expanded(child: text),
      ],
    );
  }
}

/// One lesson in a list: its state ring, the title, one line that is true about it, and its time (or Read).
class LessonLine extends StatelessWidget {
  const LessonLine({super.key, required this.unit, required this.onOpen, this.sub, this.where});

  final LearnUnit unit;
  final VoidCallback onOpen;

  /// Whether it opens without a connection, said only when it matters ("On this phone", "Needs connection").
  final String? where;

  /// Replaces the lesson's own line (a search result names its subject and chapter).
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = lessonRow(unit);
    final line = [sub ?? row.line, ?where].join('\n');
    return MmPressable(
      semanticsLabel: [unit.title, line, if (row.trailing.isNotEmpty) row.trailing].join('. '),
      focusRadius: MmRadius.panelAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      onTap: onOpen,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: LessonStateRing(key: ValueKey('ring-${unit.id}'), state: LessonRingState.of(unit)),
              ),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(unit.title, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                    Text(line, style: type.small.copyWith(color: colors.ink2), maxLines: 3, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              if (row.trailing.isNotEmpty) ...[
                const SizedBox(width: MmSpace.s12),
                Text(row.trailing, style: type.small.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A chapter with open mistakes (Where you lose marks): its name and cost, the line, then its lessons, or the way to
/// practise it when no lesson is written yet.
class LoseMarksBlock extends StatelessWidget {
  const LoseMarksBlock({super.key, required this.row, required this.onOpen, required this.onPractise, this.whereOf});

  final ChapterRow row;
  final String? Function(LearnUnit unit)? whereOf;
  final ValueChanged<LearnUnit> onOpen;
  final VoidCallback onPractise;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final head = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(row.name, style: type.body.copyWith(fontWeight: FontWeight.w600))),
        const SizedBox(width: MmSpace.s12),
        MarksLost(marks: row.marks),
      ],
    );
    if (row.lessons.isEmpty) {
      return LearnLinkRow(title: row.name, note: row.meta, onTap: onPractise, trailing: MarksLost(marks: row.marks));
    }
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          head,
          Text(row.meta, style: type.small.copyWith(color: colors.ink2)),
          for (final u in row.lessons) LessonLine(unit: u, where: whereOf?.call(u), onOpen: () => onOpen(u)),
        ],
      ),
    );
  }
}

/// One chapter of the syllabus, closed to one line (name, cost when open, what it holds); open, its lessons, then
/// Practise this chapter and, when it has lessons, its summary.
class ChapterFold extends StatefulWidget {
  const ChapterFold({super.key, required this.row, required this.onOpen, required this.onPractise, this.onSummary, this.whereOf});

  final ChapterRow row;
  final String? Function(LearnUnit unit)? whereOf;
  final ValueChanged<LearnUnit> onOpen;
  final VoidCallback onPractise;
  final VoidCallback? onSummary;

  @override
  State<ChapterFold> createState() => _ChapterFoldState();
}

class _ChapterFoldState extends State<ChapterFold> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = widget.row;
    // A chapter with no lesson yet has one thing to do: practise it. The row goes straight there.
    if (row.lessons.isEmpty) {
      return LearnLinkRow(
        title: row.name,
        note: row.meta,
        onTap: widget.onPractise,
        trailing: row.marks > 0 ? MarksLost(marks: row.marks) : null,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          semanticsLabel: [
            row.name,
            if (row.marks > 0) '${row.marks} marks slipped',
            row.meta,
            _open ? LearnCopy.hideChapter : LearnCopy.showChapter,
          ].join('. '),
          focusRadius: MmRadius.panelAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          onTap: () => setState(() => _open = !_open),
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(row.name, style: type.body.copyWith(fontWeight: FontWeight.w500)),
                        Text(row.meta, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                  if (row.marks > 0) ...[const SizedBox(width: MmSpace.s12), MarksLost(marks: row.marks)],
                  const SizedBox(width: MmSpace.s12),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: Motion.of(context, Motion.ui),
                    curve: Motion.out,
                    child: Icon(LucideIcons.chevronDown, size: 16, color: colors.ink3),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_open)
          RevealIn(
            child: Padding(
              padding: const EdgeInsets.only(left: MmSpace.s12, bottom: MmSpace.s8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final u in row.lessons) LessonLine(unit: u, where: widget.whereOf?.call(u), onOpen: () => widget.onOpen(u)),
                  Wrap(
                    spacing: MmSpace.s8,
                    children: [
                      KeyButton.quiet(label: LearnCopy.practiseChapter, semanticsLabel: '${LearnCopy.practiseChapter}, ${row.name}', onPressed: widget.onPractise),
                      if (widget.onSummary != null && row.lessons.isNotEmpty)
                        KeyButton.quiet(label: LearnCopy.readSummary, semanticsLabel: '${LearnCopy.readSummary}, ${row.name}', onPressed: widget.onSummary),
                    ],
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
