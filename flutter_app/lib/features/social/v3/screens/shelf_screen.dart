// S1 Your shelf (spec 5.3, D133).
//
// "Your shelf. Every one is earned. None can be bought." You play as <Fold> with Change (the Folds you
// own, nothing else). A grid of every Fold, each standing on a painted paper plinth: the ones you own
// in colour, the rest as a true silhouette with how to earn it and the real count ("Crane. Your Mob
// fixes 3 traps together. 1 of 3, in Chai Circle."). Creases in the card corner say how it was earned:
// one for a starter, two for one you earned yourself, three for one your Mob earned together. Then the
// finishes, and each Mob's own shelf. A tap on a Fold opens its big still and its line.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../you/widgets/you_page.dart';
import '../../widgets/mob_parts.dart' show MobNote, showMobToast;
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/fold_catalog.dart';
import '../logic/mob_say.dart';
import '../widgets/fold_picker.dart';
import '../widgets/fold_puppet.dart';
import '../widgets/mob_fx.dart';

class ShelfScreen extends ConsumerWidget {
  const ShelfScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shelf = ref.watch(shelfProvider);
    return MobIdleScope(
      child: YouPage(
        title: MobV3Copy.shelfTitle,
        children: [
          Padding(
            padding: youGutter,
            child: shelf.when(
              data: (s) => _ShelfBody(shelf: s),
              loading: () => const SkeletonGroup(
                label: MobV3Copy.shelfLoading,
                child: Column(children: [Skeleton(height: 64), SizedBox(height: MmSpace.s12), Skeleton(height: 220), SizedBox(height: MmSpace.s12), Skeleton(height: 220)]),
              ),
              error: (e, _) => _Failed(onRetry: () => ref.invalidate(shelfProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final c = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobV3Copy.shelfFailed, style: type.title.copyWith(color: c.ink)),
        const SizedBox(height: MmSpace.s16),
        KeyButton.secondary(label: MobV3Copy.tryAgain, onPressed: onRetry),
      ],
    );
  }
}

class _ShelfBody extends ConsumerStatefulWidget {
  const _ShelfBody({required this.shelf});

  final Shelf shelf;

  @override
  ConsumerState<_ShelfBody> createState() => _ShelfBodyState();
}

class _ShelfBodyState extends ConsumerState<_ShelfBody> {
  String? _error;
  bool _busy = false;

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

  Future<void> _change() async {
    final f = await showFoldChooser(context, selected: shelf.seat);
    if (f != null && f != shelf.seat) await _sit(f);
  }

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
          onTap: () => showFoldDetail(context, fold: f, isSeat: f.key == shelf.seat, onSit: () => _sit(f.key)),
        );
    // Two to a row, each row as tall as its taller card, so the plinths line up.
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
            ],
          ],
        );
    final foil = shelf.folds.isEmpty ? const FinishProgress() : shelf.folds.first.foil;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(MobV3Copy.shelfLead, style: type.body.copyWith(color: c.ink2)),
        const SizedBox(height: MmSpace.s16),
        _SeatRow(seat: shelf.seat, busy: _busy, onChange: _change),
        if (_error != null) ...[
          const SizedBox(height: MmSpace.s12),
          InlineBanner(message: _error!, tone: BannerTone.error),
        ],
        const SizedBox(height: MmSpace.s24),
        _Heading(MobV3Copy.shelfOwned),
        grid(ownedList),
        if (toEarn.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s24),
          _Heading(MobV3Copy.shelfToEarn),
          grid(toEarn),
        ],
        const SizedBox(height: MmSpace.s32),
        _Heading(MobV3Copy.finishes),
        _FinishRow(foil: foil, seat: shelf.seat, seatFinish: shelf.seatFinish),
        for (final m in shelf.mobItems) ...[
          const SizedBox(height: MmSpace.s32),
          _Heading(MobV3Copy.mobShelf(m.name)),
          for (final item in m.items) _MobItemRow(item: item),
        ],
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s12),
        child: Semantics(header: true, child: Text(text, style: context.mmType.title.copyWith(color: context.mmColors.ink))),
      );
}

class _SeatRow extends StatelessWidget {
  const _SeatRow({required this.seat, required this.busy, required this.onChange});

  final FoldKey seat;
  final bool busy;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: c.line)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s8, MmSpace.s8, MmSpace.s8),
        child: Row(
          children: [
            FoldHeadDisc(fold: seat, size: 44),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(MobV3Copy.youPlayAs(MobV3Copy.foldName(seat)), style: type.subhead.copyWith(color: c.ink))),
            KeyButton.quiet(key: const ValueKey('s1-change'), label: MobV3Copy.change, onPressed: busy ? null : onChange),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// A Fold on its plinth
// ---------------------------------------------------------------------------------------------------

class FoldTile extends StatelessWidget {
  const FoldTile({super.key, required this.fold, required this.onTap, this.isSeat = false, this.finish = FoldFinish.plain});

  final ShelfFold fold;
  final bool isSeat;
  final FoldFinish finish;
  final VoidCallback onTap;

  bool get _have => fold.owned || fold.starter;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final name = MobV3Copy.foldName(fold.key);
    final text = _have ? MobV3Copy.foldLine(fold.key) : MobV3Copy.lockedRule(fold).substring(name.length + 2);
    final label = _have ? MobV3Copy.foldCard(name, MobV3Copy.foldLine(fold.key)) : MobV3Copy.lockedRule(fold);
    return MmPressable(
      semanticsLabel: isSeat ? '$label ${MobV3Copy.shelfSeatTag(name)}.' : label,
      focusRadius: MmRadius.panelAll,
      onTap: onTap,
      builder: (context, pressed, _) => ClipRRect(
        borderRadius: MmRadius.panelAll,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Color.lerp(c.raised, c.raised2, pressed ? 0.6 : 0),
            borderRadius: MmRadius.panelAll,
            border: Border.all(color: isSeat ? c.ink.withValues(alpha: 0.7) : c.line, width: isSeat ? 1.5 : 1),
          ),
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s16, MmSpace.s12, MmSpace.s16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Center(child: _OnPlinth(fold: fold.key, locked: !_have, finish: finish)),
                    const SizedBox(height: MmSpace.s12),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: _have ? name : '$name. ', style: type.cardTitle.copyWith(color: _have ? c.ink : c.ink2)),
                        if (!_have) TextSpan(text: text, style: type.caption.copyWith(color: c.ink2)),
                      ]),
                    ),
                    if (_have) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(text, style: type.caption.copyWith(color: c.ink2)),
                    ],
                  ],
                ),
              ),
              Positioned(right: 0, top: 0, child: Semantics(label: MobV3Copy.creaseLabel(fold.folds), child: CustomPaint(size: const Size(34, 34), painter: CreasePainter(folds: fold.folds, c: c)))),
              if (isSeat) const Positioned(left: MmSpace.s12, top: MmSpace.s12, child: _SeatStamp()),
            ],
          ),
        ),
      ),
    );
  }
}

/// The one volt thing on the shelf: a stamped tick on the Fold you play as.
class _SeatStamp extends StatelessWidget {
  const _SeatStamp();

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return ExcludeSemantics(
      child: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(color: c.volt, shape: BoxShape.circle, border: Border.all(color: c.voltEdge, width: 1)),
        child: Icon(LucideIcons.check, size: 15, color: c.voltInk),
      ),
    );
  }
}

class _OnPlinth extends StatelessWidget {
  const _OnPlinth({required this.fold, required this.locked, required this.finish});

  final FoldKey fold;
  final bool locked;
  final FoldFinish finish;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    const figure = 92.0;
    return SizedBox(
      width: 132,
      height: figure + 18,
      child: Stack(
        alignment: Alignment.bottomCenter,
        clipBehavior: Clip.none,
        children: [
          Positioned(bottom: 0, child: CustomPaint(size: const Size(120, 24), painter: PlinthPainter(night: c.isNight, edge: c.line))),
          Positioned(bottom: 10, child: FoldPuppet(fold: fold, size: figure, locked: locked, shadow: false, blink: false, finish: finish, fallbackName: MobV3Copy.foldName(fold))),
        ],
      ),
    );
  }
}

/// A painted paper plinth: a soft contact shadow, a slab of paper with a lit top face and a darker front.
class PlinthPainter extends CustomPainter {
  PlinthPainter({required this.night, required this.edge});

  final bool night;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final top = night ? const Color(0xFF423D32) : const Color(0xFFFFFCF4);
    final front = night ? const Color(0xFF2B2822) : const Color(0xFFE2DAC8);
    final shadow = night ? const Color(0x66000000) : const Color(0x333B2A12);
    final w = size.width;
    final h = size.height;
    canvas.drawOval(Rect.fromLTWH(w * 0.06, h - 9, w * 0.88, 10), Paint()..color = shadow..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
    final frontR = RRect.fromRectAndRadius(Rect.fromLTWH(0, 8, w, h - 10), const Radius.circular(8));
    canvas.drawRRect(frontR, Paint()..color = front);
    canvas.drawRRect(frontR, Paint()..color = edge..style = PaintingStyle.stroke..strokeWidth = 0.8);
    final topR = RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, w, 14), const Radius.circular(7));
    canvas.drawRRect(topR, Paint()..color = top);
    // The lit lip of the paper.
    canvas.drawLine(Offset(8, 0.8), Offset(w - 8, 0.8), Paint()..color = Colors.white.withValues(alpha: night ? 0.14 : 0.7)..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(PlinthPainter old) => old.night != night || old.edge != edge;
}

/// The corner of a card, folded: one, two or three creases for a starter, a Fold you earned and a Fold
/// your Mob earned together.
class CreasePainter extends CustomPainter {
  CreasePainter({required this.folds, required this.c});

  final int folds;
  final MmColors c;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    // The folded-over corner, with a hairline on its fold.
    final tri = Path()..moveTo(w - 22, 0)..lineTo(w, 0)..lineTo(w, 22)..close();
    canvas.drawPath(tri, Paint()..color = c.isNight ? const Color(0xFF3A362D) : const Color(0xFFEFE8D8));
    canvas.drawLine(Offset(w - 22, 0), Offset(w, 22), Paint()..color = c.lineStrong..strokeWidth = 1);
    final p = Paint()
      ..color = c.ink3
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < folds.clamp(1, 3); i++) {
      // Creases parallel to the fold, each a little further in toward the corner.
      final k = 5.0 + i * 5;
      canvas.drawLine(Offset(w - 22 + k, 0.5), Offset(w - 0.5, 22 - k), p);
    }
  }

  @override
  bool shouldRepaint(CreasePainter old) => old.folds != folds || old.c != c;
}

// ---------------------------------------------------------------------------------------------------
// The Fold's detail
// ---------------------------------------------------------------------------------------------------

Future<void> showFoldDetail(BuildContext context, {required ShelfFold fold, required bool isSeat, required Future<void> Function() onSit}) {
  return showMmSheet<void>(
    context: context,
    title: MobV3Copy.foldName(fold.key),
    builder: (sheet) => _FoldDetail(fold: fold, isSeat: isSeat, onSit: onSit),
  );
}

class _FoldDetail extends StatefulWidget {
  const _FoldDetail({required this.fold, required this.isSeat, required this.onSit});

  final ShelfFold fold;
  final bool isSeat;
  final Future<void> Function() onSit;

  @override
  State<_FoldDetail> createState() => _FoldDetailState();
}

class _FoldDetailState extends State<_FoldDetail> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final f = widget.fold;
    final have = f.owned || f.starter;
    final name = MobV3Copy.foldName(f.key);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(child: FoldPuppet(fold: f.key, size: 224, large: true, locked: !have, blink: have, fallbackName: name)),
        const SizedBox(height: MmSpace.s16),
        Text(MobV3Copy.foldLine(f.key), textAlign: TextAlign.center, style: type.subhead.copyWith(color: c.ink)),
        if (!have) ...[
          const SizedBox(height: MmSpace.s8),
          Text(MobV3Copy.lockedRule(f), textAlign: TextAlign.center, style: type.body.copyWith(color: c.ink2)),
        ],
        const SizedBox(height: MmSpace.s8),
        MobNote(MobV3Copy.creaseLabel(f.folds), center: true),
        if (have) ...[
          const SizedBox(height: MmSpace.s16),
          if (widget.isSeat)
            MobNote(MobV3Copy.shelfSeatTag(name), center: true)
          else
            KeyButton(
              key: const ValueKey('s1-play-as'),
              label: MobV3Copy.playAs(f.key),
              loading: _busy,
              onPressed: _busy
                  ? null
                  : () async {
                      setState(() => _busy = true);
                      await widget.onSit();
                      if (context.mounted) Navigator.of(context).pop();
                    },
            ),
        ],
        const SizedBox(height: MmSpace.s8),
      ],
    );
  }
}

// ---------------------------------------------------------------------------------------------------
// Finishes and the Mob's shelf
// ---------------------------------------------------------------------------------------------------

class _FinishRow extends ConsumerWidget {
  const _FinishRow({required this.foil, required this.seat, required this.seatFinish});

  final FinishProgress foil;
  final FoldKey seat;
  final FoldFinish seatFinish;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.mmColors;
    final type = context.mmType;
    final need = foil.need ?? 30;
    final have = (foil.have ?? 0).clamp(0, need);
    return DecoratedBox(
      decoration: BoxDecoration(color: c.raised, borderRadius: MmRadius.panelAll, border: Border.all(color: c.line)),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Opacity(opacity: foil.owned ? 1 : 0.5, child: Image.asset('assets/art/foil-seal.webp', width: 48, height: 48, errorBuilder: (_, _, _) => const SizedBox(width: 48, height: 48))),
                const SizedBox(width: MmSpace.s16),
                Expanded(child: Text(foil.owned ? MobV3Copy.foilEarned : MobV3Copy.foilProgress(have, need), style: type.body.copyWith(color: c.ink))),
              ],
            ),
            if (!foil.owned) ...[
              const SizedBox(height: MmSpace.s12),
              ExcludeSemantics(child: _ProgressBar(value: need == 0 ? 0 : have / need)),
            ] else ...[
              const SizedBox(height: MmSpace.s8),
              Row(
                children: [
                  Expanded(child: Text(MobV3Copy.foilWear, style: type.body.copyWith(color: c.ink2))),
                  MmSwitch(
                    value: seatFinish == FoldFinish.foil,
                    semanticsLabel: MobV3Copy.foilWear,
                    onChanged: (on) async {
                      ref.read(hapticsProvider).toggle(on);
                      try {
                        await ref.read(mobV3ApiProvider).profile(seat, finish: on ? FoldFinish.foil : FoldFinish.plain);
                        ref.invalidate(shelfProvider);
                        await ref.read(mobV3ActionsProvider).refresh();
                      } on Object catch (e) {
                        if (context.mounted) showMobToast(context, mobV3Say(e));
                      }
                    },
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return ClipRRect(
      borderRadius: MmRadius.pillAll,
      child: SizedBox(
        height: 8,
        child: LayoutBuilder(
          builder: (context, box) => Stack(
            children: [
              Positioned.fill(child: ColoredBox(color: c.line)),
              Positioned(left: 0, top: 0, bottom: 0, width: box.maxWidth * value.clamp(0.0, 1.0), child: ColoredBox(color: c.ink3)),
            ],
          ),
        ),
      ),
    );
  }
}

class _MobItemRow extends StatelessWidget {
  const _MobItemRow({required this.item});

  final ShelfItem item;

  IconData get _icon => switch (item.item) {
        'den_stamp' || 'den_stamp_row' || 'stamp' => LucideIcons.stamp,
        'desk_bell' => LucideIcons.bell,
        'brass_lamp' => LucideIcons.lampDesk,
        'foil_seal' => LucideIcons.award,
        _ => LucideIcons.award,
      };

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final status = item.owned ? MobV3Copy.mobShelfOwned : MobV3Copy.mobShelfNext(item.have, item.need);
    return MergeSemantics(
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 56),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: item.owned ? c.raised2 : Colors.transparent,
                borderRadius: MmRadius.smallAll,
                border: Border.all(color: item.owned ? c.lineStrong : c.line),
              ),
              child: Icon(_icon, size: 20, color: item.owned ? c.ink : c.ink4),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(MobV3Copy.itemName(item.item), style: type.cardTitle.copyWith(color: item.owned ? c.ink : c.ink2)),
                  Text(status, style: type.caption.copyWith(color: c.ink2)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
