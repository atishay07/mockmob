import '../../../core/storage/prefs_store.dart';
import '../copy.dart';

/// What the nudges remember on this phone, per MockMob account (a phone can hold more than one).
/// Per-phone conveniences: nothing here is authoritative and a lost value only means a nudge may
/// show once more. Everything is a plain key in the phone's preferences, so it survives a restart.
class ProNudgeSaved {
  const ProNudgeSaved({this.popupShown = false, this.onboardedLaunch, this.firstSessionLaunch, this.dismissed = const {}});

  /// The first-session pop-up was shown. Once ever.
  final bool popupShown;

  /// The run of the app in which the student was seen in onboarding.
  final String? onboardedLaunch;

  /// The run of the app that is the first after onboarding.
  final String? firstSessionLaunch;

  /// When each inline nudge was last dismissed, by [ProNudgeSurface.key].
  final Map<String, DateTime> dismissed;

  ProNudgeSaved copyWith({bool? popupShown, Object? onboardedLaunch = _keep, Object? firstSessionLaunch = _keep, Map<String, DateTime>? dismissed}) => ProNudgeSaved(
        popupShown: popupShown ?? this.popupShown,
        onboardedLaunch: identical(onboardedLaunch, _keep) ? this.onboardedLaunch : onboardedLaunch as String?,
        firstSessionLaunch: identical(firstSessionLaunch, _keep) ? this.firstSessionLaunch : firstSessionLaunch as String?,
        dismissed: dismissed ?? this.dismissed,
      );

  static const Object _keep = Object();
}

class ProNudgeStore {
  const ProNudgeStore(this._prefs);

  final PrefsStore _prefs;

  static String _k(String userId, String name) => 'mm.pronudge.v1.$userId.$name';

  Future<ProNudgeSaved> load(String userId) async {
    final dismissed = <String, DateTime>{};
    for (final s in ProNudgeSurface.values) {
      final ms = await _prefs.getInt(_k(userId, 'dismissed.${s.key}'));
      if (ms != null) dismissed[s.key] = DateTime.fromMillisecondsSinceEpoch(ms);
    }
    return ProNudgeSaved(
      popupShown: await _prefs.getBool(_k(userId, 'popup_shown')) ?? false,
      onboardedLaunch: await _prefs.getString(_k(userId, 'onboarded_launch')),
      firstSessionLaunch: await _prefs.getString(_k(userId, 'first_session_launch')),
      dismissed: dismissed,
    );
  }

  Future<void> savePopupShown(String userId) => _prefs.setBool(_k(userId, 'popup_shown'), true);

  Future<void> saveLaunches(String userId, {String? onboardedLaunch, String? firstSessionLaunch}) async {
    if (onboardedLaunch != null) await _prefs.setString(_k(userId, 'onboarded_launch'), onboardedLaunch);
    if (firstSessionLaunch != null) await _prefs.setString(_k(userId, 'first_session_launch'), firstSessionLaunch);
  }

  Future<void> saveDismissed(String userId, ProNudgeSurface surface, DateTime at) =>
      _prefs.setInt(_k(userId, 'dismissed.${surface.key}'), at.millisecondsSinceEpoch);
}
