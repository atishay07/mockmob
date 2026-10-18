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
import '../../practice/data/open_paper.dart';
import '../../practice/data/practice_catalog.dart' show internalSubjectFor;
import '../../practice/data/practice_quote.dart';
import '../../practice/data/practice_starter.dart' show StartFailure;
import '../../practice/model/practice_selection.dart';
import '../../practice/widgets/failure_copy.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, UpgradeEntry;
import '../../rules/widgets/start_sheet_line.dart';
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

  /// The quote whose new, higher cost this page last put in front of the student. The next
  /// Start is the student's yes to that cost, and to that cost only.
  PracticeQuote? _costShown;

  /// A paper that is open, which keeps another from starting: Start becomes the key that continues it.
  OpenPaper? _open;

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
    // Dearer again than the cost the student said yes to: show it and wait for another Start.
    if (_costShown case final seen? when costWentUp(seen, quote)) {
      _costChanged(quote);
      return;
    }
    setState(() => _phase = NtaPrepPhase.starting);
    final result = await launchPractice(ref, _selection, quote);
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        setState(() => _phase = NtaPrepPhase.opening);
        context.go(AppRoutes.run(sessionId));
      case LaunchNeedsLook(:final quote, costChanged: true):
        _costChanged(quote);
      case LaunchNeedsLook(:final quote):
        _fail(_gateText(quote));
      case LaunchFailed(:final failure, :final message):
        _fail(StartFailureView(failure, message: message).text);
      case LaunchOpenPaper(:final paper):
        // Nothing was charged: the paper that is open is said, and Start continues it.
        if (!mounted) return;
        setState(() {
          _phase = null;
          _open = paper;
          _error = PracticeCopy.openFirst(apiMode: paper.apiMode);
        });
    }
  }

  /// Start, after "your mock is still open": opens that paper (never another, never a charge).
  Future<void> _continueOpen() async {
    final paper = _open;
    if (paper == null || _phase != null) return;
    setState(() {
      _error = null;
      _phase = NtaPrepPhase.starting;
    });
    final result = await ref.read(paperContinuerProvider).open(paper);
    if (!mounted) return;
    switch (result) {
      case Continued(:final sessionId):
        setState(() => _phase = NtaPrepPhase.opening);
        context.go(AppRoutes.run(sessionId));
      case ContinueFailed(:final failure, :final message):
        setState(() {
          _phase = null;
          _error = StartFailureView(failure, message: message).text;
          if (failure == StartFailure.ended) _open = null;
        });
    }
  }

  /// The paper is open but costs more than when the page was opened. Nothing was started or
  /// charged; the new cost is on screen and the next Start takes it.
  void _costChanged(PracticeQuote quote) {
    _costShown = quote;
    _fail(PracticeCopy.costChanged(costLineText(quote)).replaceAll('  ', ' '));
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
              child: working
                  ? NtaPreparingStage(subject: subject, phase: _phase!)
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, MmSpace.s24),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                          child: _Instructions(
                            subject: subject,
                            subjectId: internalSubjectFor(widget.subject, null),
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
                      if (gate != null) ...[
                        // The mode comes with Pro: the Upgrade sheet, when PLAY_BILLING is on (it draws nothing otherwise).
                        if (quote != null && quote.isAccessRequired) const UpgradeEntry(reason: ProReason.ntaMode, bottomGap: MmSpace.s8),
                        KeyButton.secondary(label: PracticeCopy.backToPractice, onPressed: _back),
                      ] else ...[
                        // The line keeps its space once the box is ticked, so the page does not move.
                        // It is the reason the key is off, so it is read while the key is.
                        ExcludeSemantics(
                          excluding: _declared,
                          child: AnimatedOpacity(
                            duration: const Duration(milliseconds: 120),
                            opacity: _declared ? 0 : 1,
                            child: Text(NtaStartCopy.startHint, textAlign: TextAlign.center, style: context.mmType.caption.copyWith(color: colors.ink2)),
                          ),
                        ),
                        const SizedBox(height: MmSpace.s8),
                        KeyButton(
                          label: _open == null ? NtaStartCopy.start : PracticeCopy.openKey(apiMode: _open!.apiMode),
                          onPressed: _declared ? () => unawaited(_open == null ? _start() : _continueOpen()) : null,
                        ),
                      ],
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
  const _Instructions({
    required this.subject,
    required this.subjectId,
    required this.candidate,
    required this.quote,
    required this.declared,
    required this.onDeclared,
  });

  final String subject;

  /// The attempt-side subject id, for the student's rule for this mock.
  final String subjectId;
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
        // MockMob's own line, before the exam's instructions and before the clock exists: the
        // student's rule for this mock (Mistake Lab v4 slice 3, spec 4.12). Nothing of it reaches
        // the paper; without a rule in force nothing shows and the page is as before.
        StartSheetLine(subject: subjectId, padding: const EdgeInsets.only(top: MmSpace.s16)),
        const SizedBox(height: MmSpace.s16),
        // Three facts of one shape. Side by side they are equal tiles; from 1.3x text a figure
        // would shrink to fit a third of the width, so they stack, each as wide as the page.
        if (MediaQuery.textScalerOf(context).scale(1) >= 1.3) ...[
          NtaFactTile(value: '$count', unit: NtaStartCopy.questionsUnit),
          const SizedBox(height: MmSpace.s8),
          NtaFactTile(value: '$minutes', unit: NtaStartCopy.minutesUnit),
          const SizedBox(height: MmSpace.s8),
          const NtaMarkingTile(),
        ] else
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
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
