import '../../../core/storage/prefs_store.dart';
import '../copy.dart';

/// What the nudges remember on this phone, per MockMob account (a phone can hold more than one).
/// Per-phone conveniences, as the website keeps them in the browser: nothing here is authoritative and
/// a lost value only means a nudge may show once more. Everything is a plain key in the phone's
/// preferences, so it survives a restart.
class ProNudgeSaved {
  const ProNudgeSaved({this.popupShown = false, this.onboardedAt, this.onboardedLaunch, this.actionsAtOnboarded = 0, this.resultsViewed = 0, this.firstResultId, this.dismissed = const {}});

  /// The first-session pop-up was shown. Once ever.
  final bool popupShown;

  /// When onboarding finished on this phone. Null when it never did here.
  final DateTime? onboardedAt;

  /// The run of the app in which it finished: the first usage session.
  final String? onboardedLaunch;

  /// Real actions already taken in that run when onboarding finished (only later ones count).
  final int actionsAtOnboarded;

  /// How many results the student has viewed on this phone since this was added, each attempt counted
  /// once per run. Only "none yet" is read: it marks the next result as the first.
  final int resultsViewed;

  /// The attempt of the student's very first result (D181: it carries no Pro ask, however often it is
  /// opened). Null until a new student views their first result on this phone.
  final String? firstResultId;

  /// When each inline nudge was last dismissed, by [ProNudgeSurface.key].
  final Map<String, DateTime> dismissed;

  ProNudgeSaved copyWith({
    bool? popupShown,
    DateTime? onboardedAt,
    String? onboardedLaunch,
    int? actionsAtOnboarded,
    int? resultsViewed,
    String? firstResultId,
    Map<String, DateTime>? dismissed,
  }) =>
      ProNudgeSaved(
        popupShown: popupShown ?? this.popupShown,
        onboardedAt: onboardedAt ?? this.onboardedAt,
        onboardedLaunch: onboardedLaunch ?? this.onboardedLaunch,
        actionsAtOnboarded: actionsAtOnboarded ?? this.actionsAtOnboarded,
        resultsViewed: resultsViewed ?? this.resultsViewed,
        firstResultId: firstResultId ?? this.firstResultId,
        dismissed: dismissed ?? this.dismissed,
      );
}

class ProNudgeStore {
  const ProNudgeStore(this._prefs);

  final PrefsStore _prefs;

  static String _k(String userId, String name) => 'mm.pronudge.v2.$userId.$name';

  Future<ProNudgeSaved> load(String userId) async {
    final dismissed = <String, DateTime>{};
    for (final s in ProNudgeSurface.values) {
      final ms = await _prefs.getInt(_k(userId, 'dismissed.${s.key}'));
      if (ms != null) dismissed[s.key] = DateTime.fromMillisecondsSinceEpoch(ms);
    }
    final onboardedMs = await _prefs.getInt(_k(userId, 'onboarded_at'));
    return ProNudgeSaved(
      popupShown: await _prefs.getBool(_k(userId, 'popup_shown')) ?? false,
      onboardedAt: onboardedMs == null ? null : DateTime.fromMillisecondsSinceEpoch(onboardedMs),
      onboardedLaunch: await _prefs.getString(_k(userId, 'onboarded_launch')),
      actionsAtOnboarded: await _prefs.getInt(_k(userId, 'onboarded_actions')) ?? 0,
      resultsViewed: await _prefs.getInt(_k(userId, 'results_viewed')) ?? 0,
      firstResultId: await _prefs.getString(_k(userId, 'first_result')),
      dismissed: dismissed,
    );
  }

  Future<void> saveResultsViewed(String userId, int count) => _prefs.setInt(_k(userId, 'results_viewed'), count);

  Future<void> saveFirstResult(String userId, String attemptId) => _prefs.setString(_k(userId, 'first_result'), attemptId);

  Future<void> savePopupShown(String userId) => _prefs.setBool(_k(userId, 'popup_shown'), true);

  Future<void> saveOnboarded(String userId, {required DateTime at, required String launch, required int actions}) async {
    await _prefs.setInt(_k(userId, 'onboarded_at'), at.millisecondsSinceEpoch);
    await _prefs.setString(_k(userId, 'onboarded_launch'), launch);
    await _prefs.setInt(_k(userId, 'onboarded_actions'), actions);
  }

  Future<void> saveDismissed(String userId, ProNudgeSurface surface, DateTime at) =>
      _prefs.setInt(_k(userId, 'dismissed.${surface.key}'), at.millisecondsSinceEpoch);
}
