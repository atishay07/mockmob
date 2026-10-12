import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../widgets/bottom_nav.dart';
import 'routes.dart';

/// True while a locally recorded received result has not been opened (`pending_result`, spec 10).
/// Shows the dot on Review. The default is false; the result module or the app root overrides it.
final reviewDotProvider = Provider<bool>((ref) => false);

/// Published when the student taps the tab they are already on, so that tab's screen can scroll
/// to the top (spec 4.1). A fresh [serial] marks a new tap.
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

/// The scaffold around the five tab branches: the bottom bar and the back rule (back from any
/// tab goes to Today, then exits).
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _onTab(BuildContext context, WidgetRef ref, int index) {
    if (index != shell.currentIndex) {
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopScope(
      canPop: shell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) shell.goBranch(0);
      },
      child: Scaffold(
        body: shell,
        bottomNavigationBar: MmBottomNav(
          currentIndex: shell.currentIndex,
          showReviewDot: ref.watch(reviewDotProvider),
          onTap: (index) => _onTab(context, ref, index),
        ),
      ),
    );
  }
}
