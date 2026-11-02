/// Science notation on the study stage (the web's `src/components/learn2/stage/sciText.mjs`; R4-SPEC R4-run, "Science notation").
/// Pure, so unit tests hold it against the web's own module. [SciText.parse] splits a card's words into segments of plain,
/// subscript and superscript text; the stage draws them (`stage_sci.dart`) for a chemistry card's front, back and quote. Display
/// only: the stored text never changes.
///
///   1. A common ion sets its charge from a table: SO42− becomes SO₄²⁻, NH4+ becomes NH₄⁺, Cu2+ becomes Cu²⁺, Cl− becomes Cl⁻.
///   2. Otherwise a formula token (starts uppercase or with a bracket, made only of element symbols, digits and brackets, with at
///      least one digit) takes a digit after an element symbol or ")" as a subscript: CH3OH, (CH3)2NH, PbO2, H2SO4, C6H5OH.
///      A leading coefficient stays plain (2H2O becomes 2H₂O).
///   3. "[X]0" gets a subscript 0 ([A]0 becomes [A]₀), and "t1/2" becomes t₁/₂.
///   4. A complex ion's charge after its bracket is a superscript: [Co(NH3)6]3+ becomes [Co(NH₃)₆]³⁺, [PtCl4]2– becomes [PtCl₄]²⁻.
///   5. An electron count after an orbital is a superscript: 3d8 becomes 3d⁸, 4s2 becomes 4s², d4 becomes d⁴ (s and p only with
///      their shell).
///   NCERT often prints a minus as an en dash (NO2–); it reads as a charge sign wherever a minus or a word-final hyphen does.
/// Plain numbers are never touched ("Table 2.4", "Unit 4", "p. 52", "step 1", "373 K"), nor reaction names (SN1, SN2, E1, E2) or
/// vitamins (B12).
library;

import 'package:flutter/foundation.dart' show immutable;

import '../../keycards/data/keycards_models.dart';

/// What a segment of a card's words is.
enum SciKind { plain, sub, sup }

/// One run of a card's words: [text] drawn as [kind].
@immutable
class SciSegment {
  const SciSegment(this.kind, this.text);

  final SciKind kind;
  final String text;

  @override
  bool operator ==(Object other) => other is SciSegment && other.kind == kind && other.text == text;

  @override
  int get hashCode => Object.hash(kind, text);

  @override
  String toString() => '${kind.name}:$text';
}

abstract final class SciText {
  static final Set<String> _elements = (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr '
    'Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi '
    'Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'
  ).split(' ').toSet();

  /// The common ions: formula and charge. Typed together ("SO42−", "NH4+", "Cu2+"), the charge is the end of the token.
  static const List<(String, String)> _ions = [
    ('NH4', '+'), ('H3O', '+'), ('H', '+'), ('Li', '+'), ('Na', '+'), ('K', '+'), ('Ag', '+'), ('Cu', '+'), ('Cu', '2+'), ('Fe', '2+'),
    ('Fe', '3+'), ('Zn', '2+'), ('Ca', '2+'), ('Mg', '2+'), ('Ba', '2+'), ('Pb', '2+'), ('Hg', '2+'), ('Ni', '2+'), ('Co', '2+'),
    ('Mn', '2+'), ('Sn', '2+'), ('Sn', '4+'), ('Cr', '3+'), ('Al', '3+'),
    ('OH', '−'), ('NO3', '−'), ('NO2', '−'), ('HCO3', '−'), ('HSO4', '−'), ('MnO4', '−'), ('CN', '−'), ('Cl', '−'), ('Br', '−'),
    ('I', '−'), ('F', '−'), ('SCN', '−'), ('SO4', '2−'), ('SO3', '2−'), ('CO3', '2−'), ('CrO4', '2−'), ('Cr2O7', '2−'), ('PO4', '3−'), ('O', '2−'),
    ('S', '2−'),
  ];

  static final Map<String, (String, String)> _ion = {for (final (formula, charge) in _ions) '$formula$charge': (formula, charge)};

  /// Reaction names and vitamins, never formulas.
  static final RegExp _stop = RegExp(r'^(?:SN[12]|E[12]|B(?:1|2|3|6|7|9|12))$');

  static const Map<String, String> _sign = {'+': '+', '−': '−', '-': '−', '–': '−'};

  /// t1/2 | [X]0 | a token with an optional leading coefficient and an optional charge sign (a hyphen or an en dash only at a
  /// word's end) | a charge right after "]" | an electron count after an orbital (groups 6 to 9).
  static final RegExp _master = RegExp(
    r'(?<![A-Za-z0-9])t1\/2(?![0-9A-Za-z])'
    r'|\[([^\]\s]{1,16})\]0(?![0-9])'
    r'|(?<![A-Za-z0-9])(\d*)([A-Z(][A-Za-z0-9()]*)([+−]|[-–](?![A-Za-z0-9]))?'
    r'|(?<=\])(\d{0,2}(?:[+−]|[-–](?![A-Za-z0-9])))'
    r'|(?<![A-Za-z0-9])(?:([1-7])([spdf])|([df]))(\d{1,2})(?![A-Za-z0-9])',
  );

  static final RegExp _digit = RegExp(r'\d');
  static final RegExp _upperOrOpen = RegExp(r'^[A-Z(]');
  static final RegExp _upper = RegExp(r'[A-Z]');
  static final RegExp _twoLetters = RegExp(r'^[A-Z][a-z]$');
  static final RegExp _oneElementIon = RegExp(r'^([A-Z][a-z]?)(\d{1,2})$');

  /// The element, digit and bracket reading of a token, or null when it is not a formula.
  static List<SciSegment>? _formulaParts(String body) {
    if (body.isEmpty || _stop.hasMatch(body) || !_digit.hasMatch(body) || !_upperOrOpen.hasMatch(body)) return null;
    final out = <SciSegment>[];
    var depth = 0;
    var afterAtom = false; // a digit here is a subscript (after an element or ")")
    var elements = 0;
    var i = 0;
    while (i < body.length) {
      final c = body[i];
      if (c == '(') {
        depth += 1;
        out.add(SciSegment(SciKind.plain, c));
        afterAtom = false;
        i += 1;
        continue;
      }
      if (c == ')') {
        if (depth == 0) return null;
        depth -= 1;
        out.add(SciSegment(SciKind.plain, c));
        afterAtom = true;
        i += 1;
        continue;
      }
      if (_digit.hasMatch(c)) {
        if (!afterAtom) return null;
        var j = i;
        while (j < body.length && _digit.hasMatch(body[j])) {
          j += 1;
        }
        out.add(SciSegment(SciKind.sub, body.substring(i, j)));
        afterAtom = false;
        i = j;
        continue;
      }
      if (_upper.hasMatch(c)) {
        final two = i + 2 <= body.length ? body.substring(i, i + 2) : '';
        final sym = _twoLetters.hasMatch(two) && _elements.contains(two) ? two : (_elements.contains(c) ? c : null);
        if (sym == null) return null;
        out.add(SciSegment(SciKind.plain, sym));
        elements += 1;
        afterAtom = true;
        i += sym.length;
        continue;
      }
      return null;
    }
    return depth == 0 && elements > 0 ? out : null;
  }

  static List<SciSegment> _formulaOrPlain(String body) => _formulaParts(body) ?? [SciSegment(SciKind.plain, body)];

  /// The segments of [text]: plain, subscript and superscript runs, adjacent ones of one kind merged. Joining every
  /// segment's text gives back the input, except that a hyphen used as a charge sign is drawn as a minus sign.
  static List<SciSegment> parse(String? text) {
    final s = text ?? '';
    final out = <SciSegment>[];
    void push(SciKind kind, String t) {
      if (t.isEmpty) return;
      if (out.isNotEmpty && out.last.kind == kind) {
        out[out.length - 1] = SciSegment(kind, out.last.text + t);
      } else {
        out.add(SciSegment(kind, t));
      }
    }

    var at = 0;
    for (final m in _master.allMatches(s)) {
      final whole = m[0]!;
      if (whole.isEmpty) continue;
      push(SciKind.plain, s.substring(at, m.start));
      at = m.end;
      if (whole.startsWith('t1/2')) {
        push(SciKind.plain, 't');
        push(SciKind.sub, '1');
        push(SciKind.plain, '/');
        push(SciKind.sub, '2');
        continue;
      }
      if (m[5] != null) {
        push(SciKind.sup, m[5]!.replaceAll(RegExp(r'[-–]'), '−'));
        continue;
      }
      if (m[9] != null) {
        push(SciKind.plain, '${m[6] ?? ''}${m[7] ?? m[8]}');
        push(SciKind.sup, m[9]!);
        continue;
      }
      if (m[1] != null) {
        push(SciKind.plain, '[');
        for (final p in _formulaOrPlain(m[1]!)) {
          push(p.kind, p.text);
        }
        push(SciKind.plain, ']');
        push(SciKind.sub, '0');
        continue;
      }
      final coef = m[2] ?? '';
      final token = m[3]!;
      final sign = m[4];
      // "(Cr2+, Mn3+)": an opening bracket that belongs to the sentence, not to a formula, stays plain before the token.
      final lead = token.length > 1 && token.startsWith('(') && _formulaParts(token) == null ? '(' : '';
      final body = lead.isNotEmpty ? token.substring(1) : token;
      if (sign != null) {
        final ion = _ion['$body${_sign[sign]}'];
        final wordSign = sign == '-' || sign == '–';
        // A hyphen or en dash reads as a charge only for a two-character ion or longer ("Cl-", "SO42–"), never "I-" or "F-".
        if (ion != null && (!wordSign || body.length >= 2)) {
          push(SciKind.plain, coef + lead);
          for (final p in _formulaOrPlain(ion.$1)) {
            push(p.kind, p.text);
          }
          push(SciKind.sup, ion.$2);
          continue;
        }
        // One element, a number and a sign is a monatomic ion: Mn3+ becomes Mn³⁺ (never Mn₃+).
        final one = _oneElementIon.firstMatch(body);
        if (one != null && _elements.contains(one[1])) {
          push(SciKind.plain, coef + lead + one[1]!);
          push(SciKind.sup, '${one[2]}${_sign[sign]}');
          continue;
        }
      }
      final parts = _formulaParts(body);
      if (parts == null) {
        push(SciKind.plain, whole);
        continue;
      }
      push(SciKind.plain, coef + lead);
      for (final p in parts) {
        push(p.kind, p.text);
      }
      if (sign != null) push(SciKind.plain, sign);
    }
    push(SciKind.plain, s.substring(at));
    return out;
  }

  /// True when some segment is a subscript or a superscript (the stage then draws segments, else the plain string).
  static bool hasSci(List<SciSegment> segments) => segments.any((p) => p.kind != SciKind.plain);

  static const Map<String, String> _subs = {'0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'};
  static const Map<String, String> _sups = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '−': '⁻',
  };

  /// The segments as one Unicode string ("SO₄²⁻"): for tests and for a label that cannot hold markup.
  static String plain(List<SciSegment> segments) => segments
      .map(
        (p) => switch (p.kind) {
          SciKind.sub => p.text.split('').map((c) => _subs[c] ?? c).join(),
          SciKind.sup => p.text.split('').map((c) => _sups[c] ?? c).join(),
          SciKind.plain => p.text,
        },
      )
      .join();

  /// Whether a card (or a chapter key) is chemistry: the subject the notation is drawn for. The web reads the card's subject,
  /// else its chapter key, else the key it is given; the first dotted part, lower-cased, must be `chemistry`.
  static bool isChemistry({KeyCard? card, String? chapterKey}) {
    String pick() {
      final subject = card?.subject ?? '';
      if (subject.isNotEmpty) return subject;
      final own = card?.chapterKey ?? '';
      if (own.isNotEmpty) return own;
      return chapterKey ?? '';
    }

    return pick().split('.').first.toLowerCase() == 'chemistry';
  }
}
