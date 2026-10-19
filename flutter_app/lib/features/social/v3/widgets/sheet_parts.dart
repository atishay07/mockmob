// Small parts the Mob v3 sheets share (P1 picker, P2 start, P3 mic, P4 plans): the section label, the row
// (icon or head, title, line, a key at the end), the tile (a format or a start, with its lock), a Fold's
// head in a disc, and the two ways a sheet hands over to a page.
//
// Locked things stay drawn with a lock and say why (R3: never hide). No price, no plan word unless the
// caller passes one (the "Pro" tag is only ever passed when billing is on).

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';

/// Takes the sheet [context] belongs to off the root navigator at once, so the page that opens next
/// rises over the den and Back returns to the den, never to a spent sheet.
void dropSheet(BuildContext context) {
  final route = ModalRoute.of(context);
  if (route != null && route.isActive) Navigator.of(context, rootNavigator: true).removeRoute(route);
}

/// Closes the sheet and runs [open] with a context that outlives it (the root navigator's own).
void leaveSheetThen(BuildContext context, void Function(BuildContext navContext) open) {
  final nav = Navigator.of(context, rootNavigator: true);
  dropSheet(context);
  open(nav.context);
}

class MobSheetLabel extends StatelessWidget {
  const MobSheetLabel(this.text, {super.key, this.padding = const EdgeInsets.only(top: MmSpace.s24, bottom: MmSpace.s8)});

  final String text;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Padding(
        padding: padding,
        child: Semantics(header: true, child: Text(text, style: context.mmType.label.copyWith(color: context.mmColors.ink2))),
      );
}

/// A rounded paper square with an icon: the leading mark of a row or tile.
class PaperChip extends StatelessWidget {
  const PaperChip({super.key, required this.icon, this.size = 48, this.locked = false});

  final IconData icon;
  final double size;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: locked ? colors.sunken : colors.raised2,
          borderRadius: BorderRadius.circular(size * 0.33),
          border: Border.all(color: colors.line),
        ),
        child: Icon(icon, size: size * 0.46, color: locked ? colors.ink3 : colors.ink),
      ),
    );
  }
}

/// A Fold's head in a ring of the member's colour; the initial on the colour when there is no art.
class MemberHead extends StatelessWidget {
  const MemberHead({super.key, required this.name, this.fold, this.colour = 0, this.size = 48});

  factory MemberHead.of(MobV3Member m, {double size = 48}) => MemberHead(name: m.name, fold: m.fold, colour: m.colour, size: size);

  final String name;
  final FoldKey? fold;
  final int colour;
  final double size;

  @override
  Widget build(BuildContext context) {
    final ring = MobColours.of(context, colour);
    final head = FoldManifest.cached?[fold]?.head;
    final initial = name.trim().isEmpty ? '?' : String.fromCharCode(name.trim().runes.first).toUpperCase();
    final fallback = Center(child: Text(initial, style: context.mmType.label.copyWith(color: MobColours.inkOn(context), fontSize: size * 0.4, height: 1, fontWeight: FontWeight.w700)));
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        padding: const EdgeInsets.all(2.5),
        decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: ring, width: 2.5), color: context.mmColors.raised2),
        child: ClipOval(
          child: head == null
              ? ColoredBox(color: ring, child: fallback)
              : Image.asset(head, fit: BoxFit.cover, errorBuilder: (_, _, _) => ColoredBox(color: ring, child: fallback)),
        ),
      ),
    );
  }
}

/// A row of a sheet: a mark at the start, a title and a line, and a key (or nothing) at the end.
class MobRow extends StatelessWidget {
  const MobRow({super.key, required this.leading, required this.title, this.line, this.trailing});

  final Widget leading;
  final String title;
  final String? line;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          leading,
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: type.cardTitle),
                if (line != null) ...[
                  const SizedBox(height: 2),
                  Text(line!, style: type.small.copyWith(color: colors.ink2)),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
        ],
      ),
    );
  }
}

/// The small key at the end of a row: "Play", "Answers", "Sit it". Primary is the screen's one volt key.
class RowKey extends StatelessWidget {
  const RowKey({super.key, required this.label, required this.onPressed, this.primary = false, this.loading = false});

  final String label;
  final VoidCallback? onPressed;
  final bool primary;
  final bool loading;

  @override
  Widget build(BuildContext context) => primary
      ? KeyButton(label: label, onPressed: onPressed, loading: loading, expanded: false, minHeight: 44)
      : KeyButton.secondary(label: label, onPressed: onPressed, loading: loading, expanded: false, minHeight: 44);
}

/// A tile: icon at the top, a lock or a check at the top right, a title and a line. [locked] tiles stay
/// drawn and say why through [line] (and their [tag]); they do not take a tap unless [onTap] is given.
class MobTile extends StatelessWidget {
  const MobTile({super.key, required this.icon, required this.title, required this.line, this.selected = false, this.locked = false, this.tag, this.onTap});

  final IconData icon;
  final String title;
  final String line;
  final bool selected;
  final bool locked;

  /// "Pro", only passed when billing is on.
  final String? tag;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final border = selected ? colors.ink : (locked ? colors.line : colors.lineStrong);
    final face = DecoratedBox(
      decoration: BoxDecoration(
        color: selected ? colors.selectedSurface : (locked ? Colors.transparent : colors.raised),
        borderRadius: BorderRadius.circular(MmRadius.panel - 4),
        border: Border.all(color: border, width: selected ? 2 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                PaperChip(icon: icon, size: 36, locked: locked),
                const Spacer(),
                if (tag != null) ...[
                  Text(tag!, style: type.label.copyWith(color: colors.ink2)),
                  const SizedBox(width: MmSpace.s4),
                ],
                if (locked) Icon(LucideIcons.lock, size: 16, color: colors.ink3) else if (selected) Icon(LucideIcons.check, size: 20, color: colors.ink),
              ],
            ),
            const SizedBox(height: MmSpace.s12),
            Text(title, style: type.labelLarge.copyWith(color: locked ? colors.ink2 : colors.ink, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(line, style: type.small.copyWith(color: locked ? colors.ink3 : colors.ink2)),
          ],
        ),
      ),
    );
    return Semantics(
      container: true,
      button: onTap != null,
      selected: selected,
      enabled: !locked || onTap != null,
      label: '$title. $line${tag != null ? '. $tag' : ''}${locked ? '. ${MobV3Copy.lockedWord}' : ''}',
      child: ExcludeSemantics(
        child: onTap == null
            ? face
            : MmPressable(
                onTap: onTap,
                haptic: MmPressHaptic.selection,
                focusRadius: BorderRadius.circular(MmRadius.panel - 4),
                builder: (context, pressed, _) => face,
              ),
      ),
    );
  }
}

/// A calm sentence under a block: ink 2, small.
class MobLine extends StatelessWidget {
  const MobLine(this.text, {super.key, this.center = false});

  final String text;
  final bool center;

  @override
  Widget build(BuildContext context) => Text(text, textAlign: center ? TextAlign.center : TextAlign.start, style: context.mmType.small.copyWith(color: context.mmColors.ink2));
}
