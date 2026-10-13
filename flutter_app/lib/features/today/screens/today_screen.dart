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
import '../../rhythm/rhythm.dart';
import '../data/today_providers.dart';
import '../logic/today_model.dart';
import 'today_body.dart';

class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key});

  @override
  ConsumerState<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends ConsumerState<TodayScreen> {
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
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
    _scroll.dispose();
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
        unawaited(ref.read(todayActionsProvider).refresh());
      case OpenAlternatives():
        unawaited(context.push(AppRoutes.todayAlternatives));
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
      if (next == null || next.tabIndex != 0 || !_scroll.hasClients) return;
      unawaited(_scroll.animateTo(0, duration: Motion.of(context, Motion.emphasizedDuration), curve: Motion.emphasized));
    });
    final view = ref.watch(todayViewProvider);
    final hasEnding = ref.watch(weeklyEndingProvider) != null;
    return TodayBody(
      view: view,
      controller: _scroll,
      weeklyEnding: hasEnding ? const Padding(padding: EdgeInsets.only(top: 12), child: WeeklyEndingSection()) : null,
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
