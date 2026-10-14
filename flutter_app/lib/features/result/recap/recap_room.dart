import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The room the recap happens in: the warm charcoal desk at night, one pool of lamp light from
/// the upper left falling off to the bare ground, and film grain. Calm results get a dimmer
/// lamp; nothing in the room ever moves.
class RecapRoom extends StatelessWidget {
  const RecapRoom({super.key, required this.child, this.subjectId, this.calm = false});

  final Widget child;
  final String? subjectId;
  final bool calm;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Material(
      color: colors.ground,
      child: Stack(
        fit: StackFit.expand,
        children: [
          LampScene(strength: calm ? 0.7 : 1),
          RepaintBoundary(child: Grain(opacity: colors.grain)),
          child,
        ],
      ),
    );
  }
}
