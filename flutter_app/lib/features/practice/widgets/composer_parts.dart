
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../billing/billing.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, showUpgradeSheetIfOn;
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
/// (`PREMIUM_REQUIRED`), so a free account sees Balanced chosen and Easy, Medium and Hard at 60% ink
/// with a small lock after the word (AP3-08, A26). A tap on a locked level does not select it: the
/// row shakes 4 dp and the line under it says why, "Easy, Medium and Hard come with Pro." There is
/// no upsell button and no purchase path in the app. A Pro student sees no lock at all.
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

  /// Whether [d] is shut for a free account: every level but Balanced.
  static bool lockedFor(PracticeDifficulty d, {required bool isPro}) => !isPro && d != PracticeDifficulty.balanced;

  @override
  ConsumerState<DifficultyPicker> createState() => _DifficultyPickerState();
}

class _DifficultyPickerState extends ConsumerState<DifficultyPicker> {
  final GlobalKey<MmShakeState> _shake = GlobalKey<MmShakeState>();

  /// A locked level has been tapped: the helper line says why.
  bool _told = false;

  /// A tap on a locked level: the row shakes (with its own warn haptic) and the line under it says
  /// why. Nothing is selected.
  void _locked() {
    // PLAY_BILLING on: the Upgrade sheet says what Pro adds and can buy it. Off: as it was, below.
    if (showUpgradeSheetIfOn(context, reason: ProReason.difficulty)) return;
    _shake.currentState?.shake();
    if (!_told) setState(() => _told = true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final isPro = widget.isPro;
    // Four equal segments cut "Balanced" and "Medium" to "Balan..." from 1.3x text up: the
    // same choice reads as a wrapped row of chips there, with nothing cut and the Start key not
    // pushed out of sight.
    final value = isPro ? widget.value : PracticeDifficulty.balanced;
    final control = MediaQuery.textScalerOf(context).scale(1) >= _listTextScale
        ? _DifficultyChips(value: value, isPro: isPro, onChanged: widget.onChanged, onLockedTap: _locked)
        : MmSegmented<PracticeDifficulty>(
            semanticsLabel: PracticeCopy.difficultyLabel,
            segments: [for (final d in PracticeDifficulty.values) MmSegment(d, DifficultyPicker.label(d), locked: DifficultyPicker.lockedFor(d, isPro: isPro))],
            value: value,
            onChanged: widget.onChanged,
            onLockedTap: (_) => _locked(),
            lockedHint: PracticeCopy.difficultyLockedHint,
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(PracticeCopy.difficultyLabel, style: type.label.copyWith(color: colors.ink2)),
        ),
        const SizedBox(height: MmSpace.s8),
        MmShake(key: _shake, child: control),
        if (!isPro) ...[
          const SizedBox(height: MmSpace.s8),
          MmOverlapSwitcher.fade(
            child: Text(
              _told ? PracticeCopy.difficultyLocked : PracticeCopy.difficultyBalancedNote,
              key: ValueKey(_told),
              style: type.small.copyWith(color: colors.ink2),
            ),
          ),
          // After a tap on a locked level: Google Play's Get Pro, when PLAY_BILLING is on.
          if (_told) const GetProEntry.quiet(),
        ],
      ],
    );
  }
}

/// From this text scale the difficulty choice is a list of rows, not four narrow segments.
const double _listTextScale = 1.25;

class _DifficultyChips extends ConsumerWidget {
  const _DifficultyChips({required this.value, required this.isPro, required this.onChanged, required this.onLockedTap});

  final PracticeDifficulty value;
  final bool isPro;
  final ValueChanged<PracticeDifficulty> onChanged;
  final VoidCallback onLockedTap;

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
              onTap: DifficultyPicker.lockedFor(d, isPro: isPro)
                  ? onLockedTap
                  : d == value
                  ? null
                  : () {
                      ref.read(hapticsProvider).selection();
                      onChanged(d);
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
                              if (!DifficultyPicker.lockedFor(d, isPro: isPro)) ...[SelectBubble(selected: d == value), const SizedBox(width: MmSpace.s8)],
                              if (DifficultyPicker.lockedFor(d, isPro: isPro)) ...[
                                Text(DifficultyPicker.label(d), style: type.labelLarge.copyWith(color: colors.ink.withValues(alpha: 0.6))),
                                const SizedBox(width: MmSpace.s4),
                                ExcludeSemantics(child: Icon(LucideIcons.lock, size: MmSegmented.lockSize, color: colors.ink.withValues(alpha: 0.6))),
                              ] else
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

/// The before-mock lines, calm and factual: the student's own rule first, then the three things
/// to know in one icon row (the timer keeps running, Submit ends it, silence the phone). One row
/// instead of three stacked notes, so the last line is never cut by the pinned Start key (Design
/// critic 12). The orphan "Water, pencil, rough sheet." line under it is gone (AP3-08, A25): it
/// belonged to no row and told a student what they already knew.
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
