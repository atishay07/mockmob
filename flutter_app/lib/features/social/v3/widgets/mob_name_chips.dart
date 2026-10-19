// The Mob name chips (spec 5.3 D0a and SET): six names at a time from the fixed kind list, a note that
// says why the list is the list, and "Show six more" (then "Back to the first six" after the last).
// There is no free text: the key sent is the index into `mobNames`, which the server holds too.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../logic/mob_names.dart';

class MobNameChips extends StatefulWidget {
  const MobNameChips({super.key, required this.selected, required this.onChanged, this.showNote = true, this.perPage = 6});

  /// The chosen name's key, or null when none is (a Mob that still shows its subject).
  final int? selected;
  final ValueChanged<int> onChanged;
  final bool showNote;
  final int perPage;

  @override
  State<MobNameChips> createState() => _MobNameChipsState();
}

class _MobNameChipsState extends State<MobNameChips> {
  late int _page = widget.selected == null ? 0 : (widget.selected! ~/ widget.perPage).clamp(0, _pages - 1);

  int get _pages => (mobNames.length / widget.perPage).ceil();

  void _more() => setState(() => _page = (_page + 1) % _pages);

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final start = _page * widget.perPage;
    final end = (start + widget.perPage).clamp(0, mobNames.length);
    final last = _page == _pages - 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MmOverlapSwitcher(
          duration: Motion.ui,
          alignment: Alignment.topLeft,
          child: Wrap(
            key: ValueKey(_page),
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s4,
            children: [
              for (var i = start; i < end; i++) MobPickChip(key: ValueKey('mob-name-$i'), label: mobNames[i], selected: widget.selected == i, onTap: () => widget.onChanged(i)),
            ],
          ),
        ),
        // "Show six more" belongs to the chips: right under them, flush left (M4, 19 Oct night walk).
        MobTextLink(key: const ValueKey('mob-names-more'), label: last ? MobV3Copy.showFirstSix : MobV3Copy.showSixMore, onTap: _more),
        if (widget.showNote) Text(MobV3Copy.namesKind, style: type.small.copyWith(color: c.ink2)),
      ],
    );
  }
}

/// A choice chip for the Mob's pickers (name, subject): chosen reads at a glance as a filled ink chip
/// with a tick (M4, 19 Oct night walk: a brighter rim alone did not say what was chosen). Ink, never
/// volt: the sheet's key is the one volt thing.
class MobPickChip extends ConsumerWidget {
  const MobPickChip({super.key, required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    final fg = selected ? c.ground : c.ink;
    return MmHitSlop.toTarget(
      visual: MmChip.height,
      child: MmPressable(
        semanticsLabel: label,
        selected: selected,
        pressedScale: 0.96,
        onTap: onTap == null
            ? null
            : () {
                ref.read(hapticsProvider).selection();
                onTap!();
              },
        builder: (context, pressed, _) => AnimatedContainer(
          duration: reduced ? Motion.reducedFade : Motion.ui,
          curve: Motion.out,
          height: MmChip.height,
          padding: EdgeInsets.only(left: selected ? MmSpace.s12 : MmSpace.s16, right: MmSpace.s16),
          decoration: ShapeDecoration(
            color: selected ? c.ink : (pressed ? c.raised2 : c.raised.withValues(alpha: 0)),
            shape: StadiumBorder(side: BorderSide(color: selected ? c.ink : c.line, width: selected ? 1.5 : 1)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[Icon(LucideIcons.check, size: 16, color: fg), const SizedBox(width: MmSpace.s6)],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                  style: type.labelLarge.copyWith(fontSize: 14, color: fg, fontWeight: selected ? FontWeight.w700 : FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A quiet text link that sits flush left under what it acts on ("Show six more"): 48 dp tall,
/// underlined, no indent.
class MobTextLink extends StatelessWidget {
  const MobTextLink({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: label,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      focusRadius: BorderRadius.circular(MmRadius.small),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: 1,
          child: Text(
            label,
            style: type.button.copyWith(color: c.ink, decoration: TextDecoration.underline, decorationColor: c.ink3, decorationThickness: 1.2),
          ),
        ),
      ),
    );
  }
}
