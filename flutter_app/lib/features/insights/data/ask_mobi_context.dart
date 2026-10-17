import 'ask_question.dart';

/// What Ask Mobi is opened about (ASK-MOBI-1018 section 3). The opener sends what its screen is
/// about, never a transcript: a question (Review, the result's answer sheet), a mock (the result's
/// marks), Today's lead ("Why this?"), Practice, or just the page (the record).
enum AskMobiKind { question, mock, today, practice, page }

/// The question a sheet is about, as far as the opening screen knows it. Everything is optional:
/// the server builds what Mobi reads from [ref] itself, and the sheet shows only what is known.
class AskMobiQuestion {
  const AskMobiQuestion({this.number, this.ref, this.stem, this.chapter, this.pickLetter, this.pickText, this.keyLetter, this.keyText});

  /// The question's number on its paper, for "Q7".
  final int? number;

  /// `<attemptId>:<questionId>`: the student's own attempt, so the server can read the question.
  /// Null for a question that is not part of an attempt (the question stream).
  final String? ref;
  final String? stem;
  final String? chapter;
  final String? pickLetter;
  final String? pickText;
  final String? keyLetter;
  final String? keyText;
}

class AskMobiContext {
  const AskMobiContext._(this.kind, {this.question, this.label, this.chapter, this.reason, this.lines = const [], this.attemptId, this.seed});

  /// Ask Mobi about one question. [seed] starts the composer (never sent by itself).
  factory AskMobiContext.question({
    int? number,
    String? ref,
    String? stem,
    String? chapter,
    String? pickLetter,
    String? pickText,
    String? keyLetter,
    String? keyText,
    String? seed,
  }) =>
      AskMobiContext._(
        AskMobiKind.question,
        question: AskMobiQuestion(
          number: number,
          ref: cleanQuestionRef(ref),
          stem: _clean(stem),
          chapter: _clean(chapter),
          pickLetter: _clean(pickLetter),
          pickText: _option(pickText),
          keyLetter: _clean(keyLetter),
          keyText: _option(keyText),
        ),
        chapter: _clean(chapter),
        seed: _clean(seed),
      );

  /// Ask Mobi about a finished mock ("Mock 3"). [lines] are where its marks went, as the result
  /// screen already counted them ("Partnership: 12 marks"); the first answer shows them, free.
  const AskMobiContext.mock({required String label, String? attemptId, List<String> lines = const []})
      : this._(AskMobiKind.mock, label: label, attemptId: attemptId, lines: lines);

  /// Today's "Why this?": the lead's [reason] and the plan's own [facts], with their denominators.
  const AskMobiContext.today({String? reason, List<String> facts = const []}) : this._(AskMobiKind.today, reason: reason, lines: facts);

  /// "Ask Mobi what to practise": the record's answer for the weakest chapter, free.
  const AskMobiContext.practice() : this._(AskMobiKind.practice);

  /// The page the student is on, with the record (the sheet's plain entry).
  const AskMobiContext.page() : this._(AskMobiKind.page);

  final AskMobiKind kind;
  final AskMobiQuestion? question;

  /// The mock's name ("Mock 3").
  final String? label;
  final String? chapter;

  /// Today's reason line.
  final String? reason;

  /// Figures the opener counted: a mock's lost marks by chapter, or Today's facts.
  final List<String> lines;
  final String? attemptId;
  final String? seed;

  /// How the server writes the reply: a question is revision, a mock an autopsy, the rest mentor.
  String get mode => switch (kind) {
        AskMobiKind.question => 'revision',
        AskMobiKind.mock => 'autopsy',
        _ => 'mentor',
      };

  /// The subject chip's name, or null when the sheet is about the record alone.
  String? get chipLabel => switch (kind) {
        AskMobiKind.question => question?.number == null ? 'This question' : 'Q${question!.number}',
        AskMobiKind.mock => label ?? 'This mock',
        AskMobiKind.today => 'Today',
        AskMobiKind.practice => 'Practice',
        AskMobiKind.page => null,
      };

  /// The quieter half of the chip ("Partnership").
  String? get chipDetail => kind == AskMobiKind.question ? chapter : null;

  /// Two opens with the same identity continue the same conversation.
  String get identity => switch (kind) {
        AskMobiKind.question => 'q:${question?.ref ?? question?.stem ?? ''}:${question?.number ?? ''}',
        AskMobiKind.mock => 'm:${attemptId ?? label ?? ''}',
        AskMobiKind.today => 't:${reason ?? ''}',
        AskMobiKind.practice => 'p',
        AskMobiKind.page => 'page',
      };

  static String? _clean(String? s) {
    final t = s?.trim();
    return t == null || t.isEmpty ? null : t;
  }

  /// An option's words, only when short enough to read in a chip line ("9:6:5"): a long option is
  /// shown by its letter alone, never cut off in the middle.
  static String? _option(String? s) {
    final t = _clean(s)?.replaceAll(RegExp(r'\s+'), ' ');
    return t == null || t.length > maxOptionChars ? null : t;
  }

  /// The longest option text the sheet quotes.
  static const int maxOptionChars = 40;
}
