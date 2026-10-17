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
    final picked = await openPanel(context, durations: durations, selected: selected, title: title);
    if (picked != null && picked != selected) onChanged?.call(picked);
  }

  /// Opens the lengths as a sheet (the one sheet style every choice in the app uses: it rises, takes
  /// a drag or the scrim to close; v13 walk, finding 9: the old popup did not match it) and returns
  /// the chosen minutes, or null when it closed without a choice. The Change length pill uses it too.
  static Future<int?> openPanel(BuildContext context, {required List<DurationChoice> durations, required int selected, required String title}) {
    return showMmSheet<int>(
      context: context,
      builder: (sheetContext) => LengthPanel(
        title: title,
        durations: durations,
        selected: selected,
        inSheet: true,
        onPick: (m) => Navigator.of(sheetContext).pop(m),
      ),
    );
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

/// The lengths themselves: a quiet question, then one 48 dp row per length with what it gets.
/// Public for goldens.
class LengthPanel extends StatelessWidget {
  const LengthPanel({super.key, required this.title, required this.durations, required this.selected, required this.onPick, this.inSheet = false});

  final String title;
  final List<DurationChoice> durations;
  final int selected;
  final ValueChanged<int> onPick;

  /// True inside a sheet: the sheet is the surface, so the panel draws no card of its own, and the
  /// question is the sheet's title.
  final bool inSheet;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (inSheet) {
      return Semantics(
        scopesRoute: true,
        namesRoute: true,
        explicitChildNodes: true,
        label: title,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ExcludeSemantics(child: Text(title, style: type.title)),
            const SizedBox(height: MmSpace.s12),
            for (final d in durations) _LengthRow(choice: d, selected: d.minutes == selected, onTap: () => onPick(d.minutes)),
          ],
        ),
      );
    }
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
