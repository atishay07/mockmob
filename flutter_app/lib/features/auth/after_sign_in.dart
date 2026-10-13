import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/router/router.dart' show routerProvider;
import '../../core/router/routes.dart';

/// Opens the sheet that follows a first sign-in on this phone (`/before-you-start`: the saved
/// state of the student's sheet and the usage-data choice) over Today, once the router has
/// landed there. Sheets need something under them; opening it as the only page would leave it
/// floating over an empty screen. Replaced in tests.
final afterSignInSheetLauncherProvider = Provider<VoidCallback>((ref) => () => _openOverToday(ref));

void _openOverToday(Ref ref) {
  final router = ref.read(routerProvider);
  final delegate = router.routerDelegate;
  bool atToday() => delegate.currentConfiguration.uri.path == AppRoutes.today;

  if (atToday()) {
    router.push(AppRoutes.beforeYouStart);
    return;
  }
  late final VoidCallback listener;
  // If Today never comes (a deep link took over, the account did not load), give up quietly:
  // the same choices live in You.
  final giveUp = Timer(const Duration(seconds: 8), () => delegate.removeListener(listener));
  listener = () {
    if (!atToday()) return;
    delegate.removeListener(listener);
    giveUp.cancel();
    scheduleMicrotask(() => router.push(AppRoutes.beforeYouStart));
  };
  delegate.addListener(listener);
}
