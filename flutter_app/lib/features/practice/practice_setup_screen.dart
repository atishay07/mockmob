import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_state.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/haptics/haptics.dart';
import '../../core/models/practice_quote.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'data/launch_flow.dart';
import 'data/practice_catalog.dart';
import 'data/practice_quote.dart';
import 'model/cost_line.dart';
import 'model/practice_selection.dart';
import 'widgets/chapter_picker.dart';
import 'widgets/count_stepper.dart';
import 'widgets/failure_copy.dart';
import 'widgets/mock_start_sheet.dart';
import 'widgets/other_subjects_sheet.dart';
import 'widgets/practice_app_bar.dart';
import 'widgets/quote_panel.dart';
import 'widgets/sheet_glyph.dart';
import 'widgets/subject_chips.dart';

String modeTitle(PracticeMode mode) => switch (mode) {
  PracticeMode.full => PracticeCopy.fullMockTitle,
  PracticeMode.quick => PracticeCopy.quickTitle,
  PracticeMode.chapter => PracticeCopy.chapterTitle,
  PracticeMode.nta => PracticeCopy.ntaTitle,
};

/// `/practice/setup/:mode` (spec 5.4): subject, count or chapter, the quote's cost, and Start.
/// The controls never wait for the quote. A changed selection is quoted again after 300 ms, the
/// cost region shows the static skeleton only after 400 ms, and Start stays disabled with a
/// stated reason until the quote for exactly this selection has arrived.
class PracticeSetupScreen extends ConsumerStatefulWidget {
  const PracticeSetupScreen({super.key, required this.mode, this.subject, this.count, this.chapter, this.purpose});

  final PracticeMode mode;
  final String? subject;
  final int? count;
  final String? chapter;

  /// `baseline` or `full_sample`, from a link that asks for a first-use allowance.
  final String? purpose;

  @override
  ConsumerState<PracticeSetupScreen> createState() => _PracticeSetupScreenState();
}

class _PracticeSetupScreenState extends ConsumerState<PracticeSetupScreen> {
  late PracticeSelection _selection;
  late QuoteQuery _query;
  Timer? _debounce;
  bool _starting = false;
  bool _sheetOpen = false;
  StartFailureView? _failure;
  String? _pendingSessionId;
  String? _costNote;

  @override
  void initState() {
    super.initState();
    final String subject = widget.subject ?? ref.read(practiceSubjectProvider);
    _selection = PracticeSelection(
      mode: widget.mode,
      subjectId: subject,
      count: nearestPracticeCount(widget.count),
      chapter: widget.mode == PracticeMode.chapter ? widget.chapter : null,
      purpose: widget.purpose == 'baseline' || widget.purpose == 'full_sample' ? widget.purpose : null,
    );
    _query = _selection.quoteQuery;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _change(PracticeSelection next) {
    _debounce?.cancel();
    setState(() {
      _selection = next;
      _failure = null;
      _pendingSessionId = null;
      _costNote = null;
    });
    final query = next.quoteQuery;
    if (query == _query) return;
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = _selection.quoteQuery);
    });
  }

  Future<void> _pickSubject(String id) async {
    if (id == _selection.subjectId) return;
    ref.read(practiceSubjectProvider.notifier).select(id);
    _change(_selection.copyWith(subjectId: id, clearChapter: true));
  }

  Future<void> _pickOtherSubject(List<SubjectChoice> others) async {
    final id = await showOtherSubjects(context, others);
    if (id != null && mounted) await _pickSubject(id);
  }

  Future<void> _pickChapter() async {
    final name = await showChapterPicker(context, subjectId: _selection.subjectId, selected: _selection.chapter);
    if (name != null && mounted) {
      ref.read(hapticsProvider).tick();
      _change(_selection.copyWith(chapter: name));
    }
  }

  Future<void> _start(PracticeQuote quote) async {
    if (_starting || _sheetOpen) return;
    if (widget.mode.isMock) {
      _sheetOpen = true;
      final result = await showMockStartSheet(context, selection: _selection, quote: quote);
      _sheetOpen = false;
      if (result != null && mounted) _handle(result);
      return;
    }
    setState(() {
      _starting = true;
      _failure = null;
      _pendingSessionId = null;
      _costNote = null;
    });
    final result = await launchPractice(ref, _selection, quote);
    if (mounted) _handle(result);
  }

  void _handle(LaunchResult result) {
    switch (result) {
      case LaunchStarted(:final sessionId):
        context.go(AppRoutes.run(sessionId));
      case LaunchNeedsLook(:final quote, :final costChanged):
        setState(() {
          _starting = false;
          _costNote = costChanged ? PracticeCopy.costChanged(costLineText(quote)) : null;
        });
      case LaunchFailed(:final failure):
        setState(() {
          _starting = false;
          _failure = StartFailureView(failure);
        });
      case LaunchPendingElsewhere(:final sessionId):
        setState(() {
          _starting = false;
          _pendingSessionId = sessionId;
        });
    }
  }

  void _takeFull() => context.pushReplacement(
    Uri(path: AppRoutes.practiceSetup(PracticeMode.full.name), queryParameters: {'subject': _selection.subjectId}).toString(),
  );

  String get _startLabel => switch (widget.mode) {
    PracticeMode.quick => PracticeCopy.startPractice,
    PracticeMode.chapter => PracticeCopy.startChapter,
    _ => PracticeCopy.startMock,
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final mode = widget.mode;
    final auth = ref.watch(authSnapshotProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final choices = subjectChoices(chosen: auth.subjects, selected: _selection.subjectId, catalog: catalog);
    final others = otherSubjects(shown: choices, catalog: catalog);
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;

    final pending = _selection.quoteQuery != _query;
    final quote = ref.watch(practiceQuoteProvider(_query));
    final loaded = pending ? null : quote.value;
    final duration = loaded?.durationSec == null ? null : Duration(seconds: loaded!.durationSec!);

    // Warm the mock number so the pre-start sheet has it the moment it opens.
    if (mode.isMock) ref.watch(completedMockCountProvider(internalSubjectFor(_selection.subjectId, catalog)));

    final gated = loaded != null && costLineFor(loaded).kind == CostKind.proGated;
    String? disabledReason;
    var canStart = false;
    if (!_selection.isComplete) {
      disabledReason = PracticeCopy.chooseChapterFirst;
    } else if (offline) {
      canStart = false;
    } else if (pending || (quote.isLoading && !quote.hasValue)) {
      disabledReason = PracticeCopy.checkingCost;
    } else if (loaded != null) {
      canStart = loaded.launchable;
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: Column(
              children: [
                PracticeAppBar(title: modeTitle(mode)),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, MmSpace.s24),
                    children: [
                      Semantics(
                        header: true,
                        child: Text(PracticeCopy.subjectLabel, style: type.label.copyWith(color: colors.ink2)),
                      ),
                      const SizedBox(height: MmSpace.s8),
                      SubjectChips(
                        choices: choices,
                        selectedId: _selection.subjectId,
                        onSelected: _pickSubject,
                        onOther: others.isEmpty ? null : () => _pickOtherSubject(others),
                      ),
                      const SizedBox(height: MmSpace.group),
                      if (mode == PracticeMode.chapter) ...[
                        ChapterField(chapter: _selection.chapter, onTap: _pickChapter),
                        const SizedBox(height: MmSpace.group),
                      ],
                      if (mode.usesCount)
                        CountStepper(
                          count: _selection.count,
                          time: duration,
                          onChanged: (c) => _change(_selection.copyWith(count: c)),
                        )
                      else
                        _MockSummary(count: mockQuestionCount, time: duration),
                      const SizedBox(height: MmSpace.group),
                      QuotePanel(
                        mode: mode,
                        selection: _selection,
                        quote: pending ? null : quote,
                        pending: pending,
                        offline: offline,
                        onRetry: () => ref.invalidate(practiceQuoteProvider(_query)),
                        onUseDailyCount: () => _change(_selection.copyWith(count: 10)),
                        onOpenLearn: () => context.go(AppRoutes.learn),
                        onOpenReview: () => context.go(AppRoutes.review),
                      ),
                      if (_costNote != null) ...[
                        const SizedBox(height: MmSpace.s12),
                        Semantics(liveRegion: true, child: Text(_costNote!, style: type.body)),
                      ],
                      if (!mode.isMock) ...[
                        const SizedBox(height: MmSpace.s16),
                        Text(PracticeCopy.feedbackAfter, style: type.small.copyWith(color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
                _StartBar(
                  // A Pro-gated mode has nothing to start: the one action is the free alternative.
                  label: gated ? PracticeCopy.takeFullInstead : _startLabel,
                  loading: _starting,
                  enabled: gated || (canStart && !_starting),
                  disabledReason: disabledReason,
                  failure: _failure,
                  onOpenEarlier: _pendingSessionId == null ? null : () => context.go(AppRoutes.run(_pendingSessionId!)),
                  onStart: gated ? _takeFull : (loaded == null ? null : () => _start(loaded)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MockSummary extends StatelessWidget {
  const _MockSummary({required this.count, required this.time});

  final int count;
  final Duration? time;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          PracticeCopy.fullMockLine(questions: count, minutes: time == null ? null : (time!.inSeconds / 60).round()),
          style: type.subhead.copyWith(color: colors.ink),
        ),
        const SizedBox(height: MmSpace.s12),
        SheetGlyph(count: count, cellSize: 14, gap: 3),
      ],
    );
  }
}

/// The pinned foot: the one dominant action, with the failure or the reason it is disabled
/// directly above it, so nothing important scrolls out of sight.
class _StartBar extends StatelessWidget {
  const _StartBar({
    required this.label,
    required this.loading,
    required this.enabled,
    required this.disabledReason,
    required this.failure,
    required this.onOpenEarlier,
    required this.onStart,
  });

  final String label;
  final bool loading;
  final bool enabled;
  final String? disabledReason;
  final StartFailureView? failure;
  final VoidCallback? onOpenEarlier;
  final VoidCallback? onStart;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.55),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.ground,
          border: Border(top: BorderSide(color: colors.line)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (failure != null || onOpenEarlier != null)
                // Notes scroll inside the foot at large text sizes, so the key is never pushed off.
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (failure != null) ...[
                          Semantics(
                            liveRegion: true,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: ExcludeSemantics(child: Icon(LucideIcons.circleAlert, size: 20, color: colors.badText)),
                                ),
                                const SizedBox(width: MmSpace.s12),
                                Expanded(
                                  child: Text(failure!.text, style: type.body.copyWith(color: colors.ink)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: MmSpace.s12),
                        ],
                        if (onOpenEarlier != null) ...[
                          Text(PracticeCopy.earlierPending, style: type.body),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: KeyButton.quiet(label: PracticeCopy.openEarlier, onPressed: onOpenEarlier),
                          ),
                          const SizedBox(height: MmSpace.s8),
                        ],
                      ],
                    ),
                  ),
                ),
              KeyButton(
                label: label,
                loading: loading,
                disabledReason: disabledReason,
                onPressed: enabled && onStart != null ? onStart : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
