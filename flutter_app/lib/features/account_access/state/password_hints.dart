import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/storage/prefs_store.dart';

/// Where this phone remembers, per account, that a password was set here or that the "Set a
/// password" nudge was dismissed. Not secret: no password or token is ever stored.
final accessPrefsStoreProvider = Provider<PrefsStore>(
  (ref) => SharedPrefsStore(),
);

/// Small per-account memory for the password nudge. Supabase does not say whether an account
/// has a password, so the nudge relies on what happened on this phone.
class PasswordHints {
  PasswordHints(this._ref);

  final Ref _ref;

  PrefsStore get _prefs => _ref.read(accessPrefsStoreProvider);
  String? get _user => _ref.read(authSnapshotProvider).userId;

  static String _setKey(String user) => 'access.password_set.$user';
  static String _dismissedKey(String user) =>
      'access.password_nudge_dismissed.$user';

  Future<bool> shouldNudge() async {
    final user = _user;
    if (user == null) return false;
    if (await _prefs.getBool(_setKey(user)) ?? false) return false;
    return !(await _prefs.getBool(_dismissedKey(user)) ?? false);
  }

  Future<void> markPasswordSet() async {
    final user = _user;
    if (user != null) await _prefs.setBool(_setKey(user), true);
    _ref.invalidate(passwordNudgeProvider);
  }

  Future<void> dismissNudge() async {
    final user = _user;
    if (user != null) await _prefs.setBool(_dismissedKey(user), true);
    _ref.invalidate(passwordNudgeProvider);
  }
}

final passwordHintsProvider = Provider<PasswordHints>(PasswordHints.new);

/// True when a signed-in student should see "Set a password for faster sign-in".
final passwordNudgeProvider = FutureProvider<bool>((ref) async {
  final signedIn = ref.watch(
    authSnapshotProvider.select((s) => s.isSignedIn ? s.userId : null),
  );
  if (signedIn == null) return false;
  return ref.read(passwordHintsProvider).shouldNudge();
});
