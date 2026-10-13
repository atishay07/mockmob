import '../../../core/models/json_helpers.dart';

/// One option, keyed by its letter.
class PqOption {
  const PqOption(this.key, this.text);

  final String key;
  final String text;
}

/// A question from the untimed surfaces (`/api/questions/feed` and `/api/bookmarks`). These
/// carry the key and explanation by design: they are practice, never a timed mock.
class PracticeQuestion {
  const PracticeQuestion({
    required this.id,
    required this.subject,
    required this.chapter,
    required this.body,
    required this.options,
    this.difficulty,
    this.passageText,
    this.passageGroupId,
    this.correctKey,
    this.explanation,
    this.upvotes = 0,
    this.downvotes = 0,
    this.userVote,
    this.saved = false,
  });

  factory PracticeQuestion.fromJson(Json j) {
    final options = optionsFrom(j['options']);
    return PracticeQuestion(
      id: asStringOr(j['id'], ''),
      subject: asStringOr(j['subject'], ''),
      chapter: asStringOr(j['chapter'], ''),
      difficulty: asString(j['difficulty']),
      body: asStringOr(j['body'], asStringOr(j['question'], '')),
      options: options,
      passageText: asString(j['passage_text']),
      passageGroupId: asString(j['passage_group_id']),
      correctKey: keyFrom(j['correct_answer'], options),
      explanation: asString(j['explanation']),
      upvotes: asInt(j['upvotes']) ?? 0,
      downvotes: asInt(j['downvotes']) ?? 0,
      userVote: switch (asString(j['userVote'])) { 'up' => 'up', 'down' => 'down', _ => null },
      saved: asBool(j['saved']) ?? false,
    );
  }

  final String id;
  final String subject;
  final String chapter;
  final String? difficulty;
  final String body;
  final List<PqOption> options;
  final String? passageText;
  final String? passageGroupId;

  /// The correct option's key, or null when the stored key matches no option.
  final String? correctKey;
  final String? explanation;
  final int upvotes;
  final int downvotes;

  /// `up`, `down` or null.
  final String? userVote;
  final bool saved;

  bool get hasUsableKey => correctKey != null;

  PracticeQuestion copyWith({bool? saved, String? userVote, bool clearVote = false, int? upvotes, int? downvotes}) => PracticeQuestion(
        id: id,
        subject: subject,
        chapter: chapter,
        difficulty: difficulty,
        body: body,
        options: options,
        passageText: passageText,
        passageGroupId: passageGroupId,
        correctKey: correctKey,
        explanation: explanation,
        upvotes: upvotes ?? this.upvotes,
        downvotes: downvotes ?? this.downvotes,
        userVote: clearVote ? null : (userVote ?? this.userVote),
        saved: saved ?? this.saved,
      );
}

const _letters = 'ABCDEFGH';

/// Port of `feedOptions`: a list of strings, a list of `{key, text}` or a `{A: text}` map.
List<PqOption> optionsFrom(Object? raw) {
  final out = <PqOption>[];
  if (raw is Map) {
    for (final e in raw.entries) {
      out.add(PqOption('${e.key}', asStringOr(e.value, '')));
    }
    return out;
  }
  if (raw is! List) return out;
  for (var i = 0; i < raw.length; i++) {
    final o = raw[i];
    final fallback = i < _letters.length ? _letters[i] : '${i + 1}';
    if (o is String) {
      out.add(PqOption(fallback, o));
    } else if (o is Map) {
      final text = asString(o['text']) ?? asString(o['label']) ?? asString(o['value']) ?? '';
      out.add(PqOption(asString(o['key']) ?? fallback, text));
    }
  }
  return out;
}

/// The stored key as one of [options]' keys: a letter, the option text, or an index.
String? keyFrom(Object? raw, List<PqOption> options) {
  if (options.isEmpty || raw == null) return null;
  if (raw is num) {
    final i = raw.toInt();
    return i >= 0 && i < options.length ? options[i].key : null;
  }
  final s = '$raw'.trim();
  for (final o in options) {
    if (o.key.toLowerCase() == s.toLowerCase()) return o.key;
  }
  for (final o in options) {
    if (o.text.trim().isNotEmpty && o.text.trim() == s) return o.key;
  }
  return null;
}
