// Today's layout for a given [TodayView]: the warm room (lamp light pooled behind the header),
// the top row, the hero, anything else that is open, the week's ending card, "Your sheet" and
// the road to May. Pure layout: goldens render it from fixtures.
import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../logic/today_model.dart';
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

class _TodayBodyState extends State<TodayBody> with SingleTickerProviderStateMixin {
  /// The move card: the header Mobi points at it.
  final GlobalKey _moveKey = GlobalKey(debugLabel: 'today-move');

  /// The move card's primary key and the stack that holds the page, to tell whether that key is
  /// out of view (under the bar or below the fold). While it is, tonight's move stands in for it
  /// as the bar's live capsule (MOTION.md 5.1): one thing floats above the bar, never two.
  final GlobalKey _primaryKey = GlobalKey(debugLabel: 'today-primary');
  final GlobalKey _stackKey = GlobalKey(debugLabel: 'today-stack');
  ScrollController? _ownScroll;
  bool _measureQueued = false;

  /// The shell's bar, or null outside it (then nothing is published).
  MmBarInsets? _bar;

  /// The bar's top edge above the screen's bottom, measured from the expanded bar.
  double _barTop = 0;

  /// The move this page published to the capsule, so it clears only its own.
  BarMove? _published;

  ScrollController get _scroll => widget.controller ?? (_ownScroll ??= ScrollController());

  /// Today's one page-load moment (ui-blitz/today.md 2.6). It runs only when the first build
  /// already has data (the usual open, painted from cache); a page that loads behind the
  /// skeleton appears in place, so the masthead never fades out and back in.
  late final AnimationController _entrance = AnimationController(vsync: this, duration: todayEntranceDuration);
  bool _entranceDecided = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_queueMeasure);
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
  }

  @override
  void dispose() {
    _scroll.removeListener(_queueMeasure);
    _ownScroll?.dispose();
    _publish(null);
    _entrance.dispose();
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

  /// The move goes to the capsule when the card's primary key is not wholly above the place the
  /// capsule takes over the bar: partly under the bar or the capsule, or past the fold. The line
  /// is measured from the bar, not from the capsule, so the capsule arriving never moves it.
  void _measure() {
    final hero = widget.view.hero;
    final key = _primaryKey.currentContext?.findRenderObject();
    final stack = _stackKey.currentContext?.findRenderObject();
    var off = false;
    if (_bar != null && _pinnable(hero) && key is RenderBox && stack is RenderBox && key.attached && key.hasSize && stack.attached && stack.hasSize) {
      final bottom = key.localToGlobal(Offset(0, key.size.height), ancestor: stack).dy;
      off = bottom > stack.size.height - _barTop - MmBar.capsuleClearance + 0.5;
    }
    _publish(off && hero is MoveHero ? _moveOf(hero) : null);
  }

  bool _pinnable(TodayHero? hero) =>
      hero is MoveHero && !(widget.view.offline && hero.primary.startsSession) && !(widget.retrying && hero.primary.target is RetryLoad);

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
          onAction: cb.onAction,
          onMinutes: cb.onMinutes,
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _measure();
    });
    final children = <Widget>[
      TodayHeader(
        header: view.header,
        onWeek: callbacks.onWeek,
        aim: view.hero is MoveHero ? _moveKey : null,
      ),
      // Header to the first block (SPACING.md 3.1, audit T3): the hero starts high enough that its
      // key is above the bar on a 640 dp phone.
      const SizedBox(height: MmSpace.s16),
      TodayEnter(delay: const Duration(milliseconds: 120), rise: 20, child: _hero()),
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
        TodayEnter(delay: const Duration(milliseconds: 240), child: SheetSection(rows: view.sheet, onOpen: callbacks.onTarget)),
      ],
      if (view.road != null) ...[
        const SizedBox(height: MmSpace.group),
        TodayEnter(
          delay: const Duration(milliseconds: 300),
          child: RoadSection(road: view.road!, onChooseColleges: callbacks.onChooseColleges),
        ),
        if (roadFooter != null) ...[const SizedBox(height: MmSpace.s16), roadFooter],
      ],
    ];

    final scroll = CustomScrollView(
      controller: _scroll,
      // The content never moves on a pull (MOTION.md C10): the platform's clamping physics, with
      // the pull drawn as a ring under the status bar.
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            MmSpace.gutter,
            padding.top + MmSpace.s8,
            MmSpace.gutter,
            padding.bottom + MmSpace.s32,
          ),
          sliver: TodayEntranceScope(progress: _entrance, child: SliverList.list(children: children)),
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
                  : MmPullRefresh(onRefresh: refresh, child: scroll),
            ),
          ),
        ],
      ),
    );
  }

}
