// The Today tab (design spec 5.3, Night Sheet brief 12): "What do I do with the time I have?"
// Watches the composed view, turns taps into navigation, and keeps the record fresh: on open the
// repositories read once; pull to refresh and Try again read again; never on a timer.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import '../../../core/connectivity/connectivity_providers.dart' show networkStatusProvider;
import '../../../core/motion/motion.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/app_shell.dart';
import '../../../core/router/routes.dart';
import '../../../core/widgets/widgets.dart' show MobiAct, MobiController;
import '../../review/revise/revise_data.dart' show reviseCapProvider;
import '../../rhythm/rhythm.dart';
import '../../tools/compass/compass_controller.dart' show compassControllerProvider;
import '../../tools/data/my_colleges_actions.dart' show MyCollegesStatus, myCollegesActionsProvider, myCollegesProvider;
import '../../tools/my_colleges/my_colleges_sheet.dart' show showMyCollegesSheet;
import '../data/road_plan.dart' show roadPlanProvider;
import '../data/today_providers.dart';
import '../logic/today_model.dart';
import '../logic/visit_latch.dart';
import '../widgets/colleges_card.dart' show CollegesCardInfo, CollegesCardStatus;
import '../widgets/road_section.dart' show RoadActions;
import '../widgets/today_celebration.dart';
import 'today_body.dart';

class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key});

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
    _lifecycle = AppLifecycleListener(onResume: () {
      ref.read(todayClockProvider.notifier).refresh();
      if (_failing) _retrySoon();
      if (mounted) setState(_newVisit);
    });
    // A result submitted in the background is in the cache but not in a live list: read the
    // attempts again when one is waiting to be opened.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final waiting = ref.read(unopenedResultsProvider).value?.isNotEmpty ?? false;
      if (waiting) unawaited(ref.read(attemptsRepositoryProvider.notifier).refresh(force: true));
    });
  }

  /// L03: the weekly ending card (it waits on the rhythm read) shows only if it is known before
  /// the page settles, a second after the hero paints; one that lands later waits for the next
  /// visit (see [VisitLatch]).
  static const Duration _settleAfter = Duration(seconds: 1);
  final VisitLatch _ending = VisitLatch();
  Timer? _settle;
  bool _inFront = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The shell turns tickers off for tabs not in front: coming back on is a new visit.
    final front = TickerMode.valuesOf(context).enabled;
    if (front && !_inFront) _newVisit();
    _inFront = front;
  }

  void _newVisit() {
    _settle?.cancel();
    _settle = null;
    _ending.newVisit();
  }

  bool _endingFor({required bool has, required bool painted}) {
    if (painted && !_ending.settled && _settle == null) {
      _settle = Timer(_settleAfter, () {
        if (mounted) setState(_ending.settle);
      });
    }
    return _ending.decide(has: has);
  }

  @override
  void dispose() {
    _settle?.cancel();
    _lifecycle.dispose();
    _autoRetry?.cancel();
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
        _noteTry();
      }
    }
  }

  /// The card is the failure card (nothing in hand to build a move from).
  bool get _failing {
    final hero = ref.read(todayViewProvider).hero;
    return (hero is MoveHero && hero.primary.target is RetryLoad) || (hero is EndedHero && hero.action.target is RetryLoad);
  }

  /// After a Try again the card says what happened in its own words: "Tried again at 10:41 PM.
  /// Still not loading." The time changes on every tap, so a repeated tap visibly ran (L01; the
  /// 5-second snackbar is retired). Once the record is in hand the line is cleared.
  void _noteTry() {
    final tried = ref.read(todayLastTriedProvider.notifier);
    // The failure card, or the header's "Could not refresh" line (S7), says when it last tried.
    final still = _failing || ref.read(todayViewProvider).header.refreshable;
    tried.set(still ? ref.read(nowProvider)() : null);
  }

  /// What the Your colleges card knows beyond the road: the shared list's state, and what the
  /// student's subjects open in Compass (once the DU data is on the phone).
  CollegesCardInfo _collegesInfo() {
    final mine = ref.watch(myCollegesProvider);
    final status = switch (mine.status) {
      MyCollegesStatus.loading => CollegesCardStatus.loading,
      MyCollegesStatus.failed => CollegesCardStatus.failed,
      _ => CollegesCardStatus.ready,
    };
    final compass = ref.watch(compassControllerProvider).value;
    final known = compass != null && !compass.selection.isEmpty;
    return CollegesCardInfo(status: status, open: known ? compass.eligible.length : null, total: known ? compass.total : null);
  }

  /// Back online, or back in front: a failure card tries again by itself, once, a second after
  /// the connection settles, so the student never has to find the key.
  Timer? _autoRetry;

  void _retrySoon() {
    _autoRetry?.cancel();
    _autoRetry = Timer(const Duration(seconds: 1), () {
      if (mounted && _failing) unawaited(_retry());
    });
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
      unawaited(MmScroll.toTop(context, _scroll));
    });
    ref.listen(networkStatusProvider, (previous, next) {
      if (previous == NetworkStatus.offline && next == NetworkStatus.online && _failing) _retrySoon();
    });
    // A plan read that failed while the papers are in hand never reaches the card (L01, S6): it
    // is written to the log, and the move is built from the papers.
    ref.listen(planRepositoryProvider(todayPlanMinutes).select((s) => s.error), (previous, next) {
      if (next != null && ref.read(attemptsRepositoryProvider).value != null) debugPrint('Today: plan read failed, move built from the papers ($next)');
    });
    final view = ref.watch(todayViewProvider);
    final ending = ref.watch(weeklyEndingProvider);
    final hasEnding = _endingFor(has: ending != null, painted: view.hero != null);
    return TodayBody(
      view: view,
      retrying: _retrying,
      controller: _scroll,
      mobiController: _mobi,
      colleges: _collegesInfo(),
      // The week that just closed is a state of the This week row (TODAY-1017 4.3), shown only if
      // it was known before the page settled (L03).
      lastWeek: hasEnding && ending != null ? (ending.studyDays, ending.goal) : null,
      // "Last week" is the week that just closed (rhythm loads a moment after the hero), so it
      // opens into place rather than appearing as a new section that shoves the page down (owner
      // test 15 Oct: Home "added another section").
      weeklyEnding: AnimatedSize(
        duration: Motion.of(context, Motion.card),
        curve: Motion.out,
        alignment: Alignment.topCenter,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // The first repair and the first met week land here, directly under the ending card.
            const TodayCelebration(),
          ],
        ),
      ),
      callbacks: TodayCallbacks(
        onAction: _action,
        onTarget: _target,
        onMinutes: (m) {
          // Revise's length is the Revise screen's own setting (5 or 10 questions a day), so the
          // round the key opens is the size the card showed.
          final hero = ref.read(todayViewProvider).hero;
          if (hero is MoveHero && hero.kind == MoveKind.revise) {
            unawaited(ref.read(reviseCapProvider.notifier).set(m));
          } else {
            ref.read(todayMinutesProvider.notifier).choose(m);
          }
        },
        onShowMe: (id) {
          ref.read(todayActionsProvider).reasonOpened();
          unawaited(context.push(AppRoutes.todayWhy(id)));
        },
        onWeek: () => unawaited(context.push(AppRoutes.todayWeek)),
        onWeeklyEnding: () => unawaited(context.push(AppRoutes.todayWeeklyEnding)),
        // My colleges itself: one sheet over Today (the same list Compass and You read and write).
        // The old route pushed the You sheet page, which stacked a second You inside Today's own
        // branch (owner test 15 Oct), and edited a list Today no longer reads. An empty list opens
        // straight on the chooser.
        onChooseColleges: () {
          final mine = ref.read(myCollegesProvider);
          unawaited(showMyCollegesSheet(context, adding: mine.ready && mine.list.isEmpty));
        },
        onRefresh: () => ref.read(todayActionsProvider).refresh(),
        onCollegesRetry: () => unawaited(ref.read(myCollegesActionsProvider.notifier).retry()),
        road: RoadActions(
          // The goal on the account, then the weekdays, then the phone; it throws on a failed
          // goal save before anything else is written.
          savePace: (days) => ref.read(rhythmActionsProvider).saveStudyDays(days),
          setExamDate: (day) => ref.read(roadPlanProvider.notifier).setExamDate(day),
          setMockTarget: (n) => ref.read(roadPlanProvider.notifier).setMockTarget(n),
        ),
      ),
    );
  }
}
