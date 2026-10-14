import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The way from a claim to its evidence: a plain line of text with an arrow, in the volt of the
/// one accent, 48 dp tall. It names what opens ("See the 6 questions"), so it needs no dots or
/// pill to say what it is. It sits flush with the text above it.
///
/// When [onTap] returns a future (it opens a sheet and the future is the sheet's close), the row
/// stays lit while that sheet is up: the evidence rises out of the row it came from, and the row
/// is where the student lands when it goes back down (MOTION 3, C4 item 6).
class EvidenceLink extends StatefulWidget {
  const EvidenceLink({super.key, required this.label, required this.onTap, this.icon = LucideIcons.arrowRight});

  final String label;
  final FutureOr<void> Function() onTap;

  /// The icon after the label: an arrow when it leads to evidence, something else for a quiet
  /// explanation.
  final IconData icon;

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
        return ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  style: type.labelLarge.copyWith(color: dim ? colors.ink2 : colors.ink, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              // Volt is a fill on Night; as a stroke on the ground it is the olive on Daylight.
              AnimatedRotation(
                turns: _open ? 0.25 : 0,
                duration: Motion.of(context, Motion.ui),
                curve: Motion.emphasized,
                child: Icon(icon, size: 18, color: dim ? colors.ink2 : (icon == LucideIcons.arrowRight ? colors.accentText : colors.ink3)),
              ),
            ],
          ),
        );
      },
    );
  }
}
