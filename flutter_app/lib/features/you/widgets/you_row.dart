import 'package:flutter/gestures.dart' show kTouchSlop;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';

/// A full-width pressable list row with the app's pressed fill (no ripple), a focus ring and a
/// hairline under it. [onTap] null means the row is information only.
class RowFrame extends ConsumerStatefulWidget {
  const RowFrame({
    super.key,
    required this.child,
    this.onTap,
    this.semanticsLabel,
    this.toggled,
    this.hairline = true,
    this.tick = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  /// Set for a switch row so TalkBack says "on" or "off".
  final bool? toggled;
  final bool hairline;

  /// Fire the `tick` haptic when the row is activated.
  final bool tick;

  @override
  ConsumerState<RowFrame> createState() => _RowFrameState();
}

class _RowFrameState extends ConsumerState<RowFrame> {
  bool _pressed = false;
  bool _focused = false;
  Offset _downAt = Offset.zero;

  void _activate() {
    if (widget.onTap == null) return;
    if (widget.tick) ref.read(hapticsProvider).tick();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final interactive = widget.onTap != null;

    Widget row = DecoratedBox(
      decoration: BoxDecoration(
        color: _pressed ? colors.sunken : Colors.transparent,
        border: widget.hairline ? Border(bottom: BorderSide(color: colors.line)) : null,
      ),
      child: Container(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
        foregroundDecoration: _focused
            ? BoxDecoration(border: Border.all(color: colors.focusRing, width: 2))
            : null,
        child: widget.child,
      ),
    );

    if (!interactive) return row;

    row = FocusableActionDetector(
      onShowFocusHighlight: (value) => setState(() => _focused = value),
      mouseCursor: SystemMouseCursors.click,
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          _activate();
          return null;
        }),
      },
      child: Listener(
        onPointerDown: (e) {
          _downAt = e.position;
          setState(() => _pressed = true);
        },
        onPointerMove: (e) {
          if (_pressed && (e.position - _downAt).distance > kTouchSlop) setState(() => _pressed = false);
        },
        onPointerUp: (_) => setState(() => _pressed = false),
        onPointerCancel: (_) => setState(() => _pressed = false),
        child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: _activate, child: row),
      ),
    );

    return Semantics(
      button: widget.toggled == null,
      toggled: widget.toggled,
      container: true,
      label: widget.semanticsLabel,
      excludeSemantics: widget.semanticsLabel != null,
      onTap: _activate,
      child: row,
    );
  }
}

/// A navigation row: an icon, a title, an optional one-line note and a trailing glyph.
class YouRow extends StatelessWidget {
  const YouRow({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.note,
    this.external = false,
    this.hairline = true,
  });

  final IconData icon;
  final String title;
  final String? note;
  final VoidCallback onTap;

  /// Opens outside the app (a Custom Tab): shows the external glyph instead of the chevron.
  final bool external;
  final bool hairline;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return RowFrame(
      onTap: onTap,
      hairline: hairline,
      semanticsLabel: note == null ? title : '$title. $note',
      child: Row(
        children: [
          Icon(icon, size: 24, color: colors.ink2),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.subhead),
                if (note != null) ...[
                  const SizedBox(height: 2),
                  Text(note!, style: type.small.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Icon(external ? LucideIcons.externalLink : LucideIcons.chevronRight, size: 18, color: colors.ink3),
        ],
      ),
    );
  }
}

/// A switch row. The whole row toggles; the switch itself is drawn by the theme (ink on, with a
/// check glyph) so state never depends on colour alone.
class YouSwitchRow extends StatelessWidget {
  const YouSwitchRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.note,
    this.hairline = true,
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
                Text(title, style: type.subhead.copyWith(color: enabled ? colors.ink : colors.ink3)),
                if (note != null) ...[
                  const SizedBox(height: 2),
                  Text(note!, style: type.small.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s16),
          ExcludeSemantics(
            child: IgnorePointer(child: Switch(value: value, onChanged: enabled ? (_) {} : null)),
          ),
        ],
      ),
    );
  }
}
