// Today's layout for a given [TodayView]: the warm room (lamp light pooled behind the header),
// the top row, the hero, anything else that is open, the week's ending card, "Your sheet" and
// the road to May. Pure layout: goldens render it from fixtures.
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/foundation.dart' show ValueListenable;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderAbstractViewport, RenderParagraph;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/next_move.dart' show NextMoveState;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import '../logic/today_reactions.dart';
import '../widgets/also_slots.dart';
import '../widgets/move_hero.dart';
import '../widgets/resume_hero.dart';
import '../widgets/road_section.dart';
import '../widgets/sealed_hero.dart';
import '../widgets/sheet_section.dart';
import '../widgets/today_header.dart';
import '../widgets/today_entrance.dart';
import '../widgets/today_skeleton.dart';

class TodayCallbacks {
  const TodayCallbacks({
    required this.onAction,
    required this.onTarget,
    this.onMinutes,
    this.onShowMe,
    this.onWeek,
    this.onChooseColleges,
    this.onRefresh,
  });

  final void Function(TodayAction action) onAction;
  final void Function(TodayTarget target) onTarget;
  final ValueChanged<int>? onMinutes;
  final void Function(String attemptId)? onShowMe;
  final VoidCallback? onWeek;
  final VoidCallback? onChooseColleges;
  final Future<void> Function()? onRefresh;
}

class TodayBody extends StatefulWidget {
  const TodayBody({
    super.key,
    required this.view,
    required this.callbacks,
    this.controller,
    this.weeklyEnding,
    this.insights,
    this.roadFooter,
    this.mobiController,
    this.retrying = false,
    this.skeletonDelay = const Duration(milliseconds: 400),
  });

  final TodayView view;
  final TodayCallbacks callbacks;
  final ScrollController? controller;

  /// The rhythm module's weekly ending card, hosted under the hero when it has one to show.
  final Widget? weeklyEnding;

  /// The integrator's slot for the record finding (the Insights card, `findings[0]` with Show
  /// me). Placed under the hero; absent when null.
  final Widget? insights;

  /// A quiet line under the road to May (the CUET tools link); absent when null.
  final Widget? roadFooter;

  /// Drives Mobi when the hero is a human moment (day one, coming back, late at night).
  final MobiController? mobiController;

  /// A Try again read is running: the Try again key shows it is working.
  final bool retrying;
  final Duration skeletonDelay;

  @override
  State<TodayBody> createState() => _TodayBodyState();
}

class _TodayBodyState extends State<TodayBody> with TickerProviderStateMixin {
  static const double _bleed = TodayHeader.gutterBleed;

  /// The move card: the header Mobi points at it.
  GlobalKey _moveKey = GlobalKey(debugLabel: 'today-move');

  /// The move card's primary key and the stack that holds the page, to tell whether that key is
  /// out of view (under the bar or below the fold). While it is, tonight's move stands in for it
  /// as the bar's live capsule (MOTION.md 5.1): one thing floats above the bar, never two.
  GlobalKey _primaryKey = GlobalKey(debugLabel: 'today-primary');

  /// The move card's length selector (5, 10, 15 min), when it has one: the capsule never takes
  /// over while any of the card's controls could still sit in its place.
  GlobalKey _controlsKey = GlobalKey(debugLabel: 'today-controls');

  /// The kind of hero standing ("MoveHero", "SealedHero", null while loading). A new kind
  /// cross-fades in over the old one, so the move card gets fresh keys each time it arrives: the
  /// one still fading out keeps its own.
  Type? _heroKind;
  bool _heroBuilt = false;

  void _noteHeroKind(Type? kind) {
    if (_heroBuilt && kind == _heroKind) return;
    if (_heroBuilt && kind == MoveHero) {
      _moveKey = GlobalKey(debugLabel: 'today-move');
      _primaryKey = GlobalKey(debugLabel: 'today-primary');
      _controlsKey = GlobalKey(debugLabel: 'today-controls');
    }
    _heroKind = kind;
    _heroBuilt = true;
  }
  /// The whole hero card (not just its key): the capsule waits until all of it is out of view.
  final GlobalKey _heroBoxKey = GlobalKey(debugLabel: 'today-hero-box');
  final GlobalKey _stackKey = GlobalKey(debugLabel: 'today-stack');

  /// The road to May, for the "more below" cue: it shows while the road is under the first
  /// screen and the page has not been scrolled, and once the student scrolls it is gone for the
  /// visit (owner test 15 Oct: "something in the UI should be leading them below").
  final GlobalKey _roadKey = GlobalKey(debugLabel: 'today-road');
  final ValueNotifier<bool> _moreCue = ValueNotifier(false);
  bool _cueDone = false;
  ScrollController? _ownScroll;
  bool _measureQueued = false;

  /// The shell's bar, or null outside it (then nothing is published).
  MmBarInsets? _bar;

  /// The bar's top edge above the screen's bottom, measured from the expanded bar.
  double _barTop = 0;

  /// The status bar's height: a key above it has scrolled out of the top of the page.
  double _topInset = 0;

  /// The move this page published to the capsule, so it clears only its own.
  BarMove? _published;

  ScrollController get _scroll => widget.controller ?? (_ownScroll ??= ScrollController());

  /// Today's one page-load moment (ui-blitz/today.md 2.6). It runs only when the first build
  /// already has data (the usual open, painted from cache); a page that loads behind the
  /// skeleton appears in place, so the masthead never fades out and back in.
  late final AnimationController _entrance = AnimationController(vsync: this, duration: todayEntranceDuration);
  bool _entranceDecided = false;

  /// The primary key's short pulse (160 ms) when it comes back into view after tonight's capsule
  /// stood in for it: the key is seen to be the thing the capsule was.
  late final AnimationController _keyPulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 160));

  /// The key was out of view at the last judgement (so its return is a pulse).
  bool _keyWasOff = false;

  /// Where the key last was on screen (global): the capsule grows from it when the key leaves the
  /// screen and shrinks back toward it ([BarMove.originRect]).
  Rect? _lastKeyRect;

  /// A cue was played since the last pull began, so the refresh does not cue the same news twice.
  bool _cuedSinceRefresh = false;
  Timer? _settleMobi;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_queueMeasure);
    _watchFrames();
  }

  /// The line is judged after every frame, not only after a scroll or a rebuild: the hero's key
  /// moves with anything that changes the page's layout above it (the entrance, the art and the
  /// header settling, text scale), and a capsule raised for a key that has since come into view
  /// would stand beside it (device walk-through 22:07). It adds no frame of its own, and the
  /// measure is two offsets; the move is published only when it changes.
  void _watchFrames() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _measure();
      _watchFrames();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_entranceDecided) return;
    _entranceDecided = true;
    if (widget.view.hero == null || Motion.reduced(context)) {
      _entrance.value = 1;
    } else {
      _entrance.forward();
    }
  }

  @override
  void didUpdateWidget(TodayBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      (oldWidget.controller ?? _ownScroll)?.removeListener(_queueMeasure);
      _scroll.addListener(_queueMeasure);
    }
    // News the student did not ask for (a sync, the clock): today counted by the server, or a
    // read that failed. A pull that brings changes is answered in [_refresh].
    final change = TodayReactions.compare(oldWidget.view, widget.view);
    if (change.todayNewlyCounted) {
      _cueAfterBuild(MobiAct.correct);
    } else if (change.failedRead) {
      final act = TodayReactions.actFor(change);
      if (act != null) _cueAfterBuild(act);
    }
  }

  /// The same, after this frame: a cue must not notify listeners while the tree is building.
  void _cueAfterBuild(MobiAct act) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _cue(act);
    });
  }

  /// Mobi answers a real event: the published cue (the header's Mobi can subscribe to it), and
  /// the hero's own Mobi at once when the hero has him.
  void _cue(MobiAct act) {
    _cuedSinceRefresh = true;
    todayMobiCue.cue(act);
    final mobi = widget.mobiController;
    final hero = widget.view.hero;
    if (mobi == null || hero is! MoveHero || !hero.art.isMobi) return;
    // One reaction per kind in the glance gap: three chips picked in a row make him listen once.
    mobi.react(act, key: 'today:${act.name}');
    // Listening is a held stance: he goes back to standing a moment after the student stops.
    _settleMobi?.cancel();
    if (act == MobiAct.listen) _settleMobi = Timer(const Duration(milliseconds: 2400), () => mobi.play(MobiAct.idle));
  }

  /// A pull: the page shows the new data before the ring lifts, a refresh that changed something
  /// gets a nod from Mobi, one that changed nothing gets nothing, and a failed read gets his
  /// shrug (once a run).
  Future<void> _refresh() async {
    final read = widget.callbacks.onRefresh;
    if (read == null) return;
    final before = widget.view;
    _cuedSinceRefresh = false;
    try {
      await read();
    } catch (_) {
      if (mounted && MobiRation.oopsRun('today')) _cue(MobiAct.oops);
      rethrow;
    }
    if (!mounted) return;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted || _cuedSinceRefresh) return;
    final act = TodayReactions.actFor(TodayReactions.compare(before, widget.view));
    if (act != null) _cue(act);
  }

  void _minutes(int minutes) {
    final hero = widget.view.hero;
    if (hero is MoveHero && hero.selectedMinutes != minutes) _cue(MobiAct.listen);
    widget.callbacks.onMinutes?.call(minutes);
  }

  @override
  void dispose() {
    _scroll.removeListener(_queueMeasure);
    _ownScroll?.dispose();
    _publish(null);
    _settleMobi?.cancel();
    _keyPulse.dispose();
    _entrance.dispose();
    _moreCue.dispose();
    super.dispose();
  }

  void _queueMeasure() {
    if (_measureQueued || !mounted) return;
    _measureQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _measureQueued = false;
      if (mounted) _measure();
    });
  }

  /// The move goes to the capsule only when the card's primary key is wholly out of view: scrolled
  /// up past the top of the page, or with the card's controls (the length selector and the key)
  /// wholly below the line where the bar begins. A key that is partly visible, or a selector that
  /// the capsule would sit on, keeps the capsule away: it never covers a control the student can
  /// still see. The line is measured from the bar, not from the capsule, so the capsule arriving
  /// never moves it.
  void _measure() {
    // While the entrance plays the hero is not where it will rest (it rises 16 dp): it is judged
    // when it has landed, so the capsule never flickers in for a key that is about to be in view.
    if (_entrance.isAnimating) return;
    final hero = widget.view.hero;
    final key = _primaryKey.currentContext?.findRenderObject();
    final stack = _stackKey.currentContext?.findRenderObject();
    var off = false;
    if (key is RenderBox && key.attached && key.hasSize) _lastKeyRect = key.localToGlobal(Offset.zero) & key.size;
    if (_bar != null && _pinnable(hero) && stack is RenderBox && stack.attached && stack.hasSize) {
      if (key is! RenderBox || !key.attached || !key.hasSize) {
        // The list has let go of the key's row (it is scrolled well clear of the screen): it is
        // out of view by definition.
        off = true;
      } else {
        // The capsule floats above the bar, so it could land on words of the card (at 360 dp with
        // 1.3x text the date line sits there). It stands in for the move when the card is wholly
        // scrolled up past the status bar, or when the key and its controls are under the bar's
        // line and no word of the card is in the strip the capsule would cover.
        final keyTop = key.localToGlobal(Offset.zero, ancestor: stack).dy;
        final keyBottom = keyTop + key.size.height;
        var top = keyTop;
        var bottom = keyBottom;
        final card = _heroBoxKey.currentContext?.findRenderObject();
        if (card is RenderBox && card.attached && card.hasSize) {
          final cardTop = card.localToGlobal(Offset.zero, ancestor: stack).dy;
          bottom = math.max(bottom, cardTop + card.size.height);
        }
        final selector = _controlsKey.currentContext?.findRenderObject();
        if (selector is RenderBox && selector.attached && selector.hasSize) {
          top = math.min(top, selector.localToGlobal(Offset.zero, ancestor: stack).dy);
        }
        final line = stack.size.height - _barTop;
        final scrolledPast = bottom <= _topInset + 0.5;
        final belowTheBar = top >= line - 0.5;
        off = scrolledPast || (belowTheBar && !_wordsIn(card, stack, line - MmBar.capsuleClearance, line));
      }
    }
    // Back in view after the capsule stood in for it: one short pulse says it is the same move.
    if (_keyWasOff && !off && !Motion.reduced(context)) _keyPulse.forward(from: 0);
    _keyWasOff = off;
    _publish(off && hero is MoveHero ? _moveOf(hero) : null);
    _judgeCue();
  }

  /// Whether any text of [card] sits in the horizontal strip [from]..[to] (y in [stack]'s space).
  bool _wordsIn(RenderObject? card, RenderBox stack, double from, double to) {
    if (card == null) return false;
    var found = false;
    void visit(RenderObject node) {
      if (found) return;
      if (node is RenderParagraph && node.attached && node.hasSize) {
        final y = node.localToGlobal(Offset.zero, ancestor: stack).dy;
        if (y < to && y + node.size.height > from) found = true;
        return;
      }
      node.visitChildren(visit);
    }

    visit(card);
    return found;
  }

  /// The cue shows only while the road is wholly below the first screen's bar line, nothing has
  /// been scrolled, the hero has settled and no capsule stands above the bar.
  void _judgeCue() {
    if (_cueDone) {
      _moreCue.value = false;
      return;
    }
    if (_scroll.hasClients && _scroll.offset > 24) {
      _cueDone = true;
      _moreCue.value = false;
      return;
    }
    if (widget.view.road == null || widget.view.hero == null || _published != null) {
      _moreCue.value = false;
      return;
    }
    final stack = _stackKey.currentContext?.findRenderObject();
    final road = _roadKey.currentContext?.findRenderObject();
    if (stack is! RenderBox || !stack.attached || !stack.hasSize) return;
    var below = true;
    if (road is RenderBox && road.attached && road.hasSize) {
      final top = road.localToGlobal(Offset.zero, ancestor: stack).dy;
      below = top > stack.size.height - _barTop - 24;
    }
    _moreCue.value = below;
  }

  /// The cue's tap: the page glides to the road's heading, just under the status bar.
  Future<void> _toRoad() async {
    _cueDone = true;
    _moreCue.value = false;
    if (!_scroll.hasClients) return;
    final duration = Motion.of(context, Motion.emphasizedDuration);
    final top = MediaQuery.paddingOf(context).top;
    // A road far below may not be built yet: first bring it near, then settle on it.
    if (_roadKey.currentContext == null) {
      final p = _scroll.position;
      await _glide(math.min(p.maxScrollExtent, p.pixels + p.viewportDimension * 0.8), duration, Motion.out);
      // Without motion the jump is instant and nothing has been laid out yet: wait for the frame
      // that builds the road, or the tap would stop short of it.
      await WidgetsBinding.instance.endOfFrame;
    }
    final box = _roadKey.currentContext?.findRenderObject();
    if (!mounted || box is! RenderBox || !_scroll.hasClients) return;
    final reveal = RenderAbstractViewport.of(box).getOffsetToReveal(box, 0).offset - top - MmSpace.s8;
    final p = _scroll.position;
    await _glide(reveal.clamp(p.minScrollExtent, p.maxScrollExtent), duration, Motion.emphasized);
  }

  /// A glide, or a plain jump when motion is off (a scroll animation may not be zero length).
  Future<void> _glide(double to, Duration duration, Curve curve) {
    if (duration <= Duration.zero) {
      _scroll.jumpTo(to);
      return Future<void>.value();
    }
    return _scroll.animateTo(to, duration: duration, curve: curve);
  }

  /// Where the primary key is right now (global), or null when it is not laid out: the capsule
  /// asks for it when it arrives and again when it leaves, since the page may have scrolled.
  Rect? _keyRectNow() {
    final box = _primaryKey.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero) & box.size;
  }

  /// Only a real move rides the bar as tonight's move: one whose key opens something. The error
  /// card (Try again) is not a move, and as a capsule it read as
  /// a suggestion with a Start key that only re-ran the failed read (owner test 15 Oct: "I'm
  /// clicking Start, nothing is happening").
  bool _pinnable(TodayHero? hero) =>
      hero is MoveHero &&
      hero.state != NextMoveState.historyUnavailable &&
      hero.primary.target is GoTo &&
      !(widget.view.offline && hero.primary.startsSession);

  /// "Accountancy repair, 15 min", starting the same action as the card's key.
  BarMove _moveOf(MoveHero hero) {
    final kind = hero.primary.actionType;
    final subject = hero.subjectLine;
    final title = subject != null && kind != null && kind != 'resume' ? '$subject $kind' : hero.summary;
    final minutes = hero.selectedMinutes ?? (hero.durations.isEmpty ? null : hero.durations.first.minutes);
    final primary = hero.primary;
    return BarMove(
      title: title,
      detail: minutes == null ? null : '$minutes min',
      label: primary.label,
      onStart: () => widget.callbacks.onAction(primary),
      originRect: _lastKeyRect,
      originNow: _keyRectNow,
    );
  }

  void _publish(BarMove? move) {
    final slot = _bar?.tonightMove;
    if (slot == null) return;
    if (move == null) {
      if (_published != null && identical(slot.value, _published)) slot.value = null;
      _published = null;
      return;
    }
    if (_published == move && identical(slot.value, _published)) return;
    _published = move;
    slot.value = move;
  }

  /// The hero, and a change of hero kind (the skeleton giving way, a sealed result opened, a paper
  /// resumed and finished) as one overlap on the shared rule: the new card rises in as the old one
  /// goes, and the page below eases to the new height. A change inside one kind (a chip, a
  /// refresh) updates the card in place.
  Widget _heroSwap() {
    final kind = widget.view.hero?.runtimeType;
    _noteHeroKind(kind);
    return MmSizeEase(
      duration: Motion.card,
      curve: Motion.out,
      alignment: Alignment.topCenter,
      clipBehavior: Clip.none,
      child: MmOverlapSwitcher.rise(
        child: KeyedSubtree(key: ValueKey<String>('today-hero:$kind'), child: _hero()),
      ),
    );
  }

  Widget _hero() {
    final hero = widget.view.hero;
    final cb = widget.callbacks;
    return switch (hero) {
      null => TodaySkeleton(delay: widget.skeletonDelay),
      MoveHero() => MoveHeroCard(
          key: _moveKey,
          move: hero,
          offline: widget.view.offline,
          retrying: widget.retrying,
          mobiController: widget.mobiController,
          primaryKey: _primaryKey,
          controlsKey: _controlsKey,
          onAction: cb.onAction,
          onMinutes: cb.onMinutes == null ? null : _minutes,
          keyPulse: _keyPulse,
          onShowMe: hero.evidenceId == null || cb.onShowMe == null ? null : () => cb.onShowMe!(hero.evidenceId!),
        ),
      SealedHero() => SealedHeroCard(
          sealed: hero,
          onOpen: () => cb.onAction(TodayAction('', GoTo(AppRoutes.resultSealed(hero.attemptId)))),
          onOpenDirectly: () => cb.onAction(TodayAction('', GoTo(AppRoutes.result(hero.attemptId)))),
        ),
      ResumeHero() => ResumeHeroCard(
          resume: hero,
          onContinue: () => cb.onAction(TodayAction('', GoTo(AppRoutes.run(hero.sessionId)), actionType: 'resume')),
        ),
      EndedHero() => EndedHeroCard(
          ended: hero,
          onAction: cb.onAction,
          retrying: widget.retrying,
          demoteAction: widget.view.also.any((s) => s.lead),
        ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final padding = MediaQuery.paddingOf(context);
    final view = widget.view;
    final callbacks = widget.callbacks;
    final insights = widget.insights;
    final roadFooter = widget.roadFooter;
    // The shell lifts a tab root's bottom padding by the bar's clearance (MmBarInsets).
    final bar = MmBarInsets.maybeOf(context);
    _bar = bar != null && bar.showing ? bar : null;
    _barTop = bar == null ? 0 : bar.barTopAbove(padding.bottom);
    _topInset = padding.top;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _measure();
    });
    final hero = _heroSwap();
    final head = <Widget>[
      TodayHeader(
        header: view.header,
        onWeek: callbacks.onWeek,
        aim: view.hero is MoveHero ? _moveKey : null,
        bleed: _bleed,
      ),
      // Header to the first block (SPACING.md 3.1, audit T3): the hero starts high enough that its
      // key is above the bar on a 640 dp phone.
      const SizedBox(height: MmSpace.s16),
      // The hero rises 16 dp and fades over 420 ms from 120 ms (MOTION.md 4.3); its object then
      // scales in place and the number lands at about 660 ms.
      TodayEnter(delay: const Duration(milliseconds: 120), child: KeyedSubtree(key: _heroBoxKey, child: hero)),
    ];
    final after = <Widget>[
      if (view.also.isNotEmpty)
        TodayEnter(
          delay: const Duration(milliseconds: 200),
          child: AlsoSlots(slots: view.also, onAction: callbacks.onAction, offline: view.offline, retrying: widget.retrying),
        ),
      if (insights != null) ...[const SizedBox(height: MmSpace.s16), TodayEnter(delay: const Duration(milliseconds: 220), child: insights)],
      ?widget.weeklyEnding,
      // Section to section: 32, then the section's own hairline rule and heading (audit T8).
      if (view.sheet.isNotEmpty) ...[
        const SizedBox(height: MmSpace.group),
        TodayEnter(delay: const Duration(milliseconds: 240), child: SheetSection(rows: view.sheet, papers: view.papers, trend: view.trend, onOpen: callbacks.onTarget)),
      ],
      if (view.road != null) ...[
        const SizedBox(height: MmSpace.group),
        TodayEnter(
          delay: const Duration(milliseconds: 300),
          child: RoadSection(
            key: _roadKey,
            road: view.road!,
            onChooseColleges: callbacks.onChooseColleges,
            onWeek: callbacks.onWeek,
            onOpen: callbacks.onTarget,
          ),
        ),
        if (roadFooter != null) ...[const SizedBox(height: MmSpace.s16), roadFooter],
      ],
    ];
    // The cue lives in the page, in the gap under the hero (design critic 16 Oct, finding 2): it
    // takes the place of the first block's own leading gap (at least the 32 between sections), so
    // it can never sit over a card, a key or a line, and fading it out never moves the page.
    if (view.road != null && view.hero != null) {
      final cue = MoreBelowSlot(cue: _moreCue, onTap: _toRoad);
      if (after.isNotEmpty && after.first is SizedBox) {
        after[0] = cue;
      } else {
        after.insert(0, cue);
      }
    }
    final children = [...head, ...after];

    // The week rail borrows [_bleed] of the gutter on each side for its 48 dp day columns, so the
    // masthead is the full width of the list and every other block is padded back in by the same
    // amount: nothing drawn moves.
    final padded = <Widget>[
      children.first,
      for (final child in children.skip(1)) Padding(padding: const EdgeInsets.symmetric(horizontal: _bleed), child: child),
    ];

    final scroll = CustomScrollView(
      controller: _scroll,
      // The content never moves on a pull (MOTION.md C10): the platform's clamping physics, with
      // the pull drawn as a ring under the status bar.
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            MmSpace.gutter - _bleed,
            padding.top + MmSpace.s8,
            MmSpace.gutter - _bleed,
            padding.bottom + MmSpace.s32,
          ),
          sliver: TodayEntranceScope(progress: _entrance, child: SliverList.list(children: padded)),
        ),
      ],
    );

    final refresh = callbacks.onRefresh;
    return ColoredBox(
      color: colors.ground,
      child: Stack(
        key: _stackKey,
        children: [
          // The lamp in the corner of the room, behind the top row and the hero.
          Positioned(left: 0, right: 0, top: 0, height: 520, child: IgnorePointer(child: LightField.lamp(context, strength: 0.9))),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: refresh == null
                  ? scroll
                  // The app's own pull (C10): changed numbers roll from the values they showed, and
                  // the page's entrance never replays (it belongs to the page, not to the data).
                  // No stretch either: the ring is the only thing that answers the pull.
                  : MmPullRefresh(
                      onRefresh: _refresh,
                      child: ScrollConfiguration(behavior: ScrollConfiguration.of(context).copyWith(overscroll: false), child: scroll),
                    ),
            ),
          ),
          // A stronger veil under the status bar than the shell's tint alone (owner test 15 Oct:
          // "it can be made a bit stronger"): the page blurs as it passes under the clock.
          if (padding.top > 0)
            Positioned(left: 0, right: 0, top: 0, height: padding.top + 20, child: IgnorePointer(child: TodayTopVeil(solidTo: padding.top))),
        ],
      ),
    );
  }

}

/// The page under the status bar: a blur that is full under the clock and fades out over the
/// next 20 dp, with the ground's tint over it. Lite and Off glass keep a denser tint, no blur.
class TodayTopVeil extends StatelessWidget {
  const TodayTopVeil({super.key, required this.solidTo});

  final double solidTo;

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    final blur = GlassScope.of(context) == GlassQuality.full;
    final tint = LayoutBuilder(
      builder: (context, box) {
        final stop = box.maxHeight <= 0 ? 0.0 : (solidTo / box.maxHeight).clamp(0.0, 1.0);
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0, stop, 1],
              colors: [ground.withValues(alpha: blur ? 0.72 : 0.94), ground.withValues(alpha: blur ? 0.6 : 0.82), ground.withValues(alpha: 0)],
            ),
          ),
        );
      },
    );
    if (!blur) return tint;
    return Stack(
      fit: StackFit.expand,
      children: [
        // Full blur to the bottom of the status bar, then a lighter band, so the edge is soft.
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: solidTo,
          child: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14), child: const SizedBox.expand())),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: solidTo,
          bottom: 8,
          child: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 5, sigmaY: 5), child: const SizedBox.expand())),
        ),
        tint,
      ],
    );
  }
}

/// The gap under the hero, holding the "more below" cue centred in it. Always [MmSpace.group]
/// tall, shown or not, so the page never moves when the cue comes or goes.
class MoreBelowSlot extends StatelessWidget {
  const MoreBelowSlot({super.key, required this.cue, required this.onTap});

  final ValueListenable<bool> cue;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: MmSpace.group,
    child: Center(
      child: ValueListenableBuilder<bool>(
        valueListenable: cue,
        builder: (context, shown, _) => MoreBelowCue(shown: shown, onTap: onTap),
      ),
    ),
  );
}

/// A small pill, "Your road to May" with a down chevron, in the gap under the hero while the road
/// is still below the first screen. Its chevron bobs gently three times when it arrives (not
/// under reduced motion), it fades away once the page is scrolled, and its tap glides the page to
/// the road. 24 dp to see (it sits inside the 32 dp gap), 48 dp to touch.
class MoreBelowCue extends StatefulWidget {
  const MoreBelowCue({super.key, required this.shown, required this.onTap});

  final bool shown;
  final VoidCallback onTap;

  /// The pill's drawn height.
  static const double height = 24;

  @override
  State<MoreBelowCue> createState() => _MoreBelowCueState();
}

class _MoreBelowCueState extends State<MoreBelowCue> with SingleTickerProviderStateMixin {
  late final AnimationController _bob = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));
  int _bobs = 0;

  @override
  void initState() {
    super.initState();
    _bob.addStatusListener((status) {
      if (status != AnimationStatus.completed || !mounted) return;
      if (++_bobs < 3 && widget.shown) _bob.forward(from: 0);
    });
    if (widget.shown) WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  void _start() {
    if (!mounted || Motion.reduced(context) || _bob.isAnimating) return;
    _bobs = 0;
    _bob.forward(from: 0);
  }

  @override
  void didUpdateWidget(MoreBelowCue old) {
    super.didUpdateWidget(old);
    if (widget.shown && !old.shown) _start();
    if (!widget.shown) _bob.stop();
  }

  @override
  void dispose() {
    _bob.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = widget.shown;
    return IgnorePointer(
      ignoring: !shown,
      child: AnimatedOpacity(
        opacity: shown ? 1 : 0,
        duration: Motion.of(context, shown ? Motion.card : const Duration(milliseconds: 160)),
        curve: Motion.out,
        child: AnimatedSlide(
          offset: shown ? Offset.zero : const Offset(0, 0.25),
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          // The touch box owns the node, so TalkBack gets the pill's width and the full 48 dp.
          child: MmHitSlop.toTarget(
            visual: MoreBelowCue.height,
            child: Semantics(
              button: true,
              label: TodayCopy.moreBelow,
              excludeSemantics: true,
              child: MmPressable(
                onTap: widget.onTap,
                builder: (context, pressed, focused) => Container(
                  height: MoreBelowCue.height,
                  padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s8),
                  // No alignment: a Container with one fills the gap's whole width, and the cue
                  // would stretch edge to edge. The row centres its own children in the 24 dp.
                  // No outline either: a 1 px stroke around 13 sp text is more pixels than the
                  // words, and the contrast check then measures the stroke instead of them.
                  decoration: ShapeDecoration(
                    color: pressed ? colors.raised2 : null,
                    shape: const StadiumBorder(),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(TodayCopy.moreBelow, style: type.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
                      const SizedBox(width: MmSpace.s4),
                      AnimatedBuilder(
                        animation: _bob,
                        builder: (context, child) {
                          // One soft drop and return per bob.
                          final y = math.sin(_bob.value * math.pi) * 2;
                          return Transform.translate(offset: Offset(0, y), child: child);
                        },
                        child: Icon(LucideIcons.chevronDown, size: 16, color: colors.isNight ? colors.volt : colors.accentText),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
