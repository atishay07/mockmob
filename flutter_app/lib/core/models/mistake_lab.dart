import 'json_helpers.dart';
import 'lab_loop.dart';
import 'mistake_lab_traps.dart';

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
    this.replay,
    this.time,
    this.acrossMocks,
    this.repairOrder,
    this.rules,
    this.ruleCheck,
    this.traps,
    this.later,
    this.older,
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
      replay: LabReplay.tryParse(j['replay']),
      time: j['time'] is Map ? asJson(j['time']) : null,
      // Slice 3: each part is read on its own, and one that cannot be read is simply absent.
      acrossMocks: AcrossMocks.tryParse(j['acrossMocks']),
      repairOrder: RepairOrder.tryParse(j['repairOrder']),
      rules: LabRules.tryParse(j['rules']),
      ruleCheck: j['prove'] is Map ? RuleCheck.tryParse(asJson(j['prove'])['ruleCheck']) : null,
      // Slice 4: the trap tags and Same mistakes later, each read on its own.
      traps: LabTraps.tryParse(j['traps']),
      later: j['prove'] is Map ? SameMistakesLater.tryParse(asJson(j['prove'])['later']) : null,
      // Repair v4: an older paper's one honest line and its one action. Read on its own.
      older: LabOlder.tryParse(j['older']),
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

  /// The paper replayed as a clock (slice 2, spec 4.5). Null without a usable record, or when the
  /// server's replay cannot be read honestly.
  final LabReplay? replay;

  /// The finished Time and decisions read (slice 2: `lab.time`, the same object the website shows),
  /// read by the result's own model. Null from an older server.
  final Json? time;

  /// Across your mocks (slice 3, spec 4.9): the record as it stood when this paper was taken.
  /// Null from an older server.
  final AcrossMocks? acrossMocks;

  /// The repair queue by how other students answered (slice 3, spec 4.7).
  final RepairOrder? repairOrder;

  /// The Rule book's count and the rule in force (slice 3, spec 4.10), for the Repair step's link.
  final LabRules? rules;

  /// The rule in force when this mock started, checked on it (slice 3, spec 4.8, Prove). Null
  /// when no rule was in force or the paper is not a mock.
  final RuleCheck? ruleCheck;

  /// The trap named under the student's wrong option, by question (slice 4, spec 4.7). Null when
  /// no wrong answer has one, or from an older server.
  final LabTraps? traps;

  /// Which of this paper's wrong answers come back in Revise, and when (slice 4, spec 4.8).
  final SameMistakesLater? later;

  /// What this older paper's record cannot show, and why, with the one action that makes the next
  /// paper whole (Repair v4). Null when the paper's record is whole, or from an older server.
  final LabOlder? older;

  /// The question numbers of group [id] (a replay chip's filter), empty when it has none.
  List<int> numbersOf(String id) {
    for (final g in groups) {
      if (g.id == id) return g.numbers;
    }
    return const [];
  }

  /// Whether the ledger draws: a full or basic split with at least one group.
  bool get showsLedger => (state == ready || state == basic) && groups.isNotEmpty;

  /// How other students answered question [qid], or null.
  LabOthers? othersFor(String qid) => byQuestion[qid]?.others;
}

/// An older paper's record is not whole, said once and honestly (`lab.older`, built by the
/// website's `olderPaper` in `data/mistake_lab.js`): the line says what the record cannot show and
/// why (nothing here is a cause or a forecast), and the action is a timed mock of that subject.
class LabOlder {
  const LabOlder({required this.reason, required this.line, this.action});

  /// Null when there is no line: a note with nothing to say is no note.
  static LabOlder? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final line = _text(j['line']);
    if (line == null) return null;
    return LabOlder(reason: _text(j['reason']) ?? '', line: line, action: LabOlderAction.tryParse(j['action']));
  }

  /// `no_clock`, `short`, `unreadable`, `not_matched` or `before_capture`; anything else reads as it is.
  final String reason;

  /// "This paper has no clock record, so its time, answer changes and replay are not shown."
  final String line;

  /// Null when the server sent no usable action: the line shows alone.
  final LabOlderAction? action;
}

/// "Take a timed mock to see your full Lab": a full mock of [subject], through the practice setup
/// (which shows its cost before anything starts).
class LabOlderAction {
  const LabOlderAction({required this.label, this.subject, this.mode = 'full'});

  static LabOlderAction? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final label = _text(j['label']);
    if (label == null) return null;
    return LabOlderAction(label: label, subject: _text(j['subject']), mode: _text(j['mode']) ?? 'full');
  }

  final String label;

  /// The attempt's subject id (`accountancy`), or null for a paper with none.
  final String? subject;

  /// `full`: a timed mock.
  final String mode;
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

/// One way marks were lost: `changed_from_right`, `struck_key`, `never_opened`, `long_stay`,
/// `quick_wrong`, `other_wrong`, `other_blank` and `held` (state ready), or `wrong`, `blank` and
/// `held` (basic).
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

  /// Wrong, and the key was crossed out at some point (slice 2, with strike-outs captured).
  static const struckKey = 'struck_key';
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
  const LabCohort({this.line, this.numbers = const [], this.marks, this.fine = const [], this.slow});

  static LabCohort? tryParse(Json j) {
    final line = _text(j['line']);
    final fine = _texts(j['fine']);
    final slow = j['slow'] is Map ? LabSlow.tryParse(asJson(j['slow'])) : null;
    if (line == null && slow == null && fine.isEmpty) return null;
    return LabCohort(line: line, numbers: line == null ? const [] : _numbers(j['numbers']), marks: asInt(j['marks']), fine: fine, slow: slow);
  }

  final String? line;
  final List<int> numbers;
  final int? marks;
  final List<String> fine;

  /// Slice 5: the questions that took over twice as long as the students who got them right. Null
  /// until the server sends it (5 or more such questions, each with 15 or more timed right answers).
  final LabSlow? slow;
}

/// `cohort.slow`: "On 7 questions you took over twice as long as the students who got them right.
/// You got 5 of the 7 right." with the question numbers as chips. The sentence arrives finished;
/// [questions] and [right] are its two numbers, read only so the line can be checked against them.
class LabSlow {
  const LabSlow({required this.line, required this.numbers, this.questions, this.right});

  /// Null when the line is missing. A line without numbers still shows, without chips.
  static LabSlow? tryParse(Json j) {
    final line = _text(j['line']);
    if (line == null) return null;
    return LabSlow(line: line, numbers: _numbers(j['numbers']), questions: asInt(j['questions']), right: asInt(j['right']));
  }

  final String line;
  final List<int> numbers;
  final int? questions;
  final int? right;
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
    this.lines = const [],
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
      lines: j['lines'] is List ? _texts([for (final e in j['lines'] as List) if (e is String) e]) : const [],
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

  /// Slice 5, each present only once the server's gate passed (30, 20 and 20 students): how long the
  /// students who got it right took, how many changed their answer, how many crossed out the key.
  /// Every line carries its own denominator. Empty when the server sends none.
  final List<String> lines;

  /// The share of [n] that chose option [i], 0 to 1.
  double shareOf(int i) => i < 0 || i >= counts.length ? 0 : counts[i] / n;

  /// What a screen reader hears for option [i], or null.
  String? labelFor(int i) => i >= 0 && i < optionLabels.length ? optionLabels[i] : null;
}

/// `lab.replay` (Mistake Lab v4 slice 2, spec 4.5, built by the website's `data/replay.js`): the
/// paper as a clock of 10-minute rows. Each visit is a bar from entering to leaving, with its picks,
/// marks for review and time away; every sentence (row ends, the end, the three facts, the chips)
/// arrives finished. Times are whole seconds from the start of the paper.
///
/// Read strictly: a row or a bar that cannot be read sets the whole replay aside (null), so the app
/// never draws a clock that is missing part of the paper.
class LabReplay {
  const LabReplay({
    required this.version,
    required this.rowSec,
    required this.durationSec,
    required this.recordSec,
    required this.playMs,
    required this.total,
    required this.labels,
    required this.rows,
    this.end,
    this.facts = const [],
    this.chips = const [],
    this.firstOnScreen = const {},
  });

  static LabReplay? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final rowSec = asInt(j['rowSec']);
    final durationSec = asInt(j['durationSec']);
    final recordSec = asInt(j['recordSec']);
    final total = asInt(j['total']);
    if (rowSec == null || rowSec <= 0 || recordSec == null || recordSec <= 0 || total == null || total <= 0) return null;
    final rawRows = j['rows'] is List ? j['rows'] as List : const [];
    final rows = <ReplayRow>[];
    for (final r in rawRows) {
      final row = r is Map ? ReplayRow.tryParse(asJson(r), total: total) : null;
      if (row == null) return null;
      rows.add(row);
    }
    if (rows.isEmpty) return null;
    final chips = <ReplayChip>[
      for (final c in (j['chips'] is List ? j['chips'] as List : const []))
        if (c is Map) ?ReplayChip.tryParse(asJson(c)),
    ];
    return LabReplay(
      version: asInt(j['version']) ?? 1,
      rowSec: rowSec,
      durationSec: durationSec != null && durationSec > 0 ? durationSec : recordSec,
      recordSec: recordSec,
      playMs: (asInt(j['playMs']) ?? 15000).clamp(3000, 60000),
      total: total,
      labels: ReplayLabels.fromJson(asJson(j['labels'])),
      rows: rows,
      end: j['end'] is Map ? ReplayEnd.tryParse(asJson(j['end'])) : null,
      facts: _texts(j['facts']),
      chips: chips,
      firstOnScreen: {
        for (final o in asJsonList(j['opened']))
          if (asInt(o['n']) case final n? when n >= 1 && n <= total)
            if (asInt(o['at']) case final at? when at >= 0) n: at,
      },
    );
  }

  final int version;

  /// Seconds a row covers (600: 10 minutes, so a row fits a phone).
  final int rowSec;

  /// The paper's own length in seconds (the even pace counts against it).
  final int durationSec;

  /// Where the record ends, in seconds (the end event, or the last event).
  final int recordSec;

  /// How long Play takes for the whole record.
  final int playMs;

  /// Questions in the paper.
  final int total;
  final ReplayLabels labels;
  final List<ReplayRow> rows;
  final ReplayEnd? end;

  /// The three facts under the grid.
  final List<String> facts;

  /// The filter chips, the ledger's own words; the first is "All".
  final List<ReplayChip> chips;

  /// When each question first came on screen, by number (`replay.opened`, seconds). A question of a
  /// passage set the website showed whole, but never in focus, has no bar and is still opened. An
  /// older replay without the list leaves it empty, and the bars say it alone.
  final Map<int, int> firstOnScreen;

  /// Every visit, in time order.
  List<ReplayBar> get bars => [for (final r in rows) ...r.bars];

  /// Whether the rows carry the even pace (the paper's limit is known).
  bool get hasPace => rows.every((r) => r.evenPaceBy != null);

  /// Questions answered at [sec]: each question's latest pick at or before it, a clear counting as
  /// unanswered. The same count as each row's "By 10:00: 9 of 50 answered".
  int answeredAt(num sec) => answeredSetAt(sec).length;

  /// The question numbers answered at [sec].
  Set<int> answeredSetAt(num sec) {
    final latest = <int, ({int at, int? option})>{};
    for (final b in bars) {
      for (final p in b.picks) {
        if (p.at > sec) continue;
        final had = latest[b.n];
        if (had == null || p.at >= had.at) latest[b.n] = (at: p.at, option: p.option);
      }
    }
    return {for (final e in latest.entries) if (e.value.option != null) e.key};
  }

  /// The question numbers opened at or before [sec]: a bar, or the server's own first time on screen.
  Set<int> openedAt(num sec) => {
        for (final b in bars)
          if (b.from <= sec) b.n,
        for (final e in firstOnScreen.entries)
          if (e.value <= sec) e.key,
      };

  /// The visit on screen at [sec], or null (before the first or after the record).
  ReplayBar? barAt(num sec) {
    final all = bars;
    for (final b in all) {
      if (b.from <= sec && sec < b.to) return b;
    }
    final last = all.isEmpty ? null : all.last;
    return last != null && sec >= last.to && sec <= recordSec ? last : null;
  }

  /// The even pace at [sec]: the questions the paper's own time a question reaches by then. A
  /// reference only, never a target.
  int evenPaceAt(num sec) => (sec * total / durationSec).floor().clamp(0, total);

  /// Every moment the record shows, in order: each visit's start, each pick and mark, and the end.
  /// Previous and Next step through these (reduced motion).
  List<int> get moments {
    final out = <int>{0};
    for (final b in bars) {
      out.add(b.from);
      for (final p in b.picks) {
        out.add(p.at);
      }
      out.addAll(b.marks);
    }
    out.add(recordSec);
    return [for (final m in out) if (m >= 0 && m <= recordSec) m]..sort();
  }
}

/// The replay's own words.
class ReplayLabels {
  const ReplayLabels({
    this.title = 'Replay',
    this.sub = 'Your paper, minute by minute',
    this.play = 'Play',
    this.pause = 'Pause',
    this.previous = 'Previous',
    this.next = 'Next',
    this.seeInReplay = 'See it in the replay',
    this.clockNote = 'Clock times count from the start of the paper.',
    this.evenPaceNote = "Even pace is the paper's own time a question. It is a reference, not a target.",
  });

  factory ReplayLabels.fromJson(Json j) {
    const d = ReplayLabels();
    return ReplayLabels(
      title: _text(j['title']) ?? d.title,
      sub: _text(j['sub']) ?? d.sub,
      play: _text(j['play']) ?? d.play,
      pause: _text(j['pause']) ?? d.pause,
      previous: _text(j['previous']) ?? d.previous,
      next: _text(j['next']) ?? d.next,
      seeInReplay: _text(j['seeInReplay']) ?? d.seeInReplay,
      clockNote: _text(j['clockNote']) ?? d.clockNote,
      evenPaceNote: _text(j['evenPaceNote']) ?? d.evenPaceNote,
    );
  }

  final String title;
  final String sub;
  final String play;
  final String pause;
  final String previous;
  final String next;
  final String seeInReplay;
  final String clockNote;
  final String evenPaceNote;
}

/// How the record ended: "Submitted at 51:46." ([reason] `submit`, `time_up` or `nta_strikes`).
class ReplayEnd {
  const ReplayEnd({required this.at, required this.reason, required this.label});

  static ReplayEnd? tryParse(Json j) {
    final at = asInt(j['at']);
    final label = _text(j['label']);
    if (at == null || at < 0 || label == null) return null;
    return ReplayEnd(at: at, reason: asStringOr(j['reason'], ''), label: label);
  }

  final int at;
  final String reason;
  final String label;
}

/// One 10-minute row: "By 20:00: 14 of 50 answered. Even pace: 16." and its visits.
class ReplayRow {
  const ReplayRow({required this.from, required this.to, required this.label, required this.answeredBy, this.evenPaceBy, this.bars = const []});

  static ReplayRow? tryParse(Json j, {required int total}) {
    final from = asInt(j['from']);
    final to = asInt(j['to']);
    final label = _text(j['label']);
    if (from == null || to == null || from < 0 || to <= from || label == null) return null;
    final bars = <ReplayBar>[];
    for (final b in (j['bars'] is List ? j['bars'] as List : const [])) {
      final bar = b is Map ? ReplayBar.tryParse(asJson(b), total: total) : null;
      if (bar == null || bar.from < from || bar.to > to) return null;
      bars.add(bar);
    }
    return ReplayRow(from: from, to: to, label: label, answeredBy: asInt(j['answeredBy']) ?? 0, evenPaceBy: asInt(j['evenPaceBy']), bars: bars);
  }

  final int from;
  final int to;
  final String label;
  final int answeredBy;

  /// Null when the paper's limit is not known.
  final int? evenPaceBy;
  final List<ReplayBar> bars;
}

/// One visit: question [n] on screen from [from] to [to], filled by its final [result].
class ReplayBar {
  const ReplayBar({
    required this.qid,
    required this.n,
    required this.from,
    required this.to,
    required this.result,
    this.picks = const [],
    this.marks = const [],
    this.away = const [],
  });

  static const right = 'right';
  static const wrong = 'wrong';
  static const blank = 'blank';
  static const held = 'held';
  static const _results = {right, wrong, blank, held};

  static ReplayBar? tryParse(Json j, {required int total}) {
    final qid = asStringOr(j['qid'], '');
    final n = asInt(j['n']);
    final from = asInt(j['from']);
    final to = asInt(j['to']);
    final result = asStringOr(j['result'], '');
    if (qid.isEmpty || n == null || n < 1 || n > total || from == null || to == null || to < from || !_results.contains(result)) return null;
    return ReplayBar(
      qid: qid,
      n: n,
      from: from,
      to: to,
      result: result,
      picks: [
        for (final p in (j['picks'] is List ? j['picks'] as List : const []))
          if (p is Map && asInt(p['at']) != null) ReplayPick(at: asInt(p['at'])!, option: asInt(p['option']), change: asBool(p['change']) ?? false),
      ],
      marks: [for (final m in (j['marks'] is List ? j['marks'] as List : const [])) ?asInt(m)],
      away: [
        for (final a in (j['away'] is List ? j['away'] as List : const []))
          if (a is Map && asInt(a['from']) != null && asInt(a['to']) != null)
            ReplaySpan(from: asInt(a['from'])!, to: asInt(a['to'])!, label: _text(a['label']) ?? ''),
      ],
    );
  }

  final String qid;

  /// The question's number in this paper.
  final int n;
  final int from;
  final int to;

  /// [right], [wrong], [blank] or [held] (under re-check or corrected).
  final String result;
  final List<ReplayPick> picks;

  /// When it was marked for review.
  final List<int> marks;

  /// Time away from the paper (or, on an old record, a break of over 30 minutes) inside this visit.
  final List<ReplaySpan> away;

  int get length => to - from;
}

/// A pick: the served [option] (null for a clear) at [at]; [change] when it replaced an answer.
class ReplayPick {
  const ReplayPick({required this.at, this.option, this.change = false});

  final int at;
  final int? option;
  final bool change;
}

/// A stretch inside a visit with its own words ("Away 1m 10s", "Not counted 41m").
class ReplaySpan {
  const ReplaySpan({required this.from, required this.to, required this.label});

  final int from;
  final int to;
  final String label;
}

/// A filter chip: "All", or a ledger group with its count.
class ReplayChip {
  const ReplayChip({required this.id, required this.label, this.count});

  static ReplayChip? tryParse(Json j) {
    final id = asStringOr(j['id'], '');
    final label = _text(j['label']);
    if (id.isEmpty || label == null) return null;
    return ReplayChip(id: id, label: label, count: asInt(j['count']));
  }

  static const all = 'all';

  final String id;
  final String label;
  final int? count;
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}

List<String> _texts(Object? v) => v is List ? [for (final e in v) ?_text(e)] : const [];

List<int> _numbers(Object? v) => v is List ? [for (final e in v) if (asInt(e) case final n? when n > 0) n] : const [];
