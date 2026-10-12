import 'json_helpers.dart';

/// One answer option. The server sends options either as plain strings or as `{key, text}`.
class QuestionOption {
  const QuestionOption({required this.key, required this.text});

  factory QuestionOption.fromJson(Object? v, int index) {
    if (v is Map) {
      return QuestionOption(key: asStringOr(v['key'], _letter(index)), text: asStringOr(v['text'] ?? v['label'], ''));
    }
    return QuestionOption(key: _letter(index), text: asStringOr(v, ''));
  }

  final String key;
  final String text;

  Json toJson() => {'key': key, 'text': text};

  static String _letter(int i) => String.fromCharCode(65 + (i % 26));

  static List<QuestionOption> listFrom(Object? v) =>
      v is List ? [for (var i = 0; i < v.length; i++) QuestionOption.fromJson(v[i], i)] : const [];
}

/// A question as shown while answering. Answer keys are never in this view.
class SessionQuestion {
  const SessionQuestion({
    required this.id,
    this.subject,
    this.chapter,
    this.question = '',
    this.body,
    this.options = const [],
    this.passageText,
    this.passageGroupId,
    this.difficulty,
  });

  factory SessionQuestion.fromJson(Json j) => SessionQuestion(
        id: asStringOr(j['id'], ''),
        subject: asString(j['subject']),
        chapter: asString(j['chapter']),
        question: asStringOr(j['question'], ''),
        body: asString(j['body']),
        options: QuestionOption.listFrom(j['options']),
        passageText: asString(j['passageText']),
        passageGroupId: asString(j['passageGroupId']),
        difficulty: asString(j['difficulty']),
      );

  final String id;
  final String? subject;
  final String? chapter;
  final String question;
  final String? body;
  final List<QuestionOption> options;
  final String? passageText;
  final String? passageGroupId;
  final String? difficulty;

  Json toJson() => {
        'id': id,
        'subject': subject,
        'chapter': chapter,
        'question': question,
        'body': body,
        'options': [for (final o in options) o.toJson()],
        'passageText': passageText,
        'passageGroupId': passageGroupId,
        'difficulty': difficulty,
      };
}

/// A question as stored on a finished attempt. This one carries the key and explanation, so it
/// is only shown through the key rule in [AttemptDetail.visibleKeyIndex].
class SnapshotQuestion {
  const SnapshotQuestion({
    required this.id,
    this.subject,
    this.internalSubject,
    this.chapter,
    this.difficulty,
    this.question = '',
    this.body,
    this.options = const [],
    this.passageText,
    this.correctIndex,
    this.explanation,
  });

  factory SnapshotQuestion.fromJson(Json j) => SnapshotQuestion(
        id: asStringOr(j['id'], ''),
        subject: asString(j['subject']),
        internalSubject: asString(j['internalSubject']),
        chapter: _chapterName(j['chapter']),
        difficulty: asString(j['difficulty']),
        question: asStringOr(j['question'], ''),
        body: asString(j['body']),
        options: QuestionOption.listFrom(j['options']),
        passageText: asString(j['passageText']),
        correctIndex: asInt(j['correctIndex']),
        explanation: asString(j['explanation']),
      );

  final String id;
  final String? subject;
  final String? internalSubject;
  final String? chapter;
  final String? difficulty;
  final String question;
  final String? body;
  final List<QuestionOption> options;
  final String? passageText;
  final int? correctIndex;
  final String? explanation;

  /// Chapters are plain strings, but older rows hold `{name}` or `{text}` objects.
  static String? _chapterName(Object? v) {
    if (v is Map) return asString(v['text'] ?? v['label'] ?? v['name']);
    return asString(v);
  }
}
