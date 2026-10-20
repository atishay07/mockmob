/// Smart nudges (owner D191, 20 Oct 2026; design in docs/brain/V16-PLAN.md): the one quiet note that
/// points a student to what matters now, the way good consumer apps do, never pushy.
///
/// Pure rules, no Flutter, so a unit test can state each of them:
/// * at most one nudge per run of the app, on a calm screen only (Today's root, nothing over it);
///   never in onboarding, never during a run or a result, never over a sheet;
/// * each nudge is dismissible, and a dismissed kind stays quiet for [quietFor]; the daily kinds show
///   at most once a day; celebrations and game nudges are keyed by their event and never repeat;
/// * money nudges (credits low) obey D181: never in the first session after onboarding;
/// * the first kind that applies wins, in the order of [NudgeKind] (time-bound and social first).
library;

/// The kinds, in priority order.
enum NudgeKind {
  /// A friend's practice paid both of you (celebration, a sheet).
  friendPaid,

  /// A friend opened a Mob game you have not played (a sheet).
  mobGame,

  /// The personal chain ends at midnight with nothing done today.
  chainRisk,

  /// Mistakes are waiting to be fixed and nothing was fixed for two days.
  repairOpen,

  /// A daily goal exists and nothing was practised today, in the evening.
  practiceToday,

  /// A Free student with few credits, invites live.
  creditsLow,

  /// A friend joined with the link and has not practised yet.
  friendJoined,

  /// A good result: a moment to invite a friend.
  goodResult,
}

/// Where a nudge is drawn.
enum NudgeSurface { card, sheet }

/// A friend's open game, as the den's Now card knows it.
class MobGameWaiting {
  const MobGameWaiting({required this.gameId, required this.starterFirstName, required this.kindLabel, required this.closesAt});

  final String gameId;
  final String starterFirstName;

  /// "sprint", "race", "round" or "full mock".
  final String kindLabel;
  final DateTime closesAt;
}

/// The student's most recent scored result.
class LatestResult {
  const LatestResult({required this.attemptId, required this.completedAt, required this.percent, this.best = false});

  final String attemptId;
  final DateTime completedAt;

  /// Marks taken as a share of the marks on offer, 0 to 100.
  final int percent;

  /// A personal best in its subject.
  final bool best;
}

/// What the rules need to know. Anything nullable is "not known yet": a nudge that needs it stays quiet.
class NudgeFacts {
  const NudgeFacts({
    required this.now,
    required this.signedIn,
    required this.inOnboarding,
    required this.calmScreen,
    required this.firstSession,
    this.isPro = false,
    this.invitesLive = false,
    this.credits,
    this.openRepairs,
    this.lastRepairAt,
    this.practisedToday = false,
    this.hasDailyGoal = false,
    this.chainDays,
    this.chainEndsTonight = false,
    this.mobGame,
    this.friendsJoinedWaiting = 0,
    this.rewardEvents = const [],
    this.latestResult,
    this.dismissedAt = const {},
    this.seenEvents = const {},
    this.shownThisRun = false,
  });

  final DateTime now;
  final bool signedIn;
  final bool inOnboarding;

  /// Today's root is on top with nothing over it (no sheet, dialog, run or result).
  final bool calmScreen;

  /// The first usage session after onboarding (PopupRules.inFirstSession): no money nudge then (D181).
  final bool firstSession;
  final bool isPro;
  final bool invitesLive;

  /// Practice credits, null when unknown or stale.
  final int? credits;

  /// Mistakes still open on the account, null until the attempts list is read.
  final int? openRepairs;
  final DateTime? lastRepairAt;
  final bool practisedToday;
  final bool hasDailyGoal;

  /// The personal chain's length in days, null when unknown.
  final int? chainDays;

  /// Practised yesterday, nothing today: the chain ends at midnight unless a set is done.
  final bool chainEndsTonight;
  final MobGameWaiting? mobGame;

  /// Friends who joined with the link and have not finished a practice yet.
  final int friendsJoinedWaiting;

  /// One id per reward paid (the server's rewarded count, as ids), newest last.
  final List<String> rewardEvents;
  final LatestResult? latestResult;

  /// When each kind was last dismissed on this account.
  final Map<NudgeKind, DateTime> dismissedAt;

  /// Event ids already shown or dismissed (celebrations, games, days).
  final Set<String> seenEvents;

  /// A nudge was already shown in this run of the app.
  final bool shownThisRun;
}

/// The nudge to draw now.
class NudgeOffer {
  const NudgeOffer(this.kind, {required this.eventId, required this.surface});

  final NudgeKind kind;

  /// What marks this one as seen: a reward id, a game id, or `<kind>:<day>` for the daily kinds.
  final String eventId;
  final NudgeSurface surface;

  @override
  bool operator ==(Object other) => other is NudgeOffer && other.kind == kind && other.eventId == eventId && other.surface == surface;

  @override
  int get hashCode => Object.hash(kind, eventId, surface);

  @override
  String toString() => 'NudgeOffer($kind, $eventId, $surface)';
}

abstract final class NudgeRules {
  /// A dismissed kind stays quiet this long (the inline Pro rows' rule, InlineRules.quietFor).
  static const Duration quietFor = Duration(days: 7);

  /// A Free student with this many practice credits or fewer is low (ArmRules.creditsLimit).
  static const int creditsLow = 10;

  /// The evening window for "nothing practised today" (6 pm to 11 pm) and the chain's last call (8 pm on).
  static const int eveningFrom = 18;
  static const int eveningTo = 23;
  static const int chainCallFrom = 20;

  /// Nothing fixed for this long counts as a repair left waiting.
  static const Duration repairIdle = Duration(days: 2);

  /// A result older than this is no longer a moment.
  static const Duration resultFresh = Duration(hours: 24);

  /// A good result: this share of the marks, or a personal best.
  static const int goodPercent = 80;

  /// The day key of [at], in the student's local day ("2026-10-21").
  static String dayKey(DateTime at) => '${at.year}-${at.month.toString().padLeft(2, '0')}-${at.day.toString().padLeft(2, '0')}';

  static bool _quiet(NudgeFacts f, NudgeKind kind) {
    final at = f.dismissedAt[kind];
    return at != null && f.now.difference(at) < quietFor;
  }

  static NudgeOffer? _daily(NudgeFacts f, NudgeKind kind) {
    final id = '${kind.name}:${dayKey(f.now)}';
    if (_quiet(f, kind) || f.seenEvents.contains(id)) return null;
    return NudgeOffer(kind, eventId: id, surface: NudgeSurface.card);
  }

  /// The first nudge that applies, or null for a quiet screen.
  static NudgeOffer? pick(NudgeFacts f) {
    if (!f.signedIn || f.inOnboarding || !f.calmScreen || f.shownThisRun) return null;

    // 1. A friend's practice paid you both: the newest reward not yet celebrated.
    for (final id in f.rewardEvents.reversed) {
      if (!f.seenEvents.contains(id)) return NudgeOffer(NudgeKind.friendPaid, eventId: id, surface: NudgeSurface.sheet);
    }

    // 2. A friend's game is open and waiting (once per game, never after it closes).
    final game = f.mobGame;
    if (game != null && game.closesAt.isAfter(f.now) && !f.seenEvents.contains('game:${game.gameId}') && !_quiet(f, NudgeKind.mobGame)) {
      return NudgeOffer(NudgeKind.mobGame, eventId: 'game:${game.gameId}', surface: NudgeSurface.sheet);
    }

    // 3. The chain's last call: from 8 pm, two days or more at stake, nothing done today.
    if (f.chainEndsTonight && !f.practisedToday && (f.chainDays ?? 0) >= 2 && f.now.hour >= chainCallFrom) {
      final offer = _daily(f, NudgeKind.chainRisk);
      if (offer != null) return offer;
    }

    // 4. Mistakes waiting, nothing fixed for two days.
    final open = f.openRepairs ?? 0;
    final idle = f.lastRepairAt == null || f.now.difference(f.lastRepairAt!) >= repairIdle;
    if (open > 0 && idle) {
      final offer = _daily(f, NudgeKind.repairOpen);
      if (offer != null) return offer;
    }

    // 5. A goal and an empty evening.
    if (f.hasDailyGoal && !f.practisedToday && f.now.hour >= eveningFrom && f.now.hour < eveningTo) {
      final offer = _daily(f, NudgeKind.practiceToday);
      if (offer != null) return offer;
    }

    // 6. Credits low (money: never in the first session, never for Pro).
    final credits = f.credits;
    if (!f.isPro && !f.firstSession && f.invitesLive && credits != null && credits <= creditsLow) {
      final offer = _daily(f, NudgeKind.creditsLow);
      if (offer != null) return offer;
    }

    // 7. A friend joined and has not practised yet.
    if (f.invitesLive && f.friendsJoinedWaiting > 0) {
      final offer = _daily(f, NudgeKind.friendJoined);
      if (offer != null) return offer;
    }

    // 8. A good, fresh result: a moment to bring a friend (once per result).
    final r = f.latestResult;
    if (r != null && f.invitesLive && (r.percent >= goodPercent || r.best) && f.now.difference(r.completedAt) <= resultFresh) {
      final id = 'result:${r.attemptId}';
      if (!f.seenEvents.contains(id) && !_quiet(f, NudgeKind.goodResult)) {
        return NudgeOffer(NudgeKind.goodResult, eventId: id, surface: NudgeSurface.card);
      }
    }
    return null;
  }
}

/// What this account remembers about nudges on this phone: dismissals by kind and the events already
/// shown. Stored as one JSON string per account (`nudges.v1.<uid>`), bounded so it never grows forever.
class NudgeMemory {
  const NudgeMemory({this.dismissedAt = const {}, this.seenEvents = const {}});

  final Map<NudgeKind, DateTime> dismissedAt;
  final Set<String> seenEvents;

  /// Only this many events are kept (the newest).
  static const int keepEvents = 200;

  static const NudgeMemory empty = NudgeMemory();

  NudgeMemory dismiss(NudgeKind kind, DateTime at) => NudgeMemory(dismissedAt: {...dismissedAt, kind: at}, seenEvents: seenEvents);

  NudgeMemory seen(String eventId) {
    final next = [...seenEvents.where((e) => e != eventId), eventId];
    return NudgeMemory(dismissedAt: dismissedAt, seenEvents: next.length > keepEvents ? next.sublist(next.length - keepEvents).toSet() : next.toSet());
  }

  Map<String, Object?> toJson() => {
        'dismissed': {for (final e in dismissedAt.entries) e.key.name: e.value.toIso8601String()},
        'seen': seenEvents.toList(),
      };

  /// Reads what was saved; anything malformed is dropped rather than crashing.
  static NudgeMemory fromJson(Object? raw) {
    if (raw is! Map) return empty;
    final dismissed = <NudgeKind, DateTime>{};
    final d = raw['dismissed'];
    if (d is Map) {
      for (final entry in d.entries) {
        final kind = NudgeKind.values.where((k) => k.name == entry.key).firstOrNull;
        final at = entry.value is String ? DateTime.tryParse(entry.value as String) : null;
        if (kind != null && at != null) dismissed[kind] = at;
      }
    }
    final s = raw['seen'];
    final seen = s is List ? s.whereType<String>().toSet() : <String>{};
    return NudgeMemory(dismissedAt: dismissed, seenEvents: seen);
  }
}
