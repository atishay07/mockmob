import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// The tab of the sealed sheet (spec 5.6.2): a volt pill, 56 by 200 dp. Tapping opens with a scripted lift; dragging is handled by the stage.
class OpenTab extends StatelessWidget {
  const OpenTab({super.key, required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: ResultCopy.openTab,
      builder: (context, pressed, focused) => SizedBox(
        width: 200,
        height: MmTarget.primaryKey,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            shape: const StadiumBorder(),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color.lerp(colors.volt, Colors.white, pressed ? 0.04 : 0.14)!, colors.volt],
            ),
            shadows: [
              BoxShadow(color: colors.voltGlow, blurRadius: 24, offset: const Offset(0, 8), spreadRadius: -6),
              const BoxShadow(color: Color(0x40000000), blurRadius: 2, offset: Offset(0, 1)),
            ],
          ),
          child: Center(child: Text(ResultCopy.openTab, style: type.button.copyWith(color: colors.voltInk))),
        ),
      ),
    );
  }
}
