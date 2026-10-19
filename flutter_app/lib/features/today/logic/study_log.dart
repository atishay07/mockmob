// The per-student study log (SMART-LAYER-1019PM 2.2): one entry per session, kept on the phone,
// filled from the student's own papers (every cached paper with a start becomes an entry, so a
// heavy account on a new phone is not "new") and from the sessions this phone runs (repairs, and
// the context of a paper: where it was started, the length suggested and the length picked).
// Plus the deck's reactions with a longer memory than DeckMemory, and the small facts the student
// corrected ("Not quite right?"). Pure values here; `study_log_store.dart` keeps them.
import '../../../core/models/attempt.dart';
import '../../../core/models/json_helpers.dart';

/// Where a session was started from.
abstract final class StudySource {
  static const todayLead = 'today_lead';
  static const todayDeck = 'today_deck';
  static const practice = 'practice';
  static const mob = 'mob';
  static const reminder = 'reminder';
  static const resultNext = 'result_next';

  /// Read from a paper on the account, with nothing this phone knew about how it began.
  static const record = 'record';

  /// Sessions the student chose himself (Today-lead sessions show what we offered, not what he wants).
  static bool selfChosen(String source) => source == practice || source == todayDeck;
}

/// The app's own names for a session's mode (not the API's: chapter practice is sent as `quick`).
abstract final class StudyMode {
  static const quick = 'quick';
  static const chapter = 'chapter';
  static const smart = 'smart';
  static const full = 'full';
  static const nta = 'nta';
  static const repair = 'repair';
  static const revise = 'revise';
  static const mob = 'mob';

  static const all = [quick, chapter, smart, full, nta, repair, revise, mob];
}

/// One session.
class StudyLogEntry {
  const StudyLogEntry({
    required this.id,
    required this.endedAtMs,
    required this.mode,
    required this.subject,
    required this.source,
    this.startedAtMs,
    this.activeMs,
    this.questions = 0,
    this.suggestedMinutes,
    this.chosenMinutes,
    this.finished = true,
  });

  /// The attempt id for a paper, a made-up id for a repair or revise run. Entries are unique by it.
  final String id;

  /// Null for a paper read from the account without a start (time of day only, never a length).
  final int? startedAtMs;
  final int endedAtMs;

  /// Time on the session: end minus start, minus the time away, capped at the paper's limit. Null
  /// when the start is not known.
  final int? activeMs;
  final String mode;
  final String subject;
  final int questions;
  final String source;
  final int? suggestedMinutes;
  final int? chosenMinutes;
  final bool finished;

  /// When the session began, as well as the phone knows: its start, else its end.
  int get atMs => startedAtMs ?? endedAtMs;

  /// The length is known.
  bool get timed => activeMs != null;

  StudyLogEntry copyWith({String? source, int? suggestedMinutes, int? chosenMinutes, String? mode, bool? finished}) => StudyLogEntry(
        id: id,
        startedAtMs: startedAtMs,
        endedAtMs: endedAtMs,
        activeMs: activeMs,
        mode: mode ?? this.mode,
        subject: subject,
        questions: questions,
        source: source ?? this.source,
        suggestedMinutes: suggestedMinutes ?? this.suggestedMinutes,
        chosenMinutes: chosenMinutes ?? this.chosenMinutes,
        finished: finished ?? this.finished,
      );

  Map<String, Object?> toJson() => {
        'id': id,
        if (startedAtMs != null) 's': startedAtMs,
        'e': endedAtMs,
        if (activeMs != null) 'a': activeMs,
        'm': mode,
        'sub': subject,
        'q': questions,
        'src': source,
        if (suggestedMinutes != null) 'sug': suggestedMinutes,
        if (chosenMinutes != null) 'ch': chosenMinutes,
        'f': finished,
      };

  static StudyLogEntry? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'], e = raw['e'], m = raw['m'];
    if (id is! String || e is! int || m is! String) return null;
    int? i(String k) => raw[k] is int ? raw[k] as int : null;
    return StudyLogEntry(
      id: id,
      startedAtMs: i('s'),
      endedAtMs: e,
      activeMs: i('a'),
      mode: m,
      subject: raw['sub'] is String ? raw['sub'] as String : '',
      questions: i('q') ?? 0,
      source: raw['src'] is String ? raw['src'] as String : StudySource.record,
      suggestedMinutes: i('sug'),
      chosenMinutes: i('ch'),
      finished: raw['f'] != false,
    );
  }
}

/// How a session on this phone began, kept until its paper arrives: matched to the paper by its
/// session id when known, else by a start within [StudyContext.matchWindow].
class StudyContext {
  const StudyContext({required this.atMs, required this.source, this.sessionId, this.mode, this.suggestedMinutes, this.chosenMinutes});

  /// A context and a paper's start this far apart are not the same session.
  static const Duration matchWindow = Duration(minutes: 10);

  final int atMs;
  final String source;
  final String? sessionId;

  /// The app's mode when it differs from the paper's (chapter practice).
  final String? mode;
  final int? suggestedMinutes;
  final int? chosenMinutes;

  Map<String, Object?> toJson() => {
        'at': atMs,
        'src': source,
        if (sessionId != null) 'sid': sessionId,
        if (mode != null) 'm': mode,
        if (suggestedMinutes != null) 'sug': suggestedMinutes,
        if (chosenMinutes != null) 'ch': chosenMinutes,
      };

  static StudyContext? fromJson(Object? raw) {
    if (raw is! Map || raw['at'] is! int || raw['src'] is! String) return null;
    return StudyContext(
      atMs: raw['at'] as int,
      source: raw['src'] as String,
      sessionId: raw['sid'] is String ? raw['sid'] as String : null,
      mode: raw['m'] is String ? raw['m'] as String : null,
      suggestedMinutes: raw['sug'] is int ? raw['sug'] as int : null,
      chosenMinutes: raw['ch'] is int ? raw['ch'] as int : null,
    );
  }
}

/// One reaction to a deck card on one IST day.
enum DeckReaction { picked, passed, dismissed }

/// The deck's reactions per card kind over [window] days: longer memory than [DeckMemory], which
/// keeps its own 7-day sink rule unchanged.
class DeckReactions {
  DeckReactions([Map<String, Map<int, DeckReaction>>? byKind])
      : _byKind = {for (final e in (byKind ?? const <String, Map<int, DeckReaction>>{}).entries) e.key: Map.of(e.value)};

  static const int window = 28;

  final Map<String, Map<int, DeckReaction>> _byKind;

  Iterable<String> get kinds => _byKind.keys;

  /// [kind]'s reactions (day to the reaction that day; a pick outranks a pass on the same day).
  Map<int, DeckReaction> of(String kind) => Map.unmodifiable(_byKind[kind] ?? const {});

  void record(String kind, DeckReaction r, int day) {
    final days = _byKind.putIfAbsent(kind, () => {});
    final before = days[day];
    if (before != DeckReaction.picked || r == DeckReaction.picked) days[day] = r;
    days.removeWhere((d, _) => d <= day - window);
  }

  /// Puts back what [kind] held (the undo of a deck move).
  void restore(String kind, Map<int, DeckReaction> days) {
    if (days.isEmpty) {
      _byKind.remove(kind);
    } else {
      _byKind[kind] = Map.of(days);
    }
  }

  void forget(String kind) => _byKind.remove(kind);

  /// Distinct days in the [days] before and including [today] on which [kind] got one of [kinds].
  int daysWith(String kind, Set<DeckReaction> kinds, {required int today, required int days}) =>
      (_byKind[kind] ?? const {}).entries.where((e) => e.key <= today && e.key > today - days && kinds.contains(e.value)).length;

  /// The last day [kind] was passed or dismissed, or null.
  int? lastPass(String kind) {
    int? last;
    for (final e in (_byKind[kind] ?? const <int, DeckReaction>{}).entries) {
      if (e.value != DeckReaction.picked && (last == null || e.key > last)) last = e.key;
    }
    return last;
  }

  Map<String, Object> toJson() => {
        for (final e in _byKind.entries) e.key: {for (final d in e.value.entries) '${d.key}': d.value.name},
      };

  static DeckReactions fromJson(Object? raw) {
    if (raw is! Map) return DeckReactions();
    final out = <String, Map<int, DeckReaction>>{};
    for (final e in raw.entries) {
      if (e.key is! String || e.value is! Map) continue;
      final days = <int, DeckReaction>{};
      for (final d in (e.value as Map).entries) {
        final day = int.tryParse('${d.key}');
        final r = DeckReaction.values.where((v) => v.name == d.value).firstOrNull;
        if (day != null && r != null) days[day] = r;
      }
      if (days.isNotEmpty) out[e.key as String] = days;
    }
    return DeckReactions(out);
  }
}

/// What the student told the layer ("Not quite right?") and when the goal was last set.
class PatternNotes {
  const PatternNotes({this.forgotten = const {}, this.statedLength, this.statedWindow, this.goalSetAtMs});

  /// Fact key to the time it was forgotten: entries before it do not count for that fact.
  final Map<String, int> forgotten;

  /// "My sessions are longer or shorter": the length he says, in minutes.
  final int? statedLength;

  /// "I usually study at another time": the window he says (a [StudyWindow] name).
  final String? statedWindow;

  /// When the daily goal was last set or changed on this phone.
  final int? goalSetAtMs;

  PatternNotes forget(String fact, int atMs) => PatternNotes(forgotten: {...forgotten, fact: atMs}, statedLength: statedLength, statedWindow: statedWindow, goalSetAtMs: goalSetAtMs);

  PatternNotes withStatedLength(int? minutes) => PatternNotes(forgotten: forgotten, statedLength: minutes, statedWindow: statedWindow, goalSetAtMs: goalSetAtMs);

  PatternNotes withStatedWindow(String? window) => PatternNotes(forgotten: forgotten, statedLength: statedLength, statedWindow: window, goalSetAtMs: goalSetAtMs);

  PatternNotes withGoalSet(int atMs) => PatternNotes(forgotten: forgotten, statedLength: statedLength, statedWindow: statedWindow, goalSetAtMs: atMs);

  Map<String, Object?> toJson() => {
        'forgot': forgotten,
        if (statedLength != null) 'len': statedLength,
        if (statedWindow != null) 'win': statedWindow,
        if (goalSetAtMs != null) 'goalAt': goalSetAtMs,
      };

  static PatternNotes fromJson(Object? raw) {
    if (raw is! Map) return const PatternNotes();
    final f = raw['forgot'];
    return PatternNotes(
      forgotten: f is Map ? {for (final e in f.entries) if (e.key is String && e.value is int) e.key as String: e.value as int} : const {},
      statedLength: raw['len'] is int ? raw['len'] as int : null,
      statedWindow: raw['win'] is String ? raw['win'] as String : null,
      goalSetAtMs: raw['goalAt'] is int ? raw['goalAt'] as int : null,
    );
  }
}

/// The log's limits: at most [maxEntries] entries and [maxDays] days.
abstract final class StudyLogLimits {
  static const int maxEntries = 300;
  static const int maxDays = 56;
}

/// [entries] newest last, without those older than [StudyLogLimits.maxDays] and at most
/// [StudyLogLimits.maxEntries] (the oldest go first). One entry per id: the later one wins.
List<StudyLogEntry> pruneLog(Iterable<StudyLogEntry> entries, DateTime now) {
  final cutoff = now.millisecondsSinceEpoch - StudyLogLimits.maxDays * Duration.millisecondsPerDay;
  final byId = <String, StudyLogEntry>{};
  for (final e in entries) {
    if (e.atMs < cutoff) continue;
    byId[e.id] = e;
  }
  final list = byId.values.toList()..sort((a, b) => a.atMs.compareTo(b.atMs));
  return list.length > StudyLogLimits.maxEntries ? list.sublist(list.length - StudyLogLimits.maxEntries) : list;
}

/// A paper's limit in minutes: what its meta says, else 60 for a mock and a minute a question
/// with a margin for practice (never less than 10).
int paperLimitMinutes(Attempt a) {
  final d = a.selectionMeta.durationMinutes;
  if (d != null && d > 0) return d;
  if (a.isMock) return 60;
  final q = a.total;
  return q < 10 ? 10 : q * 2;
}

/// The time away from a paper, from its record's presence events (`selectionMeta.recovery`):
/// from each away to the next back. An away with no back runs to [endMs].
int awayMsOf(Attempt a, int endMs) {
  final rec = a.selectionMeta.raw['recovery'];
  if (rec is! Map) return 0;
  final presence = rec['presence'];
  if (presence is! List) return 0;
  final events = <(String, double)>[];
  for (final e in presence) {
    if (e is! Map) continue;
    final type = e['type'], at = e['at'];
    if ((type == 'away' || type == 'back') && at is num && at.isFinite) events.add((type as String, at.toDouble()));
  }
  events.sort((x, y) => x.$2.compareTo(y.$2));
  var away = 0.0;
  double? since;
  for (final (type, at) in events) {
    if (type == 'away') {
      since ??= at;
    } else if (since != null) {
      away += at - since;
      since = null;
    }
  }
  if (since != null && endMs > since) away += endMs - since;
  return away.round();
}

/// The paper's start on the phone that ran it (`selectionMeta.client.startedAt`), or null.
int? paperStartMs(Attempt a) {
  final client = a.selectionMeta.raw['client'];
  if (client is! Map) return null;
  final s = asInt(client['startedAt']);
  return s == null || s <= 0 ? null : s;
}

/// A paper played with the Mob.
bool isMobPaper(Attempt a) {
  final raw = a.selectionMeta.raw;
  return raw['mobPaper'] != null && raw['mobPaper'] != false || raw['selectionStrategy'] == 'mob_paper';
}

/// The entry for a paper from the account. [context] is how this phone started it, when known.
/// Without a start the entry has the time of day only (from its end), never a length.
StudyLogEntry entryFromAttempt(Attempt a, {StudyContext? context}) {
  final end = a.completedAt.millisecondsSinceEpoch;
  final start = paperStartMs(a);
  int? active;
  if (start != null && end > start) {
    final limit = paperLimitMinutes(a) * Duration.millisecondsPerMinute;
    final raw = end - start - awayMsOf(a, end);
    active = raw < 0 ? 0 : (raw > limit ? limit : raw);
  }
  final mob = isMobPaper(a);
  final mode = mob ? StudyMode.mob : (context?.mode ?? _modeOf(a.mode));
  return StudyLogEntry(
    id: a.id,
    startedAtMs: start,
    endedAtMs: end,
    activeMs: active,
    mode: mode,
    subject: a.subject,
    questions: a.total,
    source: mob ? StudySource.mob : (context?.source ?? StudySource.record),
    suggestedMinutes: context?.suggestedMinutes,
    chosenMinutes: context?.chosenMinutes,
    finished: true,
  );
}

String _modeOf(String? apiMode) => switch (apiMode) {
      'full' => StudyMode.full,
      'nta' => StudyMode.nta,
      'smart' => StudyMode.smart,
      _ => StudyMode.quick,
    };

/// The context [contexts] holds for [a]: by its session id, else the nearest start within
/// [StudyContext.matchWindow]. Null when none fits.
StudyContext? contextFor(Attempt a, List<StudyContext> contexts) {
  final sid = a.selectionMeta.sessionId;
  if (sid != null) {
    for (final c in contexts) {
      if (c.sessionId == sid) return c;
    }
  }
  final start = paperStartMs(a);
  if (start == null) return null;
  StudyContext? best;
  var gap = StudyContext.matchWindow.inMilliseconds + 1;
  for (final c in contexts) {
    if (c.sessionId != null && sid != null) continue;
    final d = (c.atMs - start).abs();
    if (d < gap) {
      gap = d;
      best = c;
    }
  }
  return best;
}

/// [log] with every paper of [attempts] it does not hold yet (by id). A paper already in the log
/// keeps its entry (what this phone recorded wins over the account's copy).
List<StudyLogEntry> mergeAttempts(List<StudyLogEntry> log, Iterable<Attempt> attempts, {List<StudyContext> contexts = const [], required DateTime now}) {
  final have = {for (final e in log) e.id};
  final out = [...log];
  for (final a in attempts) {
    if (a.id.isEmpty || have.contains(a.id)) continue;
    out.add(entryFromAttempt(a, context: contextFor(a, contexts)));
    have.add(a.id);
  }
  return pruneLog(out, now);
}
