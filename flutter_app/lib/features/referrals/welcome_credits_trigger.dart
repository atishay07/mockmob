// Opens the welcome-credits sheet once per account, on Today, about 600 ms after a new account's after-sign-in sheet
// (`/before-you-start`) has closed. The rules are in welcome_credits_rules.dart; this file feeds them what the app knows
// (the router's location, whether a modal is over the page, the account, the phone's flag) and opens the sheet.

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_state.dart';
import '../../core/router/router.dart' show routerProvider;
import '../../core/router/routes.dart';
import '../../core/storage/prefs_store.dart';
import '../auth/after_sign_in.dart' show signInPrefsStoreProvider;
import 'welcome_credits_rules.dart';
import 'welcome_credits_sheet.dart';

/// Watches for the moment the welcome-credits sheet is owed and opens it, once. Armed by the after-sign-in sheet's
/// launcher when it opens that sheet for an account; nothing else ever arms it, so a returning account never sees it.
class WelcomeCreditsTrigger {
  WelcomeCreditsTrigger({
    required this.prefs,
    required this.signedInAs,
    required this.location,
    required this.modalOnTop,
    required this.open,
    this.poll = const Duration(milliseconds: 300),
  });

  final PrefsStore prefs;
  final String? Function() signedInAs;

  /// The router's path on top.
  final String Function() location;

  /// A sheet, dialog or other modal route is over the page.
  final bool Function() modalOnTop;

  /// Opens the sheet; completes when it closes.
  final Future<void> Function() open;

  /// How often the trigger looks while it waits. Time is counted in these looks (not the wall clock), so a phone whose
  /// clock jumps cannot open it early or never.
  final Duration poll;

  String? _armedFor;
  bool? _flag;
  bool _closed = false;
  bool _sawSheet = false;
  int _ticksSinceClosed = 0;
  bool _shown = false;
  bool _opening = false;
  int _readyTicks = 0;
  Timer? _timer;

  /// True once the sheet has opened in this run.
  bool get shown => _shown;

  /// The after-sign-in sheet is opening for [userId]. With [sheetClosed] (the device demo) there is no sheet to wait
  /// for; with [ignoreFlag] (the device demo) the phone's flag does not stop it.
  void arm(String userId, {bool sheetClosed = false, bool ignoreFlag = false}) {
    if (_shown) return;
    _armedFor = userId;
    _flag = ignoreFlag ? false : null;
    _closed = false;
    _sawSheet = false;
    _ticksSinceClosed = 0;
    _readyTicks = 0;
    if (sheetClosed) this.sheetClosed();
    if (!ignoreFlag) unawaited(_readFlag(userId));
    _timer ??= Timer.periodic(poll, (_) => _tick());
  }

  /// The after-sign-in sheet has closed (its route popped).
  void sheetClosed() {
    if (_armedFor == null || _closed) return;
    _closed = true;
    _ticksSinceClosed = 0;
  }

  Future<void> _readFlag(String userId) async {
    bool seen;
    try {
      seen = await prefs.getBool(welcomeCreditsShownKey(userId)) ?? false;
    } on Object {
      // An unreadable store never opens it unasked.
      seen = true;
    }
    if (_armedFor == userId) _flag = seen;
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
    _armedFor = null;
    _readyTicks = 0;
  }

  void dispose() => _stop();

  void _tick() {
    if (_opening || _armedFor == null) return;
    final where = location();
    // A sheet that closed without its route's future completing (the router replaced the stack) still counts as closed.
    if (where == AppRoutes.beforeYouStart) {
      _sawSheet = true;
    } else if (_sawSheet) {
      sheetClosed();
    }
    final flag = _flag;
    final decision = decideWelcomeCredits(WelcomeCreditsMoment(
      armedFor: _armedFor,
      signedInAs: signedInAs(),
      sheetClosed: _closed && flag != null,
      location: where,
      modalOnTop: modalOnTop(),
      shownThisRun: _shown,
      shownForAccount: flag ?? false,
      sinceClosed: poll * _ticksSinceClosed,
    ));
    if (_closed) _ticksSinceClosed++;
    switch (decision) {
      case WelcomeCreditsDecision.notOwed:
        _stop();
      case WelcomeCreditsDecision.wait:
        _readyTicks = 0;
      case WelcomeCreditsDecision.show:
        // Today has to stay clear for about [welcomeCreditsDelay] before the sheet rises.
        if (poll * _readyTicks >= welcomeCreditsDelay) {
          unawaited(_open(_armedFor!));
        } else {
          _readyTicks++;
        }
    }
  }

  Future<void> _open(String userId) async {
    _opening = true;
    _shown = true;
    _stop();
    try {
      await prefs.setBool(welcomeCreditsShownKey(userId), true);
    } on Object {
      // Shown once in this run at least.
    }
    try {
      await open();
    } finally {
      _opening = false;
    }
  }
}

/// True when the top route of [navigator] is not a page of the router: a sheet, a dialog, a menu. No navigator yet
/// counts as covered.
bool rootModalOnTop(NavigatorState? navigator) {
  if (navigator == null || !navigator.mounted) return true;
  Route<dynamic>? top;
  navigator.popUntil((route) {
    top = route;
    return true;
  });
  return top == null || top!.settings is! Page;
}

final welcomeCreditsTriggerProvider = Provider<WelcomeCreditsTrigger>((ref) {
  final router = ref.watch(routerProvider);
  final delegate = router.routerDelegate;
  final trigger = WelcomeCreditsTrigger(
    prefs: ref.read(signInPrefsStoreProvider),
    signedInAs: () {
      final s = ref.read(authSnapshotProvider);
      return s.status == AuthStatus.signedIn ? s.userId : null;
    },
    location: () => delegate.currentConfiguration.uri.path,
    modalOnTop: () => rootModalOnTop(delegate.navigatorKey.currentState),
    open: () async {
      final context = delegate.navigatorKey.currentContext;
      if (context == null || !context.mounted) return;
      await showWelcomeCreditsSheet(context);
    },
  );
  ref.onDispose(trigger.dispose);
  return trigger;
});

/// The device demo's fixture (test/device_demo, `--dart-define=DEMO_WELCOME_CREDITS=true`): the signed-in fixture
/// student is treated as a new account whose after-sign-in sheet has just closed, so the sheet opens on Today at every
/// launch. False in the app.
final welcomeCreditsDemoProvider = Provider<bool>((ref) => false);

/// Started by the app's services: arms the trigger for the demo fixture. Does nothing in the app.
final welcomeCreditsDemoStarterProvider = Provider<void>((ref) {
  if (!ref.watch(welcomeCreditsDemoProvider)) return;
  final userId = ref.watch(authSnapshotProvider.select((s) => s.status == AuthStatus.signedIn ? s.userId : null));
  if (userId == null) return;
  ref.read(welcomeCreditsTriggerProvider).arm(userId, sheetClosed: true, ignoreFlag: true);
});
