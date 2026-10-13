import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/practice_selection.dart';

/// How many questions: 5, 10, 15 or 20 and nothing else, on the glass segmented control.
class LengthPicker extends StatelessWidget {
  const LengthPicker({super.key, required this.count, required this.onChanged});

  final int count;
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
          segments: [for (final c in practiceCounts) MmSegment(c, '$c')],
          value: count,
          onChanged: onChanged,
        ),
      ],
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
    Widget line(String text) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(padding: EdgeInsets.only(top: 6), child: Bubble(state: BubbleState.hollow, size: 8, animate: false)),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink))),
            ],
          ),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        line(PracticeCopy.sheetMarking),
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
