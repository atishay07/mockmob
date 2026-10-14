import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import 'nta_copy.dart';
import 'nta_skin.dart';

enum NtaKeyTone { purple, green, plain }

/// A flat exam key, 48 dp, 10 dp corners: purple for Mark for Review & Next, green for Save &
/// Next and Submit, plain for the rest. A press darkens the fill; nothing moves. The label stays
/// on one line.
class NtaKey extends StatelessWidget {
  const NtaKey({super.key, required this.label, required this.onPressed, this.tone = NtaKeyTone.plain, this.icon, this.iconAfter = false});

  final String label;
  final VoidCallback? onPressed;
  final NtaKeyTone tone;
  final IconData? icon;
  final bool iconAfter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final enabled = onPressed != null;
    final (fill, edge, ink) = switch (tone) {
      NtaKeyTone.purple => (NtaSkin.purple, NtaSkin.purpleEdge, NtaSkin.onBar),
      NtaKeyTone.green => (NtaSkin.green, NtaSkin.greenEdge, NtaSkin.onBar),
      NtaKeyTone.plain => (colors.raised, colors.lineStrong, colors.ink),
    };
    final iconWidget = icon == null ? null : Icon(icon, size: 16, color: enabled ? ink : colors.ink4);
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: Opacity(
        opacity: enabled || tone == NtaKeyTone.plain ? 1 : 0.45,
        child: Material(
          color: fill,
          shape: RoundedRectangleBorder(borderRadius: NtaSkin.keyRadius, side: BorderSide(color: edge)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            splashFactory: NoSplash.splashFactory,
            highlightColor: tone == NtaKeyTone.plain ? colors.raised2 : const Color(0x33000000),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (iconWidget != null && !iconAfter) ...[iconWidget, const SizedBox(width: MmSpace.s4)],
                    // One line at every text size: a long exam label ("Mark for Review & Next")
                    // shrinks a touch at 1.3x rather than wrapping to two lines.
                    Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          label,
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          softWrap: false,
                          style: context.mmType.label.copyWith(
                            color: enabled ? ink : colors.ink4,
                            fontSize: 14,
                            fontWeight: tone == NtaKeyTone.plain ? FontWeight.w600 : FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    if (iconWidget != null && iconAfter) ...[const SizedBox(width: MmSpace.s4), iconWidget],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The exam's keys, fixed at the foot in two rows (section 6): Mark for Review & Next and
/// Clear response, then Previous and Save & Next (Submit Test on the last question).
class NtaActionBar extends StatelessWidget {
  const NtaActionBar({
    super.key,
    required this.isFirst,
    required this.isLast,
    required this.canClear,
    required this.canMark,
    required this.onMarkAndNext,
    required this.onClear,
    required this.onPrevious,
    required this.onSaveAndNext,
  });

  final bool isFirst;
  final bool isLast;
  final bool canClear;
  final bool canMark;
  final VoidCallback onMarkAndNext;
  final VoidCallback onClear;
  final VoidCallback onPrevious;
  final VoidCallback onSaveAndNext;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          border: Border(top: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s12, MmSpace.s8 + inset),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    flex: 11,
                    child: NtaKey(label: NtaCopy.markAndNext, tone: NtaKeyTone.purple, onPressed: canMark ? onMarkAndNext : null),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(
                    flex: 8,
                    child: NtaKey(label: NtaCopy.clearResponse, onPressed: canClear ? onClear : null),
                  ),
                ],
              ),
              const SizedBox(height: MmSpace.s8),
              Row(
                children: [
                  Expanded(
                    flex: 8,
                    child: NtaKey(label: NtaCopy.previous, icon: LucideIcons.chevronLeft, onPressed: isFirst ? null : onPrevious),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(
                    flex: 11,
                    child: NtaKey(
                      label: isLast ? NtaCopy.submitTest : NtaCopy.saveAndNext,
                      tone: NtaKeyTone.green,
                      icon: LucideIcons.chevronRight,
                      iconAfter: true,
                      onPressed: onSaveAndNext,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
