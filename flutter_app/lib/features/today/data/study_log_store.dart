// The smart layer's phone store (SMART-LAYER-1019PM 2.2 and 2.6): the study log, the deck's
// reactions and the student's corrections, per account, in the phone's preferences. Nothing here is
// sent anywhere. Filled from the student's own papers (the attempts the app already reads) and from
// what this phone sees: where a session was started, the length suggested and picked, repairs, the
// deck's Up next and Not now. Wiped on sign-out and account deletion.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart' show BuildContext;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/auth/auth_state.dart';
import '../../../core/auth/sign_out_hooks.dart';
import '../../../core/models/attempt.dart';
import '../../../core/repositories/repositories.dart' show attemptsRepositoryProvider, userIdProvider;
import '../../../core/storage/prefs_store.dart';
import '../../onboarding/model/deck.dart' show Steps;
import '../../onboarding/state/answers_controller.dart' show onboardingAnswersProvider;
import '../../you/data/study_length.dart' show sessionMinutesForServer, studyLengthProvider;
import '../logic/study_log.dart';
import '../logic/study_pattern.dart';
import 'today_providers.dart' show todayStudentDayProvider;

/// The phone's preferences (tests put a memory store here).
final studyLogPrefsProvider = Provider<PrefsStore>((ref) => SharedPrefsStore());

/// Everything the store keeps for one account.
class StudyLogState {
  const StudyLogState({
    this.userId,
    this.loaded = false,
    this.log = const [],
    this.contexts = const [],
    this.reactions,
    this.notes = const PatternNotes(),
  });

  final String? userId;
  final bool loaded;
  final List<StudyLogEntry> log;
  final List<StudyContext> contexts;
  final DeckReactions? reactions;
  final PatternNotes notes;

  DeckReactions get deck => reactions ?? DeckReactions();

  StudyLogState copyWith({bool? loaded, List<StudyLogEntry>? log, List<StudyContext>? contexts, DeckReactions? reactions, PatternNotes? notes}) => StudyLogState(
        userId: userId,
        loaded: loaded ?? this.loaded,
        log: log ?? this.log,
        contexts: contexts ?? this.contexts,
        reactions: reactions ?? this.reactions,
        notes: notes ?? this.notes,
      );

  Map<String, Object?> toJson() => {
        'v': 1,
        'log': [for (final e in log) e.toJson()],
        'ctx': [for (final c in contexts) c.toJson()],
        'deck': deck.toJson(),
        'notes': notes.toJson(),
      };

  static StudyLogState fromJson(String userId, Object? raw) {
    if (raw is! Map || raw['v'] != 1) return StudyLogState(userId: userId, loaded: true);
    return StudyLogState(
      userId: userId,
      loaded: true,
      log: [for (final e in (raw['log'] is List ? raw['log'] as List : const [])) ?StudyLogEntry.fromJson(e)],
      contexts: [for (final c in (raw['ctx'] is List ? raw['ctx'] as List : const [])) ?StudyContext.fromJson(c)],
      reactions: DeckReactions.fromJson(raw['deck']),
      notes: PatternNotes.fromJson(raw['notes']),
    );
  }
}

/// The key one account's store lives under.
String studyLogKey(String userId) => 'study_log.v1.$userId';

/// A start Today asked for, waiting for the practice starter to say a session began.
class _PendingStart {
  const _PendingStart(this.atMs, this.source, this.suggested, this.chosen);

  final int atMs;
  final String source;
  final int? suggested;
  final int? chosen;
}

class StudyLogController extends Notifier<StudyLogState> {
  static bool _hookRegistered = false;
  static String? _signedInUser;
  static PrefsStore? _hookStore;

  _PendingStart? _pending;
  Timer? _saveTimer;

  /// How long a start asked for by Today waits for its session to begin.
  static const Duration pendingWindow = Duration(minutes: 3);

  /// Contexts older than this are dropped (their paper never came).
  static const Duration contextLife = Duration(hours: 6);

  @override
  StudyLogState build() {
    final uid = ref.watch(userIdProvider);
    ref.onDispose(() {
      _saveTimer?.cancel();
      _saveTimer = null;
    });
    if (uid == null) return const StudyLogState();
    final store = ref.read(studyLogPrefsProvider);
    _signedInUser = uid;
    _hookStore = store;
    if (!_hookRegistered) {
      _hookRegistered = true;
      // Sign-out and account deletion both run the hooks: this account's log goes with them.
      SignOutHooks.register(() async {
        final who = _signedInUser;
        if (who != null) await _hookStore?.remove(studyLogKey(who));
      });
    }
    unawaited(_load(uid, store));
    return StudyLogState(userId: uid);
  }

  Future<void> _load(String uid, PrefsStore store) async {
    StudyLogState loaded;
    try {
      final raw = await store.getString(studyLogKey(uid));
      loaded = raw == null ? StudyLogState(userId: uid, loaded: true) : StudyLogState.fromJson(uid, jsonDecode(raw));
    } on Object {
      loaded = StudyLogState(userId: uid, loaded: true);
    }
    if (!ref.mounted || state.userId != uid) return;
    // Anything recorded while the read was in flight is kept.
    state = loaded.copyWith(
      log: pruneLog([...loaded.log, ...state.log], _now()),
      contexts: [...loaded.contexts, ...state.contexts],
    );
    ref.listen<List<Attempt>?>(attemptsRepositoryProvider.select((s) => s.value), (_, next) {
      if (next != null) mergePapers(next);
    }, fireImmediately: true);
    ref.listen<int?>(dailyGoalProvider, (_, goal) {
      if (goal != null && state.notes.goalSetAtMs == null) markGoalSet();
    }, fireImmediately: true);
  }

  DateTime _now() => ref.read(nowProvider)();

  void _set(StudyLogState next) {
    state = next;
    _scheduleSave();
  }

  void _scheduleSave() {
    final uid = state.userId;
    if (uid == null || !state.loaded) return;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 300), () {
      _saveTimer = null;
      unawaited(_save());
    });
  }

  Future<void> _save() async {
    final uid = state.userId;
    if (uid == null || !state.loaded || !ref.mounted) return;
    try {
      await ref.read(studyLogPrefsProvider).setString(studyLogKey(uid), jsonEncode(state.toJson()));
    } on Object {
      // A comfort, never a reason to fail: the papers fill the log again next time.
    }
  }

  /// Writes now (tests, and before the app goes to the background).
  Future<void> flush() async {
    _saveTimer?.cancel();
    _saveTimer = null;
    await _save();
  }

  /// The account's papers: every one the log does not hold becomes an entry (backfill on first
  /// read, then each new paper as it arrives), joined to how this phone started it.
  void mergePapers(List<Attempt> attempts) {
    if (!state.loaded) return;
    final now = _now();
    final have = {for (final e in state.log) e.id};
    final fresh = [for (final a in attempts) if (a.id.isNotEmpty && !have.contains(a.id)) a];
    if (fresh.isEmpty) return;
    final used = <StudyContext>{};
    final contexts = [...state.contexts];
    final entries = <StudyLogEntry>[];
    for (final a in fresh) {
      final c = contextFor(a, [for (final x in contexts) if (!used.contains(x)) x]);
      if (c != null) used.add(c);
      entries.add(entryFromAttempt(a, context: c));
    }
    final cutoff = now.millisecondsSinceEpoch - contextLife.inMilliseconds;
    _set(state.copyWith(
      log: pruneLog([...state.log, ...entries], now),
      contexts: [for (final c in contexts) if (!used.contains(c) && c.atMs >= cutoff) c],
    ));
  }

  /// Today's card is about to start a session: [source] (the lead or a card from the deck), the
  /// length Today suggested and the one the student has on the card.
  void noteTodayStart({required String source, int? suggested, int? chosen}) {
    _pending = _PendingStart(_now().millisecondsSinceEpoch, source, suggested, chosen);
  }

  /// A practice session began, in the app's own [mode] (chapter practice is its own mode here).
  void noteSessionStarted({required String mode}) {
    final now = _now().millisecondsSinceEpoch;
    final p = _pending;
    final fromToday = p != null && now - p.atMs <= pendingWindow.inMilliseconds;
    _pending = null;
    final ctx = StudyContext(
      atMs: now,
      source: fromToday ? p.source : StudySource.practice,
      mode: mode == StudyMode.chapter ? StudyMode.chapter : null,
      suggestedMinutes: fromToday ? p.suggested : null,
      chosenMinutes: fromToday ? p.chosen : null,
    );
    final cutoff = now - contextLife.inMilliseconds;
    _set(state.copyWith(contexts: [for (final c in state.contexts) if (c.atMs >= cutoff) c, ctx]));
  }

  /// Where a session starting now came from (a repair run, which is not a practice start): Today's
  /// card when it asked within [pendingWindow], else the student's own choice.
  String takeSource() {
    final p = _pending;
    _pending = null;
    if (p != null && _now().millisecondsSinceEpoch - p.atMs <= pendingWindow.inMilliseconds) return p.source;
    return StudySource.practice;
  }

  /// A session that is not a paper on the account (a repair run, a Revise round).
  void record(StudyLogEntry entry) {
    if (state.userId == null) return;
    _set(state.copyWith(log: pruneLog([...state.log, entry], _now())));
  }

  /// A reaction to a deck card of [kind].
  void react(String kind, DeckReaction r) {
    if (state.userId == null) return;
    final deck = DeckReactions.fromJson(state.deck.toJson())..record(kind, r, istDay(_now().millisecondsSinceEpoch));
    _set(state.copyWith(reactions: deck));
  }

  /// What [kind] held before a deck move (for its undo).
  Map<int, DeckReaction> reactionsOf(String kind) => state.deck.of(kind);

  void restoreReactions(String kind, Map<int, DeckReaction> days) {
    final deck = DeckReactions.fromJson(state.deck.toJson())..restore(kind, days);
    _set(state.copyWith(reactions: deck));
  }

  /// "Not quite right?": forgets [facts] (entries before now stop counting for them).
  void forget(Set<String> facts) {
    final at = _now().millisecondsSinceEpoch;
    var notes = state.notes;
    for (final f in facts) {
      notes = notes.forget(f, at);
    }
    if (facts.contains(PatternFact.length)) notes = notes.withStatedLength(null);
    if (facts.contains(PatternFact.time)) notes = notes.withStatedWindow(null);
    var deck = state.deck;
    for (final f in facts.where((f) => f.startsWith('kind:'))) {
      deck = DeckReactions.fromJson(deck.toJson())..forget(f.substring(5));
    }
    _set(state.copyWith(notes: notes, reactions: deck));
  }

  /// "My sessions are longer or shorter": the length he says, used until a new one is learned.
  void stateLength(int minutes) {
    forget({PatternFact.length});
    _set(state.copyWith(notes: state.notes.withStatedLength(minutes)));
  }

  /// "I usually study at another time": the window he says.
  void stateWindow(StudyWindow window) {
    forget({PatternFact.time});
    _set(state.copyWith(notes: state.notes.withStatedWindow(window.name)));
  }

  /// The daily goal was set or changed now: goal fit counts from here.
  void markGoalSet() {
    if (state.userId == null) return;
    _set(state.copyWith(notes: state.notes.withGoalSet(_now().millisecondsSinceEpoch)));
  }

  /// Forgets the store of [userId] in memory (tests).
  static void debugReset() {
    _hookRegistered = false;
    _signedInUser = null;
    _hookStore = null;
  }
}

final studyLogProvider = NotifierProvider<StudyLogController, StudyLogState>(StudyLogController.new);

/// Records a deck reaction from a widget without a ref (the suggested stack). Returns what [kind]
/// held before, for an undo; null when there is no store here (a widget test without a scope).
Map<int, DeckReaction>? recordDeckReaction(BuildContext context, String kind, DeckReaction r) {
  try {
    final log = ProviderScope.containerOf(context, listen: false).read(studyLogProvider.notifier);
    final before = log.reactionsOf(kind);
    log.react(kind, r);
    return before;
  } on Object {
    return null;
  }
}

/// Puts [kind]'s reactions back as [before] (the undo of a deck move).
void restoreDeckReaction(BuildContext context, String kind, Map<int, DeckReaction>? before) {
  if (before == null) return;
  try {
    ProviderScope.containerOf(context, listen: false).read(studyLogProvider.notifier).restoreReactions(kind, before);
  } on Object {
    // Nothing to restore without a store.
  }
}

/// Writes the daily goal: on this phone (the pace step counts as answered, so Today and the goal
/// sheet read it), the moment it was set (goal fit counts from there), and the nearest session
/// length the server's study preferences hold (best effort; a long goal is never refused or lost).
class DailyGoalWriter {
  DailyGoalWriter(this._ref);

  final Ref _ref;

  void set(int minutes, {Set<int>? days}) {
    final before = _ref.read(dailyGoalProvider);
    try {
      _ref.read(onboardingAnswersProvider.notifier).edit((a) => a.copyWith(minutes: minutes, days: days).mark(Steps.rhythm));
    } on Object {
      // The sheet could not be written now; the student can set it again.
    }
    if (before != minutes) _ref.read(studyLogProvider.notifier).markGoalSet();
    unawaited(_ref.read(studyLengthProvider).save(sessionMinutesForServer(minutes)).then((_) {}, onError: (Object _) {}));
  }
}

final dailyGoalWriterProvider = Provider<DailyGoalWriter>(DailyGoalWriter.new);

/// The daily goal in minutes, as the student set it on this phone (onboarding's pace step or the
/// goal sheet), or null when it was never set (a skipped step shows no goal anywhere, so nothing
/// claims one).
final dailyGoalProvider = Provider<int?>((ref) {
  final uid = ref.watch(userIdProvider);
  final answers = ref.watch(onboardingAnswersProvider).value;
  if (answers == null) return null;
  if (answers.owner != null && uid != null && answers.owner != uid) return null;
  if (!answers.isDone(Steps.rhythm)) return null;
  return answers.minutes;
});

/// What the phone has learned, as of [nowProvider]'s time. Recomputed when the log, the goal or the
/// subjects change; Today re-reads it on its own clock ticks.
final studyPatternProvider = Provider<StudyPattern>((ref) {
  // A new day starts today's minutes from zero.
  ref.watch(todayStudentDayProvider);
  final s = ref.watch(studyLogProvider);
  final goal = ref.watch(dailyGoalProvider);
  final subjects = ref.watch(authSnapshotProvider.select((a) => a.subjects));
  final answers = ref.watch(onboardingAnswersProvider).value;
  return StudyPattern.from(
    log: s.log,
    now: ref.read(nowProvider)(),
    goalMinutes: goal,
    chosenSubjects: subjects.isNotEmpty ? subjects : [for (final x in answers?.subjects ?? const []) x.id],
    reactions: s.deck,
    notes: s.notes,
  );
});
