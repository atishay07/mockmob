import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../../core/models/my_colleges.dart' show MyColleges;
import '../data/du_catalog.dart';
import '../data/subjects.dart';
import 'choices.dart';

/// The most colleges the sheet holds: the same limit as My colleges, which the picks move into
/// after sign-in.
const int kMaxColleges = MyColleges.maxColleges;

/// The most "where do your marks go" picks (D45).
const int kMaxWorries = 3;

/// The daily goal's bounds in minutes (SMART-LAYER-1019PM 2.4). The top is input hygiene, longer
/// than a waking day, never a cap on a motivated student.
const int kMinGoalMinutes = 5;
const int kMaxGoalMinutes = 999;

/// The daily goal stored in a sheet, or null when [raw] is not a whole number of minutes from
/// [kMinGoalMinutes] to [kMaxGoalMinutes]. 10, 20 and 30 stay legal, and so do 60, 90, 120 and any
/// other length the student picked: a custom goal must never be reset to 20 on the next read.
int? parseGoalMinutes(Object? raw) {
  final n = switch (raw) {
    int v => v,
    double v when v.isFinite && v == v.roundToDouble() => v.toInt(),
    String v => int.tryParse(v.trim()),
    _ => null,
  };
  if (n == null || n < kMinGoalMinutes || n > kMaxGoalMinutes) return null;
  return n;
}

/// The single real question, as answered.
@immutable
class WarmupResult {
  const WarmupResult({required this.questionId, required this.chosen, required this.correct, required this.millis});

  final String questionId;
  final int chosen;
  final bool correct;

  /// Measured from the question appearing to the tap.
  final int millis;

  Map<String, Object?> toJson() => {'q': questionId, 'c': chosen, 'ok': correct, 'ms': millis};

  static WarmupResult? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final q = raw['q'], c = raw['c'], ok = raw['ok'], ms = raw['ms'];
    if (q is! String || c is! int || ok is! bool || ms is! int) return null;
    return WarmupResult(questionId: q, chosen: c, correct: ok, millis: ms);
  }
}

/// Everything the student told the onboarding, kept on the phone (versioned) from the first tap.
/// Only the parts the API supports are written to the account, after sign-in.
@immutable
class OnboardingAnswers {
  const OnboardingAnswers({
    this.stage,
    this.courseId,
    this.courseUndecided = false,
    this.colleges = const [],
    this.openToAny = false,
    this.category = DuCatalog.defaultCategory,
    this.subjects = const [],
    this.subjectsTouched = false,
    this.confidence = const {},
    this.worries = const [],
    this.warmup,
    this.minutes = 20,
    this.days = const {0, 1, 3, 5},
    this.window = StudyTime.evening,
    this.done = const {},
    this.skipped = const {},
    this.step,
    this.sealedAt,
    this.age,
    this.notNow = false,
    this.tonight = false,
    this.syncedFor,
    this.owner,
    this.seed,
  });

  /// Store format. Bump with a migration in [fromJson] when a field changes meaning.
  static const int version = 1;

  static const OnboardingAnswers empty = OnboardingAnswers();

  final Stage? stage;

  /// A DU course id from [DuCatalog], or null.
  final String? courseId;

  /// "Not sure yet" on the course step.
  final bool courseUndecided;

  /// Up to [kMaxColleges] colleges (full names as DU prints them), in order of last year's closing
  /// marks for [category], highest first (D103); the first three are the ones Today shows.
  final List<String> colleges;
  final bool openToAny;

  /// The category the ladder shows. Stays on the phone.
  final String category;

  /// The chosen subjects, in the order they were added.
  final List<SheetSubject> subjects;

  /// False until the student changes the pre-ticked set, so the set can follow the course.
  final bool subjectsTouched;
  final Map<SheetSubject, Confidence> confidence;

  /// Where the marks go: up to [kMaxWorries] picks in the order they were made (owner, 18 Oct,
  /// D45). The first is the primary: it decides the first move; the plan uses them all.
  final List<Worry> worries;
  final WarmupResult? warmup;

  /// The primary pick, or null.
  Worry? get worry => worries.isEmpty ? null : worries.first;

  /// The daily goal in minutes: 10, 20 or 30 from the bubbles, or a longer day from More (1 hour,
  /// 2 hours or the student's own, [kMinGoalMinutes] to [kMaxGoalMinutes]).
  final int minutes;

  /// Study days, 0 = Monday.
  final Set<int> days;
  final StudyTime window;

  /// Step ids answered, and those skipped (a skipped step shows its default on the sheet).
  final Set<String> done;
  final Set<String> skipped;

  /// The step the student is on, so a return resumes there.
  final String? step;
  final DateTime? sealedAt;
  final AgeAnswer? age;

  /// "Not now" on the save step: the plan stays on the phone.
  final bool notNow;

  /// The first move was put off to tonight.
  final bool tonight;

  /// The account the sheet was written to, once every write was acknowledged.
  final String? syncedFor;

  /// The account this sheet belongs to. Null while nobody has signed in since it was started;
  /// the first account that signs in claims it, and it is never written to any other account.
  final String? owner;

  /// A number picked once for this phone's sheet, so per-student choices (which warm-up
  /// question shows) stay the same on every return. Null until the first answer is saved.
  final int? seed;

  DuCourse? get course => DuCatalog.course(courseId);
  bool get sealed => sealedAt != null;
  bool get started => done.isNotEmpty || skipped.isNotEmpty;

  /// Nothing the student said is on this sheet (where they are in the deck and the seed are
  /// not answers).
  bool get blank {
    final mine = toJson()..remove('step')..remove('seed')..remove('owner')..remove('syncedFor');
    final none = empty.toJson()..remove('step')..remove('seed')..remove('owner')..remove('syncedFor');
    return jsonEncode(mine) == jsonEncode(none);
  }

  bool isDone(String step) => done.contains(step);
  bool isSkipped(String step) => skipped.contains(step);

  /// The chosen subjects, weakest first.
  List<SheetSubject> get ranked => weakestFirst(subjects, confidence);

  OnboardingAnswers copyWith({
    Stage? stage,
    Object? courseId = _keep,
    bool? courseUndecided,
    List<String>? colleges,
    bool? openToAny,
    String? category,
    List<SheetSubject>? subjects,
    bool? subjectsTouched,
    Map<SheetSubject, Confidence>? confidence,
    Worry? worry,
    List<Worry>? worries,
    Object? warmup = _keep,
    int? minutes,
    Set<int>? days,
    StudyTime? window,
    Set<String>? done,
    Set<String>? skipped,
    Object? step = _keep,
    Object? sealedAt = _keep,
    AgeAnswer? age,
    bool? notNow,
    bool? tonight,
    Object? syncedFor = _keep,
    Object? owner = _keep,
    int? seed,
  }) {
    return OnboardingAnswers(
      stage: stage ?? this.stage,
      courseId: identical(courseId, _keep) ? this.courseId : courseId as String?,
      courseUndecided: courseUndecided ?? this.courseUndecided,
      colleges: colleges ?? this.colleges,
      openToAny: openToAny ?? this.openToAny,
      category: category ?? this.category,
      subjects: subjects ?? this.subjects,
      subjectsTouched: subjectsTouched ?? this.subjectsTouched,
      confidence: confidence ?? this.confidence,
      // [worry] makes that one the primary and keeps the other picks (the You editor sets one).
      worries: worries?.take(kMaxWorries).toList() ??
          (worry == null ? this.worries : [worry, ...this.worries.where((w) => w != worry)].take(kMaxWorries).toList()),
      warmup: identical(warmup, _keep) ? this.warmup : warmup as WarmupResult?,
      minutes: minutes ?? this.minutes,
      days: days ?? this.days,
      window: window ?? this.window,
      done: done ?? this.done,
      skipped: skipped ?? this.skipped,
      step: identical(step, _keep) ? this.step : step as String?,
      sealedAt: identical(sealedAt, _keep) ? this.sealedAt : sealedAt as DateTime?,
      age: age ?? this.age,
      notNow: notNow ?? this.notNow,
      tonight: tonight ?? this.tonight,
      syncedFor: identical(syncedFor, _keep) ? this.syncedFor : syncedFor as String?,
      owner: identical(owner, _keep) ? this.owner : owner as String?,
      seed: seed ?? this.seed,
    );
  }

  /// Marks [step] answered (and no longer skipped).
  OnboardingAnswers mark(String step) => copyWith(done: {...done, step}, skipped: {...skipped}..remove(step));

  /// Marks [step] skipped, unless it was answered.
  OnboardingAnswers skip(String step) => done.contains(step) ? this : copyWith(skipped: {...skipped, step});

  Map<String, Object?> toJson() => {
        'v': version,
        'stage': stage?.name,
        'course': courseId,
        'courseUndecided': courseUndecided,
        'colleges': colleges,
        'openToAny': openToAny,
        'category': category,
        'subjects': [for (final s in subjects) s.id],
        'subjectsTouched': subjectsTouched,
        'confidence': {for (final e in confidence.entries) e.key.id: e.value.name},
        // The primary under its old key, so a sheet stays readable by a build from before D45.
        'worry': worry?.name,
        'worries': [for (final w in worries) w.name],
        'warmup': warmup?.toJson(),
        'minutes': minutes,
        'days': (days.toList()..sort()),
        'window': window.name,
        'done': done.toList(),
        'skipped': skipped.toList(),
        'step': step,
        'sealedAt': sealedAt?.toIso8601String(),
        'age': age?.name,
        'notNow': notNow,
        'tonight': tonight,
        'syncedFor': syncedFor,
        'owner': owner,
        'seed': seed,
      };

  /// Reads a stored sheet of this store version or older. `AnswersStore.load` checks the
  /// version first and keeps a newer or broken sheet in its backup key instead of reading it;
  /// called directly, anything it cannot read gives [empty].
  static OnboardingAnswers fromJson(Map<String, Object?> j) {
    if (j['v'] is! int || (j['v']! as int) > version) return empty;
    List<String> strings(Object? raw) => raw is List ? [for (final e in raw) if (e is String) e] : const [];
    final course = j['course'] is String ? j['course']! as String : null;
    final minutes = j['minutes'];
    final confidence = <SheetSubject, Confidence>{};
    final rawConfidence = j['confidence'];
    if (rawConfidence is Map) {
      for (final e in rawConfidence.entries) {
        final s = SheetSubject.byId(e.key as String?);
        final c = Confidence.byName(e.value as String?);
        if (s != null && c != null) confidence[s] = c;
      }
    }
    final days = j['days'] is List ? {for (final d in j['days']! as List) if (d is int && d >= 0 && d < 7) d} : null;
    final syncedFor = j['syncedFor'] is String ? j['syncedFor']! as String : null;
    final category = j['category'] is String && DuCatalog.categories.contains(j['category']) ? j['category']! as String : null;
    return OnboardingAnswers(
      stage: Stage.byName(j['stage'] as String?),
      courseId: DuCatalog.course(course) == null ? null : course,
      courseUndecided: j['courseUndecided'] == true,
      // Sheets stored before the limit rose to eight hold at most three; both read the same. A sheet
      // kept in the order tapped (before D103) reads back in order of the marks.
      colleges: _byMarks(course, strings(j['colleges']).toSet().take(kMaxColleges).toList(), category ?? DuCatalog.defaultCategory),
      openToAny: j['openToAny'] == true,
      category: category ?? DuCatalog.defaultCategory,
      subjects: [for (final id in strings(j['subjects'])) ?SheetSubject.byId(id)],
      subjectsTouched: j['subjectsTouched'] == true,
      confidence: confidence,
      worries: _worries(j),
      warmup: WarmupResult.fromJson(j['warmup']),
      minutes: parseGoalMinutes(minutes) ?? 20,
      days: days == null || days.isEmpty ? const {0, 1, 3, 5} : days,
      window: StudyTime.byName(j['window'] as String?) ?? StudyTime.evening,
      done: strings(j['done']).toSet(),
      skipped: strings(j['skipped']).toSet(),
      step: j['step'] as String?,
      sealedAt: j['sealedAt'] is String ? DateTime.tryParse(j['sealedAt']! as String) : null,
      age: AgeAnswer.byName(j['age'] as String?),
      notNow: j['notNow'] == true,
      tonight: j['tonight'] == true,
      syncedFor: syncedFor,
      // A sheet stored before owners were kept belongs to the account it was written to.
      owner: j['owner'] is String ? j['owner']! as String : syncedFor,
      seed: j['seed'] is int ? j['seed']! as int : null,
    );
  }
}

/// Picks stored as `worries` (D45), or the single `worry` of an older sheet.
List<Worry> _worries(Map<String, Object?> j) {
  final raw = j['worries'];
  final names = raw is List ? [for (final e in raw) if (e is String) e] : [if (j['worry'] is String) j['worry']! as String];
  final list = <Worry>[];
  for (final n in names) {
    final w = Worry.byName(n);
    if (w != null && !list.contains(w)) list.add(w);
  }
  return list.take(kMaxWorries).toList();
}

const Object _keep = Object();

/// [colleges] in order of last year's closing marks for [category] in [courseId] (D103).
List<String> _byMarks(String? courseId, List<String> colleges, String category) =>
    DuCatalog.course(courseId)?.byMarks(colleges, category) ?? colleges;


