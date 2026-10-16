import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_combos.dart';
import '../domain/du_eligibility.dart' show duDescribeGap;
import '../domain/du_models.dart';
import 'combo_card.dart';
import '../widgets/size_reveal.dart';
import '../widgets/tools_page.dart' show ToolsPanel, ToolsRowFrame;

/// The ranked combinations. While a new plan is being checked Mobi waits (the loading pose) in place of the old
/// list (after a short beat, so a quick answer never flashes it). When the plan lands the cards
/// ink in, in rank order.
class ComboResults extends StatefulWidget {
  const ComboResults({super.key, required this.checking, required this.ranked, required this.catalog, required this.targetCount, this.afterBest, this.foldOthers = false});

  final bool checking;
  final List<DuCombo> ranked;
  final DuCatalog catalog;
  final int targetCount;

  /// Shown under the best combination (the "Keep these" reasons), before the other options.
  final Widget? afterBest;

  /// The options after the best fold under "Other options (n)" (the result-first view, L27).
  final bool foldOthers;

  /// How long a check runs before the old list gives way to Mobi.
  static const Duration beat = Duration(milliseconds: 180);

  @override
  State<ComboResults> createState() => _ComboResultsState();
}

/// What Mobi does and says once a plan lands, from the best combination's real result.
@immutable
class ComboOutcome {
  const ComboOutcome(this.act, this.line);

  final MobiAct act;
  final String line;

  /// How long the reaction stays before it collapses.
  static const Duration hold = Duration(milliseconds: 2400);

  /// All targets met: a small cheer. Some met: a nudge at the missed one. None: encouragement,
  /// with what the nearest combination still needs. Null when there are no targets to judge.
  static ComboOutcome? of(List<DuCombo> ranked, int targets, DuCatalog catalog) {
    if (ranked.isEmpty || targets <= 0) return null;
    final best = ranked.first;
    final met = best.met.length;
    final missed = best.missed.isEmpty ? null : best.missed.first;
    final needs = missed?.nearest == null
        ? null
        : [for (final g in missed!.nearest!.gaps) duDescribeGap(g, catalog).replaceFirst('Add ', '')].join(', ');
    final line = ComboWords.reaction(met: met, targets: targets, missedName: missed?.name, needs: needs);
    final act = met >= targets
        ? MobiAct.cheer
        : met > 0
            ? MobiAct.nudge
            : MobiAct.encourage;
    return ComboOutcome(act, line);
  }
}

class _ComboResultsState extends State<ComboResults> {
  bool _othersOpen = false;
  Timer? _timer;
  Timer? _reactTimer;
  bool _slow = false;
  ComboOutcome? _outcome;

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
      _reactTimer?.cancel();
      _outcome = null;
    } else if (!widget.checking) {
      _timer?.cancel();
      _slow = false;
      // A plan has just landed after a check: one reaction, from the real result, then it goes.
      if (old.checking) {
        _outcome = ComboOutcome.of(widget.ranked, widget.targetCount, widget.catalog);
        _reactTimer?.cancel();
        if (_outcome != null) {
          _reactTimer = Timer(ComboOutcome.hold, () {
            if (mounted) setState(() => _outcome = null);
          });
        }
      }
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
    _reactTimer?.cancel();
    super.dispose();
  }

  /// Changes whenever the ranked answer changes, so a new plan inks in again.
  String get _signature => [for (final c in widget.ranked) c.selection.encode()].join('|');

  @override
  Widget build(BuildContext context) {
    if (widget.checking && (_slow || widget.ranked.isEmpty)) return const _Checking();

    final outcome = _outcome;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizeReveal(
          child: outcome == null ? const SizedBox(width: double.infinity) : _Reaction(key: ValueKey(outcome.line), outcome: outcome),
        ),
        for (var i = 0; i < widget.ranked.length; i++) ...[
          if (i == 0 || !widget.foldOthers || _othersOpen) card(i),
          if (i == 0 && widget.afterBest != null) widget.afterBest!,
          if (i == 0 && widget.foldOthers && widget.ranked.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s16),
              child: ToolsPanel(
                children: [
                  ToolsRowFrame(
                    key: const ValueKey('other-options'),
                    onTap: () => setState(() => _othersOpen = !_othersOpen),
                    semanticsLabel: ComboFoldCopy.semantics(widget.ranked.length - 1, _othersOpen),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            ComboFoldCopy.title(widget.ranked.length - 1),
                            style: context.mmType.labelLarge.copyWith(color: context.mmColors.accentText),
                          ),
                        ),
                        AnimatedRotation(
                          turns: _othersOpen ? 0.5 : 0,
                          duration: Motion.of(context, Motion.ui),
                          curve: Motion.glide,
                          child: Icon(LucideIcons.chevronDown, size: 18, color: context.mmColors.accentText),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }

  Widget card(int i) => Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s16),
        child: ComboReveal(
          key: ValueKey('$_signature#$i'),
          index: i,
          builder: (context, inked) => ComboCard(
            combo: widget.ranked[i],
            rank: i,
            catalog: widget.catalog,
            targetCount: widget.targetCount,
            best: i == 0 ? null : widget.ranked.first,
            inked: inked,
          ),
        ),
      );
}

abstract final class ComboFoldCopy {
  static String title(int n) => 'Other options ($n)';
  static String semantics(int n, bool open) => open ? 'Hide the other $n options' : 'Show $n other options';
}

/// Mobi's one reaction to a landed plan: 56 dp, an act from the result, one line. It collapses
/// after [ComboOutcome.hold]; the line is the same information under reduced motion.
class _Reaction extends StatelessWidget {
  const _Reaction({super.key, required this.outcome});

  final ComboOutcome outcome;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      label: outcome.line,
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16),
        child: Row(
          children: [
            Mobi(pose: MobiPose.think, size: 56, entrance: outcome.act),
            const SizedBox(width: MmSpace.s12),
            Expanded(child: Text(outcome.line, style: type.labelLarge)),
          ],
        ),
      ),
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
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s16),
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
