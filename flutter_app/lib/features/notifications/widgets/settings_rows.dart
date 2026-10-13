import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart' show Skeleton, SkeletonGroup;

/// A group heading: sentence case, no eyebrow styling, 32 dp above to separate independent groups.
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.text, {super.key, this.topGap = MmSpace.group});

  final String text;
  final double topGap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: topGap, bottom: MmSpace.s8, left: 4),
      child: Semantics(
        header: true,
        child: Text(text, style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink2)),
      ),
    );
  }
}

/// A line of quiet explanation under a heading or a row.
class QuietNote extends StatelessWidget {
  const QuietNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(left: 4, top: MmSpace.s8),
    child: Text(
      text,
      style: context.mmType.caption.copyWith(color: context.mmColors.ink2),
    ),
  );
}

/// A row with a label and a time or value in a tappable pill (a picker opens). The whole row is
/// the target, at least 56 dp tall.
class ValueRow extends StatefulWidget {
  const ValueRow({
    super.key,
    required this.label,
    required this.value,
    required this.onTap,
    this.semanticsHint,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;
  final String? semanticsHint;

  @override
  State<ValueRow> createState() => _ValueRowState();
}

class _ValueRowState extends State<ValueRow> {
  bool _pressed = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = widget.onTap != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: '${widget.label}, ${widget.value}',
      hint: widget.semanticsHint ?? 'Changes the time',
      onTap: widget.onTap,
      excludeSemantics: true,
      child: FocusableActionDetector(
        enabled: enabled,
        onShowFocusHighlight: (v) => setState(() => _focused = v),
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(
            onInvoke: (_) {
              widget.onTap?.call();
              return null;
            },
          ),
        },
        child: Listener(
          onPointerDown: (_) => setState(() => _pressed = true),
          onPointerUp: (_) => setState(() => _pressed = false),
          onPointerCancel: (_) => setState(() => _pressed = false),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: widget.onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 60),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s6),
                child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.label,
                      style: type.labelLarge.copyWith(fontSize: 16, color: colors.ink),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  ConstrainedBox(
                    constraints: const BoxConstraints(
                      minHeight: MmTarget.min,
                      minWidth: 92,
                    ),
                    child: DecoratedBox(
                      decoration: ShapeDecoration(
                        color: _pressed ? colors.line : (colors.isNight ? colors.sunken : colors.raised2),
                        shape: StadiumBorder(
                          side: BorderSide(
                            color: _focused ? colors.focusRing : colors.line,
                            width: _focused ? 2 : 1,
                          ),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: MmSpace.s16,
                        ),
                        child: Center(
                          widthFactor: 1,
                          child: Text(
                            widget.value,
                            style: type.button.copyWith(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: colors.ink,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A channel row: a title, one line saying what it is for, and a switch. The whole row toggles.
/// [note] adds a warning or status line under the explanation.
class ChannelRow extends ConsumerWidget {
  const ChannelRow({
    super.key,
    required this.title,
    required this.body,
    required this.value,
    required this.onChanged,
    this.note,
    this.noteIsWarning = false,
  });

  final String title;
  final String body;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? note;
  final bool noteIsWarning;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onChanged != null;

    void toggle() {
      ref.read(hapticsProvider).tick();
      onChanged?.call(!value);
    }

    return Semantics(
      container: true,
      toggled: value,
      enabled: enabled,
      label: title,
      hint: note == null ? body : '$body $note',
      onTap: enabled ? toggle : null,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? toggle : null,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: type.labelLarge.copyWith(fontSize: 16)),
                      const SizedBox(height: 2),
                      Text(
                        body,
                        style: type.caption.copyWith(color: colors.ink2),
                      ),
                      if (note != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (noteIsWarning)
                              Padding(
                                padding: const EdgeInsets.only(
                                  top: 2,
                                  right: MmSpace.s8,
                                ),
                                child: Icon(
                                  LucideIcons.triangleAlert,
                                  size: 16,
                                  color: colors.warnText,
                                ),
                              ),
                            Expanded(
                              child: Text(
                                note!,
                                style: type.small.copyWith(
                                  color: noteIsWarning
                                      ? colors.warnText
                                      : colors.ink3,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                // The row handles the tap, so the switch sits outside the semantics tree.
                IgnorePointer(
                  child: Switch(
                    value: value,
                    onChanged: enabled ? (_) {} : null,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A one-pixel hairline between rows.
class Hairline extends StatelessWidget {
  const Hairline({super.key});

  @override
  Widget build(BuildContext context) =>
      SizedBox(height: 1, child: ColoredBox(color: context.mmColors.line));
}

/// The settings list while the first read is in flight.
class LoadingRows extends StatelessWidget {
  const LoadingRows({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Column(
        children: [
          Skeleton(height: 96, radius: MmRadius.panel),
          SizedBox(height: MmSpace.s32),
          Skeleton(height: 40),
          SizedBox(height: MmSpace.s32),
          Skeleton(height: 56),
          SizedBox(height: MmSpace.s12),
          Skeleton(height: 56),
          SizedBox(height: MmSpace.s12),
          Skeleton(height: 56),
        ],
      ),
    );
  }
}
