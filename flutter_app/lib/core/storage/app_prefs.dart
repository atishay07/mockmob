import 'prefs_store.dart';

/// Appearance choice stored in preferences. Mapped to `ThemeMode` by the theme module.
enum ThemeChoice { system, light, dark }

/// Small per-phone settings (shared_preferences). Per-viewer conveniences only: nothing here
/// is authoritative and everything has a sensible default.
class AppPrefs {
  AppPrefs(this._prefs);

  final PrefsStore _prefs;

  static const _welcomeSeen = 'welcome_seen';
  static const _theme = 'theme_choice';
  static const _reduceMotion = 'reduce_motion';
  static const _touchFeedback = 'touch_feedback';
  static const _openResultsDirectly = 'open_results_directly';
  static const _lateNightLines = 'late_night_lines';
  static const _sheetsOpened = 'sheets_opened';
  static const _skipRevealHintShown = 'skip_reveal_hint_shown';
  static const _weeklyCap = 'notif_weekly_cap';
  static const _lastPrePrompt = 'notif_pre_prompt_at';
  static const _notifChannelsCreated = 'notif_channels';
  static const _notifPermissionAsked = 'notif_permission_asked';
  static const _stopCollecting = 'analytics_stop_user';
  static const _lastUserId = 'last_user_id';
  static const _keepOffline = 'learn_offline_subjects';
  static const _lastOpenedAt = 'last_opened_at';
  static const _cachedMe = 'cached_auth_me';
  static const _pendingWithdrawal = 'consent_withdrawal_pending';
  static const _notifLedger = 'notif_ledger';
  static const _glassQuality = 'glass_quality';
  static const _coldOpenSeen = 'cold_open_seen';

  Future<bool> welcomeSeen() async => await _prefs.getBool(_welcomeSeen) ?? false;
  Future<void> setWelcomeSeen(bool v) => _prefs.setBool(_welcomeSeen, v);

  Future<ThemeChoice> theme() async {
    final raw = await _prefs.getString(_theme);
    // Night is the default identity (Night Sheet brief, section 3).
    return ThemeChoice.values.asNameMap()[raw] ?? ThemeChoice.dark;
  }

  Future<void> setTheme(ThemeChoice v) => _prefs.setString(_theme, v.name);

  /// Null means "follow the system setting".
  Future<bool?> reduceMotionOverride() => _prefs.getBool(_reduceMotion);
  Future<void> setReduceMotionOverride(bool? v) => v == null ? _prefs.remove(_reduceMotion) : _prefs.setBool(_reduceMotion, v);

  Future<bool> touchFeedback() async => await _prefs.getBool(_touchFeedback) ?? true;
  Future<void> setTouchFeedback(bool v) => _prefs.setBool(_touchFeedback, v);

  Future<bool> openResultsDirectly() async => await _prefs.getBool(_openResultsDirectly) ?? false;
  Future<void> setOpenResultsDirectly(bool v) => _prefs.setBool(_openResultsDirectly, v);

  Future<bool> lateNightLines() async => await _prefs.getBool(_lateNightLines) ?? true;
  Future<void> setLateNightLines(bool v) => _prefs.setBool(_lateNightLines, v);

  /// How many sealed sheets the student has opened (drives the ritual decay of 5.6.1).
  Future<int> sheetsOpened() async => await _prefs.getInt(_sheetsOpened) ?? 0;
  Future<int> incrementSheetsOpened() async {
    final next = await sheetsOpened() + 1;
    await _prefs.setInt(_sheetsOpened, next);
    return next;
  }

  Future<bool> skipRevealHintShown() async => await _prefs.getBool(_skipRevealHintShown) ?? false;
  Future<void> setSkipRevealHintShown(bool v) => _prefs.setBool(_skipRevealHintShown, v);

  /// Client-side weekly cap on notifications (spec 8 and amendment A6). Default 3.
  Future<int> weeklyCap() async => await _prefs.getInt(_weeklyCap) ?? 3;
  Future<void> setWeeklyCap(int v) => _prefs.setInt(_weeklyCap, v);

  Future<DateTime?> lastPrePromptAt() async {
    final ms = await _prefs.getInt(_lastPrePrompt);
    return ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<void> setLastPrePromptAt(DateTime at) => _prefs.setInt(_lastPrePrompt, at.millisecondsSinceEpoch);

  Future<bool> notificationPermissionAsked() async => await _prefs.getBool(_notifPermissionAsked) ?? false;
  Future<void> setNotificationPermissionAsked(bool v) => _prefs.setBool(_notifPermissionAsked, v);

  Future<Set<String>> createdNotificationChannels() async =>
      (await _prefs.getStringList(_notifChannelsCreated))?.toSet() ?? <String>{};
  Future<void> setCreatedNotificationChannels(Set<String> ids) => _prefs.setStringList(_notifChannelsCreated, ids.toList());

  /// User id for whom the server answered `collecting:false`. Analytics stays stopped for that
  /// account until consent is turned on again.
  Future<String?> analyticsStoppedFor() => _prefs.getString(_stopCollecting);
  Future<void> setAnalyticsStoppedFor(String? userId) =>
      userId == null ? _prefs.remove(_stopCollecting) : _prefs.setString(_stopCollecting, userId);

  /// The MockMob user id seen last. A different id on the next launch means an account switch.
  Future<String?> lastUserId() => _prefs.getString(_lastUserId);
  Future<void> setLastUserId(String? id) => id == null ? _prefs.remove(_lastUserId) : _prefs.setString(_lastUserId, id);

  /// Subject ids the student chose to keep for offline use in Learn.
  Future<Set<String>> offlineLearnSubjects() async => (await _prefs.getStringList(_keepOffline))?.toSet() ?? <String>{};
  Future<void> setOfflineLearnSubjects(Set<String> ids) => _prefs.setStringList(_keepOffline, ids.toList());

  /// Wall-clock time of the previous app open (for the "returning" decisions that need it locally).
  Future<DateTime?> lastOpenedAt() async {
    final ms = await _prefs.getInt(_lastOpenedAt);
    return ms == null ? null : DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<void> setLastOpenedAt(DateTime at) => _prefs.setInt(_lastOpenedAt, at.millisecondsSinceEpoch);

  /// The last good `GET /api/auth/me` body, so the app can open signed in while offline.
  Future<String?> cachedMe() => _prefs.getString(_cachedMe);
  Future<void> setCachedMe(String? json) => json == null ? _prefs.remove(_cachedMe) : _prefs.setString(_cachedMe, json);

  /// User id whose usage-data withdrawal has not reached the server yet. The PUT is retried
  /// on the next consent load, and analytics stays off in the meantime.
  Future<String?> pendingWithdrawalFor() => _prefs.getString(_pendingWithdrawal);
  Future<void> setPendingWithdrawalFor(String? userId) =>
      userId == null ? _prefs.remove(_pendingWithdrawal) : _prefs.setString(_pendingWithdrawal, userId);

  /// Scheduled and posted notifications as `taskId|epochMs`, kept to enforce the caps.
  Future<List<String>> notificationLedger() async => await _prefs.getStringList(_notifLedger) ?? const [];
  Future<void> setNotificationLedger(List<String> entries) => _prefs.setStringList(_notifLedger, entries);

  /// Glass quality (`full`, `lite`, `off`); null until chosen or downgraded automatically.
  Future<String?> glassQuality() => _prefs.getString(_glassQuality);
  Future<void> setGlassQuality(String v) => _prefs.setString(_glassQuality, v);

  /// True once the first-launch cold open has played.
  Future<bool> coldOpenSeen() async => await _prefs.getBool(_coldOpenSeen) ?? false;
  Future<void> setColdOpenSeen(bool v) => _prefs.setBool(_coldOpenSeen, v);
}
