import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/copy.dart';
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/subject_names.dart';
import '../data/trend.dart';

/// "Show me" under a claim on the record page, opening the sessions behind it: one session opens
/// straight in its result, several open a sheet listing them, newest first. Draws nothing when
/// there is no session to show (the caller hides the claim too).
///
/// It is a full-width row with a chevron, never a pill: the whole line is the target (48 dp), it
/// says how many sessions it opens, and it stays quieter than the one action of the screen.
class EvidencePill extends StatelessWidget {
  const EvidencePill({super.key, required this.attempts, required this.what});

  /// Newest first.
  final List<Attempt> attempts;

  /// What the claim is, for the sheet title and the spoken label ("the sessions behind this").
  final String what;

  @override
  Widget build(BuildContext context) {
    if (attempts.isEmpty) return const SizedBox.shrink();
    return ShowMeRow(
      semanticsLabel: InsightsCopy.showMeSessions(attempts.length),
      count: InsightsCopy.showMeCount(attempts.length),
      onTap: () => openEvidence(context, attempts, what: what),
    );
  }
}

/// "Show me" as a tappable row: the words, an optional count of what opens, and a chevron. With
/// [fill] it spans the width (label left, count and chevron right); without it, it hugs its
/// content, for a spot beside a line of text.
class ShowMeRow extends StatelessWidget {
  const ShowMeRow({super.key, required this.onTap, required this.semanticsLabel, this.count, this.fill = true});

  final VoidCallback onTap;
  final String semanticsLabel;
  final String? count;
  final bool fill;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: semanticsLabel,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.99,
      onTap: onTap,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          mainAxisSize: fill ? MainAxisSize.max : MainAxisSize.min,
          children: [
            Text(ShowMePill.label, style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w600, color: colors.ink)),
            if (fill) const Spacer() else const SizedBox(width: MmSpace.s4),
            if (count != null) ...[
              Text(count!, style: type.caption.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
              const SizedBox(width: MmSpace.s4),
            ],
            Icon(LucideIcons.chevronRight, size: 18, color: colors.ink2),
          ],
        ),
      ),
    );
  }
}

/// The quiet form of Show me for a row inside a group: the line that says what the row rests on
/// is itself the way in ("Based on 9 questions" and a chevron), so a section carries one pill and
/// its other rows carry none.
class BasisLink extends StatelessWidget {
  const BasisLink({super.key, required this.text, required this.attempts, required this.what});

  final String text;
  final List<Attempt> attempts;
  final String what;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(color: colors.ink3);
    if (attempts.isEmpty) return Text(text, style: style);
    return MmPressable(
      semanticsLabel: '$text. ${InsightsCopy.showMeSessions(attempts.length)}',
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: () => openEvidence(context, attempts, what: what),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(child: Text(text, style: style.copyWith(color: pressed ? colors.ink : colors.ink2))),
            const SizedBox(width: MmSpace.s4),
            Icon(LucideIcons.chevronRight, size: 14, color: colors.ink3),
          ],
        ),
      ),
    );
  }
}

/// Opens the sessions behind a claim.
void openEvidence(BuildContext context, List<Attempt> attempts, {required String what}) {
  if (attempts.isEmpty) return;
  if (attempts.length == 1) {
    unawaited(context.push<void>(AppRoutes.result(attempts.single.id)));
    return;
  }
  final router = GoRouter.of(context);
  unawaited(
    showMmSheet<void>(
      context: context,
      title: what,
      builder: (sheet) => EvidenceList(
        attempts: attempts,
        onOpen: (a) {
          Navigator.of(sheet).pop();
          unawaited(router.push<void>(AppRoutes.result(a.id)));
        },
      ),
    ),
  );
}

/// The sessions behind a claim, each with its paper, day and marks, opening its result.
class EvidenceList extends StatelessWidget {
  const EvidenceList({super.key, required this.attempts, required this.onOpen});

  final List<Attempt> attempts;
  final ValueChanged<Attempt> onOpen;

  /// Long lists stop at 20 rows; the line under them says how many more.
  static const int shown = 20;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final list = attempts.take(shown).toList();
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(InsightsCopy.evidenceCount(attempts.length), style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        Flexible(
          child: ListView(
            shrinkWrap: true,
            children: [
              for (var i = 0; i < list.length; i++) ...[
                if (i > 0) Divider(height: 1, color: colors.line),
                _EvidenceRow(attempt: list[i], onTap: () => onOpen(list[i])),
              ],
              if (attempts.length > shown)
                Padding(
                  padding: const EdgeInsets.only(top: MmSpace.s12),
                  child: Text(InsightsCopy.evidenceMore(attempts.length - shown), style: type.caption.copyWith(color: colors.ink3)),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EvidenceRow extends StatelessWidget {
  const _EvidenceRow({required this.attempt, required this.onTap});

  final Attempt attempt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final a = attempt;
    final paper = '${subjectDisplayName(a.subject)}, ${modeLabel(a.mode, a.total)}';
    final local = a.completedAt.toLocal();
    final when = '${formatDayMonthShort(local)}, ${formatTime12(local)}';
    final marks = InsightsCopy.trendLatest(a.marks, a.maxMarks);
    return MmPressable(
      semanticsLabel: '$paper. $when. $marks marks. ${InsightsCopy.openSession}',
      focusRadius: MmRadius.smallAll,
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
                  children: [
                    Text(paper, style: type.labelLarge),
                    Text(when, style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              Text(marks, style: type.labelLarge.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
              const SizedBox(width: MmSpace.s8),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
