import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/practice_selection.dart';
import 'length_dial.dart';
import 'plain_notice.dart';

/// The name of a mode as the student reads it.
String modeTitle(PracticeMode mode) => switch (mode) {
  PracticeMode.full => PracticeCopy.fullMockTitle,
  PracticeMode.quick => PracticeCopy.quickTitle,
  PracticeMode.chapter => PracticeCopy.chapterTitle,
  PracticeMode.smart => PracticeCopy.smartTitle,
  PracticeMode.nta => PracticeCopy.ntaTitle,
};

/// How many questions: the counts the mode offers (5, 10, 15, 20; Smart from 10) and nothing
/// else, on the [LengthDial], where each length shows as the size of its sheet.
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
        Semantics(
          header: true,
          child: Text(PracticeCopy.questionsLabel, style: type.label.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s8),
        LengthDial(semanticsLabel: PracticeCopy.questionsLabel, counts: counts, count: count, onChanged: onChanged),
      ],
    );
  }
}

/// Balanced, Easy, Medium or Hard. Choosing a level is a Pro feature on the server
/// (`PREMIUM_REQUIRED`), so a free account sees the control set to Balanced, disabled, with a
/// quiet Pro tag and the plain reason; there is no purchase path in the app. A tap on the locked
/// control answers with the lightest tick and the reason lighting up for a moment (colour only,
/// so nothing moves).
class DifficultyPicker extends ConsumerStatefulWidget {
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
  ConsumerState<DifficultyPicker> createState() => _DifficultyPickerState();
}

class _DifficultyPickerState extends ConsumerState<DifficultyPicker> with SingleTickerProviderStateMixin {
  /// 0 to 1 and back: how strongly the reason is lit.
  late final AnimationController _lit;

  @override
  void initState() {
    super.initState();
    _lit = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));
  }

  @override
  void dispose() {
    _lit.dispose();
    super.dispose();
  }

  /// A tap on the locked control: the reason is already on the page, so point at it.
  void _explain() {
    unawaited(ref.read(hapticsProvider).selection());
    _lit.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final isPro = widget.isPro;
    // Four equal segments cut "Balanced" and "Medium" to "Balan..." from 1.3x text up: the
    // same choice reads as a wrapped row of chips there, with nothing cut and the Start key not
    // pushed out of sight.
    final control = MediaQuery.textScalerOf(context).scale(1) >= _listTextScale
        ? _DifficultyChips(value: isPro ? widget.value : PracticeDifficulty.balanced, onChanged: isPro ? widget.onChanged : null)
        : MmSegmented<PracticeDifficulty>(
            semanticsLabel: PracticeCopy.difficultyLabel,
            segments: [for (final d in PracticeDifficulty.values) MmSegment(d, DifficultyPicker.label(d))],
            value: isPro ? widget.value : PracticeDifficulty.balanced,
            onChanged: isPro ? widget.onChanged : null,
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Semantics(
              header: true,
              child: Text(PracticeCopy.difficultyLabel, style: type.label.copyWith(color: colors.ink2)),
            ),
            if (!isPro) ...[const SizedBox(width: MmSpace.s8), const ProTag()],
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        if (isPro)
          control
        else
          // The disabled control ignores taps itself; this hears them (a tap on a child with no
          // handler still reaches the parent's recognizer).
          GestureDetector(behavior: HitTestBehavior.translucent, onTap: _explain, child: control),
        if (!isPro) ...[
          const SizedBox(height: MmSpace.s8),
          AnimatedBuilder(
            animation: _lit,
            builder: (context, _) => Text(
              PracticeCopy.difficultyProNote,
              style: type.small.copyWith(color: Color.lerp(colors.ink2, colors.ink, math.sin(math.pi * _lit.value))),
            ),
          ),
        ],
      ],
    );
  }
}

/// From this text scale the difficulty choice is a list of rows, not four narrow segments.
const double _listTextScale = 1.25;

class _DifficultyChips extends ConsumerWidget {
  const _DifficultyChips({required this.value, required this.onChanged});

  final PracticeDifficulty value;
  final ValueChanged<PracticeDifficulty>? onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    const radius = MmRadius.smallAll;
    return Semantics(
      container: true,
      label: PracticeCopy.difficultyLabel,
      child: Wrap(
        spacing: MmSpace.s8,
        runSpacing: MmSpace.s8,
        children: [
          for (final d in PracticeDifficulty.values)
            MmPressable(
              semanticsLabel: DifficultyPicker.label(d),
              selected: d == value,
              inMutuallyExclusiveGroup: true,
              focusRadius: radius,
              onTap: onChanged == null || d == value
                  ? null
                  : () {
                      ref.read(hapticsProvider).selection();
                      onChanged!(d);
                    },
              builder: (context, pressed, _) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: MmTarget.min),
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    color: MmSelection.fill(colors, selected: d == value, pressed: pressed),
                    shape: RoundedSuperellipseBorder(
                      borderRadius: radius,
                      side: MmSelection.side(colors, selected: d == value),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SelectBubble(selected: d == value),
                        const SizedBox(width: MmSpace.s8),
                        Text(DifficultyPicker.label(d), style: type.labelLarge.copyWith(color: d == value ? colors.ink : colors.ink2)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
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
      decoration: ShapeDecoration(
        shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
      ),
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
        if (noLength) ...[const SizedBox(height: MmSpace.s12), PlainNotice(message: PracticeCopy.sheetNoLength, tone: BannerTone.error)],
      ],
    );
  }
}
