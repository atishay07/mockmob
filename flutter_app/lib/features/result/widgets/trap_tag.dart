import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/mistake_lab_traps.dart';
import '../../../core/theme/theme.dart';

/// The trap named under the student's own wrong option in an opened answer (Mistake Lab v4 slice
/// 4, spec 4.7 second part): "Trap: a look-alike term", with where the name comes from in small
/// text ("Named by Mistake Repair" or "From the question format") and, for a format trap, the one
/// sentence that says why ("This option and the key agree on both statements; only the link
/// differs."). Every sentence arrives finished from the server; the tag never claims a cause and
/// never names the student's mind.
///
/// It is one more row under the option's text, set off by a hairline: it adds height and never
/// covers anything. The icon and the words carry it, never colour alone.
class TrapTagView extends StatelessWidget {
  const TrapTagView({super.key, required this.trap});

  final TrapTag trap;

  /// What a screen reader hears for the tag: the trap, its one sentence and where the name is from.
  static String spokenOf(TrapTag t) {
    String sentence(String s) => s.endsWith('.') ? s.substring(0, s.length - 1) : s;
    return [sentence(t.text), if (t.detail != null) sentence(t.detail!), if (t.sourceText != null) sentence(t.sourceText!)].join('. ');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.triangleAlert, size: 15, color: colors.warnText)),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(trap.text, style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                  if (trap.detail != null) ...[
                    const SizedBox(height: MmSpace.s2),
                    Text(trap.detail!, style: type.small.copyWith(color: colors.ink2)),
                  ],
                  if (trap.sourceText != null) ...[
                    const SizedBox(height: MmSpace.s2),
                    Text(trap.sourceText!, style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
