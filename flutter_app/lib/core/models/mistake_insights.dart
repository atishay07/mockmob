import 'json_helpers.dart';

/// One finished sentence of "From your record" on a mistake (`mistakeInsights[qid].lines[]` of
/// `GET /api/attempts/:id`). The server builds the text from stored records, so the app only
/// lays it out and never rewords or recomputes it.
class InsightLine {
  const InsightLine({required this.kind, required this.text});

  /// A line with no text is dropped by [MistakeInsights.fromJson]: null renders nothing.
  static InsightLine? tryParse(Json j) {
    final text = asStringOr(j['text'], '').trim();
    if (text.isEmpty) return null;
    return InsightLine(kind: asStringOr(j['kind'], ''), text: text);
  }

  /// `change`, `time`, `repeat_same` or `chapter`. An unknown kind is still shown.
  final String kind;
  final String text;
}

/// The record lines for one wrong answer, in the order the server sent them.
class MistakeInsights {
  const MistakeInsights({this.lines = const []});

  factory MistakeInsights.fromJson(Json j) => MistakeInsights(
        lines: [
          for (final l in asJsonList(j['lines']))
            ?InsightLine.tryParse(l),
        ],
      );

  /// Every `mistakeInsights` entry of a result read, keyed by question id. Absent or malformed
  /// gives an empty map, and an entry with no usable line is left out.
  static Map<String, MistakeInsights> mapFrom(Object? v) {
    final out = <String, MistakeInsights>{};
    asJson(v).forEach((qid, e) {
      if (e is! Map) return;
      final insights = MistakeInsights.fromJson(asJson(e));
      if (insights.lines.isNotEmpty) out[qid] = insights;
    });
    return out;
  }

  final List<InsightLine> lines;

  bool get isEmpty => lines.isEmpty;
}
