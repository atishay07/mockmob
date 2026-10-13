import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/practice_selection.dart';

/// The name of a mode as the student reads it.
String modeTitle(PracticeMode mode) => switch (mode) {
  PracticeMode.full => PracticeCopy.fullMockTitle,
  PracticeMode.quick => PracticeCopy.quickTitle,
  PracticeMode.chapter => PracticeCopy.chapterTitle,
  PracticeMode.smart => PracticeCopy.smartTitle,
  PracticeMode.nta => PracticeCopy.ntaTitle,
};

/// How many questions: the counts the mode offers (5, 10, 15, 20; Smart from 10) and nothing
/// else, on the glass segmented control.
class LengthPicker extends StatelessWidget {
  const LengthPicker({super.key, required this.count, required this.onChanged, this.counts = practiceCounts});

  final int count;
  final List<int> counts;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, child: Text(PracticeCopy.questionsLabel, style: type.label.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s8),
        MmSegmented<int>(
          semanticsLabel: PracticeCopy.questionsLabel,
          segments: [for (final c in counts) MmSegment(c, '$c')],
          value: count,
          onChanged: onChanged,
        ),
      ],
    );
  }
}

/// Balanced, Easy, Medium or Hard. Choosing a level is a Pro feature on the server
/// (`PREMIUM_REQUIRED`), so a free account sees the control set to Balanced, disabled, with a
/// quiet Pro tag and the plain reason; there is no purchase path in the app.
class DifficultyPicker extends StatelessWidget {
  const DifficultyPicker({super.key, required this.value, required this.isPro, required this.onChanged});

  final PracticeDifficulty value;
  final bool isPro;
  final ValueChanged<PracticeDifficulty> onChanged;

  static String label(PracticeDifficulty d) => switch (d) {
    PracticeDifficulty.balanced => PracticeCopy.difficultyBalanced,
    PracticeDifficulty.easy => PracticeCopy.difficultyEasy,
    PracticeDifficulty.medium => PracticeCopy.difficultyMedium,
    PracticeDifficulty.hard => PracticeCopy.difficultyHard,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Semantics(header: true, child: Text(PracticeCopy.difficultyLabel, style: type.label.copyWith(color: colors.ink2))),
            if (!isPro) ...[const SizedBox(width: MmSpace.s8), const ProTag()],
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        MmSegmented<PracticeDifficulty>(
          semanticsLabel: PracticeCopy.difficultyLabel,
          segments: [for (final d in PracticeDifficulty.values) MmSegment(d, label(d))],
          value: isPro ? value : PracticeDifficulty.balanced,
          onChanged: isPro ? onChanged : null,
        ),
        if (!isPro) ...[
          const SizedBox(height: MmSpace.s8),
          Text(PracticeCopy.difficultyProNote, style: type.small.copyWith(color: colors.ink2)),
        ],
      ],
    );
  }
}

/// The quiet "Pro" tag after a title: an outline, never a button.
class ProTag extends StatelessWidget {
  const ProTag({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 1),
        child: Text(PracticeCopy.proTag, style: context.mmType.caption.copyWith(fontSize: 11, color: colors.ink2)),
      ),
    );
  }
}

/// The before-mock lines, calm and factual: the marking, the timer rule, and one human aside.
class MockLines extends StatelessWidget {
  const MockLines({super.key, this.ticketBy, this.noLength = false});

  /// Ticket mode only: when the student must open MockMob again by. Known only once the session
  /// exists, so the runner shows it; kept here for the case a caller knows it.
  final DateTime? ticketBy;

  /// The quote did not say how long the mock is, so it cannot start.
  final bool noLength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Plain lines: a bubble here would encode nothing (dots audit, WEB-PARITY section 6).
    Widget line(String text) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: Text(text, style: type.small.copyWith(color: colors.ink)),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        line(PracticeCopy.sheetTimer),
        if (ticketBy != null) line(PracticeCopy.sheetTicket(ticketBy!)),
        const SizedBox(height: MmSpace.s4),
        Text(PracticeCopy.sheetAside, style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s4),
        Text(PracticeCopy.sheetDnd, style: type.caption.copyWith(color: colors.ink3)),
        if (noLength) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: PracticeCopy.sheetNoLength, tone: BannerTone.error),
        ],
      ],
    );
  }
}
