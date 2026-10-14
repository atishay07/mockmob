import '../../../core/models/json_helpers.dart';
import '../../../core/models/study.dart';
import '../copy.dart';

/// A lesson row of `GET /api/study/catalog`. Reads more than the core `StudyUnitView` keeps:
/// the open run and the number of cards due in this lesson.
class LearnUnit {
  const LearnUnit({
    required this.id,
    required this.title,
    required this.status,
    this.subject = '',
    this.chapter,
    this.summary,
    this.estimatedMinutes,
    this.version,
    this.order = 0,
    this.cardCount = 0,
    this.dueCards = 0,
    this.runId,
    this.step,
    this.steps,
  });

  factory LearnUnit.fromJson(Json j) {
    final progress = asJson(j['inProgress']);
    return LearnUnit(
      id: asStringOr(j['id'], ''),
      title: asStringOr(j['title'], ''),
      status: StudyUnitStatus.fromWire(asString(j['status'])),
      subject: asStringOr(j['subject'], ''),
      chapter: asString(j['chapter']),
      summary: asString(j['summary']),
      estimatedMinutes: asInt(j['estimatedMinutes']),
      version: asString(j['version']),
      order: asInt(j['order']) ?? 0,
      cardCount: asInt(j['cardCount']) ?? 0,
      dueCards: asInt(asJson(j['memory'])['due']) ?? 0,
      runId: asString(progress['runId']),
      step: asInt(progress['step']),
      steps: asInt(progress['total']),
    );
  }

  final String id;
  final String title;
  final StudyUnitStatus status;
  final String subject;
  final String? chapter;
  final String? summary;
  final int? estimatedMinutes;
  final String? version;
  final int order;
  final int cardCount;
  final int dueCards;

  /// The lesson run in progress, when there is one.
  final String? runId;
  final int? step;
  final int? steps;
}

class LearnSubject {
  const LearnSubject({required this.id, required this.title, this.chapters = const []});

  final String id;
  final String title;

  /// The syllabus chapters, in syllabus order (titles), when the catalog sends them.
  final List<String> chapters;
}

/// The lesson the server suggests next (`nextUnit`).
class NextLesson {
  const NextLesson({required this.id, required this.title, this.reason});

  factory NextLesson.fromJson(Json j) =>
      NextLesson(id: asStringOr(j['id'], ''), title: asStringOr(j['title'], ''), reason: asString(j['reason']));

  final String id;
  final String title;
  final String? reason;
}

/// `GET /api/study/catalog`: subjects, lessons grouped by status words, and the due queue.
class LearnCatalog {
  const LearnCatalog({
    required this.core,
    this.subjects = const [],
    this.units = const [],
    this.next,
  });

  factory LearnCatalog.fromJson(Json j) {
    final core = StudyCatalog.fromJson(j);
    final subjects = [
      for (final s in asJsonList(j['subjects']))
        if (asString(s['subject']) != null)
          LearnSubject(
            id: asString(s['subject'])!,
            title: asStringOr(s['title'], asString(s['subject'])!),
            chapters: [
              for (final c in asJsonList(s['chapters']))
                if (asString(c['title']) != null && asString(c['title'])!.trim().isNotEmpty) asString(c['title'])!.trim(),
            ],
          ),
    ];
    final units = [for (final u in asJsonList(j['units'])) LearnUnit.fromJson(u)]..sort((a, b) => a.order.compareTo(b.order));
    return LearnCatalog(
      core: core,
      subjects: subjects,
      units: units,
      next: j['nextUnit'] is Map ? NextLesson.fromJson(asJson(j['nextUnit'])) : null,
    );
  }

  final StudyCatalog core;
  final List<LearnSubject> subjects;
  final List<LearnUnit> units;
  final NextLesson? next;

  bool get isDisabled => core.isDisabled;
  StudyQueue get queue => core.queue;
  StudyActiveRun? get active => core.active;

  /// Subjects that have at least one lesson, in syllabus order.
  List<LearnSubject> get subjectsWithLessons {
    final present = {for (final u in units) u.subject};
    final known = [for (final s in subjects) if (present.contains(s.id)) s];
    final knownIds = {for (final s in known) s.id};
    return [
      ...known,
      for (final id in present)
        if (!knownIds.contains(id)) LearnSubject(id: id, title: LearnCopy.subjectLabel(id)),
    ];
  }

  /// Syllabus chapters of [subject] with no published lesson yet, in syllabus order. Practice is
  /// open for them; their lessons come later.
  List<String> untaughtOf(String subject) {
    final taught = {for (final u in units) if (u.subject == subject && u.chapter != null) u.chapter!.trim()};
    for (final s in subjects) {
      if (s.id == subject) return [for (final c in s.chapters) if (!taught.contains(c)) c];
    }
    return const [];
  }

  /// Subjects to show: those with lessons first (syllabus order), then syllabus subjects that
  /// only have untaught chapters.
  List<LearnSubject> get subjectsToShow {
    final withLessons = subjectsWithLessons;
    final shown = {for (final s in withLessons) s.id};
    return [
      ...withLessons,
      for (final s in subjects)
        if (!shown.contains(s.id) && s.chapters.isNotEmpty) s,
    ];
  }

  List<LearnUnit> unitsOf(String subject) => [for (final u in units) if (u.subject == subject) u];

  LearnUnit? unitById(String id) {
    for (final u in units) {
      if (u.id == id) return u;
    }
    return null;
  }

  /// Cards that can be started now: due cards, or new cards inside today's allowance.
  bool get canStartRecall => core.recallEnabled && queue.availableCount > 0;
}
