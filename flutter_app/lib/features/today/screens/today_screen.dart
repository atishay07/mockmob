// The Today tab (design spec 5.3, Night Sheet brief 12): "What do I do with the time I have?"
// Watches the composed view, turns taps into navigation, and keeps the record fresh: on open the
// repositories read once; pull to refresh and Try again read again; never on a timer.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/app_shell.dart';
import '../../../core/router/routes.dart';
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

  Future<void> _retry() async {
    if (_retrying) return;
    setState(() => _retrying = true);
    try {
      await ref.read(todayActionsProvider).refresh();
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  void _action(TodayAction action) {
    if (action.startsSession || action.actionType == 'resume') {
      ref.read(todayActionsProvider).started(action, minutes: ref.read(todayMinutesProvider));
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
