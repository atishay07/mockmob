// What `GET /api/compass/pro` returns: a practice projection from the student's own
// server-scored sessions. Every paper is out of 250 (50 questions, +5 and -1) with a Wilson
// range; the server decides who may read it (`locked: true` for accounts without access).

/// One CUET paper's projection, or a paper that needs more practice before it is projected.
class ProPaper {
  const ProPaper({
    required this.subject,
    required this.name,
    required this.n,
    required this.ready,
    this.language = false,
    this.needed = 0,
    this.attemptSharePct = 0,
    this.accuracyPct = 0,
    this.low = 0,
    this.mid = 0,
    this.high = 0,
    this.open = 0,
  });

  factory ProPaper.fromJson(Map<String, dynamic> j) {
    final accuracy = j['accuracy'];
    return ProPaper(
      subject: _str(j['subject']),
      name: _str(j['name']),
      n: _int(j['n']),
      ready: j['status'] == 'ready',
      language: j['language'] == true,
      needed: _int(j['needed']),
      attemptSharePct: _int(j['attemptShare']),
      accuracyPct: accuracy is Map ? _int(accuracy['pct']) : 0,
      low: _int(j['low']),
      mid: _int(j['mid']),
      high: _int(j['high']),
      open: _int(j['open']),
    );
  }

  final String subject;
  final String name;

  /// Practice questions on record in this subject.
  final int n;

  /// False: `needed` more questions before this paper is projected.
  final bool ready;
  final bool language;
  final int needed;
  final int attemptSharePct;
  final int accuracyPct;
  final int low;
  final int mid;
  final int high;

  /// Marks still open (paper maximum minus the projected middle).
  final int open;
}

/// The four-paper total in the shape most DU programmes use: one language and three domain
/// papers. `complete` is false when fewer than four papers have enough practice.
class ProTotal {
  const ProTotal({required this.count, required this.complete, required this.max, required this.low, required this.mid, required this.high});

  factory ProTotal.fromJson(Map<String, dynamic> j) => ProTotal(
        count: _int(j['count']),
        complete: j['complete'] == true,
        max: _int(j['max']),
        low: _int(j['low']),
        mid: _int(j['mid']),
        high: _int(j['high']),
      );

  final int count;
  final bool complete;
  final int max;
  final int low;
  final int mid;
  final int high;
}

/// The one paper to work on, with its weakest chapter when the record names one.
class ProNext {
  const ProNext({required this.subject, required this.name, required this.open, this.chapter, this.wrong = 0, this.blank = 0, this.chapterN = 0});

  factory ProNext.fromJson(Map<String, dynamic> j) {
    final c = j['chapter'];
    return ProNext(
      subject: _str(j['subject']),
      name: _str(j['name']),
      open: _int(j['open']),
      chapter: c is Map ? _str(c['name']) : null,
      wrong: c is Map ? _int(c['wrong']) : 0,
      blank: c is Map ? _int(c['skip']) : 0,
      chapterN: c is Map ? _int(c['n']) : 0,
    );
  }

  /// The public subject id (the practice setup takes it as is).
  final String subject;
  final String name;
  final int open;
  final String? chapter;
  final int wrong;
  final int blank;
  final int chapterN;
}

class CompassPro {
  const CompassPro({this.locked = false, this.papers = const [], this.total, this.next, this.minSample = 30, this.paperMax = 250});

  static const CompassPro lockedOut = CompassPro(locked: true);

  /// Reads the response body. Anything that is not an `ok` answer throws, so the repository
  /// reports an unusable response instead of showing a half-read projection.
  factory CompassPro.fromJson(Object? json) {
    if (json is! Map || json['ok'] != true) throw const FormatException('compass pro');
    if (json['locked'] == true) return lockedOut;
    final p = json['projection'];
    if (p is! Map) throw const FormatException('compass pro projection');
    final papers = p['papers'];
    final total = p['total'];
    final next = p['next'];
    return CompassPro(
      papers: [
        if (papers is List)
          for (final e in papers)
            if (e is Map) ProPaper.fromJson(e.cast<String, dynamic>()),
      ],
      total: total is Map ? ProTotal.fromJson(total.cast<String, dynamic>()) : null,
      next: next is Map ? ProNext.fromJson(next.cast<String, dynamic>()) : null,
      minSample: p['minSample'] is num ? (p['minSample'] as num).toInt() : 30,
      paperMax: p['paperMax'] is num ? (p['paperMax'] as num).toInt() : 250,
    );
  }

  /// The server says this account has no access: the screen shows nothing at all.
  final bool locked;
  final List<ProPaper> papers;
  final ProTotal? total;
  final ProNext? next;
  final int minSample;
  final int paperMax;

  bool get hasReadyPaper => papers.any((p) => p.ready);
}

/// Where a projected range sits against one published cutoff (the website's `compareToCutoff`).
enum ProPosition { above, within, below, none }

({ProPosition position, double by}) proCompare(ProTotal band, double? cutoff) {
  if (cutoff == null) return (position: ProPosition.none, by: 0);
  double round1(double v) => (v * 10).round() / 10;
  if (band.low >= cutoff) return (position: ProPosition.above, by: round1(band.low - cutoff));
  if (band.high < cutoff) return (position: ProPosition.below, by: round1(cutoff - band.high));
  return (position: ProPosition.within, by: 0);
}

int _int(Object? v) => v is num ? v.round() : 0;
String _str(Object? v) => v is String ? v : '';
