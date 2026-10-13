import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/choices.dart';
import '../model/plan.dart';
import '../state/answers_controller.dart';
import '../state/sheet_sync.dart';
import '../widgets/sheet_status.dart';
import '../widgets/usage_data_card.dart';

/// The sheet that follows sign-in (the `/before-you-start` route), once per phone.
///
/// With a sealed onboarding sheet: the save state of the sheet ("Saving your sheet", then
/// "Saved to your account." only after every write is acknowledged), and for adults the
/// usage-data switch. Without one (a student who signed straight in): "Are you 18 or older?",
/// then usage data for adults, as before.
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

  /// Closes the sheet and opens [location] (the starting-point check).
  void _leaveTo(String location) {
    if (_leaving) return;
    _leaving = true;
    final router = GoRouter.of(context);
    final nav = Navigator.of(context);
    if (nav.canPop()) nav.pop();
    router.go(location);
  }

  void _done() {
    if (_leaving) return;
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
      if (band == AgeBand.adult) {
        setState(() {
          _savingAge = null;
          _usageStep = true;
        });
      } else {
        _done();
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
      if (next.phase == SheetSyncPhase.saved && previous?.phase == SheetSyncPhase.saving) {
        ref.read(hapticsProvider).success();
      }
    });
    final answers = ref.watch(onboardingAnswersProvider).value ?? OnboardingAnswers.empty;
    final consent = ref.watch(consentRepositoryProvider);
    final usageOn = consent.consent.analyticsAllowed && !consent.withdrawalPending;

    if (answers.sealed) {
      final sync = ref.watch(sheetSyncProvider);
      final move = FirstMove.of(answers);
      return SheetSavedView(
        startLabel: OnboardingCopy.startNow,
        laterLabel: move.laterLabel(ref.watch(nowProvider)()),
        onStart: () => _leaveTo(move.route),
        onLater: () {
          ref.read(onboardingAnswersProvider.notifier).setTonight(true);
          _done();
        },
        phase: sync.phase,
        offline: sync.offline,
        showUsage: answers.age == AgeAnswer.adult,
        usageOn: usageOn,
        usageBusy: _usageBusy,
        eventsOpen: _eventsOpen,
        error: _error,
        onRetry: () => ref.read(sheetSyncProvider.notifier).run(),
        onToggleUsage: _setUsage,
        onToggleEvents: () => setState(() => _eventsOpen = !_eventsOpen),
        onDone: _done,
      );
    }

    final alreadyDecided = !_touched && consent.isLoaded && consent.consent.ageBand != AgeBand.unknown;
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
    return AgeThenUsageView(
      usageStep: _usageStep,
      savingAge: _savingAge,
      usageOn: usageOn,
      usageBusy: _usageBusy,
      eventsOpen: _eventsOpen,
      error: _error,
      onAnswerAge: _answerAge,
      onSkip: _done,
      onToggleUsage: _setUsage,
      onToggleEvents: () => setState(() => _eventsOpen = !_eventsOpen),
      onDone: _done,
    );
  }
}

/// The saved state of the sheet, then usage data for adults. Rendered by the goldens.
class SheetSavedView extends StatelessWidget {
  const SheetSavedView({
    super.key,
    required this.phase,
    required this.onRetry,
    required this.onToggleUsage,
    required this.onToggleEvents,
    required this.onDone,
    this.offline = false,
    this.showUsage = false,
    this.usageOn = false,
    this.usageBusy = false,
    this.eventsOpen = false,
    this.error,
    this.startLabel,
    this.laterLabel,
    this.onStart,
    this.onLater,
  });

  final SheetSyncPhase phase;

  /// The first move: "Start now, about 10 minutes" and "Tomorrow at 8:00 PM". Without them the
  /// sheet ends on Done.
  final String? startLabel;
  final String? laterLabel;
  final VoidCallback? onStart;
  final VoidCallback? onLater;
  final bool offline;
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
        SheetStatus(phase: phase, offline: offline, onRetry: onRetry),
        if (showUsage) ...[
          const SizedBox(height: MmSpace.s20),
          UsageDataCard(on: usageOn, busy: usageBusy, eventsOpen: eventsOpen, onChanged: onToggleUsage, onToggleEvents: onToggleEvents),
        ],
        if (error != null) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(error!, style: type.small.copyWith(color: context.mmColors.badText))),
        ],
        const SizedBox(height: MmSpace.s20),
        if (startLabel != null && onStart != null) ...[
          Text(OnboardingCopy.firstMoveTitle, style: type.cardTitle),
          const SizedBox(height: MmSpace.s12),
          KeyButton(label: startLabel!, onPressed: usageBusy ? null : onStart),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: laterLabel ?? OnboardingCopy.done, onPressed: usageBusy ? null : (onLater ?? onDone)),
        ] else
          KeyButton(label: OnboardingCopy.done, onPressed: usageBusy ? null : onDone),
      ],
    );
  }
}

/// "Are you 18 or older?", then usage data for adults. Rendered by the goldens.
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
