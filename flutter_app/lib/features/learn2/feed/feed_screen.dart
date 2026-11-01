/// The Explore feed (the web's `src/components/learn2/feed/ChapterFeed.jsx`, BUILD-1101 B3 with B7, A1 3.1-3.18, A8
/// F1-F18): one chapter's Key cards and questions, one item at a time, on the shared study stage (`../stage/`). A full
/// screen over the app (no dock), the phone band of the web exactly:
///
///   top bar     the ticks, Close, the chapter title ("Picked up at 7 of 21" for 2.4 s on a pick-up), the kept count (the
///               Keep flight lands there) and the counter "3 of 21", which opens "This feed"
///   the item    a real vertical pager: a Key card centred (it turns over in 3D), a question from the top (graded by the
///               server, NCERT's line opening in place under a wrong answer), a checkpoint after every 8 items when 4 or
///               more follow, and the end past the last item
///   action bar  Keep (a card) or Save (a question) on the left, the one volt step key in the middle (Turn over, Next,
///               See how it went; Skip as a line key on an unanswered question; End here and Keep going on a
///               checkpoint), Chapter on the right
///   stop rule   before any item is done, Close and the system Back leave; after one, they ask "Stop for now?"
///   end         the chapter title and the done line, the kept fan, Cards, Questions and Old mistakes, then "Another 10
///               minutes" (volt), the server's next chapter and due offer, "Back to Explore"; Free after its claim: the
///               server's line and See Pro
///   states      the stage skeleton ("Taking longer than usual" after 8 s), the feed did not start, a chapter not in the
///               book list, nothing to play yet, and Free's day used (the line, the pick-up, the options, See Pro)
///
/// Every server href goes through `Learn2Links.resolve`; the state lives in [FeedController].
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/motion/motion.dart';
import '../../../core/router/action_router.dart';
import '../../../core/theme/theme.dart';
import '../../insights/data/saved_repository.dart' show savedRepositoryProvider;
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../data/learn_models.dart';
import '../data/learn_prefs.dart';
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import '../stage/card_face.dart';
import '../stage/end_form.dart';
import '../stage/question_view.dart';
import '../stage/stage_flight.dart';
import '../stage/stage_frame.dart';
import '../stage/stage_keys.dart';
import '../stage/stage_pager.dart';
import '../stage/stage_sheets.dart';
import '../stage/stage_states.dart';
import '../stage/stage_text.dart';
import '../stage/stage_ticks.dart';
import 'feed_controller.dart';
import 'feed_copy.dart';
import 'feed_model.dart';
import 'feed_parts.dart';

/// A chapter feed (packet F).
class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key, required this.launch});

  final FeedLaunch launch;

  @override
  ConsumerState<FeedScreen> createState() => FeedScreenState();
}

class FeedScreenState extends ConsumerState<FeedScreen> {
  late final FeedController _c;
  final GlobalKey<StagePagerState> _pagerKey = GlobalKey<StagePagerState>();
  final GlobalKey _keptKey = GlobalKey(debugLabel: 'feed-kept');
  final GlobalKey _endTitleKey = GlobalKey(debugLabel: 'feed-end-title');
  final Map<String, GlobalKey> _cardKeys = {};
  ProviderContainer? _container;
  bool _stopOpen = false;
  bool _listOpen = false;

  /// The controller, for tests.
  @visibleForTesting
  FeedController get controller => _c;

  @override
  void initState() {
    super.initState();
    _c = FeedController(
      api: ref.read(learnApiProvider),
      launch: widget.launch,
      prefs: _prefs(),
      onSay: _say,
      onKept: _kept,
      onNudge: () => _pagerKey.currentState?.nudge(),
      onSaved: _saved,
      onSeePro: _seePro,
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
    // What the feed changed (kept cards, answers) shows on Explore, the chapter page and Learn home once it is left.
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

  /// After the server kept the card: the confirm haptic and the flight to the kept count.
  void _kept(String itemId) {
    if (!mounted) return;
    unawaited(hapticsOf(context)?.confirm());
    final from = _cardKeys[itemId];
    if (from != null) unawaited(StageFlight.fly(context, from: from, to: _keptKey));
  }

  /// After a save: the app's Saved list reads again, so it agrees with this feed.
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

  /// Close, "Leave for now": back where the feed was opened from, else Explore.
  void _leave() {
    final router = _router;
    if (router == null) {
      unawaited(Navigator.maybeOf(context)?.maybePop());
      return;
    }
    if (router.canPop()) {
      router.pop();
    } else {
      router.go(Learn2Links.explore());
    }
  }

  /// "Back to Explore": Explore is under a feed its cover started; any other feed gives its place to Explore.
  void _toExplore() {
    final router = _router;
    if (router == null) return;
    if (widget.launch.source == 'explore_cover' && router.canPop()) {
      router.pop();
    } else {
      unawaited(router.pushReplacement<void>(Learn2Links.explore()));
    }
  }

  /// A server href as an app location: the Learn places by `Learn2Links.resolve`; a filtered Explore link ("Questions
  /// on this chapter in Explore") is Explore's question stream, as the web keeps its filters, so it goes through the
  /// app's ActionRouter, like any other place on the site.
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

  void _openChapter() {
    final key = _c.chapterKey;
    _push(key != null ? Learn2Links.chapter(key) : Learn2Links.explore());
  }

  void _openNext(LearnFeedNext next) {
    if (next.run != null) {
      _replace(Learn2Links.feed(FeedLaunch(chapterKey: next.key, minutes: widget.launch.minutes)));
    } else {
      _push(Learn2Links.chapter(next.key));
    }
  }

  void _openDue(LearnDueOffer due) {
    final spec = due.run;
    final minutes = (spec?.minutes ?? 0) > 0 ? spec!.minutes! : due.minutes;
    _push(Learn2Links.run(RunLaunch(chapterKey: spec?.chapterKey ?? _c.chapterKey, minutes: minutes, kind: LearnKinds.cards, cardIds: spec?.cardIds ?? const [])));
  }

  void _openResume(LearnSessionHolder r) {
    if (r.kind == LearnKinds.feed) {
      _replace(Learn2Links.feed(FeedLaunch(chapterKey: r.chapterKey, minutes: widget.launch.minutes, runId: r.id)));
    } else {
      _push(Learn2Links.run(RunLaunch(chapterKey: r.chapterKey, runId: r.id)));
    }
  }

  void _openOption(LearnOption o) {
    final href = o.href;
    if (href != null) {
      final location = _hrefLocation(href);
      if (location != null) _push(location);
      return;
    }
    final spec = o.run;
    if (spec != null) {
      _push(Learn2Links.run(RunLaunch(chapterKey: spec.chapterKey, minutes: spec.minutes ?? 10, kind: spec.kind, cardIds: spec.cardIds)));
      return;
    }
    _push(Learn2Links.explore());
  }

  // ---------------------------------------------------------------- moving and asking

  void _go(int i) => _c.go(i);

  /// The one stop rule: before any item is done, Close (and Back) leave; after one, they ask.
  Future<void> _askClose() async {
    final c = _c;
    if (!c.asksToStop) {
      _leave();
      return;
    }
    if (_stopOpen) return;
    _stopOpen = true;
    final choice = await showStopSheet(context, done: math.min(c.itemsDone, c.of), of: c.of, detail: c.stopDetail);
    _stopOpen = false;
    if (!mounted) return;
    switch (choice) {
      case StageStopChoice.end:
        _go(_c.endAt);
      case StageStopChoice.leave:
        _leave();
      case StageStopChoice.keepGoing:
      case null:
        break;
    }
  }

  /// "This feed": every item with its mark; a row goes there, the foot ends here.
  Future<void> _openList() async {
    if (_listOpen) return;
    final c = _c;
    final rows = c.sheetRows();
    final places = [for (final r in rows) c.slotIndexOf(r.id)];
    _listOpen = true;
    await showStageSheet<void>(
      context: context,
      title: 'This feed',
      builder: (sheet) => StageFeedList(
        rows: [
          for (final (i, r) in rows.indexed)
            StageFeedRow(n: r.n, kind: r.kind, words: r.words, state: places[i] == c.active ? StageRowState.now : _rowState(r.mark)),
        ],
        onPick: (i) {
          Navigator.of(sheet).pop();
          if (places[i] >= 0) _go(places[i]);
        },
        onEnd: () {
          Navigator.of(sheet).pop();
          _go(_c.endAt);
        },
      ),
    );
    _listOpen = false;
  }

  static StageRowState _rowState(FeedRowMark? mark) => switch (mark) {
    FeedRowMark.kept => StageRowState.kept,
    FeedRowMark.seen => StageRowState.seen,
    FeedRowMark.right => StageRowState.right,
    FeedRowMark.wrong => StageRowState.wrong,
    null => StageRowState.ahead,
  };

  // ---------------------------------------------------------------- the frame

  @override
  Widget build(BuildContext context) {
    final c = _c;
    c.reduced = Motion.reduced(context);
    final colors = context.mmColors;
    final Widget body = switch (c.status) {
      FeedStatus.loading => StageSkeleton(
        onClose: () => unawaited(_askClose()),
        closeLabel: FeedCopy.closeLabel,
        label: FeedCopy.starting,
        slow: c.slow ? FeedSlowLine(onRetry: () => unawaited(c.begin())) : null,
      ),
      FeedStatus.error => _centre(
        StageCentre(
          title: FeedCopy.errorTitle,
          line: FeedCopy.errorLine,
          keys: [
            StageStepKey(label: FeedCopy.tryAgain, onTap: () => unawaited(c.begin())),
            StageTextKey(label: FeedCopy.backToExplore, quiet: true, onTap: _toExplore),
          ],
        ),
      ),
      FeedStatus.notFound => _centre(
        StageCentre(
          title: FeedCopy.notFoundTitle,
          line: FeedCopy.notFoundLine,
          keys: [StageStepKey(label: FeedCopy.backToExplore, onTap: _toExplore)],
        ),
      ),
      FeedStatus.empty => _centre(
        StageCentre(
          title: FeedCopy.emptyTitle,
          line: FeedCopy.emptyLine,
          keys: [
            StageStepKey(label: FeedCopy.backToExplore, onTap: _toExplore),
            if (c.chapterKey != null) StageStepKey(label: FeedCopy.openChapter, tone: StageTone.line, onTap: _openChapter),
          ],
        ),
      ),
      FeedStatus.free => _centre(_freeState()),
      FeedStatus.ready => _stage(),
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
  Widget _centre(Widget body) => StageFrame(
    label: FeedCopy.stageLabel(_c.title),
    onClose: () => unawaited(_askClose()),
    closeLabel: FeedCopy.closeLabel,
    title: _c.title,
    showBar: false,
    child: FeedCentreArea(child: body),
  );

  /// Free's day is used: the server's line, the run that holds the day (volt), its options with their minutes, See Pro.
  Widget _freeState() {
    final f = _c.free ?? const LearnSessionUsed(line: '');
    final r = f.resume;
    final key = _c.chapterKey;
    final proOn = ref.watch(proNudgesOnProvider);
    return StageCentre(
      title: FeedCopy.freeTitle,
      line: f.line.isNotEmpty ? f.line : FeedCopy.freeLine,
      keys: [
        if (r != null)
          FeedOptionKey(
            tone: StageTone.volt,
            label: FeedCopy.pickUp(r.done, r.of),
            sub: r.title != null && r.chapterKey != key ? r.title : null,
            onTap: () => _openResume(r),
          ),
        for (final o in f.options)
          FeedOptionKey(
            label: o.label,
            sub: o.evidence ?? ((o.run?.minutes ?? 0) > 0 ? FeedCopy.aboutMinutes(o.run!.minutes!) : null),
            onTap: () => _openOption(o),
          ),
        if (proOn) StageTextKey(label: FeedCopy.seePro, onTap: () => _seePro('learn_feed')),
      ],
    );
  }

  Widget _stage() {
    final c = _c;
    final s = c.slot;
    final item = s is FeedItemSlot ? s.item : null;
    final st = item == null ? const FeedItemState() : c.stateOf(item.id);
    final of = c.of;
    final mode = c.mode;
    final last = c.active == c.endAt - 1;
    final nextLabel = last ? FeedCopy.seeHow : FeedCopy.next;
    var wide = false;
    final main = <Widget>[];
    Widget? left;
    Widget? right;
    if (mode == FeedMode.items) {
      if (s is FeedCheckpointSlot) {
        wide = true;
        if (c.closed) {
          main.add(StageStepKey(key: ValueKey('step-${s.id}'), label: FeedCopy.seeHow, onTap: () => _go(c.endAt)));
        } else {
          main
            ..add(StageStepKey(key: ValueKey('end-${s.id}'), label: FeedCopy.endHere, tone: StageTone.line, onTap: () => _go(c.endAt)))
            ..add(StageStepKey(key: ValueKey('step-${s.id}'), label: FeedCopy.keepGoing, onTap: () => _go(c.active + 1)));
        }
      } else if (item is LearnCardItem) {
        main.add(
          st.seenBack
              ? StageStepKey(key: ValueKey('step-${item.id}'), label: nextLabel, onTap: () => _go(c.active + 1))
              : StageStepKey(key: ValueKey('step-${item.id}'), label: FeedCopy.turnOver, haptic: false, onTap: () => c.turn(item)),
        );
        left = _keepKey(item, st);
      } else if (item is LearnQuestionItem) {
        if (st.res != null || st.skipped != null || c.closed) {
          main.add(StageStepKey(key: ValueKey('next-${item.id}'), label: nextLabel, later: st.res != null, onTap: () => _go(c.active + 1)));
        } else {
          main.add(StageSkipKey(key: ValueKey('skip-${item.id}'), onTap: () => _go(c.active + 1), disabled: st.answer?.pending ?? false));
        }
        if (st.skipped == null) left = _saveKey(item, st);
      }
      if (item != null) right = StageSideKey(icon: LucideIcons.bookOpen, label: FeedCopy.chapter, onTap: _openChapter);
    }
    return StageFrame(
      label: FeedCopy.stageLabel(c.title),
      onClose: () => unawaited(_askClose()),
      closeLabel: FeedCopy.closeLabel,
      title: c.title,
      titleNote: c.note,
      ticks: of > 0 ? StageTicks(total: of, done: c.doneCount, current: c.current) : null,
      kept: c.numbers.kept,
      keptKey: _keptKey,
      position: of > 0 ? c.position : null,
      of: of > 0 ? of : null,
      onCounter: of > 0 ? () => unawaited(_openList()) : null,
      counterLabel: of > 0 ? FeedCopy.counterLabel(c.position, of) : null,
      left: wide ? null : left,
      right: wide ? null : right,
      main: main,
      wide: wide,
      showBar: mode == FeedMode.items,
      end: mode == FeedMode.end ? _end() : null,
      busy: c.again,
      child: c.onlyEnd ? null : _track(),
    );
  }

  Widget _keepKey(LearnCardItem item, FeedItemState st) => StageSideKey(
    key: ValueKey('keep-${item.id}'),
    icon: LucideIcons.bookmark,
    label: item.look ? FeedCopy.inRevise : (st.kept ? FeedCopy.kept : (st.keepPro ? FeedCopy.pro : FeedCopy.keep)),
    on: st.kept || item.look,
    busy: st.keeping,
    pop: st.kept,
    disabled: _c.closed && !st.kept,
    onTap: () => unawaited(_c.keep(item)),
  );

  Widget _saveKey(LearnQuestionItem item, FeedItemState st) => StageSideKey(
    key: ValueKey('save-${item.id}'),
    icon: LucideIcons.bookmark,
    label: st.saved ? FeedCopy.saved : (st.savePro ? FeedCopy.pro : FeedCopy.save),
    on: st.saved,
    busy: st.saving,
    pop: st.saved,
    onTap: () => unawaited(_c.save(item)),
  );

  /// The pager over the items and checkpoints, and the end as its last page (the end's layer covers it). A long
  /// question's "Options below" chip is the pager's own.
  Widget _track() {
    final c = _c;
    return StagePager(
      key: _pagerKey,
      count: c.endAt + 1,
      index: c.active.clamp(0, c.endAt),
      onGo: _go,
      pageBuilder: _page,
      enabled: c.mode == FeedMode.items,
      feedLabel: FeedCopy.feedLabel(c.title, c.of),
    );
  }

  GlobalKey _cardKey(String id) => _cardKeys.putIfAbsent(id, () => GlobalKey(debugLabel: 'feed-card-$id'));

  StagePage _page(BuildContext context, int i) {
    final c = _c;
    if (i >= c.endAt) return const StagePage.centre(id: 'feed-end', label: FeedCopy.endLabel, announce: FeedCopy.endSaid, child: SizedBox.shrink());
    final of = c.of;
    final slot = c.slots[i];
    switch (slot) {
      case FeedCheckpointSlot(:final id, :final after):
        final n = c.numbers;
        final cp = FeedModel.checkpointText(n, done: c.base + after, of: of, seconds: FeedModel.secondsFrom(c.items, after));
        return StagePage.centre(
          id: id,
          label: FeedCopy.checkpointLabel(c.base + after, of),
          announce: c.announceOf(i),
          child: StageCheckpoint(big: cp.big, status: cp.status, line: cp.line, kept: n.kept > 0),
        );
      case FeedItemSlot(:final item, :final n):
        final pos = c.base + n;
        final st = c.stateOf(item.id);
        if (item is LearnQuestionItem) {
          final place = c.placeOf(item.id);
          final head = item.isMistake
              ? (item.mistake?.label ?? FeedCopy.missedBefore)
              : (place != null && c.base == 0 ? FeedCopy.questionOf(place.n, place.of) : FeedCopy.question);
          final proOn = ref.read(proNudgesOnProvider);
          return StagePage.question(
            id: item.id,
            label: FeedCopy.questionLabel(pos, of),
            announce: c.announceOf(i),
            child: QuestionView(
                head: head,
                mistake: item.isMistake,
                stem: item.question.body,
                options: [for (final o in item.question.options) (key: o.key, text: o.text)],
                answer: _stageAnswer(st.answer),
                streak: c.streak,
                skipped: st.skipped,
                locked: c.closed && st.answer == null ? FeedCopy.closedLine : null,
                error: st.error,
                onChoose: (k) => unawaited(c.choose(item, k)),
                onSeePro: proOn ? () => _seePro('keycards') : null,
              ),
          );
        }
        final card = item as LearnCardItem;
        final extra = switch (card.reason) {
          'earlier' => FeedCopy.backFromEarlier,
          'line' => FeedCopy.lineYouNeeded,
          _ => null,
        };
        final stamp = st.stamp ?? (card.look ? const FeedStamp(FeedCopy.inRevise) : null);
        return StagePage.card(
          id: card.id,
          label: FeedCopy.cardLabel(pos, of),
          announce: c.announceOf(i),
          child: CardFace.of(
            card.card,
            extraKind: extra,
            turned: st.turned,
            onTurn: () => c.turn(card),
            stamp: stamp == null ? null : StageStamp(stamp.text, bad: stamp.bad),
            cardKey: _cardKey(card.id),
          ),
        );
      case FeedEndSlot():
        return const StagePage.centre(id: 'feed-end', label: FeedCopy.endLabel, announce: FeedCopy.endSaid, child: SizedBox.shrink());
    }
  }

  static StageAnswer? _stageAnswer(FeedAnswer? a) {
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

  // ---------------------------------------------------------------- the end

  Widget _end() {
    final c = _c;
    final data = c.endData;
    final f = data?.feed;
    final of = c.of;
    final hasDone = f != null && f.raw['done'] is Map;
    final position = of > 0 && !c.onlyEnd ? math.min(of, hasDone ? f.done.reached : c.base + c.furthest) : null;
    final title = FeedModel.endTitle(
      endChapterTitle: asString(asJson(data?.raw['chapter'])['title']),
      runTitle: c.title,
      feedTitle: f?.title,
      endTitle: data?.title,
    );
    final done = hasDone
        ? StageText.doneLine(reached: f.done.reached, of: f.done.of, minutes: asJson(f.raw['done'])['minutes'] == null ? null : f.done.minutes)
        : StageText.doneLine(reached: c.onlyEnd ? 0 : math.min(of, c.base + c.furthest), of: c.onlyEnd ? 0 : of);
    final proOn = ref.watch(proNudgesOnProvider);
    final free = f?.free;
    final lead = f?.lead;
    final next = f?.next;
    final due = f?.dueOffer;
    return FeedEndSwipe(
      enabled: !c.onlyEnd && c.endAt > 0,
      onBack: () => _go(c.endAt - 1),
      child: StageEnd(
        onClose: _leave,
        closeLabel: FeedCopy.closeLabel,
        position: position,
        of: position != null ? of : null,
        child: EndForm(
          titleKey: _endTitleKey,
          loading: c.endStatus == FeedEndStatus.loading || c.endStatus == FeedEndStatus.idle,
          error: c.endStatus == FeedEndStatus.error ? (title: FeedCopy.endErrorTitle, line: FeedCopy.endErrorLine) : null,
          onRetry: () {
            final r = c.run;
            if (r != null && r.id.isNotEmpty) unawaited(c.readEnd(r.id, c.dirty));
          },
          retryKeys: [StageTextKey(label: FeedCopy.backToExplore, quiet: true, onTap: _toExplore)],
          title: title,
          done: done,
          pile: f == null
              ? null
              : StagePile(
                  count: f.kept.count,
                  cards: [for (final k in f.kept.cards) StagePileCard.of(kind: k.kind, front: k.front, id: k.id)],
                  line: FeedModel.pileLine(f.kept.line),
                  none: c.hasCards || c.onlyEnd ? FeedCopy.nothingKept : null,
                ),
          lines: f == null
              ? const []
              : [
                  for (final l in FeedModel.endLines(
                    [for (final l in f.lines) (label: l.label, text: l.text)],
                    seen: c.numbers.seen,
                    kept: f.kept.count,
                    hasCards: c.hasCards && !c.onlyEnd,
                  ))
                    (label: l.label, text: l.text),
                ],
          note: free == null ? null : FeedFreeNote(text: free.text, onSeePro: proOn ? () => _seePro('learn_feed') : null),
          keys: f == null
              ? const []
              : [
                  if (free == null && lead != null)
                    StageStepKey(label: c.again ? FeedCopy.startingAgain : lead.label, onTap: c.again ? null : () => unawaited(c.againFeed())),
                  if (next != null) StageStepKey(label: next.label, tone: StageTone.line, onTap: () => _openNext(next)),
                  if (due != null) StageStepKey(label: due.label, tone: StageTone.line, onTap: () => _openDue(due)),
                  StageTextKey(label: FeedCopy.backToExplore, quiet: true, onTap: _toExplore),
                ],
        ),
      ),
    );
  }
}
