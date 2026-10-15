// The Today tab (design spec 5.3, Night Sheet brief 12): "What do I do with the time I have?"
// Watches the composed view, turns taps into navigation, and keeps the record fresh: on open the
// repositories read once; pull to refresh and Try again read again; never on a timer.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth.dart' show LoadProblem;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/app_shell.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart' show MmBar;
import '../../../core/widgets/widgets.dart' show MobiAct, MobiController;
import '../../rhythm/rhythm.dart';
import '../data/today_providers.dart';
import '../logic/today_model.dart';
import '../widgets/today_celebration.dart';
import 'today_body.dart';

class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key, this.insights, this.roadFooter});

  /// The integrator's record finding card (Insights), shown under the hero when given.
  final Widget? insights;

  /// A quiet line under the road to May (the CUET tools link), when given.
  final Widget? roadFooter;

  @override
  ConsumerState<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends ConsumerState<TodayScreen> {
  final ScrollController _scroll = ScrollController();
  final MobiController _mobi = MobiController();
  late final AppLifecycleListener _lifecycle;

  /// A Try again read is running: the key shows it instead of looking dead.
  bool _retrying = false;

  @override
  void initState() {
    super.initState();
    // Back from the background (maybe the next morning): Today's clock, the dismissals and the
    // ended-mock check are read again, so nothing says yesterday's greeting or hidden-until-4 AM.
    _lifecycle = AppLifecycleListener(onResume: () => ref.read(todayClockProvider.notifier).refresh());
    // A result submitted in the background is in the cache but not in a live list: read the
    // attempts again when one is waiting to be opened.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final waiting = ref.read(unopenedResultsProvider).value?.isNotEmpty ?? false;
      if (waiting) unawaited(ref.read(attemptsRepositoryProvider.notifier).refresh(force: true));
    });
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _scroll.dispose();
    _mobi.dispose();
    super.dispose();
  }

  void _go(String location) {
    if (AppRoutes.tabRoots.contains(location)) {
      context.go(location);
    } else {
      unawaited(context.push(location));
    }
  }

  void _target(TodayTarget target) {
    switch (target) {
      case GoTo(:final location):
        _go(location);
      case RetryLoad():
        unawaited(_retry());
      case OpenAlternatives():
        unawaited(context.push(AppRoutes.todayAlternatives));
    }
  }

  /// A read that fails at once (offline, refused) would flip the key back before the eye sees
  /// it, so a tap looked dead. The key keeps its spinner at least this long.
  static const _minTry = Duration(milliseconds: 900);

  Future<void> _retry() async {
    if (_retrying) return;
    setState(() => _retrying = true);
    try {
      await Future.wait([ref.read(todayActionsProvider).refresh(), Future<void>.delayed(_minTry)]);
    } finally {
      if (mounted) {
        setState(() => _retrying = false);
        _sayIfStillFailing();
      }
    }
  }

  /// After a Try again that changed nothing, say what failed in plain words, so the student
  /// knows the tap worked and why the card is the same.
  void _sayIfStillFailing() {
    final hero = ref.read(todayViewProvider).hero;
    final stillFailing = (hero is MoveHero && hero.primary.target is RetryLoad) || (hero is EndedHero && hero.action.target is RetryLoad);
    if (!stillFailing) return;
    final attempts = ref.read(attemptsRepositoryProvider);
    final plan = ref.read(planRepositoryProvider(todayPlanMinutes));
    final LoadProblem problem;
    if (attempts.value == null && attempts.error != null) {
      problem = LoadProblem.of(attempts.error);
    } else if (plan.value?.recordUnavailable ?? false) {
      problem = LoadProblem.record;
    } else {
      problem = LoadProblem.of(plan.error);
    }
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text('Still not loading. ${problem.sentence} ${problem.advice}'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 5),
        // Above the dock, never under it.
        margin: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewPaddingOf(context).bottom + MmBar.lift + MmBar.height + 12),
      ));
  }

  void _action(TodayAction action) {
    if (action.startsSession || action.actionType == 'resume') {
      // The length the card shows, not the raw chip: a stale or unoffered pick is never logged.
      final hero = ref.read(todayViewProvider).hero;
      ref.read(todayActionsProvider).started(action, minutes: hero is MoveHero ? hero.selectedMinutes : null);
    }
    _target(action.target);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(tabReselectProvider, (previous, next) {
      if (next == null || next.tabIndex != 0) return;
      // Coming back to Today: Mobi, when it is on the hero, says hello again.
      final hero = ref.read(todayViewProvider).hero;
      if (hero is MoveHero && hero.art.isMobi) _mobi.play(MobiAct.hello);
      if (!_scroll.hasClients) return;
      unawaited(_scroll.animateTo(0, duration: Motion.of(context, Motion.emphasizedDuration), curve: Motion.emphasized));
    });
    final view = ref.watch(todayViewProvider);
    final hasEnding = ref.watch(weeklyEndingProvider) != null;
    return TodayBody(
      view: view,
      retrying: _retrying,
      controller: _scroll,
      mobiController: _mobi,
      insights: widget.insights,
      roadFooter: widget.roadFooter,
      weeklyEnding: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasEnding) const Padding(padding: EdgeInsets.only(top: 12), child: WeeklyEndingSection()),
          // The first repair and the first met week land here, directly under the ending card.
          const TodayCelebration(),
        ],
      ),
      callbacks: TodayCallbacks(
        onAction: _action,
        onTarget: _target,
        onMinutes: (m) => ref.read(todayMinutesProvider.notifier).choose(m),
        onShowMe: (id) {
          ref.read(todayActionsProvider).reasonOpened();
          unawaited(context.push(AppRoutes.todayWhy(id)));
        },
        onWeek: () => unawaited(context.push(AppRoutes.todayWeek)),
        onChooseColleges: () => unawaited(context.push(AppRoutes.you)),
        onRefresh: () => ref.read(todayActionsProvider).refresh(),
      ),
    );
  }
}
