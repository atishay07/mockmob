import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter/scheduler.dart' show SchedulerBinding, SchedulerPhase;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_state.dart';
import '../haptics/haptics.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import '../widgets/bar/bar_badges.dart';
import '../widgets/bar/bar_insets.dart';
import '../widgets/bar/bar_live.dart';
import '../widgets/bar/live_capsule.dart';
import '../widgets/bar/mm_bar.dart';
import '../widgets/bar/morph_sheet_route.dart';
import 'quick_start.dart';
import 'routes.dart';

/// Published when the student taps the tab they are already on, so that tab's screen can scroll
/// to the top. A fresh [serial] marks a new tap.
class TabReselectEvent {
  const TabReselectEvent(this.tabIndex, this.serial);

  final int tabIndex;
  final int serial;
}

class TabReselect extends Notifier<TabReselectEvent?> {
  int _serial = 0;

  @override
  TabReselectEvent? build() => null;

  void reselected(int tabIndex) => state = TabReselectEvent(tabIndex, ++_serial);
}

final tabReselectProvider = NotifierProvider<TabReselect, TabReselectEvent?>(TabReselect.new);

/// The scaffold around the four tab branches (Today, Practice, Review, You), built to
/// docs/brain/ui-phase2/DOCK.md: content runs under the floating glass bar, inside one
/// `BackdropGroup` so the bar and the live capsule share a single backdrop snapshot. Tab roots get
/// the bar's clearance added to their bottom padding through `MediaQuery` (and [MmBarInsets]),
/// so lists and `SafeArea`s clear it without changes.
///
/// The bar collapses after 24 dp of downward drag-scrolling and comes back on 8 dp up, at either
/// end of the page, on a tab change, a new location or the keyboard closing; never on idle. It
/// slides away under the keyboard and recedes with the shell under a pushed page.
///
/// The back rule: back from any tab goes to Today, then exits.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  /// Whether the bar's first appearance has played in this run (once per cold start).
  static bool entrancePlayed = false;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> with TickerProviderStateMixin implements StartDragTarget {
  final ValueNotifier<bool> _compact = ValueNotifier(false);

  /// Tonight's move, published by Today while its hero key is off-screen.
  final ValueNotifier<BarMove?> _tonightMove = ValueNotifier(null);
  double _down = 0;
  double _up = 0;
  String? _location;
  bool _keyboardWasOpen = false;
  late final bool _entrance;

  /// 0 shown, 1 hidden under the keyboard.
  /// The bar's collapse for the capsule (it sinks and fades as the bar collapses).
  late final AnimationController _collapse = AnimationController(vsync: this);

  late final AnimationController _keyboard = AnimationController(vsync: this, duration: const Duration(milliseconds: 300), reverseDuration: const Duration(milliseconds: 300));

  // The short-lived states laid over the steady capsule.
  BarLive? _transient;
  Timer? _transientTimer;
  Timer? _minute;
  String? _sendingPaper;
  bool _wasOffline = false;

  MorphSheetRoute<void>? _dragRoute;

  StatefulNavigationShell get shell => widget.shell;

  @override
  void initState() {
    super.initState();
    _entrance = !AppShell.entrancePlayed;
    AppShell.entrancePlayed = true;
    _compact.addListener(_compactChanged);
    _tonightMove.addListener(_moveChanged);
  }

  /// Today publishes from a post-frame callback (safe to rebuild at once) and clears its move
  /// when it is disposed, mid-frame; that change waits for the frame to end.
  void _moveChanged() {
    if (!mounted) return;
    if (SchedulerBinding.instance.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() {});
      });
    } else {
      setState(() {});
    }
  }

  void _compactChanged() {
    if (Motion.reduced(context)) {
      _collapse.value = _compact.value ? 1 : 0;
    } else if (_compact.value) {
      _collapse.animateTo(1, duration: const Duration(milliseconds: 240), curve: Motion.emphasized);
    } else {
      _collapse.animateTo(0, duration: Motion.glideDuration, curve: Motion.glide);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // A new location (a deep link, a pop back to a tab) brings the bar back to full size.
    final location = GoRouterState.of(context).uri.toString();
    if (_location != null && location != _location) _expand();
    _location = location;

    final keyboard = MediaQuery.viewInsetsOf(context).bottom > 0;
    if (keyboard != _keyboardWasOpen) {
      _keyboardWasOpen = keyboard;
      if (Motion.reduced(context)) {
        _keyboard.value = keyboard ? 1 : 0;
      } else if (keyboard) {
        _keyboard.animateTo(1, duration: Motion.exitDuration, curve: Motion.exit);
      } else {
        _keyboard.animateTo(0, duration: Motion.glideDuration, curve: Motion.glide);
        _expand();
      }
    }
  }

  @override
  void dispose() {
    _compact.dispose();
    _tonightMove.dispose();
    _collapse.dispose();
    _keyboard.dispose();
    _transientTimer?.cancel();
    _minute?.cancel();
    super.dispose();
  }

  void _expand() {
    _down = 0;
    _up = 0;
    _compact.value = false;
  }

  // Tabs.

  void _onTab(int branch) {
    if (branch != shell.currentIndex) {
      _expand();
      shell.goBranch(branch);
      return;
    }
    // Re-tap: scroll to top at the tab root; deeper in the branch, pop to its root.
    final location = GoRouterState.of(context).uri.path;
    if (location != AppRoutes.tabRoots[branch]) {
      shell.goBranch(branch, initialLocation: true);
    } else {
      ref.read(tabReselectProvider.notifier).reselected(branch);
    }
  }

  // Start.

  MorphSheetRoute<void> _sheetRoute(Rect origin, {bool interactive = false}) => MorphSheetRoute<void>(
    origin: origin,
    scrim: context.mmColors.sheetScrim,
    reduced: Motion.reduced(context),
    interactive: interactive,
    semanticsLabel: 'Quick start',
    builder: (context) => const QuickStartSheet(),
  );

  void _onStart(Rect origin) {
    unawaited(Navigator.of(context, rootNavigator: true).push(_sheetRoute(origin)));
  }

  @override
  void begin(Rect origin) {
    final route = _sheetRoute(origin, interactive: !Motion.reduced(context));
    _dragRoute = route;
    unawaited(Navigator.of(context, rootNavigator: true).push(route));
  }

  @override
  void update(double progress) => _dragRoute?.dragTo(progress);

  @override
  void end({required bool open}) {
    final route = _dragRoute;
    _dragRoute = null;
    route?.settle(open: open);
  }

  // Scrolling.

  bool _onScroll(ScrollNotification n) {
    if (n.metrics.axis != Axis.vertical) return false;
    if (n is UserScrollNotification) {
      GlassActivity.userScrolling = n.direction != ScrollDirection.idle;
      return false;
    }
    if (n is! ScrollUpdateNotification) return false;
    final m = n.metrics;
    // At either end of the page the bar is always full size.
    if (m.pixels <= m.minScrollExtent || m.pixels >= m.maxScrollExtent) {
      _expand();
      return false;
    }
    // Only the student's own drag moves it, never a settle or an idle page.
    if (n.dragDetails == null) return false;
    final delta = n.scrollDelta ?? 0;
    if (delta > 0) {
      _up = 0;
      _down += delta;
      if (_down >= 24) _compact.value = true;
    } else if (delta < 0) {
      _down = 0;
      _up -= delta;
      if (_up >= 8) _compact.value = false;
    }
    return false;
  }

  // The capsule.

  /// Saved after the server's 200 (3 s), Synced after the offline queue drains (2 s).
  void _watchTransitions() {
    ref.listen<String?>(barSendingInputProvider, (previous, next) {
      if (next != null) {
        _sendingPaper = next;
        return;
      }
      final paper = _sendingPaper;
      _sendingPaper = null;
      // The submit is no longer in flight. It was received only if a result is now waiting.
      if (previous != null && paper != null && ref.read(barMarkedInputProvider) != null) {
        _showTransient(BarSaved(at: DateTime.now(), paper: paper), const Duration(seconds: 3));
        if (ModalRoute.of(context)?.isCurrent ?? true) unawaited(ref.read(hapticsProvider).success());
      }
    });
    ref.listen<int?>(barOfflineInputProvider, (previous, next) {
      final offline = next != null;
      if (_wasOffline && !offline && ref.read(barSendingInputProvider) == null) {
        _showTransient(const BarSynced(), const Duration(seconds: 2));
      }
      _wasOffline = offline;
    });
  }

  void _showTransient(BarLive live, Duration hold) {
    _transientTimer?.cancel();
    setState(() => _transient = live);
    _transientTimer = Timer(hold, () {
      if (mounted) setState(() => _transient = null);
    });
  }

  /// The Resume capsule's countdown repaints once a minute, never every second.
  void _keepMinute(BarLive? live) {
    final timed = live is BarResume && live.endsAt != null;
    if (timed && _minute == null) {
      _minute = Timer.periodic(const Duration(minutes: 1), (_) {
        if (mounted) ref.read(barMinuteProvider.notifier).tick(DateTime.now());
      });
    } else if (!timed && _minute != null) {
      _minute?.cancel();
      _minute = null;
    }
  }

  void _onCapsuleAction(BarLive live) {
    final router = GoRouter.of(context);
    switch (live) {
      case BarMarked(:final attemptId):
        unawaited(router.push<void>(AppRoutes.resultSealed(attemptId)));
      case BarResume(:final sessionId):
        unawaited(router.push<void>(AppRoutes.run(sessionId)));
      case BarMove(:final onStart):
        onStart();
      case BarSending() || BarSaved() || BarOffline() || BarSynced():
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    _watchTransitions();
    final media = MediaQuery.of(context);
    final screen = media.size;
    final geo = BarGeometry(screen.width);

    final steady = ref.watch(barLiveProvider);
    _keepMinute(steady);
    final live = visibleLive(
      _transient ?? steady,
      dismissed: ref.watch(barDismissalsProvider),
      todayCovers: ref.watch(todayHeroCoversProvider),
      onToday: shell.currentIndex == 0,
      move: _tonightMove.value,
    );
    final capsuleUp = live != null;
    final keyboard = media.viewInsets.bottom > 0;
    final clearance = keyboard ? 0.0 : MmBarInsets.clearanceFor(capsule: capsuleUp);

    final content = MmBarInsets(
      showing: !keyboard,
      capsule: capsuleUp,
      tonightMove: _tonightMove,
      child: MediaQuery(
        data: media.copyWith(
          padding: media.padding.copyWith(bottom: media.padding.bottom + clearance),
          viewPadding: media.viewPadding.copyWith(bottom: media.viewPadding.bottom + clearance),
        ),
        child: NotificationListener<ScrollNotification>(onNotification: _onScroll, child: shell),
      ),
    );

    // While a sheet or dialog covers the shell, the bar stops blurring: it sits under the
    // sheet's scrim, so a live blur there would cost frames for nothing.
    final covered = !(ModalRoute.of(context)?.isCurrent ?? true);
    final quality = covered ? GlassQuality.lite : null;
    final name = ref.watch(authSnapshotProvider.select((a) => a.name))?.trim();
    final initial = name == null || name.isEmpty ? null : name.characters.first.toUpperCase();
    final resume = ref.watch(barResumeInputProvider);

    final bar = MmBottomBar(
      currentBranch: shell.currentIndex,
      onTab: _onTab,
      onStart: _onStart,
      startDrag: this,
      badges: ref.watch(barBadgesProvider),
      compact: _compact,
      entrance: _entrance,
      youInitial: initial,
      quality: quality,
      startResumeLabel: resume == null ? null : 'Resume ${resume.paper}',
      startResumeId: resume?.sessionId,
      onStartResume: resume == null ? null : () => unawaited(GoRouter.of(context).push<void>(AppRoutes.run(resume.sessionId))),
    );

    final capsule = LiveCapsule(
      live: live,
      width: geo.width - 32,
      collapse: _collapse,
      quality: quality,
      onAction: _onCapsuleAction,
      onDismiss: (l) => ref.read(barDismissalsProvider.notifier).dismiss(l.identity),
    );

    final barBottom = media.viewPadding.bottom + MmBar.lift;
    // The bar leaves with the shell under a pushed page (driven by the route, so predictive back
    // scrubs it with the finger) and slides away under the keyboard.
    final secondary = ModalRoute.of(context)?.secondaryAnimation ?? kAlwaysDismissedAnimation;
    final reduced = Motion.reduced(context);
    Widget leaving(Widget child) => AnimatedBuilder(
      animation: Listenable.merge([secondary, _keyboard]),
      builder: (context, child) {
        // MOTION.md C6: the bar is gone over the first half of the push (before the page has
        // arrived) and comes back over the last half of the pop. Reduced motion: instant.
        final s = secondary.value.clamp(0.0, 1.0);
        final away = reduced ? (s > 0 ? 1.0 : 0.0) : Motion.glide.transform((s / 0.5).clamp(0.0, 1.0));
        final hide = _keyboard.value;
        final out = (away + hide).clamp(0.0, 1.0);
        return IgnorePointer(
          ignoring: hide > 0.5,
          child: Opacity(
            opacity: 1 - out,
            child: Transform.translate(offset: Offset(0, 24 * out), child: child),
          ),
        );
      },
      child: child,
    );

    return PopScope(
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(0);
      },
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        body: BackdropGroup(
          child: Stack(
            children: [
              Positioned.fill(child: content),
              // The ground under the status bar, so a scrolled page never reads through the
              // clock and icons.
              if (media.viewPadding.top > 0)
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: media.viewPadding.top + 14,
                  child: IgnorePointer(child: StatusScrim(solidTo: media.viewPadding.top)),
                ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: BarScrim.heightFor(media.viewPadding.bottom, capsule: capsuleUp),
                child: IgnorePointer(
                  child: leaving(RepaintBoundary(child: BarScrim(bottomInset: media.viewPadding.bottom, capsule: capsuleUp))),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: barBottom + MmBar.height + MmBar.capsuleGap - 2,
                child: leaving(Center(child: capsule)),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: barBottom,
                child: leaving(Center(child: RepaintBoundary(child: bar))),
              ),
            ],
          ),
        ),
      ),
    );
  }

}

/// The ground behind the status bar: solid down to [solidTo], then a short fade.
class StatusScrim extends StatelessWidget {
  const StatusScrim({super.key, required this.solidTo});

  final double solidTo;

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return LayoutBuilder(
      builder: (context, box) {
        final stop = box.maxHeight <= 0 ? 0.0 : (solidTo / box.maxHeight).clamp(0.0, 1.0);
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0, stop * 0.6, stop, 1],
              colors: [ground.withValues(alpha: 0.9), ground.withValues(alpha: 0.85), ground.withValues(alpha: 0.6), ground.withValues(alpha: 0)],
            ),
          ),
        );
      },
    );
  }
}
