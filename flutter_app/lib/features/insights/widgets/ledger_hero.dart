import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/models/attempt.dart';
import '../copy.dart';
import '../data/insights_models.dart';
import 'answer_sheet.dart';
import 'evidence.dart';
import 'insights_bits.dart';

/// The record's anchor: the share answered right as one monumental number with its likely
/// range, then the student's answer sheet: one bubble for every question in the record, inked for
/// right, crossed for wrong, dashed for left blank. Every part is named with its count beside
/// it, and Show me under the legend opens the sessions behind it.
///
/// This is the screen's one lit element. The figure rolls and the sheet inks once per visit
/// (500 ms and 900 ms); a rebuild with the same record does neither, and reduced motion shows
/// the final state.
///
/// While the share right is not known (nothing answered yet), a sparse card stands in for the
/// figure: summed net marks over papers of different lengths are never the headline.
class LedgerHero extends StatelessWidget {
  const LedgerHero({super.key, required this.insights, this.evidence});

  final PrepInsights insights;

  /// The sessions behind the ledger, newest first; null while they load (no Show me yet).
  final List<Attempt>? evidence;

  @override
  Widget build(BuildContext context) {
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
              padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s20, MmSpace.cardPadding, MmSpace.s12),
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
                    Text(InsightsCopy.accuracyHeroLine(a.low!, a.high!), style: type.body.copyWith(fontSize: 15, color: colors.ink2)),
                  ],
                  const SizedBox(height: MmSpace.s20),
                  if (counts.cells > 0) AnswerSheet(right: l.right, wrong: l.wrong, blank: l.blank),
                  if (counts.perBubble > 1) ...[
                    const SizedBox(height: MmSpace.s8),
                    Text(InsightsCopy.sheetScale(counts.perBubble), style: type.caption.copyWith(color: colors.ink3)),
                  ],
                  const SizedBox(height: MmSpace.s16),
                  // Until a share is known, a kind with no answers is left out: "0 right" beside a
                  // lit dot reads as an unfinished state, not a fact.
                  Wrap(
                    spacing: MmSpace.s16,
                    runSpacing: MmSpace.s8,
                    children: [
                      if (a.known || l.right > 0) LegendItem(state: BubbleState.filled, text: InsightsCopy.ledgerRight(l.right, l.gained)),
                      if (a.known || l.wrong > 0) LegendItem(state: BubbleState.wrong, text: InsightsCopy.ledgerWrong(l.wrong)),
                      LegendItem(state: BubbleState.blank, text: InsightsCopy.ledgerBlank(l.blank)),
                    ],
                  ),
                  if (evidence != null && evidence!.isNotEmpty) ...[
                    const SizedBox(height: MmSpace.s4),
                    EvidencePill(attempts: evidence!, what: InsightsCopy.behindLedger),
                  ],
                  if (a.known) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(InsightsCopy.netOver(net, insights.questions * 5, insights.sessions), style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2)),
                  ],
                  const SizedBox(height: MmSpace.s12),
                  Text(InsightsCopy.ledgerNote, style: type.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s4),
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
class _LeadFinding extends StatelessWidget {
  const _LeadFinding({required this.finding, required this.onAction, required this.evidence});

  final Finding finding;
  final VoidCallback? onAction;
  final List<Attempt> evidence;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final f = finding;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s20, MmSpace.cardPadding, MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Bubble(state: f.isLeak ? BubbleState.wrong : (f.isGood ? BubbleState.filled : BubbleState.marked), size: 22, animate: false),
                const SizedBox(width: MmSpace.s8),
                Text(
                  f.isLeak ? InsightsCopy.kindLeak : (f.isGood ? InsightsCopy.kindGood : InsightsCopy.kindNote),
                  style: type.label.copyWith(color: colors.ink2),
                ),
              ],
            ),
            const SizedBox(height: MmSpace.s16),
            Text(f.headline, style: type.title.copyWith(fontSize: 22, height: 26 / 22)),
            const SizedBox(height: MmSpace.s12),
            Text(f.detail, style: type.small.copyWith(color: colors.ink2, fontSize: 15, height: 22 / 15)),
            const SizedBox(height: MmSpace.s12),
            BasisLink(text: InsightsCopy.basedOn(f.n), attempts: evidence, what: InsightsCopy.behindFinding),
            if (onAction != null && f.actionLabel != null) ...[
              const SizedBox(height: MmSpace.s4),
              KeyButton(label: f.id == 'chapter' ? InsightsCopy.practiseThisChapter : f.actionLabel!, onPressed: onAction),
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
      padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s16, 0, MmSpace.s4),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s12),
              child: DecoratedBox(decoration: BoxDecoration(color: rail, borderRadius: BorderRadius.circular(2)), child: const SizedBox(width: 3)),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(f.headline, style: type.cardTitle),
                  const SizedBox(height: MmSpace.s4),
                  Text(f.detail, style: type.small.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s6),
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
