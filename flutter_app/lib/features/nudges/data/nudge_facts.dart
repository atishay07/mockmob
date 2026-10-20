import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../../core/models/attempt.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../credits/data/credit_figures.dart' show creditFiguresProvider;
import '../../pro_nudge/data/nudge_rules.dart' show PopupRules;
import '../../pro_nudge/data/pro_nudge_controller.dart' show proNudgeInOnboardingProvider, proNudgeLaunchProvider, proNudgeProvider;
import '../../referrals/referral_data.dart' show referralStatusProvider;
import '../../review/data/review_providers.dart' show openRepairsProvider, reviewInputsProvider;
import '../../social/v3/data/mob_v3_den.dart' show chainProvider, denViewProvider;
import '../../social/v3/data/mob_v3_models.dart';
import '../../social/v3/logic/den_copy_state.dart' show DenCardKind, denCardFor;
import '../../today/data/study_log_store.dart' show dailyGoalProvider;
import '../nudge_copy.dart';
import '../nudge_rules.dart';
import 'nudge_store.dart';

/// The friend whose game is waiting, as the den draws them.
class NudgeStarter {
  const NudgeStarter({required this.name, this.fold, this.colour = 0});

  final String name;
  final FoldKey? fold;
  final int colour;
}

/// What the account's data says, before the run's own rules (the screen, the memory) are applied. Anything not
/// known stays null or false, and a nudge that needs it stays quiet. Replaceable whole in tests and the demo.
class NudgeSignals {
  const NudgeSignals({
    this.isPro = false,
    this.invitesLive = false,
    this.reward = 100,
    this.credits,
    this.openRepairs,
    this.lastRepairAt,
    this.practisedToday = false,
    this.hasDailyGoal = false,
    this.chainDays,
    this.chainEndsTonight = false,
    this.mobGame,
    this.starter,
    this.friendsJoinedWaiting = 0,
    this.rewardEvents = const [],
    this.latestResult,
  });

  static const NudgeSignals none = NudgeSignals();

  final bool isPro;
  final bool invitesLive;

  /// The server's reward per friend (100 today).
  final int reward;
  final int? credits;
  final int? openRepairs;
  final DateTime? lastRepairAt;
  final bool practisedToday;
  final bool hasDailyGoal;
  final int? chainDays;
  final bool chainEndsTonight;
  final MobGameWaiting? mobGame;
  final NudgeStarter? starter;
  final int friendsJoinedWaiting;
  final List<String> rewardEvents;
  final LatestResult? latestResult;
}

/// Whether the account's data is worth reading now: Today is calm, or a nudge is on screen and must stay true.
/// Asleep, nothing below reads the network-backed providers, so the nudges cost nothing off Today.
final nudgeAwakeProvider = Provider<bool>((ref) {
  final s = ref.watch(nudgeControllerProvider);
  if (!s.loaded || s.closed) return false;
  if (s.shown != null) return true;
  return ref.watch(nudgeCalmProvider);
});

String _day(DateTime at) => NudgeRules.dayKey(at);

/// The share of the marks on offer, 0 to 100.
int _percent(Attempt a) {
  if (a.maxMarks <= 0) return 0;
  return (a.marks * 100 / a.maxMarks).round().clamp(0, 100);
}

/// What the attempts list says: practised today, and the latest scored result (a best when it beats every earlier
/// paper in its subject). Exposed for tests.
({bool practisedToday, LatestResult? latest}) attemptSignals(List<Attempt> attempts, DateTime now) {
  final today = _day(now);
  var practised = false;
  Attempt? latest;
  for (final a in attempts) {
    if (_day(a.completedAt.toLocal()) == today) practised = true;
    if (a.mobHold != null || a.total <= 0) continue;
    if (latest == null || a.completedAt.isAfter(latest.completedAt)) latest = a;
  }
  if (latest == null) return (practisedToday: practised, latest: null);
  final percent = _percent(latest);
  var earlier = 0;
  var beaten = true;
  for (final a in attempts) {
    if (a.id == latest.id || a.subject != latest.subject || a.mobHold != null || a.total <= 0) continue;
    earlier++;
    if (_percent(a) >= percent) beaten = false;
  }
  return (
    practisedToday: practised,
    latest: LatestResult(attemptId: latest.id, completedAt: latest.completedAt, percent: percent, best: earlier > 0 && beaten),
  );
}

/// The den's step 4 (a friend's open game you have not played), as the nudge needs it. Exposed for tests.
({MobGameWaiting game, NudgeStarter starter})? gameWaitingIn(MobV3 v3) {
  final card = denCardFor(v3);
  final g = card.game;
  if (card.kind != DenCardKind.open || g == null) return null;
  final host = g.host;
  final closes = g.closesAt;
  if (host == null || host.you || closes == null || g.closed) return null;
  final member = v3.members.where((m) => m.memberId == host.memberId).firstOrNull;
  final name = host.name.trim().isEmpty ? (member?.name ?? '') : host.name.trim();
  final first = name.split(RegExp(r'\s+')).first;
  if (first.isEmpty) return null;
  final label = switch (g.format) {
    GameFormat.race => 'race',
    GameFormat.round => 'round',
    GameFormat.mock => 'full mock',
    GameFormat.sprint || GameFormat.rematch => 'sprint',
  };
  return (
    game: MobGameWaiting(gameId: g.id, starterFirstName: first, kindLabel: label, closesAt: closes.toLocal()),
    starter: NudgeStarter(name: first, fold: member?.fold, colour: member?.colour ?? 0),
  );
}

/// The newest repair this phone or the account knows of.
DateTime? _newestRepair(Iterable<DateTime?> times) {
  DateTime? newest;
  for (final at in times) {
    if (at != null && (newest == null || at.isAfter(newest))) newest = at;
  }
  return newest;
}

/// The account's data, assembled from what the app already reads. Null while asleep ([nudgeAwakeProvider]).
final nudgeSignalsProvider = Provider<NudgeSignals?>((ref) {
  if (!ref.watch(nudgeAwakeProvider)) return null;
  final now = ref.watch(nowProvider)();

  // Credits and Pro: practice credits (or the one balance), null while loading, failed or a stale copy.
  final credit = ref.watch(creditFiguresProvider.select((f) => (
        isPro: f.isPro,
        credits: f.isPro || f.loading || f.failed || f.stale ? null : (f.oneBalance ? f.total : f.practice),
      )));

  // Invites: live and paying (not paused, the month's cap not reached).
  final referral = ref.watch(referralStatusProvider.select((a) {
    final s = a.value;
    if (s == null || !s.live) return null;
    final waiting = s.joined - s.practised;
    return (paying: !s.paused && !s.capReached, reward: s.reward, waiting: waiting < 0 ? 0 : waiting, rewarded: s.rewarded);
  }));

  // Repairs: open mistakes, and the newest repair made.
  final openRepairs = ref.watch(openRepairsProvider);
  final lastRepairAt = ref.watch(reviewInputsProvider.select((i) => _newestRepair([
        for (final r in i.records)
          if (r.isRepaired) r.ackedAt,
        ...i.saved.values,
      ])));

  final attempts = ref.watch(attemptsRepositoryProvider.select((s) => s.value));
  final fromAttempts = attempts == null ? null : attemptSignals(attempts, now);
  final practisedToday = fromAttempts?.practisedToday ?? false;

  // The chain matters only from its last call on, with nothing done today: it is read then, never before.
  int? chainDays;
  var chainEndsTonight = false;
  if (now.hour >= NudgeRules.chainCallFrom && fromAttempts != null && !practisedToday) {
    final chain = ref.watch(chainProvider.select((a) => a.value));
    if (chain != null && !chain.hidden) {
      chainDays = chain.days;
      chainEndsTonight = chain.days >= 1 && !chain.todayDone && chain.passesHeld == 0 && !chain.pauseDays.contains(_day(now));
    }
  }

  final waiting = ref.watch(denViewProvider.select((d) => d == null ? null : gameWaitingIn(d.v3)));
  final rewarded = referral?.rewarded ?? 0;

  return NudgeSignals(
    isPro: credit.isPro,
    invitesLive: referral?.paying ?? false,
    reward: referral?.reward ?? 100,
    credits: credit.credits,
    openRepairs: openRepairs,
    lastRepairAt: lastRepairAt,
    practisedToday: practisedToday,
    hasDailyGoal: ref.watch(dailyGoalProvider) != null,
    chainDays: chainDays,
    chainEndsTonight: chainEndsTonight,
    mobGame: waiting?.game,
    starter: waiting?.starter,
    friendsJoinedWaiting: referral?.waiting ?? 0,
    // Only the newest reward is an event: a new reward is a new id, and older ones are never celebrated late.
    rewardEvents: rewarded > 0 ? ['reward:$rewarded'] : const [],
    latestResult: fromAttempts?.latest,
  );
});

/// The facts the rules read: the account's data and this run's screen and memory. Null until both are known.
final nudgeFactsProvider = Provider<NudgeFacts?>((ref) {
  final s = ref.watch(nudgeControllerProvider);
  if (!s.loaded) return null;
  final signals = ref.watch(nudgeSignalsProvider);
  if (signals == null) return null;
  final now = ref.watch(nowProvider)();
  final signedIn = ref.watch(authSnapshotProvider.select((a) => a.status == AuthStatus.signedIn));
  // The first usage session after onboarding (D181): unknown counts as inside it, so no money nudge slips in early.
  final pro = ref.watch(proNudgeProvider.select((p) => (loaded: p.loaded, at: p.saved.onboardedAt, launch: p.saved.onboardedLaunch)));
  final firstSession = !pro.loaded || PopupRules.inFirstSession(launchId: ref.watch(proNudgeLaunchProvider), now: now, onboardedAt: pro.at, onboardedLaunch: pro.launch);
  return NudgeFacts(
    now: now,
    signedIn: signedIn,
    inOnboarding: ref.watch(proNudgeInOnboardingProvider),
    calmScreen: ref.watch(nudgeCalmProvider),
    firstSession: firstSession,
    isPro: signals.isPro,
    invitesLive: signals.invitesLive,
    credits: signals.credits,
    openRepairs: signals.openRepairs,
    lastRepairAt: signals.lastRepairAt,
    practisedToday: signals.practisedToday,
    hasDailyGoal: signals.hasDailyGoal,
    chainDays: signals.chainDays,
    chainEndsTonight: signals.chainEndsTonight,
    mobGame: signals.mobGame,
    friendsJoinedWaiting: signals.friendsJoinedWaiting,
    rewardEvents: signals.rewardEvents,
    latestResult: signals.latestResult,
    dismissedAt: s.memory.dismissedAt,
    seenEvents: s.memory.seenEvents,
    shownThisRun: s.shownThisRun,
  );
});

/// The same facts as the rules saw them when [shown] was picked: a calm screen, nothing shown yet, its event unseen.
NudgeFacts _asWhenPicked(NudgeFacts f, NudgeOffer shown) => NudgeFacts(
      now: f.now,
      signedIn: f.signedIn,
      inOnboarding: f.inOnboarding,
      calmScreen: true,
      firstSession: f.firstSession,
      isPro: f.isPro,
      invitesLive: f.invitesLive,
      credits: f.credits,
      openRepairs: f.openRepairs,
      lastRepairAt: f.lastRepairAt,
      practisedToday: f.practisedToday,
      hasDailyGoal: f.hasDailyGoal,
      chainDays: f.chainDays,
      chainEndsTonight: f.chainEndsTonight,
      mobGame: f.mobGame,
      friendsJoinedWaiting: f.friendsJoinedWaiting,
      rewardEvents: f.rewardEvents,
      latestResult: f.latestResult,
      dismissedAt: f.dismissedAt,
      seenEvents: {...f.seenEvents}..remove(shown.eventId),
    );

/// The nudge for Today now: this run's shown card while it still applies, else the rules' pick (not shown yet).
/// A sheet, once shown, leaves nothing on Today.
final nudgeOfferProvider = Provider<NudgeOffer?>((ref) {
  final s = ref.watch(nudgeControllerProvider);
  if (!s.loaded || s.closed) return null;
  final facts = ref.watch(nudgeFactsProvider);
  if (facts == null) return null;
  final shown = s.shown;
  if (shown == null) return NudgeRules.pick(facts);
  if (shown.surface == NudgeSurface.sheet) return null;
  // A card stays for the run while what it says is still true (a set done since takes "Practise 10" away).
  return NudgeRules.pick(_asWhenPicked(facts, shown)) == shown ? shown : null;
});

/// The words of one nudge, from the facts it was picked on.
class NudgeView {
  const NudgeView({required this.offer, required this.title, required this.line, required this.key, this.secondary, this.reward = 100, this.game, this.starter});

  final NudgeOffer offer;
  final String title;
  final String line;
  final String key;

  /// The quiet second key ("Get Pro", "See invites", "Not now"), when there is one.
  final String? secondary;
  final int reward;
  final MobGameWaiting? game;
  final NudgeStarter? starter;

  NudgeKind get kind => offer.kind;
}

/// The words for [offer]; null when a figure it needs is not known (it then stays quiet). [getPro] says whether
/// the Get Pro sheet exists for this student (Google Play billing on, Free).
NudgeView? nudgeViewFor(NudgeOffer offer, NudgeFacts f, NudgeSignals s, {bool getPro = false}) {
  final reward = s.reward;
  switch (offer.kind) {
    case NudgeKind.friendPaid:
      return NudgeView(offer: offer, title: NudgeCopy.friendPaidTitle(reward), line: NudgeCopy.friendPaidLine, key: NudgeCopy.friendPaidKey, secondary: NudgeCopy.friendPaidSecondary, reward: reward);
    case NudgeKind.mobGame:
      final g = f.mobGame;
      if (g == null) return null;
      return NudgeView(offer: offer, title: NudgeCopy.mobGameTitle(g), line: NudgeCopy.mobGameLine(g), key: NudgeCopy.mobGameKey, secondary: NudgeCopy.dismiss, game: g, starter: s.starter);
    case NudgeKind.chainRisk:
      final days = f.chainDays;
      if (days == null) return null;
      return NudgeView(offer: offer, title: NudgeCopy.chainRiskTitle(days), line: NudgeCopy.chainRiskLine, key: NudgeCopy.chainRiskKey);
    case NudgeKind.repairOpen:
      final open = f.openRepairs;
      if (open == null || open <= 0) return null;
      return NudgeView(offer: offer, title: NudgeCopy.repairOpenTitle(open), line: NudgeCopy.repairOpenLine, key: NudgeCopy.repairOpenKey);
    case NudgeKind.practiceToday:
      return NudgeView(offer: offer, title: NudgeCopy.practiceTodayTitle, line: NudgeCopy.practiceTodayLine, key: NudgeCopy.practiceTodayKey);
    case NudgeKind.creditsLow:
      final credits = f.credits;
      if (credits == null) return null;
      return NudgeView(
        offer: offer,
        title: NudgeCopy.creditsLowTitle(credits),
        line: NudgeCopy.creditsLowLine(reward),
        key: NudgeCopy.creditsLowKey,
        secondary: getPro ? NudgeCopy.creditsLowSecondary : null,
        reward: reward,
      );
    case NudgeKind.friendJoined:
      return NudgeView(offer: offer, title: NudgeCopy.friendJoinedTitle(f.friendsJoinedWaiting), line: NudgeCopy.friendJoinedLine(reward), key: NudgeCopy.friendJoinedKey, reward: reward);
    case NudgeKind.goodResult:
      return NudgeView(offer: offer, title: NudgeCopy.goodResultTitle, line: NudgeCopy.goodResultLine(reward), key: NudgeCopy.goodResultKey, reward: reward);
  }
}
