import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../sheet/open_tab.dart';

/// The words at the top of the sealed screen, on the same line as the open sheet's headline (so
/// the headline does not move when the sheet opens). They fade as the flap lifts.
class SealedHeadline extends StatelessWidget {
  const SealedHeadline({super.key, required this.model});

  final RecapModel model;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(ResultCopy.sheetBack, style: type.moment, maxLines: 2),
        const SizedBox(height: MmSpace.s8),
        Text(ResultCopy.openWhenReady, style: type.body.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The tab and the plain way past the reveal. The tab lifts with the flap and fades as it goes.
class SealedControls extends StatelessWidget {
  const SealedControls({super.key, required this.open, required this.onOpen, required this.onWithoutReveal, this.bottomInset = 0});

  final Animation<double> open;
  final VoidCallback? onOpen;
  final VoidCallback onWithoutReveal;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    return Padding(
      // The tab's lower edge sits 96 dp above the screen's bottom edge, clear of the gesture bar,
      // and it runs the full width of the card's gutters like the key on every other card.
      padding: EdgeInsets.fromLTRB(MmSpace.cardGutter, 0, MmSpace.cardGutter, (96 - MmTarget.min - 4 - bottomInset).clamp(0.0, 96.0)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AnimatedBuilder(
            animation: open,
            builder: (context, child) {
              // It fades and sinks a little as the flap lifts, away from the sheet: it never
              // travels up over the sheet's lower edge.
              final p = open.value;
              return Transform.translate(
                offset: Offset(0, (p * 180).clamp(0.0, 10.0)),
                child: Opacity(opacity: (1 - p * 3).clamp(0.0, 1.0), child: child),
              );
            },
            child: OpenTab(onTap: onOpen),
          ),
          const SizedBox(height: MmSpace.s4),
          Align(child: KeyButton.quiet(label: ResultCopy.openWithoutReveal, onPressed: onWithoutReveal)),
        ],
      ),
    );
  }
}

/// Keeps both bottom states laid out (so the sheet never jumps) and shows one.
class KeepLaidOut extends StatelessWidget {
  const KeepLaidOut({super.key, required this.visible, required this.child, this.opacity});

  final bool visible;
  final Widget child;
  final Animation<double>? opacity;

  @override
  Widget build(BuildContext context) {
    Widget c = child;
    if (visible && opacity != null) c = FadeTransition(opacity: opacity!, child: c);
    return Visibility(visible: visible, maintainState: true, maintainAnimation: true, maintainSize: true, child: c);
  }
}
