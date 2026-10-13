import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A group of rows on one solid raised pane (the work layer): continuous corners, the room's
/// edge light along the top with the lamp's warm catch, and hairlines between the rows inset by
/// [inset]. Never nest a panel in a panel.
class YouPanel extends StatelessWidget {
  const YouPanel({super.key, required this.children, this.inset = MmSpace.gutter, this.margin = youPanelMargin});

  final List<Widget> children;

  /// Where the hairline between two rows starts (64 lines up with text beside an icon well).
  final double inset;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) {
        rows.add(Padding(
          padding: EdgeInsets.only(left: inset),
          child: SizedBox(height: 1, child: ColoredBox(color: colors.line)),
        ));
      }
      rows.add(children[i]);
    }
    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.panelAll), shadows: colors.cardShadow),
        child: CustomPaint(
          foregroundPainter: EdgeLightPainter(
            borderRadius: MmRadius.panelAll,
            top: colors.edgeTop,
            bottom: colors.edgeBottom,
            lamp: colors.isNight ? colors.lamp : null,
            sheen: false,
          ),
          child: MmClip(
            borderRadius: MmRadius.panelAll,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
          ),
        ),
      ),
    );
  }
}

/// The outer margin of a [YouPanel].
const EdgeInsets youPanelMargin = EdgeInsets.symmetric(horizontal: MmSpace.gutter);

/// A full-width pressable row inside a panel: the pressed fill deepens toward raised 2 (no
/// ripple), the row sinks a touch, keyboard focus draws the ring. [onTap] null means the row is
/// information only. [hairline] is kept for callers outside a panel.
class RowFrame extends ConsumerWidget {
  const RowFrame({
    super.key,
    required this.child,
    this.onTap,
    this.semanticsLabel,
    this.toggled,
    this.hairline = false,
    this.tick = true,
    this.padding = const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  /// Set for a switch row so TalkBack says "on" or "off".
  final bool? toggled;
  final bool hairline;

  /// Fire the selection haptic when the row is activated.
  final bool tick;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    Widget frame(bool pressed) => DecoratedBox(
          decoration: BoxDecoration(
            color: pressed ? (colors.isNight ? colors.raised2 : colors.sunken) : Colors.transparent,
            border: hairline ? Border(bottom: BorderSide(color: colors.line)) : null,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(padding: padding, child: Align(alignment: Alignment.centerLeft, widthFactor: 1, child: child)),
          ),
        );

    if (onTap == null) {
      if (semanticsLabel == null) return frame(false);
      return Semantics(container: true, label: semanticsLabel, excludeSemantics: true, child: frame(false));
    }

    void activate() {
      if (tick) ref.read(hapticsProvider).selection();
      onTap!();
    }

    // One node for TalkBack: the row's words, button or switch, and the tap.
    return Semantics(
      container: true,
      button: toggled == null,
      toggled: toggled,
      label: semanticsLabel,
      onTap: activate,
      excludeSemantics: semanticsLabel != null,
      child: MmPressable(
        pressedScale: 0.985,
        focusRadius: MmRadius.smallAll,
        onTap: activate,
        builder: (context, pressed, _) => frame(pressed),
      ),
    );
  }
}

/// The round well an icon sits in at the start of a row: raised 2 on Night, sunken paper on
/// Daylight. 36 dp, icons 18 dp.
class IconWell extends StatelessWidget {
  const IconWell(this.icon, {super.key, this.color});

  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(shape: BoxShape.circle, color: colors.isNight ? colors.raised2 : colors.sunken),
      child: SizedBox.square(dimension: 36, child: Icon(icon, size: 18, color: color ?? colors.ink2)),
    );
  }
}

/// A navigation row: an icon well, a title, an optional note, an optional value on the right
/// and a quiet chevron (or the external glyph for a page that opens outside the app).
class YouRow extends StatelessWidget {
  const YouRow({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.note,
    this.value,
    this.external = false,
    this.hairline = false,
    this.destructive = false,
  });

  final IconData icon;
  final String title;
  final String? note;

  /// A short live fact on the right ("Night", "On").
  final String? value;
  final VoidCallback onTap;
  final bool external;
  final bool hairline;

  /// The title reads in the bad-text colour (Delete account).
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final label = [title, ?note, ?value].join('. ');
    return RowFrame(
      onTap: onTap,
      hairline: hairline,
      semanticsLabel: label,
      child: Row(
        children: [
          IconWell(icon, color: destructive ? colors.badText : null),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.labelLarge.copyWith(fontSize: 16, color: destructive ? colors.badText : colors.ink)),
                if (note != null) ...[
                  const SizedBox(height: 2),
                  Text(note!, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          if (value != null) ...[
            const SizedBox(width: MmSpace.s8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 140),
              child: Text(value!, style: type.caption.copyWith(color: colors.ink2), textAlign: TextAlign.end),
            ),
          ],
          const SizedBox(width: MmSpace.s8),
          Icon(external ? LucideIcons.externalLink : LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
      ),
    );
  }
}

/// A switch row. The whole row toggles; the switch is drawn by the theme (volt on, with a
/// check glyph) so state never depends on colour alone.
class YouSwitchRow extends StatelessWidget {
  const YouSwitchRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.note,
    this.hairline = false,
  });

  final String title;
  final String? note;
  final bool value;

  /// Null disables the row.
  final ValueChanged<bool>? onChanged;
  final bool hairline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onChanged != null;
    return RowFrame(
      onTap: enabled ? () => onChanged!(!value) : null,
      toggled: value,
      hairline: hairline,
      tick: false,
      semanticsLabel: note == null ? title : '$title. $note',
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.labelLarge.copyWith(fontSize: 16, color: enabled ? colors.ink : colors.ink3)),
                if (note != null) ...[
                  const SizedBox(height: 2),
                  Text(note!, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s16),
          ExcludeSemantics(child: IgnorePointer(child: Switch(value: value, onChanged: enabled ? (_) {} : null))),
        ],
      ),
    );
  }
}
