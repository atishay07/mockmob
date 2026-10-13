import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/copy.dart';
import '../../practice/data/launch_flow.dart';
import '../../practice/data/practice_quote.dart';
import '../../practice/model/practice_selection.dart';
import '../../practice/widgets/failure_copy.dart';
import 'nta_chip.dart';
import 'nta_copy.dart';
import 'nta_header.dart';
import 'nta_instructions_parts.dart';
import 'nta_palette.dart';
import 'nta_paper_theme.dart';
import 'nta_runner_screen.dart' show ntaCandidateNameProvider;
import 'nta_skin.dart';

/// The exam's instructions page (NTA-MODE-SPEC 9.6, an app addition): read before the clock
/// exists. Start checks the quote, then calls `POST /api/sessions` through the shared launch,
/// so the timer starts only when the student taps it. Pro gating comes from the quote itself.
class NtaInstructionsScreen extends ConsumerStatefulWidget {
  const NtaInstructionsScreen({super.key, required this.subject});

  final String subject;

  @override
  ConsumerState<NtaInstructionsScreen> createState() => _NtaInstructionsScreenState();
}

class _NtaInstructionsScreenState extends ConsumerState<NtaInstructionsScreen> {
  bool _declared = false;
  NtaPrepPhase? _phase;
  String? _error;
  String? _pendingSessionId;

  PracticeSelection get _selection => PracticeSelection(mode: PracticeMode.nta, subjectId: widget.subject);

  Future<void> _start() async {
    if (_phase != null) return;
    if (ref.read(networkStatusProvider) == NetworkStatus.offline) {
      setState(() => _error = PracticeCopy.offlineStart);
      return;
    }
    setState(() {
      _error = null;
      _phase = NtaPrepPhase.checking;
    });
    final PracticeQuote quote;
    try {
      quote = await ref.read(practiceQuoteProvider(_selection.quoteQuery).future);
    } on ApiError catch (e) {
      _fail(e.isOffline ? PracticeCopy.offlineStart : PracticeCopy.quoteFailed);
      return;
    }
    if (!mounted) return;
    if (!quote.launchable) {
      _fail(_gateText(quote));
      return;
    }
    setState(() => _phase = NtaPrepPhase.starting);
    final result = await launchPractice(ref, _selection, quote);
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        setState(() => _phase = NtaPrepPhase.opening);
        context.go(AppRoutes.run(sessionId));
      case LaunchNeedsLook(:final quote):
        _fail(_gateText(quote));
      case LaunchFailed(:final failure, :final message):
        _fail(StartFailureView(failure, message: message).text);
      case LaunchPendingElsewhere(:final sessionId):
        _pendingSessionId = sessionId;
        _fail(PracticeCopy.earlierPending);
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() {
      _phase = null;
      _error = message;
    });
  }

  static String _gateText(PracticeQuote q) => q.isAccessRequired ? PracticeCopy.ntaGatedLine : (q.reason ?? PracticeCopy.unavailableFallback);

  void _back() => context.go(AppRoutes.practice);

  // The page is the exam paper itself (in the NTA look), wherever it is opened from.
  @override
  Widget build(BuildContext context) => NtaPaperTheme(child: Builder(builder: _page));

  Widget _page(BuildContext context) {
    final colors = context.mmColors;
    final subject = NtaCopy.subject(widget.subject);
    final quote = ref.watch(practiceQuoteProvider(_selection.quoteQuery)).value;
    final gate = quote != null && !quote.launchable ? _gateText(quote) : null;
    final working = _phase != null;
    final bottom = MediaQuery.viewPaddingOf(context).bottom;

    return PopScope(
      canPop: !working,
      child: Material(
        color: colors.ground,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            NtaBar(
              subject: subject,
              leading: working ? null : NtaBarKey(icon: LucideIcons.arrowLeft, semanticsLabel: PracticeCopy.backToPractice, onTap: _back),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, MmSpace.s24),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                    child: working
                        ? NtaPreparing(subject: subject, phase: _phase!)
                        : _Instructions(
                            subject: subject,
                            candidate: ref.watch(ntaCandidateNameProvider),
                            quote: quote,
                            declared: _declared,
                            onDeclared: (v) => setState(() => _declared = v),
                          ),
                  ),
                ),
              ),
            ),
            if (!working)
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.raised,
                  border: Border(top: BorderSide(color: colors.line)),
                ),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12 + bottom),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if ((_error ?? gate) != null) ...[
                        InlineBanner(message: (_error ?? gate)!, tone: BannerTone.warning),
                        const SizedBox(height: MmSpace.s12),
                      ],
                      if (_pendingSessionId != null)
                        KeyButton(label: PracticeCopy.openEarlier, onPressed: () => context.go(AppRoutes.run(_pendingSessionId!)))
                      else if (gate != null)
                        KeyButton.secondary(label: PracticeCopy.backToPractice, onPressed: _back)
                      else
                        KeyButton(label: NtaStartCopy.start, onPressed: _declared ? () => unawaited(_start()) : null),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Instructions extends StatelessWidget {
  const _Instructions({required this.subject, required this.candidate, required this.quote, required this.declared, required this.onDeclared});

  final String subject;
  final String? candidate;
  final PracticeQuote? quote;
  final bool declared;
  final ValueChanged<bool> onDeclared;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The quote's own figures when it has them, the server's mode rules otherwise.
    final count = quote?.count ?? NtaRules.questions;
    final minutes = quote?.durationSec != null ? (quote!.durationSec! / 60).round() : NtaRules.minutes;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NtaCandidateCard(name: candidate, subject: subject),
        const SizedBox(height: MmSpace.s24),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(NtaStartCopy.heading, style: NtaSkin.of(context).type.headline)),
                  const SizedBox(height: MmSpace.s6),
                  Text(NtaStartCopy.intro, style: type.small.copyWith(color: colors.ink2)),
                ],
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            // Mobi waves from the page, and stays out of the paper once the clock runs.
            const ExcludeSemantics(child: MobiCharacter(size: 88, entrance: MobiAct.hello, seed: 9)),
          ],
        ),
        const SizedBox(height: MmSpace.s16),
        Row(
          children: [
            Expanded(
              child: NtaFactTile(value: '$count', unit: NtaStartCopy.questionsUnit),
            ),
            const SizedBox(width: MmSpace.s8),
            Expanded(
              child: NtaFactTile(value: '$minutes', unit: NtaStartCopy.minutesUnit),
            ),
            const SizedBox(width: MmSpace.s8),
            const Expanded(child: NtaMarkingTile()),
          ],
        ),
        const SizedBox(height: MmSpace.s20),
        const NtaStyleSwitch(),
        NtaInstructionBlock(
          title: NtaStartCopy.clockTitle,
          children: [Text(NtaStartCopy.clockBody, style: type.body.copyWith(color: colors.ink2))],
        ),
        NtaInstructionBlock(
          title: NtaStartCopy.scoringTitle,
          children: [Text(NtaStartCopy.scoringBody, style: type.body.copyWith(color: colors.ink2))],
        ),
        NtaInstructionBlock(
          title: NtaStartCopy.paletteTitle,
          children: [
            for (final s in NtaChipState.values)
              NtaInstructionRow(leading: ntaLegendGlyph(s), title: s.label, body: NtaStartCopy.paletteMeanings[s.index]),
          ],
        ),
        NtaInstructionBlock(
          title: NtaStartCopy.keysTitle,
          children: [
            for (final (label, meaning) in NtaStartCopy.keys) NtaKeyRow(label: label, meaning: meaning),
          ],
        ),
        NtaInstructionBlock(
          title: NtaStartCopy.screenTitle,
          children: [
            for (final rule in NtaCopy.rules)
              NtaInstructionRow(
                leading: Icon(LucideIcons.shieldAlert, size: 18, color: colors.ink3),
                title: rule,
                leadingWidth: 22,
              ),
          ],
        ),
        const SizedBox(height: MmSpace.s24),
        Divider(height: 1, thickness: 1, color: colors.line),
        NtaDeclaration(value: declared, onChanged: onDeclared),
      ],
    );
  }
}
