import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api.dart';
import '../../../core/models/models.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../state/sample_import.dart';
import '../widgets/import_status_line.dart';
import '../widgets/usage_data_card.dart';

enum _Step { age, usage }

/// "Before you start" (spec 5.1.6): one skippable sheet shown after sign-in. Step 1 asks whether
/// the student is 18 or older and writes only that answer. Step 2, for adults only, offers the
/// usage-data switch, off until they turn it on and shown on only after the server acknowledges.
/// A student whose age answer is already on the server skips straight to Today.
class BeforeYouStartSheet extends ConsumerStatefulWidget {
  const BeforeYouStartSheet({super.key});

  @override
  ConsumerState<BeforeYouStartSheet> createState() => _BeforeYouStartSheetState();
}

class _BeforeYouStartSheetState extends ConsumerState<BeforeYouStartSheet> {
  _Step _step = _Step.age;
  AgeBand? _saving;
  bool _usageBusy = false;
  bool _eventsOpen = false;
  String? _error;
  bool _leaving = false;

  /// Set once the student has answered here, so the repository's optimistic age band (it closes the
  /// usage-data gate before the write returns) is never mistaken for an answer from an earlier visit.
  bool _touched = false;

  void _toToday() {
    if (_leaving) return;
    _leaving = true;
    context.go(AppRoutes.today);
  }

  Future<void> _answerAge(AgeBand band) async {
    if (_saving != null) return;
    _touched = true;
    setState(() {
      _saving = band;
      _error = null;
    });
    try {
      await ref.read(consentRepositoryProvider.notifier).setAgeBand(band);
      if (!mounted) return;
      if (band == AgeBand.adult) {
        setState(() {
          _saving = null;
          _step = _Step.usage;
        });
      } else {
        _toToday();
      }
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = null;
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
    final consent = ref.watch(consentRepositoryProvider);
    final importPhase = ref.watch(sampleImportProvider).phase;
    final alreadyDecided = !_touched && consent.isLoaded && consent.consent.ageBand != AgeBand.unknown;
    final waiting = !consent.isLoaded && consent.status != ConsentStatus.failed;

    if (alreadyDecided) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _toToday();
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

    return BeforeYouStartView(
      showUsageStep: _step == _Step.usage,
      savingAge: _saving,
      usageOn: consent.consent.analyticsAllowed && !consent.withdrawalPending,
      usageBusy: _usageBusy,
      eventsOpen: _eventsOpen,
      error: _error,
      importPhase: importPhase,
      onAnswerAge: _answerAge,
      onSkip: _toToday,
      onToggleUsage: _setUsage,
      onToggleEvents: () => setState(() => _eventsOpen = !_eventsOpen),
      onDone: _toToday,
      onRetryImport: () => ref.read(sampleImportProvider.notifier).run(),
    );
  }
}

/// The pure layout of both steps, rendered by the goldens.
class BeforeYouStartView extends StatelessWidget {
  const BeforeYouStartView({
    super.key,
    required this.showUsageStep,
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
    this.importPhase = SampleImportPhase.idle,
    this.onRetryImport,
  });

  final bool showUsageStep;
  final AgeBand? savingAge;
  final bool usageOn;
  final bool usageBusy;
  final bool eventsOpen;
  final String? error;
  final SampleImportPhase importPhase;
  final ValueChanged<AgeBand> onAnswerAge;
  final VoidCallback onSkip;
  final ValueChanged<bool> onToggleUsage;
  final VoidCallback onToggleEvents;
  final VoidCallback onDone;
  final VoidCallback? onRetryImport;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          child: Text(showUsageStep ? OnboardingCopy.usageTitle : OnboardingCopy.beforeTitle, style: type.title),
        ),
        if (importPhase == SampleImportPhase.pending ||
            importPhase == SampleImportPhase.accepted ||
            importPhase == SampleImportPhase.failed) ...[
          const SizedBox(height: MmSpace.s12),
          ImportStatusLine(phase: importPhase, onRetry: onRetryImport),
        ],
        const SizedBox(height: MmSpace.s16),
        if (showUsageStep)
          ..._usageStep(context)
        else
          ..._ageStep(context),
      ],
    );
  }

  /// The failure line sits right under what the student just did, above the way out.
  Widget _errorLine(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: MmSpace.s12),
        child: Semantics(
          liveRegion: true,
          child: Text(error!, style: context.mmType.body.copyWith(color: context.mmColors.badText)),
        ),
      );

  List<Widget> _ageStep(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final busy = savingAge != null;
    Widget row(String label, AgeBand band) => Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s12),
          child: KeyButton.option(
            label: label,
            selected: savingAge == band,
            onPressed: busy && savingAge != band ? null : () => onAnswerAge(band),
          ),
        );
    return [
      Semantics(header: true, child: Text(OnboardingCopy.ageQuestion, style: type.subhead)),
      const SizedBox(height: MmSpace.s12),
      row(OnboardingCopy.ageYes, AgeBand.adult),
      row(OnboardingCopy.ageNo, AgeBand.minor),
      row(OnboardingCopy.agePreferNot, AgeBand.unknown),
      if (error != null) _errorLine(context),
      Text(OnboardingCopy.ageNote, style: type.small.copyWith(color: colors.ink3)),
      const SizedBox(height: MmSpace.s8),
      Align(
        alignment: AlignmentDirectional.centerStart,
        child: Transform.translate(
          offset: const Offset(-MmSpace.s16, 0),
          child: KeyButton.quiet(label: OnboardingCopy.skipForNow, onPressed: onSkip),
        ),
      ),
    ];
  }

  List<Widget> _usageStep(BuildContext context) => [
        UsageDataCard(
          on: usageOn,
          busy: usageBusy,
          eventsOpen: eventsOpen,
          onChanged: onToggleUsage,
          onToggleEvents: onToggleEvents,
        ),
        const SizedBox(height: MmSpace.s12),
        if (error != null) _errorLine(context),
        const SizedBox(height: MmSpace.s8),
        KeyButton(label: OnboardingCopy.usageDone, onPressed: usageBusy ? null : onDone),
      ];
}
