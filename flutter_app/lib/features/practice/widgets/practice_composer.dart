import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../learn/data/catalog_repository.dart';
import '../copy.dart';
import '../data/launch_flow.dart';
import '../data/practice_catalog.dart';
import '../data/practice_quote.dart';
import '../model/cost_line.dart';
import '../model/practice_selection.dart';
import 'chapter_picker.dart';
import 'composer_parts.dart';
import 'failure_copy.dart';
import 'get_panel.dart';
import 'other_subjects_sheet.dart';
import 'subject_tiles.dart';

/// Where the composer sends the student. The host decides how (a sheet pops first).
class ComposerExits {
  const ComposerExits({
    required this.run,
    required this.concepts,
    required this.review,
    this.close,
  });

  /// Opens the runner for a started (or earlier, unsent) session.
  final ValueChanged<String> run;
  final VoidCallback concepts;
  final VoidCallback review;

  /// "Not now". Null on the setup page, which has its own back key.
  final VoidCallback? close;
}

/// The confirm step of every start (brief 12): the session as what you get, its cost from the
/// quote, and Start. Used as the confirm sheet from the Practice tab and as the
/// `/practice/setup/:mode` page. The controls never wait for the quote: a changed selection is
/// quoted again after 300 ms, the panel shows its skeleton only after 400 ms, and Start stays
/// disabled with a stated reason until the quote for exactly this selection has arrived. A
/// mock's before-mock lines live here too: one sheet, not a wizard.
class PracticeComposer extends ConsumerStatefulWidget {
  const PracticeComposer({super.key, required this.initial, required this.exits, this.showSubjects = false, this.pinKey = false});

  final PracticeSelection initial;
  final ComposerExits exits;

  /// The setup page shows the subject tiles; the sheet keeps the subject it was opened with.
  final bool showSubjects;

  /// The setup page scrolls the content and pins Start at the bottom, on the ground.
  final bool pinKey;

  @override
  ConsumerState<PracticeComposer> createState() => _PracticeComposerState();
}

class _PracticeComposerState extends ConsumerState<PracticeComposer> {
  late PracticeSelection _selection = widget.initial;
  late QuoteQuery _query = widget.initial.quoteQuery;
  Timer? _debounce;
  bool _starting = false;
  StartFailureView? _failure;
  String? _pendingSessionId;
  String? _costNote;

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

  void _pickSubject(String id) {
    if (id == _selection.subjectId) return;
    ref.read(practiceSubjectProvider.notifier).select(id);
    _change(_selection.copyWith(subjectId: id, clearChapters: true));
  }

  Future<void> _pickOtherSubject(List<SubjectChoice> others) async {
    final id = await showOtherSubjects(context, others);
    if (id != null && mounted) _pickSubject(id);
  }

  Future<void> _pickChapter() async {
    final names = await showChapterPicker(context, subjectId: _selection.subjectId, selected: _selection.chapters);
    if (names != null && names.isNotEmpty && mounted) {
      ref.read(hapticsProvider).selection();
      _change(_selection.copyWith(chapters: names));
    }
  }

  /// The open alternative to a Pro-only mode: a Full mock for NTA, Quick practice for Smart.
  void _takeOpen() => _change(
    PracticeSelection(mode: _selection.mode == PracticeMode.smart ? PracticeMode.quick : PracticeMode.full, subjectId: _selection.subjectId),
  );

  Future<void> _start(PracticeQuote quote) async {
    if (_starting) return;
    setState(() {
      _starting = true;
      _failure = null;
      _pendingSessionId = null;
      _costNote = null;
    });
    final result = await launchPractice(ref, _selection, quote);
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        if (_selection.mode.isMock) ref.read(hapticsProvider).medium();
        widget.exits.run(sessionId);
      case LaunchNeedsLook(:final quote, :final costChanged):
        setState(() {
          _starting = false;
          _costNote = costChanged ? PracticeCopy.costChanged(costLineText(quote)) : null;
        });
        ref.invalidate(practiceQuoteProvider(_query));
      case LaunchFailed(:final failure, :final message):
        setState(() {
          _starting = false;
          _failure = StartFailureView(failure, message: message);
        });
      case LaunchPendingElsewhere(:final sessionId):
        setState(() {
          _starting = false;
          _pendingSessionId = sessionId;
        });
    }
  }

  String get _startLabel => switch (_selection.mode) {
        PracticeMode.quick || PracticeMode.smart => PracticeCopy.startPractice,
        PracticeMode.chapter => PracticeCopy.startChapter,
        _ => PracticeCopy.startMock,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final mode = _selection.mode;
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final subject = subjectNameFor(_selection.subjectId, catalog);
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    final concepts = ref.watch(learnCatalogProvider.select((s) => s.value));
    final conceptsOpen = concepts != null && !concepts.isDisabled && concepts.units.isNotEmpty;

    final pending = _selection.quoteQuery != _query;
    final quote = ref.watch(practiceQuoteProvider(_query));
    final loaded = pending ? null : quote.value;

    int? mocksDone;
    if (mode.isMock) mocksDone = ref.watch(completedMockCountProvider(internalSubjectFor(_selection.subjectId, catalog))).value;
    final mockMinutes = loaded?.durationSec == null ? null : (loaded!.durationSec! / 60).round();

    final gated = loaded != null && costLineFor(loaded).kind == CostKind.proGated;
    String? disabledReason;
    var canStart = false;
    if (!_selection.isComplete) {
      disabledReason = PracticeCopy.chooseChapterFirst;
    } else if (offline) {
      canStart = false;
    } else if (pending || (!quote.hasValue && !quote.hasError)) {
      disabledReason = PracticeCopy.checkingCost;
    } else if (loaded != null) {
      canStart = loaded.launchable && (!mode.isMock || mockMinutes != null);
    }

    // The mode as an eyebrow, the subject as the title: two short lines, never a wrapped one.
    final eyebrow = switch (mode) {
      PracticeMode.full => mockLabelFor(mocksDone) ?? 'Full mock',
      PracticeMode.nta => PracticeCopy.ntaTitle,
      PracticeMode.quick => PracticeCopy.quickTitle,
      PracticeMode.chapter => PracticeCopy.chapterTitle,
      PracticeMode.smart => PracticeCopy.smartTitle,
    };
    final isPro = ref.watch(authSnapshotProvider.select((a) => a.isPro));

    final children = <Widget>[
      Semantics(
        header: true,
        label: PracticeCopy.confirmTitle(eyebrow, subject),
        excludeSemantics: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(eyebrow, style: type.caption.copyWith(fontSize: 13, fontWeight: FontWeight.w500, color: colors.ink2)),
            const SizedBox(height: 2),
            Text(subject, style: type.screenTitle.copyWith(fontSize: 24)),
          ],
        ),
      ),
      const SizedBox(height: MmSpace.s20),
      if (widget.showSubjects) ...[
        _SubjectPicker(selected: _selection.subjectId, onPick: _pickSubject, onOther: _pickOtherSubject),
        const SizedBox(height: MmSpace.s24),
      ],
      if (mode == PracticeMode.chapter) ...[
        ChapterField(chapters: _selection.chapters, onTap: _pickChapter),
        const SizedBox(height: MmSpace.s20),
      ],
      if (mode.usesCount) ...[
        LengthPicker(count: _selection.count, counts: mode.counts, onChanged: (c) => _change(_selection.copyWith(count: c))),
        const SizedBox(height: MmSpace.s20),
      ],
      if (mode.allowsDifficulty && !gated) ...[
        DifficultyPicker(value: _selection.difficulty, isPro: isPro, onChanged: (d) => _change(_selection.copyWith(difficulty: d))),
        const SizedBox(height: MmSpace.s20),
      ],
      GetPanel(
        selection: _selection,
        subjectName: subject,
        quote: pending ? null : quote,
        pending: pending,
        offline: offline,
        conceptsOpen: conceptsOpen,
        onRetry: () => ref.invalidate(practiceQuoteProvider(_query)),
        onUseDailyCount: () => _change(_selection.copyWith(count: 10)),
        onOpenConcepts: widget.exits.concepts,
        onOpenReview: widget.exits.review,
      ),
      if (mode.isMock && !gated) ...[
        const SizedBox(height: MmSpace.s16),
        MockLines(noLength: loaded != null && loaded.launchable && mockMinutes == null),
      ],
      if (!mode.isMock) ...[
        const SizedBox(height: MmSpace.s12),
        Text(PracticeCopy.feedbackAfter, style: type.small.copyWith(color: colors.ink2)),
      ],
    ];
    // What happened when Start was tapped sits right above Start, where the eye already is.
    final notes = <Widget>[
      if (_costNote != null) ...[
        Semantics(liveRegion: true, child: Text(_costNote!, style: type.body)),
        const SizedBox(height: MmSpace.s12),
      ],
      if (_failure != null) ...[
        InlineBanner(message: _failure!.text, tone: BannerTone.error),
        const SizedBox(height: MmSpace.s12),
      ],
      if (_pendingSessionId != null) ...[
        InlineBanner(
          message: PracticeCopy.earlierPending,
          tone: BannerTone.warning,
          actionLabel: PracticeCopy.openEarlier,
          onAction: () => widget.exits.run(_pendingSessionId!),
        ),
        const SizedBox(height: MmSpace.s12),
      ],
    ];
    final keys = <Widget>[
      ...notes,
      KeyButton(
        // A Pro-gated mode has nothing to start: the one action is the open alternative.
        label: gated ? (mode == PracticeMode.smart ? PracticeCopy.takeQuickInstead : PracticeCopy.takeFullInstead) : _startLabel,
        loading: _starting,
        disabledReason: disabledReason,
        onPressed: gated ? _takeOpen : (canStart && !_starting && loaded != null ? () => _start(loaded) : null),
      ),
      if (widget.exits.close != null) ...[
        const SizedBox(height: MmSpace.s4),
        Align(child: KeyButton.quiet(label: PracticeCopy.notNow, onPressed: _starting ? null : widget.exits.close)),
      ],
    ];

    if (widget.pinKey) return PopScope(canPop: !_starting, child: _Pinned(content: children, keys: keys));
    return PopScope(
      canPop: !_starting,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [...children, const SizedBox(height: MmSpace.s24), ...keys],
      ),
    );
  }
}

class _SubjectPicker extends ConsumerWidget {
  const _SubjectPicker({required this.selected, required this.onPick, required this.onOther});

  final String selected;
  final ValueChanged<String> onPick;
  final ValueChanged<List<SubjectChoice>> onOther;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authSnapshotProvider);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final choices = subjectChoices(chosen: auth.subjects, selected: selected, catalog: catalog);
    final others = otherSubjects(shown: choices, catalog: catalog);
    return SubjectTiles(
      gutter: 0,
      choices: choices,
      selectedId: selected,
      onSelected: onPick,
      onMore: others.isEmpty ? null : () => onOther(others),
    );
  }
}

/// The setup page's layout: the content scrolls and fades into the ground; Start is pinned at
/// the bottom (16 dp gutter, 16 dp above the gesture inset).
class _Pinned extends StatelessWidget {
  const _Pinned({required this.content, required this.keys});

  final List<Widget> content;
  final List<Widget> keys;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                  children: content,
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 32,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [colors.ground.withValues(alpha: 0), colors.ground],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        ColoredBox(
          color: colors.ground,
          child: Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + MediaQuery.paddingOf(context).bottom),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: keys),
          ),
        ),
      ],
    );
  }
}
