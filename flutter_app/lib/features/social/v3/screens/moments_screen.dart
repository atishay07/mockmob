// R8 Everyone's moment (MOB-BUILD-SPEC-V3 5.3 R8, F3). One row per player: the Fold's head, the
// name ("You" for you) and the server's moment sentence. Then the trap card after close ("The
// question that caught most of you", never a count), or, while the game is open, when the answers
// open. A sticker row, and the key: "Fix question 4 together" with a trap, else "Back to the den".
//
// Privacy: the server never puts the trap question into a moment and never counts who was wrong;
// this screen shows only what it sends (moments come in place order, so nobody is singled out).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api_providers.dart' show nowProvider;
import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/key_button.dart';
import '../../../../core/widgets/pressable.dart';
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../mob_v3_nav.dart';
import '../widgets/fold_puppet.dart';
import '../widgets/mob_fx.dart';
import '../widgets/results_parts.dart';
import '../widgets/sticker_row.dart';

typedef MomentsData = ({Podium podium, MobGame? game, Review? review});

class MomentsScreen extends ConsumerStatefulWidget {
  const MomentsScreen({super.key, required this.gameId});
  final String gameId;

  @override
  ConsumerState<MomentsScreen> createState() => _MomentsScreenState();
}

class _MomentsScreenState extends ConsumerState<MomentsScreen> {
  late Future<MomentsData> _load = _fetch();

  Future<MomentsData> _fetch() async {
    final api = ref.read(mobV3ApiProvider);
    final podium = await api.podium(widget.gameId);
    MobGame? game;
    Review? review;
    try {
      game = await api.game(widget.gameId);
    } on Object {
      game = null;
    }
    if (podium.trap != null) {
      try {
        review = await api.review(widget.gameId);
      } on Object {
        review = null;
      }
    }
    return (podium: podium, game: game, review: review);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    return Scaffold(
      backgroundColor: c.ground,
      body: MobIdleScope(
        child: FutureBuilder<MomentsData>(
          future: _load,
          builder: (context, snap) {
            if (snap.hasError) {
              return ResultsRefused(message: MobV3Copy.error(snap.error!), onBack: () => Navigator.of(context).maybePop(), onRetry: () => setState(() => _load = _fetch()));
            }
            final d = snap.data;
            if (d == null) return const SizedBox.expand();
            return MomentsView(
              data: d,
              gameId: widget.gameId,
              mobName: ref.watch(denViewProvider)?.v3.name.text ?? '',
              mobSize: ref.watch(denViewProvider)?.v3.members.length,
              now: d.game?.serverNow ?? ref.read(nowProvider)(),
            );
          },
        ),
      ),
    );
  }
}

/// The loaded screen (public for tests and goldens).
class MomentsView extends StatelessWidget {
  const MomentsView({super.key, required this.data, required this.gameId, required this.mobName, required this.now, this.mobSize});

  final MomentsData data;
  final String gameId;
  final String mobName;
  final DateTime now;

  /// Members in the Mob, when known: a Mob of one has nobody to send a sticker to (walk M9).
  final int? mobSize;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final p = data.podium;
    final trap = p.trap;
    final fix = data.review?.trap?.fix;
    final count = data.game?.count ?? 5;
    final byId = {for (final x in p.places) x.memberId: x};
    final onlyYou = p.places.length == 1 && p.places.first.you;
    final aloneInMob = mobSize != null && mobSize! <= 1;
    final rows = <Widget>[];
    for (final m in p.moments) {
      final who = byId[m.memberId];
      if (who == null) continue;
      rows.add(_MomentRow(place: who, sentence: MobV3Copy.moment(m, count)));
    }

    final Widget card;
    if (trap != null) {
      final opens = fix?.check.opensAt;
      card = PaperCard(
        key: const ValueKey('moments-trap'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Text(MobV3Copy.trapCardTitle, style: type.cardTitle.copyWith(color: c.ink)),
            ),
            const SizedBox(height: 4),
            Text(MobV3Copy.trapCaught(trap.number), style: type.body.copyWith(color: c.ink2)),
            const SizedBox(height: MmSpace.s12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(child: StepTile(text: MobV3Copy.stepNow)),
                if (opens != null) ...[
                  const SizedBox(width: MmSpace.s8),
                  Expanded(child: StepTile(text: MobV3Copy.stepCheck(opens))),
                ],
              ],
            ),
            if (fix != null) ...[
              const SizedBox(height: MmSpace.s12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  FoldPuppet(fold: FoldKey.crane, size: 40, locked: true, blink: false, shadow: false),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SegmentProgress(have: fix.fixedCount, of: fix.fixedOf),
                        const SizedBox(height: 6),
                        Text(MobV3Copy.trapProgress(mobName.isEmpty ? 'Your Mob' : mobName, fix.fixedCount, fix.fixedOf), style: type.caption.copyWith(color: c.ink2, fontSize: 14, height: 1.35)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      );
    } else if (p.soFar && p.closesAt != null) {
      card = PaperCard(
        key: const ValueKey('moments-open'),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.clock3, size: 20, color: c.ink3)),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(MobV3Copy.answersOpenAt(p.closesAt!, now), style: type.body.copyWith(color: c.ink2))),
          ],
        ),
      );
    } else {
      card = const SizedBox.shrink();
    }

    final key = trap != null
        ? KeyButton(label: MobV3Copy.fixTogether(trap.number), onPressed: () => MobV3Nav.fix(context, gameId, trap.q))
        : KeyButton(label: MobV3Copy.backToDen, onPressed: () => Navigator.of(context, rootNavigator: true).popUntil((r) => r.isFirst));

    final title = data.game?.title ?? '';
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, MmSpace.gutter, 4),
            child: Row(
              children: [
                MmPressable(
                  onTap: () => Navigator.of(context).maybePop(),
                  semanticsLabel: MobV3Copy.back,
                  focusRadius: BorderRadius.circular(999),
                  builder: (context, pressed, _) => SizedBox(width: 48, height: 48, child: Icon(LucideIcons.arrowLeft, color: pressed ? c.ink2 : c.ink)),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title.isNotEmpty) Text(title, style: type.subhead.copyWith(color: c.ink)),
                      Text(p.soFar ? MobV3Copy.soFar : MobV3Copy.finalLabel, style: type.caption.copyWith(color: c.ink3)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Rise(index: 0, child: Semantics(header: true, child: Text(onlyYou ? MobV3Copy.momentsTitleYou : MobV3Copy.momentsTitle, style: type.title.copyWith(color: c.ink)))),
                  const SizedBox(height: MmSpace.s12),
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) const SizedBox(height: MmSpace.s12),
                    _Rise(index: 1 + i, child: rows[i]),
                  ],
                  const SizedBox(height: MmSpace.s24),
                  _Rise(index: 1 + rows.length, child: card),
                  if (!aloneInMob) ...[
                    const SizedBox(height: MmSpace.s24),
                    _Rise(index: 2 + rows.length, child: StickerRow(kinds: StickerKind.results, gameId: gameId, label: MobV3Copy.sendSticker, grid: true)),
                  ],
                ],
              ),
            ),
          ),
          Padding(padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16), child: key),
        ],
      ),
    );
  }
}

class _MomentRow extends StatelessWidget {
  const _MomentRow({required this.place, required this.sentence});

  final PodiumPlace place;
  final String sentence;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final name = place.you ? 'You' : place.name;
    return Semantics(
      label: MobV3Copy.momentRow(name, sentence),
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FoldHeadDisc(fold: place.fold, name: place.name, colour: place.colour, size: 44),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '$name: ', style: type.body.copyWith(color: c.ink, fontWeight: FontWeight.w700)),
                  TextSpan(text: sentence, style: type.body.copyWith(color: c.ink2)),
                ]),
                key: ValueKey('moment-${place.memberId}'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Rows rise in on the app's enter (360, emphasized), 45 ms apart; reduced motion fades 120 ms.
class _Rise extends StatelessWidget {
  const _Rise({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final rm = Motion.reduced(context);
    final delay = rm ? 0 : index * MotionDurations.staggerStep.inMilliseconds;
    final total = delay + (rm ? 120 : MotionDurations.enter.inMilliseconds);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total),
      builder: (context, v, child) {
        final t = ((v * total - delay) / (total - delay)).clamp(0.0, 1.0);
        final e = rm ? t : MotionCurves.emphasized.transform(t);
        return Opacity(opacity: e, child: Transform.translate(offset: Offset(0, rm ? 0 : 14 * (1 - e)), child: child));
      },
      child: child,
    );
  }
}

/// A refused or failed read: the sentence and Back (Try again when it may help).
class ResultsRefused extends StatelessWidget {
  const ResultsRefused({super.key, required this.message, required this.onBack, this.onRetry});

  final String message;
  final VoidCallback onBack;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.momentGutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            Text(message, key: const ValueKey('results-refused'), style: type.title.copyWith(color: c.ink)),
            const Spacer(),
            if (onRetry != null) ...[
              KeyButton(label: MobV3Copy.tryAgain, onPressed: onRetry),
              const SizedBox(height: MmSpace.s12),
              KeyButton.secondary(label: MobV3Copy.back, onPressed: onBack),
            ] else
              KeyButton(label: MobV3Copy.back, onPressed: onBack),
          ],
        ),
      ),
    );
  }
}
