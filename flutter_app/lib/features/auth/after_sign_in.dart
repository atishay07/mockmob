import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_state.dart';
import '../../core/router/router.dart' show routerProvider;
import '../../core/router/routes.dart';
import '../../core/storage/prefs_store.dart';
import '../referrals/referral_data.dart' show referralStatusProvider;
import '../referrals/welcome_credits_trigger.dart' show welcomeCreditsTriggerProvider;

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

const String _signInPendingKey = 'auth_sign_in_pending_at';

/// How long a sign-in that was started and never finished in this process (the app was killed
/// while the mail app or the Google browser was open) still owes the student the sheet.
const Duration signInPendingMaxAge = Duration(minutes: 30);

/// Records that a sign-in has started, so a process that dies before it ends can still offer
/// the sheet when the restarted app finds the account signed in. Never throws.
Future<void> markSignInPending(PrefsStore prefs, DateTime now) async {
  try {
    await prefs.setInt(_signInPendingKey, now.millisecondsSinceEpoch);
  } on Object {
    // Convenience only.
  }
}

/// True when a sign-in started within [signInPendingMaxAge] was never settled. A stale or
/// unreadable record is forgotten and answers false. Never throws.
Future<bool> signInPendingFresh(PrefsStore prefs, DateTime now) async {
  try {
    final at = await prefs.getInt(_signInPendingKey);
    if (at == null) return false;
    final age = now.difference(DateTime.fromMillisecondsSinceEpoch(at));
    if (age <= signInPendingMaxAge && !age.isNegative) return true;
    await prefs.remove(_signInPendingKey);
  } on Object {
    // Treated as nothing pending.
  }
  return false;
}

/// Forgets the pending sign-in: the sheet was decided (shown, or not owed). Never throws.
Future<void> clearSignInPending(PrefsStore prefs) async {
  try {
    await prefs.remove(_signInPendingKey);
  } on Object {
    // Expires by itself.
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
    // A new account's first minutes (owner, 20 Oct 11:20 pm): once this sheet closes, the welcome-credits sheet
    // follows on Today, once per account. Only an account whose sheet opens here is ever armed. The invite status is
    // read now, so the welcome has it by the time it opens.
    final auth = ref.read(authSnapshotProvider);
    final userId = auth.status == AuthStatus.signedIn ? auth.userId : null;
    final welcome = userId == null ? null : ref.read(welcomeCreditsTriggerProvider);
    if (userId != null) {
      welcome!.arm(userId);
      final keep = ref.listen(referralStatusProvider, (_, _) {});
      Timer(const Duration(minutes: 2), keep.close);
    }
    unawaited(router.push<void>(AppRoutes.beforeYouStart).whenComplete(() => welcome?.sheetClosed()));
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
