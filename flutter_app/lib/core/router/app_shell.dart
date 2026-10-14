import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../haptics/haptics.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';
import '../widgets/dock/morph_sheet_route.dart';
import '../widgets/dock/split_dock.dart';
import 'quick_start.dart';
import 'routes.dart';

/// True while a locally recorded received result has not been opened (`pending_result`, spec 10).
/// Shows the dot on Review. The default is false; the result module or the app root overrides it.
final reviewDotProvider = Provider<bool>((ref) => false);

/// The open session the dock's Start can resume (its id), or null. A new id makes Start breathe
/// twice. Null by default, so a shell under test never opens the session journal; `main.dart`
/// wires it to [resumeDraftProvider].
final dockResumeKeyProvider = Provider<Object?>((ref) => null);

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

/// The scaffold around the three tab branches (Today, Practice, Review): the content runs under
/// the floating split glass dock, inside one `BackdropGroup` so the dock's panes share a single
/// backdrop snapshot. Tab roots get the dock's height added to their bottom padding through
/// `MediaQuery`, so lists and `SafeArea`s clear it without changes.
///
/// The back rule: back from any tab goes to Today, then exits.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  final ValueNotifier<bool> _compact = ValueNotifier(false);

  StatefulNavigationShell get shell => widget.shell;

  @override
  void dispose() {
    _compact.dispose();
    super.dispose();
  }

  void _onTab(int index) {
    if (index != shell.currentIndex) {
      _compact.value = false;
      shell.goBranch(index);
      return;
    }
    // Re-tap: scroll to top at the tab root; deeper in the branch, pop to its root.
    final location = GoRouterState.of(context).uri.path;
    if (location != AppRoutes.tabRoots[index]) {
      shell.goBranch(index, initialLocation: true);
    } else {
      ref.read(tabReselectProvider.notifier).reselected(index);
    }
  }

  void _onStart(Rect origin) {
    ref.read(hapticsProvider).light();
    Navigator.of(context, rootNavigator: true).push(
      MorphSheetRoute<void>(
        origin: origin,
        scrim: context.mmColors.scrim,
        reduced: Motion.reduced(context),
        semanticsLabel: 'Quick start',
        builder: (context) => const QuickStartSheet(),
      ),
    );
  }

  bool _onScroll(UserScrollNotification n) {
    if (n.metrics.axis != Axis.vertical) return false;
    GlassActivity.userScrolling = n.direction != ScrollDirection.idle;
    switch (n.direction) {
      case ScrollDirection.reverse:
        _compact.value = true;
      case ScrollDirection.forward:
      case ScrollDirection.idle:
        _compact.value = false;
    }
    return false;
  }

  /// Practice's confirm and loading pages (root-level, over the shell) hide the dock, like the
  /// runner: they pin their own key at the bottom.
  static bool dockHiddenAt(String path) => path.startsWith('/practice/setup/') || path == AppRoutes.practiceStart;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final showDock = !dockHiddenAt(GoRouterState.of(context).uri.path);
    final clearance = showDock ? MmDock.clearanceAbove : 0.0;
    final content = MediaQuery(
      data: media.copyWith(
        padding: media.padding.copyWith(bottom: media.padding.bottom + clearance),
        viewPadding: media.viewPadding.copyWith(bottom: media.viewPadding.bottom + clearance),
      ),
      child: NotificationListener<UserScrollNotification>(onNotification: _onScroll, child: shell),
    );
    // While a sheet or dialog covers the shell, the dock stops blurring: it sits under the
    // sheet's scrim, so a live blur there would cost frames for nothing.
    final covered = !(ModalRoute.of(context)?.isCurrent ?? true);
    Widget dock = SplitDock(
      currentIndex: shell.currentIndex,
      onTab: _onTab,
      onStart: _onStart,
      showReviewDot: ref.watch(reviewDotProvider),
      compact: _compact,
      startBreatheKey: ref.watch(dockResumeKeyProvider),
    );
    if (covered) dock = GlassScope(quality: GlassQuality.lite, child: dock);

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
              if (showDock) ...[
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: MmDock.height + MmDock.lift + media.viewPadding.bottom + 48,
                  child: const IgnorePointer(child: RepaintBoundary(child: DockScrim())),
                ),
                Positioned(left: 0, right: 0, bottom: 0, child: RepaintBoundary(child: dock)),
              ],
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

/// The ground fading in behind the dock, so content scrolling under it never sits between the
/// pill and Start or shows through the glass as readable text. Environment, never touchable.
class DockScrim extends StatelessWidget {
  const DockScrim({super.key});

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          // Fully ground by the dock's top edge, so nothing reads between the pill and Start.
          stops: const [0, 0.28, 0.38],
          colors: [ground.withValues(alpha: 0), ground.withValues(alpha: 0.9), ground],
        ),
      ),
    );
  }
}
