import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/repositories/credits_repository.dart';
import 'credits_data.dart';

/// What the app knows about the two pools and the plan right now, from the best source it has:
/// `GET /api/me/credits` first, then the profile (Practice credits) and the AI wallet (AI credits)
/// the app already reads. A figure nothing has told us is null, never zero.
class CreditFigures {
  const CreditFigures({
    this.practice,
    this.ai,
    this.practiceRenews,
    this.aiRenews,
    this.isPro = false,
    this.proUntil,
    this.loading = false,
    this.failed = false,
    this.aiPaused = false,
  });

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
}

final creditFiguresProvider = Provider<CreditFigures>((ref) {
  final auth = ref.watch(authSnapshotProvider);
  final mine = ref.watch(meCreditsProvider);
  final overview = mine.value;
  // Only when the new read has nothing for AI credits does the older wallet read run too.
  final needWallet = !mine.isInitialLoading && overview?.ai.balance == null;
  final wallet = needWallet ? ref.watch(creditsRepositoryProvider).value : null;

  final practice = overview?.practice.balance ?? auth.creditBalance ?? wallet?.practiceBalance;
  final ai = overview?.ai.balance ?? wallet?.explanationBalance;
  final pro = overview != null ? overview.plan.isPro : auth.isPro;
  return CreditFigures(
    practice: practice,
    ai: ai,
    practiceRenews: overview?.practice.renewsOn,
    aiRenews: overview?.ai.renewsOn ?? wallet?.resetAt?.toLocal(),
    isPro: pro,
    proUntil: overview?.plan.until ?? auth.premiumUntil?.toLocal(),
    loading: mine.isInitialLoading && auth.creditBalance == null,
    failed: mine.isFailedEmpty,
    aiPaused: wallet?.isPaused ?? false,
  );
});
