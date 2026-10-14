// The cards grow into their pages (MOTION.md C4): the practice start screen, the result and the
// repair entry open as container transforms from the tapped surface, 420 ms on emphasized.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/router/router.dart';

void _collect(List<RouteBase> routes, String parent, Map<String, GoRoute> out) {
  for (final route in routes) {
    if (route is GoRoute) {
      final full = route.path.startsWith('/') ? route.path : '${parent == '/' ? '' : parent}/${route.path}';
      out[full] = route;
      _collect(route.routes, full, out);
    } else if (route is StatefulShellRoute) {
      for (final branch in route.branches) {
        _collect(branch.routes, parent, out);
      }
    }
  }
}

void main() {
  testWidgets('start, result, sealed result and repair pages use the container transform', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final router = container.read(routerProvider);
    final routes = <String, GoRoute>{};
    _collect(router.configuration.routes, '/', routes);

    late BuildContext context;
    await tester.pumpWidget(Builder(builder: (c) {
      context = c;
      return const SizedBox();
    }));

    var n = 0;
    Duration forward(String path, Map<String, String> params) {
      final route = routes[path];
      expect(route, isNotNull, reason: '$path is a route');
      MmLaunchRect.set(const Rect.fromLTWH(20, 300, 340, 160));
      final state = GoRouterState(
        router.configuration,
        uri: Uri.parse(path),
        matchedLocation: path,
        name: null,
        path: route!.path,
        fullPath: path,
        pathParameters: params,
        extra: null,
        error: null,
        pageKey: ValueKey('container-test-${n++}'),
      );
      final page = route.pageBuilder!(context, state) as CustomTransitionPage<void>;
      return page.transitionDuration;
    }

    expect(forward('/practice/start', {}), Motion.emphasizedDuration);
    expect(forward('/practice/result/:attemptId', {'attemptId': 'a'}), Motion.emphasizedDuration);
    expect(forward('/result/:attemptId', {'attemptId': 'a'}), Motion.emphasizedDuration);
    expect(forward('/result/:attemptId/sealed', {'attemptId': 'a'}), Motion.emphasizedDuration);
    expect(forward('/review/repair/:attemptId/:questionId', {'attemptId': 'a', 'questionId': 'q'}), Motion.emphasizedDuration);
  });
}
