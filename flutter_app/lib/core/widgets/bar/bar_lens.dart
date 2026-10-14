import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../../theme/theme.dart';

/// The lens's colours per theme (DOCK.md section 4). No volt arc: the light is in the icon's
/// inked bubble, the lens is only glass.
@immutable
class BarLensStyle {
  const BarLensStyle({required this.fill, required this.edge, this.hairline, this.shadow});

  final Color fill;

  /// The 1 dp top edge (fades to nothing by mid-height).
  final Color edge;
  final Color? hairline;
  final Color? shadow;

  factory BarLensStyle.of(MmColors colors) => colors.isNight
      ? const BarLensStyle(fill: Color(0x1AF4F0E6), edge: Color(0x2EFFFFFF))
      : const BarLensStyle(fill: Color(0xFFFFFFFF), edge: Color(0xE6FFFFFF), hairline: Color(0xFFD8D1C2), shadow: Color(0x1A17150F));

  @override
  bool operator ==(Object other) =>
      other is BarLensStyle && other.fill == fill && other.edge == edge && other.hairline == hairline && other.shadow == shadow;

  @override
  int get hashCode => Object.hash(fill, edge, hairline, shadow);
}

/// The bar's active indicator, painted between its two edges ([left] and [right], in px from
/// the bar's left edge). While the edges are apart (travelling) the lens stretches and thins
/// up to 8%, so it reads as a drop of light, not a sliding block. [collapse] (0 to 1) follows
/// the bar's compact state: the lens shrinks from 52 to 40 dp tall with the bar. No layout per
/// frame; this painter sits in its own repaint boundary.
class BarLensPainter extends CustomPainter {
  BarLensPainter({
    required this.left,
    required this.right,
    required this.collapse,
    required this.restWidth,
    required this.style,
  }) : super(repaint: Listenable.merge([left, right, collapse]));

  final Animation<double> left;
  final Animation<double> right;
  final Animation<double> collapse;

  /// The lens's width at rest (a tab slot minus 4).
  final double restWidth;
  final BarLensStyle style;

  /// The lens rect inside a bar box of [size] (the bar's full 64 dp box, bottom anchored).
  static RRect lensRect({required double left, required double right, required double collapse, required double restWidth, required Size size}) {
    final l = left < right ? left : right;
    final r = left < right ? right : left;
    final barHeight = MmBar.height - (MmBar.height - MmBar.compactHeight) * collapse;
    final full = barHeight - 2 * MmBar.pad;
    final width = r - l;
    final stretch = restWidth <= 0 ? 0.0 : (width / restWidth - 1).clamp(0.0, 1.0);
    final height = full * (1 - 0.08 * stretch);
    final barTop = size.height - barHeight;
    final top = barTop + (barHeight - height) / 2;
    return RRect.fromRectAndRadius(Rect.fromLTWH(l, top, width, height), Radius.circular(height / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = lensRect(left: left.value, right: right.value, collapse: collapse.value, restWidth: restWidth, size: size);
    final shadow = style.shadow;
    if (shadow != null) {
      canvas.drawRRect(
        rrect.shift(const Offset(0, 1)),
        Paint()
          ..color = shadow
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5),
      );
    }
    canvas.drawRRect(rrect, Paint()..color = style.fill);
    final hairline = style.hairline;
    if (hairline != null) {
      canvas.drawRRect(
        rrect.deflate(0.25),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.5
          ..color = hairline,
      );
    }
    // The top edge light: bright on the upper rim, gone by mid-height.
    final bounds = rrect.outerRect;
    canvas.drawRRect(
      rrect.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = ui.Gradient.linear(
          bounds.topCenter,
          bounds.center,
          [style.edge, style.edge.withValues(alpha: 0)],
        ),
    );
  }

  @override
  bool shouldRepaint(BarLensPainter old) =>
      old.left != left || old.right != right || old.collapse != collapse || old.restWidth != restWidth || old.style != style;
}
