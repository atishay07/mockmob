import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_skin.dart';

/// The exam's submit summary (an app addition the real exam has): the confirm sentence, then a
/// table of the section with every state's count, from the session itself.
class NtaSubmitSummary extends StatelessWidget {
  const NtaSubmitSummary({super.key, required this.session, this.showConfirm = true});

  final RunnerSession session;

  /// The "You have 5 unanswered questions ..." line; off once the submit has started.
  final bool showConfirm;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final bar = NtaBarColors.of(context);
    final counts = NtaCounts.of(sheetCellsOf(session));
    final subject = NtaCopy.subject(session.subject);

    Widget row(String label, int value, {NtaChipState? glyph, bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s8),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: glyph == null ? null : Align(alignment: Alignment.centerLeft, child: NtaChip(state: glyph, label: '', size: const Size(24, 22))),
          ),
          Expanded(child: Text(label, style: (strong ? type.labelLarge : type.body).copyWith(color: colors.ink))),
          Text('$value', style: type.labelLarge.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
        ],
      ),
    );

    final table = DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedRectangleBorder(borderRadius: NtaSkin.radiusAll, side: BorderSide(color: colors.line)),
        shadows: colors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
            decoration: BoxDecoration(
              color: bar.band,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(NtaSkin.radius)),
            ),
            child: Row(
              children: [
                Expanded(child: Text(NtaCopy.summaryTitle, style: type.label.copyWith(color: bar.onBand))),
                Text('${NtaCopy.section}: $subject', style: type.label.copyWith(color: bar.onBand2)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s8),
          row(NtaCopy.total, counts.total, strong: true),
          Divider(height: MmSpace.s8, thickness: 1, color: colors.line, indent: MmSpace.s16, endIndent: MmSpace.s16),
          for (final s in NtaChipState.values) row(s.label, counts[s], glyph: s),
          const SizedBox(height: MmSpace.s8),
        ],
      ),
    );

    return Semantics(
      container: true,
      label: NtaCopy.summarySemantics(subject),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showConfirm) ...[
            Text(
              NtaCopy.confirmLine(pending: counts.pending, marked: counts.markedAll),
              style: type.body.copyWith(color: colors.ink2),
            ),
            const SizedBox(height: MmSpace.s16),
          ],
          table,
        ],
      ),
    );
  }
}
