import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/router/router.dart' show routerProvider;
import '../../core/router/routes.dart';
import '../../core/storage/prefs_store.dart';

/// Where the after-sign-in sheet offer is remembered on this phone, so it comes up once.
final signInPrefsStoreProvider = Provider<PrefsStore>(
  (ref) => SharedPrefsStore(),
);

const String _beforeYouStartOfferedKey = 'auth_before_you_start_offered';

/// True once this phone has shown the after-sign-in sheet. An unreadable store answers true, so
/// a preferences failure never holds sign-in or opens the sheet unasked.
Future<bool> beforeYouStartOffered(PrefsStore prefs) async {
  try {
    return await prefs.getBool(_beforeYouStartOfferedKey) ?? false;
  } on Object {
    return true;
  }
}

/// Records that the sheet was shown. Called only once it is actually on screen.
Future<void> markBeforeYouStartOffered(PrefsStore prefs) async {
  try {
    await prefs.setBool(_beforeYouStartOfferedKey, true);
  } on Object {
    // Offered again next time at worst.
  }
}

/// Opens the sheet that follows a first sign-in on this phone (`/before-you-start`: the saved
/// state of the student's sheet and the usage-data choice) over Today, once the router has
/// landed there. Sheets need something under them; opening it as the only page would leave it
/// floating over an empty screen. The phone counts it as offered only once it is pushed, so a
/// sheet that never got to open is offered again next time. One at a time, and once per run.
/// Replaced in tests.
final afterSignInSheetLauncherProvider = Provider<VoidCallback>((ref) {
  var waiting = false;
  var shown = false;
  return () {
    if (waiting || shown) return;
    waiting = true;
    _openOverToday(
      ref,
      onOpened: () {
        waiting = false;
        shown = true;
      },
      onGaveUp: () => waiting = false,
    );
  };
});

void _openOverToday(
  Ref ref, {
  required VoidCallback onOpened,
  required VoidCallback onGaveUp,
}) {
  final router = ref.read(routerProvider);
  final delegate = router.routerDelegate;
  bool atToday() => delegate.currentConfiguration.uri.path == AppRoutes.today;

  void open() {
    onOpened();
    router.push(AppRoutes.beforeYouStart);
    unawaited(markBeforeYouStartOffered(ref.read(signInPrefsStoreProvider)));
  }

  if (atToday()) {
    open();
    return;
  }
  late final VoidCallback listener;
  // If Today never comes (a deep link took over, the account did not load), give up quietly:
  // the same choices live in You, and the sheet is offered again at the next sign-in.
  final giveUp = Timer(const Duration(seconds: 8), () {
    delegate.removeListener(listener);
    onGaveUp();
  });
  listener = () {
    if (!atToday()) return;
    delegate.removeListener(listener);
    giveUp.cancel();
    scheduleMicrotask(open);
  };
  delegate.addListener(listener);
}
