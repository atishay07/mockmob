import '../../../core/models/json_helpers.dart';
import '../../../core/models/repair_check.dart';

/// The Mobi v13 server contract (MOBI-CONTRACT, 20 Oct): "Where you stand" (`GET /api/mobi/standing`) and the doubt
/// thread (`POST /api/ai/mentor/chat` with a thread, `/api/mobi/thread`). Every model reads additively: a missing field
/// is absent, an unknown one is ignored, and a number the server did not send is never shown as zero.

/// How much of the four-paper total the student's practice can place.
enum StandingStatus {
  /// Four papers projected (one language and three domain): a band out of 1000, compared with the colleges.
  ready,

  /// One to three papers projected: a band out of `count * 250`, not compared with colleges.
  partial,

  /// No paper has 30 answered or skipped questions yet.
  thin,

  /// No scored practice at all.
  empty;

  static StandingStatus? fromWire(String? s) => switch (s) {
        'ready' => ready,
        'partial' => partial,
        'thin' => thin,
        'empty' => empty,
        _ => null,
      };
}

/// One paper inside the band.
class StandingPaper {
  const StandingPaper({required this.subject, required this.name, this.low, this.mid, this.high, this.open});

  factory StandingPaper.fromJson(Json j) => StandingPaper(
        subject: asStringOr(j['subject'], ''),
        name: asStringOr(j['name'], asStringOr(j['subject'], '')),
        low: asDouble(j['low']),
        mid: asDouble(j['mid']),
        high: asDouble(j['high']),
        open: asDouble(j['open']),
      );

  final String subject;
  final String name;
  final double? low;
  final double? mid;
  final double? high;
  final double? open;
}

/// The projected range: [low] to [high] out of [max], from [count] papers.
class StandingBand {
  const StandingBand({required this.low, required this.high, required this.max, this.mid, this.count = 0, this.complete = false, this.papers = const []});

  static StandingBand? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final low = asDouble(j['low']);
    final high = asDouble(j['high']);
    final max = asDouble(j['max']);
    if (low == null || high == null || max == null || max <= 0 || high < low) return null;
    return StandingBand(
      low: low,
      high: high,
      max: max,
      mid: asDouble(j['mid']),
      count: asInt(j['count']) ?? 0,
      complete: asBool(j['complete']) ?? false,
      papers: [for (final p in asJsonList(j['papers'])) StandingPaper.fromJson(p)],
    );
  }

  final double low;
  final double high;
  final double max;
  final double? mid;
  final int count;
  final bool complete;
  final List<StandingPaper> papers;
}

enum CollegePosition { above, within, below, none }

/// One of the student's colleges, with its 2026 Round 1 closing marks when the server has them.
class StandingCollege {
  const StandingCollege({required this.college, this.programme, this.programmeId, this.cutoff, this.category = 'UR', this.position = CollegePosition.none, this.gap});

  static StandingCollege? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final name = asString(j['college'])?.trim();
    if (name == null || name.isEmpty) return null;
    return StandingCollege(
      college: name,
      programme: _text(j['programme']),
      programmeId: asString(j['programmeId']),
      cutoff: asDouble(j['cutoff']),
      category: _text(j['category']) ?? 'UR',
      position: switch (asString(j['position'])) {
        'above' => CollegePosition.above,
        'within' => CollegePosition.within,
        'below' => CollegePosition.below,
        _ => CollegePosition.none,
      },
      gap: asDouble(j['gap']),
    );
  }

  final String college;
  final String? programme;
  final String? programmeId;

  /// The 2026 Round 1 closing marks, or null when the server has none for this course and category.
  final double? cutoff;
  final String category;
  final CollegePosition position;

  /// `cutoff - band.mid`: positive is marks short. Null when not comparable.
  final double? gap;
}

/// A chapter that closes the gap fastest: [marks] is its share of that paper's open marks.
class CloseChapter {
  const CloseChapter({required this.subject, required this.subjectName, required this.chapter, required this.marks, this.wrong, this.blank, this.href});

  static CloseChapter? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final chapter = _text(j['chapter']);
    final subject = _text(j['subject']);
    final marks = asInt(j['marks']);
    if (chapter == null || subject == null || marks == null || marks <= 0) return null;
    return CloseChapter(
      subject: subject,
      subjectName: _text(j['subjectName']) ?? subject,
      chapter: chapter,
      marks: marks,
      wrong: asInt(j['wrong']),
      blank: asInt(j['blank']),
      href: _text(j['href']),
    );
  }

  final String subject;
  final String subjectName;
  final String chapter;
  final int marks;
  final int? wrong;
  final int? blank;

  /// The server's own practice link for this chapter (`/test?subject=..&mode=quick&count=10&chapter=..`), or null.
  final String? href;
}

/// A subject with practice that is still short of the 30 questions a range needs.
class ThinSubject {
  const ThinSubject({required this.subject, required this.name, required this.needed});

  static ThinSubject? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final subject = _text(j['subject']);
    final needed = asInt(j['needed']);
    if (subject == null || needed == null || needed <= 0) return null;
    return ThinSubject(subject: subject, name: _text(j['name']) ?? subject, needed: needed);
  }

  final String subject;
  final String name;
  final int needed;
}

/// `GET /api/mobi/standing` (200). Worked out from the record with no model call: always free.
class MobiStanding {
  const MobiStanding({
    required this.status,
    this.band,
    this.thin = const [],
    this.colleges = const [],
    this.first,
    this.closeFastest = const [],
    this.note = defaultNote,
    this.needed,
    this.minSample = 30,
    this.practiceLink,
  });

  /// Null when the body is not a standing this app can show.
  static MobiStanding? tryParse(Object? body) {
    if (body is! Map) return null;
    final j = asJson(body);
    if (j['ok'] == false) return null;
    final status = StandingStatus.fromWire(asString(j['status']));
    if (status == null) return null;
    final band = StandingBand.tryParse(j['band']);
    // A ready or partial standing without a band has nothing to show: it reads as thin or empty instead.
    final shown = (status == StandingStatus.ready || status == StandingStatus.partial) && band == null
        ? (asJsonList(j['thin']).isEmpty ? StandingStatus.empty : StandingStatus.thin)
        : status;
    return MobiStanding(
      status: shown,
      band: band,
      thin: [for (final t in asJsonList(j['thin'])) ?ThinSubject.tryParse(t)],
      colleges: [for (final c in asJsonList(j['colleges'])) ?StandingCollege.tryParse(c)],
      first: StandingCollege.tryParse(j['first']),
      closeFastest: [for (final c in asJsonList(j['closeFastest'])) ?CloseChapter.tryParse(c)].take(3).toList(),
      note: _text(j['note']) ?? defaultNote,
      needed: _needed(j['needed']),
      minSample: asInt(j['minSample']) ?? 30,
      practiceLink: _text(asJson(j['links'])['practice']),
    );
  }

  /// The contract's own words, said under every range.
  static const defaultNote = 'From your own practice, before NTA normalisation. Not a prediction.';

  final StandingStatus status;
  final StandingBand? band;
  final List<ThinSubject> thin;
  final List<StandingCollege> colleges;

  /// The first college on My colleges that has a 2026 Round 1 closing mark.
  final StandingCollege? first;
  final List<CloseChapter> closeFastest;
  final String note;

  /// What a partial standing is missing, as the server said it (the names of the papers), or null.
  final List<String>? needed;
  final int minSample;

  /// `/dashboard?mode=chapter&subject=<s>&chapter=<c>`, the template for a chapter's practice.
  final String? practiceLink;

  bool get hasColleges => colleges.isNotEmpty;

  /// The web path that opens chapter practice for [c] (the app maps it to its own setup).
  String practiceHref(CloseChapter c) {
    if (c.href case final h?) return h;
    final s = Uri.encodeQueryComponent(c.subject);
    final ch = Uri.encodeQueryComponent(c.chapter);
    final t = practiceLink;
    if (t != null && t.contains('<s>') && t.contains('<c>')) return t.replaceAll('<s>', s).replaceAll('<c>', ch);
    return '/dashboard?mode=chapter&subject=$s&chapter=$ch';
  }

  static List<String>? _needed(Object? v) {
    if (v is String && v.trim().isNotEmpty) return [v.trim()];
    if (v is List) {
      final out = <String>[
        for (final e in v)
          if (e is String && e.trim().isNotEmpty)
            e.trim()
          else if (e is Map && _text(asJson(e)['name'] ?? asJson(e)['subject']) != null)
            _text(asJson(e)['name'] ?? asJson(e)['subject'])!,
      ];
      return out.isEmpty ? null : out;
    }
    return null;
  }
}

// ---- The doubt thread ------------------------------------------------------------------------

/// A doubt thread: opened by a paid doubt (1 credit), with one free follow-up and 2 real CUET questions to test it.
class ThreadInfo {
  const ThreadInfo({required this.id, this.followUpsLeft = 1, this.followUpsMax = 1, this.subject, this.chapter});

  static ThreadInfo? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final id = _text(j['id']);
    if (id == null) return null;
    final max = asInt(j['followUpsMax']) ?? 1;
    final left = (asInt(j['followUpsLeft']) ?? max).clamp(0, max < 0 ? 0 : max);
    return ThreadInfo(id: id, followUpsLeft: left, followUpsMax: max, subject: _text(j['subject']), chapter: _text(j['chapter']));
  }

  final String id;
  final int followUpsLeft;
  final int followUpsMax;
  final String? subject;
  final String? chapter;
}

/// A check question of a thread (the contract's `CheckQuestion`): the app's own [CheckQuestion] plus the passage a
/// reading question needs. No key and no explanation before the answer.
class ThreadCheck {
  const ThreadCheck({required this.question, this.passage});

  static ThreadCheck? tryParse(Object? v) {
    final q = CheckQuestion.tryParse(v);
    if (q == null) return null;
    return ThreadCheck(question: q, passage: _text(asJson(v)['passage']));
  }

  final CheckQuestion question;
  final String? passage;

  String get id => question.checkQuestionId;
}

/// The server's mark on one check answer: right or not, the key and the pick (positions as shown), the bank's
/// explanation and the finished line. Marked against today's key; the first answer counts.
class CheckMark {
  const CheckMark({required this.right, required this.pick, required this.keyIndex, required this.line, this.keyText, this.pickedText, this.explanation});

  /// The thread's `CheckResult` (`{ right, pick, key: {index, text}, picked: {index, text}, explanation, line }`).
  static CheckMark? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    final right = asBool(j['right']);
    final key = asJson(j['key']);
    final picked = asJson(j['picked']);
    final keyIndex = asInt(key['index']);
    final pick = asInt(j['pick']) ?? asInt(picked['index']);
    if (right == null || keyIndex == null || pick == null) return null;
    return CheckMark(
      right: right,
      pick: pick,
      keyIndex: keyIndex,
      line: _text(j['line']) ?? (right ? 'Right.' : 'Not this time.'),
      keyText: _text(key['text']),
      pickedText: _text(picked['text']),
      explanation: _text(j['explanation']),
    );
  }

  /// The repair check's own result (`/api/recovery/check`).
  factory CheckMark.fromResult(CheckResult r) => CheckMark(
        right: r.right,
        pick: r.pickIndex ?? -1,
        keyIndex: r.keyIndex,
        line: r.line,
        keyText: r.keyText,
        pickedText: r.pickedText,
        explanation: r.explanation,
      );

  final bool right;
  final int pick;
  final int keyIndex;
  final String line;
  final String? keyText;
  final String? pickedText;
  final String? explanation;
}

/// "What should I revise tonight?", answered from the record (free): the chapters, the rules, the traps.
class TonightPlan {
  const TonightPlan({this.chapters = const [], this.rules = const [], this.traps = const [], this.reviseDue, this.line});

  static TonightPlan? tryParse(Object? v) {
    if (v is! Map) return null;
    final j = asJson(v);
    return TonightPlan(
      chapters: [
        for (final c in asJsonList(j['chapters']))
          if (_text(c['chapter']) case final chapter?) (chapter: chapter, subjectName: _text(c['subjectName']) ?? _text(c['subject']) ?? '', lost: asInt(c['lost'])),
      ],
      rules: [for (final r in asStringList(j['rules'])) if (r.trim().isNotEmpty) r.trim()],
      traps: [
        for (final t in asJsonList(j['traps']))
          if (_text(t['phrase']) case final phrase?) (phrase: phrase, caught: asInt(t['caught']), chances: asInt(t['chances'])),
      ],
      reviseDue: asInt(j['reviseDue']),
      line: _text(j['line']),
    );
  }

  final List<({String chapter, String subjectName, int? lost})> chapters;
  final List<String> rules;
  final List<({String phrase, int? caught, int? chances})> traps;
  final int? reviseDue;
  final String? line;
}

String? _text(Object? v) {
  final s = asString(v)?.trim();
  return s == null || s.isEmpty ? null : s;
}
