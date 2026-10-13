// The University of Delhi CSAS UG 2026 data the website publishes under `/du/2026`: the
// catalogue (`index.json`: subjects, programme groups and their Bulletin eligibility rules) and
// one offerings file per programme (college by college minimum allocation scores). Plain,
// immutable and isolate-safe so the combination planner can run off the UI thread.

/// A decoded JSON object.
typedef DuJson = Map<String, dynamic>;

double? _num(Object? v) => v is num ? v.toDouble() : null;
int _int(Object? v) => v is num ? v.toInt() : 0;
String _str(Object? v) => v is String ? v : '';
List<String> _strings(Object? v) => v is List ? [for (final e in v) if (e is String) e] : const [];
List<DuJson> _maps(Object? v) => v is List ? [for (final e in v) if (e is Map) e.cast<String, dynamic>()] : const [];

/// One CUET subject in List A (languages) or List B (domain subjects).
class DuSubject {
  const DuSubject({required this.id, required this.name, this.aliases = const []});

  factory DuSubject.fromJson(DuJson j) =>
      DuSubject(id: _str(j['id']), name: _str(j['name']), aliases: _strings(j['aliases']));

  final String id;
  final String name;

  /// Names students know the subject by ("Accounts", "IP").
  final List<String> aliases;

  /// The name a student recognises first ("Accountancy" rather than "Accountancy / Book Keeping").
  String get shortName => aliases.isNotEmpty ? aliases.first : name;
}

enum DuSlotType { lang, domain, free, gat }

/// A typed slot of a Bulletin combination (see `lib/du/eligibility.js` on the website).
class DuSlot {
  const DuSlot({required this.type, this.any = 0, this.specific = const [], this.subject, this.count = 0});

  factory DuSlot.fromJson(DuJson j) => DuSlot(
        type: switch (j['type']) {
          'lang' => DuSlotType.lang,
          'domain' => DuSlotType.domain,
          'gat' => DuSlotType.gat,
          _ => DuSlotType.free,
        },
        any: _int(j['any']),
        specific: _strings(j['specific']),
        subject: j['subject'] is String ? j['subject'] as String : null,
        count: _int(j['count']),
      );

  final DuSlotType type;
  final int any;
  final List<String> specific;
  final String? subject;
  final int count;
}

class DuCombination {
  const DuCombination({required this.label, required this.text, required this.slots});

  factory DuCombination.fromJson(DuJson j) => DuCombination(
        label: _str(j['label']),
        text: _str(j['text']),
        slots: [for (final s in _maps(j['slots'])) DuSlot.fromJson(s)],
      );

  final String label;
  final String text;
  final List<DuSlot> slots;
}

class DuEligibility {
  const DuEligibility({
    required this.combinations,
    this.notes = const [],
    this.requiresLanguage = false,
    this.performanceTest = false,
  });

  factory DuEligibility.fromJson(DuJson j) => DuEligibility(
        combinations: [for (final c in _maps(j['combinations'])) DuCombination.fromJson(c)],
        notes: _strings(j['notes']),
        requiresLanguage: j['requiresLanguage'] == true,
        performanceTest: j['performanceTest'] == true,
      );

  final List<DuCombination> combinations;
  final List<String> notes;
  final bool requiresLanguage;
  final bool performanceTest;
}

/// The cutoff range of one round for one category: `[catMin, catMax, effMin, effMax]` on the
/// website, where the effective values already take the lower of the UR and category cutoffs.
class DuRange {
  const DuRange(this.low, this.high);

  final double? low;
  final double? high;
}

/// A DU programme group ("B.Com. (Hons.)") with its eligibility and a cutoff summary.
class DuGroup {
  const DuGroup({
    required this.id,
    required this.name,
    required this.stream,
    required this.family,
    required this.colleges,
    required this.offerings,
    required this.eligibility,
    this.summary = const {},
  });

  factory DuGroup.fromJson(DuJson j) {
    final summary = <String, Map<String, DuRange>>{};
    final raw = j['summary'];
    if (raw is Map) {
      raw.forEach((round, byCat) {
        if (round is! String || byCat is! Map) return;
        final out = <String, DuRange>{};
        byCat.forEach((cat, v) {
          if (cat is String && v is List && v.length >= 4) out[cat] = DuRange(_num(v[2]), _num(v[3]));
        });
        summary[round] = out;
      });
    }
    return DuGroup(
      id: _str(j['id']),
      name: _str(j['name']),
      stream: _str(j['stream']),
      family: _str(j['family']),
      colleges: _int(j['colleges']),
      offerings: _int(j['offerings']),
      eligibility: DuEligibility.fromJson((j['eligibility'] as Map?)?.cast<String, dynamic>() ?? const {}),
      summary: summary,
    );
  }

  final String id;
  final String name;
  final String stream;
  final String family;
  final int colleges;
  final int offerings;
  final DuEligibility eligibility;

  /// round id ("round-1") to category to the effective cutoff range of that round.
  final Map<String, Map<String, DuRange>> summary;

  bool get hasCutoffs => offerings > 0;

  /// The Round I range for [category], falling back to UR as the website does.
  DuRange? roundOne(String category) => summary['round-1']?[category] ?? summary['round-1']?['UR'];
}

/// One official DU document the data was taken from.
class DuDocument {
  const DuDocument({required this.id, required this.title, required this.url, required this.use});

  factory DuDocument.fromJson(DuJson j) =>
      DuDocument(id: _str(j['id']), title: _str(j['title']), url: _str(j['url']), use: _str(j['use']));

  final String id;
  final String title;
  final String url;
  final String use;
}

class DuMeta {
  const DuMeta({
    required this.cycle,
    required this.categories,
    required this.rounds,
    this.scoreMax,
    this.offerings = 0,
    this.colleges = 0,
    this.sources = const [],
  });

  factory DuMeta.fromJson(DuJson j) {
    final range = j['scoreRange'];
    return DuMeta(
      cycle: _str(j['cycle']),
      categories: _strings(j['categories']),
      rounds: _strings(j['rounds']),
      scoreMax: range is List && range.length > 1 ? _num(range[1]) : null,
      offerings: _int(j['offerings']),
      colleges: _int(j['colleges']),
      sources: [for (final s in _maps(j['sources'])) DuDocument.fromJson(s)],
    );
  }

  final String cycle;

  /// The 11 category codes in the order the offerings rows use.
  final List<String> categories;
  final List<String> rounds;

  /// The highest minimum allocation score in the 2026 lists.
  final double? scoreMax;
  final int offerings;
  final int colleges;
  final List<DuDocument> sources;
}

/// The whole `index.json`.
class DuCatalog {
  DuCatalog({required this.meta, required this.languages, required this.domains, required this.groups});

  factory DuCatalog.fromJson(DuJson j) => DuCatalog(
        meta: DuMeta.fromJson((j['meta'] as Map?)?.cast<String, dynamic>() ?? const {}),
        languages: [for (final s in _maps(j['languages'])) DuSubject.fromJson(s)],
        domains: [for (final s in _maps(j['domains'])) DuSubject.fromJson(s)],
        groups: [for (final g in _maps(j['groups'])) DuGroup.fromJson(g)],
      );

  final DuMeta meta;
  final List<DuSubject> languages;
  final List<DuSubject> domains;
  final List<DuGroup> groups;

  late final Map<String, DuGroup> _byId = {for (final g in groups) g.id: g};
  late final Map<String, DuSubject> _languages = {for (final s in languages) s.id: s};
  late final Map<String, DuSubject> _domains = {for (final s in domains) s.id: s};

  DuGroup? group(String id) => _byId[id];
  DuSubject? language(String id) => _languages[id];
  DuSubject? domain(String id) => _domains[id];
  bool isLanguage(String id) => _languages.containsKey(id);
  bool isDomain(String id) => _domains.containsKey(id);

  int categoryIndex(String category) {
    final i = meta.categories.indexOf(category);
    return i < 0 ? 0 : i;
  }
}

/// A row of an offerings file: a college's minimum allocation scores for Rounds I to III, each
/// a list indexed by [DuMeta.categories] (null where no seat was allocated).
class DuSeat {
  const DuSeat({required this.college, required this.programme, required this.rounds});

  factory DuSeat.fromJson(List<dynamic> row) {
    List<double?>? round(int i) {
      if (row.length <= i || row[i] is! List) return null;
      return [for (final v in row[i] as List) _num(v)];
    }

    return DuSeat(
      college: row.isNotEmpty ? _str(row[0]) : '',
      programme: row.length > 1 ? _str(row[1]) : '',
      rounds: [round(2), round(3), round(4)],
    );
  }

  final String college;
  final String programme;

  /// Exactly three entries (Rounds I, II, III); an entry is null when the round had no list.
  final List<List<double?>?> rounds;
}

class DuOfferings {
  const DuOfferings({required this.id, required this.seats});

  factory DuOfferings.fromJson(DuJson j) => DuOfferings(
        id: _str(j['id']),
        seats: [
          for (final r in (j['rows'] is List ? j['rows'] as List : const []))
            if (r is List) DuSeat.fromJson(r),
        ],
      );

  final String id;
  final List<DuSeat> seats;
}

/// The subjects a student will take: List A languages, List B domain subjects and the General
/// Aptitude Test.
class DuSelection {
  const DuSelection({this.languages = const [], this.domains = const [], this.gat = false});

  static const empty = DuSelection();

  final List<String> languages;
  final List<String> domains;
  final bool gat;

  int get count => languages.length + domains.length + (gat ? 1 : 0);
  bool get isEmpty => count == 0;

  bool has(DuPick pick) => switch (pick.kind) {
        DuPickKind.language => languages.contains(pick.id),
        DuPickKind.domain => domains.contains(pick.id),
        DuPickKind.gat => gat,
      };

  DuSelection toggle(DuPick pick) => switch (pick.kind) {
        DuPickKind.gat => DuSelection(languages: languages, domains: domains, gat: !gat),
        DuPickKind.language => DuSelection(
            languages: languages.contains(pick.id) ? [...languages.where((x) => x != pick.id)] : [...languages, pick.id],
            domains: domains,
            gat: gat,
          ),
        DuPickKind.domain => DuSelection(
            languages: languages,
            domains: domains.contains(pick.id) ? [...domains.where((x) => x != pick.id)] : [...domains, pick.id],
            gat: gat,
          ),
      };

  List<DuPick> get picks => [
        for (final l in languages) DuPick.language(l),
        for (final d in domains) DuPick.domain(d),
        if (gat) const DuPick.gat(),
      ];

  /// The website's `?s=` value: ids joined by commas, `gat` last.
  String encode() => [...languages, ...domains, if (gat) 'gat'].join(',');

  /// Reads [value] (comma-separated ids, website or profile form) against [catalog], ignoring
  /// unknown ids. The profile's `general_test` is the aptitude test.
  static DuSelection decode(String? value, DuCatalog catalog) => fromIds((value ?? '').split(','), catalog);

  static DuSelection fromIds(Iterable<String> ids, DuCatalog catalog) {
    final langs = <String>[];
    final doms = <String>[];
    var gat = false;
    for (final raw in ids) {
      final id = raw.trim().toLowerCase();
      if (id == 'gat' || id == 'general_test') {
        gat = true;
      } else if (catalog.isLanguage(id) && !langs.contains(id)) {
        langs.add(id);
      } else if (catalog.isDomain(id) && !doms.contains(id)) {
        doms.add(id);
      }
    }
    return DuSelection(languages: langs, domains: doms, gat: gat);
  }

  @override
  bool operator ==(Object other) => other is DuSelection && other.encode() == encode();

  @override
  int get hashCode => encode().hashCode;
}

enum DuPickKind { language, domain, gat }

/// One subject as a choice: a language, a domain subject or the aptitude test.
class DuPick {
  const DuPick(this.kind, this.id);
  const DuPick.language(this.id) : kind = DuPickKind.language;
  const DuPick.domain(this.id) : kind = DuPickKind.domain;
  const DuPick.gat()
      : kind = DuPickKind.gat,
        id = 'gat';

  final DuPickKind kind;
  final String id;

  String get key => '${kind.name}:$id';

  /// Stored form: `language:english`.
  static DuPick? parse(String key) {
    final i = key.indexOf(':');
    if (i <= 0) return null;
    final id = key.substring(i + 1);
    return switch (key.substring(0, i)) {
      'language' => DuPick.language(id),
      'domain' => DuPick.domain(id),
      'gat' => const DuPick.gat(),
      _ => null,
    };
  }

  String name(DuCatalog catalog, {bool short = false}) => switch (kind) {
        DuPickKind.gat => 'General Aptitude Test',
        DuPickKind.language => catalog.language(id)?.name ?? id,
        DuPickKind.domain => short ? (catalog.domain(id)?.shortName ?? id) : (catalog.domain(id)?.name ?? id),
      };

  @override
  bool operator ==(Object other) => other is DuPick && other.kind == kind && other.id == id;

  @override
  int get hashCode => Object.hash(kind, id);
}
