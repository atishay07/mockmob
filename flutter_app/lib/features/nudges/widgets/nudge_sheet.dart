import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../social/v3/data/mob_v3_models.dart' show FoldKey, FoldPose;
import '../../social/v3/widgets/fold_puppet.dart';
import '../../wallet/widgets/credit_coins.dart';
import '../data/nudge_facts.dart' show NudgeView;
import '../nudge_rules.dart' show NudgeKind;

/// Opens the sheet for [view] (a friend's reward, a friend's game): the art, the title, one line, one key and a
/// quiet second key. Completes when it closes.
Future<void> showNudgeSheet(BuildContext context, NudgeView view, {required VoidCallback onKey, VoidCallback? onSecondary}) => showMmSheet<void>(
      context: context,
      builder: (sheet) => NudgeSheetBody(view: view),
      footer: (sheet) => NudgeSheetKeys(
        view: view,
        onKey: () {
          Navigator.of(sheet).maybePop();
          onKey();
        },
        onSecondary: () {
          Navigator.of(sheet).maybePop();
          onSecondary?.call();
        },
      ),
    );

/// The sheet's art and words. The art leads: the reward figure with its coins between two Folds cheering, or the
/// friend's Fold on the den's stage.
class NudgeSheetBody extends StatelessWidget {
  const NudgeSheetBody({super.key, required this.view, this.enter = true});

  final NudgeView view;

  /// Plays the art's entrance (a hop and the figure's rise); false draws it at rest.
  final bool enter;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.momentGutter, MmSpace.s8, MmSpace.momentGutter, MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(child: view.kind == NudgeKind.friendPaid ? _RewardStage(reward: view.reward, enter: enter) : _GameStage(view: view, enter: enter)),
          const SizedBox(height: MmSpace.s20),
          Semantics(header: true, child: Text(view.title, textAlign: TextAlign.center, style: type.title.copyWith(color: colors.ink))),
          const SizedBox(height: MmSpace.s8),
          Text(view.line, textAlign: TextAlign.center, style: type.body.copyWith(color: colors.ink2)),
        ],
      ),
    );
  }
}

/// One key and the quiet second one, pinned under the body.
class NudgeSheetKeys extends StatelessWidget {
  const NudgeSheetKeys({super.key, required this.view, required this.onKey, required this.onSecondary});

  final NudgeView view;
  final VoidCallback onKey;
  final VoidCallback onSecondary;

  @override
  Widget build(BuildContext context) {
    final secondary = view.secondary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        KeyButton(key: const ValueKey('nudge-sheet-key'), label: view.key, onPressed: onKey),
        if (secondary != null) ...[
          const SizedBox(height: MmSpace.s4),
          Center(child: KeyButton.quiet(key: const ValueKey('nudge-sheet-secondary'), label: secondary, onPressed: onSecondary)),
        ],
      ],
    );
  }
}

/// A one-shot entrance for the sheet's art: [child] rises 12 dp and fades in after [delay]; a fade alone under
/// reduced motion.
class _Rise extends StatefulWidget {
  const _Rise({required this.child, this.delay = Duration.zero, this.enter = true});

  final Widget child;
  final Duration delay;
  static const double rise = 12;
  final bool enter;

  @override
  State<_Rise> createState() => _RiseState();
}

class _RiseState extends State<_Rise> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.card, value: widget.enter ? 0 : 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started || !widget.enter) return;
    _started = true;
    if (Motion.reduced(context)) _c.duration = Motion.reducedFade;
    Future<void>.delayed(widget.delay, () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final t = CurvedAnimation(parent: _c, curve: Motion.out);
    return AnimatedBuilder(
      animation: t,
      builder: (context, child) => Opacity(
        opacity: t.value,
        child: Transform.translate(offset: Offset(0, reduced ? 0 : (1 - t.value) * _Rise.rise), child: child),
      ),
      child: widget.child,
    );
  }
}

/// The den's floor under a Fold: a soft lit ellipse on the sheet.
class _Floor extends StatelessWidget {
  const _Floor({required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox(
      width: width,
      height: 22,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.all(Radius.elliptical(width / 2, 11)),
          gradient: RadialGradient(
            colors: [colors.lamp.withValues(alpha: colors.isNight ? 0.22 : 0.18), colors.lamp.withValues(alpha: 0)],
          ),
        ),
      ),
    );
  }
}

/// The reward: the server's figure, big, over the coins, between two Folds cheering.
class _RewardStage extends StatelessWidget {
  const _RewardStage({required this.reward, required this.enter});

  final int reward;
  final bool enter;

  static const double _fold = 76;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return SizedBox(
      height: 156,
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          const Positioned(left: 0, right: 0, bottom: 0, child: Center(child: _Floor(width: 280))),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s8),
                child: FoldPuppet(fold: FoldKey.hop, size: _fold, pose: FoldPose.cheer, act: enter ? FoldAct.cheer : FoldAct.none, actId: enter ? 1 : 0, blink: enter),
              ),
              const SizedBox(width: MmSpace.s12),
              _Rise(
                enter: enter,
                delay: const Duration(milliseconds: 120),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CreditCoins(size: 48),
                    const SizedBox(height: MmSpace.s4),
                    Text(
                      '$reward',
                      style: type.figure.copyWith(color: colors.ink, height: 1, fontFeatures: const [FontFeature.tabularFigures()]),
                    ),
                    const SizedBox(height: MmSpace.s16),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              Padding(
                padding: const EdgeInsets.only(bottom: MmSpace.s8),
                child: FoldPuppet(fold: FoldKey.crane, size: _fold, pose: FoldPose.cheer, mirror: true, phase: 1, act: enter ? FoldAct.cheer : FoldAct.none, actId: enter ? 1 : 0, blink: enter),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A friend's game: their Fold on the den's stage, waving.
class _GameStage extends StatelessWidget {
  const _GameStage({required this.view, required this.enter});

  final NudgeView view;
  final bool enter;

  @override
  Widget build(BuildContext context) {
    final starter = view.starter;
    return SizedBox(
      height: 156,
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          const Positioned(left: 0, right: 0, bottom: 0, child: Center(child: _Floor(width: 220))),
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s8),
            child: FoldPuppet(
              fold: starter?.fold,
              size: 120,
              pose: FoldPose.wave,
              act: enter ? FoldAct.hop : FoldAct.none,
              actId: enter ? 1 : 0,
              blink: enter,
              fallbackName: starter?.name ?? view.game?.starterFirstName ?? '',
              fallbackColour: starter?.colour ?? 0,
            ),
          ),
        ],
      ),
    );
  }
}
