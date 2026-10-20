import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/storage/storage_providers.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../state/colleges_move.dart';
import '../state/sheet_sync.dart';
import '../widgets/sheet_status.dart';
import '../widgets/swipe_preview.dart';
import '../widgets/usage_data_card.dart';

/// The sheet that follows sign-in (the `/before-you-start` route), once per phone.
///
/// With a sealed onboarding sheet: the save state of the sheet ("Saving your sheet", then
/// "Saved to your account." only after every write is acknowledged), and for adults the
/// usage-data switch. Without one (a student who signed straight in): "Are you 18 or older?",
/// then usage data for adults, as before.
///
/// Usage data (owner, 18 Oct, D49; 20 Oct, D183): the switch starts on, says where to turn it off,
/// and a student who continues with it on is saved as allowed (`analyticsAllowed: true`, once the
/// server acknowledges). It is shown to 18 or older and to "Rather not say"; only "Not yet" (under
/// 18) never sees it and stays off. Nothing is sent before they continue, and nothing is collected
/// before the server agrees. An account that turned it off before starts off.
class AfterSignInSheet extends ConsumerStatefulWidget {
  const AfterSignInSheet({super.key});

  @override
  ConsumerState<AfterSignInSheet> createState() => _AfterSignInSheetState();
}

class _AfterSignInSheetState extends ConsumerState<AfterSignInSheet> {
  AgeBand? _savingAge;
  bool _usageStep = false;
  bool _usageBusy = false;
  bool _eventsOpen = false;
  bool _touched = false;
  bool _leaving = false;
  String? _error;

  /// The student's own position of the switch; null until they move it (then the default holds).
  bool? _usageChoice;

  /// The switch is on screen (an adult on either view), so continuing applies it.
  bool _usageVisible = false;

  /// The swipe preview shows on this install's first sheet only (D90): read once, then marked.
  bool _swipePreview = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      final prefs = ref.read(appPrefsProvider);
      try {
        if (await prefs.swipePreviewSeen()) return;
        if (!mounted) return;
        setState(() => _swipePreview = true);
        await prefs.setSwipePreviewSeen(true);
      } catch (_) {
        // A phone whose store cannot be read shows no preview: never a half-shown one.
      }
    });
  }

  /// What the switch shows: on once the server says so, otherwise the student's choice, otherwise
  /// on for an adult whose account never turned it off (D49).
  bool _usageShown(ConsentState consent) {
    if (consent.consent.analyticsAllowed && !consent.withdrawalPending) return true;
    final neverOff = consent.isLoaded && consent.consent.withdrawnAt == null && !consent.withdrawalPending;
    return _usageChoice ?? neverOff;
  }

  /// Saves "allowed" for an adult continuing with the switch on and the server not yet on. False
  /// when that write failed: the switch shows off with the reason, and the student stays to see
  /// it (the next tap continues, with usage data off).
  Future<bool> _applyUsage() async {
    final consent = ref.read(consentRepositoryProvider);
    if (!_usageVisible || consent.consent.analyticsAllowed || !_usageShown(consent)) return true;
    setState(() {
      _usageBusy = true;
      _error = null;
    });
    try {
      await ref.read(consentRepositoryProvider.notifier).setAnalyticsAllowed(true);
      if (mounted) setState(() => _usageBusy = false);
      return true;
    } on ApiError catch (e) {
      if (mounted) {
        setState(() {
          _usageBusy = false;
          _usageChoice = false;
          _error = e.isOffline ? OnboardingCopy.consentOffline : OnboardingCopy.usageTurnOnFailed;
        });
      }
      return false;
    }
  }

  /// Closes the sheet and opens [location] (the starting-point check).
  Future<void> _leaveTo(String location) async {
    if (_leaving || _usageBusy) return;
    if (!await _applyUsage() || !mounted) return;
    _leaving = true;
    final router = GoRouter.of(context);
    final nav = Navigator.of(context);
    if (nav.canPop()) nav.pop();
    router.go(location);
  }

  Future<void> _done() async {
    if (_leaving || _usageBusy) return;
    if (!await _applyUsage() || !mounted) return;
    _leaving = true;
    final nav = Navigator.of(context);
    if (nav.canPop()) {
      nav.pop();
    } else {
      context.go(AppRoutes.today);
    }
  }

  Future<void> _answerAge(AgeBand band) async {
    if (_savingAge != null) return;
    setState(() {
      _touched = true;
      _savingAge = band;
      _error = null;
    });
    try {
      await ref.read(consentRepositoryProvider.notifier).setAgeBand(band);
      if (!mounted) return;
      if (band != AgeBand.minor) {
        setState(() {
          _savingAge = null;
          _usageStep = true;
        });
      } else {
        await _done();
      }
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _savingAge = null;
        _error = e.isOffline ? OnboardingCopy.consentOffline : OnboardingCopy.consentSaveFailed;
      });
    }
  }

  Future<void> _setUsage(bool allowed) async {
    if (_usageBusy) return;
    final consent = ref.read(consentRepositoryProvider);
    // Until the server holds it on, the switch is the student's choice, applied when they
    // continue: moving it sends nothing.
    if (!consent.consent.analyticsAllowed || consent.withdrawalPending) {
      setState(() {
        _usageChoice = allowed;
        _error = null;
      });
      return;
    }
    setState(() {
      _usageBusy = true;
      _error = null;
    });
    try {
      await ref.read(consentRepositoryProvider.notifier).setAnalyticsAllowed(allowed);
      if (mounted) setState(() => _usageBusy = false);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _usageBusy = false;
        _error = e.isOffline
            ? OnboardingCopy.consentOffline
            : (allowed ? OnboardingCopy.usageTurnOnFailed : OnboardingCopy.usageTurnOffFailed);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // The success pattern belongs to the server's acknowledgment, and plays once.
    ref.listen<SheetSyncState>(sheetSyncProvider, (previous, next) {
      if ((next.phase == SheetSyncPhase.saved || next.phase == SheetSyncPhase.updated) && previous?.phase == SheetSyncPhase.saving) {
        ref.read(hapticsProvider).success();
      }
    });
    final answers = ref.watch(onboardingAnswersProvider).value ?? OnboardingAnswers.empty;
    final consent = ref.watch(consentRepositoryProvider);
    final usageOn = _usageShown(consent);

    if (answers.sealed) {
      final sync = ref.watch(sheetSyncProvider);
      final move = FirstMove.of(answers);
      return SheetSavedView(
        startTitle: move.title,
        startLabel: move.startLabel,
        laterLabel: move.laterLabel(ref.watch(nowProvider)()),
        onStart: () => _leaveTo(move.route),
        onLater: () async {
          if (_usageBusy) return;
          if (!await _applyUsage() || !mounted) return;
          ref.read(onboardingAnswersProvider.notifier).setTonight(true);
          await _done();
        },
        phase: sync.phase,
        offline: sync.offline,
        colleges: ref.watch(collegesMoveProvider),
        showUsage: _usageVisible = answers.age?.usageSwitch ?? false,
        usageOn: usageOn,
        usageBusy: _usageBusy,
        eventsOpen: _eventsOpen,
        error: _error,
        onRetry: () => ref.read(sheetSyncProvider.notifier).run(),
        onToggleUsage: _setUsage,
        onToggleEvents: () => setState(() => _eventsOpen = !_eventsOpen),
        onDone: _done,
        showSwipePreview: _swipePreview,
      );
    }

    final alreadyDecided = !_touched && consent.isLoaded && consent.consent.answered;
    final waiting = !consent.isLoaded && consent.status != ConsentStatus.failed;
    if (alreadyDecided) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _done();
      });
    }
    if (waiting || alreadyDecided) {
      return const SkeletonGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [Skeleton(height: 24), SizedBox(height: MmSpace.s24), Skeleton(height: 56), SizedBox(height: MmSpace.s12), Skeleton(height: 56)],
        ),
      );
    }
    _usageVisible = _usageStep;
    return AgeThenUsageView(
      usageStep: _usageStep,
      savingAge: _savingAge,
      usageOn: usageOn,
      usageBusy: _usageBusy,
      eventsOpen: _eventsOpen,
      error: _error,
      onAnswerAge: _answerAge,
      onSkip: () => _done(),
      onToggleUsage: _setUsage,
      onToggleEvents: () => setState(() => _eventsOpen = !_eventsOpen),
      onDone: _done,
    );
  }
}

/// The saved state of the sheet, then usage data (18 or older and "Rather not say"). Rendered by the goldens.
class SheetSavedView extends StatelessWidget {
  const SheetSavedView({
    super.key,
    required this.phase,
    required this.onRetry,
    required this.onToggleUsage,
    required this.onToggleEvents,
    required this.onDone,
    this.offline = false,
    this.colleges = CollegesMove.none,
    this.showUsage = false,
    this.usageOn = false,
    this.usageBusy = false,
    this.eventsOpen = false,
    this.error,
    this.startTitle = OnboardingCopy.firstMoveTitle,
    this.startLabel,
    this.laterLabel,
    this.onStart,
    this.onLater,
    this.showSwipePreview = false,
    this.swipeDemo = true,
  });

  final SheetSyncPhase phase;

  /// Under the starting-point keys, once per install: the card that shows how Today's deck
  /// works before the student meets it (D90). [swipeDemo] plays its nudge.
  final bool showSwipePreview;
  final bool swipeDemo;

  /// The first move: "Start now, about 10 minutes" and "Tomorrow at 8:00 PM". Without them the
  /// sheet ends on Done.
  final String? startLabel;
  final String? laterLabel;

  /// The heading over the first move: "Your starting point", or "Your first move" for practice.
  final String startTitle;
  final VoidCallback? onStart;
  final VoidCallback? onLater;
  final bool offline;

  /// Where the picked colleges stand (see [SheetStatus.colleges]).
  final CollegesMove colleges;
  final bool showUsage;
  final bool usageOn;
  final bool usageBusy;
  final bool eventsOpen;
  final String? error;
  final VoidCallback onRetry;
  final ValueChanged<bool> onToggleUsage;
  final VoidCallback onToggleEvents;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(OnboardingCopy.sheetTitle, style: type.title)),
        const SizedBox(height: MmSpace.s16),
        SheetStatus(phase: phase, offline: offline, colleges: colleges),
        if (showUsage) ...[
          const SizedBox(height: MmSpace.s12),
          UsageDataCard(on: usageOn, busy: usageBusy, eventsOpen: eventsOpen, onChanged: onToggleUsage, onToggleEvents: onToggleEvents),
        ],
        if (error != null) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(error!, style: type.small.copyWith(color: context.mmColors.badText))),
        ],
        const SizedBox(height: MmSpace.s20),
        if (phase == SheetSyncPhase.failed) ...[
          // A failed save is the one thing to act on: Try again is the key, and what the student
          // was going to do stays below it, quieter.
          KeyButton(label: OnboardingCopy.tryAgain, onPressed: usageBusy ? null : onRetry),
          const SizedBox(height: MmSpace.s8),
          if (startLabel != null && onStart != null) ...[
            KeyButton.secondary(label: startLabel!, onPressed: usageBusy ? null : onStart),
            Center(child: KeyButton.quiet(label: OnboardingCopy.done, onPressed: usageBusy ? null : onDone)),
          ] else
            KeyButton.secondary(label: OnboardingCopy.done, onPressed: usageBusy ? null : onDone),
        ] else if (startLabel != null && onStart != null) ...[
          Text(startTitle, style: type.cardTitle),
          const SizedBox(height: MmSpace.s12),
          KeyButton(label: startLabel!, onPressed: usageBusy ? null : onStart),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: laterLabel ?? OnboardingCopy.done, onPressed: usageBusy ? null : (onLater ?? onDone)),
          if (showSwipePreview) ...[
            const SizedBox(height: MmSpace.s20),
            SwipePreviewCard(demo: swipeDemo),
          ],
        ] else
          KeyButton(label: OnboardingCopy.done, onPressed: usageBusy ? null : onDone),
      ],
    );
  }
}

/// "Are you 18 or older?", then usage data unless the answer was "Not yet". Rendered by the goldens.
class AgeThenUsageView extends StatelessWidget {
  const AgeThenUsageView({
    super.key,
    required this.usageStep,
    required this.onAnswerAge,
    required this.onSkip,
    required this.onToggleUsage,
    required this.onToggleEvents,
    required this.onDone,
    this.savingAge,
    this.usageOn = false,
    this.usageBusy = false,
    this.eventsOpen = false,
    this.error,
  });

  final bool usageStep;
  final AgeBand? savingAge;
  final bool usageOn;
  final bool usageBusy;
  final bool eventsOpen;
  final String? error;
  final ValueChanged<AgeBand> onAnswerAge;
  final VoidCallback onSkip;
  final ValueChanged<bool> onToggleUsage;
  final VoidCallback onToggleEvents;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final busy = savingAge != null;
    Widget row(String label, AgeBand band) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s8),
          child: MmSelectRow(
            title: label,
            selected: savingAge == band,
            onTap: busy && savingAge != band ? null : () => onAnswerAge(band),
          ),
        );
    final errorLine = error == null
        ? null
        : Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Semantics(liveRegion: true, child: Text(error!, style: type.small.copyWith(color: colors.badText))),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(usageStep ? OnboardingCopy.usageTitle : OnboardingCopy.beforeTitle, style: type.title)),
        const SizedBox(height: MmSpace.s16),
        if (usageStep) ...[
          UsageDataCard(on: usageOn, busy: usageBusy, eventsOpen: eventsOpen, onChanged: onToggleUsage, onToggleEvents: onToggleEvents),
          const SizedBox(height: MmSpace.s12),
          ?errorLine,
          KeyButton(label: OnboardingCopy.done, onPressed: usageBusy ? null : onDone),
        ] else ...[
          Text(OnboardingCopy.ageQuestionPlain, style: type.cardTitle),
          const SizedBox(height: MmSpace.s12),
          row(OnboardingCopy.ageYes, AgeBand.adult),
          row(OnboardingCopy.ageNo, AgeBand.minor),
          row(OnboardingCopy.agePreferNot, AgeBand.unknown),
          ?errorLine,
          Text(OnboardingCopy.ageNote, style: type.small.copyWith(color: colors.ink3)),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(label: OnboardingCopy.skipForNow, onPressed: onSkip),
            ),
          ),
        ],
      ],
    );
  }
}
