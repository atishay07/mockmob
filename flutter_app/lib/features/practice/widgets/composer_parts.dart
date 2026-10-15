import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rules/widgets/start_sheet_line.dart';
import '../copy.dart';
import '../model/practice_selection.dart';
import 'length_dial.dart';
import 'plain_notice.dart';
import 'spring_pick.dart';

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
              // The pick lands on the switch's detent spring (240 ms, bounce 0.14): the fill, the
              // rim and the words cross together and the chip swells 3 percent at mid-change,
              // so nothing cuts. Its size in the row never changes (a scale, not a layout).
              builder: (context, pressed, _) => SpringPick(
                on: d == value,
                spring: Springs.toggle,
                builder: (context, t, child) {
                  final c = t.clamp(0.0, 1.0);
                  final settled = c == 0 || c == 1;
                  final rest = MmSelection.side(colors, selected: false);
                  final picked = MmSelection.side(colors, selected: true);
                  return Transform.scale(
                    scale: 1 + 0.03 * SpringPick.popAt(t),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: MmTarget.min),
                      child: DecoratedBox(
                        decoration: ShapeDecoration(
                          color: settled
                              ? MmSelection.fill(colors, selected: c == 1, pressed: pressed)
                              : Color.lerp(MmSelection.fill(colors, selected: false, pressed: pressed), MmSelection.fill(colors, selected: true), c),
                          shape: RoundedSuperellipseBorder(
                            borderRadius: radius,
                            side: settled ? (c == 1 ? picked : rest) : BorderSide.lerp(rest, picked, c),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SelectBubble(selected: d == value),
                              const SizedBox(width: MmSpace.s8),
                              Text(DifficultyPicker.label(d), style: type.labelLarge.copyWith(color: Color.lerp(colors.ink2, colors.ink, c))),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
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

/// The before-mock lines, calm and factual: the student's own rule first, then the three things
/// to know in one icon row (the timer keeps running, Submit ends it, silence the phone) and the
/// one human aside under it. One row instead of three stacked notes, so the last line is never
/// cut by the pinned Start key (Design critic 12).
class MockLines extends StatelessWidget {
  const MockLines({super.key, this.ticketBy, this.noLength = false, this.subject});

  /// Ticket mode only: when the student must open MockMob again by. Known only once the session
  /// exists, so the runner shows it; kept here for the case a caller knows it.
  final DateTime? ticketBy;

  /// The quote did not say how long the mock is, so it cannot start.
  final bool noLength;

  /// The attempt-side subject of the mock about to start. With it, the student's rule for this
  /// mock (Mistake Lab v4 slice 3, spec 4.12) leads these lines once the server has it, before
  /// the clock exists.
  final String? subject;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (subject case final subject?) StartSheetLine(subject: subject, padding: const EdgeInsets.only(bottom: MmSpace.s16)),
        if (ticketBy != null)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Text(PracticeCopy.sheetTicket(ticketBy!), style: type.small.copyWith(color: colors.ink)),
          ),
        const MockRulesRow(),
        const SizedBox(height: MmSpace.s12),
        Text(PracticeCopy.sheetAside, style: type.caption.copyWith(color: colors.ink2)),
        if (noLength) ...[const SizedBox(height: MmSpace.s12), PlainNotice(message: PracticeCopy.sheetNoLength, tone: BannerTone.error)],
      ],
    );
  }
}

/// The three things to know before a mock, as one row of three: an icon over a short line. Spoken
/// as the two full sentences ([PracticeCopy.sheetTimer], [PracticeCopy.sheetDnd]).
class MockRulesRow extends StatelessWidget {
  const MockRulesRow({super.key});

  static const List<(IconData, String)> rules = [
    (LucideIcons.timer, PracticeCopy.ruleTimer),
    (LucideIcons.circleCheck, PracticeCopy.ruleSubmit),
    (LucideIcons.bellOff, PracticeCopy.ruleSilence),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '${PracticeCopy.sheetTimer} ${PracticeCopy.sheetDnd}',
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < rules.length; i++) ...[
            if (i > 0) const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(rules[i].$1, size: 22, color: colors.ink),
                  const SizedBox(height: MmSpace.s8),
                  Text(rules[i].$2, style: type.small.copyWith(fontSize: 13, height: 17 / 13, color: colors.ink)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
