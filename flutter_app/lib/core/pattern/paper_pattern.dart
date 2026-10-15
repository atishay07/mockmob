import '../models/json_helpers.dart';

/// How sure the blueprint is about a weight, lowest first. The server sends the lowest word its
/// source note names ("medium (IED low)" is [low]), so a weight is never shown surer than it is.
enum PatternConfidence {
  low('low'),
  medium('medium'),
  mediumHigh('medium-high'),
  high('high');

  const PatternConfidence(this.id);

  final String id;

  /// Unknown or missing reads as [low].
  static PatternConfidence parse(Object? v) {
    for (final c in values) {
      if (c.id == v) return c;
    }
    return low;
  }
}

/// A question count with its usual spread: [target] questions, between [min] and [max].
class PatternQuota {
  const PatternQuota({required this.target, required this.min, required this.max});

  /// `{ "target": 8, "range": [6, 10] }`.
  factory PatternQuota.fromJson(Object? v) {
    final j = asJson(v);
    final range = j['range'] is List ? j['range'] as List : const <Object?>[];
    final target = asInt(j['target']) ?? 0;
    return PatternQuota(
      target: target,
      min: range.isNotEmpty ? asInt(range[0]) ?? target : target,
      max: range.length > 1 ? asInt(range[1]) ?? target : target,
    );
  }

  final int target;
  final int min;
  final int max;

  Map<String, dynamic> toJson() => {'target': target, 'range': [min, max]};
}

/// A share of the paper (numericals): [target] as a fraction, between [min] and [max].
class PatternShare {
  const PatternShare({required this.target, required this.min, required this.max});

  factory PatternShare.fromJson(Object? v) {
    final j = asJson(v);
    final range = j['range'] is List ? j['range'] as List : const <Object?>[];
    final target = asDouble(j['target']) ?? 0;
    return PatternShare(
      target: target,
      min: range.isNotEmpty ? asDouble(range[0]) ?? target : target,
      max: range.length > 1 ? asDouble(range[1]) ?? target : target,
    );
  }

  final double target;
  final double min;
  final double max;

  Map<String, dynamic> toJson() => {'target': target, 'range': [min, max]};
}

/// One way the paper can be set (Mathematics: core or applied). Most subjects have one.
class PatternVariant {
  const PatternVariant({required this.id, required this.label});

  factory PatternVariant.fromJson(Object? v) {
    final j = asJson(v);
    final id = asStringOr(j['id'], 'default');
    return PatternVariant(id: id, label: asStringOr(j['label'], id));
  }

  final String id;
  final String label;

  Map<String, dynamic> toJson() => {'id': id, 'label': label};
}

/// A section of the paper (`main` for a single paper; `A`, `B1`, `B2` for Mathematics).
class PatternSection {
  const PatternSection({required this.id, required this.label, required this.questions});

  factory PatternSection.fromJson(Object? v) {
    final j = asJson(v);
    final id = asStringOr(j['id'], 'main');
    return PatternSection(id: id, label: asStringOr(j['label'], id), questions: asInt(j['questions']) ?? 0);
  }

  final String id;
  final String label;
  final int questions;

  Map<String, dynamic> toJson() => {'id': id, 'label': label, 'questions': questions};
}

/// A syllabus unit and its weight in the paper (medium confidence at best).
class PatternUnit {
  const PatternUnit({required this.name, required this.section, required this.quota});

  factory PatternUnit.fromJson(Object? v) {
    final j = asJson(v);
    return PatternUnit(name: asStringOr(j['name'], ''), section: asStringOr(j['section'], 'main'), quota: PatternQuota.fromJson(j));
  }

  final String name;
  final String section;
  final PatternQuota quota;

  Map<String, dynamic> toJson() => {'name': name, 'section': section, ...quota.toJson()};
}

/// A chapter and its usual share of the paper. Chapter splits inside a unit are inferred.
class PatternChapter {
  const PatternChapter({
    required this.name,
    required this.unit,
    required this.section,
    required this.quota,
    this.excluded = false,
    this.aliases = const [],
  });

  factory PatternChapter.fromJson(Object? v) {
    final j = asJson(v);
    return PatternChapter(
      name: asStringOr(j['name'], ''),
      unit: asStringOr(j['unit'], ''),
      section: asStringOr(j['section'], 'main'),
      quota: PatternQuota.fromJson(j),
      excluded: asBool(j['excluded']) ?? false,
      aliases: asStringList(j['aliases']),
    );
  }

  final String name;
  final String unit;
  final String section;
  final PatternQuota quota;

  /// Listed in the blueprint's excluded chapters (Computerized Accounting System: an optional
  /// unit the 2025 paper asked nothing from).
  final bool excluded;

  /// Other names the question bank uses for this chapter.
  final List<String> aliases;

  int get target => quota.target;

  /// The paper usually asks nothing here and never more than nothing: an optional unit.
  bool get optional => excluded || (quota.target == 0 && quota.max == 0);

  /// True for [chapterName] or one of its [aliases], ignoring case and outer spaces.
  bool matches(String chapterName) {
    final key = _key(chapterName);
    return _key(name) == key || aliases.any((a) => _key(a) == key);
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'unit': unit,
        'section': section,
        ...quota.toJson(),
        'excluded': excluded,
        'aliases': aliases,
      };
}

/// A chapter the blueprint leaves out, with the reason in plain words.
class ExcludedChapter {
  const ExcludedChapter({required this.name, required this.reason});

  factory ExcludedChapter.fromJson(Object? v) {
    final j = asJson(v);
    return ExcludedChapter(name: asStringOr(j['name'], ''), reason: asStringOr(j['reason'], ''));
  }

  final String name;
  final String reason;

  Map<String, dynamic> toJson() => {'name': name, 'reason': reason};
}

/// The question formats a student can drill (`format` on a practice link), and the blueprint
/// type each one counts against. One list for the whole app, matching the website's.
enum PaperFormat {
  match('match', 'match_the_following'),
  sequence('sequence', 'sequence_ordering'),
  statements('statements', 'statement_based'),
  assertionReason('assertion_reason', 'assertion_reason'),
  numerical('numerical', null),
  plain('plain', 'single_mcq');

  const PaperFormat(this.id, this.blueprintType);

  /// The id in links and API calls (`?format=sequence`).
  final String id;

  /// The key in [PaperPattern.typeQuotas], or null for numericals (a share of the paper, see
  /// [PaperPattern.numericalShare]).
  final String? blueprintType;

  static PaperFormat? byId(String? id) {
    for (final f in values) {
      if (f.id == id) return f;
    }
    return null;
  }
}

/// One subject's paper pattern, from `GET /api/subjects/:id/pattern` (built on the server from
/// the NTA blueprints; the same module and fixtures run on the website). Every weight carries its
/// source and confidence and the whole pattern is provisional for 2027: show [sourceLine] and the
/// confidence words wherever a weight is shown, and never turn a weight into a marks forecast.
class PaperPattern {
  const PaperPattern({
    required this.subject,
    required this.blueprintVersion,
    required this.sourceLine,
    required this.unitConfidence,
    required this.typeConfidence,
    required this.chaptersInferred,
    required this.provisional2027,
    required this.totalQuestions,
    required this.secondsPerQuestion,
    required this.variant,
    required this.variants,
    required this.sections,
    required this.units,
    required this.chapters,
    required this.excludedChapters,
    required this.typeQuotas,
    this.numericalShare,
  });

  /// The contract version this app reads.
  static const int schemaVersion = 1;

  /// A pattern from the server's JSON, or null when it is not one this app can read (another
  /// schema version, no subject, or no chapters): a missing pattern shows nothing, never zeros.
  static PaperPattern? tryParse(Object? json) {
    if (json is! Map) return null;
    final j = asJson(json);
    if (asInt(j['schemaVersion']) != schemaVersion) return null;
    final subject = asString(j['subject']);
    final chapters = [for (final c in asJsonList(j['chapters'])) PatternChapter.fromJson(c)];
    if (subject == null || subject.isEmpty || chapters.isEmpty) return null;
    final confidence = asJson(j['confidence']);
    final quotas = asJson(j['typeQuotas']);
    final variant = PatternVariant.fromJson(j['variant']);
    final variants = [for (final v in asJsonList(j['variants'])) PatternVariant.fromJson(v)];
    return PaperPattern(
      subject: subject,
      blueprintVersion: asStringOr(j['blueprintVersion'], ''),
      sourceLine: asStringOr(j['sourceLine'], ''),
      unitConfidence: PatternConfidence.parse(confidence['units']),
      typeConfidence: PatternConfidence.parse(confidence['types']),
      chaptersInferred: confidence['chapters'] != 'observed',
      // Anything but an explicit false stays provisional.
      provisional2027: asBool(j['provisional2027']) ?? true,
      totalQuestions: asInt(j['totalQuestions']) ?? 0,
      secondsPerQuestion: asInt(j['secondsPerQuestion']) ?? 0,
      variant: variant,
      variants: variants.isEmpty ? [variant] : variants,
      sections: [for (final s in asJsonList(j['sections'])) PatternSection.fromJson(s)],
      units: [for (final u in asJsonList(j['units'])) PatternUnit.fromJson(u)],
      chapters: chapters,
      excludedChapters: [for (final e in asJsonList(j['excludedChapters'])) ExcludedChapter.fromJson(e)],
      typeQuotas: {for (final e in quotas.entries) e.key: PatternQuota.fromJson(e.value)},
      numericalShare: j['numericalShare'] is Map ? PatternShare.fromJson(j['numericalShare']) : null,
    );
  }

  /// The public subject id (`accountancy`).
  final String subject;
  final String blueprintVersion;

  /// Where the weights come from, in one plain sentence ("Based on the 2025 CUET paper and the
  /// NTA bulletin.").
  final String sourceLine;

  /// How sure the unit weights are.
  final PatternConfidence unitConfidence;

  /// How sure the question-type quotas are.
  final PatternConfidence typeConfidence;

  /// Chapter splits inside units are inferred (always, in schema 1).
  final bool chaptersInferred;

  /// The pattern is the 2025 and 2026 paper's; 2027 may differ.
  final bool provisional2027;

  /// Questions in the paper (50): the denominator of every weight.
  final int totalQuestions;
  final int secondsPerQuestion;
  final PatternVariant variant;
  final List<PatternVariant> variants;
  final List<PatternSection> sections;
  final List<PatternUnit> units;

  /// In syllabus order (section, unit, chapter): "Paper order".
  final List<PatternChapter> chapters;
  final List<ExcludedChapter> excludedChapters;

  /// Blueprint type id (`sequence_ordering`) to its quota.
  final Map<String, PatternQuota> typeQuotas;

  /// The usual share of numericals, when the subject has any.
  final PatternShare? numericalShare;

  /// The chapter called [name] (or by one of its aliases), or null.
  PatternChapter? chapterNamed(String name) {
    for (final c in chapters) {
      if (c.matches(name)) return c;
    }
    return null;
  }

  /// The quota of [format], or null when the blueprint has none (numericals: [numericalShare]).
  PatternQuota? quotaFor(PaperFormat format) {
    final type = format.blueprintType;
    return type == null ? null : typeQuotas[type];
  }

  Map<String, dynamic> toJson() => {
        'schemaVersion': schemaVersion,
        'subject': subject,
        'blueprintVersion': blueprintVersion,
        'sourceLine': sourceLine,
        'confidence': {
          'units': unitConfidence.id,
          'chapters': chaptersInferred ? 'inferred' : 'observed',
          'types': typeConfidence.id,
        },
        'provisional2027': provisional2027,
        'totalQuestions': totalQuestions,
        'secondsPerQuestion': secondsPerQuestion,
        'variant': variant.toJson(),
        'variants': [for (final v in variants) v.toJson()],
        'sections': [for (final s in sections) s.toJson()],
        'units': [for (final u in units) u.toJson()],
        'chapters': [for (final c in chapters) c.toJson()],
        'excludedChapters': [for (final e in excludedChapters) e.toJson()],
        'typeQuotas': {for (final e in typeQuotas.entries) e.key: e.value.toJson()},
        'numericalShare': numericalShare?.toJson(),
      };
}

String _key(String s) => s.trim().toLowerCase();
