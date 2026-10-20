// A6, the Shelf sheet (Mob V4, MOB-MINIMAL 3.5): "Yours" and "Still to earn" with the true rules and counts,
// the finishes, and each Mob's own shelf, in one sheet from the den's shelf row. Nothing opens on top of it:
// a Fold's detail, "Play as" and the finish switch all open inline, under the row you tapped.
//
// The same body (ShelfBody) is the old Shelf page's, so the page and the sheet never disagree. The Fold you
// play as changes by tapping one of yours and "Play as". Locked Folds stay drawn with their rule (never hide).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../widgets/mob_parts.dart' show MobNote;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/fold_catalog.dart';
import '../logic/mob_say.dart';
import '../screens/shelf_screen.dart';
import 'fold_picker.dart';
import 'fold_puppet.dart';
import 'sheet_parts.dart';

/// Opens the Shelf sheet over the current screen.
Future<void> openShelfSheet(BuildContext context) => showMmSheet<void>(
      context: context,
      title: MobV3Copy.shelfTitle,
      heightFactor: 0.94,
      builder: (_) => const ShelfBody(),
    );

/// The shelf as a body: loading, failed, or the grids. Used by the sheet and by the Shelf page.
class ShelfBody extends ConsumerWidget {
  const ShelfBody({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shelf = ref.watch(shelfProvider);
    // A read that failed shows the sentence at once, even while the provider is retrying it.
    if (shelf.hasError && !shelf.hasValue) return _Failed(onRetry: () => ref.invalidate(shelfProvider));
    return shelf.when(
      data: (s) => _ShelfContent(shelf: s),
      loading: () => const SkeletonGroup(
        label: MobV3Copy.shelfLoading,
        child: Column(children: [Skeleton(height: 64), SizedBox(height: MmSpace.s12), Skeleton(height: 220), SizedBox(height: MmSpace.s12), Skeleton(height: 220)]),
      ),
      error: (e, _) => _Failed(onRetry: () => ref.invalidate(shelfProvider)),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobV3Copy.shelfFailed, style: context.mmType.title.copyWith(color: context.mmColors.ink)),
          const SizedBox(height: MmSpace.s16),
          KeyButton.secondary(label: MobV3Copy.tryAgain, onPressed: onRetry),
        ],
      );
}

class _ShelfContent extends ConsumerStatefulWidget {
  const _ShelfContent({required this.shelf});

  final Shelf shelf;

  @override
  ConsumerState<_ShelfContent> createState() => _ShelfContentState();
}

class _ShelfContentState extends ConsumerState<_ShelfContent> {
  String? _error;
  bool _busy = false;

  /// The Fold whose detail is open under its row.
  FoldKey? _open;

  Shelf get shelf => widget.shelf;

  ShelfFold? _fold(FoldKey k) {
    for (final f in shelf.folds) {
      if (f.key == k) return f;
    }
    return null;
  }

  /// Every Fold in the catalogue, owned first (in catalogue order), then the ones still to earn.
  List<ShelfFold> get _ordered {
    final all = [for (final r in foldCatalog) _fold(r.fold) ?? ShelfFold(key: r.fold, starter: r.source == null, folds: r.folds)];
    return [...all.where((f) => f.owned || f.starter), ...all.where((f) => !(f.owned || f.starter))];
  }

  Future<void> _sit(FoldKey f) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(mobV3ActionsProvider).sitAs(f);
      ref.read(hapticsProvider).confirm();
      ref.invalidate(shelfProvider);
    } on Object catch (e) {
      if (mounted) setState(() => _error = mobV3Say(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toggle(FoldKey k) => setState(() => _open = _open == k ? null : k);

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final ordered = _ordered;
    final ownedList = [for (final f in ordered) if (f.owned || f.starter) f];
    final toEarn = [for (final f in ordered) if (!(f.owned || f.starter)) f];

    Widget tile(ShelfFold f) => FoldTile(
          fold: f,
          isSeat: f.key == shelf.seat,
          finish: f.key == shelf.seat ? shelf.seatFinish : FoldFinish.plain,
          onTap: () => _toggle(f.key),
        );

    // Two to a row, each row as tall as its taller card; the open Fold's detail sits right under its row.
    Widget grid(List<ShelfFold> list) => Column(
          children: [
            for (var i = 0; i < list.length; i += 2) ...[
              if (i > 0) const SizedBox(height: MmSpace.s12),
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: tile(list[i])),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(child: i + 1 < list.length ? tile(list[i + 1]) : const SizedBox.shrink()),
                  ],
                ),
              ),
              _InlineSlot(
                child: () {
                  final open = _open;
                  if (open == null) return null;
                  final hit = list[i].key == open ? list[i] : (i + 1 < list.length && list[i + 1].key == open ? list[i + 1] : null);
                  if (hit == null) return null;
                  return FoldDetailInline(
                    key: ValueKey('s1-detail-${hit.key.name}'),
                    fold: hit,
                    isSeat: hit.key == shelf.seat,
                    busy: _busy,
                    onSit: () async {
                      await _sit(hit.key);
                      if (mounted) setState(() => _open = null);
                    },
                    onHide: () => setState(() => _open = null),
                  );
                }(),
              ),
            ],
          ],
        );

    final foil = shelf.folds.isEmpty ? const FinishProgress() : shelf.folds.first.foil;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobV3Copy.shelfLead, style: type.body.copyWith(color: c.ink2)),
        const SizedBox(height: MmSpace.s16),
        _SeatRow(seat: shelf.seat),
        if (_error != null) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: _error!, tone: BannerTone.error),
        ],
        const SizedBox(height: MmSpace.s24),
        const ShelfHeading(MobV3Copy.shelfOwned),
        grid(ownedList),
        if (toEarn.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s24),
          const ShelfHeading(MobV3Copy.shelfToEarn),
          grid(toEarn),
        ],
        const SizedBox(height: MmSpace.s32),
        const ShelfHeading(MobV3Copy.finishes),
        ShelfFinishRow(foil: foil, seat: shelf.seat, seatFinish: shelf.seatFinish),
        for (final m in shelf.mobItems) ...[
          const SizedBox(height: MmSpace.s32),
          ShelfHeading(MobV3Copy.mobShelf(m.name)),
          for (final item in m.items) ShelfMobItemRow(item: item),
        ],
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }
}

/// Grows open (and closed) under a row of the grid: 240 ms, or at once with reduced motion.
class _InlineSlot extends StatelessWidget {
  const _InlineSlot({required this.child});

  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final body = child == null ? const SizedBox(width: double.infinity) : Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: child);
    return MmSizeEase(duration: Motion.card, curve: Motion.glide, alignment: Alignment.topCenter, child: body);
  }
}

class _SeatRow extends StatelessWidget {
  const _SeatRow({required this.seat});

  final FoldKey seat;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: c.line)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s12, MmSpace.s8),
        child: Row(
          children: [
            FoldHeadDisc(fold: seat, size: 44),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(MobV3Copy.youPlayAs(MobV3Copy.foldName(seat)), style: type.subhead.copyWith(color: c.ink)),
                  const SizedBox(height: 2),
                  Text(MobV3Copy.shelfTapHint, style: type.small.copyWith(color: c.ink2)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A Fold's detail, open in place: its big still, its line, how it is earned (with the true count), the
/// creases, and "Play as" for one you own. No sheet opens over the sheet.
class FoldDetailInline extends StatelessWidget {
  const FoldDetailInline({super.key, required this.fold, required this.isSeat, required this.busy, required this.onSit, required this.onHide});

  final ShelfFold fold;
  final bool isSeat;
  final bool busy;
  final Future<void> Function() onSit;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final have = fold.owned || fold.starter;
    final name = MobV3Copy.foldName(fold.key);
    return Semantics(
      container: true,
      label: name,
      child: DecoratedBox(
        decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: c.lineStrong)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(child: FoldPuppet(fold: fold.key, size: 176, large: true, locked: !have, blink: have, fallbackName: name)),
              const SizedBox(height: MmSpace.s12),
              Text(MobV3Copy.foldLine(fold.key), textAlign: TextAlign.center, style: type.subhead.copyWith(color: c.ink)),
              if (!have) ...[
                const SizedBox(height: MmSpace.s8),
                Text(MobV3Copy.lockedRule(fold), textAlign: TextAlign.center, style: type.body.copyWith(color: c.ink2)),
              ],
              const SizedBox(height: MmSpace.s8),
              MobNote(MobV3Copy.creaseLabel(fold.folds), center: true),
              if (have) ...[
                const SizedBox(height: MmSpace.s12),
                if (isSeat)
                  MobNote(MobV3Copy.shelfSeatTag(name), center: true)
                else
                  KeyButton(
                    key: const ValueKey('s1-play-as'),
                    label: MobV3Copy.playAs(fold.key),
                    loading: busy,
                    onPressed: busy ? null : onSit,
                  ),
              ],
              LinkKey(label: MobV3Copy.shelfHideFold, alignment: Alignment.center, onPressed: onHide),
            ],
          ),
        ),
      ),
    );
  }
}
