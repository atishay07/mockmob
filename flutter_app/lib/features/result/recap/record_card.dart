import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../notifications/notifications.dart' show PrePromptMoment;
import '../../today/data/today_providers.dart' show todayActionsProvider, todayNextActionProvider;
import '../../today/logic/today_model.dart' show GoTo, TodayAction;
import '../../today/widgets/move_keys.dart' show fitKeyLabel;
import '../copy.dart';
import '../data/result_providers.dart';
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

  /// The repair length in force: the student's choice while it is still one of the options,
  /// else the model's default as it is now, never 0 while there is something to repair.
  int get _minutes => effectiveRepairMinutes(m, _chosen);

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
    final all = [for (final o in repairDurationOptions(m.tonightCount)) o.minutes];
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
    for (final o in repairDurationOptions(m.tonightCount)) {
      if (o.minutes == _minutes) return o.mistakes;
    }
    return m.tonightCount;
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
    final options = repairDurationOptions(m.tonightCount);
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
    final quietKeys = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Flexible(child: KeyButton.quiet(label: ResultCopy.chooseElse, onPressed: () => context.push(AppRoutes.todayAlternatives))),
        if (!finishIsPrimary) MoreKey(onFinish: widget.onFinish),
      ],
    );
    final effort = _effortLine;
    final reaction = _reaction(ref.watch(celebrationModeProvider));
    final mobiPose = RecapMobi.poseOf(reaction);
    _mobiShown = !largeText && mobiPose != null;
    final receipt = ResultCopy.receiptLine(m.receivedAt);

    return RecapCardPage(
      onNext: null,
      onBack: widget.onBack,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasRepair)
            _RepairKey(
              label: _scope == null ? ResultCopy.startRepair(_minutes) : ResultCopy.repairKey(_scope!, _minutes),
              spoken: _scope == null ? null : ResultCopy.repairKeySpoken(_scope!, _minutes),
              onPressed: () => context.go(ResultNav.repair(m, minutes: _minutes)),
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
          scope: _scope,
          onMinutes: _chooseMinutes,
          onRetryKeys: widget.onRetryKeys,
        ),
        if (askReminder) ...[
          const SizedBox(height: MmSpace.s20),
          ReminderRow(
            text: reminderRowLine(asks),
            onSet: () => context.push(AppRoutes.permissionsNotifications),
            onNotNow: () {
              setState(() => _reminderDismissed = true);
              unawaited(ref.read(resultActionsProvider).declineReminder());
            },
          ),
        ],
        // The sheet, to keep: a quiet row, previewed as a card with no marks on it before anything
        // leaves.
        const SizedBox(height: MmSpace.s8),
        SheetKeepsakeRow(model: m, onTap: () => showSheetShare(context, model: m)),
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
int effectiveRepairMinutes(RecapModel m, int? chosen) {
  final options = repairDurationOptions(m.tonightCount);
  if (chosen != null && options.any((o) => o.minutes == chosen)) return chosen;
  final d = m.defaultRepairMinutes;
  if (d > 0 || m.candidates.isEmpty) return d;
  return repairMinutes(m.candidates.length) ?? repairMinutesPerMistake;
}

/// The repair key. When its words change (a different length was chosen) the new label fades in
/// over the old one, which holds until it is covered, so the key never flickers.
class _RepairKey extends StatelessWidget {
  const _RepairKey({required this.label, required this.onPressed, this.spoken});

  final String label;
  final String? spoken;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final key = ValueKey(label);
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.ui),
      switchInCurve: Motion.glide,
      transitionBuilder: (child, animation) => child.key == key ? FadeTransition(opacity: animation, child: child) : child,
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.center, children: [...previous, ?current]),
      child: KeyButton(key: key, label: label, semanticsLabel: spoken, onPressed: onPressed),
    );
  }
}
