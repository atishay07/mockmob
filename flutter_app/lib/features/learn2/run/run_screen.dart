/// The Learn run (the web's `src/components/learn2/run/RunPlayer.jsx`, BUILD-1101 B2 with B7, A4 3.3 to 3.5): one chapter's
/// Key cards, questions and lesson as a session, one item at a time, on the shared study stage (`../stage/`). A full screen over
/// the app (no dock), the phone band of the web exactly:
///
///   top bar     Close, the chapter's title, the In Revise pile with its count and "3 of 21"; under them the ticks and "about
///               6 min left"
///   the item    a Key card (it fits its words, turns over in 3D) or a question (graded by the server, NCERT's line opening in
///               place under a wrong answer) or a lesson; it comes up 8 dp from below, one at a time (the run moves by its keys,
///               never by a swipe, except a recap's cards, which follow a sideways swipe)
///   action bar  Show answer; then Missed, Got it (the volt key) and Easy; a question: a quiet Skip, then Save and Next; a
///               look past Free's ratings: Next; a lesson: Skip it and Read the lesson; a recap: Previous and Next; one status
///               line under the keys (the stamp, a coach line, an error, Free's look line)
///   Got it, Easy the card flies into the pile in the top bar (the count pops, the stamp says the server's real day); Missed
///               tilts and drops away: "Back later in this run"
///   stop rule   before any item is done, Close and the system Back leave; after one, they ask "Stop for now?"
///   end         the chapter's title and the done line, the Revise pile, Key cards, Questions and Old mistakes, the lead and its
///               volt key, the options; Free after its day: the server's line and See Pro
///   states      the skeleton, the run did not start, a chapter not in the book list, nothing to line up, Free's day used
///
/// Every server href goes through `Learn2Links.resolve`; the state lives in [RunController].
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/action_router.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../insights/data/saved_repository.dart' show savedRepositoryProvider;
import '../../keycards/data/keycards_lines.dart' show cardFace;
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../data/learn_models.dart';
import '../data/learn_prefs.dart';
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import '../stage/card_face.dart';
import '../stage/question_view.dart';
import '../stage/stage_frame.dart' show StageFrame;
import '../stage/stage_keys.dart';
import '../stage/stage_motion.dart';
import '../stage/stage_pager.dart';
import '../stage/stage_sheets.dart';
import '../stage/stage_states.dart';
import '../stage/stage_ticks.dart';
import 'run_controller.dart';
import 'run_copy.dart';
import 'run_end.dart';
import 'run_flight.dart';
import 'run_math.dart';
import 'run_parts.dart';
import 'run_view.dart';

/// A run (packet R).
class LearnRunScreen extends ConsumerStatefulWidget {
  const LearnRunScreen({super.key, required this.launch});

  final RunLaunch launch;

  @override
  ConsumerState<LearnRunScreen> createState() => LearnRunScreenState();
}

class LearnRunScreenState extends ConsumerState<LearnRunScreen> {
  late final RunController _c;
  final GlobalKey _pileKey = GlobalKey(debugLabel: 'run-pile');
  final GlobalKey _endTitleKey = GlobalKey(debugLabel: 'run-end-title');
  final Map<String, GlobalKey> _cardKeys = {};
  ProviderContainer? _container;
  bool _stopOpen = false;

  /// The controller, for tests.
  @visibleForTesting
  RunController get controller => _c;

  @override
  void initState() {
    super.initState();
    _c = RunController(
      api: ref.read(learnApiProvider),
      launch: widget.launch,
      prefs: _prefs(),
      onSay: _say,
      onRated: _rated,
      onSeePro: _seePro,
      onSaved: _saved,
      openLesson: _openLesson,
    )..addListener(_changed);
    unawaited(Future<void>.microtask(_c.start));
  }

  LearnPrefs? _prefs() {
    try {
      return ref.read(learnPrefsProvider);
    } on Object {
      return null;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _container = ProviderScope.containerOf(context, listen: false);
  }

  @override
  void dispose() {
    // What the run changed (ratings, answers) shows on Learn home, the chapter page and Explore once it is left.
    final container = _container;
    if (_c.changed && container != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          invalidateLearnReads(container.invalidate);
        } on Object {
          // The app is closing: nothing to read again.
        }
      });
    }
    _c
      ..removeListener(_changed)
      ..dispose();
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  // ---------------------------------------------------------------- effects

  void _say(String text) {
    if (mounted) StageFrame.say(context, text);
  }

  /// After the server took a rating: the confirm haptic (Got it, Easy) or the tick (Missed, a look), and the card's flight.
  void _rated(RunRated e) {
    if (!mounted) return;
    if (e.viaRating) {
      final h = hapticsOf(context);
      unawaited(e.flies ? h?.confirm() : h?.tick());
    }
    final from = _cardKeys[e.itemId];
    if (from == null) return;
    final item = _c.items.where((i) => i.id == e.itemId).firstOrNull;
    final face = item is LearnCardItem ? cardFace(item.card) : null;
    unawaited(RunFlight.fly(context, from: from, to: _pileKey, kind: e.kind, label: face?.label ?? '', words: item is LearnCardItem ? item.card.back : ''));
  }

  /// After a save: the app's Saved list reads again, so it agrees with this run.
  void _saved() {
    if (!mounted) return;
    unawaited(hapticsOf(context)?.settle());
    try {
      unawaited(ref.read(savedRepositoryProvider.notifier).refresh(force: true).catchError((Object _) {}));
    } on Object {
      // The Saved list reads itself the next time it opens.
    }
  }

  void _seePro(String why) {
    if (!mounted) return;
    showUpgradeSheetIfOn(context, reason: why == 'saved' ? ProReason.general : ProReason.keycards);
  }

  /// A lesson opens on its own page; the future completes when the student comes back.
  Future<void> _openLesson(String lessonId) async {
    final router = GoRouter.maybeOf(context);
    if (router == null) return;
    await router.push<void>(AppRoutes.learnUnit(lessonId));
  }

  // ---------------------------------------------------------------- places

  GoRouter? get _router => GoRouter.maybeOf(context);

  void _push(String location) {
    final router = _router;
    if (router != null) unawaited(router.push<void>(location));
  }

  void _replace(String location) {
    final router = _router;
    if (router != null) unawaited(router.pushReplacement<void>(location));
  }

  /// Close and "Leave for now": back where the run was opened from, else the chapter's page, else Learn.
  void _leave() {
    final router = _router;
    if (router == null) {
      unawaited(Navigator.maybeOf(context)?.maybePop());
      return;
    }
    if (router.canPop()) {
      router.pop();
      return;
    }
    final key = _c.chapterKey;
    router.go(key != null ? Learn2Links.chapter(key) : Learn2Links.home());
  }

  /// Whether the page under this one is [key]'s chapter page.
  bool _chapterIsBelow(GoRouter router, String key) {
    try {
      final matches = router.routerDelegate.currentConfiguration.matches;
      if (matches.length < 2) return false;
      return Uri.decodeComponent(matches[matches.length - 2].matchedLocation) == Uri.decodeComponent(Uri.parse(Learn2Links.chapter(key)).path);
    } on Object {
      return false;
    }
  }

  /// "Back to the chapter": the page under the run when it is the chapter's, else the chapter's page in the run's place.
  void _toChapter() {
    final router = _router;
    final key = _c.chapterKey;
    if (router == null || key == null) {
      _leave();
      return;
    }
    if (router.canPop() && _chapterIsBelow(router, key)) {
      router.pop();
    } else {
      unawaited(router.pushReplacement<void>(Learn2Links.chapter(key, minutes: widget.launch.minutes)));
    }
  }

  /// "Back to Learn" (a chapter that is not in the book list).
  void _toLearn() {
    final router = _router;
    if (router == null) return;
    final subject = (_c.chapterKey ?? '').split('.').first;
    router.go(Learn2Links.home(subject: subject.isEmpty ? null : subject));
  }

  /// A server href as an app location: the Learn places by `Learn2Links.resolve`; a filtered Explore link ("Questions on this
  /// chapter in Explore") is Explore's question stream, as the web keeps its filters, so it goes through the app's
  /// ActionRouter, like any other place on the site.
  String? _hrefLocation(String? href) {
    if (href == null || href.isEmpty) return null;
    final uri = Uri.tryParse(href);
    if (uri == null) return null;
    final path = uri.path.length > 1 && uri.path.endsWith('/') ? uri.path.substring(0, uri.path.length - 1) : uri.path;
    final filtered = path == '/explore' && uri.queryParameters.keys.any((k) => k != 'subject');
    if (!filtered) {
      final own = Learn2Links.resolve(href);
      if (own != null) return own;
    }
    final target = ActionRouter.resolve(href);
    return target is NativeTarget ? target.location : null;
  }

  /// Where a key of the end leads: its href, or the run or feed it names (the web's `hrefOf`).
  String? _locationOf(LearnOption o) {
    final href = o.href;
    if (href != null) return _hrefLocation(href);
    final spec = o.run;
    if (spec == null) return null;
    final minutes = (spec.minutes ?? 0) > 0 ? spec.minutes! : 10;
    if (spec.kind == LearnKinds.feed) return Learn2Links.feed(FeedLaunch(chapterKey: spec.chapterKey, minutes: minutes));
    return Learn2Links.run(RunLaunch(chapterKey: spec.chapterKey, minutes: minutes, kind: spec.kind, leaveOut: spec.leaveOut, cardIds: spec.cardIds));
  }

  void _open(LearnOption o) {
    final location = _locationOf(o);
    if (location == null) return;
    if (o.href == null) {
      _replace(location);
    } else {
      _push(location);
    }
  }

  void _pickUp(LearnSessionHolder r) {
    if (r.kind == LearnKinds.feed) {
      _replace(Learn2Links.feed(FeedLaunch(chapterKey: r.chapterKey, minutes: widget.launch.minutes, runId: r.id)));
    } else {
      _replace(Learn2Links.run(RunLaunch(chapterKey: r.chapterKey, runId: r.id)));
    }
  }

  // ---------------------------------------------------------------- stopping

  /// The one stop rule: before any item is done, Close (and Back) leave; after one, they ask.
  Future<void> _askClose() async {
    final c = _c;
    if (!c.asksToStop) {
      _leave();
      return;
    }
    if (_stopOpen) return;
    _stopOpen = true;
    final choice = await showStopSheet(context, done: math.min(c.doneCount, c.total), of: c.total, detail: c.stopDetail);
    _stopOpen = false;
    if (!mounted) return;
    switch (choice) {
      case StageStopChoice.end:
        c.finish(c.doneCount);
      case StageStopChoice.leave:
        _leave();
      case StageStopChoice.keepGoing:
      case null:
        break;
    }
  }

  // ---------------------------------------------------------------- the frame

  @override
  Widget build(BuildContext context) {
    final c = _c;
    c.reduced = Motion.reduced(context);
    final colors = context.mmColors;
    final Widget body = switch (c.status) {
      RunStatus.loading => RunSkeleton(onClose: () => unawaited(_askClose())),
      RunStatus.error => _centre(
        StageCentre(
          title: RunCopy.errorTitle,
          line: RunCopy.errorLine,
          keys: [
            StageStepKey(label: RunCopy.tryAgain, onTap: () => unawaited(c.begin())),
            StageTextKey(label: RunCopy.backToChapter, quiet: true, onTap: _toChapter),
          ],
        ),
      ),
      RunStatus.notFound => _centre(
        StageCentre(
          title: RunCopy.notFoundTitle,
          keys: [StageStepKey(label: RunCopy.backToLearn, onTap: _toLearn)],
        ),
      ),
      RunStatus.empty => _centre(
        StageCentre(
          title: RunCopy.emptyTitle,
          line: RunCopy.emptyLine,
          keys: [StageStepKey(label: RunCopy.backToChapter, onTap: _toChapter)],
        ),
      ),
      RunStatus.free => _centre(_freeState()),
      RunStatus.ready => _ready(),
    };
    return PopScope(
      canPop: !c.asksToStop,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_askClose());
      },
      child: Material(color: colors.ground, child: body),
    );
  }

  /// A state without items: the top bar's Close and the title, the state centred in the item area, no action bar.
  Widget _centre(Widget body) => RunFrame(
    label: RunCopy.stageLabel(_c.title),
    topBar: RunTopBar(onClose: () => unawaited(_askClose()), title: _c.title, reserveRight: false),
    child: RunCentreArea(child: body),
  );

  /// Free's day is used: the server's line, the run that holds the day, its options, See Pro.
  Widget _freeState() {
    final f = _c.free ?? const LearnSessionUsed(line: '');
    final r = f.resume;
    final proOn = ref.watch(proNudgesOnProvider);
    return StageCentre(
      title: RunCopy.freeTitle,
      line: f.line.isNotEmpty ? f.line : RunCopy.freeLine,
      keys: [
        if (r != null) StageStepKey(label: RunCopy.pickUp(r.done, r.of), onTap: () => _pickUp(r)),
        for (final o in f.options)
          if (_locationOf(o) != null) StageStepKey(label: o.label, tone: StageTone.line, onTap: () => _open(o)),
        StageStepKey(label: RunCopy.backToChapter, tone: r == null ? StageTone.volt : StageTone.line, onTap: _toChapter),
        if (proOn) StageTextKey(label: RunCopy.seePro, onTap: () => _seePro('learn')),
      ],
    );
  }

  Widget _ready() {
    final c = _c;
    switch (c.phase) {
      case RunPhase.end:
        return RunFrame(
          label: RunCopy.stageLabel(c.title),
          topBar: RunTopBar(onClose: _leave),
          end: _end(),
        );
      case RunPhase.recapEnd:
        return RunFrame(
          label: RunCopy.stageLabel(c.title),
          topBar: RunTopBar(onClose: _leave),
          end: _recapEnd(),
        );
      case RunPhase.round:
        final left = c.items.skip(c.at).whereType<LearnCardItem>().length;
        return RunFrame(
          label: RunCopy.stageLabel(c.title),
          topBar: _topBar(round: true),
          child: RunCentreArea(
            child: RunRound(
              rated: c.round * RunController.roundEvery,
              left: left,
              keys: [
                StageStepKey(label: RunCopy.nextRound, onTap: c.nextRound),
                StageStepKey(label: RunCopy.finishHere, tone: StageTone.line, onTap: c.finishRound),
              ],
            ),
          ),
        );
      case RunPhase.play:
        return RunFrame(label: RunCopy.stageLabel(c.title), topBar: _topBar(), bar: _bar(), child: _track());
    }
  }

  Widget _topBar({bool round = false}) {
    final c = _c;
    final all = c.total;
    final at = c.offset + c.at;
    return RunTopBar(
      onClose: () => unawaited(_askClose()),
      title: c.title,
      ticks: all > 0 ? StageTicks(total: all, done: round ? at : c.offset + c.finished, current: at) : null,
      pile: c.isRecap ? null : c.pile,
      pileKey: _pileKey,
      pop: c.pop,
      position: round || all <= 0 ? null : c.position,
      of: round || all <= 0 ? null : all,
      left: round ? RunMath.minutesLeftLine(c.items, c.at, c.kind) : c.left,
    );
  }

  // ---------------------------------------------------------------- the item

  Widget _track() => StagePager(count: 1, index: 0, onGo: (_) {}, enabled: false, pageBuilder: _page);

  GlobalKey _cardKey(String id) => _cardKeys.putIfAbsent(id, () => GlobalKey(debugLabel: 'run-card-$id'));

  /// The next item rises 8 dp as it fades in, 60 ms after it is built.
  Widget _rise(String id, Widget child) =>
      StageIn(key: ValueKey<String>('rise-$id'), rise: 8, delay: const Duration(milliseconds: 60), duration: const Duration(milliseconds: 240), child: child);

  StagePage _page(BuildContext context, int index) {
    final c = _c;
    final it = c.item;
    if (it == null) return const StagePage.centre(id: 'run-none', label: RunCopy.endSaid, child: SizedBox.shrink());
    final pos = c.position;
    final of = c.total;
    final announce = c.announceOf(it);
    switch (it) {
      case LearnCardItem():
        final turned = c.isTurned(it);
        Widget face = CardFace.of(
          it.card,
          extraKind: RunView.stageTag(it, recap: c.isRecap),
          turned: turned,
          onTurn: () => c.turn(it),
          cardKey: _cardKey(it.id),
        );
        // The card leaves after its rating: the ghost takes over, so the real one is hidden (a fade under reduced motion).
        face = AnimatedOpacity(opacity: c.leaving ? 0 : 1, duration: c.reduced ? Motion.reducedFade : Duration.zero, child: face);
        if (c.isRecap) face = RunSwipe(onPrev: () => c.goRecap(-1), onNext: () => c.goRecap(1), child: face);
        return StagePage.card(id: it.id, label: 'Card $pos of $of', announce: announce, child: _rise(it.id, face));
      case LearnLessonItem():
        return StagePage.card(
          id: it.id,
          label: 'Lesson $pos of $of',
          announce: announce,
          child: _rise(
            it.id,
            RunLessonCard(
              cardKey: _cardKey(it.id),
              kindLabel: RunCopy.lessonKind(it.lesson.minutes),
              title: it.lesson.title ?? RunCopy.lessonFallbackTitle,
              line: RunCopy.lessonLine,
            ),
          ),
        );
      case LearnQuestionItem():
        final st = c.stateOf(it.id);
        final proOn = ref.read(proNudgesOnProvider);
        final head = it.isMistake ? RunCopy.mistakeHead(label: it.mistake?.label, where: it.mistake?.where, when: it.mistake?.when) : RunCopy.question;
        return StagePage.question(
          id: it.id,
          label: 'Question $pos of $of',
          announce: announce,
          child: _rise(
            it.id,
            QuestionView(
              head: head,
              mistake: it.isMistake,
              stem: it.question.body,
              options: [for (final o in it.question.options) (key: o.key, text: o.text)],
              answer: _stageAnswer(st.answer),
              streak: c.answers.streak,
              skipped: st.skipped,
              error: st.error,
              onChoose: (k) => unawaited(c.pick(k)),
              onSeePro: proOn ? () => _seePro('keycards') : null,
            ),
          ),
        );
    }
  }

  static StageAnswer? _stageAnswer(RunAnswer? a) {
    if (a == null) return null;
    final res = a.res;
    if (res == null) return StageAnswer.pending(a.choice);
    final line = res.line;
    return StageAnswer.graded(
      a.choice,
      StageResult(
        correct: res.correct,
        key: res.key ?? '',
        line: line == null ? null : StageLine(card: line.card, locked: line.locked, text: line.text),
        explanation: res.explanation.isEmpty ? null : res.explanation,
        fixedText: res.fixedText,
      ),
    );
  }

  // ---------------------------------------------------------------- the action bar

  Widget? _bar() {
    final c = _c;
    final it = c.item;
    if (it == null) return null;
    final nextLabel = c.last ? RunCopy.seeHow : RunCopy.next;
    final Widget keys;
    switch (it) {
      case LearnCardItem():
        if (c.isRecap) {
          keys = RunKeyRow(
            keys: [
              StageStepKey(label: RunCopy.previous, tone: StageTone.line, onTap: c.at == 0 ? null : () => c.goRecap(-1)),
              StageStepKey(label: c.last ? RunCopy.finish : RunCopy.next, onTap: () => c.goRecap(1)),
            ],
          );
        } else if (!c.isTurned(it)) {
          keys = StageStepKey(key: ValueKey('show-${it.id}'), label: RunCopy.showAnswer, haptic: false, onTap: c.leaving ? null : () => c.turn(it));
        } else if (c.isLook(it)) {
          keys = StageStepKey(key: ValueKey('look-${it.id}'), label: nextLabel, onTap: c.leaving ? null : () => unawaited(c.lookNext()));
        } else {
          keys = RunRateKeys(busy: c.busy, disabled: c.leaving, onRate: (r) => unawaited(c.rate(r)));
        }
      case LearnLessonItem():
        keys = RunKeyRow(
          flex: const [1, 2],
          keys: [
            StageStepKey(label: RunCopy.skipIt, tone: StageTone.line, onTap: c.skipLesson),
            StageStepKey(label: RunCopy.readLesson, onTap: () => unawaited(c.readLesson())),
          ],
        );
      case LearnQuestionItem():
        final st = c.stateOf(it.id);
        if (!c.isAnswered(it)) {
          keys = Row(
            children: [
              const SizedBox(width: StageSideKey.slot + MmSpace.s12),
              Expanded(
                child: StageSkipKey(key: ValueKey('skip-${it.id}'), onTap: c.skip, disabled: st.answer?.pending ?? false, label: RunCopy.skip),
              ),
              const SizedBox(width: StageSideKey.slot + MmSpace.s12),
            ],
          );
        } else {
          keys = RunNextRow(
            save: st.skipped != null ? null : _saveKey(it),
            next: StageStepKey(key: ValueKey('next-${it.id}'), label: nextLabel, later: st.answer?.res != null, onTap: c.advance),
          );
        }
    }
    return RunActionBar(keys: keys, status: c.statusLine);
  }

  Widget _saveKey(LearnQuestionItem it) {
    final save = _c.saveOf(it.question.id);
    final saved = save == RunSave.saved;
    return StageSideKey(
      key: ValueKey('save-${it.id}'),
      icon: LucideIcons.bookmark,
      label: saved ? RunCopy.saved : (save == RunSave.pro ? RunCopy.pro : RunCopy.save),
      semanticsLabel: saved ? RunCopy.savedLabel : (save == RunSave.pro ? RunCopy.proSaveLabel : RunCopy.saveLabel),
      on: saved,
      busy: save == RunSave.busy,
      pop: saved,
      onTap: () => unawaited(_c.save(it)),
    );
  }

  // ---------------------------------------------------------------- the ends

  Widget _end() {
    final c = _c;
    final proOn = ref.watch(proNudgesOnProvider);
    return RunEndLayer(
      status: c.endStatus,
      data: c.endData,
      kind: c.kind,
      chapterTitle: c.title,
      tally: c.tally,
      stoppedAt: c.stoppedAt,
      total: c.total,
      titleKey: _endTitleKey,
      onClose: _leave,
      onRetry: c.retryEnd,
      onBack: _toChapter,
      canOpen: (o) => _locationOf(o) != null,
      onOpen: _open,
      onSeePro: proOn ? () => _seePro('learn') : null,
    );
  }

  Widget _recapEnd() {
    final c = _c;
    final cards = {
      for (final i in c.items)
        if (i is LearnCardItem) i.card.id,
    }.length;
    return RunRecapEnd(
      titleKey: _endTitleKey,
      chapterTitle: c.title,
      cards: cards,
      onClose: _leave,
      onStudy: () {
        final next = c.studyThese();
        if (next != null) unawaited(c.restart(next));
      },
      onAgain: c.recapAgain,
      onBack: _toChapter,
    );
  }
}
