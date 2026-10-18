// The paper reel's moment on Today (owner item D29, superseding D28's "Back from marking"): after a
// fresh submission the lead card offers, once, "Play your paper back, 20 s": the student's own
// marked paper played question by question. No marking wait, no receipt time, no second "open the
// result directly" link: one volt key plays it, and "Not now" is one tap. Either way the Up next
// card returns. The card shows the paper as its answer sheet, every bubble still hollow (nothing
// is given away before the reel plays), on the same lamp-lit stage as the move.
import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'today_entrance.dart';

class ReelHeroCard extends StatefulWidget {
  const ReelHeroCard({super.key, required this.sealed, required this.onPlay, required this.onLater, this.loading = false});

  final SealedHero sealed;
  final VoidCallback onPlay;
  final VoidCallback onLater;

  /// The paper is being read for the reel: the key shows it is working.
  final bool loading;

  /// How long a read may run before the card says it is still working. A slow connection can take a minute, and a spinner
  /// alone gave no reason (v15 walk).
  static const Duration slowAfter = Duration(seconds: 8);

  @override
  State<ReelHeroCard> createState() => _ReelHeroCardState();
}

class _ReelHeroCardState extends State<ReelHeroCard> {
  Timer? _slowTimer;
  bool _slow = false;

  SealedHero get sealed => widget.sealed;
  VoidCallback get onPlay => widget.onPlay;
  VoidCallback get onLater => widget.onLater;
  bool get loading => widget.loading;

  @override
  void initState() {
    super.initState();
    _watch();
  }

  @override
  void didUpdateWidget(ReelHeroCard old) {
    super.didUpdateWidget(old);
    if (old.loading != widget.loading) _watch();
  }

  void _watch() {
    _slowTimer?.cancel();
    _slow = false;
    if (widget.loading) {
      _slowTimer = Timer(ReelHeroCard.slowAfter, () {
        if (mounted) setState(() => _slow = true);
      });
    }
  }

  @override
  void dispose() {
    _slowTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const besideArt = heroArtClear - MmSpace.cardPadding;
    final n = sealed.questions;
    return HeroStage(
      subjectId: sealed.subjectId,
      art: sealed.subjectId == null ? null : HeroArtView(art: HeroArt.object(subject: sealed.subjectId)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: besideArt),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(sealed.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
                  const SizedBox(height: MmSpace.s6),
                  Semantics(
                    header: true,
                    child: Text(TodayCopy.reelTitle, maxLines: 2, style: type.title.copyWith(fontSize: 22, height: 27 / 22, color: colors.ink)),
                  ),
                ],
              ),
            ),
            if (n != null) ...[
              const SizedBox(height: MmSpace.s16),
              // The paper as its sheet, one hollow bubble per question: what the reel will play. It
              // stands beside the subject's object, never under it.
              Padding(
                padding: const EdgeInsets.only(right: besideArt),
                child: TodayEnter(
                  delay: const Duration(milliseconds: 200),
                  rise: 6,
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: BubbleGrid(
                      states: List<BubbleState>.filled(n, BubbleState.hollow),
                      sealed: true,
                      numbers: false,
                      bubbleSize: 11,
                      minGap: 5,
                      maxGap: 9,
                      rowGap: 7,
                      semanticsLabel: TodayCopy.reelSheetSemantics(n),
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: MmSpace.s16),
            Padding(
              padding: EdgeInsets.only(right: n == null ? besideArt : 0),
              child: Text(sealed.line, style: type.body.copyWith(color: colors.ink2)),
            ),
            if (sealed.moreLine != null) ...[
              const SizedBox(height: MmSpace.s4),
              Text(sealed.moreLine!, style: type.caption.copyWith(color: colors.ink3)),
            ],
            const SizedBox(height: MmSpace.s20),
            KeyButton(
              key: const ValueKey('reel-play'),
              label: TodayCopy.reelKey,
              detail: TodayCopy.reelLength,
              semanticsLabel: '${TodayCopy.reelKey}, ${TodayCopy.reelLength.replaceAll(' s', ' seconds')}',
              loading: loading,
              onPressed: onPlay,
            ),
            // A read that runs long says why the key is still turning, once, under it.
            MmSizeEase(
              duration: Motion.of(context, Motion.ui),
              curve: Motion.out,
              alignment: Alignment.topCenter,
              child: _slow && loading
                  ? Padding(
                      padding: const EdgeInsets.only(top: MmSpace.s8),
                      child: Text(TodayCopy.reelSlow, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink2)),
                    )
                  : const SizedBox(width: double.infinity),
            ),
            const SizedBox(height: MmSpace.s4),
            Center(child: KeyButton.quiet(key: const ValueKey('reel-later'), label: TodayCopy.reelLater, onPressed: loading ? null : onLater)),
          ],
        ),
      ),
    );
  }
}
