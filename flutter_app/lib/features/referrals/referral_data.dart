// Friend invites in the app (owner D165, 20 Oct 2026). The server decides and pays (POST /api/referrals/claim, GET
// /api/referrals; the website's src/lib/server/referrals.js and supabase/migrations/20261020130000_referrals.sql). The app
// only keeps the invite a link brought in, through sign-in and onboarding, and hands it over once a student is signed in:
//
//   https://www.mockmob.in/r/<7-character code>     a friend's invite link
//   https://www.mockmob.in/join/<6 or 8 characters>  a Mob invite, which is also a friend invite
//   https://www.mockmob.in/...?ref=<7 characters>    a friend's code on any other page (never /pricing: creator codes)
//   the Play install referrer: invite=<7 characters>  a friend's link followed through Google Play (install_referrer.dart)
//   a code typed by hand (source 'code'): the after-sign-in sheet and the Wallet (invite_code_row.dart)
//
// GET /api/referrals: {"ok": true, "live": true, "code", "link", "reward", "monthlyCap", "paused", "joined", "practised",
//   "rewarded", "notCounted", "earned", "rewardedThisMonth", "capReached", "invited": {"state", "rewarded"} | null}, or
//   {"ok": true, "live": false} while invites are off. Nothing about invites is drawn unless "live" is true.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api/api_client.dart' show ApiOptions;
import '../../core/api/api_error.dart' show ApiError, ApiErrorKind;
import '../../core/api/api_providers.dart';
import '../../core/auth/auth_state.dart';
import '../../core/models/json_helpers.dart';
import '../../core/storage/prefs_store.dart';
import 'install_referrer.dart';

final RegExp _referralCode = RegExp(r'^[0-9A-HJKMNP-TV-Z]{7}$');
final RegExp _mobCode = RegExp(r'^(?:[0-9A-HJKMNP-TV-Z]{6}|[0-9A-HJKMNP-TV-Z]{8})$');

/// A code read the Crockford way (O is 0, I and L are 1; spaces and dashes out), as the server reads it. Null unless it is
/// a friend's code (7 characters) or a Mob invite code (6 or 8).
String? normaliseInviteCode(String? raw) {
  if (raw == null) return null;
  final code = raw.toUpperCase().replaceAll(RegExp(r'[\s-]+'), '').replaceAll('O', '0').replaceAll(RegExp('[IL]'), '1');
  return _referralCode.hasMatch(code) || _mobCode.hasMatch(code) ? code : null;
}

bool isFriendCode(String code) => _referralCode.hasMatch(code);

/// The code in what a student typed or pasted: a bare code, or a whole invite link (https://www.mockmob.in/r/<code>).
/// Null when there is none.
String? inviteCodeFromInput(String? raw) {
  final text = raw?.trim() ?? '';
  if (text.isEmpty) return null;
  final uri = Uri.tryParse(text);
  if (uri != null && uri.hasScheme) return PendingInvite.fromUri(uri, DateTime.now())?.code;
  return normaliseInviteCode(text);
}

/// One invite kept on the phone until it is claimed.
class PendingInvite {
  const PendingInvite({required this.code, required this.source, required this.at});

  final String code;

  /// 'link' (a friend's link), 'mob_invite' (a Mob invite link) or 'code' (typed).
  final String source;

  /// When the link reached the phone, on the phone's clock. The server is sent only its age in seconds, so a wrong clock
  /// cannot move it.
  final DateTime at;

  bool get explicit => source != 'link';

  Map<String, Object> toJson() => {'c': code, 's': source, 't': at.millisecondsSinceEpoch};

  static PendingInvite? fromJson(Object? raw) {
    final j = asJson(raw);
    final code = normaliseInviteCode(asString(j['c']));
    final source = asString(j['s']);
    final t = asInt(j['t']);
    if (code == null || t == null || !const {'link', 'mob_invite', 'code'}.contains(source)) return null;
    return PendingInvite(code: code, source: source!, at: DateTime.fromMillisecondsSinceEpoch(t));
  }

  /// The invite an incoming link carries, or null. /pricing keeps ?ref= for creator codes.
  static PendingInvite? fromUri(Uri uri, DateTime now) {
    if (uri.scheme != 'https' || !const {'www.mockmob.in', 'mockmob.in'}.contains(uri.host.toLowerCase())) return null;
    final s = uri.pathSegments.where((e) => e.isNotEmpty).toList();
    if (s.length == 2 && s.first == 'r') {
      final code = normaliseInviteCode(s[1]);
      return code != null && isFriendCode(code) ? PendingInvite(code: code, source: 'link', at: now) : null;
    }
    if (s.length == 2 && s.first == 'join') {
      final code = normaliseInviteCode(s[1]);
      return code != null && !isFriendCode(code) ? PendingInvite(code: code, source: 'mob_invite', at: now) : null;
    }
    if (s.isNotEmpty && s.first == 'pricing') return null;
    final code = normaliseInviteCode(uri.queryParameters['ref']);
    return code != null && isFriendCode(code) ? PendingInvite(code: code, source: 'link', at: now) : null;
  }
}

/// The phone's one pending invite. A Mob invite or a typed code replaces a link's; a link never replaces one (the first
/// friend keeps it). Kept 30 days, the website's cookie life.
class PendingInviteStore {
  PendingInviteStore(this._prefs, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  final PrefsStore _prefs;
  final DateTime Function() _now;
  static const String _key = 'referral_pending_invite';
  static const String _installKey = 'referral_install_id';
  static const Duration life = Duration(days: 30);

  Future<PendingInvite?> read() async {
    final raw = await _prefs.getString(_key);
    if (raw == null) return null;
    PendingInvite? p;
    try {
      p = PendingInvite.fromJson(jsonDecode(raw));
    } on Object {
      p = null;
    }
    if (p == null || _now().difference(p.at) > life) {
      await _prefs.remove(_key);
      return null;
    }
    return p;
  }

  /// Keeps the invite [uri] carries. True when it was kept.
  Future<bool> captureUri(Uri uri) async {
    final next = PendingInvite.fromUri(uri, _now());
    return next != null && await capture(next);
  }

  /// Keeps [next] by the same rules (a link never replaces the one kept; the same code is not kept twice). True when it
  /// was kept.
  Future<bool> capture(PendingInvite next) async {
    final had = await read();
    if (had != null && (had.code == next.code || !next.explicit)) return false;
    await _prefs.setString(_key, jsonEncode(next.toJson()));
    return true;
  }

  /// Keeps a code typed by hand (source 'code'); it replaces a link's. Null when [raw] holds no code.
  Future<PendingInvite?> captureCode(String? raw) async {
    final code = inviteCodeFromInput(raw);
    if (code == null) return null;
    final next = PendingInvite(code: code, source: 'code', at: _now());
    await capture(next);
    return await read() ?? next;
  }

  Future<void> clear() => _prefs.remove(_key);

  /// Forgets the kept invite only while it is still [code]: a code kept while a claim was running stays for its own claim.
  Future<void> clearIfCode(String code) async {
    final had = await read();
    if (had != null && had.code == code) await clear();
  }

  /// A random id for this install, for the server's same-phone check (it is hashed there; it names no one).
  Future<String> installId() async {
    final had = await _prefs.getString(_installKey);
    if (had != null && RegExp(r'^[A-Za-z0-9_-]{16,64}$').hasMatch(had)) return had;
    final id = const Uuid().v4().replaceAll('-', '');
    await _prefs.setString(_installKey, id);
    return id;
  }
}

/// What the server says about this student's invites. [live] false means draw nothing about invites.
class ReferralStatus {
  const ReferralStatus({
    this.live = false,
    this.code,
    this.link,
    this.reward = 100,
    this.monthlyCap = 10,
    this.paused = false,
    this.joined = 0,
    this.practised = 0,
    this.rewarded = 0,
    this.notCounted = 0,
    this.earned = 0,
    this.capReached = false,
    this.invitedState,
    this.invitedRewarded = false,
  });

  static const ReferralStatus off = ReferralStatus();

  factory ReferralStatus.fromJson(Object? raw) {
    final j = asJson(raw);
    final code = asString(j['code']);
    final link = asString(j['link']);
    if (j['ok'] != true || j['live'] != true || code == null || link == null || !link.startsWith('https://')) return off;
    int n(Object? v, int d) => (asInt(v) ?? d) < 0 ? d : (asInt(v) ?? d);
    final invited = j['invited'] is Map ? asJson(j['invited']) : null;
    return ReferralStatus(
      live: true,
      code: code,
      link: link,
      reward: n(j['reward'], 100) == 0 ? 100 : n(j['reward'], 100),
      monthlyCap: n(j['monthlyCap'], 10),
      paused: j['paused'] == true,
      joined: n(j['joined'], 0),
      practised: n(j['practised'], 0),
      rewarded: n(j['rewarded'], 0),
      notCounted: n(j['notCounted'], 0),
      earned: n(j['earned'], 0),
      capReached: j['capReached'] == true,
      invitedState: invited == null ? null : asString(invited['state']),
      invitedRewarded: invited?['rewarded'] == true,
    );
  }

  final bool live;
  final String? code;
  final String? link;
  final int reward;
  final int monthlyCap;
  final bool paused;
  final int joined;
  final int practised;
  final int rewarded;
  final int notCounted;
  final int earned;
  final bool capReached;
  final String? invitedState;
  final bool invitedRewarded;
}

/// The store's backing preferences. Tests swap in a MemoryPrefsStore.
final referralPrefsProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());
final pendingInviteStoreProvider = Provider<PendingInviteStore>((ref) => PendingInviteStore(ref.watch(referralPrefsProvider)));

/// How long one read of the student's invites may take, and how long the app waits before the one retry (D185: a read that
/// fails once is tried again, never taken for "no invites").
const Duration referralReadTimeout = Duration(seconds: 8);
final referralRetryDelayProvider = Provider<Duration>((ref) => const Duration(seconds: 2));

/// The signed-in student's invites. Off while signed out and while invites are off. A read that fails or times out is tried
/// once more after 2 seconds; if that fails too the provider is in error (never "off"), so the screens can say so quietly
/// and offer a retry instead of going silent. The provider's own automatic retry is off: the one retry here is the only one.
final referralStatusProvider = FutureProvider.autoDispose<ReferralStatus>(
  (ref) async {
    final userId = ref.watch(authSnapshotProvider.select((s) => s.status == AuthStatus.signedIn ? s.userId : null));
    if (userId == null) return ReferralStatus.off;
    final store = ref.read(pendingInviteStoreProvider);
    final api = ref.read(apiClientProvider);
    final delay = ref.read(referralRetryDelayProvider);

    Future<ReferralStatus> once() async {
      String device;
      try {
        device = await store.installId();
      } on Object {
        device = '';
      }
      final res = await api
          .get(
            '/api/referrals',
            query: device.isEmpty ? null : {'device': device},
            options: const ApiOptions(receiveTimeout: referralReadTimeout, retries: 0),
            expectUserId: userId,
          )
          .timeout(referralReadTimeout + const Duration(seconds: 2));
      // An answer that is not the server's own ("ok") is a failed read, never "invites are off".
      if (asJson(res.data)['ok'] != true) throw const FormatException('referrals: no ok');
      return ReferralStatus.fromJson(res.data);
    }

    try {
      return await once();
    } on Object {
      await Future<void>.delayed(delay);
      return once();
    }
  },
  retry: (retryCount, error) => null,
);

/// What the server said to a claim. [done] means the invite is settled either way and was forgotten; a failure to reach
/// the server is not done (the invite is kept for the next try).
class ReferralClaimOutcome {
  const ReferralClaimOutcome({required this.ok, required this.done, this.reason, this.state});

  final bool ok;
  final bool done;

  /// The server's reason when [ok] is false: bad_code, unknown_code, self, already_referred, existing_account,
  /// user_not_found, off, rate_limited or unavailable (nothing was said).
  final String? reason;
  final String? state;

  /// Nothing was kept, so there was nothing to hand over.
  static const ReferralClaimOutcome nothing = ReferralClaimOutcome(ok: false, done: true, reason: 'no_invite');

  /// The kept code is the student's own: nothing is sent, and it is forgotten.
  static const ReferralClaimOutcome own = ReferralClaimOutcome(ok: false, done: true, reason: 'self');

  /// The server (or the app's own hold after a 429) asked for a wait: the invite is kept for the next try.
  static const ReferralClaimOutcome rateLimited = ReferralClaimOutcome(ok: false, done: false, reason: 'rate_limited');
  static const ReferralClaimOutcome unavailable = ReferralClaimOutcome(ok: false, done: false, reason: 'unavailable');
}

/// Hands the kept invite to the server (POST /api/referrals/claim) and forgets it when the server has settled it either
/// way. One claim at a time: a second caller waits for the first.
class ReferralClaimService {
  ReferralClaimService(this._ref);

  final Ref _ref;
  Future<ReferralClaimOutcome>? _inFlight;

  /// How long the app waits for the server's answer. A claim runs beside everything else (never in front of start-up or
  /// sign-in), and one that does not answer is kept for the next try.
  static const Duration timeout = Duration(seconds: 8);

  /// Claims the kept invite for the signed-in student. Never throws. A caller that arrives while a claim runs gets that
  /// claim's answer, unless it has just kept a new code ([fresh], a code typed by hand): then it waits for the running claim
  /// and hands its own over after it, so the answer it shows is about its own code.
  Future<ReferralClaimOutcome> claimPending({bool fresh = false}) {
    final running = _inFlight;
    if (running != null) return fresh ? running.then((_) => claimPending()) : running;
    final next = _run().whenComplete(() => _inFlight = null);
    return _inFlight = next;
  }

  Future<ReferralClaimOutcome> _run() async {
    try {
      final snapshot = _ref.read(authSnapshotProvider);
      final userId = snapshot.status == AuthStatus.signedIn ? snapshot.userId : null;
      if (userId == null) return ReferralClaimOutcome.unavailable;
      final store = _ref.read(pendingInviteStoreProvider);
      final pending = await store.read();
      if (pending == null) return ReferralClaimOutcome.nothing;
      // Never the inviter's own code: when the student's own code is already known it is not sent (the server refuses it too).
      if (_ref.exists(referralStatusProvider) && _ref.read(referralStatusProvider).value?.code == pending.code) {
        await store.clearIfCode(pending.code);
        return ReferralClaimOutcome.own;
      }
      final age = DateTime.now().difference(pending.at).inSeconds;
      final res = await _ref
          .read(apiClientProvider)
          .post(
            '/api/referrals/claim',
            body: {
              'code': pending.code,
              'source': pending.source,
              'linkAgeSeconds': age < 0 ? 0 : age,
              'device': await store.installId(),
            },
            options: const ApiOptions(receiveTimeout: timeout),
            expectUserId: userId,
          )
          .timeout(timeout);
      final j = asJson(res.data);
      final done = j['done'] == true;
      if (done) await store.clearIfCode(pending.code);
      final ok = j['ok'] == true;
      if (ok) _ref.invalidate(referralStatusProvider);
      return ReferralClaimOutcome(ok: ok, done: done, reason: ok ? null : (asString(j['reason']) ?? 'unavailable'), state: asString(j['state']));
    } on ApiError catch (e) {
      // Kept for the next try; a 429 says so plainly.
      return e.kind == ApiErrorKind.rateLimited ? ReferralClaimOutcome.rateLimited : ReferralClaimOutcome.unavailable;
    } on Object {
      // Kept for the next try.
      return ReferralClaimOutcome.unavailable;
    }
  }
}

final referralClaimServiceProvider = Provider<ReferralClaimService>((ref) => ReferralClaimService(ref));

/// Hands the kept invite to the server once a student is signed in (before any practice can run), and reads the Play
/// install referrer on a first launch. A failure keeps the invite for the next sign-in or launch. Started by the app's
/// services.
final referralClaimerProvider = Provider<void>((ref) {
  ref.listen<String?>(
    authSnapshotProvider.select((s) => s.status == AuthStatus.signedIn ? s.userId : null),
    (_, userId) {
      if (userId != null) unawaited(ref.read(referralClaimServiceProvider).claimPending());
    },
    fireImmediately: true,
  );
  ref.read(referralInstallReferrerProvider);
});
