import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/models/attempt.dart';
import '../copy.dart';
import '../data/insights_models.dart';
import '../data/last_look.dart';
import 'answer_sheet.dart';
import 'evidence.dart';
import 'insights_bits.dart';
import 'motion_bits.dart';

/// The record's anchor: the share answered right as one monumental number with its likely
/// range, then the student's answer sheet: one bubble for every question in the record, inked for
/// right, crossed for wrong, dashed for left blank. Every part is named with its count beside
/// it, and Show me under the legend opens the sessions behind it.
///
/// This is the screen's one lit element. The figure rolls and the sheet inks once per visit
/// (500 ms and 700 ms); a rebuild with the same record does neither, and reduced motion shows
/// the final state.
///
/// While the share right is not known (nothing answered yet), a sparse card stands in for the
/// figure: summed net marks over papers of different lengths are never the headline.
///
/// It reacts to a real change in the share right (a refresh landing while it is open, or a new
/// record since the last look this run): the figure rolls from the old to the new, only the
/// bubbles whose kind changed ink again, and for 4 s one line says how far it moved ("Up 3 points
/// since your last look"). A rise of 5 points or more also earns a small Mobi hop beside the line.
/// Nothing is said when there was no earlier look, and nothing is invented.
class LedgerHero extends ConsumerStatefulWidget {
  const LedgerHero({super.key, required this.insights, this.evidence});

  final PrepInsights insights;

  /// The sessions behind the ledger, newest first; null while they load (no Show me yet).
  final List<Attempt>? evidence;

  /// How long the change line stays.
  static const Duration noteFor = Duration(seconds: 4);

  @override
  ConsumerState<LedgerHero> createState() => _LedgerHeroState();
}

class _LedgerHeroState extends ConsumerState<LedgerHero> {
  final AnswerSheetController _sheet = AnswerSheetController();
  final MobiController _mobi = MobiController();
  late final LastLookStore _store = ref.read(lastLookProvider.notifier);
  Timer? _hide;
  int? _delta;
  bool _hop = false;

  @override
  void initState() {
    super.initState();
    // The look before this one, if the student has had one this run.
    final before = ref.read(lastLookProvider)?.pct;
    _react(before, widget.insights.accuracy.pct);
    _remember();
  }

  @override
  void didUpdateWidget(LedgerHero old) {
    super.didUpdateWidget(old);
    _react(old.insights.accuracy.pct, widget.insights.accuracy.pct);
    _remember();
  }

  void _remember() {
    final pct = widget.insights.accuracy.pct;
    if (pct == null) return;
    // After the frame: a provider is never written while the tree is building.
    WidgetsBinding.instance.addPostFrameCallback((_) => _store.remember(pct));
  }

  /// Says what moved between [from] and [to], once, for [LedgerHero.noteFor].
  void _react(int? from, int? to) {
    final change = shareChange(from, to);
    if (change == null) return;
    _delta = change;
    _hop = change >= hopRise;
    _hide?.cancel();
    _hide = Timer(LedgerHero.noteFor, () {
      if (mounted) {
        setState(() {
          _delta = null;
          _hop = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _hide?.cancel();
    _mobi.dispose();
    _sheet.dispose();
    super.dispose();
  }

  Widget _note(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final change = _delta;
    final reduced = Motion.reduced(context);
    Widget child = const SizedBox(width: double.infinity, key: ValueKey('no-change'));
    if (change != null) {
      final up = change > 0;
      final text = InsightsCopy.sinceLastLook(change);
      child = Padding(
        key: const ValueKey('change'),
        padding: const EdgeInsets.only(top: MmSpace.s8),
        child: Semantics(
          liveRegion: true,
          label: text,
          excludeSemantics: true,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  text,
                  key: const ValueKey('since-last-look'),
                  style: type.small.copyWith(fontWeight: FontWeight.w600, color: up ? (colors.isNight ? colors.volt : colors.accentText) : colors.ink2),
                ),
              ),
              if (_hop) ...[
                const SizedBox(width: MmSpace.s8),
                SizedBox(
                  width: MobiFigure.widthFor(40),
                  height: 40,
                  // A small hop for a real rise, then he stands beside the line until it goes.
                  child: MobiCharacter(controller: _mobi, size: 40, entrance: MobiAct.correct, seed: 41, watchTaps: false, shadow: false),
                ),
              ],
            ],
          ),
        ),
      );
    }
    return AnimatedSize(
      duration: reduced ? Duration.zero : Motion.ui,
      curve: Motion.out,
      alignment: Alignment.topLeft,
      child: AnimatedSwitcher(
        duration: reduced ? Duration.zero : Motion.ui,
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final insights = widget.insights;
    final evidence = widget.evidence;
    final colors = context.mmColors;
    final type = context.mmType;
    final l = insights.ledger;
    final net = l.net;
    final a = insights.accuracy;
    final counts = SheetCounts.of(l.right, l.wrong, l.blank);
    final haptics = mmHapticsOf(context);
    return LitEdge(
      glow: true,
      child: FakeGlass(
        lamp: true,
        opacity: colors.isNight ? 0.5 : 0.8,
        child: Stack(
          children: [
            Positioned.fill(child: IgnorePointer(child: LightField.lamp(context, strength: 0.8, center: const Alignment(-1.1, -1.25)))),
            Padding(
              padding: const EdgeInsets.all(MmSpace.s20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(InsightsCopy.recordBasis(insights.sessions, insights.questions), style: type.small.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  // The hero is the share answered right, a number that means the same over 5
                  // questions or 500; the net marks go in the legend (review round 1: "+324 net"
                  // summed papers of different lengths). Large text scales the figure down
                  // rather than pushing it off.
                  if (a.known)
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: _ShareFigure(
                        pct: a.pct!,
                        // The roll lands after the page has arrived, with one tick.
                        onLanded: () => haptics?.selection(),
                      ),
                    )
                  else
                    _SparseCard(answered: l.right + l.wrong, blank: l.blank),
                  if (a.known && a.low != null && a.high != null) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(InsightsCopy.accuracyHeroLine(a.low!, a.high!), style: type.body.copyWith(color: colors.ink2)),
                  ],
                  _note(context),
                  const SizedBox(height: MmSpace.s20),
                  if (counts.cells > 0) AnswerSheet(right: l.right, wrong: l.wrong, blank: l.blank, controller: _sheet),
                  if (counts.perBubble > 1) ...[
                    const SizedBox(height: MmSpace.s8),
                    Text(InsightsCopy.sheetScale(counts.perBubble), style: type.caption.copyWith(color: colors.ink3)),
                  ],
                  const SizedBox(height: MmSpace.s16),
                  // Until a share is known, a kind with no answers is left out: "0 right" beside a
                  // lit dot reads as an unfinished state, not a fact.
                  Wrap(
                    spacing: MmSpace.s16,
                    runSpacing: 0,
                    children: [
                      if (a.known || l.right > 0) LegendItem(state: BubbleState.filled, text: InsightsCopy.ledgerRight(l.right, l.gained), onTap: () => _sheet.ripple(SheetKind.right)),
                      if (a.known || l.wrong > 0) LegendItem(state: BubbleState.wrong, text: InsightsCopy.ledgerWrong(l.wrong), onTap: () => _sheet.ripple(SheetKind.wrong)),
                      LegendItem(state: BubbleState.blank, text: InsightsCopy.ledgerBlank(l.blank), onTap: () => _sheet.ripple(SheetKind.blank)),
                    ],
                  ),
                  if (evidence != null && evidence.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s4),
                    EvidencePill(attempts: evidence, what: InsightsCopy.behindLedger),
                  ],
                  if (a.known) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(InsightsCopy.netOver(net, insights.questions * 5, insights.sessions), style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2)),
                  ],
                  const SizedBox(height: MmSpace.s12),
                  Text(InsightsCopy.ledgerNote, style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The share right as one monumental number with its percent sign set tight beside it on the
/// digits' baseline (at 60% of their size), never raised and floating off to the side.
class _ShareFigure extends StatelessWidget {
  const _ShareFigure({required this.pct, this.onLanded});

  final int pct;
  final VoidCallback? onLanded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.figureHero;
    // The same size the digits are drawn at (the number scales with large text itself).
    final size = MediaQuery.textScalerOf(context).scale(style.fontSize ?? 96);
    final sign = size * 0.6;
    return Semantics(
      label: '$pct percent of answered questions right',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          ExcludeSemantics(
            child: MonumentalNumber(value: '$pct', style: style, delay: const Duration(milliseconds: 260), onLanded: onLanded),
          ),
          Padding(
            // The sign's baseline sits on the digits' baseline: both lines are set tight, so the
            // gap below each baseline is a fixed share of its own size.
            padding: EdgeInsets.only(left: size * 0.02, bottom: size * 0.202 - sign * 0.225),
            child: Text(
              '%',
              textScaler: TextScaler.noScaling,
              style: style.copyWith(fontSize: sign, height: 1, letterSpacing: 0, color: colors.ink2),
            ),
          ),
        ],
      ),
    );
  }
}

/// Stands in for the share right until there is something to share: one bubble per answered
/// question of the first ten (inked when answered), and the plain next step.
class _SparseCard extends StatelessWidget {
  const _SparseCard({required this.answered, required this.blank});

  final int answered;
  final int blank;

  static const int _goal = 10;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final inked = answered.clamp(0, _goal);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: true, child: Text(InsightsCopy.sparseTitle, style: type.title)),
        const SizedBox(height: MmSpace.s12),
        BubbleRow(
          states: [for (var i = 0; i < _goal; i++) i < inked ? BubbleState.filled : BubbleState.hollow],
          bubbleSize: 18,
          gap: 8,
          semanticsLabel: '$inked of $_goal answered',
        ),
        const SizedBox(height: MmSpace.s8),
        Text(InsightsCopy.sparseLine(answered, blank: blank), style: type.small.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// The findings the server read out, strongest first. The strongest leads: a large card with its
/// headline in the display face and the one thing to do about it as the screen's volt key. The
/// rest follow as quiet rows on a rail that says what kind they are (coral leak, volt working,
/// grey note). Each says how many questions it rests on, and carries Show me.
class FindingsPanel extends StatelessWidget {
  const FindingsPanel({super.key, required this.findings, required this.onAction, required this.evidence});

  /// Only findings with sessions behind them: the caller drops the rest.
  final List<Finding> findings;

  /// Null hides a finding's key (its href has no place in the app).
  final VoidCallback? Function(Finding f) onAction;

  /// The sessions behind each finding, newest first.
  final List<Attempt> Function(Finding f) evidence;

  @override
  Widget build(BuildContext context) {
    if (findings.isEmpty) return const SizedBox.shrink();
    final colors = context.mmColors;
    final rest = findings.skip(1).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _LeadFinding(finding: findings.first, onAction: onAction(findings.first), evidence: evidence(findings.first)),
        if (rest.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s8),
          // The other findings are not boxed: rails and hairlines carry them.
          for (var i = 0; i < rest.length; i++) ...[
            if (i > 0) Divider(height: 1, color: colors.line),
            _FindingRow(finding: rest[i], onAction: onAction(rest[i]), evidence: evidence(rest[i])),
          ],
        ],
      ],
    );
  }
}

/// The strongest finding: a plain card with its headline, what it rests on and the one thing to
/// do about it. No glow of its own, so the hero above stays the page's one lit element.
///
/// A small Mobi (34 dp) sits at the card's corner and reacts once per visit, when the card comes
/// into view, to what kind of finding it is: a leak points at the action key and then the key
/// sweeps once; something working gets a small hop; a note makes him think. He holds still under
/// reduced motion. Scrolling away and back does not play it again.
class _LeadFinding extends StatefulWidget {
  const _LeadFinding({required this.finding, required this.onAction, required this.evidence});

  final Finding finding;
  final VoidCallback? onAction;
  final List<Attempt> evidence;

  @override
  State<_LeadFinding> createState() => _LeadFindingState();
}

class _LeadFindingState extends State<_LeadFinding> with AutomaticKeepAliveClientMixin {
  final MobiController _mobi = MobiController();
  final GlobalKey _key = GlobalKey(debugLabel: 'lead-finding-key');
  final ValueNotifier<int> _sweep = ValueNotifier(0);
  Timer? _later;
  bool _reacted = false;

  @override
  bool get wantKeepAlive => _reacted;

  @override
  void dispose() {
    _later?.cancel();
    _mobi.dispose();
    _sweep.dispose();
    super.dispose();
  }

  /// The card is in view: Mobi answers it, once.
  void _react() {
    if (!mounted || _reacted) return;
    _reacted = true;
    updateKeepAlive();
    if (Motion.reduced(context)) return;
    final f = widget.finding;
    final hasKey = widget.onAction != null && f.actionLabel != null;
    if (f.isLeak && hasKey) {
      _mobi.pointAtWidget(_key);
      // The finger has landed; the key answers with one pass of light.
      _later = Timer(const Duration(milliseconds: 650), () {
        if (mounted) _sweep.value++;
      });
    } else if (f.isLeak) {
      _mobi.play(MobiAct.encourage);
    } else if (f.isGood) {
      _mobi.play(MobiAct.correct);
    } else {
      _mobi.play(MobiAct.think);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final colors = context.mmColors;
    final type = context.mmType;
    final f = widget.finding;
    final onAction = widget.onAction;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s16, MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            WhenInView(
              onVisible: _react,
              child: Row(
                children: [
                  Bubble(state: f.isLeak ? BubbleState.wrong : (f.isGood ? BubbleState.filled : BubbleState.marked), size: 22, animate: false),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(
                    child: Text(
                      f.isLeak ? InsightsCopy.kindLeak : (f.isGood ? InsightsCopy.kindGood : InsightsCopy.kindNote),
                      style: type.label.copyWith(color: colors.ink2),
                    ),
                  ),
                  SizedBox(
                    width: MobiFigure.widthFor(34),
                    height: 34,
                    child: MobiCharacter(controller: _mobi, size: 34, entrance: MobiAct.idle, seed: 53, watchTaps: false, shadow: false),
                  ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s16),
            Text(f.headline, style: type.title.copyWith(fontSize: 22, height: 26 / 22)),
            const SizedBox(height: MmSpace.s12),
            Text(f.detail, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s12),
            BasisLink(text: InsightsCopy.basedOn(f.n), attempts: widget.evidence, what: InsightsCopy.behindFinding),
            if (onAction != null && f.actionLabel != null) ...[
              const SizedBox(height: MmSpace.s4),
              KeyedSubtree(
                key: _key,
                child: KeySweep(
                  tick: _sweep,
                  child: KeyButton(label: f.id == 'chapter' ? InsightsCopy.practiseThisChapter : f.actionLabel!, onPressed: onAction),
                ),
              ),
              const SizedBox(height: MmSpace.s12),
            ] else
              const SizedBox(height: MmSpace.s8),
          ],
        ),
      ),
    );
  }
}

class _FindingRow extends StatelessWidget {
  const _FindingRow({required this.finding, required this.onAction, required this.evidence});

  final Finding finding;
  final VoidCallback? onAction;
  final List<Attempt> evidence;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final f = finding;
    final rail = f.isLeak ? colors.wrongMark : (f.isGood ? colors.volt : colors.ink4);
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, MmSpace.s16, 0, MmSpace.s4),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s12),
              child: DecoratedBox(decoration: BoxDecoration(color: rail, borderRadius: BorderRadius.circular(MmSpace.s2)), child: const SizedBox(width: MmSpace.s4)),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(f.headline, style: type.cardTitle),
                  const SizedBox(height: MmSpace.s4),
                  Text(f.detail, style: type.small.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s8),
                  BasisLink(text: InsightsCopy.basedOn(f.n), attempts: evidence, what: InsightsCopy.behindFinding),
                  if (onAction != null && f.actionLabel != null)
                    ActionLink(label: f.id == 'chapter' ? InsightsCopy.practiseThisChapter : f.actionLabel!, onTap: onAction!)
                  else
                    const SizedBox(height: MmSpace.s8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
