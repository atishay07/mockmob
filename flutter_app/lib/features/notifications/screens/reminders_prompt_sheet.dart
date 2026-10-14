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
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../data/reminder_store.dart' show reminderStoreProvider;
import '../logic/pre_prompt_policy.dart';
import '../logic/pre_prompt_variants.dart';
import '../logic/reminder_plan.dart' show RepairReady;
import '../services/notification_providers.dart';
import '../services/system_settings.dart';
import '../widgets/balanced_text.dart';
import '../widgets/notification_preview.dart';
import '../widgets/time_sheet.dart';

enum _Phase { ask, granted, denied }

/// Above this text scale the ask shows one example, not three: the sheet stays a bottom sheet
/// until 1.5x, and three examples make a long scroll above the keys well before that.
const double _compactTextScale = 1.15;

/// Above this the ask also drops Mobi and the examples label, so the words get the room just
/// below full page.
const double _tightTextScale = 1.35;

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

class _PromptState {
  const _PromptState({this.phase = _Phase.ask, this.asking = false, this.opened});

  final _Phase phase;

  /// Android's own question is up.
  final bool asking;

  /// Null for the first frames, until the wording is known.
  final _Opened? opened;

  _PromptState copyWith({_Phase? phase, bool? asking, _Opened? opened}) =>
      _PromptState(phase: phase ?? this.phase, asking: asking ?? this.asking, opened: opened ?? this.opened);
}

/// The sheet's state, shared by its body ([RemindersPromptSheet]) and its keys
/// ([RemindersPromptKeys]), which sit in different parts of the sheet: the keys are pinned in
/// the footer. Lives while the sheet is up.
final _promptProvider = NotifierProvider.autoDispose<_Prompt, _PromptState>(_Prompt.new);

class _Prompt extends Notifier<_PromptState> {
  Future<void>? _recording;

  @override
  _PromptState build() {
    // Coming back from Android settings with notifications on ends on the granted state.
    final lifecycle = AppLifecycleListener(onResume: () => unawaited(_recheck()));
    ref.onDispose(lifecycle.dispose);
    scheduleMicrotask(() => unawaited(_open()));
    return const _PromptState();
  }

  Future<void> _open() async {
    var asks = 0;
    var permission = NotificationPermission.notAsked;
    try {
      asks = (await ref.read(reminderStoreProvider).load()).prePromptAskCount;
      if (!ref.mounted) return;
      permission = await ref.read(permissionRequesterProvider).notificationPermission();
    } on Object {
      // The sheet still opens, on the first wording and the plain key.
    }
    if (!ref.mounted) return;
    state = state.copyWith(opened: _Opened(asks: asks, permission: permission));
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

  /// The ask was counted when the sheet opened; this finishes when that write has, so a Not now
  /// keeps the spacing even if the app is killed right after.
  Future<void> recorded() => _recording ?? Future<void>.value();

  Future<void> allow() async {
    if (state.asking) return;
    state = state.copyWith(asking: true);
    NotificationPermission result;
    try {
      result = await ref.read(permissionRequesterProvider).requestNotificationPermission();
    } on Object {
      result = NotificationPermission.denied;
    }
    if (!ref.mounted) return;
    ref.invalidate(notificationPermissionProvider);
    final granted = result == NotificationPermission.granted;
    if (granted) {
      unawaited(ref.read(hapticsProvider).settle());
      _replan();
    }
    state = state.copyWith(asking: false, phase: granted ? _Phase.granted : _Phase.denied);
  }

  /// Plans the reminders now that Android allows them. Nothing awaits it, so a failure (the
  /// plugin or storage) is caught here: the runtime plans again on the next resume or change.
  void _replan() {
    unawaited(
      ref.read(reminderSchedulerProvider).sync().catchError((Object _) {}),
    );
  }

  /// The app came back to the front: the student may have allowed notifications in Android
  /// settings. Android's own dialog also brings the app back, so a running request is left alone.
  ///
  /// After a refusal the student may do the same, so the denied state is checked too: it must not
  /// keep saying reminders stay off once they are on.
  Future<void> _recheck() async {
    if (state.phase == _Phase.granted || state.asking || state.opened == null) return;
    NotificationPermission permission;
    try {
      permission = await ref.read(permissionRequesterProvider).notificationPermission();
    } on Object {
      return;
    }
    if (!ref.mounted || state.phase == _Phase.granted || state.asking) return;
    ref.invalidate(notificationPermissionProvider);
    final opened = state.opened!;
    if (permission == NotificationPermission.granted) {
      unawaited(ref.read(hapticsProvider).settle());
      _replan();
      state = state.copyWith(phase: _Phase.granted);
    } else if (state.phase == _Phase.ask && permission != opened.permission) {
      state = state.copyWith(opened: opened.withPermission(permission));
    }
  }
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
/// The body only: `MmSheetPage` supplies the frame, and [RemindersPromptKeys] goes in its
/// footer, so the keys stay in view at any text size.
class RemindersPromptSheet extends ConsumerWidget {
  const RemindersPromptSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(_promptProvider);
    final prefs =
        ref.watch(notificationPrefsRepositoryProvider).value ??
        NotificationPrefs.defaults;
    final opened = view.opened;
    final window = prefs.studyWindow;
    // Mobi cheers that reminders are on only while Celebrations is Full; Quiet and Off keep him
    // calm (the words say the same thing).
    final cheer = ref.watch(celebrationModeProvider) == CelebrationMode.full;
    final child = switch (view.phase) {
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
      ),
      _Phase.granted => _Outcome(
        key: const ValueKey('granted'),
        mobi: cheer ? MobiPose.cheer : MobiPose.rest,
        title: NotificationsCopy.grantedTitle,
        body: NotificationsCopy.grantedBody,
      ),
      _Phase.denied => const _Outcome(
        key: ValueKey('denied'),
        mobi: MobiPose.rest,
        title: NotificationsCopy.deniedTitle,
        body: NotificationsCopy.deniedBody,
      ),
    };

    return _phaseSwitcher(context, child);
  }
}

/// One state leaves, then the next arrives: the old one fades over the first half, the new one
/// over the second, so two Mobis are never on the sheet together. Instant under reduced motion.
Widget _phaseSwitcher(BuildContext context, Widget child) => AnimatedSwitcher(
  duration: Motion.of(context, Motion.card),
  switchInCurve: const Interval(0.5, 1, curve: Motion.out),
  switchOutCurve: const Interval(0.5, 1),
  child: child,
);

/// The pre-prompt sheet's keys, for the sheet's footer: Allow reminders (or Open settings) and
/// Not now while it asks, then the keys of the state it ends on. Pinned under the scrolling
/// body, so they stay in view at large text on a small phone.
class RemindersPromptKeys extends ConsumerWidget {
  const RemindersPromptKeys({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(_promptProvider);
    final prompt = ref.read(_promptProvider.notifier);
    final opened = view.opened;

    Future<void> openSettings() async {
      final messenger = ScaffoldMessenger.maybeOf(context);
      final done = await ref.read(systemSettingsProvider).openNotificationSettings();
      if (!done) {
        messenger?.showSnackBar(const SnackBar(content: Text(NotificationsCopy.settingsDidNotOpen)));
      }
    }

    Future<void> notNow() async {
      await prompt.recorded();
      if (context.mounted) await Navigator.of(context).maybePop();
    }

    void close() => Navigator.of(context).maybePop();

    void chooseStudyTime() {
      final router = GoRouter.of(context);
      Navigator.of(context).maybePop();
      unawaited(router.push(AppRoutes.youNotifications));
    }

    final keys = switch (view.phase) {
      // Until the wording is known the keys' room is kept, so nothing moves when they appear.
      _Phase.ask when opened == null => const ExcludeSemantics(
        child: Visibility(
          visible: false,
          maintainSize: true,
          maintainAnimation: true,
          maintainState: true,
          child: _KeyPair(
            first: KeyButton(label: NotificationsCopy.promptAllow, onPressed: null),
            second: KeyButton.quiet(label: NotificationsCopy.promptNotNow, expanded: true, onPressed: null),
          ),
        ),
      ),
      _Phase.ask => _KeyPair(
        first: prePromptPrimaryFor(opened!.permission) == PrePromptPrimary.openSettings
            ? KeyButton(label: NotificationsCopy.promptOpenSettings, onPressed: () => unawaited(openSettings()))
            : KeyButton(
                label: NotificationsCopy.promptAllow,
                loading: view.asking,
                onPressed: view.asking ? null : () => unawaited(prompt.allow()),
              ),
        second: KeyButton.quiet(
          label: NotificationsCopy.promptNotNow,
          expanded: true,
          onPressed: view.asking ? null : () => unawaited(notNow()),
        ),
      ),
      _Phase.granted => _KeyPair(
        first: KeyButton(label: NotificationsCopy.grantedPickTime, onPressed: chooseStudyTime),
        second: KeyButton.quiet(label: NotificationsCopy.grantedDone, expanded: true, onPressed: close),
      ),
      _Phase.denied => _KeyPair(
        first: KeyButton(label: NotificationsCopy.deniedDone, onPressed: close),
        second: KeyButton.secondary(label: NotificationsCopy.openAndroidSettings, onPressed: () => unawaited(openSettings())),
      ),
    };

    return _phaseSwitcher(context, KeyedSubtree(key: ValueKey('${view.phase.name}-${opened == null}'), child: keys));
  }
}

/// The main key over the second one, 8 dp apart.
class _KeyPair extends StatelessWidget {
  const _KeyPair({required this.first, required this.second});

  final Widget first;
  final Widget second;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [first, const SizedBox(height: MmSpace.s8), second],
      );
}

class _Ask extends StatelessWidget {
  const _Ask({
    required this.prefs,
    this.repair,
    required this.variant,
    required this.primary,
  });

  final NotificationPrefs prefs;

  /// The student's own waiting repair, so its preview says their real count. Null shows the
  /// plain description with no number.
  final RepairReady? repair;

  /// The title and line for this ask: a different wording each time the sheet comes back.
  final PrePromptVariant variant;

  /// Allow reminders, or Open settings once Android no longer shows its question: decides the
  /// note above the keys.
  final PrePromptPrimary primary;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final waiting = repair;
    final window = prefs.studyWindow;
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    final compact = textScale > _compactTextScale;
    final tight = textScale > _tightTextScale;
    // Each preview is the student's own reminder where the app knows it, and a plain line
    // with no number where it does not.
    final repairBody = waiting == null
        ? NotificationsCopy.exampleRepairBody
        : NotificationsCopy.repairBody(waiting.mistakes, waiting.minutes);
    final studyBody = window == null
        ? NotificationsCopy.exampleStudyBody
        : NotificationsCopy.exampleStudyAt(formatClock(window.start));

    const resultPreview = NotificationPreview(
      icon: LucideIcons.clipboardCheck,
      channel: NotificationsCopy.exampleResultChannel,
      body: NotificationsCopy.exampleResultBody,
    );
    final repairPreview = NotificationPreview(
      icon: LucideIcons.wrench,
      channel: NotificationsCopy.exampleRepairChannel,
      body: repairBody,
    );
    final studyPreview = NotificationPreview(
      icon: LucideIcons.clock,
      channel: NotificationsCopy.exampleStudyChannel,
      body: studyBody,
    );
    const weeklyPreview = NotificationPreview(
      icon: LucideIcons.calendar,
      channel: NotificationsCopy.exampleWeeklyChannel,
      body: NotificationsCopy.exampleWeeklyBody,
    );

    // The ask shows the examples it is about: the repair ask shows the repair reminder, not
    // all three. The first and last wordings are about reminders in general, so they show the
    // three kinds. At larger text it is one, the student's own waiting repair when there is one.
    final general = variant.focus == PrePromptFocus.all;
    final List<Widget> previews = switch (variant.focus) {
      PrePromptFocus.all when compact => [waiting != null ? repairPreview : resultPreview],
      PrePromptFocus.all => [resultPreview, repairPreview, studyPreview],
      PrePromptFocus.study => [studyPreview],
      PrePromptFocus.repair => [repairPreview],
      PrePromptFocus.result => [resultPreview],
      PrePromptFocus.weekly => [weeklyPreview],
    };

    return Column(
      key: const ValueKey('ask'),
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: BalancedText(variant.title, style: type.title),
              ),
            ),
            // Mobi is decoration: smaller, so the title keeps its room, and gone at the largest
            // sizes below full page, where the room goes to the words.
            if (!tight) ...[
              const SizedBox(width: MmSpace.s12),
              const Mobi(pose: MobiPose.greet, size: 52),
            ],
          ],
        ),
        // The first ask has no lead: the label and the examples below say it. The other wordings
        // keep their one line, since that line is the reason for asking this way.
        if (variant.showLine) ...[
          const SizedBox(height: MmSpace.s8),
          Text(
            variant.line,
            style: type.small.copyWith(color: colors.ink2),
          ),
        ],
        const SizedBox(height: MmSpace.s16),
        if (general && !tight) ...[
          Text(
            NotificationsCopy.promptExamplesLabel,
            style: type.label.copyWith(color: colors.ink3),
          ),
          const SizedBox(height: MmSpace.s4),
        ],
        // The examples sit straight on the sheet in a hairline list: they arrive in order,
        // once, on the shared stagger, after the glass has opened. Under reduced motion they
        // are just there.
        MmStagger(
          child: PreviewList(
            children: [
              for (var i = 0; i < previews.length; i++) MmStaggerItem(index: i, child: previews[i]),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s12),
        // Once Android no longer asks, the way forward takes the note's place.
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
      ],
    );
  }
}

class _Outcome extends StatelessWidget {
  const _Outcome({
    super.key,
    required this.mobi,
    required this.title,
    required this.body,
  });

  /// Mobi cheers once Android granted it, and sits calmly when it did not.
  final MobiPose mobi;
  final String title;
  final String body;

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
      ],
    );
  }
}
