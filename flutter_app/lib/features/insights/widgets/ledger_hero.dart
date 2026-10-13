import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/insights_models.dart';
import 'insights_bits.dart';

/// The record's anchor: the share answered right as one monumental number with its likely
/// range, then where the marks came from. Every part of the bar is named with its count beside it.
class LedgerHero extends StatelessWidget {
  const LedgerHero({super.key, required this.insights});

  final PrepInsights insights;

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
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: MonumentalNumber(value: net > 0 ? '+$net' : '$net', unit: InsightsCopy.netLabel, style: type.figureHero, semanticsLabel: '$net net marks'),
          ),
        if (a.known && a.low != null && a.high != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(InsightsCopy.accuracyHeroLine(a.low!, a.high!), style: type.body.copyWith(fontSize: 15, color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        Semantics(
          label: '${l.right} right, ${l.wrong} wrong, ${l.blank} left blank',
          child: MarksBar(right: l.right, wrong: l.wrong, blank: l.blank, height: 14),
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
        if (a.known) ...[
          const SizedBox(height: MmSpace.s8),
          Text(InsightsCopy.netOver(net, insights.sessions), style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        Text(InsightsCopy.ledgerNote, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// The findings the server read out, strongest first, in one lit panel. Each says how many
/// questions it rests on and offers the one thing to do about it.
class FindingsPanel extends StatelessWidget {
  const FindingsPanel({super.key, required this.findings, required this.onAction});

  final List<Finding> findings;

  /// Null hides a finding's key (its href has no place in the app).
  final VoidCallback? Function(Finding f) onAction;

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
              _FindingRow(finding: findings[i], onAction: onAction(findings[i])),
            ],
          ],
        ),
      ),
    );
  }
}

class _FindingRow extends StatelessWidget {
  const _FindingRow({required this.finding, required this.onAction});

  final Finding finding;
  final VoidCallback? onAction;

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
