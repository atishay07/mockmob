import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/copy.dart';
import '../../../core/theme/theme.dart';
import '../../you/widgets/you_page.dart' show youText;
import '../../you/widgets/you_row.dart' show IconWell;
import '../credits_copy.dart';
import '../data/credits_models.dart';

/// One line of the history: the pool's glyph, what it was ("Repair, Q7 Accountancy"), the pool
/// and the count in words with what is left, and at the end the change and the time. Information
/// only; nothing here opens. The pool is said in words, never by colour alone.
class HistoryRow extends StatelessWidget {
  const HistoryRow({super.key, required this.entry});

  final CreditEntry entry;

  static String changeText(int delta) => delta < 0 ? '$minusSign${delta.abs()}' : '+$delta';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final at = entry.at.toLocal();
    final time = formatTime12(at);
    final what = entry.what.isEmpty ? CreditsCopy.whatFallback(entry) : entry.what;
    return Semantics(
      container: true,
      label: CreditsCopy.rowLabel(entry, time),
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText, vertical: MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconWell(entry.pool == CreditPool.practice ? LucideIcons.layers : LucideIcons.sparkles),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(what, style: type.labelLarge.copyWith(fontSize: 16)),
                    const SizedBox(height: 2),
                    Text(CreditsCopy.line(entry), style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(changeText(entry.delta), style: type.title.copyWith(color: entry.isSpend ? colors.ink : colors.goodText)),
                  const SizedBox(height: 2),
                  Text(time, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
