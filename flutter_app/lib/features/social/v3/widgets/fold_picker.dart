// The Fold picker (spec 5.3 D0a, J1, S1): "Pick your Fold" as four starter cards with their lines
// (first time, D0a), a row of head discs (J1, and the owned-only chooser behind "Change"), and the
// chooser sheet itself. A locked Fold is never offered here: the picker takes the list it may show.
// Characters come only through FoldPuppet and the manifest's head discs.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'fold_manifest.dart';
import 'fold_puppet.dart';

/// A Fold's head in a round disc (24 to 56 dp). The manifest's head still, or the initial disc when the
/// art is not there. [ring] draws the chosen rim.
class FoldHeadDisc extends ConsumerWidget {
  const FoldHeadDisc({super.key, required this.fold, this.size = 48, this.ring = false, this.fallbackName = '', this.fallbackColour = 0});

  final FoldKey? fold;
  final double size;
  final bool ring;
  final String fallbackName;
  final int fallbackColour;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final art = foldManifestOf(ref)?[fold];
    final head = art?.head;
    final name = fallbackName.trim();
    final initial = name.isEmpty ? '?' : String.fromCharCode(name.runes.first).toUpperCase();
    final base = art?.colour ?? MobColours.of(context, fallbackColour);
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Color.alphaBlend(base.withValues(alpha: c.isNight ? 0.30 : 0.38), c.raised2),
          border: Border.all(color: ring ? c.ink : c.line, width: ring ? 2.5 : 1),
        ),
        clipBehavior: Clip.antiAlias,
        alignment: Alignment.center,
        child: head == null
            ? Text(initial, style: context.mmType.label.copyWith(color: c.ink, fontSize: size * 0.42, height: 1, fontWeight: FontWeight.w700))
            : Image.asset(head, width: size, height: size, fit: BoxFit.cover, filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => const SizedBox.shrink()),
      ),
    );
  }
}

/// Four starter cards, two by two: the figure, the name and the line. One is chosen (an ink rim and
/// the answer-sheet bubble, never volt: the key is the screen's one volt thing).
class FoldPickerCards extends StatelessWidget {
  const FoldPickerCards({super.key, required this.folds, required this.selected, required this.onChanged});

  final List<FoldKey> folds;
  final FoldKey? selected;
  final ValueChanged<FoldKey> onChanged;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        const gap = MmSpace.s12;
        final w = (box.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [for (final f in folds) SizedBox(width: w, child: FoldCard(fold: f, selected: f == selected, onTap: () => onChanged(f)))],
        );
      },
    );
  }
}

class FoldCard extends ConsumerWidget {
  const FoldCard({super.key, required this.fold, required this.selected, required this.onTap});

  final FoldKey fold;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    final name = MobV3Copy.foldName(fold);
    final line = MobV3Copy.foldLine(fold);
    return MmPressable(
      semanticsLabel: MobV3Copy.foldCard(name, line),
      selected: selected,
      focusRadius: MmRadius.keyAll,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: MmSelection.fill(c, selected: selected, pressed: pressed),
          borderRadius: MmRadius.keyAll,
          border: Border.fromBorderSide(MmSelection.side(c, selected: selected)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s12, MmSpace.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(alignment: Alignment.topRight, child: SelectBubble(selected: selected)),
              FoldPuppet(fold: fold, size: 68, blink: false, fallbackName: name),
              const SizedBox(height: MmSpace.s12),
              Text(name, textAlign: TextAlign.center, style: type.cardTitle.copyWith(color: c.ink)),
              const SizedBox(height: MmSpace.s4),
              Text(line, textAlign: TextAlign.center, style: type.caption.copyWith(color: c.ink2)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Head discs in a wrap, each with its name under it. Used for J1's "Pick who you'll be" and for the
/// owned-only chooser. A name is under every disc so the first-time student never guesses.
class FoldPickerRow extends ConsumerWidget {
  const FoldPickerRow({super.key, required this.folds, required this.selected, required this.onChanged, this.disc = 56});

  final List<FoldKey> folds;
  final FoldKey? selected;
  final ValueChanged<FoldKey> onChanged;
  final double disc;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    return Wrap(
      spacing: MmSpace.s12,
      runSpacing: MmSpace.s8,
      children: [
        for (final f in folds)
          MmPressable(
            semanticsLabel: MobV3Copy.foldCard(MobV3Copy.foldName(f), MobV3Copy.foldLine(f)),
            selected: f == selected,
            focusRadius: MmRadius.smallAll,
            onTap: () {
              ref.read(hapticsProvider).selection();
              onChanged(f);
            },
            builder: (context, pressed, _) => SizedBox(
              width: disc + 12,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FoldHeadDisc(fold: f, size: disc, ring: f == selected),
                  const SizedBox(height: MmSpace.s4),
                  Text(
                    MobV3Copy.foldName(f),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    style: type.caption.copyWith(color: f == selected ? c.ink : c.ink2, fontWeight: f == selected ? FontWeight.w700 : FontWeight.w500),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// The Folds this student may sit as: the shelf's owned list when it has loaded, else the four
/// starters (always free), so a picker is never empty and never offers a locked Fold.
List<FoldKey> ownedFoldsOf(AsyncValue<Shelf> shelf) {
  final owned = shelf.value?.owned;
  if (owned == null || owned.isEmpty) return FoldKey.starters;
  return owned;
}

/// "Change": an owned-only chooser sheet. Returns the Fold picked, or null when closed.
Future<FoldKey?> showFoldChooser(BuildContext context, {required FoldKey? selected, String? title}) {
  return showMmSheet<FoldKey>(
    context: context,
    title: title ?? MobV3Copy.changeFoldTitle,
    builder: (_) => _FoldChooserBody(selected: selected),
  );
}

class _FoldChooserBody extends ConsumerWidget {
  const _FoldChooserBody({required this.selected});

  final FoldKey? selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final folds = ownedFoldsOf(ref.watch(shelfProvider));
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s16),
      child: FoldPickerRow(folds: folds, selected: selected, onChanged: (f) => Navigator.of(context).pop(f)),
    );
  }
}
