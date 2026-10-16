import '../../../core/models/json_helpers.dart';
import 'practice_selection.dart';

/// What a practice link asks for: `?subject=&count=&chapter=&chapters=a&chapters=b&difficulty=
/// &purpose=`. Nothing is dropped, so a link that names Business Studies, 5 questions and two
/// chapters opens exactly that.
class PracticeLink {
  const PracticeLink({this.subject, this.count, this.chapters = const [], this.difficulty, this.purpose, this.recoveryFrom});

  factory PracticeLink.of(Uri uri) {
    final q = uri.queryParameters;
    final all = uri.queryParametersAll;
    final chapters = <String>[];
    for (final raw in [...?all['chapter'], ...?all['chapters']]) {
      final name = raw.trim();
      if (name.isNotEmpty && name.length <= 120 && !chapters.contains(name)) chapters.add(name);
    }
    return PracticeLink(
      subject: _clean(q['subject']),
      count: asInt(q['count']),
      chapters: chapters.take(maxChapters).toList(),
      difficulty: _clean(q['difficulty']),
      purpose: q['purpose'],
      recoveryFrom: _id.hasMatch(q['recoveryFrom'] ?? '') ? q['recoveryFrom'] : null,
    );
  }

  static final RegExp _id = RegExp(r'^[A-Za-z0-9_-]{1,100}$');

  final String? subject;
  final int? count;
  final List<String> chapters;
  final String? difficulty;
  final String? purpose;

  /// A fresh-questions check of this attempt (chapter practice of 5 only).
  final String? recoveryFrom;

  /// Only the two first-use allowances may be claimed from a link.
  String? get allowedPurpose => purpose == 'baseline' || purpose == 'full_sample' ? purpose : null;

  /// The selection for [mode]; null when there is no subject to start in.
  PracticeSelection? selectionFor(PracticeMode mode, {String? fallbackSubject}) {
    final id = subject ?? fallbackSubject;
    if (id == null || id.isEmpty) return null;
    return PracticeSelection(
      mode: mode,
      subjectId: id,
      count: nearestPracticeCount(count, counts: mode.counts, fallback: mode.defaultCount),
      chapters: mode.allowsChapters ? chapters : const [],
      difficulty: PracticeDifficulty.parse(difficulty),
      purpose: allowedPurpose,
      recoveryFrom: mode == PracticeMode.chapter ? recoveryFrom : null,
    );
  }

  /// The same request as a setup-page location.
  Map<String, dynamic> get query => {
    'subject': ?subject,
    if (count != null) 'count': '$count',
    if (chapters.isNotEmpty) 'chapters': chapters,
    'difficulty': ?difficulty,
    'purpose': ?purpose,
    'recoveryFrom': ?recoveryFrom,
  };
}

String? _clean(String? value) => value == null || value.trim().isEmpty ? null : value.trim();
