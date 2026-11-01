// The pure helpers the Cards view and Find share, ported from the website's cardsShared.js (Learn v2 DESIGN-SPEC A2, A5,
// A6). The words are the web's; only the language is Dart. test/unit/learn2/cards/cards_shared_parity_test.dart holds every
// helper to the web's own output (tool/learn2_parity/cards_shared.mjs imports the web module and writes the cases).
//
// Notes on the port: a JS regex split keeps its captured group while Dart's does not, so [CardsShared.hitParts] walks the
// matches; JS `sort` is stable and Dart's is not, so the words are ordered with their position as the tie-break; JS
// `trim` and `\s` are the web's, so both go through one regex here instead of Dart's own `trim`.
library;

import 'dart:convert';

/// One run of text and whether the search matched it.
typedef HitPart = ({String text, bool hit});

abstract final class CardsShared {
  /// One run takes at most this many picked or filtered cards (the server's cap).
  static const int runCardsMax = 100;

  static final RegExp _edges = RegExp(r'^\s+|\s+$');
  static final RegExp _breaks = RegExp(r'\s*\n+\s*');
  static final RegExp _runs = RegExp(r'\s{2,}');
  static final RegExp _special = RegExp(r'[.*+?^${}()|[\]\\]');
  static final RegExp _words = RegExp(r'\s+');

  /// JS `toLowerCase`: the one letter whose lower case is two characters (the dotted capital I) is written out, as the web
  /// reads it; Dart's own mapping has one character for it.
  static String _lower(String s) => s.replaceAll('İ', 'i̇').toLowerCase();

  /// JS `String.prototype.trim`: the web's whitespace, not Dart's (which also takes U+0085).
  static String _trim(String s) => s.replaceAll(_edges, '');

  /// The NCERT line on one line of text: line breaks become spaces.
  static String flat(String? text) => _trim((text ?? '').replaceAll(_breaks, ' ').replaceAll(_runs, ' '));

  static String _escape(String s) => s.replaceAllMapped(_special, (m) => '\\${m[0]}');

  /// The words of a search that count as a match (2 or more characters), longest first (the web's order), without repeats.
  static List<String> hitWords(String? query) {
    final seen = <String>{};
    final words = <String>[];
    for (final w in _lower(query ?? '').split(_words)) {
      if (w.length >= 2 && seen.add(w)) words.add(w);
    }
    final order = [for (var i = 0; i < words.length; i++) (i, words[i])];
    // Stable: the longer word first, ties in the order they came.
    order.sort((a, b) {
      final byLength = b.$2.length.compareTo(a.$2.length);
      return byLength != 0 ? byLength : a.$1.compareTo(b.$1);
    });
    return [for (final e in order) e.$2];
  }

  /// The source of the one pattern the words make: `(first|second)`, or null when no word counts.
  static String? hitSource(String? query) {
    final words = hitWords(query);
    return words.isEmpty ? null : '(${words.map(_escape).join('|')})';
  }

  /// The pattern itself, case-insensitive, or null.
  static RegExp? hitPattern(String? query) {
    final source = hitSource(query);
    return source == null ? null : RegExp(source, caseSensitive: false);
  }

  /// The text in runs, every match of the query marked. Without a query: one run.
  static List<HitPart> hitParts(String? text, String? query) {
    final s = text ?? '';
    final re = hitPattern(query);
    if (re == null || s.isEmpty) return [(text: s, hit: false)];
    final parts = <HitPart>[];
    var at = 0;
    for (final m in re.allMatches(s)) {
      if (m.end == m.start) continue;
      if (m.start > at) parts.add((text: s.substring(at, m.start), hit: false));
      parts.add((text: s.substring(m.start, m.end), hit: true));
      at = m.end;
    }
    if (at < s.length) parts.add((text: s.substring(at), hit: false));
    return parts;
  }

  /// The line around the first match, cut at word edges, with a leading and a trailing ellipsis where it was cut.
  static String snippet(String? text, String? query, {int max = 190}) {
    final s = flat(text);
    if (s.length <= max) return s;
    final re = hitPattern(query);
    final at = re == null ? -1 : (re.firstMatch(s)?.start ?? -1);
    var start = at > 50 ? at - 50 : 0;
    if (start > 0) {
      final sp = s.indexOf(' ', start);
      start = sp > 0 && sp < at ? sp + 1 : start;
    }
    var end = s.length < start + max ? s.length : start + max;
    if (end < s.length) {
      final sp = s.lastIndexOf(' ', end);
      end = sp > start + 40 ? sp : end;
    }
    return '${start > 0 ? '…' : ''}${_trim(s.substring(start, end))}${end < s.length ? '…' : ''}';
  }

  static const Set<String> _small = {'and', 'of', 'the', 'in', 'for'};

  /// "business_studies" as the name a student reads.
  static String subjectLabel(String? id) {
    final parts = [for (final w in (id ?? '').split(RegExp(r'[_-]'))) if (w.isNotEmpty) w];
    return [
      for (final (i, w) in parts.indexed) i > 0 && _small.contains(w) ? w : '${w.substring(0, 1).toUpperCase()}${w.substring(1)}',
    ].join(' ');
  }

  /// "1 card", "50 cards".
  static String countWord(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  // ---- withParams: a link with extra query values, as URLSearchParams writes them ----

  static bool _plainByte(int b) =>
      (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b == 0x2a || b == 0x2d || b == 0x2e || b == 0x5f;

  static String _formEncode(String s) {
    final out = StringBuffer();
    for (final b in utf8.encode(s)) {
      if (b == 0x20) {
        out.write('+');
      } else if (_plainByte(b)) {
        out.writeCharCode(b);
      } else {
        out.write('%${b.toRadixString(16).toUpperCase().padLeft(2, '0')}');
      }
    }
    return out.toString();
  }

  static int _hex(int c) {
    if (c >= 0x30 && c <= 0x39) return c - 0x30;
    if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
    if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
    return -1;
  }

  /// `application/x-www-form-urlencoded` decoding: `+` is a space, a bad `%` sequence stays as it is.
  static String _formDecode(String s) {
    final bytes = <int>[];
    final raw = utf8.encode(s.replaceAll('+', ' '));
    for (var i = 0; i < raw.length; i++) {
      if (raw[i] == 0x25 && i + 2 < raw.length && _hex(raw[i + 1]) >= 0 && _hex(raw[i + 2]) >= 0) {
        bytes.add(_hex(raw[i + 1]) * 16 + _hex(raw[i + 2]));
        i += 2;
      } else {
        bytes.add(raw[i]);
      }
    }
    return utf8.decode(bytes, allowMalformed: true);
  }

  /// A link with extra query values (an empty or missing value is not added; a value already there is replaced in place).
  static String withParams(String href, [Map<String, Object?> extra = const {}]) {
    final pieces = href.split('?');
    final path = pieces.first;
    final query = pieces.length > 1 ? pieces[1] : '';
    final pairs = <MapEntry<String, String>>[];
    for (final part in query.split('&')) {
      if (part.isEmpty) continue;
      final eq = part.indexOf('=');
      pairs.add(eq < 0 ? MapEntry(_formDecode(part), '') : MapEntry(_formDecode(part.substring(0, eq)), _formDecode(part.substring(eq + 1))));
    }
    for (final e in extra.entries) {
      final v = e.value;
      if (v == null || '$v'.isEmpty) continue;
      final first = pairs.indexWhere((p) => p.key == e.key);
      if (first < 0) {
        pairs.add(MapEntry(e.key, '$v'));
      } else {
        final kept = MapEntry(e.key, '$v');
        pairs[first] = kept;
        pairs.removeWhere((p) => p.key == e.key && !identical(p, kept));
      }
    }
    final q = pairs.map((p) => '${_formEncode(p.key)}=${_formEncode(p.value)}').join('&');
    return q.isEmpty ? path : '$path?$q';
  }
}
