import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../copy/state_words.dart';
import '../theme/theme.dart';

/// The one plain line that ends a finished task and says what was recorded and when. A recorded
/// line leads with a check (the server has it); a pending one with a phone glyph (only on this
/// phone). Show a recorded line only after the server acknowledged.
class ReceiptLine extends StatelessWidget {
  const ReceiptLine({super.key, required this.text, this.recorded = true});

  /// "On this phone. Not recorded yet."
  const ReceiptLine.pending({super.key})
      : text = Receipts.notRecordedYet,
        recorded = false;

  final String text;

  /// True after server acknowledgment; false while the work is only on this phone.
  final bool recorded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: text,
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(recorded ? LucideIcons.circleCheck : LucideIcons.smartphone, size: 16, color: colors.ink.withValues(alpha: 0.7)),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}
