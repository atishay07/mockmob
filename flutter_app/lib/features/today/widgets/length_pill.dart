// The hero's length, as one quiet pill beside its key (design critic 16 Oct, finding 1): "15 min"
// sits next to "Start repair", and a tap opens a small panel of the three lengths just above it.
// The key says the verb once and the pill says the length once, so the card no longer repeats
// its figure or carries two controls that both look primary. The panel names what each length
// gets ("2 to repair"), closes on a choice, a tap outside or back, and the card reshapes in place
// as it did with the old chips (the number rolls, the object answers).
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';

/// The pill: the chosen length and a small up-and-down mark, as tall as the key beside it.
class LengthPill extends StatelessWidget {
  const LengthPill({super.key, required this.durations, required this.selected, required this.title, required this.onChanged});

  final List<DurationChoice> durations;

  /// The chosen length's minutes.
  final int selected;

  /// What the panel asks ("Length of today's repair", "How long have you got tonight?").
  final String title;

  /// Null shows the pill without a panel behind it.
  final ValueChanged<int>? onChanged;

  DurationChoice get _choice => durations.firstWhere((d) => d.minutes == selected, orElse: () => durations.first);

  Future<void> _open(BuildContext context) async {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    final anchor = box.localToGlobal(Offset.zero) & box.size;
    final picked = await Navigator.of(context).push<int>(
      _LengthPanelRoute(
        anchor: anchor,
        title: title,
        durations: durations,
        selected: selected,
        barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      ),
    );
    if (picked != null && picked != selected) onChanged?.call(picked);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = TodayCopy.lengthWords(_choice);
    return MmPressable(
      semanticsLabel: TodayCopy.lengthPillSemantics(title, words),
      focusRadius: MmRadius.pillAll,
      haptic: MmPressHaptic.selection,
      onTap: onChanged == null ? null : () => _open(context),
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.55 : 0.6),
          shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.primaryKey, minWidth: MmTarget.primaryKey),
          child: Padding(
            padding: const EdgeInsets.only(left: MmSpace.s16, right: MmSpace.s12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // A new length cross-fades in place: the pill never jumps.
                MmSizeEase(
                  duration: Motion.ui,
                  curve: Motion.out,
                  alignment: Alignment.centerLeft,
                  child: MmOverlapSwitcher.fade(
                    alignment: Alignment.centerLeft,
                    child: Text(words, key: ValueKey(words), style: type.button.copyWith(color: colors.ink), maxLines: 1, softWrap: false),
                  ),
                ),
                const SizedBox(width: MmSpace.s6),
                Icon(LucideIcons.chevronsUpDown, size: 16, color: colors.ink2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The panel of lengths, opened just above the pill (or below it when there is no room above).
class _LengthPanelRoute extends PopupRoute<int> {
  _LengthPanelRoute({required this.anchor, required this.title, required this.durations, required this.selected, required this.barrierLabel});

  final Rect anchor;
  final String title;
  final List<DurationChoice> durations;
  final int selected;

  @override
  final String barrierLabel;

  @override
  Color? get barrierColor => const Color(0x00000000);

  @override
  bool get barrierDismissible => true;

  @override
  Duration get transitionDuration => Motion.ui;

  @override
  Duration get reverseTransitionDuration => Motion.exitDuration;

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    final media = MediaQuery.of(context);
    return CustomSingleChildLayout(
      delegate: _PanelLayout(anchor: anchor, padding: media.padding, gutter: MmSpace.gutter),
      child: LengthPanel(title: title, durations: durations, selected: selected, onPick: (m) => Navigator.of(context).pop(m)),
    );
  }

  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    final fade = CurvedAnimation(parent: animation, curve: Motion.glide, reverseCurve: Motion.exit);
    if (Motion.reduced(context)) return FadeTransition(opacity: fade, child: child);
    // The panel grows out of the pill's corner: a short scale from 0.94 with the fade.
    final grow = Tween<double>(begin: 0.94, end: 1).animate(CurvedAnimation(parent: animation, curve: Motion.emphasized, reverseCurve: Motion.exit));
    return FadeTransition(
      opacity: fade,
      child: ScaleTransition(scale: grow, alignment: _PanelLayout.growFrom, child: child),
    );
  }
}

/// Puts the panel's bottom right corner 8 dp above the pill's top right corner, inside the
/// screen's gutters; it opens under the pill instead when the room above is too short.
class _PanelLayout extends SingleChildLayoutDelegate {
  _PanelLayout({required this.anchor, required this.padding, required this.gutter});

  final Rect anchor;
  final EdgeInsets padding;
  final double gutter;

  static const double width = 248;
  static const double gap = 8;

  /// The corner the panel scales from (its bottom right, where the pill is).
  static const Alignment growFrom = Alignment.bottomRight;

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) {
    final w = (constraints.maxWidth - 2 * gutter).clamp(0.0, width);
    return BoxConstraints(minWidth: w, maxWidth: w, maxHeight: constraints.maxHeight - padding.vertical - 2 * gutter);
  }

  @override
  Offset getPositionForChild(Size size, Size child) {
    final x = (anchor.right - child.width).clamp(gutter, size.width - gutter - child.width);
    final above = anchor.top - gap - child.height;
    final y = above >= padding.top + gutter ? above : anchor.bottom + gap;
    return Offset(x.toDouble(), y.clamp(padding.top, size.height - child.height).toDouble());
  }

  @override
  bool shouldRelayout(_PanelLayout old) => old.anchor != anchor || old.padding != padding || old.gutter != gutter;
}

/// The lengths themselves: a quiet question, then one 48 dp row per length with what it gets.
/// Public for goldens.
class LengthPanel extends StatelessWidget {
  const LengthPanel({super.key, required this.title, required this.durations, required this.selected, required this.onPick});

  final String title;
  final List<DurationChoice> durations;
  final int selected;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label: title,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.isNight ? colors.raised2 : colors.raised,
          shape: RoundedRectangleBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.lineStrong)),
          shadows: [BoxShadow(color: const Color(0xFF000000).withValues(alpha: colors.isNight ? 0.45 : 0.14), blurRadius: 24, offset: const Offset(0, 8))],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s8, MmSpace.s12, MmSpace.s8, MmSpace.s8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                child: ExcludeSemantics(child: Text(title, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600))),
              ),
              const SizedBox(height: MmSpace.s4),
              for (final d in durations) _LengthRow(choice: d, selected: d.minutes == selected, onTap: () => onPick(d.minutes)),
            ],
          ),
        ),
      ),
    );
  }
}

class _LengthRow extends StatelessWidget {
  const _LengthRow({required this.choice, required this.selected, required this.onTap});

  final DurationChoice choice;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = TodayCopy.lengthWords(choice);
    final gets = TodayCopy.lengthGets(choice);
    return MmPressable(
      semanticsLabel: gets == null ? words : '$words, $gets',
      selected: selected,
      inMutuallyExclusiveGroup: true,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: selected || pressed ? colors.ink.withValues(alpha: colors.isNight ? 0.08 : 0.06) : null,
          borderRadius: MmRadius.smallAll,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
            child: Row(
              children: [
                SizedBox(
                  width: 20,
                  child: selected ? Icon(LucideIcons.check, size: 18, color: colors.isNight ? colors.volt : colors.accentText) : null,
                ),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(words, style: type.body.copyWith(color: colors.ink, fontWeight: selected ? FontWeight.w600 : FontWeight.w500))),
                if (gets != null) Text(gets, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
