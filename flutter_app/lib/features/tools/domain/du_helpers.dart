// Presets, ordering and the subject finder of the website's DU tools (`src/lib/du/client.js`,
// `src/lib/du/search.js`, `src/components/du/ComboPlanner.jsx`), kept verbatim.

import 'package:intl/intl.dart';

import 'du_models.dart';

class DuPreset {
  const DuPreset({required this.id, required this.label, required this.hint, required this.languages, required this.domains, this.gat = false});

  final String id;
  final String label;
  final String hint;
  final List<String> languages;
  final List<String> domains;
  final bool gat;

  DuSelection get selection => DuSelection(languages: languages, domains: domains, gat: gat);
}

const List<DuPreset> duPresets = [
  DuPreset(
    id: 'commerce',
    label: 'Commerce',
    hint: 'English, Accountancy, Business Studies, Economics',
    languages: ['english'],
    domains: ['accountancy', 'business_studies', 'economics'],
  ),
  DuPreset(
    id: 'commerce-maths',
    label: 'Commerce + Maths',
    hint: 'Adds Mathematics, which Economics and BMS need',
    languages: ['english'],
    domains: ['accountancy', 'business_studies', 'economics', 'mathematics'],
    gat: true,
  ),
  DuPreset(
    id: 'pcm',
    label: 'Science (PCM)',
    hint: 'Physics, Chemistry, Mathematics',
    languages: ['english'],
    domains: ['physics', 'chemistry', 'mathematics'],
  ),
  DuPreset(
    id: 'pcb',
    label: 'Science (PCB)',
    hint: 'Physics, Chemistry, Biology',
    languages: ['english'],
    domains: ['physics', 'chemistry', 'biology'],
  ),
  DuPreset(
    id: 'humanities',
    label: 'Humanities',
    hint: 'History, Political Science, Economics',
    languages: ['english'],
    domains: ['history', 'political_science', 'economics'],
  ),
];

const List<String> duStreamOrder = ['Commerce & Economics', 'Humanities & Social Sciences', 'Science', 'Vocational', 'Other'];

/// The Combo planner's quick targets, by exact programme name.
const List<String> duQuickTargets = [
  'B.Com. (Hons.)',
  'B.A. (Hons.) Economics',
  'B.A. (Hons.) English',
  'B.A. (Hons.) Political Science',
  'B.A. (Hons.) Psychology',
  'B.A. (Programme)',
];

/// A short stream name for a tag ("Commerce" rather than "Commerce & Economics").
String duStreamShort(String stream) => switch (stream) {
      'Commerce & Economics' => 'Commerce',
      'Humanities & Social Sciences' => 'Humanities',
      _ => stream,
    };

final NumberFormat _score = NumberFormat('#,##0.0', 'en_IN');

final NumberFormat _scoreWhole = NumberFormat('#,##0', 'en_IN');

/// A score out of 1000 with one decimal ("732.2"), and none when it is whole ("720", never
/// "720.0"); a dash when there is none.
String duFormatScore(double? value) {
  if (value == null) return '–';
  final tenths = _score.format(value);
  return tenths.endsWith('.0') ? _scoreWhole.format(value.round()) : tenths;
}

/// Parses a typed score: a number from 0 to 1000, or null.
double? duParseScore(String text) {
  final t = text.trim();
  if (t.isEmpty) return null;
  final n = double.tryParse(t);
  return n != null && n >= 0 && n <= 1000 ? n : null;
}

String _norm(String s) => s.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), ' ').trim();

/// The finder's result: matching subject ids and, for domain subjects, the alias the query
/// matched so the screen can say "IP is counted as Computer Science / Informatics Practices".
class DuSubjectSearch {
  const DuSubjectSearch({this.languages = const [], this.domains = const [], this.hits = const {}});

  final List<String> languages;
  final List<String> domains;
  final Map<String, String> hits;
}

/// Finds CUET subjects from the name a student knows their Class 12 subject by. DU and NTA
/// count papers listed together (Computer Science and Informatics Practices) as ONE subject.
DuSubjectSearch duSearchSubjects(String query, DuCatalog catalog) {
  final q = _norm(query);
  if (q.length < 2) return const DuSubjectSearch();
  String? test(DuSubject entry) {
    for (final name in [...entry.aliases, entry.name]) {
      final n = _norm(name);
      if (n == q || n.startsWith(q) || n.split(' ').any((w) => w.startsWith(q))) return name;
    }
    return null;
  }

  final langs = <String>[];
  final doms = <String>[];
  final hits = <String, String>{};
  for (final l in catalog.languages) {
    if (test(l) != null) langs.add(l.id);
  }
  for (final d in catalog.domains) {
    final hit = test(d);
    if (hit != null) {
      doms.add(d.id);
      hits[d.id] = hit;
    }
  }
  return DuSubjectSearch(languages: langs, domains: doms, hits: hits);
}

/// True when the finder should still show the aptitude test for [query].
bool duFinderShowsGat(String query) {
  final q = query.trim().toLowerCase();
  if (q.length < 2) return true;
  return const ['gat', 'general', 'aptitude', 'test'].any((w) => w.startsWith(q)) || q.startsWith('gen');
}

/// Lower-case letters and digits only, to compare a college's programme with the group name.
String duNormName(String s) => s.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '');
