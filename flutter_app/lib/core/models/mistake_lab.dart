import 'json_helpers.dart';

/// The Mistake Lab of `GET /api/attempts/:id` (`lab`, contract v1, built by the website's
/// `data/mistake_lab.js`): where the missed marks went, the first-pick re-mark and how other
/// students answered the same questions. Every sentence arrives finished, with its denominator,
/// so the app only lays it out and the web and the app say the same words.
///
/// Read like the SWOT: unknown fields are ignored, and a `lab` that is missing, not an object,
/// in an unknown state, or whose groups do not add up to the marks missed is null, so the result
/// keeps today's breakdown rather than drawing a ledger that does not add up.
class MistakeLab {
  const MistakeLab({
    required this.version,
    required this.state,
    required this.labels,
    required this.heading,
    required this.gap,
    this.headline,
    this.groups = const [],
    this.barLabel,
    this.remark,
    this.cohort,
    this.fine = const [],
    this.byQuestion = const {},
  });

  /// A paper with a usable record of its time and picks: the full split.
  static const ready = 'ready';

  /// No usable record (scored on the device, a record that did not match, no timeline): wrong,
  /// blank and held only.
  static const basic = 'basic';

  /// Nothing missed: the heading only.
  static const none = 'none';

  static const _states = {ready, basic, none};

  /// The `lab` of a result read, or null when it is missing or cannot be trusted.
  static MistakeLab? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final state = asStringOr(j['state'], '');
    final heading = _text(j['heading']);
    final gap = asInt(j['gap']);
    if (!_states.contains(state) || heading == null || gap == null || gap < 0) return null;
    final rawGroups = j['groups'] is List ? j['groups'] as List : const [];
    final groups = <LabGroup>[];
    for (final g in rawGroups) {
      final parsed = g is Map ? LabGroup.tryParse(asJson(g)) : null;
      // One group that cannot be read would break the sum: the whole ledger is set aside.
      if (parsed == null) return null;
      groups.add(parsed);
    }
    if (state != none) {
      if (groups.isEmpty) return null;
      final sum = groups.fold<int>(0, (s, g) => s + g.marks);
      if (sum != gap) return null;
    }
    final byQuestion = <String, LabQuestion>{};
    asJson(j['byQuestion']).forEach((qid, q) {
      if (qid.isNotEmpty && q is Map) byQuestion[qid] = LabQuestion.fromJson(asJson(q));
    });
    final headline = j['headline'] is Map ? LabHeadline.tryParse(asJson(j['headline'])) : null;
    return MistakeLab(
      version: asInt(j['version']) ?? 1,
      state: state,
      labels: LabLabels.fromJson(asJson(j['labels'])),
      heading: heading,
      gap: gap,
      headline: headline,
      groups: groups,
      barLabel: _text(j['barLabel']),
      remark: j['remark'] is Map ? LabRemark.tryParse(asJson(j['remark'])) : null,
      cohort: j['cohort'] is Map ? LabCohort.tryParse(asJson(j['cohort'])) : null,
      fine: _texts(j['fine']),
      byQuestion: byQuestion,
    );
  }

  final int version;

  /// [ready], [basic] or [none].
  final String state;
  final LabLabels labels;

  /// "You missed 112 marks. Here's where they went." or "You didn't miss a mark this session."
  final String heading;

  /// Marks missed: 6 for each wrong answer and 5 for each blank. The groups add up to it.
  final int gap;

  /// The one sentence that names the biggest way marks were lost, when it passes its gate.
  final LabHeadline? headline;

  /// The groups in their fixed order, only those with marks.
  final List<LabGroup> groups;

  /// What the bar says to a screen reader: "112 marks missed: 12 right then changed, ...".
  final String? barLabel;

  /// "Your first picks, re-marked: ...", when a counted question had a change.
  final LabRemark? remark;

  /// The questions most other students got right, and where the cohort numbers come from.
  final LabCohort? cohort;

  /// Fine lines under the legend (how the split was made, or why it is wrong and blank only).
  final List<String> fine;

  /// Per question id: its group and how other students answered it.
  final Map<String, LabQuestion> byQuestion;

  /// Whether the ledger draws: a full or basic split with at least one group.
  bool get showsLedger => (state == ready || state == basic) && groups.isNotEmpty;

  /// How other students answered question [qid], or null.
  LabOthers? othersFor(String qid) => byQuestion[qid]?.others;
}

/// The words the server sends for the Lab's own labels. A missing label falls back to contract
/// v1's word, so an older server still reads the same.
class LabLabels {
  const LabLabels({
    this.name = 'Mistake Lab',
    this.othersTitle = 'How others answered',
    this.showMore = 'Show {k} more',
    this.seeChanges = 'See every change',
  });

  factory LabLabels.fromJson(Json j) => LabLabels(
        name: _text(j['name']) ?? 'Mistake Lab',
        othersTitle: _text(j['othersTitle']) ?? 'How others answered',
        showMore: _text(j['showMore']) ?? 'Show {k} more',
        seeChanges: _text(j['seeChanges']) ?? 'See every change',
      );

  final String name;
  final String othersTitle;

  /// "Show {k} more", with the count in braces.
  final String showMore;
  final String seeChanges;

  String showMoreFor(int k) => showMore.replaceAll('{k}', '$k');
}

/// The headline sentence and the group it names.
class LabHeadline {
  const LabHeadline({required this.group, required this.text});

  static LabHeadline? tryParse(Json j) {
    final text = _text(j['text']);
    if (text == null) return null;
    return LabHeadline(group: asStringOr(j['group'], ''), text: text);
  }

  final String group;
  final String text;
}

/// One way marks were lost: `changed_from_right`, `never_opened`, `long_stay`, `quick_wrong`,
/// `other_wrong`, `other_blank` and `held` (state ready), or `wrong`, `blank` and `held` (basic).
class LabGroup {
  const LabGroup({
    required this.id,
    required this.label,
    required this.marks,
    required this.count,
    required this.numbers,
    required this.line,
    this.doLine,
    this.open = false,
  });

  static const changedFromRight = 'changed_from_right';
  static const neverOpened = 'never_opened';
  static const longStay = 'long_stay';
  static const quickWrong = 'quick_wrong';
  static const otherWrong = 'other_wrong';
  static const otherBlank = 'other_blank';
  static const held = 'held';
  static const wrong = 'wrong';
  static const blank = 'blank';

  /// A group with no id, label or line, or with marks or a count that are not whole numbers of
  /// zero or more, cannot be shown honestly.
  static LabGroup? tryParse(Json j) {
    final id = asStringOr(j['id'], '');
    final label = _text(j['label']);
    final line = _text(j['line']);
    final marks = asInt(j['marks']);
    final count = asInt(j['count']);
    if (id.isEmpty || label == null || line == null || marks == null || marks < 0 || count == null || count < 0) return null;
    return LabGroup(
      id: id,
      label: label,
      marks: marks,
      count: count,
      numbers: _numbers(j['numbers']),
      line: line,
      doLine: _text(j['doLine']),
      open: asBool(j['open']) ?? false,
    );
  }

  final String id;

  /// "Right, then changed".
  final String label;
  final int marks;

  /// Questions in the group.
  final int count;

  /// 1-based question numbers of this paper, in order.
  final List<int> numbers;

  /// "12 marks on 2 questions".
  final String line;

  /// The one thing to do. Null when the server has none for this group.
  final String? doLine;

  /// Starts open (the headline's group).
  final bool open;
}

/// The same paper re-marked with the first picks.
class LabRemark {
  const LabRemark({required this.text, this.first, this.last, this.questions, this.fine});

  static LabRemark? tryParse(Json j) {
    final text = _text(j['text']);
    if (text == null) return null;
    return LabRemark(
      text: text,
      first: asInt(j['first']),
      last: asInt(j['final']),
      questions: asInt(j['questions']),
      fine: _text(j['fine']),
    );
  }

  final String text;
  final int? first;

  /// The final answers' marks (`final` in the contract).
  final int? last;
  final int? questions;
  final String? fine;
}

/// "3 questions you lost were ones most other students got right: ...", and the fine lines that
/// say where the other students' answers come from.
class LabCohort {
  const LabCohort({this.line, this.numbers = const [], this.marks, this.fine = const []});

  static LabCohort? tryParse(Json j) {
    final line = _text(j['line']);
    final fine = _texts(j['fine']);
    if (line == null && fine.isEmpty) return null;
    return LabCohort(line: line, numbers: line == null ? const [] : _numbers(j['numbers']), marks: asInt(j['marks']), fine: fine);
  }

  final String? line;
  final List<int> numbers;
  final int? marks;
  final List<String> fine;
}

/// One question's place in the Lab.
class LabQuestion {
  const LabQuestion({this.group, this.others});

  factory LabQuestion.fromJson(Json j) => LabQuestion(
        group: _text(j['group']),
        others: j['others'] is Map ? LabOthers.tryParse(asJson(j['others'])) : null,
      );

  final String? group;
  final LabOthers? others;
}

/// How other students answered this question: their first answers, the student left out.
class LabOthers {
  const LabOthers({
    required this.n,
    required this.right,
    required this.counts,
    required this.line,
    this.keyIndex,
    this.small = false,
    this.optionLabels = const [],
  });

  /// Null when the line is missing or the counts do not add up to [n] (the bars would lie).
  static LabOthers? tryParse(Json j) {
    final line = _text(j['line']);
    final n = asInt(j['n']);
    final right = asInt(j['right']);
    final counts = j['counts'] is List ? [for (final c in j['counts'] as List) asInt(c) ?? -1] : const <int>[];
    if (line == null || n == null || n <= 0 || right == null || counts.isEmpty || counts.any((c) => c < 0)) return null;
    if (counts.fold<int>(0, (s, c) => s + c) != n) return null;
    return LabOthers(
      n: n,
      right: right,
      counts: counts,
      line: line,
      keyIndex: asInt(j['keyIndex']),
      small: asBool(j['small']) ?? false,
      optionLabels: _texts(j['optionLabels']),
    );
  }

  /// Other students who answered.
  final int n;

  /// Of them, on today's key.
  final int right;

  /// Picks per option, in this paper's served order.
  final List<int> counts;

  /// "31 other students answered this. 19 got it right. ..."
  final String line;
  final int? keyIndex;

  /// 10 to 19 students ("A small group so far.").
  final bool small;

  /// "Option A: chosen by 3 of 31 other students.", one per option.
  final List<String> optionLabels;

  /// The share of [n] that chose option [i], 0 to 1.
  double shareOf(int i) => i < 0 || i >= counts.length ? 0 : counts[i] / n;

  /// What a screen reader hears for option [i], or null.
  String? labelFor(int i) => i >= 0 && i < optionLabels.length ? optionLabels[i] : null;
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}

List<String> _texts(Object? v) => v is List ? [for (final e in v) ?_text(e)] : const [];

List<int> _numbers(Object? v) => v is List ? [for (final e in v) if (asInt(e) case final n? when n > 0) n] : const [];
