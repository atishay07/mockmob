import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/models/attempt.dart';
import '../copy.dart';
import '../data/insights_models.dart';
import 'evidence.dart';
import 'insights_bits.dart';

/// The record's anchor: the share answered right as one monumental number with its likely
/// range, then where the marks came from. Every part of the bar is named with its count beside it,
/// and Show me under the legend opens the sessions behind it.
///
/// The figure rolls and the bar engraves once per visit (500 ms and 280 ms); a rebuild with the
/// same record does neither, and reduced motion shows the final state.
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(InsightsCopy.recordBasis(insights.sessions, insights.questions), style: type.small.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s8),
        // The hero is the share answered right, a number that means the same over 5 questions or
        // 500; the net marks go in the bar's legend (review round 1: "+324 net" summed papers of
        // different lengths). Large text scales the figure down rather than pushing it off.
        if (a.known)
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: MonumentalNumber(value: '${a.pct}%', style: type.figureHero, semanticsLabel: '${a.pct} percent of answered questions right'),
          )
        else
          _SparseCard(answered: l.right + l.wrong),
        if (a.known && a.low != null && a.high != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(InsightsCopy.accuracyHeroLine(a.low!, a.high!), style: type.body.copyWith(fontSize: 15, color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        Semantics(
          label: '${l.right} right, ${l.wrong} wrong, ${l.blank} left blank',
          child: MarksBar(right: l.right, wrong: l.wrong, blank: l.blank, height: 14, engrave: true),
        ),
        const SizedBox(height: MmSpace.s12),
        Wrap(
          spacing: MmSpace.s16,
          runSpacing: MmSpace.s8,
          children: [
            LegendItem(state: BubbleState.filled, text: InsightsCopy.ledgerRight(l.right, l.gained)),
            LegendItem(state: BubbleState.wrong, text: InsightsCopy.ledgerWrong(l.wrong)),
            LegendItem(state: BubbleState.blank, text: InsightsCopy.ledgerBlank(l.blank)),
          ],
        ),
        if (evidence != null && evidence!.isNotEmpty) EvidencePill(attempts: evidence!, what: InsightsCopy.behindLedger),
        if (a.known) ...[
          const SizedBox(height: MmSpace.s8),
          Text(InsightsCopy.netOver(net, insights.questions * 5, insights.sessions), style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        Text(InsightsCopy.ledgerNote, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// Stands in for the share right until there is something to share: one bubble per answered
/// question of the first ten (inked when answered), and the plain next step.
class _SparseCard extends StatelessWidget {
  const _SparseCard({required this.answered});

  final int answered;

  static const int _goal = 10;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final inked = answered.clamp(0, _goal);
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(header: true, child: Text(InsightsCopy.sparseTitle, style: type.title)),
            const SizedBox(height: MmSpace.s12),
            BubbleRow(
              states: [for (var i = 0; i < _goal; i++) i < inked ? BubbleState.filled : BubbleState.hollow],
              bubbleSize: 16,
              gap: 6,
              semanticsLabel: '$inked of $_goal answered',
            ),
            const SizedBox(height: MmSpace.s8),
            Text(InsightsCopy.sparseLine(answered), style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}

/// The findings the server read out, strongest first, in one lit panel. Each says how many
/// questions it rests on and offers the one thing to do about it.
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
    final colors = context.mmColors;
    return LitEdge(
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: colors.raised,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line)),
        ),
        child: Column(
          children: [
            for (var i = 0; i < findings.length; i++) ...[
              if (i > 0) Divider(height: 1, indent: MmSpace.cardPadding, endIndent: MmSpace.cardPadding, color: colors.line),
              _FindingRow(finding: findings[i], onAction: onAction(findings[i]), evidence: evidence(findings[i])),
            ],
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
    final mark = f.isLeak ? BubbleState.wrong : (f.isGood ? BubbleState.filled : BubbleState.marked);
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s16, MmSpace.cardPadding, MmSpace.s8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(padding: const EdgeInsets.only(top: 3), child: Bubble(state: mark, size: 16, animate: false)),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(f.headline, style: type.cardTitle),
                const SizedBox(height: MmSpace.s4),
                Text(f.detail, style: type.small.copyWith(color: colors.ink2)),
                const SizedBox(height: MmSpace.s6),
                Text(InsightsCopy.basedOn(f.n), style: type.caption.copyWith(color: colors.ink3)),
                EvidencePill(attempts: evidence, what: InsightsCopy.behindFinding),
                if (onAction != null && f.actionLabel != null)
                  ActionLink(label: f.id == 'chapter' ? InsightsCopy.practiseThisChapter : f.actionLabel!, onTap: onAction!)
                else
                  const SizedBox(height: MmSpace.s8),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
