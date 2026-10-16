import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The way from a claim to its evidence: a plain text button in the accent text colour, 48 dp
/// tall, with no arrow after it (AP3-05, A11). It names what opens ("See the 6 questions"), so it
/// needs no arrow, dots or pill to say what it is. It sits flush with the text above it, and sinks
/// to 0.96 under the finger like every key.
///
/// When [onTap] returns a future (it opens a sheet and the future is the sheet's close), the row
/// stays lit, in full ink, while that sheet is up: the evidence rises out of the row it came from,
/// and the row is where the student lands when it goes back down (MOTION 3, C4 item 6).
class EvidenceLink extends StatefulWidget {
  const EvidenceLink({super.key, required this.label, required this.onTap, this.icon});

  final String label;
  final FutureOr<void> Function() onTap;

  /// A quiet glyph after the label, for an explanation (the info mark of "Why this?"). Never an
  /// arrow: a link that leads to evidence is the words alone.
  final IconData? icon;

  @override
  State<EvidenceLink> createState() => _EvidenceLinkState();
}

class _EvidenceLinkState extends State<EvidenceLink> {
  bool _open = false;

  void _tap() {
    final result = widget.onTap();
    if (result is! Future<void>) return;
    setState(() => _open = true);
    unawaited(
      result.whenComplete(() {
        if (mounted) setState(() => _open = false);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = widget.label;
    final icon = widget.icon;
    return MmPressable(
      onTap: _tap,
      semanticsLabel: label,
      focusRadius: MmRadius.smallAll,
      builder: (context, pressed, _) {
        final dim = pressed;
        // Accent text at rest, quiet under the finger, full ink while its sheet is up.
        final color = dim ? colors.ink2 : (_open ? colors.ink : colors.accentText);
        return ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: AnimatedDefaultTextStyle(
                  duration: Motion.of(context, Motion.press),
                  curve: Motion.out,
                  style: type.labelLarge.copyWith(color: color, fontWeight: FontWeight.w600),
                  child: Text(label),
                ),
              ),
              if (icon != null) ...[
                const SizedBox(width: MmSpace.s8),
                Icon(icon, size: 18, color: dim ? colors.ink2 : colors.ink3),
              ],
            ],
          ),
        );
      },
    );
  }
}
