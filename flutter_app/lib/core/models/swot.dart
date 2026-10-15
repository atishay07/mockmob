import 'json_helpers.dart';

/// The post-mock read of `GET /api/attempts/:id` (`swot`). Deterministic and built on the
/// server from stored records: every string arrives finished, with its denominator, and the app
/// only lays it out. Unknown fields are ignored, and a null or missing value renders nothing.
class Swot {
  const Swot({
    required this.version,
    required this.state,
    this.message,
    this.basis,
    this.quadrants = const [],
    this.plan = const [],
  });

  factory Swot.fromJson(Json j) => Swot(
        version: asInt(j['version']) ?? 1,
        state: asStringOr(j['state'], ''),
        message: _nonEmpty(j['message']),
        basis: j['basis'] is Map ? SwotBasis.fromJson(asJson(j['basis'])) : null,
        quadrants: [for (final q in asJsonList(j['quadrants'])) SwotQuadrant.fromJson(q)],
        plan: [
          for (final p in asJsonList(j['plan']))
            ?SwotPlanItem.tryParse(p),
        ],
      );

  /// A paper with a full read.
  static const ready = 'ready';

  /// The answer checks have not loaded: only [message] shows.
  static const checksPending = 'checks_pending';

  /// Fewer than 10 answered: only [message] shows.
  static const tooFew = 'too_few';

  /// A practice set, or a paper scored on the device: nothing shows.
  static const notAvailable = 'not_available';

  final int version;
  final String state;
  final String? message;
  final SwotBasis? basis;
  final List<SwotQuadrant> quadrants;
  final List<SwotPlanItem> plan;

  bool get isReady => state == ready;

  /// A state that says one line and nothing more.
  bool get isMessageOnly => (state == checksPending || state == tooFew) && message != null;

  /// Whether the section has anything to draw. Unknown states draw nothing.
  bool get isVisible => isReady || isMessageOnly;
}

/// The line that says what the read is made from, with the numbers behind it.
class SwotBasis {
  const SwotBasis({
    required this.line,
    this.heldLine,
    this.counted,
    this.total,
    this.held,
    this.earlierPapers,
    this.earlierAnswers,
    this.timing,
  });

  factory SwotBasis.fromJson(Json j) => SwotBasis(
        line: asStringOr(j['line'], '').trim(),
        heldLine: _nonEmpty(j['heldLine']),
        counted: asInt(j['counted']),
        total: asInt(j['total']),
        held: asInt(j['held']),
        earlierPapers: asInt(j['earlierPapers']),
        earlierAnswers: asInt(j['earlierAnswers']),
        timing: asString(j['timing']),
      );

  /// "From 49 of 50 questions in this paper and 212 earlier answers in Accountancy across 6 papers."
  final String line;

  /// "1 question under re-check or corrected is left out of this read." Only when there are exclusions.
  final String? heldLine;
  final int? counted;
  final int? total;
  final int? held;
  final int? earlierPapers;
  final int? earlierAnswers;

  /// `recorded` or `not_recorded`.
  final String? timing;
}

/// One of the four groups. `id` is `strength`, `weakness`, `opportunity` or `threat`, in that order.
class SwotQuadrant {
  const SwotQuadrant({required this.id, required this.label, this.empty, this.items = const []});

  factory SwotQuadrant.fromJson(Json j) => SwotQuadrant(
        id: asStringOr(j['id'], ''),
        label: asStringOr(j['label'], ''),
        empty: _nonEmpty(j['empty']),
        items: [
          for (final i in asJsonList(j['items']))
            ?SwotItem.tryParse(i),
        ],
      );

  static const strength = 'strength';
  static const weakness = 'weakness';
  static const opportunity = 'opportunity';
  static const threat = 'threat';

  final String id;

  /// The group heading word: "Strengths", "Weaknesses", "Opportunities" or "Threats". Empty when
  /// the server leaves it out: the screen then falls back to the word for [id].
  final String label;

  /// The one quiet line shown when [items] is empty.
  final String? empty;
  final List<SwotItem> items;

  /// A group with neither items nor an empty line has nothing to draw.
  bool get isVisible => items.isNotEmpty || empty != null;
}

class SwotItem {
  const SwotItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.detail,
    this.chapter,
    this.questions = const [],
    this.planId,
  });

  /// An item with no title or no id cannot be shown or keyed, so it is dropped.
  static SwotItem? tryParse(Json j) {
    final id = asStringOr(j['id'], '');
    final title = asStringOr(j['title'], '').trim();
    if (id.isEmpty || title.isEmpty) return null;
    return SwotItem(
      id: id,
      kind: asStringOr(j['kind'], ''),
      title: title,
      detail: asStringOr(j['detail'], '').trim(),
      chapter: _nonEmpty(j['chapter']),
      questions: _questionNumbers(j['questions']),
      planId: _nonEmpty(j['planId']),
    );
  }

  final String id;
  final String kind;
  final String title;
  final String detail;
  final String? chapter;

  /// 1-based question numbers of this paper, for the "See" buttons.
  final List<int> questions;

  /// The plan row that practises this item, or null.
  final String? planId;
}

/// One "Do these next" row: a label, its reason and the practice set it sets up.
class SwotPlanItem {
  const SwotPlanItem({
    required this.id,
    required this.label,
    required this.reason,
    required this.practice,
    this.href = '',
    this.later,
  });

  /// A row with no label or no practice cannot be set up, so it is dropped.
  static SwotPlanItem? tryParse(Json j) {
    final label = asStringOr(j['label'], '').trim();
    final practice = j['practice'] is Map ? SwotPractice.tryParse(asJson(j['practice'])) : null;
    if (label.isEmpty || practice == null) return null;
    return SwotPlanItem(
      id: asStringOr(j['id'], ''),
      label: label,
      reason: asStringOr(j['reason'], '').trim(),
      practice: practice,
      href: asStringOr(j['href'], ''),
      later: j['later'] is Map ? SwotLater.tryParse(asJson(j['later'])) : null,
    );
  }

  final String id;
  final String label;
  final String reason;
  final SwotPractice practice;

  /// The web link. The app does not open it: it builds its own from [practice].
  final String href;

  /// What happened in a later set on this chapter, when there is one.
  final SwotLater? later;
}

/// What a plan row asks for. `mode` is the API mode (`quick`); the app opens a chapter set as
/// chapter practice (see `ActionRouter`).
class SwotPractice {
  const SwotPractice({required this.subject, required this.mode, required this.count, this.chapter});

  static SwotPractice? tryParse(Json j) {
    final subject = asStringOr(j['subject'], '');
    final count = asInt(j['count']);
    if (subject.isEmpty || count == null || count < 1) return null;
    return SwotPractice(
      subject: subject,
      mode: asStringOr(j['mode'], 'quick'),
      count: count,
      chapter: _nonEmpty(j['chapter']),
    );
  }

  final String subject;
  final String mode;
  final int count;
  final String? chapter;
}

/// "A set on this chapter on 16 Oct: 7 right of 10." It says what happened, not that the plan was followed.
class SwotLater {
  const SwotLater({required this.at, required this.right, required this.of, required this.line});

  static SwotLater? tryParse(Json j) {
    final line = asStringOr(j['line'], '').trim();
    final right = asInt(j['right']);
    final of = asInt(j['of']);
    if (line.isEmpty || right == null || of == null) return null;
    return SwotLater(at: asInt(j['at']) ?? 0, right: right, of: of, line: line);
  }

  /// Epoch milliseconds of the later set.
  final int at;
  final int right;
  final int of;
  final String line;
}

String? _nonEmpty(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}

List<int> _questionNumbers(Object? v) =>
    v is List ? [for (final e in v) if (asInt(e) case final n? when n > 0) n] : const [];
