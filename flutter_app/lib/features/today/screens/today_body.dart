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
import '../widgets/move_keys.dart';
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
    this.avatar = const YouAvatarButton(),
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
  final Widget avatar;

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
  /// out of view (under the dock or below the fold) and the pinned bar should stand in for it.
  final GlobalKey _primaryKey = GlobalKey(debugLabel: 'today-primary');
  final GlobalKey _stackKey = GlobalKey(debugLabel: 'today-stack');
  final ValueNotifier<bool> _pinned = ValueNotifier(false);
  ScrollController? _ownScroll;
  bool _measureQueued = false;

  /// The tab root's dock clearance, set by the shell. Without it (no dock) nothing is pinned.
  double _dockTop = 0;
  bool _hasDock = false;

  ScrollController get _scroll => widget.controller ?? (_ownScroll ??= ScrollController());

  /// How far above the dock's top edge the shell's ground fade (`DockScrim`) reaches. The bar
  /// rests on the fade's top edge: under it, the fade would wash the key out.
  static const double _scrimRise = 48;

  /// Ground kept under the key, down to the dock: the card's own key and its chips pass under
  /// the bar, and the shell's fade alone would leave them half-seen between bar and dock.
  static const double _barPad = _scrimRise;

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
    _pinned.dispose();
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

  /// Pinned when the card's primary key is not wholly above the bar's resting place: partly under
  /// the dock, or past the fold. Where the key's bottom meets that line the bar and the key are
  /// in the same place, so the hand-over does not jump.
  void _measure() {
    final key = _primaryKey.currentContext?.findRenderObject();
    final stack = _stackKey.currentContext?.findRenderObject();
    var pinned = false;
    if (_hasDock && key is RenderBox && stack is RenderBox && key.attached && key.hasSize && stack.attached && stack.hasSize) {
      final bottom = key.localToGlobal(Offset(0, key.size.height), ancestor: stack).dy;
      pinned = bottom > stack.size.height - _dockTop - _scrimRise + 0.5;
    }
    if (_pinned.value != pinned) _pinned.value = pinned;
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
          // Only when the pinned bar can stand in for the card's keys.
          keysCovered: _hasDock && !(widget.view.offline && hero.primary.startsSession) ? _pinned : null,
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
      EndedHero() => EndedHeroCard(ended: hero, onAction: cb.onAction, retrying: widget.retrying),
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
    // The shell lifts a tab root's bottom padding by the dock's clearance; the dock's own top
    // edge is 24 dp lower than that padding (the rest is air for the last row).
    _hasDock = padding.bottom >= MmDock.clearanceAbove;
    _dockTop = padding.bottom - (MmDock.clearanceAbove - MmDock.height - MmDock.lift);
    final hero = view.hero;
    final pinnable = hero is MoveHero && !(view.offline && hero.primary.startsSession);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _measure();
    });
    final children = <Widget>[
      TodayHeader(
        header: view.header,
        onWeek: callbacks.onWeek,
        avatar: widget.avatar,
        aim: view.hero is MoveHero ? _moveKey : null,
      ),
      const SizedBox(height: MmSpace.s24),
      TodayEnter(delay: const Duration(milliseconds: 120), rise: 20, child: _hero()),
      if (view.also.isNotEmpty)
        TodayEnter(
          delay: const Duration(milliseconds: 200),
          child: AlsoSlots(slots: view.also, onAction: callbacks.onAction, offline: view.offline, retrying: widget.retrying),
        ),
      if (insights != null) ...[const SizedBox(height: MmSpace.s16), TodayEnter(delay: const Duration(milliseconds: 220), child: insights)],
      ?widget.weeklyEnding,
      if (view.sheet.isNotEmpty) ...[
        const SizedBox(height: MmSpace.s40),
        TodayEnter(delay: const Duration(milliseconds: 240), child: SheetSection(rows: view.sheet, onOpen: callbacks.onTarget)),
      ],
      if (view.road != null) ...[
        SizedBox(height: view.sheet.isEmpty ? MmSpace.s40 : MmSpace.s32),
        TodayEnter(
          delay: const Duration(milliseconds: 300),
          child: RoadSection(road: view.road!, onChooseColleges: callbacks.onChooseColleges),
        ),
        if (roadFooter != null) ...[const SizedBox(height: MmSpace.s16), roadFooter],
      ],
    ];

    final scroll = CustomScrollView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverPadding(
          padding: EdgeInsets.fromLTRB(
            MmSpace.cardGutter,
            padding.top + MmSpace.s8,
            MmSpace.cardGutter,
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
                  : RefreshIndicator(
                      onRefresh: refresh,
                      color: colors.ink,
                      backgroundColor: colors.raised2,
                      edgeOffset: padding.top,
                      child: scroll,
                    ),
            ),
          ),
          if (_hasDock && pinnable)
            Positioned(
              left: 0,
              right: 0,
              bottom: _dockTop,
              child: ValueListenableBuilder<bool>(
                valueListenable: _pinned,
                builder: (context, pinned, _) => StickyMoveHost(
                  pinned: pinned,
                  builder: (context) => Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                      child: _StickyScrim(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(MmSpace.cardGutter, 0, MmSpace.cardGutter, _barPad),
                          child: StickyMoveBar(move: hero, onAction: callbacks.onAction, retrying: widget.retrying),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

}

/// Ground behind the pinned bar: a short fade in above it, then solid down to the dock. The
/// card's own key (still moving under it) and text scrolling by never read around the bar.
///
/// The ground only paints: it ignores touches, so a drag that starts on the fade or in the air
/// under the keys still scrolls the page. Only the keys themselves take hits.
class _StickyScrim extends StatelessWidget {
  const _StickyScrim({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return Stack(
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: Column(
              children: [
                SizedBox(
                  height: MmSpace.s16,
                  width: double.infinity,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [ground.withValues(alpha: 0), ground]),
                    ),
                  ),
                ),
                Expanded(child: ColoredBox(color: ground, child: const SizedBox(width: double.infinity))),
              ],
            ),
          ),
        ),
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: MmSpace.s16, width: double.infinity),
            SizedBox(width: double.infinity, child: child),
          ],
        ),
      ],
    );
  }
}
