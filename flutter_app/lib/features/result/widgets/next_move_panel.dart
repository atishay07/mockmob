import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../layers_copy.dart';
import '../model/next_move.dart';

/// Layer 2 of the result (RESULT-1017 4.3, 4.4): why the one next move is the one. Its heading names the reason
/// ("Why Q42 first"), then one line on why, and for a repair one line on what the student gets before paying. The key
/// itself is the volt in the pinned foot (the app's thumb-reach rule), so this panel holds no button and the screen
/// keeps one volt. The quieter way out is one underlined text action.
class NextMovePanel extends StatelessWidget {
  const NextMovePanel({super.key, required this.move, this.onAlt});

  final ResultMove move;

  /// The alternative's action; null leaves the line out (nothing it could open).
  final VoidCallback? onAlt;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = move;
    final value = m.value;
    return Semantics(
      container: true,
      child: MmSurface.plain(
        // No drop shadow on Day: the one raised card on a page of flat sections stood a step above the rest (v15 walk).
        flat: true,
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(header: true, child: Text(LayersCopy.whyTitle(m), style: type.cardTitle.copyWith(fontSize: 16))),
            const SizedBox(height: MmSpace.s6),
            Text(m.why, style: type.body.copyWith(color: colors.ink)),
            if (value != null) ...[
              const SizedBox(height: MmSpace.s12),
              Divider(height: 1, thickness: 1, color: colors.line),
              const SizedBox(height: MmSpace.s12),
              // The four parts in ink, the lead quieter: what a repair gives is the point of the line.
              Text.rich(
                TextSpan(
                  children: [
                    if (value.startsWith(repairValueLead)) ...[
                      TextSpan(text: repairValueLead, style: TextStyle(color: colors.ink2)),
                      TextSpan(text: value.substring(repairValueLead.length)),
                    ] else
                      TextSpan(text: value),
                  ],
                ),
                style: type.body.copyWith(color: colors.ink),
              ),
            ],
            if (m.note != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(m.note!, style: type.small.copyWith(color: colors.ink2)),
            ],
            if (m.late != null) ...[
              const SizedBox(height: MmSpace.s8),
              Text(m.late!, style: type.small.copyWith(color: colors.ink2)),
            ],
            if (m.alt != null && onAlt != null) ...[
              const SizedBox(height: MmSpace.s4),
              TextAction(label: m.alt!.label, onTap: onAlt!),
              if (m.alt!.detail != null) Text(m.alt!.detail!, style: type.small.copyWith(color: colors.ink2)),
            ],
          ],
        ),
      ),
    );
  }
}

/// An underlined text action, 48 dp tall: the quiet way out beside a volt key. No arrow, no icon.
class TextAction extends StatelessWidget {
  const TextAction({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Align(
      alignment: Alignment.centerLeft,
      child: MmPressable(
        onTap: onTap,
        pressedScale: 0.97,
        focusRadius: MmRadius.smallAll,
        haptic: MmPressHaptic.selection,
        semanticsLabel: label,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Align(
            alignment: Alignment.centerLeft,
            widthFactor: 1,
            child: Text(
              label,
              style: context.mmType.small.copyWith(
                color: colors.ink,
                fontWeight: FontWeight.w600,
                decoration: TextDecoration.underline,
                decorationColor: colors.ink3,
                decorationThickness: 1.4,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
