import 'package:flutter/material.dart';

import '../art/art.dart';
import '../theme/theme.dart';
import 'materials/edge_light.dart';
import 'materials/light_field.dart';
import 'materials/shape.dart';
import 'pressable.dart';

/// The one subject tile (SPACING.md 8.4, audit G12). Practice tiles, the You subject tiles, the
/// core subject grid and hero tiles used three different plates (a white card with art, a tinted
/// gradient tile, a dark field tile); this is the single one: a plain card (24 dp corners,
/// hairline, Night edge light or Day card shadow) with the subject's light field pooled in the
/// upper right, the emblem unframed on it, and the name at the bottom left on the card's text
/// edge. Subject art always sits on its field, never on bare ground, on both themes.
///
/// Selected is the strongest thing in the grid on both themes: a 2 dp ink border on
/// `selectedSurface` (Night `raised2`, Day `raised`, never Day's darker `raised2`).
class SubjectPlate extends StatelessWidget {
  const SubjectPlate({
    super.key,
    required this.subject,
    this.label,
    this.selected = false,
    this.onTap,
    this.height = 104,
    this.semanticsLabel,
  });

  /// Any subject id the app meets (`accountancy`, `business_studies`, `gat`, ...).
  final String? subject;

  /// The name under the emblem. Defaults to the subject's own name.
  final String? label;
  final bool selected;

  /// Null makes the plate a plain, non-interactive tile.
  final VoidCallback? onTap;
  final double height;
  final String? semanticsLabel;

  /// Space between the card edge and the name, and from the right edge to the emblem.
  static const double inset = MmSpace.s12;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final identity = SubjectIdentity.of(subject);
    final name = label ?? identity?.name ?? '';
    final light = SubjectLight.forSubject(subject);
    final radius = BorderRadius.circular(MmRadius.panel);
    final fill = selected ? colors.selectedSurface : colors.raised;

    Widget face(bool pressed) => SizedBox(
          height: height,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              color: fill,
              shape: mmShapeBorder(radius, side: selected ? BorderSide(color: colors.ink, width: 2) : BorderSide(color: colors.line)),
              shadows: colors.isNight ? null : colors.cardShadow,
            ),
            child: CustomPaint(
              foregroundPainter: EdgeLightPainter(
                borderRadius: radius,
                top: colors.edgeTop,
                bottom: colors.edgeBottom.withValues(alpha: 0),
                sheen: false,
                boost: pressed ? 1.6 : 1,
              ),
              child: MmClip(
                borderRadius: radius,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (light != null)
                      LightField.subject(
                        context,
                        light,
                        // The field's centre sits behind the emblem, upper right (SPACING.md 8.4).
                        center: const Alignment(0.78, -0.78),
                        strength: colors.isNight ? 1.15 : 0.95,
                      ),
                    Positioned(
                      top: inset,
                      right: inset,
                      child: SubjectEmblem(subject: subject, size: EmblemSizes.tile, framed: false),
                    ),
                    Positioned(
                      left: inset,
                      right: inset,
                      bottom: inset,
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: type.label.copyWith(fontSize: 12, fontWeight: FontWeight.w600, color: colors.ink),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

    if (onTap == null) return Semantics(container: true, label: semanticsLabel ?? name, child: face(false));
    return MmPressable(
      semanticsLabel: semanticsLabel ?? name,
      selected: selected,
      focusRadius: radius,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => face(pressed),
    );
  }
}
