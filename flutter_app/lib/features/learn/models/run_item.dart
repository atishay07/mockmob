import '../../../core/models/json_helpers.dart';
import '../../../core/models/study.dart';

/// What a run step asks for. `reveal` is a self-rated recall card; `choice`, `text`, `numeric`
/// and `ratio` are checked by the server; `reading` is a lesson block.
enum RunItemType {
  reveal,
  choice,
  text,
  numeric,
  ratio,
  reading,
  unknown;

  static RunItemType fromWire(String? s) => switch (s) {
        'reveal' => reveal,
        'choice' => choice,
        'text' => text,
        'numeric' => numeric,
        'ratio' => ratio,
        'reading' => reading,
        _ => unknown,
      };
}

/// One step of a study run (`item` of `publicRun`). The server withholds answers until the
/// step is revealed, so [answerText] and [answerIndex] are only set afterwards.
class RunItem {
  const RunItem({
    required this.id,
    required this.type,
    this.kind,
    this.title,
    this.prompt,
    this.context,
    this.hint,
    this.inputHint,
    this.objective,
    this.options = const [],
    this.answerIndex,
    this.answerText,
    this.explanation,
    this.cue,
    this.raw = const {},
  });

  factory RunItem.fromJson(Json j) {
    final type = RunItemType.fromWire(asString(j['type']));
    final answer = j['answer'];
    return RunItem(
      id: asStringOr(j['id'], ''),
      type: type,
      kind: asString(j['kind']),
      title: asString(j['title']),
      prompt: asString(j['prompt']),
      context: asString(j['context']),
      hint: asString(j['hint']),
      inputHint: asString(j['inputHint']),
      objective: asString(j['objective']),
      options: asStringList(j['options']),
      answerIndex: type == RunItemType.choice ? asInt(answer) : null,
      answerText: type == RunItemType.choice ? null : asString(answer),
      explanation: asString(j['explanation']),
      cue: asString(j['cue']),
      raw: j,
    );
  }

  final String id;
  final RunItemType type;
  final String? kind;
  final String? title;
  final String? prompt;

  /// A sentence with a gap, for fill-in tasks.
  final String? context;
  final String? hint;
  final String? inputHint;
  final String? objective;
  final List<String> options;
  final int? answerIndex;
  final String? answerText;
  final String? explanation;
  final String? cue;
  final Json raw;

  bool get isReading => type == RunItemType.reading;
  bool get isSelfRated => type == RunItemType.reveal;
  bool get isChecked =>
      type == RunItemType.choice || type == RunItemType.text || type == RunItemType.numeric || type == RunItemType.ratio;
}

/// The server's feedback after a reveal or an answer.
class RunFeedback {
  const RunFeedback({
    this.correct,
    this.answer,
    this.explanation,
    this.cue,
    this.given,
    this.chosen,
    this.whyChosen,
    this.skipped = false,
  });

  factory RunFeedback.fromJson(Json j) => RunFeedback(
        correct: asBool(j['correct']),
        answer: asString(j['answer']),
        explanation: asString(j['explanation']),
        cue: asString(j['cue']),
        given: asString(j['given']),
        chosen: asString(j['chosen']),
        whyChosen: asString(j['whyChosen']),
        skipped: asBool(j['skipped']) ?? false,
      );

  final bool? correct;
  final String? answer;
  final String? explanation;
  final String? cue;
  final String? given;
  final String? chosen;
  final String? whyChosen;
  final bool skipped;
}

/// Reads the pieces of a [StudyRun] the run screen needs.
extension StudyRunView on StudyRun {
  RunItem? get currentItem => item == null ? null : RunItem.fromJson(item!);

  RunFeedback? get currentFeedback => feedback == null ? null : RunFeedback.fromJson(feedback!);

  bool get isLearn => mode == 'learn';

  /// When the server last changed this run (an acknowledged time), if it said.
  DateTime? get serverUpdatedAt => asDate(raw['updatedAt']);

  /// Every card rated in this run, from the run record (`reviewed`), in the order rated.
  List<ReviewedCard> get reviewedCards {
    final reviewed = raw['reviewed'];
    if (reviewed is! List) return const [];
    return [
      for (final r in reviewed)
        if (r is Map && asInt(r['rating']) != null)
          ReviewedCard(title: asString(r['title']), rating: asInt(r['rating'])!, unitId: asString(r['unitId'])),
    ];
  }

  /// Cards the student rated Forgot or Hard, with their titles.
  List<ReviewedCard> get againCards => [for (final c in reviewedCards) if (c.seeAgain && c.title != null) c];

  /// Titles of the cards rated Forgot or Hard.
  List<String> get cardsToSeeAgain => [for (final c in againCards) c.title!];

  /// True when more than half of the rated cards came back Forgot.
  bool get mostlyForgot {
    final cards = reviewedCards;
    if (cards.isEmpty) return false;
    return cards.where((c) => c.rating == 1).length * 2 > cards.length;
  }

  /// Titles of the lessons this run drew from (`units`), for the ending line.
  List<String> get lessonTitles => [for (final u in units) if (u.title.trim().isNotEmpty) u.title.trim()];
}

/// One rated card of a run: Forgot is 1, Hard 2, Got it 3, Easy 4.
class ReviewedCard {
  const ReviewedCard({required this.title, required this.rating, this.unitId});

  final String? title;
  final int rating;
  final String? unitId;

  bool get seeAgain => rating <= 2;
}
