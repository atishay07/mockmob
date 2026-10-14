import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/domain/repair_candidates.dart';
import '../../../core/models/ai_credits.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import '../data/repair_state.dart';
import '../data/review_providers.dart';
import 'life_row.dart';
import 'mistake_run.dart';

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

//// The threshold of a repair, on the moment layer: the subject's light and object in the upper
/// right, the chapter as the headline, the number of mistakes as the monumental figure (rolling
/// in), the mistakes themselves as bubbles that ink in one after another, the thread they will
/// walk drawn flat on the ground, what it costs, and Begin pinned at the bottom.
class RepairEntryView extends StatefulWidget {
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
  State<RepairEntryView> createState() => _RepairEntryViewState();
}

class _RepairEntryViewState extends State<RepairEntryView> with SingleTickerProviderStateMixin {
  late final AnimationController _art = AnimationController(vsync: this, duration: Motion.emphasizedDuration);
  late final CurvedAnimation _artCurve = CurvedAnimation(parent: _art, curve: Motion.emphasized);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _art.value = 1;
    } else {
      _art.forward();
    }
  }

  @override
  void dispose() {
    _artCurve.dispose();
    _art.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final run = widget.run;
    final colors = context.mmColors;
    final type = context.mmType;
    final n = run.steps.length;
    final reopen = n == 1 && !run.steps.first.item.stage.isOpen;
    final light = SubjectLight.forSubject(run.subjectId);
    final object = MmArt.subjectObject(run.subjectId);
    final large = MediaQuery.textScalerOf(context).scale(10) > 11.5;
    final numbers = [for (final s in run.steps) s.item.number];

    return Stack(
      children: [
        // A threshold, not a reading surface: the lamp stays faint and above the content.
        Positioned(left: 0, right: 0, top: 0, height: 360, child: IgnorePointer(child: LightField.lamp(context, strength: 0.5))),
        if (light != null)
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 340,
            child: IgnorePointer(child: LightField.subject(context, light, center: const Alignment(0.95, -0.9), strength: colors.isNight ? 1.1 : 0.9)),
          ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s4, MmSpace.s4, MmSpace.gutter, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: widget.onClose,
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
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 128),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(right: large ? 40 : 96),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${run.source}, ${subjectName(run.subjectId)}', style: type.caption.copyWith(color: colors.ink2)),
                              const SizedBox(height: MmSpace.s4),
                              Semantics(
                                header: true,
                                child: Text(run.chapter, style: type.moment.copyWith(fontSize: 32, height: 34 / 32), maxLines: large ? 5 : 4, overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ),
                        ),
                        if (object != null)
                          Positioned(
                            right: -24,
                            top: -24,
                            child: IgnorePointer(
                              child: RepaintBoundary(
                                child: AnimatedBuilder(
                                  animation: _artCurve,
                                  child: ArtImage(object, width: 128, height: 128),
                                  builder: (context, child) {
                                    final t = _artCurve.value;
                                    return Opacity(
                                      opacity: t.clamp(0.0, 1.0),
                                      child: Transform.translate(
                                        offset: Offset(0, 10 * (1 - t)),
                                        child: Transform.scale(scale: 0.92 + 0.08 * t, child: child),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: MmSpace.s20),
                  MonumentalNumber(
                    value: '$n',
                    unit: n == 1 ? 'mistake' : 'mistakes',
                    style: type.hero.copyWith(fontSize: 96, height: 84 / 96),
                    semanticsLabel: reopen ? '${plural(n, 'mistake')}, already repaired' : '${plural(n, 'mistake')} to repair',
                  ),
                  const SizedBox(height: MmSpace.s8),
                  Text(
                    reopen ? ReviewCopy.reopenLead : ReviewCopy.entryMeaning(repairMinutes(n)),
                    style: type.lead.copyWith(color: colors.ink2),
                  ),
                  const SizedBox(height: MmSpace.s24),
                  MistakeRun(numbers: numbers, state: reopen ? BubbleState.filled : BubbleState.wrong, inkIn: true),
                  const SizedBox(height: MmSpace.s32),
                  // The thread, flat on the ground: where each of these is headed.
                  LifeRow(stage: reopen ? MistakeStage.repaired : MistakeStage.found, animate: false),
                  const SizedBox(height: MmSpace.s16),
                  Text(ReviewCopy.lifeCaption, style: type.small.copyWith(color: colors.ink2)),
                  if (widget.plan.line != null && !reopen) ...[
                    const SizedBox(height: MmSpace.s20),
                    Text(widget.plan.line!, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, MmSpace.s8, MmSpace.cardGutter, MmSpace.s16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KeyButton(label: reopen ? ReviewCopy.begin : widget.plan.primary, onPressed: widget.onBegin),
                  if (widget.plan.offerKeys && !reopen)
                    Align(
                      child: KeyButton.quiet(label: ReviewCopy.readKeys, onPressed: widget.onReadKeys),
                    ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}
