import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_combos.dart';
import '../domain/du_models.dart';
import 'combo_card.dart';

/// The ranked combinations. While a new plan is being checked Mobi waits (the loading pose) in place of the old
/// list (after a short beat, so a quick answer never flashes it). When the plan lands the cards
/// ink in, in rank order.
class ComboResults extends StatefulWidget {
  const ComboResults({super.key, required this.checking, required this.ranked, required this.catalog, required this.targetCount});

  final bool checking;
  final List<DuCombo> ranked;
  final DuCatalog catalog;
  final int targetCount;

  /// How long a check runs before the old list gives way to Mobi.
  static const Duration beat = Duration(milliseconds: 180);

  @override
  State<ComboResults> createState() => _ComboResultsState();
}

class _ComboResultsState extends State<ComboResults> {
  Timer? _timer;
  bool _slow = false;

  @override
  void initState() {
    super.initState();
    if (widget.checking) _startBeat();
  }

  @override
  void didUpdateWidget(ComboResults old) {
    super.didUpdateWidget(old);
    if (widget.checking && !old.checking) {
      _startBeat();
    } else if (!widget.checking) {
      _timer?.cancel();
      _slow = false;
    }
  }

  void _startBeat() {
    _timer?.cancel();
    _timer = Timer(ComboResults.beat, () {
      if (mounted) setState(() => _slow = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Changes whenever the ranked answer changes, so a new plan inks in again.
  String get _signature => [for (final c in widget.ranked) c.selection.encode()].join('|');

  @override
  Widget build(BuildContext context) {
    if (widget.checking && (_slow || widget.ranked.isEmpty)) return const _Checking();
    final sig = _signature;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < widget.ranked.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s16),
            child: ComboReveal(
              key: ValueKey('$sig#$i'),
              index: i,
              builder: (context, inked) => ComboCard(
                combo: widget.ranked[i],
                rank: i,
                catalog: widget.catalog,
                targetCount: widget.targetCount,
                inked: inked,
              ),
            ),
          ),
      ],
    );
  }
}

class _Checking extends StatelessWidget {
  const _Checking();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      label: ToolsCopy.checking,
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter + 4, 0, MmSpace.gutter + 4, MmSpace.s16),
        child: Row(
          children: [
            const Mobi(pose: MobiPose.loading, size: 72, motion: MobiMotion.settle),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(ToolsCopy.checking, style: type.labelLarge.copyWith(color: colors.ink2))),
          ],
        ),
      ),
    );
  }
}

/// Brings one ranked card in: it rises 10 dp and fades up over 240 ms, each card [stagger]
/// after the one above (the first five only), and the card's answer bubble inks as it lands.
/// Under reduced motion the card cross-fades in 120 ms and the bubble is inked at once.
class ComboReveal extends StatefulWidget {
  const ComboReveal({super.key, required this.index, required this.builder});

  final int index;
  final Widget Function(BuildContext context, bool inked) builder;

  static const Duration stagger = Duration(milliseconds: 90);

  @override
  State<ComboReveal> createState() => _ComboRevealState();
}

class _ComboRevealState extends State<ComboReveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this);
  Animation<double> _in = const AlwaysStoppedAnimation(1);
  bool _inked = false;
  double _inkAt = 0;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _c.addListener(_onTick);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _inked = true;
      _c.duration = Motion.reducedFade;
      _in = CurvedAnimation(parent: _c, curve: Curves.linear);
      _c.forward();
      return;
    }
    final lead = ComboReveal.stagger * math.min(widget.index, 4);
    final total = lead + Motion.card;
    _c.duration = total;
    _in = CurvedAnimation(parent: _c, curve: Interval(lead.inMilliseconds / total.inMilliseconds, 1, curve: Motion.out));
    _inkAt = (lead.inMilliseconds + Motion.card.inMilliseconds * 0.55) / total.inMilliseconds;
    _c.forward();
  }

  void _onTick() {
    if (!_inked && _c.value >= _inkAt) setState(() => _inked = true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return AnimatedBuilder(
      animation: _in,
      builder: (context, child) => Opacity(
        opacity: _in.value.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, reduced ? 0 : 10 * (1 - _in.value)), child: child),
      ),
      child: widget.builder(context, _inked),
    );
  }
}
