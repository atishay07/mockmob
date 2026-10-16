import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/art/hybrid/hybrid_sims.dart' show StopwatchSim;
import '../../../core/auth/auth_state.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
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
import 'composer_ticket.dart';
import 'exam_sheet_start.dart' show ExamSheetStart;
import 'failure_copy.dart';
import 'get_panel.dart';
import 'other_subjects_sheet.dart';
import 'plain_notice.dart';
import 'top_edge_fade.dart' show BarFade;

/// Where the composer sends the student. The host decides how (a sheet pops first).
class ComposerExits {
  const ComposerExits({required this.run, required this.concepts, required this.review, this.close});

  /// Opens the runner for a started (or earlier, unsent) session.
  final ValueChanged<String> run;
  final VoidCallback concepts;
  final VoidCallback review;

  /// "Not now". Null on the setup page, which has its own back key.
  final VoidCallback? close;
}

/// The mode as the confirm step names it ("Quick practice", "Smart practice").
String composerModeTitle(PracticeMode mode, {int? mocksDone}) => switch (mode) {
  PracticeMode.full => mockLabelFor(mocksDone) ?? PracticeCopy.fullMockTitle,
  PracticeMode.nta => PracticeCopy.ntaTitle,
  PracticeMode.quick => PracticeCopy.quickTitle,
  PracticeMode.chapter => PracticeCopy.chapterTitle,
  PracticeMode.smart => PracticeCopy.smartTitle,
};

/// The state of one confirm step, shared by its body and its keys. The confirm sheet pins the
/// keys in the sheet's footer, apart from the scrolling body, so both read and write this.
class ComposerController extends ChangeNotifier {
  ComposerController(PracticeSelection initial, {this.askedCount}) : _selection = initial, _query = initial.quoteQuery, _initial = initial;

  /// The length a link asked for, when it named one.
  final int? askedCount;
  final PracticeSelection _initial;
  PracticeSelection _selection;
  QuoteQuery _query;
  Timer? _debounce;
  bool _closed = false;

  bool starting = false;

  /// The ticket's stub in the Start sequence: lifted while the start request is out, torn off
  /// only once the server confirmed it, dropped back when it failed.
  TicketTear tear = TicketTear.rest;
  StartFailureView? failure;
  String? costNote;

  PracticeSelection get selection => _selection;

  /// The query the quote on screen answers. Lags a changed selection by 300 ms.
  QuoteQuery get query => _query;

  /// The selection changed and its quote has not been asked yet.
  bool get pending => _selection.quoteQuery != _query;

  /// "Smart practice starts at 10. You asked for 5.": the length a link asked for is not one
  /// this mode offers. Said until the student changes the length or the mode themselves.
  String? get lengthNote {
    final asked = askedCount;
    final mode = _selection.mode;
    if (asked == null || !mode.usesCount || mode.counts.contains(asked)) return null;
    if (mode != _initial.mode || _selection.count != _initial.count) return null;
    return PracticeCopy.lengthAdjusted(composerModeTitle(mode), mode.counts, asked);
  }

  /// A new selection: clears what the last Start said and asks the quote again after 300 ms.
  void change(PracticeSelection next) {
    if (_closed) return;
    _debounce?.cancel();
    _selection = next;
    failure = null;
    costNote = null;
    notifyListeners();
    if (next.quoteQuery == _query) return;
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (_closed) return;
      _query = _selection.quoteQuery;
      notifyListeners();
    });
  }

  /// Applies [fn] and tells the body and the keys.
  void update(VoidCallback fn) {
    if (_closed) return;
    fn();
    notifyListeners();
  }

  /// The host is gone: stop the pending re-quote. Listeners may still detach afterwards, so the
  /// notifier itself is left to the garbage collector.
  void close() {
    _closed = true;
    _debounce?.cancel();
  }
}

/// What the keys show for the current quote, worked out once for the body and the keys.
class _StartState {
  const _StartState({
    required this.quote,
    required this.loaded,
    required this.gated,
    required this.mockMinutes,
    required this.canStart,
    required this.disabledReason,
    required this.offline,
    required this.creditsLow,
  });

  final AsyncValue<PracticeQuote> quote;

  /// The quote for exactly this selection, once it has arrived.
  final PracticeQuote? loaded;
  final bool gated;
  final int? mockMinutes;
  final bool canStart;
  final String? disabledReason;
  final bool offline;

  /// The quote for this selection says the balance is short.
  final bool creditsLow;
}

_StartState _startState(WidgetRef ref, ComposerController c) {
  final selection = c.selection;
  final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
  final quote = ref.watch(practiceQuoteProvider(c.query));
  final pending = c.pending;
  final loaded = pending ? null : quote.value;
  final mockMinutes = loaded?.durationSec == null ? null : (loaded!.durationSec! / 60).round();
  final gated = loaded != null && costLineFor(loaded).kind == CostKind.proGated;
  String? disabledReason;
  var canStart = false;
  if (!selection.isComplete) {
    disabledReason = PracticeCopy.chooseChapterFirst;
  } else if (offline) {
    canStart = false;
  } else if (pending || (!quote.hasValue && !quote.hasError)) {
    disabledReason = PracticeCopy.checkingCost;
  } else if (loaded != null) {
    canStart = loaded.launchable && (!selection.mode.isMock || mockMinutes != null);
    // A dead Start always says why, right above it: the body's longer message is below the fold.
    final low = creditsLowFor(loaded);
    if (low != null) disabledReason = PracticeCopy.creditsNeeded(low.cost, low.balance);
  }
  return _StartState(
    quote: quote,
    loaded: loaded,
    gated: gated,
    mockMinutes: mockMinutes,
    canStart: canStart,
    disabledReason: disabledReason,
    offline: offline,
    creditsLow: loaded != null && creditsLowFor(loaded) != null,
  );
}

/// The confirm step of every start (brief 12): the session as what you get, its cost from the
/// quote, and Start. Used as the confirm sheet from the Practice tab and as the
/// `/practice/setup/:mode` page. The controls never wait for the quote: a changed selection is
/// quoted again after 300 ms, the panel shows its skeleton only after 400 ms, and Start stays
/// disabled with a stated reason until the quote for exactly this selection has arrived. A
/// mock's before-mock lines live here too: one sheet, not a wizard.
///
/// Start and Not now are never part of the scrolling body: the setup page pins them at the
/// bottom, and the confirm sheet hands them to the sheet's footer ([PracticeComposerKeys] with
/// the same [controller]), so Not now is never cut off on a short phone or with large text.
class PracticeComposer extends ConsumerStatefulWidget {
  const PracticeComposer({
    super.key,
    required this.initial,
    required this.exits,
    this.showSubjects = false,
    this.pinKey = false,
    this.controller,
    this.askedCount,
  });

  final PracticeSelection initial;
  final ComposerExits exits;

  /// The setup page shows the subject tiles; the sheet keeps the subject it was opened with.
  final bool showSubjects;

  /// The setup page scrolls the content and pins Start at the bottom, on the ground.
  final bool pinKey;

  /// Given by the confirm sheet, whose footer draws the keys from the same state. Without one
  /// (and without [pinKey]) the keys follow the content.
  final ComposerController? controller;

  /// The length a link asked for, so a change is said before Start. Used when the composer makes
  /// its own controller.
  final int? askedCount;

  @override
  ConsumerState<PracticeComposer> createState() => _PracticeComposerState();
}

class _PracticeComposerState extends ConsumerState<PracticeComposer> {
  late final ComposerController _c = widget.controller ?? ComposerController(widget.initial, askedCount: widget.askedCount);

  @override
  void initState() {
    super.initState();
    _c.addListener(_changed);
  }

  /// The host's starting subject settled late (the setup page follows the student's default until
  /// their papers load). It is applied through the controller, so the length, level and chapters
  /// already set are kept (ROBUSTNESS practice-09); a subject the student picked here wins.
  @override
  void didUpdateWidget(PracticeComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.initial.subjectId;
    if (next == oldWidget.initial.subjectId || _selection.subjectId == next) return;
    if (_selection.subjectId != oldWidget.initial.subjectId) return;
    _c.change(_selection.copyWith(subjectId: next, clearChapters: true));
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _c.removeListener(_changed);
    if (widget.controller == null) {
      _c.close();
      _c.dispose();
    }
    super.dispose();
  }

  PracticeSelection get _selection => _c.selection;

  void _pickSubject(String id) {
    if (id == _selection.subjectId) return;
    ref.read(practiceSubjectProvider.notifier).select(id);
    _c.change(_selection.copyWith(subjectId: id, clearChapters: true));
  }

  Future<void> _pickOtherSubject(List<SubjectChoice> others) async {
    final id = await showOtherSubjects(context, others);
    if (id != null && mounted) _pickSubject(id);
  }

  Future<void> _pickChapter() async {
    final names = await showChapterPicker(context, subjectId: _selection.subjectId, selected: _selection.chapters);
    if (names != null && names.isNotEmpty && mounted) {
      ref.read(hapticsProvider).selection();
      _c.change(_selection.copyWith(chapters: names));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final mode = _selection.mode;
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final subject = subjectNameFor(_selection.subjectId, catalog);
    final concepts = ref.watch(learnCatalogProvider.select((s) => s.value));
    final conceptsOpen = concepts != null && !concepts.isDisabled && concepts.units.isNotEmpty;
    final start = _startState(ref, _c);
    final loaded = start.loaded;
    final pending = _c.pending;

    int? mocksDone;
    if (mode.isMock) mocksDone = ref.watch(completedMockCountProvider(internalSubjectFor(_selection.subjectId, catalog))).value;

    // The mode as an eyebrow, the subject as the title: two short lines, never a wrapped one.
    final eyebrow = composerModeTitle(mode, mocksDone: mocksDone);
    final isPro = ref.watch(authSnapshotProvider.select((a) => a.isPro));
    final lengthNote = _c.lengthNote;

    final difficulty = DifficultyPicker(
      value: _selection.difficulty,
      isPro: isPro,
      onChanged: (d) => _c.change(_selection.copyWith(difficulty: d)),
    );
    final children = <Widget>[
      ComposerTicket(
        subjectId: _selection.subjectId,
        eyebrow: eyebrow,
        subject: subject,
        count: mode.usesCount ? _selection.count : mockQuestionCount,
        semanticsLabel: PracticeCopy.confirmTitle(eyebrow, subject),
        // On the setup page the paper flies on into the start screen (and back from it).
        heroTag: widget.pinKey ? ComposerTicket.pageHeroTag : null,
        tear: _c.tear,
        // A Full mock's own start: the stopwatch under the stub runs a full turn as it tears.
        clock: mode == PracticeMode.full,
        // NTA mode's own: the exam sheet slides up where the stub was and the NTA mark settles.
        examSheet: mode == PracticeMode.nta,
      ),
      const SizedBox(height: MmSpace.s16),
      if (widget.showSubjects) ...[
        _SubjectPicker(selected: _selection.subjectId, onPick: _pickSubject, onOther: _pickOtherSubject),
        const SizedBox(height: MmSpace.s24),
      ],
      if (mode == PracticeMode.chapter) ...[
        ChapterField(
          chapters: _selection.chapters,
          onTap: _pickChapter,
          onRemove: (name) {
            ref.read(hapticsProvider).selection();
            _c.change(_selection.copyWith(chapters: [
              for (final c in _selection.chapters)
                if (c != name) c,
            ]));
          },
        ),
        const SizedBox(height: MmSpace.s16),
      ],
      if (mode.usesCount) ...[
        LengthPicker(
          count: _selection.count,
          counts: mode.counts,
          onChanged: (c) => _c.change(_selection.copyWith(count: c)),
        ),
        // The note about a length a link asked for grows open under the picker, and closes when
        // the student changes the length.
        KeyReveal(
          show: lengthNote != null,
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: Semantics(
              liveRegion: true,
              child: Text(lengthNote ?? '', style: type.small.copyWith(color: colors.ink)),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s16),
      ],
      GetPanel(
        selection: _selection,
        subjectName: subject,
        quote: pending ? null : start.quote,
        pending: pending,
        offline: start.offline,
        conceptsOpen: conceptsOpen,
        onRetry: () => ref.invalidate(practiceQuoteProvider(_c.query)),
        onUseDailyCount: () => _c.change(_selection.copyWith(count: 10)),
        onOpenConcepts: widget.exits.concepts,
        onOpenReview: widget.exits.review,
      ),
      // The level is an aside to what you get and what it costs, so it follows them: Cost and
      // Marking are never pushed below the fold by a control. With credits short it is not a
      // choice that matters, so it steps aside.
      // The quote decides these two, so they open and close with it instead of cutting in.
      if (mode.allowsDifficulty)
        KeyReveal(
          show: !start.gated && !start.creditsLow,
          child: Padding(padding: const EdgeInsets.only(top: MmSpace.s20), child: difficulty),
        ),
      if (mode.isMock)
        KeyReveal(
          show: !start.gated,
          child: Padding(
            padding: const EdgeInsets.only(top: MmSpace.s16),
            child: MockLines(
              noLength: loaded != null && loaded.launchable && start.mockMinutes == null,
              subject: internalSubjectFor(_selection.subjectId, catalog),
            ),
          ),
        ),
      if (!mode.isMock) ...[
        const SizedBox(height: MmSpace.s12),
        Text(PracticeCopy.feedbackAfter, style: type.small.copyWith(color: colors.ink2)),
      ],
    ];

    final keys = PracticeComposerKeys(controller: _c, exits: widget.exits);
    final Widget layout;
    if (widget.pinKey) {
      layout = _Pinned(content: children, keys: keys);
    } else {
      layout = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        // With a shared controller the host's footer draws the keys.
        children: [
          ...children,
          if (widget.controller == null) ...[const SizedBox(height: MmSpace.s24), keys],
        ],
      );
    }
    return PopScope(canPop: !_c.starting, child: layout);
  }
}

/// Start (and Not now on the sheet), with what happened on the last Start right above it.
/// Drawn by the composer on the setup page and by the confirm sheet's pinned footer.
class PracticeComposerKeys extends ConsumerStatefulWidget {
  const PracticeComposerKeys({super.key, required this.controller, required this.exits});

  final ComposerController controller;
  final ComposerExits exits;

  /// How long the sheet holds after the stub tears (the tear is 220 ms, the check 120 ms).
  static const Duration tearHold = Duration(milliseconds: 260);

  /// A Full mock's hold: the dial fades in (160 ms), the long hand turns once (700 ms on the sweep
  /// curve) and rests on 12 (60 ms): 920 ms, under the T2 cap of 1200 ms (MOTION.md 1.2; APP-PASS
  /// AP2-01). It costs the student no time: the paper's clock counts down to the server's end
  /// time (RunnerSession.endsAt), set when the server started the session, not when the runner
  /// opens.
  static final Duration clockHold = Duration(milliseconds: (StopwatchSim.lapLanded * 1000).round() + 60);

  /// NTA mode's hold: the exam sheet's slide and the mark's settle (420 ms), then 200 ms held.
  static final Duration examSheetHold = ExamSheetStart.duration + const Duration(milliseconds: 200);

  /// The hold after the server's yes for [mode].
  static Duration holdFor(PracticeMode mode) => switch (mode) {
    PracticeMode.full => clockHold,
    PracticeMode.nta => examSheetHold,
    _ => tearHold,
  };

  @override
  ConsumerState<PracticeComposerKeys> createState() => _PracticeComposerKeysState();
}

class _PracticeComposerKeysState extends ConsumerState<PracticeComposerKeys> {
  ComposerController get _c => widget.controller;

  @override
  void initState() {
    super.initState();
    _c.addListener(_changed);
  }

  @override
  void didUpdateWidget(PracticeComposerKeys oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_changed);
      widget.controller.addListener(_changed);
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _c.removeListener(_changed);
    super.dispose();
  }

  /// The open alternative to a Pro-only mode: a Full mock for NTA, Quick practice for Smart.
  void _takeOpen() {
    final s = _c.selection;
    _c.change(PracticeSelection(mode: s.mode == PracticeMode.smart ? PracticeMode.quick : PracticeMode.full, subjectId: s.subjectId));
  }

  Future<void> _start(PracticeQuote quote) async {
    if (_c.starting) return;
    final selection = _c.selection;
    final query = _c.query;
    _c.update(() {
      _c.starting = true;
      _c.tear = TicketTear.lifted;
      _c.failure = null;
      _c.costNote = null;
    });
    final result = await launchPractice(ref, selection, quote);
    if (!mounted) return;
    switch (result) {
      case LaunchStarted(:final sessionId):
        // Only now, with the server's yes: the stub tears off (a Full mock's stopwatch runs its
        // turn under it), the key says Starting, and the sheet lets go once that has been seen,
        // inside the hold for its mode (PracticeComposerKeys.holdFor; under reduced motion a
        // mock shows its landed frame for 300 ms and practice does not wait). The key's
        // `leading` check is not drawn: KeyButton paints a leading on option keys only.
        // One selection at the tear; a Full mock adds a segment tick as the hand lands on 12.
        final haptics = ref.read(hapticsProvider);
        haptics.selection();
        _c.update(() => _c.tear = TicketTear.torn);
        if (Motion.reduced(context)) {
          // The landed frame, seen for a moment, then the paper.
          if (selection.mode == PracticeMode.full || selection.mode == PracticeMode.nta) {
            await Future<void>.delayed(const Duration(milliseconds: 300));
          }
        } else if (selection.mode == PracticeMode.full) {
          final landed = Duration(milliseconds: (StopwatchSim.lapLanded * 1000).round());
          await Future<void>.delayed(landed);
          if (!mounted) return;
          haptics.segmentTick();
          await Future<void>.delayed(PracticeComposerKeys.clockHold - landed);
        } else {
          await Future<void>.delayed(PracticeComposerKeys.holdFor(selection.mode));
        }
        if (!mounted) return;
        widget.exits.run(sessionId);
      case LaunchNeedsLook(:final quote, :final costChanged):
        _c.update(() {
          _c.starting = false;
          _c.tear = TicketTear.rest;
          _c.costNote = costChanged ? PracticeCopy.costChanged(costLineText(quote)) : null;
        });
        ref.invalidate(practiceQuoteProvider(query));
      case LaunchFailed(:final failure, :final message):
        _c.update(() {
          _c.starting = false;
          _c.tear = TicketTear.rest;
          _c.failure = StartFailureView(failure, message: message);
        });
    }
  }

  static void _noop() {}

  String get _startLabel => switch (_c.selection.mode) {
    PracticeMode.quick || PracticeMode.smart => PracticeCopy.startPractice,
    PracticeMode.chapter => PracticeCopy.startChapter,
    _ => PracticeCopy.startMock,
  };

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final start = _startState(ref, _c);
    final loaded = start.loaded;
    final mode = _c.selection.mode;
    final starting = _c.starting;
    final torn = _c.tear == TicketTear.torn;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // What happened when Start was tapped sits right above Start, where the eye already is.
        KeyReveal(
          show: _c.costNote != null,
          child: Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: Semantics(liveRegion: true, child: Text(_c.costNote ?? '', style: type.body)),
          ),
        ),
        KeyReveal(
          show: _c.failure != null,
          child: Padding(
            padding: const EdgeInsets.only(bottom: MmSpace.s12),
            child: PlainNotice(message: _c.failure?.text ?? '', tone: BannerTone.error),
          ),
        ),
        KeyButton(
          // A Pro-gated mode has nothing to start: the one action is the open alternative. Once
          // the server has said yes the key inks to a check and says "Starting".
          label: torn
              ? PracticeCopy.startingNow
              : start.gated
                  ? (mode == PracticeMode.smart ? PracticeCopy.takeQuickInstead : PracticeCopy.takeFullInstead)
                  : _startLabel,
          leading: torn ? const _InkedCheck() : null,
          loading: starting && !torn,
          disabledReason: start.disabledReason,
          onPressed: torn
              ? _noop
              : start.gated
                  ? _takeOpen
                  : (start.canStart && !starting && loaded != null ? () => _start(loaded) : null),
        ),
        if (widget.exits.close != null) ...[
          const SizedBox(height: MmSpace.s4),
          Align(
            child: KeyButton.quiet(label: PracticeCopy.notNow, onPressed: starting ? null : widget.exits.close),
          ),
        ],
      ],
    );
  }
}

/// The check the Start key inks when the server has confirmed: it scales in over 120 ms (shown
/// at once under reduced motion).
class _InkedCheck extends StatelessWidget {
  const _InkedCheck();

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.4, end: 1),
      duration: Motion.of(context, const Duration(milliseconds: 120)),
      curve: Motion.out,
      builder: (context, t, child) => Opacity(opacity: t.clamp(0.0, 1.0), child: Transform.scale(scale: t, child: child)),
      child: const Icon(LucideIcons.check, size: 18),
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
    return SubjectChips(choices: choices, selectedId: selected, onSelected: onPick, onMore: others.isEmpty ? null : () => onOther(others));
  }
}

/// The setup page's layout: the content scrolls and fades into the ground; Start is pinned at
/// the bottom (16 dp gutter, 16 dp above the gesture inset).
class _Pinned extends StatelessWidget {
  const _Pinned({required this.content, required this.keys});

  final List<Widget> content;
  final Widget keys;

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
                  // The last control scrolls fully clear of the fade above Start.
                  padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, BarFade.extent + MmSpace.s16),
                  children: content,
                ),
              ),
              const BarFade(),
            ],
          ),
        ),
        ColoredBox(
          color: colors.ground,
          child: Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s16 + MediaQuery.paddingOf(context).bottom),
            child: keys,
          ),
        ),
      ],
    );
  }
}
