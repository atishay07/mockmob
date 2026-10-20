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
      rows.add(_MomentRow(place: who, sentence: MobV4ResultsCopy.momentDid(m, count), pose: _poseFor(m.kind)));
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

    final run = RunStep.maybeOf(context);
    // In the results run Fix it together is its own screen after this one: the trap card stays off here.
    final Widget shownCard = run != null && trap != null ? const SizedBox.shrink() : card;
    final Widget key;
    if (run != null) {
      key = Row(
        children: [
          if (run.onRematch != null && !aloneInMob) ...[
            // The secondary is the smaller of the two (2 to 3).
            Expanded(flex: 2, child: KeyButton.secondary(key: const ValueKey('moments-rematch'), label: MobV4ResultsCopy.rematch, onPressed: run.onRematch)),
            const SizedBox(width: MmSpace.s12),
          ],
          Expanded(flex: 3, child: KeyButton(key: const ValueKey('moments-continue'), label: run.last ? MobV4ResultsCopy.toTheDen : MobV4ResultsCopy.continueKey, onPressed: run.onNext)),
        ],
      );
    } else {
      key = trap != null
          ? KeyButton(label: MobV3Copy.fixTogether(trap.number), onPressed: () => MobV3Nav.fix(context, gameId, trap.q))
          : KeyButton(label: MobV3Copy.backToDen, onPressed: () => Navigator.of(context, rootNavigator: true).popUntil((r) => r.isFirst));
    }

    final title = data.game?.title ?? '';
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, MmSpace.gutter, 4),
            child: Row(
              children: [
                MmPressable(
                  onTap: run?.onExit ?? () => Navigator.of(context).maybePop(),
                  semanticsLabel: run != null ? MobV3Copy.close : MobV3Copy.back,
                  focusRadius: BorderRadius.circular(999),
                  builder: (context, pressed, _) => SizedBox(width: 48, height: 48, child: Icon(run != null ? LucideIcons.x : LucideIcons.arrowLeft, color: pressed ? c.ink2 : c.ink)),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: runHeaderMiddle(
                    context,
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (title.isNotEmpty) Text(title, style: type.subhead.copyWith(color: c.ink)),
                        Text(p.soFar ? MobV3Copy.soFar : MobV3Copy.finalLabel, style: type.caption.copyWith(color: c.ink3)),
                      ],
                    ),
                  ),
                ),
                // The X side is 4 + 48 + 4; with the 16 gutter a 40 slot centres the dots.
                if (run != null) const SizedBox(width: 40),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Rise(
                    index: 0,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(header: true, child: Text(onlyYou ? MobV3Copy.momentsTitleYou : MobV3Copy.momentsTitle, style: type.display.copyWith(color: c.ink))),
                        const SizedBox(height: MmSpace.s8),
                        Text(MobV4ResultsCopy.momentsSub, key: const ValueKey('moments-sub'), style: type.body.copyWith(color: c.ink2)),
                      ],
                    ),
                  ),
                  const SizedBox(height: MmSpace.s16),
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) Divider(height: 1, thickness: 1, color: c.line),
                    _Rise(index: 1 + i, child: rows[i]),
                  ],
                  const SizedBox(height: MmSpace.s24),
                  _Rise(index: 1 + rows.length, child: shownCard),
                  if (!aloneInMob) ...[
                    const SizedBox(height: MmSpace.s24),
                    _Rise(index: 2 + rows.length, child: StickerRow(kinds: StickerKind.results, gameId: gameId, label: MobV3Copy.sendSticker, grid: true, flyHere: true)),
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

/// The Fold's pose for a moment: a cheer for a win of the run, a think for a careful one, idle for playing it through.
FoldPose _poseFor(MomentKind k) => switch (k) {
      MomentKind.allRight || MomentKind.threeInARow || MomentKind.mostAnswered || MomentKind.fastestRight || MomentKind.quickestFinish => FoldPose.cheer,
      MomentKind.noMinus => FoldPose.think,
      MomentKind.finishedAll || MomentKind.raced => FoldPose.idle,
    };

/// One member's moment (MOB-MINIMAL 3.4 item 2): their Fold in a fitting pose, the sentence, and their marks on the
/// right in condensed tabular figures.
class _MomentRow extends StatelessWidget {
  const _MomentRow({required this.place, required this.sentence, this.pose = FoldPose.idle});

  final PodiumPlace place;
  final String sentence;
  final FoldPose pose;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final name = place.you ? 'You' : place.name;
    final marks = place.private ? null : place.marks;
    final first = sentence;
    return Semantics(
      label: marks == null ? '$name $sentence' : '$name $sentence ${MobV4ResultsCopy.marksUnit(marks)}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 64,
              child: Center(
                child: FoldPuppet(fold: place.fold, size: 56, pose: pose, shadow: false, blink: false, fallbackName: place.name, fallbackColour: place.colour),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '$name ', style: type.body.copyWith(color: c.ink, fontWeight: FontWeight.w700)),
                  TextSpan(text: first, style: type.body.copyWith(color: c.ink2)),
                ]),
                key: ValueKey('moment-${place.memberId}'),
              ),
            ),
            if (marks != null) ...[
              const SizedBox(width: MmSpace.s12),
              Column(
                key: ValueKey('moment-marks-${place.memberId}'),
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('$marks', style: type.figureCompact.copyWith(color: c.ink, fontSize: 28, height: 1, fontFeatures: const [FontFeature.tabularFigures()])),
                  Text(MobV4ResultsCopy.marksLabel, style: type.caption.copyWith(color: c.ink3)),
                ],
              ),
            ],
          ],
        ),
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
