import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/repositories/credits_repository.dart';
import '../../credits/data/credit_figures.dart';
import '../../credits/data/credits_data.dart' show meCreditsProvider;
import '../../insights/data/ask_wallet.dart' show AskWallet, nextIndiaMonthStart;
import '../../../core/api/api_providers.dart' show nowProvider;

/// Everything the Wallet draws about the two balances, in one plain value. Every figure the server
/// did not send is null and is never drawn as zero.
///
/// Today this is read from the app's existing credits reads (`GET /api/me/credits` for the plan,
/// the Practice balance and the history; `GET /api/ai/credits` for the AI wallet's included and
/// bought credits). When the website's single wallet read (`GET /api/wallet`) is live, only
/// [walletViewProvider] changes: the screen and its tests read this value.
class WalletView {
  const WalletView({
    this.practice,
    this.aiTotal,
    this.aiIncludedLeft,
    this.aiIncludedOf,
    this.aiBought,
    this.aiResetsAt,
    this.aiPaused = false,
    this.isPro = false,
    this.proUntil,
    this.loading = false,
    this.failed = false,
    this.stale = false,
  });

  /// Practice credits left, or null when unknown. A Pro student has no balance: see [isPro].
  final int? practice;

  /// AI credits that can be spent now: included left plus bought.
  final int? aiTotal;
  final int? aiIncludedLeft;
  final int? aiIncludedOf;

  /// Bought AI credits; they never expire.
  final int? aiBought;

  /// When the included AI credits renew, on India's clock, as a wall-clock time (no zone).
  final DateTime? aiResetsAt;
  final bool aiPaused;
  final bool isPro;
  final DateTime? proUntil;

  /// The first read is still running and nothing is known yet.
  final bool loading;

  /// Nothing could be read and nothing is cached.
  final bool failed;

  /// The figures are the copy kept on the phone: the last read failed.
  final bool stale;

  bool get practiceKnown => isPro || practice != null;
}

const _ist = Duration(hours: 5, minutes: 30);

final walletViewProvider = Provider<WalletView>((ref) {
  final figures = ref.watch(creditFiguresProvider);
  final read = ref.watch(creditsRepositoryProvider).value;
  final wallet = read == null ? null : AskWallet.fromCredits(read);
  final now = ref.watch(nowProvider)();
  // The reset the student reads is on India's calendar and clock. The wallet read gives an instant;
  // the credits overview gives a calendar day (midnight); with neither, the first of next month.
  final instant = wallet?.resetAt;
  final day = ref.watch(meCreditsProvider.select((s) => s.value?.ai.renewsOn));
  DateTime wall(DateTime at) {
    final ist = at.toUtc().add(_ist);
    return DateTime(ist.year, ist.month, ist.day, ist.hour, ist.minute);
  }

  final known = figures.ai != null || wallet?.total != null;
  final resetsAt = !known ? null : instant != null ? wall(instant) : day != null ? DateTime(day.year, day.month, day.day) : wall(nextIndiaMonthStart(now));
  return WalletView(
    practice: figures.practice,
    aiTotal: figures.ai ?? wallet?.total,
    aiIncludedLeft: wallet?.includedRemaining,
    aiIncludedOf: wallet?.includedMonthly,
    aiBought: (wallet?.bonus ?? 0) > 0 ? wallet!.bonus : null,
    aiResetsAt: resetsAt,
    aiPaused: figures.aiPaused,
    isPro: figures.isPro,
    proUntil: figures.proUntil,
    loading: figures.loading,
    failed: figures.failed,
    stale: figures.stale,
  );
});
