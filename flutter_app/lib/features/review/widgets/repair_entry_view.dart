import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/models/ai_credits.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/repair_state.dart';
import '../data/review_providers.dart';
import 'life_row.dart';
import 'review_bits.dart';

/// How the run can start, from the explanation wallet (spec 5.8 entry).
class EntryPlan {
  const EntryPlan({required this.line, required this.primary, this.limit, this.keyOnly = false, this.offerKeys = false});

  /// Built from `GET /api/ai/credits`. An unknown balance shows no credit line and never
  /// counts as zero.
  factory EntryPlan.of(int mistakes, AiCredits? credits, ReviewClock clock) {
    final renew = credits?.resetAt == null ? null : ReviewCopy.renewsOn(formatDayMonth(clock.local(credits!.resetAt!)));
    if (credits?.isPaused ?? false) {
      return const EntryPlan(line: ReviewCopy.pausedLine, primary: ReviewCopy.readKeys, keyOnly: true);
    }
    final balance = credits?.explanationBalance;
    if (balance == null) return const EntryPlan(line: null, primary: ReviewCopy.begin);
    if (balance <= 0) {
      return EntryPlan(line: [ReviewCopy.outOfCredits, ?renew].join(' '), primary: ReviewCopy.readKeys, keyOnly: true);
    }
    final shortfall = repairWalletShortfall(mistakes: mistakes, balance: balance);
    if (shortfall != null) {
      return EntryPlan(
        line: ReviewCopy.shortfallLine(shortfall.needed, shortfall.balance),
        primary: ReviewCopy.startWith(shortfall.coveredMistakes),
        limit: shortfall.coveredMistakes,
        offerKeys: true,
      );
    }
    return EntryPlan(line: ReviewCopy.creditLine(balance), primary: ReviewCopy.begin);
  }

  final String? line;
  final String primary;
  final int? limit;
  final bool keyOnly;

  /// Also offer "Read the key explanations" as the quiet key.
  final bool offerKeys;
}

/// The plain threshold of a repair: what it is, how long, what it costs, and Begin.
class RepairEntryView extends StatelessWidget {
  const RepairEntryView({
    super.key,
    required this.run,
    required this.plan,
    required this.onBegin,
    required this.onReadKeys,
    required this.onClose,
  });

  final RepairRunState run;
  final EntryPlan plan;
  final VoidCallback onBegin;
  final VoidCallback onReadKeys;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = run.steps.length;
    final reopen = n == 1 && !run.steps.first.item.stage.isOpen;

    return Stack(
      children: [
        // A threshold, not a reading surface: the lamp stays faint and above the content.
        Positioned(left: 0, right: 0, top: 0, height: 320, child: IgnorePointer(child: LightField.lamp(context, strength: 0.5))),
        _body(context, colors, type, n, reopen),
      ],
    );
  }

  Widget _body(BuildContext context, MmColors colors, MmType type, int n, bool reopen) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.gutter, 0),
          child: Row(
            children: [
              IconButton(
                onPressed: onClose,
                tooltip: 'Close',
                icon: Icon(LucideIcons.x, color: colors.ink),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s24),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${run.source}, ${subjectName(run.subjectId)}', style: type.caption.copyWith(color: colors.ink2)),
                        const SizedBox(height: MmSpace.s4),
                        Semantics(header: true, child: Text(run.chapter, style: type.moment)),
                      ],
                    ),
                  ),
                  SubjectMark(subjectId: run.subjectId, size: 76),
                ],
              ),
              const SizedBox(height: MmSpace.s12),
              Text(
                reopen ? ReviewCopy.reopenLead : ReviewCopy.entryLead(n, repairMinutes(n)),
                style: type.lead.copyWith(color: colors.ink2),
              ),
              const SizedBox(height: MmSpace.s24),
              BubbleRow(
                states: List.filled(n, reopen ? BubbleState.filled : BubbleState.wrong),
                bubbleSize: 26,
                gap: 10,
                semanticsLabel: plural(n, 'mistake'),
              ),
              const SizedBox(height: MmSpace.s32),
              SolidPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    LifeRow(stage: reopen ? MistakeStage.repaired : MistakeStage.found, animate: false),
                    const SizedBox(height: MmSpace.s16),
                    Text(ReviewCopy.lifeCaption, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              if (plan.line != null && !reopen) ...[
                const SizedBox(height: MmSpace.s20),
                Text(plan.line!, style: type.small.copyWith(color: colors.ink2)),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyButton(label: reopen ? ReviewCopy.begin : plan.primary, onPressed: onBegin),
              if (plan.offerKeys && !reopen)
                Align(
                  child: KeyButton.quiet(label: ReviewCopy.readKeys, onPressed: onReadKeys),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
