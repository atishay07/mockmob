import 'package:flutter/material.dart';

import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';

/// A quiet text key set flush with the page's left edge, so its label lines up with the copy
/// above it (the key itself carries 16 dp of inner padding). With an [icon], the glyph sits on
/// that edge and the label follows it; either way the tap area is the full 48 dp key.
class QuietAction extends StatelessWidget {
  const QuietAction({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  static const double _iconSize = 16;
  static const double _gap = MmSpace.s8;

  @override
  Widget build(BuildContext context) {
    final key = KeyButton.quiet(label: label, onPressed: onPressed);
    final Widget child;
    if (icon == null) {
      child = Transform.translate(
        offset: const Offset(-MmSpace.s16, 0),
        child: key,
      );
    } else {
      // The label starts one icon and one gap in; the key's own padding supplies the rest.
      final colors = context.mmColors;
      child = Stack(
        children: [
          Padding(
            padding: const EdgeInsets.only(
              left: _iconSize + _gap - MmSpace.s16,
            ),
            child: key,
          ),
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: _iconSize,
            child: ExcludeSemantics(
              child: IgnorePointer(
                child: Center(
                  child: Icon(
                    icon,
                    size: _iconSize,
                    color: onPressed == null ? colors.ink4 : colors.accentText,
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }
    return Align(alignment: Alignment.centerLeft, child: child);
  }
}
