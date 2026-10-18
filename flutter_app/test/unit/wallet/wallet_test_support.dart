// Shared by the Wallet unit, widget and golden tests: the credits reads the Wallet is built on
// (the You test kit's `/api/me/credits` fake and the AI wallet read), with Google Play's fakes.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/credits/data/credits_models.dart';

import '../billing/billing_test_support.dart';
import '../you/you_test_support.dart';

/// `GET /api/ai/credits` as the server sends it: 40 of 50 included left and 6 bought.
AiCredits aiWallet({int total = 46, int included = 40, int bonus = 6, bool paid = false}) => AiCredits.fromJson({
      'ok': true,
      'state': total > 0 ? 'available' : 'empty',
      'isPaid': paid,
      'wallet': {
        'state': total > 0 ? 'available' : 'empty',
        'known': true,
        'spendable': total > 0,
        'includedMonthlyCredits': 50,
        'includedRemaining': included,
        'bonusCredits': bonus,
        'total': total,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

List<Map<String, Object?>> walletHistory() => [
      {'at': '2026-10-14T13:12:00.000Z', 'pool': 'practice', 'what': 'Practice set, Accountancy', 'delta': -10, 'balanceAfter': 38},
      {'at': '2026-10-14T09:40:00.000Z', 'pool': 'ai', 'what': 'Repair, Q7 Accountancy', 'delta': -1, 'balanceAfter': 46},
      {'at': '2026-10-13T15:05:00.000Z', 'pool': 'practice', 'what': 'Full mock 7', 'delta': -50, 'balanceAfter': 48},
      {'at': '2026-10-01T00:00:00.000Z', 'pool': 'ai', 'what': 'Monthly AI credits', 'delta': 50, 'balanceAfter': 50},
    ];

/// The Wallet's overrides: signed in as the You kit's student, the credits reads, and (optionally)
/// the billing rig's Google Play fakes. [ai] null leaves the AI wallet unread.
List<Override> walletOverrides({
  RemoteState<CreditsOverview>? credits,
  AiCredits? ai,
  bool pro = false,
  bool aiUnread = false,
  BillingRig? rig,
  bool history = true,
}) {
  final base = youOverrides(
    credits: credits ??
        creditsState(
          practice: 38,
          ai: 46,
          pro: pro,
          proUntil: pro ? '2027-07-31' : null,
          history: history ? walletHistory() : const [],
        ),
  ).where((o) => !identical(o.origin, creditsRepositoryProvider)).toList();
  return [
    ...base,
    creditsRepositoryProvider.overrideWithBuild((ref, n) => aiUnread ? const RemoteState<AiCredits>() : RemoteState(value: ai ?? aiWallet(paid: pro))),
    ...?rig?.overrides,
  ];
}

AuthSnapshot get walletUser => youUser;
