import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/copy.dart';
import '../../../core/theme/theme.dart';
import '../../you/widgets/you_page.dart' show youText;
import '../../you/widgets/you_row.dart' show IconWell;
import '../credits_copy.dart';
import '../data/credits_models.dart';

/// One line of the history: the pool's glyph, what it was ("Practice set"), the pool as a 12 sp
/// tag with the time, and in the value column the change. Information only; nothing here opens. The
/// pool is said in words, never by colour alone.
///
/// [oneBalance]: the server keeps one credits balance, so there is no pool tag, and the value column adds
/// the server's own balance after the line ("108 left") when it sent one. On an older server no running
/// figure is shown: it is counted per ledger and could disagree with the balance on the card above.
class HistoryRow extends StatelessWidget {
  const HistoryRow({super.key, required this.entry, this.oneBalance = false});

  final CreditEntry entry;
  final bool oneBalance;

  static String changeText(int delta) => delta < 0 ? '$minusSign${delta.abs()}' : '+$delta';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final at = entry.at.toLocal();
    final time = formatTime12(at);
    final left = CreditsCopy.left(entry, oneBalance: oneBalance);
    final tag = CreditsCopy.tag(entry, oneBalance: oneBalance);
    final what = entry.what.isEmpty ? CreditsCopy.whatFallback(entry) : entry.what;
    return Semantics(
      container: true,
      label: CreditsCopy.rowLabel(entry, time, oneBalance: oneBalance),
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText, vertical: MmSpace.s12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconWell(oneBalance ? LucideIcons.wallet : (entry.pool == CreditPool.practice ? LucideIcons.layers : LucideIcons.sparkles)),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(what, style: type.labelLarge.copyWith(fontSize: 16)),
                    const SizedBox(height: MmSpace.s4),
                    // The pool is the row's icon and, in words, this 12 sp tag (never colour
                    // alone); the time rides beside it. The count lives in the value column.
                    // A Wrap, so a narrow phone or large text moves the time under the tag and
                    // never clips either.
                    Wrap(
                      spacing: MmSpace.s8,
                      runSpacing: 2,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (tag != null) _PoolTag(label: tag),
                        Text(time, style: type.caption.copyWith(fontSize: 12, color: colors.ink3)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(changeText(entry.delta), style: type.title.copyWith(color: entry.isSpend ? colors.ink : colors.goodText)),
                  if (left != null) ...[
                    const SizedBox(height: 2),
                    Text(left, style: type.caption.copyWith(fontSize: 12, color: colors.ink2)),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The pool in words at 12 sp: a hairline pill, so the row keeps one voice (the title) and the
/// pool reads without colour.
class _PoolTag extends StatelessWidget {
  const _PoolTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: MmRadius.pillAll, border: Border.all(color: colors.line)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 1),
        child: Text(label, style: context.mmType.caption.copyWith(fontSize: 12, height: 1.3, color: colors.ink2), maxLines: 1),
      ),
    );
  }
}
