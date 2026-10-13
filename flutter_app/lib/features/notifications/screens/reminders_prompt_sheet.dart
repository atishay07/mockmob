import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/motion/motion.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/reminder_store.dart' show reminderStoreProvider;
import '../logic/pre_prompt_policy.dart';
import '../logic/pre_prompt_variants.dart';
import '../logic/reminder_plan.dart' show RepairReady;
import '../services/notification_providers.dart';
import '../services/system_settings.dart';
import '../widgets/notification_preview.dart';
import '../widgets/time_sheet.dart';

enum _Phase { ask, granted, denied }

/// What the sheet was opened on: the wording it uses (set by how many times it has been put to
/// the student) and whether Android still shows its own question. Read once, so the wording
/// does not change under the student while the sheet is up.
class _Opened {
  const _Opened({required this.asks, required this.permission});

  final int asks;
  final NotificationPermission permission;

  _Opened withPermission(NotificationPermission next) =>
      _Opened(asks: asks, permission: next);
}

/// The pre-prompt sheet "Remind me when it matters" (spec 8): three examples of what a reminder
/// would say, a main key, and Not now. The main key opens the Android 13 system dialog; once
/// Android has stopped showing it (two refusals) it says Open settings and opens MockMob's
/// notification settings instead. Whatever the student chooses, the sheet ends on a designed
/// state and never blocks study.
///
/// It comes back after a Not now, a refusal or a closed sheet (see `shouldOfferPrePrompt`) and
/// asks a different way each time (see `prePromptVariantFor`). Opening it counts as one ask,
/// written before it can close.
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
  _Opened? _opened;
  Future<void>? _recording;
  AppLifecycleListener? _lifecycle;

  @override
  void initState() {
    super.initState();
    unawaited(_open());
    // Coming back from Android settings with notifications on ends on the granted state.
    _lifecycle = AppLifecycleListener(onResume: () => unawaited(_recheck()));
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    var asks = 0;
    var permission = NotificationPermission.notAsked;
    try {
      asks = (await ref.read(reminderStoreProvider).load()).prePromptAskCount;
      if (!mounted) return;
      permission = await ref.read(permissionRequesterProvider).notificationPermission();
    } on Object {
      // The sheet still opens, on the first wording and the plain key.
    }
    if (!mounted) return;
    setState(() => _opened = _Opened(asks: asks, permission: permission));
    // Counted as soon as it is on screen, so closing it any way at all keeps the spacing.
    // A student who already has reminders on is not being asked.
    if (permission != NotificationPermission.granted) {
      _recording = _record();
      await _recording;
    }
  }

  Future<void> _record() async {
    try {
      await ref.read(prePromptAsksProvider).record();
    } on Object {
      // The ask simply counts one less; the sheet is unaffected.
    }
  }

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

  Future<void> _openSettings() async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final opened = await ref.read(systemSettingsProvider).openNotificationSettings();
    if (!opened) {
      messenger?.showSnackBar(const SnackBar(content: Text(NotificationsCopy.settingsDidNotOpen)));
    }
  }

  /// The app came back to the front: the student may have allowed notifications in Android
  /// settings. Android's own dialog also brings the app back, so a running request is left alone.
  Future<void> _recheck() async {
    if (_phase != _Phase.ask || _asking || _opened == null) return;
    NotificationPermission permission;
    try {
      permission = await ref.read(permissionRequesterProvider).notificationPermission();
    } on Object {
      return;
    }
    if (!mounted || _phase != _Phase.ask || _asking) return;
    ref.invalidate(notificationPermissionProvider);
    if (permission == NotificationPermission.granted) {
      unawaited(ref.read(hapticsProvider).settle());
      unawaited(ref.read(reminderSchedulerProvider).sync());
      setState(() => _phase = _Phase.granted);
    } else if (permission != _opened!.permission) {
      setState(() => _opened = _opened!.withPermission(permission));
    }
  }

  Future<void> _notNow() async {
    // The ask was counted when the sheet opened; make sure that write has finished before the
    // sheet closes, so the spacing holds even if the app is killed right after.
    await _recording;
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
    final opened = _opened;
    final window = prefs.studyWindow;
    final child = switch (_phase) {
      // The first frames, until the wording is known: nothing, rather than a wording that then changes.
      _Phase.ask when opened == null => const SizedBox.shrink(key: ValueKey('opening')),
      _Phase.ask => _Ask(
        prefs: prefs,
        repair: ref.watch(repairReadyProvider),
        variant: prePromptVariantFor(
          opened!.asks,
          studyTime: window == null ? null : formatClock(window.start),
        ),
        primary: prePromptPrimaryFor(opened.permission),
        asking: _asking,
        onAllow: _allow,
        onOpenSettings: () => unawaited(_openSettings()),
        onNotNow: _notNow,
      ),
      _Phase.granted => _Outcome(
        key: const ValueKey('granted'),
        mobi: MobiPose.cheer,
        title: NotificationsCopy.grantedTitle,
        body: NotificationsCopy.grantedBody,
        primaryLabel: NotificationsCopy.grantedPickTime,
        onPrimary: _chooseStudyTime,
        doneLabel: NotificationsCopy.grantedDone,
        onDone: () => Navigator.of(context).maybePop(),
      ),
      _Phase.denied => _Outcome(
        key: const ValueKey('denied'),
        mobi: MobiPose.rest,
        title: NotificationsCopy.deniedTitle,
        body: NotificationsCopy.deniedBody,
        secondaryLabel: NotificationsCopy.openAndroidSettings,
        onSecondary: () => unawaited(_openSettings()),
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
    this.repair,
    required this.variant,
    required this.primary,
    required this.asking,
    required this.onAllow,
    required this.onOpenSettings,
    required this.onNotNow,
  });

  final NotificationPrefs prefs;

  /// The student's own waiting repair, so its preview says their real count. Null shows the
  /// plain description with no number.
  final RepairReady? repair;

  /// The title and line for this ask: a different wording each time the sheet comes back.
  final PrePromptVariant variant;

  /// Allow reminders, or Open settings once Android no longer shows its question.
  final PrePromptPrimary primary;
  final bool asking;
  final VoidCallback onAllow;
  final VoidCallback onOpenSettings;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final waiting = repair;
    final window = prefs.studyWindow;
    // Each preview is the student's own reminder where the app knows it, and a plain line
    // with no number where it does not.
    final repairBody = waiting == null
        ? NotificationsCopy.exampleRepairBody
        : NotificationsCopy.repairBody(waiting.mistakes, waiting.minutes);
    final studyBody = window == null
        ? NotificationsCopy.exampleStudyBody
        : NotificationsCopy.exampleStudyAt(formatClock(window.start));

    return Column(
      key: const ValueKey('ask'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(variant.title, style: type.title),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            const Mobi(pose: MobiPose.greet, size: 64),
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          variant.line,
          style: type.body.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s16),
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
                  child: NotificationPreview(
                    icon: LucideIcons.wrench,
                    channel: NotificationsCopy.exampleRepairChannel,
                    body: repairBody,
                  ),
                ),
                const _PreviewRule(),
                StaggerIn(
                  index: 2,
                  child: NotificationPreview(
                    icon: LucideIcons.clock,
                    channel: NotificationsCopy.exampleStudyChannel,
                    body: studyBody,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        // Once Android no longer asks, the way forward takes the note's place: the sheet must
        // stay short enough that its main key is in view without scrolling.
        if (primary == PrePromptPrimary.openSettings)
          Text(
            NotificationsCopy.promptBlockedNote,
            style: type.small.copyWith(color: colors.ink2),
          )
        else
          Text(
            '${NotificationsCopy.promptQuietLine(formatClock(prefs.quietStart), formatClock(prefs.quietEnd))} ${NotificationsCopy.promptStudyNote}',
            style: type.small.copyWith(color: colors.ink3),
          ),
        const SizedBox(height: MmSpace.s20),
        if (primary == PrePromptPrimary.openSettings)
          KeyButton(label: NotificationsCopy.promptOpenSettings, onPressed: onOpenSettings)
        else
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
    required this.mobi,
    required this.title,
    required this.body,
    required this.doneLabel,
    required this.onDone,
    this.primaryLabel,
    this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
  });

  /// Mobi cheers once Android granted it, and sits calmly when it did not.
  final MobiPose mobi;
  final String title;
  final String body;
  final String doneLabel;
  final VoidCallback onDone;
  final String? primaryLabel;
  final VoidCallback? onPrimary;

  /// A secondary way forward next to Done (Open Android settings after a refusal).
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.s8),
        Align(child: Mobi(pose: mobi, size: 88)),
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
        ] else if (secondaryLabel != null) ...[
          KeyButton(label: doneLabel, onPressed: onDone),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: secondaryLabel!, onPressed: onSecondary),
        ] else
          KeyButton(label: doneLabel, onPressed: onDone),
      ],
    );
  }
}
