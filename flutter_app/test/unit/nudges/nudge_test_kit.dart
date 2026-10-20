// Shared setup for the nudge widget tests and goldens: a signed-in student, Today calm, the account's data given
// whole as [NudgeSignals], and the phone's preferences in memory (pass the same store to a second pump for "the next
// run").
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:mockmob/core/api/api_providers.dart' show nowProvider;
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/billing/widgets/get_pro_entry.dart' show getProAvailableProvider;
import 'package:mockmob/features/nudges/nudges.dart';
import 'package:mockmob/features/pro_nudge/data/pro_nudge_controller.dart' show proNudgeInOnboardingProvider, proNudgePrefsProvider;
import 'package:mockmob/features/referrals/referral_data.dart' show ReferralStatus, referralStatusProvider;
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart' show FoldKey;

import '../practice/support/harness.dart' show FakeAuth;

/// 21 Oct 2026, 7:30 PM: the evening window, before the chain's last call.
final nudgeEvening = DateTime(2026, 10, 21, 19, 30);

/// 9:05 PM: the chain's last call.
final nudgeNight = DateTime(2026, 10, 21, 21, 5);

const nudgeStudent = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha Verma', subjects: ['accountancy']);

class CalmToday extends NudgeCalmController {
  CalmToday(this.calm);

  final bool calm;

  @override
  bool build() => calm;
}

/// Every kind's signals, as the demo and the goldens show them.
abstract final class NudgeFixtures {
  static final MobGameWaiting game = MobGameWaiting(gameId: 'g1', starterFirstName: 'Riya', kindLabel: 'sprint', closesAt: DateTime(2026, 10, 21, 21, 30));

  static NudgeSignals forKind(NudgeKind kind, {DateTime? now}) {
    final at = now ?? nudgeEvening;
    return switch (kind) {
      NudgeKind.friendPaid => const NudgeSignals(invitesLive: true, rewardEvents: ['reward:1']),
      NudgeKind.mobGame => NudgeSignals(mobGame: game, starter: const NudgeStarter(name: 'Riya', fold: FoldKey.patang, colour: 2)),
      NudgeKind.chainRisk => const NudgeSignals(chainDays: 5, chainEndsTonight: true, hasDailyGoal: true),
      NudgeKind.repairOpen => const NudgeSignals(openRepairs: 3),
      NudgeKind.practiceToday => const NudgeSignals(hasDailyGoal: true),
      NudgeKind.creditsLow => const NudgeSignals(invitesLive: true, credits: 6),
      NudgeKind.friendJoined => const NudgeSignals(invitesLive: true, friendsJoinedWaiting: 1),
      NudgeKind.goodResult => NudgeSignals(
          invitesLive: true,
          latestResult: LatestResult(attemptId: 'a9', completedAt: at.subtract(const Duration(hours: 1)), percent: 86),
        ),
    };
  }

  /// The time each kind's fixture is due at.
  static DateTime nowFor(NudgeKind kind) => kind == NudgeKind.chainRisk ? nudgeNight : nudgeEvening;
}

/// The facts the rules would read for [signals] on a calm Today, nothing shown yet.
NudgeFacts nudgeFactsFor(NudgeSignals s, DateTime now) => NudgeFacts(
      now: now,
      signedIn: true,
      inOnboarding: false,
      calmScreen: true,
      firstSession: false,
      isPro: s.isPro,
      invitesLive: s.invitesLive,
      credits: s.credits,
      openRepairs: s.openRepairs,
      lastRepairAt: s.lastRepairAt,
      practisedToday: s.practisedToday,
      hasDailyGoal: s.hasDailyGoal,
      chainDays: s.chainDays,
      chainEndsTonight: s.chainEndsTonight,
      mobGame: s.mobGame,
      friendsJoinedWaiting: s.friendsJoinedWaiting,
      rewardEvents: s.rewardEvents,
      latestResult: s.latestResult,
    );

/// The view a kind's fixture draws.
NudgeView nudgeViewOf(NudgeKind kind, {bool getPro = true}) {
  final now = NudgeFixtures.nowFor(kind);
  final s = NudgeFixtures.forKind(kind, now: now);
  final f = nudgeFactsFor(s, now);
  final offer = NudgeRules.pick(f)!;
  assert(offer.kind == kind, 'fixture for $kind picks ${offer.kind}');
  return nudgeViewFor(offer, f, s, getPro: getPro)!;
}

/// Overrides for a nudge test: [signals] as the account's data, [prefs] as the phone's preferences.
List<Override> nudgeOverrides({
  required NudgeSignals signals,
  required PrefsStore prefs,
  DateTime? now,
  bool calm = true,
  bool inOnboarding = false,
  bool getPro = false,
  Future<void> Function(String text)? share,
}) {
  final at = now ?? nudgeEvening;
  return [
    authSnapshotProvider.overrideWith(() => FakeAuth(nudgeStudent)),
    nowProvider.overrideWithValue(() => at),
    nudgePrefsProvider.overrideWithValue(prefs),
    proNudgePrefsProvider.overrideWithValue(MemoryPrefsStore()),
    nudgeSignalsProvider.overrideWithValue(signals),
    nudgeCalmProvider.overrideWith(() => CalmToday(calm)),
    proNudgeInOnboardingProvider.overrideWithValue(inOnboarding),
    getProAvailableProvider.overrideWithValue(getPro),
    referralStatusProvider.overrideWith((ref) async => ReferralStatus.off),
    nudgeInviteSharerProvider.overrideWithValue(share ?? (text) async {}),
  ];
}

/// A Today stand-in: the nudge over a plain lead block.
class NudgeHostPage extends StatelessWidget {
  const NudgeHostPage({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
        body: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(children: [TodayNudge(), SizedBox(height: 120, child: Placeholder())]),
          ),
        ),
      );
}
