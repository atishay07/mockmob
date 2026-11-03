/// The Explore feed (the web's `src/components/learn2/feed/ChapterFeed.jsx`, BUILD-1101 B3 with B7, A1 3.1-3.18, A8
/// F1-F18, rounds 2 to 4): one chapter's Key cards and questions, one item at a time, on the shared study stage
/// (`../stage/`). A full screen over the app (no dock), the phone band of the web exactly:
///
///   top bar     one row: Close (the X and the word), the ticks, the counter "3 of 21" (it opens "This feed"); under it the
///               chapter's name ("Picked up at 7 of 21" for 2.4 s on a pick-up). No kept count in a phone's bar
///   the item    a real vertical pager, each page the area less a 40 dp peek: a Key card that fills its page (it turns over
///               in 3D), a question with its options at the foot in the thumb zone (graded by the server, NCERT's line
///               opening in place under a wrong answer), a checkpoint after every 8 items when 4 or more follow, and the end
///               past the last item. The next item peeks as a real card edge with its type label; on a student's first feed
///               a Mobi chip says "Swipe up for the next one" until the first move
///   action bar  Revise later (a card; "In Revise" with a check once the server has it) or Save (a question) on the left,
///               the one volt step key in the middle (Turn over, Next, See how it went; Skip as a line key on an unanswered
///               question; Stop here and Keep going on a checkpoint), Chapter on the right
///   stop rule   before any item is done, Close and the system Back leave; after one, they ask "Stop for now?" ("5 of 20
///               done. It's all saved.", Stop here, Back to it)
///   end         one end screen (`EndScreen`): the chapter, a headline with Mobi, the small fan of the cards sent to Revise,
///               up to three numbers, the chapter's bar, then the server's one key and one link ("Keep going · 10 min",
///               "Next chapter · 10 min", "Continue · 6 min", "Fix 3 open mistakes · 3 min", "Quick recap · 1 min"); Free after
///               its claim adds its one line above them
///   states      the stage skeleton ("Taking longer than usual" after 8 s), the feed did not start, a chapter not in the
///               book list, nothing to play yet, and Free's day used (`StageFreeUsed`)
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
import '../../../core/repositories/local_scope.dart' show userIdProvider;
import '../../../core/router/action_router.dart';
import '../../../core/theme/theme.dart';
import '../../insights/data/saved_repository.dart' show savedRepositoryProvider;
import '../../keycards/data/keycards_lines.dart' show cardFace, kindFamily;
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../data/learn_models.dart';
import '../data/learn_prefs.dart';
import '../data/learn_providers.dart';
import '../learn2_links.dart';
import '../stage/card_face.dart';
import '../stage/end_form.dart';
import '../stage/question_view.dart';
import '../stage/sci_text.dart';
import '../stage/stage_cue.dart';
import '../stage/stage_end_model.dart';
import '../stage/stage_frame.dart';
import '../stage/stage_free_used.dart';
import '../stage/stage_keys.dart';
import '../stage/stage_pager.dart';
import '../stage/stage_sheets.dart';
import '../stage/stage_states.dart';
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
  final GlobalKey _endTitleKey = GlobalKey(debugLabel: 'feed-end-title');
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
      studentId: _student(),
      onSay: _say,
      onKept: _kept,
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

  String? _student() {
    try {
      return ref.read(userIdProvider);
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
    // What the feed changed (revised cards, answers) shows on Explore, the chapter page and Learn home once it is left.
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

  /// After the server added the card to Revise: the confirm haptic. A phone's bar has no pile for a card to fly to (the web's
  /// target is drawn from 1024 px), so the key turns to "In Revise" with a pop and the stamp says it under the card.
  void _kept(String itemId) {
    if (mounted) unawaited(hapticsOf(context)?.confirm());
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
    if (router == null) return;
    // A door of Practice (Explore, Learn) opens in place; everything else is pushed.
    if (Learn2Links.opensInPlace(location)) {
      router.go(location);
    } else {
      unawaited(router.push<void>(location));
    }
  }

  void _replace(String location) {
    final router = _router;
    if (router != null) unawaited(router.pushReplacement<void>(location));
  }

  /// Close: back where the feed was opened from, else Explore.
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
      router.go(Learn2Links.explore());
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

  /// Today's own run, picked up from Free's refusal.
  void _openResume(LearnSessionHolder r) {
    if (r.kind == LearnKinds.feed) {
      _replace(Learn2Links.feed(FeedLaunch(chapterKey: r.chapterKey, minutes: widget.launch.minutes, runId: r.id)));
    } else {
      _push(Learn2Links.run(RunLaunch(chapterKey: r.chapterKey, runId: r.id)));
    }
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
    final choice = await showStopSheet(context, done: math.min(c.itemsDone, c.of), of: c.of);
    _stopOpen = false;
    if (!mounted) return;
    if (choice == StageStopChoice.end) c.stopHere();
  }

  /// "This feed": every item with its mark; a row goes there, the foot stops here.
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
          _c.stopHere();
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
      FeedStatus.free => _freeState(),
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

  StageCloseKey _closeKey() => StageCloseKey(onTap: _leave, semanticsLabel: FeedCopy.closeLabel);

  /// Free's day is used (402 FREE_SESSION_USED): "That was today's free session.", the line, See Pro, then up to two quiet
  /// rows that the server accepts today: "Continue · N min", "Revise N due cards · M min", "Answer single questions".
  Widget _freeState() {
    final f = _c.free ?? const LearnSessionUsed(line: '');
    final proOn = ref.watch(proNudgesOnProvider);
    final key = _c.chapterKey;
    LearnOption? option(bool Function(LearnOption o) test) {
      for (final o in f.options) {
        if (test(o)) return o;
      }
      return null;
    }

    final revise = option((o) => o.run?.kind == LearnKinds.cards);
    final explore = option((o) => o.href != null && o.go == 'explore');
    final rows = [
      for (final row in StageEndModel.freeUsedRows(f.raw))
        if (row.id != 'continue' || f.resume != null)
          if (row.id != 'revise' || revise != null) row,
    ];
    return StageFreeUsedScreen(
      close: _closeKey(),
      rows: rows,
      onSeePro: proOn ? () => _seePro('learn_feed') : null,
      onRow: (id) {
        switch (id) {
          case 'continue':
            final r = f.resume;
            if (r != null) _openResume(r);
          case 'revise':
            final spec = revise?.run;
            if (spec != null) {
              _push(Learn2Links.run(RunLaunch(chapterKey: spec.chapterKey ?? key, minutes: spec.minutes ?? 10, kind: LearnKinds.cards, cardIds: spec.cardIds)));
            }
          case 'singles':
            _push(_hrefLocation(explore?.href) ?? Learn2Links.explore());
        }
      },
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
            ..add(StageStepKey(key: ValueKey('end-${s.id}'), label: FeedCopy.stopHere, tone: StageTone.line, onTap: c.stopHere))
            ..add(StageStepKey(key: ValueKey('step-${s.id}'), label: FeedCopy.keepGoing, onTap: () => _go(c.active + 1)));
        }
      } else if (item is LearnCardItem) {
        main.add(
          st.seenBack
              ? StageStepKey(key: ValueKey('step-${item.id}'), label: nextLabel, onTap: () => _go(c.active + 1))
              : StageStepKey(key: ValueKey('step-${item.id}'), label: FeedCopy.turnOver, haptic: false, onTap: () => c.turn(item)),
        );
        left = _reviseKey(item, st);
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

  /// A card's side key: "Revise later" with the card-stack glyph; once the server has the card, a check and "In Revise". Locked: "Pro".
  Widget _reviseKey(LearnCardItem item, FeedItemState st) {
    final inRevise = item.look || st.kept;
    return StageSideKey(
      key: ValueKey('keep-${item.id}'),
      icon: inRevise ? LucideIcons.check : null,
      mark: inRevise ? null : (color) => StageCardStack(color: color),
      label: inRevise ? FeedCopy.inRevise : (st.keepPro ? FeedCopy.pro : FeedCopy.reviseLater),
      on: inRevise,
      busy: st.keeping,
      pop: st.kept,
      disabled: _c.closed && !st.kept,
      onTap: () => unawaited(_c.keep(item)),
    );
  }

  Widget _saveKey(LearnQuestionItem item, FeedItemState st) => StageSideKey(
    key: ValueKey('save-${item.id}'),
    icon: LucideIcons.bookmark,
    label: st.saved ? FeedCopy.saved : (st.savePro ? FeedCopy.pro : FeedCopy.save),
    on: st.saved,
    busy: st.saving,
    pop: st.saved,
    onTap: () => unawaited(_c.save(item)),
  );

  /// The pager over the items and checkpoints, and the end as its last page (the end's layer covers it). The first visit's cue
  /// chip sits in the peek strip while a next item peeks; a long question's "Options below" chip is the pager's own.
  Widget _track() {
    final c = _c;
    final cue = c.cueDue && c.mode == FeedMode.items && c.active + 1 < c.endAt;
    return StagePager(
      count: c.endAt + 1,
      index: c.active.clamp(0, c.endAt),
      onGo: _go,
      pageBuilder: _page,
      enabled: c.mode == FeedMode.items,
      feedLabel: FeedCopy.feedLabel(c.title, c.of),
      chip: cue ? StageCue(label: FeedCopy.cue, leaving: c.cueLeaving) : null,
    );
  }

  /// The label on the card edge a page shows in the peek: a card's kind, a mistake's own line else "Question", "So far".
  static String _capOf(FeedSlot slot) => switch (slot) {
    FeedCheckpointSlot() => 'So far',
    FeedItemSlot(:final item) =>
      item is LearnCardItem ? cardFace(item.card).label : (item is LearnQuestionItem && item.isMistake ? (item.mistake?.label ?? FeedCopy.question) : FeedCopy.question),
    FeedEndSlot() => FeedCopy.question,
  };

  StagePage _page(BuildContext context, int i) {
    final c = _c;
    if (i >= c.endAt) return const StagePage.centre(id: 'feed-end', label: FeedCopy.endLabel, announce: FeedCopy.endSaid, child: SizedBox.shrink());
    final of = c.of;
    final slot = c.slots[i];
    final sci = SciText.isChemistry(chapterKey: c.chapterKey);
    switch (slot) {
      case FeedCheckpointSlot(:final id, :final after):
        final n = c.numbers;
        final cp = FeedModel.checkpointText(n, done: c.base + after, of: of, seconds: FeedModel.secondsFrom(c.items, after));
        final revised = [
          for (final x in c.items)
            if (x is LearnCardItem && c.stateOf(x.id).kept) StagePileCard.of(kind: x.card.kind, front: x.card.front, id: x.id),
        ];
        return StagePage.centre(
          id: id,
          cap: _capOf(slot),
          label: FeedCopy.checkpointLabel(c.base + after, of),
          announce: c.announceOf(i),
          child: StageCheckpoint(big: cp.big, status: cp.status, keptCards: revised),
        );
      case FeedItemSlot(:final item, :final n):
        final pos = c.base + n;
        final st = c.stateOf(item.id);
        if (item is LearnQuestionItem) {
          // One counter only (the top bar's "5 of 16"): a question's head is its kind, like a card's.
          final head = item.isMistake ? (item.mistake?.label ?? FeedCopy.missedBefore) : FeedCopy.question;
          final proOn = ref.read(proNudgesOnProvider);
          return StagePage.question(
            id: item.id,
            cap: _capOf(slot),
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
              sci: sci,
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
          cap: _capOf(slot),
          capFamily: kindFamily(card.card.kind),
          label: FeedCopy.cardLabel(pos, of),
          announce: c.announceOf(i),
          child: CardFace.of(
            card.card,
            extraKind: extra,
            turned: st.turned,
            onTurn: () => c.turn(card),
            stamp: stamp == null ? null : StageStamp(stamp.text, bad: stamp.bad),
            sci: sci,
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

  /// What an end key does, as data (the web's `specOf`): [act] `pro`, `again` (a new feed of this chapter, here), `resume` (this
  /// feed, by its id), or a [location] to open.
  _EndKey? _specOf(LearnOption? o, {required bool main}) {
    if (o == null) return null;
    final label = o.label;
    final r = o.run;
    final sub = main && o.kind == 'next' ? asString(o.raw['chapterTitle']) : null;
    if (o.go == 'pro') return _EndKey(label, act: _EndAct.pro);
    final href = o.href;
    if (href != null) {
      final to = _hrefLocation(href);
      return to == null ? null : _EndKey(label, sub: sub, location: to);
    }
    if (r != null && r.kind == LearnKinds.feed && r.resume != null) return _EndKey(label, act: _EndAct.resume, id: r.resume);
    if (r != null && r.kind == LearnKinds.feed && r.chapterKey == _c.chapterKey && r.fresh) return _EndKey(label, act: _EndAct.again);
    if (r != null && r.kind == LearnKinds.feed) {
      return _EndKey(label, sub: sub, location: Learn2Links.feed(FeedLaunch(chapterKey: r.chapterKey, minutes: r.minutes ?? widget.launch.minutes)), replace: true);
    }
    if (r != null) {
      return _EndKey(
        label,
        sub: sub,
        location: Learn2Links.run(
          RunLaunch(chapterKey: r.chapterKey ?? _c.chapterKey, minutes: r.minutes ?? 10, kind: r.kind, cardIds: r.cardIds, leaveOut: r.leaveOut, fresh: r.fresh),
        ),
      );
    }
    return null;
  }

  void _doKey(_EndKey key) {
    switch (key.act) {
      case _EndAct.pro:
        _seePro('learn_feed');
      case _EndAct.resume:
        unawaited(_c.resumeFeed(key.id ?? ''));
      case _EndAct.again:
        unawaited(_c.againFeed());
      case null:
        final to = key.location;
        if (to == null) return;
        if (key.replace) {
          _replace(to);
        } else {
          _push(to);
        }
    }
  }

  Widget _end() {
    final c = _c;
    final close = _closeKey();
    if (c.endStatus == FeedEndStatus.loading || c.endStatus == FeedEndStatus.idle) {
      return EndScreen(close: close, loading: true);
    }
    if (c.endStatus == FeedEndStatus.error) {
      return EndScreen(
        close: close,
        titleKey: _endTitleKey,
        error: (title: FeedCopy.endErrorTitle, line: FeedCopy.endErrorLine),
        onRetry: () {
          final r = c.run;
          if (r != null && r.id.isNotEmpty) unawaited(c.readEnd(r.id, c.dirty, stop: c.stoppedHere));
        },
        retryKeys: [StageTextKey(label: FeedCopy.backToExplore, quiet: true, onTap: _toExplore)],
      );
    }
    final data = c.endData;
    final f = data?.feed;
    final raw = asJson(data?.raw);
    final of = c.of;
    final onlyEnd = c.onlyEnd;
    final stopped = c.stoppedHere || raw['stopped'] == true;
    final hasDone = f != null && f.raw['done'] is Map;
    final doneJson = asJson(f?.raw['done']);
    final reached = onlyEnd ? (hasDone ? f.done.reached : 0) : (stopped ? math.min(of, c.itemsDone) : of);
    final doneOf = onlyEnd ? (hasDone ? f.done.of : 0) : of;
    final minutes = doneJson['minutes'];
    // The numbers: this feed's own, or (an end opened on its own) what the server's lines say.
    final qLine = f?.lines.where((l) => l.label == 'Questions').map((l) => l.text).firstOrNull ?? '';
    final nums = asJson(raw['numbers']);
    final FeedNumbers n = onlyEnd
        ? FeedNumbers(
            answered: int.tryParse(RegExp(r'of (\d+)').firstMatch(qLine)?.group(1) ?? '') ?? 0,
            right: int.tryParse(RegExp(r'^(\d+) of').firstMatch(qLine)?.group(1) ?? '') ?? 0,
            mistakes: asInt(nums['mistakes']) ?? 0,
            fixed: asInt(nums['fixed']) ?? 0,
          )
        : c.numbers;
    final kept = f?.kept.count ?? 0;
    // Cards this feed showed for the first time count as seen on the chapter's bar (turned feed cards are seen).
    final freshSeen = onlyEnd
        ? 0
        : c.items.where((i) {
            final st = c.stateOf(i.id);
            return i is LearnCardItem && i.stage == 'new' && st.seen && !st.kept;
          }).length;
    final progress = asJson(raw['progress']);
    final bar = raw['progress'] is Map
        ? StageEndModel.endProgress({
            ...progress,
            'seen': math.min(StageEndModel.whole(progress['of']), StageEndModel.whole(progress['seen']) + freshSeen),
          })
        : null;
    final lead = data?.lead;
    LearnOption? quietOption;
    for (final o in data?.options ?? const <LearnOption>[]) {
      if (!identical(o, lead)) {
        quietOption = o;
        break;
      }
    }
    final proOn = ref.watch(proNudgesOnProvider);
    final mainKey = _specOf(lead, main: true);
    final quietKey = _specOf(quietOption, main: false);
    final holding = c.again;
    Widget? mainWidget;
    if (mainKey != null && (mainKey.act != _EndAct.pro || proOn)) {
      final busy = holding && mainKey.act != _EndAct.pro;
      mainWidget = StageEndKey(label: busy ? FeedCopy.startingAgain : mainKey.label, sub: busy ? null : mainKey.sub, onTap: busy ? null : () => _doKey(mainKey));
    }
    Widget? quietWidget;
    if (quietKey != null && (quietKey.act != _EndAct.pro || proOn)) {
      final busy = holding && quietKey.act != _EndAct.pro;
      quietWidget = StageTextKey(label: quietKey.label, onTap: busy ? null : () => _doKey(quietKey));
    }
    final revise = StageEndModel.reviseLabel(asJson(f?.raw['kept'])['groups']);
    return FeedEndSwipe(
      enabled: !onlyEnd && c.endAt > 0,
      onBack: () => _go(c.endAt - 1),
      child: EndScreen(
        close: close,
        titleKey: _endTitleKey,
        chapter: FeedModel.endTitle(
          endChapterTitle: asString(asJson(raw['chapter'])['title']),
          runTitle: c.title,
          feedTitle: f?.title,
          endTitle: data?.title,
        ),
        headline: StageEndModel.endHeadline(reached: reached, of: doneOf, minutes: minutes, stopped: stopped),
        mobi: 'nod',
        pile: kept > 0 && f != null ? [for (final k in f.kept.cards) StagePileCard.of(kind: k.kind, front: k.front, id: k.id)] : null,
        numbers: StageEndModel.endNumbers(revise: kept, reviseText: revise, answered: n.answered, right: n.right, mistakes: n.mistakes, fixed: n.fixed),
        progress: bar,
        free: lead?.line,
        main: mainWidget,
        quiet: quietWidget,
      ),
    );
  }
}

/// What an end key does (the web's `specOf` result).
enum _EndAct { pro, again, resume }

class _EndKey {
  const _EndKey(this.label, {this.sub, this.act, this.id, this.location, this.replace = false});

  final String label;
  final String? sub;
  final _EndAct? act;
  final String? id;
  final String? location;

  /// A feed of another chapter takes this feed's place (it never stacks under it).
  final bool replace;
}
