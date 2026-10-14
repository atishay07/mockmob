import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// A group of rows on one plain raised surface ([MmSurface.plain]): continuous corners, the room's
/// edge light along the top, and hairlines between the rows inset by
/// [inset]. Never nest a panel in a panel.
class YouPanel extends StatelessWidget {
  const YouPanel({super.key, required this.children, this.inset = MmSpace.gutter, this.margin = youPanelMargin, this.flat = false});

  final List<Widget> children;

  /// No pane at all: the rows sit on the ground between two hairlines. Used where a list should
  /// read as part of the page and not as one more box (Progress and CUET tools on the hub).
  final bool flat;

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
    if (flat) {
      return Padding(
        padding: margin,
        child: DecoratedBox(
          decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: colors.line))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
        ),
      );
    }
    // The ordinary card of the Night Sheet: raised, a top edge light, no border and no shadow
    // (shadows belong under floating things). The rows run edge to edge inside it.
    return Padding(
      padding: margin,
      child: MmSurface.plain(
        padding: EdgeInsets.zero,
        child: MmClip(
          borderRadius: BorderRadius.circular(MmRhythm.plainRadius),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
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
    this.flat = false,
  });

  /// A row on the ground (inside a flat panel): the icon stands bare, the value is a step larger,
  /// and the row's padding is the 4 dp the section titles use.
  final bool flat;

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
      padding: flat ? const EdgeInsets.symmetric(horizontal: 4, vertical: MmSpace.s12) : const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
      child: Row(
        children: [
          if (flat)
            SizedBox.square(dimension: 28, child: Icon(icon, size: 22, color: destructive ? colors.badText : colors.ink))
          else
            IconWell(icon, color: destructive ? colors.badText : null),
          SizedBox(width: flat ? MmSpace.s16 : MmSpace.s12),
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
              child: Text(value!, style: (flat ? type.small : type.caption).copyWith(color: colors.ink2), textAlign: TextAlign.end),
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
/// check glyph) so state never depends on colour alone. [flat] sits the row on the ground at the
/// page's 20 dp margin and draws the switch without the glyph (the thumb's side and the words
/// carry the state).
class YouSwitchRow extends StatelessWidget {
  const YouSwitchRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.note,
    this.hairline = false,
    this.flat = false,
  });

  final String title;
  final String? note;
  final bool value;

  /// Null disables the row.
  final ValueChanged<bool>? onChanged;
  final bool hairline;
  final bool flat;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onChanged != null;
    final toggle = IgnorePointer(child: Switch(value: value, onChanged: enabled ? (_) {} : null));
    return RowFrame(
      onTap: enabled ? () => onChanged!(!value) : null,
      toggled: value,
      hairline: hairline,
      tick: false,
      semanticsLabel: note == null ? title : '$title. $note',
      padding: flat ? const EdgeInsets.symmetric(horizontal: 4, vertical: MmSpace.s12) : const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
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
          ExcludeSemantics(child: flat ? _CleanSwitch(child: toggle) : toggle),
        ],
      ),
    );
  }
}

/// The theme's switch without the glyph inside the thumb.
class _CleanSwitch extends StatelessWidget {
  const _CleanSwitch({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context);
    final t = base.switchTheme;
    return Theme(
      data: base.copyWith(
        switchTheme: SwitchThemeData(
          trackColor: t.trackColor,
          trackOutlineColor: t.trackOutlineColor,
          thumbColor: t.thumbColor,
          overlayColor: t.overlayColor,
        ),
      ),
      child: child,
    );
  }
}

/// A read-only row on the ground: an optional bare icon, a title, a note and a value on the
/// right, with no chevron because nothing opens. Aligned with [YouRow] (flat).
class YouFactRow extends StatelessWidget {
  const YouFactRow({super.key, required this.title, this.icon, this.note, this.value, this.semanticsLabel});

  final IconData? icon;
  final String title;
  final String? note;
  final String? value;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return RowFrame(
      semanticsLabel: semanticsLabel ?? [title, ?note, ?value].join('. '),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: MmSpace.s12),
      child: Row(
        children: [
          if (icon != null) ...[
            SizedBox.square(dimension: 28, child: Icon(icon, size: 22, color: colors.ink)),
            const SizedBox(width: MmSpace.s16),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.labelLarge.copyWith(fontSize: 16)),
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
              constraints: const BoxConstraints(maxWidth: 160),
              child: Text(value!, style: type.small.copyWith(color: colors.ink2), textAlign: TextAlign.end),
            ),
          ],
        ],
      ),
    );
  }
}
