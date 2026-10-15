import 'json_helpers.dart';

/// Mistake Lab v4 slice 3 (spec 4.7 to 4.10 and 4.12): the student's record across timed mocks,
/// the Rule book, the rule kept for the next mock, its check after that mock, the sheet line
/// before the clock starts, and the repair order by how other students answered.
///
/// The website builds every sentence (`data/across_mocks.js`, `data/rule_book.js`,
/// `data/repair_order.js`) and sends it finished, so the app only lays the words out and the two
/// surfaces cannot drift. Read like the rest of the Lab: unknown fields are ignored, and a part
/// that cannot be read honestly is null, so the screen leaves it out instead of guessing.
///
/// Where each part arrives:
/// - `GET /api/attempts/:id`: `lab.acrossMocks`, `lab.repairOrder`, `lab.rules`, `lab.prove.ruleCheck`
/// - `GET /api/me/rules`: `{ book, acrossMocks }`
/// - `GET /api/me/playbook[?subject=]`: `{ active, startSheet }`
/// - `POST /api/me/playbook {ruleId}`: `{ active }`

/// "Across your mocks" (spec 4.9): at most 3 lines ranked by marks lost, the rest behind
/// "Show all". A line below its own gate states the gate in words instead of a number.
class AcrossMocks {
  const AcrossMocks({
    required this.state,
    required this.title,
    this.version = 1,
    this.mocks,
    this.message,
    this.basis,
    this.lines = const [],
    this.more = const [],
    this.showAll,
    this.showFewer = 'Show fewer',
  });

  /// Two or more timed mocks with a device record: the lines.
  static const ready = 'ready';

  /// One timed mock so far: [message] states the gate.
  static const belowGate = 'below_gate';

  /// No timed mock with a device record yet: [message] says how the first one is made.
  static const none = 'none';

  static const _states = {ready, belowGate, none};

  /// The `acrossMocks` object, or null when it is missing or cannot be shown honestly.
  static AcrossMocks? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final state = asStringOr(j['state'], '');
    final title = _text(j['title']);
    if (!_states.contains(state) || title == null) return null;
    final lines = _lines(j['lines']);
    final more = _lines(j['more']);
    final message = _text(j['message']);
    if (state == ready && lines.isEmpty) return null;
    if (state != ready && message == null) return null;
    return AcrossMocks(
      version: asInt(j['version']) ?? 1,
      state: state,
      title: title,
      mocks: asInt(j['mocks']),
      message: message,
      basis: _text(j['basis']),
      lines: state == ready ? lines : const [],
      more: state == ready ? more : const [],
      showAll: more.isEmpty ? null : _text(j['showAll']),
      showFewer: _text(j['showFewer']) ?? 'Show fewer',
    );
  }

  static List<AcrossLine> _lines(Object? v) => [
        for (final e in v is List ? v : const [])
          if (e is Map) ?AcrossLine.tryParse(asJson(e)),
      ];

  final int version;

  /// [ready], [belowGate] or [none].
  final String state;

  /// "Across your mocks".
  final String title;

  /// Timed mocks read (the window is the newest 10).
  final int? mocks;

  /// The sentence shown instead of lines below the block's gate.
  final String? message;

  /// "From your device's record of 4 timed mocks, marked as each paper was scored."
  final String? basis;

  /// The lines shown at first, most marks lost first.
  final List<AcrossLine> lines;

  /// The rest, behind [showAll].
  final List<AcrossLine> more;

  /// "Show all 5". Null when nothing is folded.
  final String? showAll;
  final String showFewer;

  bool get isReady => state == ready;
}

/// One line of [AcrossMocks]: `second_thoughts`, `changes_help`, `never_opened` (one per
/// subject), `long_stays` or `last_ten`.
class AcrossLine {
  const AcrossLine({required this.id, required this.text, this.subject, this.marks = 0, this.gated = false});

  static const secondThoughts = 'second_thoughts';
  static const changesHelp = 'changes_help';
  static const neverOpened = 'never_opened';
  static const longStays = 'long_stays';
  static const lastTen = 'last_ten';

  static AcrossLine? tryParse(Json j) {
    final id = asStringOr(j['id'], '');
    final text = _text(j['text']);
    if (id.isEmpty || text == null) return null;
    return AcrossLine(id: id, text: text, subject: _text(j['subject']), marks: asInt(j['marks']) ?? 0, gated: asBool(j['gated']) ?? false);
  }

  final String id;
  final String text;
  final String? subject;

  /// The marks this line lost, for ranking only (the sentence says what it measured).
  final int marks;

  /// Below its own gate: [text] states the gate, and no number is measured.
  final bool gated;
}

/// A rule as the server names it: `habit:<key>` or `repair:<24 hex>`, its kind and its words.
class RuleRef {
  const RuleRef({required this.id, required this.kind, required this.text, this.since});

  static const habit = 'habit';
  static const repair = 'repair';

  static RuleRef? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final id = asStringOr(j['id'], '');
    final text = _text(j['text']);
    if (id.isEmpty || text == null) return null;
    final kind = asStringOr(j['kind'], id.startsWith('repair:') ? repair : habit);
    return RuleRef(id: id, kind: kind, text: text, since: asDate(j['since']));
  }

  final String id;
  final String kind;
  final String text;

  /// When the student chose it (the active rule only).
  final DateTime? since;
}

/// The Lab's short form of the Rule book (`lab.rules`): the count for the Repair step's link and
/// the rule in force.
class LabRules {
  const LabRules({required this.count, required this.countLabel, this.active});

  static LabRules? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final count = asInt(j['count']);
    final label = _text(j['countLabel']);
    if (count == null || count < 0 || label == null) return null;
    return LabRules(count: count, countLabel: label, active: RuleRef.tryParse(j['active']));
  }

  final int count;

  /// "Your rules, 7".
  final String countLabel;
  final RuleRef? active;
}

/// The words the Rule book sends for its own labels. A missing label falls back to contract v1's.
class RuleBookLabels {
  const RuleBookLabels({
    this.use = 'Use in my next mock',
    this.inUse = 'Your rule for your next mock',
    this.repairsTitle = 'From your repairs',
    this.habitsTitle = 'From how you take papers',
    this.hook = 'To remember it:',
  });

  factory RuleBookLabels.fromJson(Json j) {
    const d = RuleBookLabels();
    return RuleBookLabels(
      use: _text(j['use']) ?? d.use,
      inUse: _text(j['inUse']) ?? d.inUse,
      repairsTitle: _text(j['repairsTitle']) ?? d.repairsTitle,
      habitsTitle: _text(j['habitsTitle']) ?? d.habitsTitle,
      hook: _text(j['hook']) ?? d.hook,
    );
  }

  /// "Use in my next mock".
  final String use;

  /// "Your rule for your next mock".
  final String inUse;
  final String repairsTitle;
  final String habitsTitle;

  /// "To remember it:", before a repair's memory hook.
  final String hook;
}

/// The Rule book (spec 4.10, `GET /api/me/rules` `book`): rules from the student's repairs,
/// grouped by chapter, and the four rules from how they take papers.
class RuleBook {
  const RuleBook({
    required this.title,
    required this.count,
    required this.countLabel,
    this.version = 1,
    this.labels = const RuleBookLabels(),
    this.active,
    this.repairs = const RepairRules(),
    this.habits = const HabitRules(),
    this.basis,
  });

  static RuleBook? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final title = _text(j['title']);
    final count = asInt(j['count']);
    if (title == null || count == null || count < 0) return null;
    return RuleBook(
      version: asInt(j['version']) ?? 1,
      title: title,
      count: count,
      countLabel: _text(j['countLabel']) ?? title,
      labels: RuleBookLabels.fromJson(asJson(j['labels'])),
      active: RuleRef.tryParse(j['active']),
      repairs: RepairRules.fromJson(asJson(j['repairs'])),
      habits: HabitRules.fromJson(asJson(j['habits'])),
      basis: _text(j['basis']),
    );
  }

  final int version;

  /// "Your rules".
  final String title;
  final int count;

  /// "Your rules, 7".
  final String countLabel;
  final RuleBookLabels labels;

  /// The rule kept for the next mock, or null.
  final RuleRef? active;
  final RepairRules repairs;
  final HabitRules habits;

  /// Where the habit evidence comes from. Null before the first recorded mock.
  final String? basis;

  /// Every rule in the book, flat, in the order shown.
  List<BookRule> get all => [...habits.rules, for (final c in repairs.chapters) ...c.rules];

  /// The book with [rule] as the one in force (the server confirmed it).
  RuleBook withActive(RuleRef rule) => RuleBook(
        version: version,
        title: title,
        count: count,
        countLabel: countLabel,
        labels: labels,
        active: rule,
        repairs: RepairRules(
          empty: repairs.empty,
          chapters: [
            for (final c in repairs.chapters)
              RuleChapter(chapter: c.chapter, rules: [for (final r in c.rules) r.withActive(r.id == rule.id)]),
          ],
        ),
        habits: HabitRules(
          state: habits.state,
          gateLine: habits.gateLine,
          rules: [for (final r in habits.rules) r.withActive(r.id == rule.id)],
        ),
        basis: basis,
      );
}

/// Anything the Rule book lists: a repair's rule or a paper habit.
sealed class BookRule {
  const BookRule({required this.id, required this.text, this.active = false});

  final String id;
  final String text;

  /// The rule in force for the next mock.
  final bool active;

  String get kind;
  BookRule withActive(bool on);
  RuleRef get ref => RuleRef(id: id, kind: kind, text: text);
}

/// "From your repairs": every committed repair's rule, by chapter, newest first.
class RepairRules {
  const RepairRules({this.empty, this.chapters = const []});

  factory RepairRules.fromJson(Json j) {
    final chapters = <RuleChapter>[];
    for (final c in asJsonList(j['chapters'])) {
      final name = _text(c['chapter']);
      final rules = [for (final r in asJsonList(c['rules'])) ?RepairRule.tryParse(r)];
      if (name != null && rules.isNotEmpty) chapters.add(RuleChapter(chapter: name, rules: rules));
    }
    return RepairRules(empty: chapters.isEmpty ? _text(j['empty']) : null, chapters: chapters);
  }

  /// "Your first repair adds a rule here." when there are none.
  final String? empty;
  final List<RuleChapter> chapters;
}

class RuleChapter {
  const RuleChapter({required this.chapter, required this.rules});

  final String chapter;
  final List<RepairRule> rules;
}

/// One repair's rule and its memory hook.
class RepairRule extends BookRule {
  const RepairRule({required super.id, required super.text, super.active, this.hook, this.number, this.subject, this.repairedAt});

  static RepairRule? tryParse(Json j) {
    final id = asStringOr(j['id'], '');
    final text = _text(j['text']);
    if (!id.startsWith('repair:') || text == null) return null;
    final number = asInt(j['number']);
    return RepairRule(
      id: id,
      text: text,
      hook: _text(j['hook']),
      number: number != null && number > 0 ? number : null,
      subject: _text(j['subject']),
      repairedAt: asDate(j['repairedAt']),
      active: asBool(j['active']) ?? false,
    );
  }

  /// "Arrears are owed to you, not paid.", or null for an older repair with a key idea only.
  final String? hook;
  final int? number;
  final String? subject;
  final DateTime? repairedAt;

  @override
  String get kind => RuleRef.repair;

  @override
  RepairRule withActive(bool on) =>
      RepairRule(id: id, text: text, active: on, hook: hook, number: number, subject: subject, repairedAt: repairedAt);
}

/// "From how you take papers": the four habits, each with its evidence line, or the gate line.
class HabitRules {
  const HabitRules({this.state = belowGate, this.gateLine, this.rules = const []});

  static const ready = 'ready';
  static const belowGate = 'below_gate';

  factory HabitRules.fromJson(Json j) {
    final state = asStringOr(j['state'], belowGate) == ready ? ready : belowGate;
    final rules = [for (final r in asJsonList(j['rules'])) ?HabitRule.tryParse(r)];
    return HabitRules(state: state, gateLine: _text(j['gateLine']), rules: state == ready ? rules : const []);
  }

  final String state;

  /// "Rules from how you take papers need 3 timed mocks. You have 1 of 3."
  final String? gateLine;
  final List<HabitRule> rules;

  bool get isReady => state == ready;
}

/// One paper habit, worded as the ledger's do line, with one evidence line.
class HabitRule extends BookRule {
  const HabitRule({required super.id, required super.text, required this.evidence, super.active, this.gated = false, this.interval});

  static HabitRule? tryParse(Json j) {
    final id = asStringOr(j['id'], '');
    final text = _text(j['text']);
    final evidence = _text(j['evidence']);
    if (!id.startsWith('habit:') || text == null || evidence == null) return null;
    final gated = asBool(j['gated']) ?? false;
    return HabitRule(
      id: id,
      text: text,
      evidence: evidence,
      gated: gated,
      interval: gated ? null : RuleInterval.tryParse(j['interval']),
      active: asBool(j['active']) ?? false,
    );
  }

  /// "Answers after 2 minutes: 3 right of 8. Faster answers: 143 right of 163.", or the gate.
  final String evidence;

  /// Below its minimum count: [evidence] states the gate.
  final bool gated;

  /// The Wilson interval behind the evidence (95%), in whole percents.
  final RuleInterval? interval;

  @override
  String get kind => RuleRef.habit;

  @override
  HabitRule withActive(bool on) => HabitRule(id: id, text: text, evidence: evidence, active: on, gated: gated, interval: interval);
}

/// `k` of `n`, `pct` percent, with a 95% Wilson interval from `low` to `high` percent.
class RuleInterval {
  const RuleInterval({required this.k, required this.n, required this.pct, required this.low, required this.high});

  static RuleInterval? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final k = asInt(j['k']);
    final n = asInt(j['n']);
    final pct = asInt(j['pct']);
    final low = asInt(j['low']);
    final high = asInt(j['high']);
    if (k == null || n == null || pct == null || low == null || high == null) return null;
    if (n <= 0 || k < 0 || k > n || low < 0 || high > 100 || low > pct || pct > high) return null;
    return RuleInterval(k: k, n: n, pct: pct, low: low, high: high);
  }

  final int k;
  final int n;
  final int pct;
  final int low;
  final int high;
}

/// The rule check in Prove (spec 4.8, `lab.prove.ruleCheck`): the rule in force when this mock
/// started, checked on its record with the timed mock before it in brackets. Arithmetic only.
class RuleCheck {
  const RuleCheck({
    required this.state,
    required this.rule,
    required this.line,
    required this.result,
    this.version = 1,
    this.title = 'Your rule',
    this.numbers,
    this.fine,
  });

  static const kept = 'kept';
  static const notKept = 'not_kept';
  static const counted = 'counted';
  static const notChecked = 'not_checked';

  static const _states = {kept, notKept, counted, notChecked};

  static RuleCheck? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final state = asStringOr(j['state'], '');
    final rule = RuleRef.tryParse(j['rule']);
    final line = _text(j['line']);
    final result = _text(j['result']);
    if (!_states.contains(state) || rule == null || line == null || result == null) return null;
    return RuleCheck(
      version: asInt(j['version']) ?? 1,
      state: state,
      rule: rule,
      title: _text(j['title']) ?? 'Your rule',
      line: line,
      result: result,
      numbers: RuleCheckNumbers.tryParse(j['numbers']),
      fine: _text(j['fine']),
    );
  }

  /// [kept], [notKept], [counted] or [notChecked].
  final String state;
  final RuleRef rule;
  final int version;

  /// "Your rule".
  final String title;

  /// "Your rule: open every question once before you go deep on any."
  final String line;

  /// "Not kept: 4 of 50 questions never opened (last mock: 4 of 50)."
  final String result;
  final RuleCheckNumbers? numbers;

  /// Where the count comes from.
  final String? fine;
}

/// The counts behind a rule check: this mock and the timed mock before it.
class RuleCheckNumbers {
  const RuleCheckNumbers({required this.now, required this.total, this.last, this.lastTotal});

  static RuleCheckNumbers? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final now = asInt(j['now']);
    final total = asInt(j['total']);
    if (now == null || total == null || now < 0 || total < 0) return null;
    return RuleCheckNumbers(now: now, total: total, last: asInt(j['last']), lastTotal: asInt(j['lastTotal']));
  }

  final int now;
  final int total;
  final int? last;
  final int? lastTotal;
}

/// The repair queue by how other students answered (spec 4.7, `lab.repairOrder`): the wrong
/// answers most other students got right first, then common traps, then paper order. Held
/// questions are never in it.
class RepairOrder {
  const RepairOrder({required this.state, required this.items, this.version = 1});

  /// At least one item is led by what other students answered.
  static const cohort = 'cohort';

  /// Paper order: today's key and words stay.
  static const paper = 'paper';

  static RepairOrder? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final state = asStringOr(j['state'], '');
    if (state != cohort && state != paper) return null;
    final items = [for (final i in asJsonList(j['items'])) ?RepairOrderItem.tryParse(i)];
    if (items.isEmpty) return null;
    return RepairOrder(version: asInt(j['version']) ?? 1, state: state, items: items);
  }

  final int version;
  final String state;
  final List<RepairOrderItem> items;

  bool get isCohort => state == cohort;

  /// The question ids in repair order.
  List<String> get qids => [for (final i in items) i.qid];
}

/// One wrong answer in repair order. [key] and [line] only on an item led by the cohort.
class RepairOrderItem {
  const RepairOrderItem({required this.qid, required this.number, required this.reason, this.key, this.line});

  static const mostRight = 'most_right';
  static const commonTrap = 'common_trap';
  static const paperOrder = 'paper';

  static RepairOrderItem? tryParse(Json j) {
    final qid = asStringOr(j['qid'], '');
    final number = asInt(j['number']);
    if (qid.isEmpty || number == null || number <= 0) return null;
    final key = _text(j['key']);
    final line = _text(j['line']);
    // A key without its line (or a line without its key) would be a claim without its evidence.
    final led = key != null && line != null;
    return RepairOrderItem(
      qid: qid,
      number: number,
      reason: asStringOr(j['reason'], paperOrder),
      key: led ? key : null,
      line: led ? line : null,
    );
  }

  final String qid;
  final int number;
  final String reason;

  /// "Repair Q12 first".
  final String? key;

  /// "26 of 31 other students got it right."
  final String? line;

  bool get isLed => key != null;
}

/// The two strings MockMob's own sheet shows before the clock starts (spec 4.12).
class StartSheetLines {
  const StartSheetLines({required this.rule, this.last});

  static StartSheetLines? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final rule = _text(j['rule']);
    if (rule == null) return null;
    return StartSheetLines(rule: rule, last: _text(j['last']));
  }

  /// "Your rule for this mock: open every question once before you go deep on any."
  final String rule;

  /// "Last mock: 4 of 50 questions never opened.", or null when the record cannot say.
  final String? last;
}

/// `GET /api/me/playbook`: the rule in force and the start sheet's strings.
class PlaybookRead {
  const PlaybookRead({this.active, this.startSheet});

  factory PlaybookRead.fromJson(Object? v) {
    final j = asJson(v);
    return PlaybookRead(active: RuleRef.tryParse(j['active']), startSheet: StartSheetLines.tryParse(j['startSheet']));
  }

  final RuleRef? active;
  final StartSheetLines? startSheet;
}

/// `GET /api/me/rules`: the Rule book and Across your mocks. Throws [FormatException] when
/// neither can be read, so the read counts as failed rather than empty.
class RulesRead {
  const RulesRead({this.book, this.acrossMocks});

  factory RulesRead.parse(Object? v) {
    if (v is! Map) throw const FormatException('rules: not an object');
    final j = asJson(v);
    final book = RuleBook.tryParse(j['book']);
    final across = AcrossMocks.tryParse(j['acrossMocks']);
    if (book == null && across == null) throw const FormatException('rules: nothing readable');
    return RulesRead(book: book, acrossMocks: across);
  }

  final RuleBook? book;
  final AcrossMocks? acrossMocks;

  /// The same read with [book] replaced (after the server confirmed a new rule in force).
  RulesRead withBook(RuleBook next) => RulesRead(book: next, acrossMocks: acrossMocks);
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}
