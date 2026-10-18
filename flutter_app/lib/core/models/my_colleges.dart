import 'json_helpers.dart';

/// A college's closing marks in last year's DU CSAS Round 1 for the student's course and category
/// (out of 1000), or null when the published list has no number for it. Never estimated.
typedef ClosingMarks = num? Function(MyCollege college);

/// One college in one programme on the student's list ("My colleges"). `programmeId` is the DU
/// catalogue id (`b-com-hons`), `college` is the name as the offerings file spells it, and
/// `programme` is the name to show ("B.Com. (Hons.)", possibly empty).
class MyCollege {
  const MyCollege({required this.programmeId, required this.college, this.programme = '', this.position = 0, this.addedAt});

  final String programmeId;
  final String college;
  final String programme;

  /// 1-based place on the list, as the server numbers it. 0 on an entry not yet sent.
  final int position;
  final DateTime? addedAt;

  /// The same college in the same programme, as one string (the web's `entryKey`).
  String get key => '$programmeId::$college';

  /// What a POST sends and a PUT lists: no position, no date.
  Json toEntry() => {'programmeId': programmeId, 'programme': programme, 'college': college};

  /// A college is named by its programme and its name; the place and the date do not count.
  bool sameAs(MyCollege other) => other.key == key;

  /// Null for an entry without a programme id or a college name.
  static MyCollege? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final id = asString(raw['programmeId'])?.trim() ?? '';
    final college = (asString(raw['college']) ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
    if (id.isEmpty || college.length < 2) return null;
    return MyCollege(
      programmeId: id,
      college: college,
      programme: (asString(raw['programme']) ?? '').replaceAll(RegExp(r'\s+'), ' ').trim(),
      position: asInt(raw['position']) ?? 0,
      addedAt: asDate(raw['addedAt']),
    );
  }

  Json toJson() => {
        'position': position,
        'programmeId': programmeId,
        'programme': programme,
        'college': college,
        'addedAt': addedAt?.toUtc().toIso8601String(),
      };

  @override
  bool operator ==(Object other) => other is MyCollege && other.key == key && other.programme == programme && other.position == position;

  @override
  int get hashCode => Object.hash(key, programme, position);
}

/// The student's one ordered list of colleges, up to [maxColleges], saved to your account and shared
/// by Today (the first [ladderSize]), Compass and You. The contract is
/// `GET/PUT/POST/DELETE /api/me/colleges` (test/fixtures/colleges/contract_colleges_v1.json).
class MyColleges {
  const MyColleges({this.colleges = const [], this.max = maxColleges});

  static const int maxColleges = 8;

  /// Today shows this many, and says how many more there are.
  static const int ladderSize = 3;

  static const MyColleges empty = MyColleges();

  final List<MyCollege> colleges;
  final int max;

  int get count => colleges.length;
  bool get isEmpty => colleges.isEmpty;
  bool get isFull => colleges.length >= max;

  /// The first [ladderSize] colleges, in the student's order.
  List<MyCollege> get ladder => colleges.take(ladderSize).toList();

  /// How many colleges are past the ladder.
  int get more => colleges.length > ladderSize ? colleges.length - ladderSize : 0;

  /// The same colleges ordered by last year's closing marks, highest first, so the hardest to
  /// reach leads (owner, 19 Oct, D103). [closing] gives a college's Round 1 closing marks for the
  /// student's course and category (out of 1000), or null when there is no number for it: those
  /// go last, and ties keep the student's order. Positions are numbered again from 1; [ladder] and
  /// [more] on the result are then "your top 3 of N" (D104).
  MyColleges byClosing(ClosingMarks closing) {
    final rows = [for (final (i, c) in colleges.indexed) (i, c, closing(c))];
    rows.sort((a, b) {
      final x = a.$3, y = b.$3;
      if (x == null || y == null) return x == y ? a.$1.compareTo(b.$1) : (x == null ? 1 : -1);
      final byMarks = y.compareTo(x);
      return byMarks != 0 ? byMarks : a.$1.compareTo(b.$1);
    });
    return MyColleges(colleges: _numbered([for (final r in rows) r.$2]), max: max);
  }

  /// The [ladderSize] colleges that need the highest marks by [closing] (Today's "top 3").
  List<MyCollege> ladderBy(ClosingMarks closing) => byClosing(closing).ladder;

  bool contains(MyCollege entry) => colleges.any(entry.sameAs);

  /// A list from the body every route answers with. Entries that cannot be read are left out;
  /// a body with no list at all throws, so a page that is not the API's never becomes "no colleges".
  factory MyColleges.fromJson(Object? json) {
    if (json is! Map || json['colleges'] is! List) throw const FormatException('my colleges: no list');
    final rows = <MyCollege>[];
    for (final raw in json['colleges'] as List) {
      final c = MyCollege.tryParse(raw);
      if (c != null) rows.add(c);
    }
    final cap = asInt(json['max']);
    return MyColleges(colleges: _numbered(rows), max: cap != null && cap > 0 ? cap : maxColleges);
  }

  /// The body as the server sends it (also what the phone keeps for offline).
  Json toJson() => {'colleges': [for (final c in colleges) c.toJson()], 'count': count, 'max': max};

  /// The list a student sees at once, before the server confirms: [entry] at the end (nothing
  /// changes when it is there already or the list is full).
  MyColleges withAdded(MyCollege entry) {
    if (contains(entry) || isFull) return this;
    return MyColleges(colleges: _numbered([...colleges, entry]), max: max);
  }

  MyColleges withRemoved(MyCollege entry) => MyColleges(colleges: _numbered([for (final c in colleges) if (!c.sameAs(entry)) c]), max: max);

  /// The college at [from] moved to [to]. This list again when either place is off the list.
  MyColleges withMoved(int from, int to) {
    if (from == to || from < 0 || to < 0 || from >= count || to >= count) return this;
    final next = [...colleges];
    next.insert(to, next.removeAt(from));
    return MyColleges(colleges: _numbered(next), max: max);
  }

  static List<MyCollege> _numbered(List<MyCollege> rows) => [
        for (final (i, c) in rows.indexed)
          MyCollege(programmeId: c.programmeId, college: c.college, programme: c.programme, position: i + 1, addedAt: c.addedAt),
      ];

  /// The body a PUT sends: the whole list, in order.
  Json toPutBody() => {'colleges': [for (final c in colleges) c.toEntry()]};

  @override
  bool operator ==(Object other) => other is MyColleges && other.max == max && _same(other.colleges, colleges);

  @override
  int get hashCode => Object.hash(max, Object.hashAll(colleges));

  static bool _same(List<MyCollege> a, List<MyCollege> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
