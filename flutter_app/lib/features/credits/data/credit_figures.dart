import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../wallet/data/wallet_data.dart';
import 'credits_data.dart';

/// How the server keeps credits, decided from what it answers (owner D78, release 10, 18 Oct 2026).
enum CreditsMode {
  /// Nothing has answered yet.
  unknown,

  /// One credits balance: `GET /api/wallet` answers with a total, or `GET /api/me/credits` carries the
  /// `total` block. Every screen shows one figure called "credits".
  oneBalance,

  /// An older server (`GET /api/wallet` is 404 and `/api/me/credits` has no total): Practice credits and
  /// AI credits are two separate balances, and the app says so.
  twoPools,
}

/// The mode for the signed-in account. Both reads are cached on the phone and keep their last value when a
/// later read fails, so once a server has said "one balance" the app keeps saying it for the session.
final creditsModeProvider = Provider<CreditsMode>((ref) {
  final wallet = ref.watch(walletRepositoryProvider);
  final mine = ref.watch(meCreditsProvider);
  if (wallet.value?.total != null || mine.value?.total?.balance != null) return CreditsMode.oneBalance;
  // The credits read answered without a usable total: an older server (release 9 has no total block and no
  // wallet route, which answers 404), so its two balances are what is true there.
  if (mine.value != null) return CreditsMode.twoPools;
  // Neither read could answer and nothing is kept on the phone: the two-pool display, which reads "Not loaded".
  if (mine.isFailedEmpty && (wallet.isFailedEmpty || wallet.value != null)) return CreditsMode.twoPools;
  return CreditsMode.unknown;
});

/// What the app knows about the credits and the plan right now, from the best source it has.
///
/// One balance mode: [total] is the one figure (the newer of `GET /api/wallet` and the `total` block of
/// `GET /api/me/credits`), with this month's free credits and the credits held. [practice] and [ai] then
/// both carry that same total, because either kind of spend comes out of it: a screen that asks "can this
/// student afford it" gets the right answer, and no screen can show two figures that differ.
///
/// Two-pool mode: `GET /api/me/credits` first, then the profile (Practice credits) and the AI wallet (AI
/// credits) the app already reads. A figure nothing has told us is null, never zero.
class CreditFigures {
  const CreditFigures({
    this.mode = CreditsMode.twoPools,
    this.total,
    this.freeLeft,
    this.freeAllowance,
    this.held,
    this.freeRenews,
    this.practice,
    this.ai,
    this.practiceRenews,
    this.aiRenews,
    this.isPro = false,
    this.proUntil,
    this.loading = false,
    this.failed = false,
    this.aiPaused = false,
    this.stale = false,
  });

  final CreditsMode mode;

  /// The server keeps one credits balance: show [total] and never "Practice credits" or "AI credits".
  bool get oneBalance => mode == CreditsMode.oneBalance;

  /// The one credits balance (one balance mode only).
  final int? total;

  /// This month's free credits left and the monthly allowance (one balance mode only).
  final int? freeLeft;
  final int? freeAllowance;

  /// Credits the student holds beyond this month's free ones; they do not expire (one balance mode only).
  final int? held;

  /// The day the free credits come back (one balance mode only).
  final DateTime? freeRenews;

  final int? practice;
  final int? ai;
  final DateTime? practiceRenews;
  final DateTime? aiRenews;
  final bool isPro;
  final DateTime? proUntil;

  /// The first read is still running and nothing is known yet.
  final bool loading;

  /// The credits read failed and nothing came from the cache.
  final bool failed;

  /// The AI wallet says replies are paused.
  final bool aiPaused;

  /// The last read failed and the figures are the saved copy: they may be from before the last set or repair.
  /// A line that says "You have 40" should not be built on them (v13 walk, finding 4).
  final bool stale;
}

const _ist = Duration(hours: 5, minutes: 30);

/// The India calendar day of an instant.
DateTime? _indiaDay(DateTime? at) {
  if (at == null) return null;
  final ist = at.toUtc().add(_ist);
  return DateTime(ist.year, ist.month, ist.day);
}

final creditFiguresProvider = Provider<CreditFigures>((ref) {
  final auth = ref.watch(authSnapshotProvider);
  final mine = ref.watch(meCreditsProvider);
  final mode = ref.watch(creditsModeProvider);
  final overview = mine.value;
  final pro = overview != null ? overview.plan.isPro : auth.isPro;
  final proUntil = overview?.plan.until ?? auth.premiumUntil?.toLocal();

  if (mode == CreditsMode.oneBalance) {
    final walletRead = ref.watch(walletRepositoryProvider);
    final w = walletRead.value;
    final t = overview?.total;
    // The newer of the two reads wins. The credits read is the one read again after every spend (a set
    // started, an Ask Mobi reply, a repair), so it is usually the newer.
    final walletAt = w?.total == null ? null : walletRead.fetchedAt;
    final mineAt = t?.balance == null ? null : mine.fetchedAt;
    final useWallet = walletAt != null && (mineAt == null || walletAt.isAfter(mineAt));
    final total = useWallet ? w!.total : t?.balance;
    final freeLeft = useWallet ? w!.freeLeft : t?.freeLeft;
    final freeAllowance = useWallet ? w!.freeAllowance : t?.freeAllowance;
    final held = useWallet ? w!.held : t?.held;
    final renews = useWallet ? _indiaDay(w!.resetAt) : t?.renewsOn;
    final aiWallet = ref.watch(creditsRepositoryProvider).value;
    return CreditFigures(
      mode: mode,
      total: total,
      freeLeft: freeLeft,
      freeAllowance: freeAllowance,
      held: held,
      freeRenews: renews,
      practice: total,
      ai: total,
      aiRenews: renews,
      isPro: w?.planIsPro ?? pro,
      proUntil: w?.planUntil ?? proUntil,
      aiPaused: aiWallet?.isPaused ?? false,
      stale: useWallet ? walletRead.isStale : mine.isStale,
    );
  }

  if (mode == CreditsMode.unknown) {
    // Before the server has said how it keeps credits, no figure is drawn: the profile's balance is the
    // one total on a one-balance server and Practice credits on an older one, so it cannot be labelled yet.
    return CreditFigures(mode: mode, isPro: pro, proUntil: proUntil, loading: true);
  }

  // Only when the new read has nothing for AI credits does the older wallet read run too.
  final needWallet = !mine.isInitialLoading && overview?.ai.balance == null;
  final wallet = needWallet ? ref.watch(creditsRepositoryProvider).value : null;

  final practice = overview?.practice.balance ?? auth.creditBalance ?? wallet?.practiceBalance;
  final ai = overview?.ai.balance ?? wallet?.explanationBalance;
  return CreditFigures(
    mode: mode,
    practice: practice,
    ai: ai,
    practiceRenews: overview?.practice.renewsOn,
    aiRenews: overview?.ai.renewsOn ?? wallet?.resetAt?.toLocal(),
    isPro: pro,
    proUntil: proUntil,
    loading: mine.isInitialLoading && auth.creditBalance == null,
    failed: mine.isFailedEmpty,
    aiPaused: wallet?.isPaused ?? false,
    stale: mine.isStale,
  );
});
