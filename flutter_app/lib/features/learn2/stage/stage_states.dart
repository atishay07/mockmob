/// The stage's centred states (the web's `.st-state`, `.st-cp`, the loading stage; A1 3.8, 3.10):
///
///   StageCentre       a title (Bricolage 26), a line (15 ink-2) and a column of keys, centred, at most 420 dp wide:
///                     "The feed did not start", "Nothing to play here yet", "Today's free session is used"
///   StageCheckpoint   the pause after every 8 items (R2 screens 12): the big number (Bricolage 44, "2 of 3 right", never a
///                     zero), one line ("8 of 21 done, about 6 min left.") and the cards kept so far as the small fan
///   StageSkeleton     the whole stage while a feed or a run starts: the real Close, the title or a bar, one hairline
///                     for the ticks, a card skeleton at the card's least height, skeleton keys in the action bar
library;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/skeleton.dart';
import 'end_form.dart' show StageKeptFan, StagePileCard;
import 'stage_balance.dart';
import 'stage_frame.dart';
import 'stage_sizes.dart';
import 'stage_ticks.dart';

/// A centred state: [title], [line] and [keys] (the lead volt key first; text keys are centred).
class StageCentre extends StatelessWidget {
  const StageCentre({super.key, required this.title, this.line, this.keys = const [], this.titleKey});

  final String title;
  final String? line;
  final List<Widget> keys;
  final GlobalKey? titleKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            key: titleKey,
            header: true,
            child: StageBalancedText(
              TextSpan(text: title, style: type.headline.copyWith(fontSize: 26, height: 1.15, letterSpacing: -0.26, color: colors.ink)),
              textAlign: TextAlign.center,
            ),
          ),
          if (line != null && line!.isNotEmpty) ...[
            const SizedBox(height: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Text(
                line!,
                textAlign: TextAlign.center,
                style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2),
              ),
            ),
          ],
          if (keys.isNotEmpty) ...[
            const SizedBox(height: 24),
            for (final (i, k) in keys.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              SizedBox(width: double.infinity, child: Center(child: k)),
            ],
          ],
        ],
      ),
    );
  }
}

/// The checkpoint's body (put it on a centre page of the pager; R2 screens 12, R3 L3): one headline that never leads with a zero
/// (Bricolage 44, popping in over 220 ms from 0.96), one line under it, and the cards kept so far as the small fan. No mini pile,
/// no third line.
class StageCheckpoint extends StatelessWidget {
  const StageCheckpoint({super.key, required this.big, required this.status, this.keptCards = const []});

  /// "2 of 3 right" / "2 questions tried" / "3 for Revise" / "6 cards seen" / "8 done" (`StageEndModel.checkpointLines`).
  final String big;

  /// "8 of 21 done, about 6 min left." ("About 6 min left." with nothing done; empty when there is nothing to say).
  final String status;

  /// The cards kept in this feed: the fan under the line (empty: none).
  final List<StagePileCard> keptCards;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final quiet = type.body.copyWith(fontSize: 15.5, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 420),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _CheckpointPop(
            child: StageBalancedText(
              TextSpan(
                text: big,
                style: type.headline.copyWith(
                  fontSize: 44,
                  height: 1.05,
                  letterSpacing: -0.44,
                  color: colors.ink,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              textAlign: TextAlign.center,
            ),
          ),
          if (status.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(status, textAlign: TextAlign.center, style: quiet),
          ],
          if (keptCards.isNotEmpty) ...[
            const SizedBox(height: 20),
            StageKeptFan(cards: keptCards, small: true, height: 128),
          ],
        ],
      ),
    );
  }
}

/// `st-cp-pop`: the checkpoint's headline arrives over 220 ms from 0.96 and 60% opacity (nothing under reduced motion).
class _CheckpointPop extends StatefulWidget {
  const _CheckpointPop({required this.child});

  final Widget child;

  @override
  State<_CheckpointPop> createState() => _CheckpointPopState();
}

class _CheckpointPopState extends State<_CheckpointPop> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 220), value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    child: widget.child,
    builder: (context, child) {
      final t = Motion.out.transform(_c.value);
      return Opacity(opacity: 0.6 + 0.4 * t, child: Transform.scale(scale: 0.96 + 0.04 * t, child: child));
    },
  );
}

/// The whole stage while it starts: the frame with the real Close, the [title] (or a 140 dp bar), one hairline for
/// the ticks, a card skeleton at the card's least height (a kind bar, three prompt bars, a foot bar), and skeleton
/// keys in the action bar. [slow] adds a line under the card ("Taking longer than usual." and Try again).
class StageSkeleton extends StatelessWidget {
  const StageSkeleton({super.key, required this.onClose, this.title, this.label = 'Starting the feed', this.closeLabel = 'Close', this.slow});

  final VoidCallback onClose;
  final String? title;
  final String label;
  final String closeLabel;
  final Widget? slow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final screen = MediaQuery.sizeOf(context).height;
    final minH = StageSizes.cardMin(screen);
    final card = Container(
      constraints: BoxConstraints(minHeight: minH),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(StageSizes.cardRadius),
        border: Border.all(color: colors.line),
      ),
      child: SizedBox(
        height: minH - 42,
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Skeleton(width: 80, height: 12, radius: 8),
            SizedBox(height: 36),
            FractionallySizedBox(widthFactor: 0.86, child: Skeleton(height: 28, radius: 8)),
            SizedBox(height: 12),
            FractionallySizedBox(widthFactor: 0.72, child: Skeleton(height: 28, radius: 8)),
            SizedBox(height: 12),
            FractionallySizedBox(widthFactor: 0.40, child: Skeleton(height: 28, radius: 8)),
            Spacer(),
            Skeleton(width: 180, height: 12, radius: 8),
          ],
        ),
      ),
    );
    return StageFrame(
      label: label,
      onClose: onClose,
      closeLabel: closeLabel,
      title: title ?? '',
      titleWidget: title == null ? const Align(alignment: Alignment.centerLeft, child: Skeleton(width: 140, height: 14, radius: 6)) : null,
      ticks: const StageTicks(),
      busy: true,
      left: const _SkeletonGlyph(),
      right: const _SkeletonGlyph(),
      main: const [Skeleton(height: 52, radius: 14)],
      child: Semantics(
        label: label,
        liveRegion: true,
        child: SkeletonGroup(
          label: label,
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 0.04 * screen),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                card,
                const SizedBox(height: 28),
                if (slow != null) Center(child: slow!),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SkeletonGlyph extends StatelessWidget {
  const _SkeletonGlyph();

  @override
  Widget build(BuildContext context) => const Padding(padding: EdgeInsets.only(bottom: 18), child: Skeleton.circle(size: 48));
}
