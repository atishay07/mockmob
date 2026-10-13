import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/domain/domain.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/result_providers.dart';
import '../model/recap_model.dart';
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
    this.firstResult = false,
    this.showSkipHint = false,
  });

  final RecapModel model;
  final VoidCallback onBack;
  final VoidCallback onFinish;
  final VoidCallback onRetryKeys;

  /// The student's first result on this phone: the reminder row may show once.
  final bool firstResult;

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

  int get _mistakes {
    for (final o in repairDurationOptions(m.candidates.length)) {
      if (o.minutes == _minutes) return o.mistakes;
    }
    return m.candidates.length;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final options = repairDurationOptions(m.candidates.length);
    final hasRepair = m.candidates.isNotEmpty;
    final shortfall = hasRepair ? repairWalletShortfall(mistakes: _mistakes, balance: m.creditBalance) : null;
    final askReminder = widget.firstResult && !_reminderDismissed && hasRepair && (ref.watch(reminderOfferProvider).value ?? false);
    final token = m.variant.allowsTokens ? m.firstMockTokenAt : null;

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
          // Side by side when they fit; stacked at large text sizes.
          Wrap(
            alignment: WrapAlignment.center,
            children: [
              if (hasRepair) KeyButton.quiet(label: ResultCopy.chooseElse, onPressed: () => context.push(AppRoutes.todayAlternatives)),
              KeyButton.quiet(label: ResultCopy.finishForNow, onPressed: widget.onFinish),
            ],
          ),
        ],
      ),
      children: [
        const SizedBox(height: MmSpace.s16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Semantics(header: true, child: Text(ResultCopy.inRecord(m.mockLabel), style: type.moment)),
            ),
            if (token == null)
              const Padding(
                padding: EdgeInsets.only(left: MmSpace.s8),
                child: Mobi(pose: MobiPose.greet, size: 64),
              ),
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        ReceiptLine(text: ResultCopy.savedAt(m.receivedAt)),
        if (m.monthMockCount > 0) ...[
          const SizedBox(height: MmSpace.s8),
          Text(ResultCopy.effort(m.mockLabel, m.monthMockCount), style: type.body.copyWith(color: colors.ink2)),
        ],
        if (token != null) ...[const SizedBox(height: MmSpace.s20), TokenRow(at: token)],
        const SizedBox(height: MmSpace.s24),
        RepairPanel(
          model: m,
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
            onSet: () => context.push(AppRoutes.permissionsNotifications),
            onNotNow: () => setState(() => _reminderDismissed = true),
          ),
        ],
        if (widget.showSkipHint) ...[
          const SizedBox(height: MmSpace.s20),
          Text(ResultCopy.skipHint, style: type.small.copyWith(color: colors.ink3)),
        ],
      ],
    );
  }
}
