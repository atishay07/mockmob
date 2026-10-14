import '../../../core/models/json_helpers.dart';

/// One published lesson inside a chapter summary.
class SummaryLesson {
  const SummaryLesson({
    required this.id,
    required this.title,
    this.objectives = const [],
    this.blocks = const [],
  });

  factory SummaryLesson.fromJson(Json j) => SummaryLesson(
    id: asStringOr(j['id'], ''),
    title: asStringOr(j['title'], ''),
    objectives: asStringList(j['objectives']),
    blocks: [
      for (final b in asJsonList(j['blocks']))
        if (asStringOr(b['type'], 'reading') == 'reading') b,
    ],
  );

  final String id;
  final String title;
  final List<String> objectives;

  /// Reading blocks only, in lesson order.
  final List<Json> blocks;
}

/// `GET /api/study/summary?subject&chapter`: every published lesson of a chapter, in one scroll.
/// Reading it records an exposure for each lesson on the server, so it is only fetched when the
/// student opens the reader.
class ChapterSummary {
  const ChapterSummary({
    required this.subject,
    required this.chapter,
    this.lessons = const [],
  });

  factory ChapterSummary.fromJson(
    Json j, {
    required String subject,
    required String chapter,
  }) => ChapterSummary(
    subject: asStringOr(j['subject'], subject),
    chapter: asStringOr(j['chapter'], chapter),
    lessons: [
      for (final u in asJsonList(j['units'])) SummaryLesson.fromJson(u),
    ],
  );

  final String subject;
  final String chapter;
  final List<SummaryLesson> lessons;

  /// The chapter as plain text, for Share: the chapter, then each lesson's title, ideas and
  /// reading blocks. Formulas joined with a middle dot go on their own lines.
  String asText() {
    final out = StringBuffer(chapter);
    for (final l in lessons) {
      out
        ..writeln()
        ..writeln()
        ..writeln(l.title);
      for (var i = 0; i < l.objectives.length; i++) {
        out.writeln('Idea ${i + 1}: ${l.objectives[i]}');
      }
      for (final b in l.blocks) {
        final title = asString(b['title']);
        final body = asString(b['body']);
        final formula = asString(b['formula']);
        final steps = asStringList(b['steps']);
        out.writeln();
        if (title != null) out.writeln(title);
        if (body != null) out.writeln(body);
        if (formula != null) {
          for (final f
              in formula
                  .split('·')
                  .map((f) => f.trim())
                  .where((f) => f.isNotEmpty)) {
            out.writeln(f);
          }
        }
        for (var i = 0; i < steps.length; i++) {
          out.writeln('${i + 1}. ${steps[i]}');
        }
        final rows = b['rows'];
        if (rows is List) {
          for (final r in rows) {
            if (r is List) {
              out.writeln([for (final c in r) asStringOr(c, '')].join(' | '));
            }
          }
        }
      }
    }
    out
      ..writeln()
      ..writeln()
      ..write('From MockMob Concepts');
    return out.toString().trim();
  }
}
