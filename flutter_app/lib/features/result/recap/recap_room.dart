import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The room the recap happens in: the warm charcoal desk at night, the lamp pooling from the
/// upper left, a faint pool of the subject's colour low on the desk, and film grain. Calm results
/// get a dimmer lamp; nothing in the room ever moves.
class RecapRoom extends StatelessWidget {
  const RecapRoom({super.key, required this.child, this.subjectId, this.calm = false});

  final Widget child;
  final String? subjectId;
  final bool calm;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final subject = SubjectLight.forSubject(subjectId == 'gat' ? 'general_test' : subjectId);
    final brightness = Theme.of(context).brightness;
    return Material(
      color: colors.ground,
      child: Stack(
        fit: StackFit.expand,
        children: [
          RepaintBoundary(
            child: LightField(
              pools: [
                LightPool(
                  color: colors.lamp.withValues(alpha: (colors.isNight ? 0.17 : 0.14) * (calm ? 0.7 : 1)),
                  center: const Alignment(-1.1, -1.05),
                  radius: 0.85,
                  aspect: 1.15,
                ),
                if (subject != null)
                  LightPool(
                    color: subject.of(brightness),
                    center: const Alignment(0.7, 0.55),
                    radius: 0.7,
                    strength: colors.isNight ? 0.9 : 0.6,
                  ),
              ],
            ),
          ),
          RepaintBoundary(child: Grain(opacity: colors.grain)),
          child,
        ],
      ),
    );
  }
}
