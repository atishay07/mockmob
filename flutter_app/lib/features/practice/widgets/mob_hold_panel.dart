import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/models.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// "in 5 days", "in 3 hours", "in 20 minutes": how long until a held Mob paper's answers open. The same steps as the
/// website (src/lib/mob/paperHold.mjs opensIn), never a false precision.
String opensIn(DateTime until, DateTime now) {
  final left = until.difference(now);
  if (left <= Duration.zero) return 'in a moment';
  if (left >= const Duration(days: 2)) return 'in ${left.inDays} days';
  if (left >= const Duration(days: 1)) return 'in a day';
  if (left >= const Duration(hours: 2)) return 'in ${left.inHours} hours';
  if (left >= const Duration(hours: 1)) return 'in an hour';
  final minutes = (left.inSeconds / 60).ceil().clamp(1, 59);
  return minutes == 1 ? 'in a minute' : 'in $minutes minutes';
}

/// The words the panel says, from the server's own sentences, with plain fallbacks for a payload that has none.
abstract final class MobHoldCopy {
  static const fallbackTitle = 'The answers open when the paper closes';
  static const fallbackLine =
      'This paper stays open for your Mob until it closes, so its answers and explanations stay closed until then and nobody can pass them on. Then you can see every answer, fix your mistakes and compare with your Mob.';
  static String when(String inWords) => 'They open $inWords, right here on this page.';
  static const openNow = 'The answers are open now.';
  static const showAnswers = 'Show the answers';
}

/// A Mob paper's result while the Mob is still sitting it (C-dec 2 item 1): in place of the answers, one plain block that
/// says when they open and why. A hairline block with the lock in a quiet volt disc, never another card. When the moment
/// has passed and this phone still holds the held copy, the block says the answers are open and offers to load them.
class MobHoldPanel extends StatelessWidget {
  const MobHoldPanel({super.key, required this.hold, required this.now, this.onReload});

  final MobHold hold;
  final DateTime now;
  final VoidCallback? onReload;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final open = hold.isOpenAt(now);
    final title = hold.title.isNotEmpty ? hold.title : MobHoldCopy.fallbackTitle;
    final line = hold.line.isNotEmpty ? hold.line : MobHoldCopy.fallbackLine;
    return Semantics(
      container: true,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: colors.line), bottom: BorderSide(color: colors.line)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: colors.accentText.withValues(alpha: 0.08),
                  border: Border.all(color: colors.accentText.withValues(alpha: 0.45)),
                ),
                child: Icon(open ? LucideIcons.lockOpen : LucideIcons.lock, size: 20, color: colors.accentText),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(open ? MobHoldCopy.openNow : title, style: type.cardTitle.copyWith(color: colors.ink))),
                  const SizedBox(height: MmSpace.s8),
                  if (!open) ...[
                    Text(line, style: type.body.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: ExcludeSemantics(child: Icon(LucideIcons.clock, size: 15, color: colors.ink3)),
                        ),
                        const SizedBox(width: MmSpace.s8),
                        Expanded(child: Text(MobHoldCopy.when(opensIn(hold.until, now)), style: type.small.copyWith(color: colors.ink3))),
                      ],
                    ),
                  ] else if (onReload != null)
                    KeyButton.secondary(label: MobHoldCopy.showAnswers, expanded: false, minHeight: 48, onPressed: onReload),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
