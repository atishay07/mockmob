/// The end screen's one formula (the web's `src/components/learn2/stage/endModel.mjs`; R2 ruling 5, LK31, R3-SPEC L5, R4), shared
/// by the run and the feed. Pure, so unit tests hold it against the web's own module (stage_text_parity_test.dart). Top to
/// bottom the screen draws: the chapter name as a quiet line, a headline, one row of up to 3 numbers (every zero dropped), the
/// chapter's progress bar growing, one main key and at most one quiet text link. The X is the only other way out.
/// Never a zero: a count that is 0 is dropped, and "0 of 2 right" becomes "2 questions tried" (R2 ruling 1).
library;

import 'dart:math' as math;

import '../data/learn_words.dart';

/// One figure of the numbers row: [value] is the whole figure as drawn ("1 of 2"), [n] its leading number (the count-up
/// animates it), [label] the words under it.
typedef EndNumber = ({String value, int n, String label});

/// The chapter's bar: [from] and [to] as shares of 1, and its [label] ("20 of 45 cards seen").
typedef EndProgress = ({double from, double to, String label});

/// One of Free's quiet rows after the day's session: [id] is `continue`, `revise` or `singles`.
typedef FreeUsedRow = ({String id, String label});

abstract final class StageEndModel {
  /// The Free bar's tail once every free card is seen (R4 first-timer#4): one line, no extra block.
  static const String freeRestPro = 'the rest open with Pro';

  /// The one quiet line of a Free end after the day's session (ruling F).
  static const String freeEndLine = LearnFreeWords.endLine;

  /// The web's `num` (here `whole`): a whole number from 0 up; anything that is not a finite number is 0.
  static int whole(Object? x) {
    final num n;
    if (x is num) {
      n = x;
    } else if (x == null) {
      n = 0;
    } else if (x is bool) {
      n = x ? 1 : 0;
    } else {
      final t = x.toString().trim();
      n = t.isEmpty ? 0 : (num.tryParse(t) ?? double.nan);
    }
    if (n is double && (n.isNaN || n.isInfinite)) return 0;
    if (n < 0) return 0;
    return (n + 0.5).floor();
  }

  static String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  /// The headline (R3 L5): "18 done", with " in 12 min" only from 2 minutes; a stop part way reads "5 of 20 done". `stopped`
  /// or reached < of reads as a stop. Nothing reached gives null (the screen leads with the chapter instead of a zero).
  static String? endHeadline({Object? reached = 0, Object? of = 0, Object? minutes, bool stopped = false}) {
    final r = whole(reached);
    final o = whole(of);
    if (o == 0 || r == 0) return null;
    if (r >= o && !stopped) {
      final m = whole(minutes);
      return m >= 2 ? '$o done in $m min' : '$o done';
    }
    return '${math.min(r, o)} of $o done';
  }

  /// "in Revise, back Wed" from the server's return groups (`[{ label: 'back on Wed', count }]`): the soonest one.
  static String reviseLabel(Object? groups) {
    Map<Object?, Object?>? first;
    if (groups is Iterable) {
      for (final g in groups) {
        if (g is Map && whole(g['count']) > 0) {
          first = g;
          break;
        }
      }
    }
    final label = first == null ? '' : (first['label'] ?? '').toString();
    final when = first == null ? '' : label.replaceFirst(RegExp(r'^back on '), 'back ').trim();
    return when.isNotEmpty ? 'in Revise, $when' : 'in Revise';
  }

  /// The numbers row (R3 L5): up to 3, in this order, each only when it is more than 0, with the same labels on run and feed
  /// ends:
  ///   revise    cards sent to (or kept for) Revise: "14" / "in Revise, back Wed" (label from [reviseLabel] or given)
  ///   answered  questions answered: "1 of 2" / "questions right"; none right: "2" / "questions tried" (never "0 of 2")
  ///   fixed     open mistakes fixed: "2" / "open mistakes fixed" (none fixed: no number; never "mistakes tried")
  /// No "cards seen" number: the chapter's bar carries it. [mistakes] null leaves [fixed] as it is.
  static List<EndNumber> endNumbers({
    Object? revise = 0,
    String reviseText = 'in Revise',
    Object? answered = 0,
    Object? right = 0,
    Object? mistakes,
    Object? fixed = 0,
  }) {
    final out = <EndNumber>[];
    final rv = whole(revise);
    if (rv > 0) out.add((value: '$rv', n: rv, label: reviseText));
    final a = whole(answered);
    final r = math.min(whole(right), a);
    if (a > 0) {
      out.add(
        r > 0
            ? (value: '$r of $a', n: r, label: a == 1 ? 'question right' : 'questions right')
            : (value: '$a', n: a, label: a == 1 ? 'question tried' : 'questions tried'),
      );
    }
    final f = mistakes == null ? whole(fixed) : math.min(whole(fixed), whole(mistakes));
    if (f > 0) out.add((value: '$f', n: f, label: f == 1 ? 'open mistake fixed' : 'open mistakes fixed'));
    return out.length > 3 ? out.sublist(0, 3) : out;
  }

  /// The chapter's progress bar from `{ of, seen, before, open }`, or null when nothing is seen (no empty bar). The bar grows
  /// from `before` to `seen` (600 ms, ease-out).
  static EndProgress? endProgress(Map<Object?, Object?>? progress) {
    final of = whole(progress?['of']);
    final seen = math.min(whole(progress?['seen']), of);
    if (of == 0 || seen == 0) return null;
    final before = math.min(whole(progress?['before']), seen);
    return (from: before / of, to: seen / of, label: progressLabel(seen: seen, of: of, open: progress?['open']));
  }

  /// The bar's label: "20 of 45 cards seen". On Free ([open], the cards Free opens in this chapter, is sent and is fewer than
  /// the chapter's cards) once the seen cards reach the free count: "5 of 45 cards seen · the rest open with Pro". Pro never
  /// sends [open] (or sends the whole chapter), so it never reads the tail.
  static String progressLabel({Object? seen = 0, Object? of = 0, Object? open}) {
    final s = whole(seen);
    final o = whole(of);
    final base = '$s of $o cards seen';
    final free = open == null || open == '' ? null : whole(open);
    return free != null && free > 0 && free < o && s >= free ? '$base · $freeRestPro' : base;
  }

  /// A fan mini's front, cut at a word boundary (R4 owner-eye#14): at most [max] characters (about 3 lines of 18), ending on a
  /// whole word with an ellipsis, never mid-word. A first word longer than [max] is kept whole (the clamp is the backstop).
  static String miniFront(String? text, {int max = 54}) {
    final s = (text ?? '').replaceAll(RegExp(r'_{3,}'), '____').replaceAll(RegExp(r'\s+'), ' ').trim();
    if (s.length <= max) return s;
    final cut = s.substring(0, max + 1);
    final at = cut.lastIndexOf(' ');
    final head = (at > 0 ? cut.substring(0, at) : s.split(' ').first).replaceAll(RegExp(r'[\s,;:.–—-]+$'), '');
    return '$head…';
  }

  /// The checkpoint (R2 screens 12): a headline that never leads with a zero, and one line ("8 of 21 done, about 6 min left.").
  static ({String big, String line}) checkpointLines({
    Object? answered = 0,
    Object? right = 0,
    Object? seen = 0,
    Object? kept = 0,
    Object? done = 0,
    Object? of = 0,
    String? left,
  }) {
    final a = whole(answered);
    final r = math.min(whole(right), a);
    final k = whole(kept);
    final s = whole(seen);
    final String big;
    if (a > 0) {
      big = r > 0 ? '$r of $a right' : '${_plural(a, 'question')} tried';
    } else if (k > 0) {
      big = '$k for Revise';
    } else if (s > 0) {
      big = '${_plural(s, 'card')} seen';
    } else {
      big = '${whole(done)} done';
    }
    final tail = left == null || left.isEmpty ? '' : ', ${left.substring(0, 1).toLowerCase()}${left.substring(1)}';
    return (big: big, line: '${whole(done)} of ${whole(of)} done$tail.');
  }

  /// The stop sheet's line (R2 ruling 6): "5 of 20 done. It’s all saved."
  static String stopSheetLine(Object? done, Object? of) => whole(of) > 0 ? '${whole(done)} of ${whole(of)} done. It’s all saved.' : 'It’s all saved.';

  /// A pile card's front size: 12 when its longest word is over 11 characters, else 13 (R2 screens 11).
  static int pileFrontSize(String? text) {
    final strip = RegExp(r'[^\p{L}\p{N}]', unicode: true);
    for (final w in (text ?? '').split(RegExp(r'\s+'))) {
      if (w.replaceAll(strip, '').length > 11) return 12;
    }
    return 13;
  }

  /// The Or rows of ruling F, in order, at most 2, from the 402 body (`resume`, `options`): "Continue · N min", "Revise N due
  /// cards · M min", "Answer single questions".
  static List<FreeUsedRow> freeUsedRows(Map<Object?, Object?>? data) {
    final resume = data?['resume'];
    final options = data?['options'];
    Map<Object?, Object?>? revise;
    if (options is Iterable) {
      for (final o in options) {
        if (o is Map && o['run'] is Map && (o['run'] as Map)['kind'] == 'cards') {
          revise = o;
          break;
        }
      }
    }
    final rows = <FreeUsedRow>[];
    if (resume is Map) {
      final of = _numberAt(resume, 'of');
      final done = _numberAt(resume, 'done');
      if (of != null && done != null && of > done) {
        rows.add((id: 'continue', label: LearnWords.withMinutes(LearnWords.continueWord, _numberAt(resume, 'minutesLeft'))));
      }
    }
    if (revise != null) {
      final run = revise['run'] as Map;
      final ids = run['cardIds'];
      var n = ids is List ? ids.length : 0;
      if (n == 0) n = int.tryParse(RegExp(r'(\d+) due card').firstMatch((revise['label'] ?? '').toString())?.group(1) ?? '') ?? 0;
      rows.add((id: 'revise', label: n > 0 ? LearnWords.reviseDue(n, _numberAt(run, 'minutes')) : (revise['label'] ?? '').toString()));
    }
    rows.add((id: 'singles', label: LearnWords.singles));
    return rows.length > 2 ? rows.sublist(0, 2) : rows;
  }

  /// JavaScript's `Number(m[key])`: a missing key is NaN (null here), a JSON null is 0, a numeric string is its number.
  static num? _numberAt(Map<Object?, Object?> m, String key) {
    if (!m.containsKey(key)) return null;
    final x = m[key];
    if (x == null) return 0;
    if (x is num) return x.isNaN ? null : x;
    if (x is bool) return x ? 1 : 0;
    final t = x.toString().trim();
    return t.isEmpty ? 0 : num.tryParse(t);
  }
}
