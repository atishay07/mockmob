/// The Learn run's screen rules, a port of the website's `src/components/learn2/run/runView.mjs` (web origin/main, rounds 2 to 4):
/// what the piles count, what a card's tag says, how a re-insert lands, the streak, and how the end reads (its lines, its
/// lead, Free's line, its title). Pure, so tests hold them: `test/unit/learn2/run/run_math_parity_test.dart` checks every
/// function against what the web's own code returns (`tool/learn2_parity/run_math.mjs`).
library;

import 'dart:math' as math;

import '../data/learn_models.dart';
import '../stage/stage_end_model.dart';
import '../stage/stage_text.dart';

/// One pile of the run worked down: "Key cards 3 of 12".
class RunPile {
  const RunPile({required this.id, required this.label, required this.done, required this.of, required this.current, required this.value});

  final String id;
  final String label;
  final int done;
  final int of;

  /// The item on screen belongs to this pile.
  final bool current;

  /// "4 of 16" once an item of the pile is done; "" before any is (the label then reads its total, "16 Key cards"); "3 left" or
  /// "Done" on a picked-up run.
  final String value;
}

/// Plain questions answered and right, open mistakes tried and fixed, and the streak of right answers.
class RunAnswerTally {
  const RunAnswerTally({this.answered = 0, this.right = 0, this.tried = 0, this.fixed = 0, this.streak = 0});

  final int answered;
  final int right;
  final int tried;
  final int fixed;
  final int streak;
}

/// The end's lead: a heading that names it, its reason, and the key's words.
class RunLead {
  const RunLead({this.heading, this.reason, required this.key});

  final String? heading;
  final String? reason;
  final String key;
}

/// A row of the end: "Key cards" / "16 rated, all got it".
typedef RunEndLine = ({String label, String value});

abstract final class RunView {
  /// The front's size step by its length in characters (R3 L1): 's' up to 60, 'm' up to 140, 'l' longer.
  static String frontStep(String? text) => StageText.frontSize(text);

  /// The tag at the card's head: why this card is here (a recap shows none).
  static String? stageTag(LearnItem? item, {bool recap = false}) {
    if (item is! LearnCardItem || recap) return null;
    if (item.reason == 'line') return 'The line you needed';
    if (item.reason == 'earlier' || item.stage == 'again') return 'Back from earlier';
    if (item.stage == 'due') return 'Due today';
    return null;
  }

  /// R3 ruling W: question mistakes are "open mistakes" everywhere (never "old mistakes").
  static const Map<String, String> pileNames = {'cards': 'Key cards', 'questions': 'Questions', 'mistakes': 'Open mistakes', 'lesson': 'Lesson'};

  /// "16 Key cards", "2 questions", "1 open mistake", "1 lesson": a pile's total before any of it is done.
  static String pileTotal(String id, int n) => switch (id) {
    'cards' => '$n Key ${n == 1 ? 'card' : 'cards'}',
    'questions' => plural(n, 'question'),
    'mistakes' => plural(n, 'open mistake'),
    _ => plural(n, 'lesson'),
  };

  static String _pileOf(LearnItem item) => switch (item) {
    LearnQuestionItem(:final origin) => origin == 'mistake' ? 'mistakes' : 'questions',
    LearnLessonItem() => 'lesson',
    _ => 'cards',
  };

  /// The piles of this run worked down: one row per pile the run holds, `done` of `of` counted by distinct cards (a card
  /// back from earlier is the same card), the row of the item on screen marked. No column of zeros (R2 screens 10): before an
  /// item of a pile is done its row reads its total ("16 Key cards"), after that "4 of 16"; a resumed run only holds what was
  /// left, so its rows read "N left", and "Done" when nothing is.
  static List<RunPile> runPiles(List<LearnItem> items, int finished, {int at = -1, bool resumed = false}) {
    final rows = <String, ({int done, int of, bool current})>{};
    final seen = <String>{};
    for (final (i, item) in items.indexed) {
      final id = _pileOf(item);
      final row = rows[id] ?? (done: 0, of: 0, current: false);
      final unit = item is LearnCardItem ? 'c:${item.card.id.isNotEmpty ? item.card.id : item.id}' : 'i:${item.id}';
      final first = seen.add(unit);
      rows[id] = (done: row.done + (i < finished && first ? 1 : 0), of: row.of + (first ? 1 : 0), current: row.current || i == at);
    }
    const order = ['lesson', 'cards', 'questions', 'mistakes'];
    final ids = rows.keys.toList()..sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return [
      for (final id in ids)
        () {
          final r = rows[id]!;
          final left = math.max(0, r.of - r.done);
          final String label;
          final String value;
          if (resumed) {
            label = pileNames[id]!;
            value = left > 0 ? '$left left' : 'Done';
          } else if (r.done == 0) {
            label = pileTotal(id, r.of);
            value = '';
          } else {
            label = pileNames[id]!;
            value = '${r.done} of ${r.of}';
          }
          return RunPile(id: id, label: label, done: r.done, of: r.of, current: r.current, value: value);
        }(),
    ];
  }

  /// Plain questions answered and right, the open mistakes tried and fixed, and the current streak of right answers.
  /// [graded] holds each answered question's id with whether the server called it right.
  static RunAnswerTally answerTally(List<LearnItem> items, Map<String, bool> graded) {
    var answered = 0;
    var right = 0;
    var tried = 0;
    var fixed = 0;
    var streak = 0;
    for (final item in items) {
      final correct = graded[item.id];
      if (correct == null || item is! LearnQuestionItem) continue;
      if (item.origin == 'mistake') {
        tried += 1;
        if (correct) fixed += 1;
      } else {
        answered += 1;
        if (correct) right += 1;
      }
      streak = correct ? streak + 1 : 0;
    }
    return RunAnswerTally(answered: answered, right: right, tried: tried, fixed: fixed, streak: streak);
  }

  /// "Right." or "Right. 4 in a row." from 3 in a row.
  static String rightLine(int streak) => streak >= 3 ? 'Right. $streak in a row.' : 'Right.';

  /// The live region on each move: "Card 3 of 21", "Question 4 of 21", "Lesson 1 of 21".
  static String positionWords(LearnItem? item, int position, int total) {
    final noun = item is LearnQuestionItem ? 'Question' : (item is LearnLessonItem ? 'Lesson' : 'Card');
    return '$noun $position of $total';
  }

  /// The stop sheet's line (R2 ruling 6): "5 of 20 done. It’s all saved."
  static String stopLine(int done, int total) => StageEndModel.stopSheetLine(done, total);

  /// How many items the student has finished, for the stop sheet's "N of M done": the items before the one on screen, plus the
  /// one on screen once the server has it: an answered question, or a card whose rating or look the server already holds while
  /// the card is still flying away. Counting that flying card keeps the sheet equal to the end screen.
  static int itemsFinished({required bool playing, required int at, required int length, LearnItem? item, bool answered = false, bool acted = false}) {
    if (!playing) return length;
    return at + (item != null && ((item is LearnQuestionItem && answered) || acted) ? 1 : 0);
  }

  /// A copy of [item] under another id (a put-back item).
  static LearnItem withId(LearnItem item, String id) => switch (item) {
    LearnCardItem() => LearnCardItem(
      id: id,
      card: item.card,
      stage: item.stage,
      look: item.look,
      recap: item.recap,
      reason: item.reason,
      seconds: item.seconds,
      raw: {...item.raw, 'id': id},
    ),
    LearnQuestionItem() => LearnQuestionItem(
      id: id,
      question: item.question,
      origin: item.origin,
      mistake: item.mistake,
      seconds: item.seconds,
      raw: {...item.raw, 'id': id},
    ),
    LearnLessonItem() => LearnLessonItem(id: id, lesson: item.lesson, seconds: item.seconds, raw: {...item.raw, 'id': id}),
  };

  /// A card put back in later: the stage `again` (the tag then reads "Back from earlier" unless the card is "The line you
  /// needed"). Other items stay as they are.
  static LearnItem again(LearnItem item) => item is LearnCardItem
      ? LearnCardItem(
          id: item.id,
          card: item.card,
          stage: 'again',
          look: item.look,
          recap: item.recap,
          reason: item.reason,
          seconds: item.seconds,
          raw: item.raw,
        )
      : item;

  /// Where a re-inserted item goes in the client's list. The server's [at] is a place in the run's whole list; a resumed run
  /// holds only the items after [offset]. [moved] moves the item already in the list (never a copy). Returns the new list
  /// (the same list when nothing changes).
  static List<LearnItem> placeReinsert(
    List<LearnItem> list, {
    required String itemId,
    num? at,
    LearnItem? item,
    bool moved = false,
    int current = 0,
    int offset = 0,
  }) {
    if (itemId.isEmpty) return list;
    final want = at != null && at.isFinite ? at.toInt() - offset : current + 3;
    final has = list.indexWhere((x) => x.id == itemId);
    if (has >= 0) {
      if (!moved || has <= current) return list;
      final rest = [
        for (final x in list)
          if (x.id != itemId) x,
      ];
      final i = math.max(current + 1, math.min(rest.length, want));
      return [...rest.take(i), list[has], ...rest.skip(i)];
    }
    if (item == null) return list;
    final i = math.max(current + 1, math.min(list.length, want));
    return [...list.take(i), withId(item, itemId), ...list.skip(i)];
  }

  // ---------------------------------------------------------------- the end

  /// "Getting there" becomes `getting_there`, the state key the ring shape reads.
  static String stateKeyOf(String? label) => (label ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');

  /// "Admission of a Partner moved from Getting there to Holding." becomes (from, to) (Pro only; null when nothing moved).
  static ({String from, String to})? movedParts(String? moved) {
    final m = RegExp(r'moved from (.+?) to (.+?)\.?$').firstMatch(moved ?? '');
    return m == null ? null : (from: m.group(1)!, to: m.group(2)!);
  }

  /// "14 back Wed, 2 back in 20 days" from the server's groups, and the total in Revise.
  static ({int total, String line}) reviseSummary(List<LearnPileGroup> groups) {
    final list = [
      for (final g in groups)
        if (g.count > 0) g,
    ];
    final total = list.fold<int>(0, (s, g) => s + g.count);
    return (total: total, line: list.map((g) => '${g.count} ${g.label.replaceFirst(RegExp(r'^back on '), 'back ')}').join(', '));
  }

  /// The end's lines, label and value, only rows with something in them.
  ///   Key cards     "16 rated, all got it" | "16 rated: 12 got it, 3 easy, 1 missed" (+ ", 2 looked at")
  ///   Questions     "3 of 3 right"
  ///   Old mistakes  "2 of 2 fixed" | "1 of 2 fixed, 1 still open"
  static List<RunEndLine> endLines(LearnEnd data, {String kind = LearnKinds.mix}) {
    final n = data.numbers;
    String lineOf(String label) {
      for (final l in data.lines) {
        if (l.label.toLowerCase() == label) return l.text;
      }
      return '';
    }

    final out = <RunEndLine>[];
    final cardsText = lineOf('cards');
    if (kind == LearnKinds.recap) {
      if (cardsText.isNotEmpty) out.add((label: 'Key cards', value: cardsText));
    } else {
      final rated = n.cards;
      final looked = int.tryParse(RegExp(r'(\d+) looked at').firstMatch(cardsText)?.group(1) ?? '') ?? 0;
      final fallback = cardsText.replaceFirst(RegExp(r',?\s*\d+ looked at'), '');
      final given = n.detail.cards;
      final detail = (given != null && given.isNotEmpty ? given : fallback).trim();
      final onlyGot = RegExp('^$rated got it\$').hasMatch(detail);
      var value = rated > 0 ? '$rated rated${detail.isNotEmpty ? (onlyGot ? ', all got it' : ': $detail') : ''}' : '';
      if (looked > 0) value = value.isNotEmpty ? '$value, $looked looked at' : '$looked looked at';
      if (value.isNotEmpty) out.add((label: 'Key cards', value: value));
    }
    final detailQuestions = n.detail.questions;
    final lineQuestions = lineOf('questions');
    final q = lineQuestions.isNotEmpty ? lineQuestions : (detailQuestions ?? '');
    if (q.isNotEmpty) out.add((label: 'Questions', value: q));
    // Open mistakes the run never reached (a stop before them) are not a line: nothing was tried.
    final mistakesRaw = n.raw['mistakes'];
    final noMistakes = mistakesRaw is num && mistakesRaw == 0;
    final lineMistakes = lineOf('mistakes');
    final detailFixed = n.detail.fixed;
    final m = noMistakes ? '' : (lineMistakes.isNotEmpty ? lineMistakes : (detailFixed ?? ''));
    if (m.isNotEmpty) out.add((label: 'Open mistakes', value: RegExp('fixed').hasMatch(m) ? m : '$m fixed'));
    return out;
  }

  /// The lead's heading, reason and key: a run's key names its length ("Start 10 minutes"); else its own verb.
  static RunLead? leadView(LearnOption? option) {
    if (option == null) return null;
    final title = option.title ?? option.label.replaceFirst(RegExp(r', \d+ minutes?$'), '').replaceFirst(RegExp(r', \d+ min$'), '');
    final runMinutes = option.run?.minutes ?? 0;
    final minutes = runMinutes != 0 ? runMinutes : ((option.minutes ?? 0) != 0 ? option.minutes : null);
    final run = option.run;
    final isRun = run != null && (run.kind == LearnKinds.mix || run.kind == LearnKinds.feed) && minutes != null;
    final key = isRun ? 'Start $minutes minutes' : title;
    return RunLead(heading: key == title ? null : title, reason: option.evidence, key: key);
  }

  /// The Free block of the end after the day's session: the server's line split into its two sentences (rest null when it
  /// has one). Null for no line.
  static ({String head, String? rest})? freeEndLines(String? line) {
    final text = (line ?? '').trim();
    if (text.isEmpty) return null;
    final m = RegExp(r'^(.+?\.)\s+(.+)$').firstMatch(text);
    return m != null ? (head: m.group(1)!, rest: m.group(2)) : (head: text, rest: null);
  }

  /// The first sentence of Free's line on a first run ("Free opened 5 of this chapter's 46 cards."); null for none.
  static String? firstSentence(String? text) {
    final s = text ?? '';
    final first = (RegExp(r'^.+?\.(?=\s|$)').firstMatch(s)?.group(0) ?? s).trim();
    return first.isEmpty ? null : first;
  }

  /// The end's title: "10 minutes on" or "Stopped at 7 of 21 in", and the chapter's name.
  static ({String? lead, String name}) endTitle(String? title, {int? stoppedAt, int? total, String kind = LearnKinds.mix}) {
    final text = title ?? '';
    final m = RegExp(r'^(.*?\b(?:minutes? on|recap of))\s+(.+)$', caseSensitive: false).firstMatch(text);
    final name = m != null ? m.group(2)! : text;
    if (stoppedAt != null && total != null && total != 0 && stoppedAt < total && kind != LearnKinds.recap) {
      return (lead: 'Stopped at $stoppedAt of $total in', name: name);
    }
    return (lead: m?.group(1), name: name);
  }

  /// "1 card", "3 cards".
  static String plural(int n, String one, [String? many]) => StageText.plural(n, one, many);
}
