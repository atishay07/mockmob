import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../services/notification_providers.dart';
import '../widgets/notification_preview.dart';
import '../widgets/time_sheet.dart';

enum _Phase { ask, granted, denied }

/// The pre-prompt sheet "Remind me when it matters" (spec 8): three examples of what a reminder
/// would say, Allow, and Not now. Allow opens the Android 13 system dialog; Not now returns
/// the sheet at most once, 14 days later. Whatever the student chooses, the sheet ends on a
/// designed state and never blocks study.
///
/// The body only: `MmSheetPage` supplies the frame.
class RemindersPromptSheet extends ConsumerStatefulWidget {
  const RemindersPromptSheet({super.key});

  @override
  ConsumerState<RemindersPromptSheet> createState() =>
      _RemindersPromptSheetState();
}

class _RemindersPromptSheetState extends ConsumerState<RemindersPromptSheet> {
  _Phase _phase = _Phase.ask;
  bool _asking = false;

  Future<void> _allow() async {
    setState(() => _asking = true);
    NotificationPermission result;
    try {
      result = await ref
          .read(permissionRequesterProvider)
          .requestNotificationPermission();
    } on Object {
      result = NotificationPermission.denied;
    }
    if (!mounted) return;
    ref.invalidate(notificationPermissionProvider);
    final granted = result == NotificationPermission.granted;
    if (granted) {
      unawaited(ref.read(hapticsProvider).settle());
      unawaited(ref.read(reminderSchedulerProvider).sync());
    }
    setState(() {
      _asking = false;
      _phase = granted ? _Phase.granted : _Phase.denied;
    });
  }

  Future<void> _notNow() async {
    final scheduler = ref.read(reminderSchedulerProvider);
    final prefs = ref.read(appPrefsProvider);
    final now = ref.read(nowProvider)();
    // Recorded before the sheet closes, so the return rule holds even if the app is killed.
    await prefs.setLastPrePromptAt(now);
    await scheduler.prePromptDismissed();
    if (mounted) Navigator.of(context).maybePop();
  }

  void _chooseStudyTime() {
    final router = GoRouter.of(context);
    Navigator.of(context).maybePop();
    unawaited(router.push(AppRoutes.youNotifications));
  }

  @override
  Widget build(BuildContext context) {
    final prefs =
        ref.watch(notificationPrefsRepositoryProvider).value ??
        NotificationPrefs.defaults;
    final child = switch (_phase) {
      _Phase.ask => _Ask(
        prefs: prefs,
        asking: _asking,
        onAllow: _allow,
        onNotNow: _notNow,
      ),
      _Phase.granted => _Outcome(
        key: const ValueKey('granted'),
        icon: LucideIcons.bellRing,
        title: NotificationsCopy.grantedTitle,
        body: NotificationsCopy.grantedBody,
        primaryLabel: NotificationsCopy.grantedPickTime,
        onPrimary: _chooseStudyTime,
        doneLabel: NotificationsCopy.grantedDone,
        onDone: () => Navigator.of(context).maybePop(),
      ),
      _Phase.denied => _Outcome(
        key: const ValueKey('denied'),
        icon: LucideIcons.bellOff,
        title: NotificationsCopy.deniedTitle,
        body: NotificationsCopy.deniedBody,
        doneLabel: NotificationsCopy.deniedDone,
        onDone: () => Navigator.of(context).maybePop(),
      ),
    };

    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.ui),
      switchInCurve: Motion.out,
      child: child,
    );
  }
}

class _Ask extends StatelessWidget {
  const _Ask({
    required this.prefs,
    required this.asking,
    required this.onAllow,
    required this.onNotNow,
  });

  final NotificationPrefs prefs;
  final bool asking;
  final VoidCallback onAllow;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;

    return Column(
      key: const ValueKey('ask'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(NotificationsCopy.promptTitle, style: type.title),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          NotificationsCopy.promptLead,
          style: type.body.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s20),
        Text(
          NotificationsCopy.promptExamplesLabel,
          style: type.label.copyWith(color: colors.ink3),
        ),
        const SizedBox(height: MmSpace.s8),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.sunken,
            borderRadius: MmRadius.panelAll,
            border: Border.all(color: colors.line),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
            child: Column(
              children: [
                StaggerIn(
                  index: 0,
                  child: const NotificationPreview(
                    icon: LucideIcons.clipboardCheck,
                    channel: NotificationsCopy.exampleResultChannel,
                    body: NotificationsCopy.exampleResultBody,
                  ),
                ),
                const _PreviewRule(),
                StaggerIn(
                  index: 1,
                  child: const NotificationPreview(
                    icon: LucideIcons.wrench,
                    channel: NotificationsCopy.exampleStudyChannel,
                    body: NotificationsCopy.exampleStudyBody,
                  ),
                ),
                const _PreviewRule(),
                StaggerIn(
                  index: 2,
                  child: const NotificationPreview(
                    icon: LucideIcons.calendarDays,
                    channel: NotificationsCopy.exampleWeeklyChannel,
                    body: NotificationsCopy.exampleWeeklyBody,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        Text(
          '${NotificationsCopy.promptQuietLine(formatClock(prefs.quietStart), formatClock(prefs.quietEnd))} ${NotificationsCopy.promptStudyNote}',
          style: type.small.copyWith(color: colors.ink3),
        ),
        const SizedBox(height: MmSpace.s24),
        KeyButton(
          label: NotificationsCopy.promptAllow,
          loading: asking,
          onPressed: asking ? null : onAllow,
        ),
        const SizedBox(height: MmSpace.s8),
        KeyButton.quiet(
          label: NotificationsCopy.promptNotNow,
          expanded: true,
          onPressed: asking ? null : onNotNow,
        ),
      ],
    );
  }
}

class _PreviewRule extends StatelessWidget {
  const _PreviewRule();

  @override
  Widget build(BuildContext context) =>
      SizedBox(height: 1, child: ColoredBox(color: context.mmColors.line));
}

class _Outcome extends StatelessWidget {
  const _Outcome({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.doneLabel,
    required this.onDone,
    this.primaryLabel,
    this.onPrimary,
  });

  final IconData icon;
  final String title;
  final String body;
  final String doneLabel;
  final VoidCallback onDone;
  final String? primaryLabel;
  final VoidCallback? onPrimary;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.s8),
        Align(
          child: ExcludeSemantics(
            child: Icon(icon, size: 32, color: colors.ink),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        Semantics(
          header: true,
          liveRegion: true,
          child: Text(title, style: type.title, textAlign: TextAlign.center),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          body,
          style: type.body.copyWith(color: colors.ink2),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: MmSpace.s24),
        if (primaryLabel != null) ...[
          KeyButton(label: primaryLabel!, onPressed: onPrimary),
          const SizedBox(height: MmSpace.s8),
          KeyButton.quiet(label: doneLabel, expanded: true, onPressed: onDone),
        ] else
          KeyButton(label: doneLabel, onPressed: onDone),
      ],
    );
  }
}
