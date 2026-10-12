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
    switch (n.direction) {
      case ScrollDirection.reverse:
        _compact.value = true;
      case ScrollDirection.forward:
      case ScrollDirection.idle:
        _compact.value = false;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final clearance = MmDock.height + MmDock.lift + 8;
    final content = MediaQuery(
      data: media.copyWith(
        padding: media.padding.copyWith(bottom: media.padding.bottom + clearance),
        viewPadding: media.viewPadding.copyWith(bottom: media.viewPadding.bottom + clearance),
      ),
      child: NotificationListener<UserScrollNotification>(onNotification: _onScroll, child: shell),
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
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: SplitDock(
                  currentIndex: shell.currentIndex,
                  onTab: _onTab,
                  onStart: _onStart,
                  showReviewDot: ref.watch(reviewDotProvider),
                  compact: _compact,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
