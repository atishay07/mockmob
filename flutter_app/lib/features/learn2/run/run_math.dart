/// The Learn run's pure rules, a port of the website's `src/components/learn2/run/runMath.js` (web commit 978edc236)
/// except `stemParts`, which is the stage's (`stage_text.dart`): the seconds an item takes, "about 6 min left", "Up next",
/// an option's words, an explanation's first line, where a put-back item lands, the pips, Mobi's one reaction at the end and
/// the detail under an end number. `test/unit/learn2/run/run_math_parity_test.dart` holds every function to what the web's
/// own code returns (`tool/learn2_parity/run_math.mjs` writes `test/fixtures/learn2/parity/run_math.json`).
library;

import 'dart:math' as math;

import '../data/learn_models.dart';

/// What a run counted so far, for Mobi's reaction on the end and the stop sheet's detail: cards by their rating, questions by
/// the server's grade.
class RunTally {
  const RunTally({this.missed = 0, this.got = 0, this.easy = 0, this.right = 0, this.wrong = 0});

  final int missed;
  final int got;
  final int easy;
  final int right;
  final int wrong;

  RunTally copyWith({int? missed, int? got, int? easy, int? right, int? wrong}) =>
      RunTally(missed: missed ?? this.missed, got: got ?? this.got, easy: easy ?? this.easy, right: right ?? this.right, wrong: wrong ?? this.wrong);

  /// Questions asked (answered right or wrong).
  int get asked => right + wrong;

  /// Cards sent to Revise (Got it and Easy).
  int get toRevise => got + easy;
}

/// One run of the same kind of item (the web's `pipGroups`).
class RunPipGroup {
  const RunPipGroup({required this.type, required this.from, required this.to});

  final String type;
  final int from;
  final int to;
}

abstract final class RunMath {
  /// Seconds an item takes on screen: the item's own `seconds` (every composed item carries them), else the old fixed rule
  /// for a run stored before that (a rated card 15 s, a recap card or a look 10 s, a question 60 s, a lesson its minutes).
  static int itemSeconds(LearnItem? item, [String kind = LearnKinds.mix]) {
    if (item == null) return 0;
    if (item.seconds > 0) return item.seconds;
    if (item is LearnQuestionItem) return 60;
    if (item is LearnLessonItem) {
      final m = item.lesson.minutes ?? 0;
      return math.max(1, m == 0 ? 5 : m) * 60;
    }
    final look = item is LearnCardItem && item.look;
    return kind == LearnKinds.recap || look ? 10 : 15;
  }

  /// Learn's one minutes rule (`minutesFor` in data/learn/compose.js): seconds with the 10 percent, rounded, at least 1.
  static int minutesFor(num seconds) => seconds > 0 ? math.max(1, (seconds * 1.1 / 60).round()) : 0;

  /// "about 6 min left" from the items still to finish (the current one counts until it is finished): the sum of their
  /// seconds. Null when nothing is left.
  static String? minutesLeftLine(List<LearnItem> items, int done, [String kind = LearnKinds.mix]) {
    final rest = _slice(items, math.max(0, done));
    if (rest.isEmpty) return null;
    final seconds = rest.fold<int>(0, (sum, i) => sum + itemSeconds(i, kind));
    if (seconds * 1.1 < 60) return 'under a minute left';
    return 'about ${minutesFor(seconds)} min left';
  }

  static const Map<String, (String, String)> _noun = {'card': ('card', 'cards'), 'question': ('question', 'questions'), 'lesson': ('lesson', 'lessons')};

  static String _named(String type, int n) {
    final (_, many) = _noun[type] ?? _noun['card']!;
    if (n == 1) return type == 'card' ? 'a card' : (type == 'lesson' ? 'a lesson' : 'a question');
    return '$n $many';
  }

  static String _typeOf(LearnItem i) => i is LearnQuestionItem ? 'question' : (i is LearnLessonItem ? 'lesson' : 'card');

  /// "Up next: 2 cards, then a question" from the items after the current one; null when nothing follows.
  static String? upNextLine(List<LearnItem> items, int at) {
    final next = _slice(items, at + 1);
    if (next.isEmpty) return null;
    final groups = <({String type, int n})>[];
    for (final item in next) {
      final type = _typeOf(item);
      if (groups.isNotEmpty && groups.last.type == type) {
        groups[groups.length - 1] = (type: type, n: groups.last.n + 1);
      } else if (groups.length < 2) {
        groups.add((type: type, n: 1));
      } else {
        break;
      }
    }
    final a = groups[0];
    return groups.length > 1 ? 'Up next: ${_named(a.type, a.n)}, then ${_named(groups[1].type, groups[1].n)}' : 'Up next: ${_named(a.type, a.n)}';
  }

  /// JavaScript's `slice(start)`: a negative start counts from the end.
  static List<T> _slice<T>(List<T> list, int start) {
    final from = start < 0 ? math.max(0, list.length + start) : math.min(start, list.length);
    return list.sublist(from);
  }

  /// An option's words without a letter the bank repeated in front of it ("A Decrease in..." under key A).
  static String optionText({required String key, required String text}) {
    final words = text.trim();
    final k = key.trim();
    if (k.isEmpty) return words;
    final re = RegExp('^\\(?${k.replaceAll(RegExp('[^A-Za-z0-9]'), '')}[).:]?\\s+', caseSensitive: false);
    return re.hasMatch(words) && words.length > k.length + 2 ? words.replaceFirst(re, '') : words;
  }

  /// The explanation's first sentence, for a right answer ("Right." and one line).
  static String firstLine(String? text) {
    final s = (text ?? '').trim();
    if (s.isEmpty) return '';
    final m = RegExp(r'^(.+?[.?])(\s|$)').firstMatch(s);
    return (m != null ? m.group(1)! : s).trim();
  }

  /// Where a re-inserted item goes: `at` from the server is a position in the run's list; clamp it after the current item.
  static int reinsertAt(int length, int current, num? at) {
    final wanted = at != null && at.isFinite ? at : current + 3;
    return math.max(current + 1, math.min(length, wanted)).toInt();
  }

  /// The kind of flight a rating makes.
  static const Map<int, String> flight = {1: 'missed', 3: 'got', 4: 'easy'};

  /// The progress pips: one per item, grouped by kind in runs of the same type; null past [max] items (a plain bar then).
  static List<RunPipGroup>? pipGroups(List<LearnItem> items, [int max = 40]) {
    if (items.isEmpty || items.length > max) return null;
    final groups = <RunPipGroup>[];
    for (final (i, item) in items.indexed) {
      final type = _typeOf(item);
      if (groups.isNotEmpty && groups.last.type == type) {
        groups[groups.length - 1] = RunPipGroup(type: type, from: groups.last.from, to: i);
      } else {
        groups.add(RunPipGroup(type: type, from: i, to: i));
      }
    }
    return groups;
  }

  /// Mobi's one reaction on the run's end: thinking after 3 or more missed cards, a nod at 80 percent right or better,
  /// otherwise an encouraging lean. One of `think`, `nod`, `encourage`.
  static String endAct(RunTally tally) {
    if (tally.missed >= 3) return 'think';
    final answered = tally.right + tally.wrong;
    final rated = tally.got + tally.easy + tally.missed;
    final double share = answered > 0 ? tally.right / answered : (rated > 0 ? (tally.got + tally.easy) / rated : 0);
    return share >= 0.8 ? 'nod' : 'encourage';
  }

  /// The end's one detail under a number, from the server's line for it: "16 got it", "5 of 5 right", "1 of 2, 1 still open".
  static String numberDetail(String? line) {
    final text = (line ?? '').trim();
    if (text.isEmpty) return '';
    return text.replaceFirst(RegExp(r'\s*fixed\b[.,]?\s*', caseSensitive: false), ', ').replaceAll(RegExp(r',\s*,'), ',').replaceFirst(RegExp(r'[.,\s]+$'), '');
  }
}
