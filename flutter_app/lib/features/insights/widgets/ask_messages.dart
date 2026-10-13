import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/ask_controller.dart';
import '../insights_paths.dart';
import 'insights_bits.dart';

/// One turn of Ask: the student's words on the right; a reply on the left with where it came
/// from and what it cost; a sending line; or a failure that says nothing was charged. A reply a
/// model wrote also says it can be wrong and offers Report this reply.
class AskMessageView extends StatelessWidget {
  const AskMessageView({super.key, required this.message, required this.onRetry, this.onReport});

  final AskMessage message;
  final VoidCallback onRetry;

  /// Reports a model reply; null hides the control.
  final VoidCallback? onReport;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = message;

    if (m.fromStudent) {
      return Align(
        alignment: Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
          child: DecoratedBox(
            decoration: ShapeDecoration(color: colors.raised2, shape: mmShapeBorder(MmRadius.keyAll)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
              child: Text(m.text, style: type.body),
            ),
          ),
        ),
      );
    }

    if (m.sending) {
      return Semantics(
        liveRegion: true,
        label: InsightsCopy.askSending,
        child: Row(
          children: [
            MmSpinner(color: colors.ink2),
            const SizedBox(width: MmSpace.s8),
            Text(InsightsCopy.askSending, style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      );
    }

    if (m.failure case final failure?) {
      final (text, canRetry) = switch (failure) {
        AskFailure.offline => (InsightsCopy.failOffline, true),
        AskFailure.noCredits => (InsightsCopy.failNoCredits(m.balance), false),
        AskFailure.paused => (InsightsCopy.failPaused, false),
        AskFailure.resend => (InsightsCopy.failResend, true),
        AskFailure.rateLimited => (InsightsCopy.failRate, true),
        AskFailure.tooLong => (InsightsCopy.failTooLong, false),
        AskFailure.unavailable => (InsightsCopy.failUnavailable, true),
      };
      return Semantics(
        liveRegion: true,
        child: InlineBanner(
          message: text,
          tone: failure == AskFailure.offline ? BannerTone.offline : BannerTone.warning,
          actionLabel: canRetry ? InsightsCopy.sendAgain : null,
          onAction: canRetry ? onRetry : null,
        ),
      );
    }

    final origin = switch (m.origin) {
      AskOrigin.model => InsightsCopy.originModel,
      AskOrigin.paused => InsightsCopy.originPaused,
      AskOrigin.record => InsightsCopy.originRecord,
      _ => InsightsCopy.originPhone,
    };
    final actions = [
      for (final (label, href) in m.actions)
        if (InsightsPaths.locationFor(href) case final location?) (label, location),
    ];
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.raised, shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: colors.line))),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.s16, MmSpace.cardPadding, MmSpace.s8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(m.text, style: type.body),
              const SizedBox(height: MmSpace.s8),
              Text(origin, style: type.caption.copyWith(color: colors.ink3)),
              if (m.isModel) ...[
                const SizedBox(height: MmSpace.s4),
                Text(InsightsCopy.aiCaveat, style: type.caption.copyWith(color: colors.ink2)),
              ],
              for (final (label, location) in actions.take(2))
                ActionLink(label: label, onTap: () => context.push(location)),
              if (m.isModel && onReport != null)
                _ReportKey(onTap: onReport!)
              else if (actions.isEmpty)
                const SizedBox(height: MmSpace.s8),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Report this reply": a quiet flag key under a model reply, 48 dp tall.
class _ReportKey extends StatelessWidget {
  const _ReportKey({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: InsightsCopy.reportReply,
      focusRadius: MmRadius.smallAll,
      onTap: onTap,
      builder: (context, pressed, _) => SizedBox(
        height: MmTarget.min,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.flag, size: 16, color: pressed ? colors.ink : colors.ink2),
            const SizedBox(width: MmSpace.s6),
            Text(InsightsCopy.reportReply, style: type.label.copyWith(color: pressed ? colors.ink : colors.ink2)),
          ],
        ),
      ),
    );
  }
}
