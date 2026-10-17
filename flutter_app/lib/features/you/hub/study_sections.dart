// The study blocks of You (app-you-1016 A.2): the three personal bests as value-first rows, the
// Aim row under My subjects, and the one Plan and credits row at the very bottom. Every figure is
// a real record with its denominator or its date; a row with nothing true to say is left off.
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/copy.dart';
import '../../../core/notes/sample_row.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../credits/credits.dart';
import '../../insights/data/subject_names.dart' show subjectDisplayName;
import '../../rhythm/data/bests.dart';
import '../../rhythm/data/rhythm_providers.dart';
import '../../rhythm/logic/fastest_answer.dart';
import '../copy.dart' hide subjectDisplayName;
import '../data/student_target.dart';
import '../widgets/you_page.dart' show youText;
import '../widgets/you_row.dart';

/// Hairlines of a flat list start where the row text starts: 4 dp, a 28 dp bare icon, 16 dp.
const double _flatInset = 28 + MmSpace.s16;

/// The three personal bests: best mock (marks out of the paper's total), the longest run of weeks
/// at the goal, and the fastest right answer. Each row opens Personal bests.
class BestsRows extends ConsumerWidget {
  const BestsRows({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final bestsState = ref.watch(bestsRepositoryProvider);
    final rhythm = ref.watch(rhythmSnapshotProvider.select((s) => s.rhythm));
    final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
    if (bestsState.isInitialLoading && bestsState.value == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: youText),
        child: SkeletonGroup(
          label: YouCopy.bestsTitle,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < 3; i++) ...[
                const SizedBox(height: MmSpace.s16),
                const Row(children: [Skeleton.line(width: 64, height: 24), SizedBox(width: MmSpace.s16), Skeleton.line(width: 160, height: 14)]),
                const SizedBox(height: MmSpace.s16),
              ],
            ],
          ),
        ),
      );
    }
    final all = bestsState.value ?? const <PersonalBest>[];
    final rows = <Widget>[];

    // Best mock: the highest share of its paper's total; a set stands in before the first mock.
    PersonalBest? top(Iterable<PersonalBest> list) {
      PersonalBest? best;
      for (final b in list) {
        if (b.best.max <= 0) continue;
        if (best == null || b.best.marks / b.best.max > best.best.marks / best.best.max) best = b;
      }
      return best;
    }

    final mock = top(all.where((b) => b.isMock));
    final set = mock == null ? top(all.where((b) => !b.isMock)) : null;
    final paper = mock ?? set;
    if (paper != null) {
      final date = paper.best.completedAt;
      rows.add(_BestRow(
        value: '${paper.best.marks} / ${paper.best.max}',
        label: mock != null ? YouCopy.bestMockLabel : YouCopy.bestSetLabel,
        note: [subjectDisplayName(paper.subject), if (date != null) formatDayMonth(date.toLocal())].join(', '),
      ));
    }

    final run = rhythm == null ? 0 : math.max(rhythm.bestRun, rhythm.weeksMetStreak);
    if (rhythm != null) {
      // Until a run is at least a week there is nothing to measure: no "0 weeks", only the empty line.
      rows.add(_BestRow(
        value: run == 0 ? null : plural(run, 'week'),
        label: YouCopy.bestRunLabel,
        note: run == 0 ? YouCopy.bestRunFirst : YouCopy.bestRunNow(rhythm.weeksMetStreak),
      ));
    }

    final fastest = attempts == null ? null : fastestRightAnswer(attempts);
    if (fastest != null) {
      rows.add(_BestRow(
        value: '${fastest.seconds} s',
        label: YouCopy.bestFastestLabel,
        note: '${subjectDisplayName(fastest.subject)}, ${formatDayMonth(fastest.at.toLocal())}',
      ));
    }

    // Nothing true to show yet: no paper, no timed answer and no week at the goal. A run of weeks
    // stands on its own, so a student who studies without a scored set still sees it.
    if (paper == null && fastest == null && run == 0) {
      // An empty state that teaches: what will appear, one sample row (tagged "Example"), and the
      // key to the next action.
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: youText),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(YouCopy.bestsEmpty, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            const SampleRow(value: YouCopy.bestsSampleValue, title: YouCopy.bestMockLabel, note: YouCopy.bestsSampleNote),
            const SizedBox(height: MmSpace.s4),
            Align(
              alignment: Alignment.centerLeft,
              child: KeyButton.quiet(label: YouCopy.bestsStart, onPressed: () => context.push(AppRoutes.practiceStart)),
            ),
          ],
        ),
      );
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

/// A value-first row (R9): the figure in Bricolage tabular on the left, the label and its context
/// on the right, the whole 64 dp row opening Personal bests.
class _BestRow extends StatelessWidget {
  const _BestRow({required this.value, required this.label, required this.note});

  /// Null where nothing is measured yet: the row is then its label and one empty line.
  final String? value;
  final String label;
  final String note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figure = value;
    return MmPressable(
      onTap: () => context.push(AppRoutes.youBests),
      haptic: MmPressHaptic.selection,
      highlight: true,
      pressedScale: 0.985,
      focusRadius: MmRadius.smallAll,
      semanticsLabel: figure == null ? '$label. $note.' : '$label: $figure. $note',
      builder: (context, pressed, focused) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText, vertical: MmSpace.s8),
          child: Row(
            children: [
              if (figure != null) ...[
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 112),
                  child: Text(
                    figure,
                    style: type.figure.copyWith(fontSize: 28, height: 32 / 28, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(label, style: type.subhead),
                    const SizedBox(height: 2),
                    Text(note, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              Icon(LucideIcons.chevronRight, size: 18, color: colors.ink2),
            ],
          ),
        ),
      ),
    );
  }
}

/// Aim: the course and colleges, which live in the Colleges tab. One row that goes there.
class AimRow extends StatelessWidget {
  const AimRow({super.key, required this.target, required this.onOpen});

  final StudentTarget target;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final course = target.course;
    final colleges = target.colleges.length;
    final note = course == null && colleges == 0
        ? YouCopy.aimEmpty
        : [?course, if (colleges > 0) plural(colleges, 'college')].join(', ');
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [YouRow(flat: true, icon: LucideIcons.target, title: YouCopy.aimTitle, note: note, onTap: onOpen)],
    );
  }
}

/// Plan and credits as one row at the bottom of You: the tiles live in the account sheet, so they
/// are not drawn twice (L17).
class PlanCreditsRow extends ConsumerWidget {
  const PlanCreditsRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final figures = ref.watch(creditFiguresProvider);
    final until = figures.proUntil;
    final title = figures.isPro ? (until == null ? CreditsCopy.planProActive : CreditsCopy.planUntil(until)) : YouCopy.planFree;
    final practice = figures.practice;
    final ai = figures.ai;
    final note = practice == null || ai == null ? YouCopy.planNoteUnloaded : YouCopy.planNote(practice, ai);
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [YouRow(flat: true, icon: LucideIcons.wallet, title: title, note: note, onTap: () => openCreditsPage(context))],
    );
  }
}
