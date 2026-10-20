// The Wallet's read: `GET /api/wallet` (signed in), the one credits balance (owner D78, 18 Oct 2026).
//
//   {"ok": true,
//    "credits": {"total": n, "freeLeft": n, "freeAllowance": n, "held": n, "resetAt": ISO, "renewsOn": "YYYY-MM-DD",
//                "parts": {...}, "label": "Credits", "buys": text},
//    "plan": {"name": "Free" | "Pro", "until": "YYYY-MM-DD" | null},
//    "proOffer": {...} | null, "packs": [...], "commerce": {"open": bool, "message": text | null},
//    "history": [{"at": ISO, "pool": text, "what": text, "delta": n, "balanceAfter": n}] | null,
//    "historyState": "ready" | "unavailable"}
//
// "credits.total" is this month's free credits left plus the credits held. A number the server did not
// send is null and is never drawn as zero. A history that could not be read is null with historyState
// "unavailable": the balances stay. The app never reads "proOffer", "packs" or "commerce": they are the
// website's own prices and checkout state, and every price the app shows is Google Play's own string
// (lib/features/billing).

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/models/json_helpers.dart';
import '../../../core/repositories/json_remote_notifier.dart';
import '../../../core/repositories/remote_state.dart';
import '../wallet_copy.dart';

class WalletEntry {
  const WalletEntry({required this.at, required this.what, required this.delta, this.balanceAfter, this.pool});

  /// Null when the row is unusable (no time or no change): the page leaves it out.
  static WalletEntry? tryParse(Object? raw) {
    final j = asJson(raw);
    final at = asDate(j['at']);
    final delta = asInt(j['delta']);
    if (at == null || delta == null) return null;
    final pool = asStringOr(j['pool'], '').trim();
    return WalletEntry(at: at, what: asStringOr(j['what'], '').trim(), delta: delta, balanceAfter: asInt(j['balanceAfter']), pool: pool.isEmpty ? null : pool);
  }

  final DateTime at;

  /// The server's plain words, such as "Practice set, Accountancy".
  final String what;

  /// Negative for a spend, positive for a top-up or the monthly credits.
  final int delta;
  final int? balanceAfter;

  /// The server's pool for the line ("practice", "ai"), when it sent one: it picks the line's icon.
  final String? pool;

  bool get isSpend => delta < 0;
}

class WalletRead {
  const WalletRead({
    this.total,
    this.freeLeft,
    this.freeAllowance,
    this.resetAt,
    this.held,
    this.buys,
    this.planIsPro,
    this.planUntil,
    this.history = const [],
    this.historyUnavailable = false,
  });

  factory WalletRead.fromJson(Json j) {
    final credits = asJson(j['credits']);
    final plan = asJson(j['plan']);
    final freeLeft = asInt(credits['freeLeft']);
    final held = asInt(credits['held']);
    final rows = j['history'];
    final planName = asStringOr(plan['name'], '').trim();
    final buys = asStringOr(credits['buys'], '').trim();
    return WalletRead(
      // The server's own total; this month's free credits plus held only when it sent no total.
      total: asInt(credits['total']) ?? (freeLeft != null && held != null ? freeLeft + held : null),
      freeLeft: freeLeft,
      freeAllowance: asInt(credits['freeAllowance']),
      resetAt: asDate(credits['resetAt']),
      held: held,
      buys: buys.isEmpty ? null : buys,
      planIsPro: planName.isEmpty ? null : planName.toLowerCase() == 'pro',
      planUntil: asDate(plan['until']),
      history: [
        for (final row in (rows is List ? rows : const <Object?>[])) ?WalletEntry.tryParse(row),
      ],
      // null history, or the server's own "unavailable": the lines could not be read (an empty list is a real empty history).
      historyUnavailable: j['historyState'] == 'unavailable' || (j.containsKey('history') && rows == null),
    );
  }

  final int? total;
  final int? freeLeft;
  final int? freeAllowance;

  /// When the free credits reset: an instant, read on India's clock by the screen.
  final DateTime? resetAt;
  final int? held;

  /// The server's one sentence on what a credit buys, so the words follow its price list.
  final String? buys;

  /// The server says, in its own `buys` line, that the first full mock in each subject is free (release 11 with its
  /// switch on). False when the line is missing, was written by an older server, or has the switch off: no screen of the
  /// app may then say the first full mock is free.
  bool get firstFullMockFree => buys?.contains(WalletCopy.firstMockFreeClause) ?? false;

  /// The server's own plan: true for Pro, false for Free, null when it sent none.
  final bool? planIsPro;

  /// The day Pro ends (India's calendar day), when the server sent one.
  final DateTime? planUntil;

  /// Newest first.
  final List<WalletEntry> history;

  /// The balances read but the history did not.
  final bool historyUnavailable;
}

class WalletRepository extends JsonRemoteNotifier<WalletRead> {
  @override
  String get cacheKey => 'wallet';

  @override
  WalletRead parse(Object? json) => WalletRead.fromJson(asJson(json));

  @override
  Future<Object?> fetchJson() async => (await ref.read(apiClientProvider).get('/api/wallet')).data;
}

final walletRepositoryProvider = NotifierProvider<WalletRepository, RemoteState<WalletRead>>(WalletRepository.new);

/// Whether the server says the first full mock in each subject is free: the one signal the Help answer reads (the Wallet
/// shows the server's own line). False until the server has said so.
final firstFullMockFreeProvider = Provider<bool>((ref) => ref.watch(walletRepositoryProvider.select((s) => s.value?.firstFullMockFree ?? false)));

/// D165: whether the server says the welcome and invite offer is live (50 credits for a new account; 100 credits each
/// for a friend and the inviter once the friend finishes a first practice). No server field says so yet, so it is off
/// and nothing about invites or the 50 is shown.
// TODO(D165): read the referral server's live switch once web/1020-referrals ships one (for example in GET /api/wallet).
final referralOfferLiveProvider = Provider<bool>((ref) => false);

/// The same signal with "not known yet" kept apart from "no" (L-05): null until the Wallet's read has landed, so the
/// Pro page never prices every Free full mock at 50 credits before the server has said whether the first one is free.
final firstFullMockFreeKnownProvider = Provider<bool?>((ref) => ref.watch(walletRepositoryProvider.select((s) => s.value?.firstFullMockFree)));

const _ist = Duration(hours: 5, minutes: 30);

/// Everything the Wallet draws, in one plain value.
class WalletView {
  const WalletView({
    this.total,
    this.freeLeft,
    this.freeAllowance,
    this.resetsAt,
    this.held,
    this.buys,
    this.history = const [],
    this.historyUnavailable = false,
    this.isPro = false,
    this.proUntil,
    this.loading = false,
    this.failed = false,
    this.stale = false,
  });

  final int? total;
  final int? freeLeft;
  final int? freeAllowance;

  /// When the free credits reset, as a wall-clock time on India's clock (no zone).
  final DateTime? resetsAt;
  final int? held;

  /// What a credit buys, in the server's words; null falls back to the app's own line.
  final String? buys;
  final List<WalletEntry> history;

  /// The balances are known but the history could not be read.
  final bool historyUnavailable;
  final bool isPro;
  final DateTime? proUntil;

  /// The first read is still running and nothing is known yet.
  final bool loading;

  /// Nothing could be read and nothing is cached.
  final bool failed;

  /// The figures are the copy kept on the phone: the last read failed.
  final bool stale;
}

final walletViewProvider = Provider<WalletView>((ref) {
  final read = ref.watch(walletRepositoryProvider);
  final auth = ref.watch(authSnapshotProvider);
  final v = read.value;
  DateTime? wall(DateTime? at) {
    if (at == null) return null;
    final ist = at.toUtc().add(_ist);
    return DateTime(ist.year, ist.month, ist.day, ist.hour, ist.minute);
  }

  return WalletView(
    total: v?.total,
    freeLeft: v?.freeLeft,
    freeAllowance: v?.freeAllowance,
    resetsAt: wall(v?.resetAt),
    held: v?.held,
    buys: v?.buys,
    history: v?.history ?? const [],
    historyUnavailable: v?.historyUnavailable ?? false,
    // The wallet's own plan wins when the read carries one; the signed-in account says it otherwise.
    isPro: v?.planIsPro ?? auth.isPro,
    proUntil: v?.planUntil ?? auth.premiumUntil?.toLocal(),
    loading: read.isInitialLoading,
    failed: read.isFailedEmpty,
    stale: read.isStale,
  );
});
