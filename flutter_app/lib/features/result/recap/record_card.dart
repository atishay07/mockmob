import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../notifications/notifications.dart' show PrePromptMoment;
import '../copy.dart';
import '../data/result_providers.dart';
import '../../rhythm/rhythm.dart' show CelebrationScope, CelebrationSlot;
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../result_nav.dart';
import 'card_page.dart';
import 'record_parts.dart';

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
  late int _minutes = widget.model.defaultRepairMinutes;
  bool _reminderDismissed = false;

  RecapModel get m => widget.model;

  @override
  void initState() {
    super.initState();
    final token = m.variant.allowsTokens ? m.firstMockTokenAt : null;
    if (token != null) ref.read(resultActionsProvider).acknowledgeFirstMock(m.attemptId, token);
  }

  /// Effort once, and only when the result allows it; the next step otherwise.
  String? get _mobiLine {
    if (!m.variant.allowsTokens) return ResultCopy.nextStepLine;
    if (m.monthMockCount <= 0) return null;
    return ResultCopy.effort(m.monthMockCount, firstInSubject: m.variant == RecapVariant.firstMock, subject: m.subjectName);
  }

  MobiPose get _mobiPose => switch (m.variant) {
    RecapVariant.firstMock => MobiPose.greet,
    RecapVariant.higher => MobiPose.cheer,
    RecapVariant.standard => MobiPose.rest,
    RecapVariant.lower || RecapVariant.held => MobiPose.point,
  };

  /// Settle for every pose; the cheer for a higher result adds its one hop.
  MobiMotion get _mobiMotion => m.variant == RecapVariant.higher ? MobiMotion.hop : MobiMotion.settle;

  int get _mistakes {
    for (final o in repairDurationOptions(m.tonightCount)) {
      if (o.minutes == _minutes) return o.mistakes;
    }
    return m.tonightCount;
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

    // Side by side when they fit. At large text they would stack and take a quarter of the screen
    // (the length chips fell under the scroll edge), so they close the scrolling card instead and
    // only the primary key stays pinned.
    final largeText = MediaQuery.textScalerOf(context).scale(14) / 14 > 1.15;
    final quietKeys = Wrap(
      alignment: WrapAlignment.center,
      children: [
        if (hasRepair) KeyButton.quiet(label: ResultCopy.chooseElse, onPressed: () => context.push(AppRoutes.todayAlternatives)),
        KeyButton.quiet(label: ResultCopy.finishForNow, onPressed: widget.onFinish),
      ],
    );

    return RecapCardPage(
      onNext: null,
      onBack: widget.onBack,
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasRepair)
            KeyButton(
              label: ResultCopy.startRepair(_minutes),
              onPressed: () => context.go(ResultNav.repair(m, minutes: _minutes)),
            )
          else
            KeyButton(label: ResultCopy.chooseElse, onPressed: () => context.push(AppRoutes.todayAlternatives)),
          if (!largeText) quietKeys,
        ],
      ),
      children: [
        const SizedBox(height: MmSpace.s16),
        Semantics(header: true, child: Text(ResultCopy.inRecord(m.mockLabel), style: type.moment)),
        const SizedBox(height: MmSpace.s12),
        ReceiptLine(text: ResultCopy.receiptLine(m.receivedAt)),
        // Any moment the rhythm module fires for this result lands here, on the ground. It takes
        // no space when nothing fired.
        CelebrationSlot(scope: CelebrationScope.result(m.attemptId)),
        if (token != null) ...[const SizedBox(height: MmSpace.s20), TokenRow(at: token)],
        const SizedBox(height: MmSpace.s20),
        // The recap's one Mobi (card 1 has none), left-aligned above the repair panel, with one
        // line: greets the first mock, cheers once for a higher result, stays calm otherwise.
        Align(
          alignment: Alignment.centerLeft,
          child: Mobi(pose: _mobiPose, size: 112, motion: _mobiMotion, say: _mobiLine),
        ),
        const SizedBox(height: MmSpace.s16),
        RepairPanel(
          model: m,
          blanksInReview: m.blanksInReview,
          mistakes: _mistakes,
          minutes: _minutes,
          shortfall: shortfall,
          options: options,
          onMinutes: (v) => setState(() => _minutes = v),
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
        if (widget.showSkipHint) ...[
          const SizedBox(height: MmSpace.s20),
          Text(ResultCopy.skipHint, style: type.small.copyWith(color: colors.ink3)),
        ],
        if (largeText) ...[const SizedBox(height: MmSpace.s12), quietKeys],
      ],
    );
  }
}
