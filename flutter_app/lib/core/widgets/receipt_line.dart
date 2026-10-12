import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../copy/state_words.dart';
import '../theme/theme.dart';

/// The one plain line that ends a finished task and says what was recorded and when (spec 7).
/// Show a recorded line only after the server acknowledged; until then use [ReceiptLine.pending].
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
            child: Icon(recorded ? LucideIcons.check : LucideIcons.smartphone, size: 16, color: colors.ink2),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: Text(text, style: type.small.copyWith(color: colors.ink2))),
        ],
      ),
    );
  }
}
