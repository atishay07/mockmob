import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
import '../../../core/models/models.dart' show RepairOrder, RepairOrderItem;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
import '../../../core/widgets/widgets.dart';
import '../../notifications/notifications.dart' show PrePromptMoment;
import '../../today/data/today_providers.dart' show todayActionsProvider, todayNextActionProvider;
import '../../today/logic/today_model.dart' show GoTo, TodayAction;
import '../../today/widgets/move_keys.dart' show fitKeyLabel;
import '../copy.dart';
import '../data/result_providers.dart';
import '../full/full_sections.dart' show cohortLead;
import '../../rhythm/rhythm.dart' show CelebrationMode, CelebrationScope, CelebrationSlot, celebrationModeProvider;
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../result_nav.dart';
import '../widgets/result_space.dart';
import 'card_page.dart';
import 'recap_mobi.dart';
import 'record_parts.dart';
import 'sheet_share.dart';

/// Card 4 (spec 5.6.3): what was recorded, and the next ask sized to the time the student has.
class RecordCard extends ConsumerStatefulWidget {
  const RecordCard({
    super.key,
    required this.model,
    required this.onBack,
    required this.onFinish,
    required this.onRetryKeys,
    this.showSkipHint = false,
  });

  final RecapModel model;
  final VoidCallback onBack;
  final VoidCallback onFinish;
  final VoidCallback onRetryKeys;

  /// After the third reveal, once: "Prefer to skip the reveal?".
  final bool showSkipHint;

  @override
  ConsumerState<RecordCard> createState() => _RecordCardState();
}

class _RecordCardState extends ConsumerState<RecordCard> {
  /// The length the student chose, if any. The default is never frozen here: the model can gain
  /// its repair candidates after the card mounts (the keys arrive on "Try again"), and a default
  /// read once then stayed 0 ("Start 0-minute repair", robustness result-01).
  int? _chosen;
  bool _reminderDismissed = false;

  /// Drives the card's Mobi: it listens when the shortest length is chosen and hops when the
  /// longest is (an ask taken on, not a celebration).
  final MobiController _mobi = MobiController();

  RecapModel get m => widget.model;

  /// The server's repair order for this paper, set on every build (Mistake Lab v4 slice 3, spec
  /// 4.7): when it leads with a question most other students got right, or a common trap, the key
  /// here opens that run, the same as the full result's key and the repair run itself.
  RepairOrder? _order;

  /// The question the repair order leads with and the run it starts, or null (today's pick stays).
  (RepairOrderItem, RepairKeyScope)? get _lead => cohortLead(m, _order);

  /// How many mistakes the run holds in all: the led chapter's, else tonight's chapter's. The
  /// length chips and every default are sized to this, so the key never offers more than exists.
  int get _runTotal => _lead?.$2.count ?? m.tonightCount;

  /// The repair length in force: the student's choice while it is still one of the options,
  /// else the model's default as it is now, never 0 while there is something to repair.
  int get _minutes => effectiveRepairMinutes(m, _chosen, runCount: _runTotal);

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  /// A length was chosen. Mobi leans in for the shortest ("a little, then") and hops for the
  /// longest; the ones between are quiet. Under reduced motion it holds its pose.
  void _chooseMinutes(int v) {
    setState(() => _chosen = v);
    if (Motion.reduced(context) || m.isNta || !_mobiShown) return;
    final all = [for (final o in repairDurationOptions(_runTotal)) o.minutes];
    if (all.length < 2) return;
    final lo = all.reduce((a, b) => a < b ? a : b);
    final hi = all.reduce((a, b) => a > b ? a : b);
    // One act per 2.5 s however fast the chips are tapped, calmed under the Celebrations setting.
    if (v == lo) _mobi.react(MobiMoments.act(MobiEvent.choiceWitnessed), key: 'recap-record:length');
    if (v == hi) _mobi.react(MobiMoments.act(MobiEvent.answerRight), key: 'recap-record:length');
  }

  /// What the repair key opens, said exactly: the run is one chapter of this paper, so the key
  /// names its count (and the chapter when other mistakes are left for Review). A shorter length
  /// opens fewer than the chapter holds, and the ones it leaves are in Review too, so the count
  /// of "the others" is everything the run does not hold.
  RepairKeyScope? get _scope {
    final lead = _lead;
    // A led run starts on that question and holds that question's chapter, cut to the length chosen.
    if (lead != null) return RepairCandidates.scopeOf(m.candidates, startQuestionId: lead.$1.qid, limit: _mistakes);
    final s = RepairCandidates.scopeOf(m.candidates, limit: _mistakes);
    if (s == null) return null;
    return RepairKeyScope(chapter: s.chapter, firstQuestionId: s.firstQuestionId, count: s.count, othersInPaper: m.candidates.length - s.count);
  }

  /// Whether Mobi is on the card now (not at large text, not on an NTA result).
  bool _mobiShown = false;

  @override
  void initState() {
    super.initState();
    final token = m.variant.allowsTokens ? m.firstMockTokenAt : null;
    if (token != null) ref.read(resultActionsProvider).acknowledgeFirstMock(m.attemptId, token);
  }

  /// Effort, once, and only when the result allows it ("Third full paper this month."), folded
  /// into the receipt line it belongs to. Never on the first mock (the token row already says
  /// so), and never after a lower or held result.
  String? get _effortLine {
    if (!m.variant.allowsTokens || m.variant == RecapVariant.firstMock || m.monthMockCount <= 0) return null;
    return ResultCopy.effort(m.monthMockCount, firstInSubject: false, subject: m.subjectName);
  }

  /// What Mobi does here, from the one reaction table (a milestone stands proud, a higher result
  /// cheers, a lower or held result gets the encouraging nod, late at night it is sleepy, and an
  /// NTA result gets no Mobi at all).
  RecapReaction? _reaction(CelebrationMode mode) => recapReaction(
    variant: m.variant,
    mode: mode,
    isNta: m.isNta,
    hour: MobiRation.now().hour,
  );

  int get _mistakes {
    for (final o in repairDurationOptions(_runTotal)) {
      if (o.minutes == _minutes) return o.mistakes;
    }
    return _runTotal;
  }

  /// Opens Today's next move the way Today does: a tab root switches tabs, anything else is pushed.
  void _startNext(TodayAction action) {
    if (action.startsSession) ref.read(todayActionsProvider).started(action);
    final target = action.target;
    if (target is! GoTo) return;
    if (AppRoutes.tabRoots.contains(target.location)) {
      context.go(target.location);
    } else {
      unawaited(context.push(target.location));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    _order = ref.watch(recapDataProvider(m.attemptId).select((d) => d.detail?.lab?.repairOrder));
    final lead = _lead;
    final options = repairDurationOptions(_runTotal);
    final hasRepair = m.candidates.isNotEmpty;
    final shortfall = hasRepair ? repairWalletShortfall(mistakes: _mistakes, balance: m.creditBalance) : null;
    // The reminder row follows the notifications policy, not "first result only": it comes back
    // after a Not now or a refusal when the spacing allows, never once reminders are on, and
    // never on an NTA mode result.
    final moment = m.isNta ? PrePromptMoment.ntaMode : PrePromptMoment.afterResult;
    final askReminder = !_reminderDismissed && hasRepair && (ref.watch(reminderOfferProvider(moment)).value ?? false);
    final asks = askReminder ? (ref.watch(reminderAskCountProvider).value ?? 0) : 0;
    final token = m.variant.allowsTokens ? m.firstMockTokenAt : null;

    // At large text the headline needs the whole width, so Mobi steps out; nothing is ever laid
    // under the keys for it.
    final largeText = MediaQuery.textScalerOf(context).scale(14) / 14 > 1.15;
    // The primary key names the one thing to do next: the repair, else Today's own next move, else
    // "Finish for now" (a key that promises nothing the app cannot do). One quiet key sits under
    // it, "Choose something else"; "Finish for now" waits behind "More" whenever it is not the
    // primary, so the card has one dominant action and one secondary one.
    final next = hasRepair ? null : ref.watch(todayNextActionProvider);
    final finishIsPrimary = !hasRepair && next == null;
    final quietKeys = Align(
      child: ChooseElseKey(
        onChoose: () => context.push(AppRoutes.todayAlternatives),
        onFinish: finishIsPrimary ? null : widget.onFinish,
      ),
    );
    final effort = _effortLine;
    final reaction = _reaction(ref.watch(celebrationModeProvider));
    final mobiPose = RecapMobi.poseOf(reaction);
    _mobiShown = !largeText && mobiPose != null;
    final receipt = ResultCopy.receiptLine(m.receivedAt);

    return RecapCardPage(
      onNext: null,
      onBack: widget.onBack,
      // What was recorded sits in the middle of the free height, not above a hole at the key. With
      // nothing to repair the card is only a few lines, and keeps the shared top weighting.
      weight: hasRepair ? ResultSpace.centered : ResultSpace.momentWeight,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // The chapter the repair opens, above the key that opens it; the key itself stays short.
          if (hasRepair && options.isNotEmpty) ...[
            RepairScopeLine(text: _scope == null ? ResultCopy.chipLabel(_minutes, _mistakes) : ResultCopy.repairScopeLine(_scope!, _minutes, chapterTotal: _runTotal)),
            const SizedBox(height: MmSpace.s8),
          ],
          if (hasRepair)
            _RepairKey(
              label: _scope == null ? ResultCopy.startRepair(_minutes) : ResultCopy.repairKey(_scope!, _minutes),
              spoken: _scope == null ? null : ResultCopy.repairKeySpoken(_scope!, _minutes, chapterTotal: _runTotal),
              onPressed: () => context.go(
                ResultNav.repair(m, minutes: _minutes, startQuestionId: lead?.$1.qid, runCount: lead == null ? null : _runTotal),
              ),
            )
          else if (next != null)
            LayoutBuilder(
              builder: (context, box) => KeyButton(
                label: fitKeyLabel(context, next, box.maxWidth),
                semanticsLabel: next.label,
                onPressed: () => _startNext(next),
              ),
            )
          else
            KeyButton(label: ResultCopy.finishForNow, onPressed: widget.onFinish),
          quietKeys,
        ],
      ),
      children: [
        const SizedBox(height: MmSpace.s16),
        // The headline and its receipt line, with Mobi beside them in the same place as on card 1.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(ResultCopy.inRecord(m.mockLabel), style: type.moment)),
                  const SizedBox(height: MmSpace.s12),
                  ReceiptLine(text: effort == null ? receipt : '$receipt $effort'),
                ],
              ),
            ),
            if (!largeText && mobiPose != null) ...[
              const SizedBox(width: MmSpace.s12),
              RecapMobi(pose: mobiPose, size: ResultSpace.mobi, mood: recapMood(m.variant, reaction), controller: _mobi),
            ],
          ],
        ),
        // Any moment the rhythm module fires for this result lands here, on the ground. It takes
        // no space when nothing fired.
        CelebrationSlot(scope: CelebrationScope.result(m.attemptId)),
        if (token != null) ...[const SizedBox(height: MmSpace.s20), TokenRow(at: token)],
        const SizedBox(height: MmSpace.s24),
        RepairPanel(
          model: m,
          blanksInReview: m.blanksInReview,
          mistakes: _mistakes,
          minutes: _minutes,
          shortfall: shortfall,
          options: options,
          // The server's line for why the led run leads (the website's words).
          leadLine: lead == null ? null : '${lead.$1.key}. ${lead.$1.line}',
          onMinutes: _chooseMinutes,
          onRetryKeys: widget.onRetryKeys,
        ),
        // "Not now" closes the row instead of cutting it out.
        KeyReveal(
          show: askReminder,
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s20),
            child: ReminderRow(
              text: reminderRowLine(asks),
              onSet: () => context.push(AppRoutes.permissionsNotifications),
              onNotNow: () {
                setState(() => _reminderDismissed = true);
                unawaited(ref.read(resultActionsProvider).declineReminder());
              },
            ),
          ),
        ),
        // The sheet, to keep: one 48 dp chip, previewed as a card with no marks on it before anything
        // leaves.
        const SizedBox(height: MmSpace.s20),
        Align(alignment: Alignment.centerLeft, child: SheetKeepsakeRow(model: m, onTap: () => showSheetShare(context, model: m))),
        if (widget.showSkipHint) ...[
          const SizedBox(height: MmSpace.s12),
          Text(ResultCopy.skipHint, style: type.small.copyWith(color: colors.ink3)),
        ],
      ],
    );
  }
}

/// The repair length card 4 offers for [m]: [chosen] while it is still one of the duration
/// options, else the model's default. Never 0 while there is something to repair: with
/// candidates but no fitting option, the time for every candidate (at least 5 minutes).
int effectiveRepairMinutes(RecapModel m, int? chosen, {int? runCount}) {
  final count = runCount ?? m.tonightCount;
  final options = repairDurationOptions(count);
  if (chosen != null && options.any((o) => o.minutes == chosen)) return chosen;
  final d = _defaultMinutesFor(count);
  if (d > 0 || m.candidates.isEmpty) return d;
  return repairMinutes(m.candidates.length) ?? repairMinutesPerMistake;
}

/// The default length for a run of [count] mistakes: the 10-minute chip when it exists, else the
/// first, else the time for all of them (the same rule as [RecapModel.defaultRepairMinutes]).
int _defaultMinutesFor(int count) {
  final options = repairDurationOptions(count);
  for (final o in options) {
    if (o.minutes == 10) return 10;
  }
  if (options.isNotEmpty) return options.first.minutes;
  return repairMinutes(count) ?? 0;
}

/// The repair key. When its words change (a different length was chosen) the key stays and its
/// label rises into place over the old one, which lifts away (the key's own label morph), so the
/// key itself never flickers or moves.
class _RepairKey extends StatelessWidget {
  const _RepairKey({required this.label, required this.onPressed, this.spoken});

  final String label;
  final String? spoken;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => KeyButton(label: label, semanticsLabel: spoken, onPressed: onPressed);
}
