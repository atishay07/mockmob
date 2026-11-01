/// The Explore feed's rules on the phone: a port of the web's `src/components/learn2/feed/feedModel.mjs` and the feed's
/// part of `data/learn/feed.js` (`feedSlots`, `checkpointNumber`, `CHECKPOINT_LINE`, `keptLine`), with the end's words
/// that live in `ChapterFeed.jsx` (`endTitle`, `endLines`). Pure: no widgets, no clock, no I/O. The parity test
/// (test/unit/learn2/feed/feed_model_parity_test.dart, fed by tool/learn2_parity/feed_model.mjs) holds every function
/// here that the web exports to the web's own answers.
///
///   slots        the screens of a feed in order: every item, and a checkpoint after items 8, 16, ... only when 4 or
///                more items follow it (BUILD-1101 1.4, R3.4)
///   numbers      one definition of every count (B7 G): "Questions" are plain questions, old mistakes have their own
///                line, "seen" counts cards that were on screen, not positions passed
///   reinsert     an answer's re-insert: a moved card moves (never a copy), a copy goes in once (A8 F9, F11, F18)
library;

import 'dart:math' as math;

import 'package:flutter/foundation.dart' show immutable;

import '../../../core/models/json_helpers.dart';
import '../data/learn_models.dart';
import 'feed_copy.dart';

// ---------------------------------------------------------------- the feed's screens

/// One screen of a feed: an item, a checkpoint, or the end (only `upNextText` names the end).
sealed class FeedSlot {
  const FeedSlot();
}

/// An item and its 1-based place [n] among the feed's items.
final class FeedItemSlot extends FeedSlot {
  const FeedItemSlot(this.item, this.n);

  final LearnItem item;
  final int n;
}

/// The pause after item [after] ("cp-8").
final class FeedCheckpointSlot extends FeedSlot {
  const FeedCheckpointSlot({required this.id, required this.after});

  final String id;
  final int after;
}

/// The end of the feed (how it went).
final class FeedEndSlot extends FeedSlot {
  const FeedEndSlot();
}

// ---------------------------------------------------------------- what the phone holds per item

/// The line under a card: "In Revise", "In Revise, back Wed", "This card is on Pro.", or [bad] for "Not kept. Try again.".
@immutable
class FeedStamp {
  const FeedStamp(this.text, {this.bad = false});

  final String text;
  final bool bad;

  @override
  bool operator ==(Object other) => other is FeedStamp && other.text == text && other.bad == bad;

  @override
  int get hashCode => Object.hash(text, bad);
}

/// An answer: [choice] on its way ([res] null), or graded by the server.
@immutable
class FeedAnswer {
  const FeedAnswer.pending(this.choice) : res = null;
  const FeedAnswer.graded(this.choice, LearnAnswer this.res);

  final String choice;
  final LearnAnswer? res;

  bool get pending => res == null;
}

const Object _keep = Object();

/// One item's state on this phone (the web's `states[id]`): a card's seen, turned, seenBack (its back was read), kept,
/// keeping, keepPro, stamp; a question's saved, saving, savePro, answer, skipped (a left-out line) and error.
@immutable
class FeedItemState {
  const FeedItemState({
    this.seen = false,
    this.turned = false,
    this.seenBack = false,
    this.kept = false,
    this.keeping = false,
    this.keepPro = false,
    this.stamp,
    this.saved = false,
    this.saving = false,
    this.savePro = false,
    this.answer,
    this.skipped,
    this.error,
  });

  final bool seen;
  final bool turned;
  final bool seenBack;
  final bool kept;
  final bool keeping;
  final bool keepPro;
  final FeedStamp? stamp;
  final bool saved;
  final bool saving;
  final bool savePro;
  final FeedAnswer? answer;

  /// The line that stands in for the options (a 409, or Free's day claimed elsewhere).
  final String? skipped;
  final String? error;

  /// A graded answer's result, else null.
  LearnAnswer? get res => answer?.res;

  FeedItemState copyWith({
    bool? seen,
    bool? turned,
    bool? seenBack,
    bool? kept,
    bool? keeping,
    bool? keepPro,
    Object? stamp = _keep,
    bool? saved,
    bool? saving,
    bool? savePro,
    Object? answer = _keep,
    Object? skipped = _keep,
    Object? error = _keep,
  }) => FeedItemState(
    seen: seen ?? this.seen,
    turned: turned ?? this.turned,
    seenBack: seenBack ?? this.seenBack,
    kept: kept ?? this.kept,
    keeping: keeping ?? this.keeping,
    keepPro: keepPro ?? this.keepPro,
    stamp: identical(stamp, _keep) ? this.stamp : stamp as FeedStamp?,
    saved: saved ?? this.saved,
    saving: saving ?? this.saving,
    savePro: savePro ?? this.savePro,
    answer: identical(answer, _keep) ? this.answer : answer as FeedAnswer?,
    skipped: identical(skipped, _keep) ? this.skipped : skipped as String?,
    error: identical(error, _keep) ? this.error : error as String?,
  );
}

/// The session's own numbers (the web's `feedNumbers`): plain questions [answered] and [right], old [mistakes] answered
/// and [fixed], cards [kept] and cards [seen].
@immutable
class FeedNumbers {
  const FeedNumbers({this.answered = 0, this.right = 0, this.mistakes = 0, this.fixed = 0, this.kept = 0, this.seen = 0});

  final int answered;
  final int right;
  final int mistakes;
  final int fixed;
  final int kept;
  final int seen;

  Map<String, int> toJson() => {'answered': answered, 'right': right, 'mistakes': mistakes, 'fixed': fixed, 'kept': kept, 'seen': seen};

  @override
  bool operator ==(Object other) =>
      other is FeedNumbers &&
      other.answered == answered &&
      other.right == right &&
      other.mistakes == mistakes &&
      other.fixed == fixed &&
      other.kept == kept &&
      other.seen == seen;

  @override
  int get hashCode => Object.hash(answered, right, mistakes, fixed, kept, seen);

  @override
  String toString() => 'FeedNumbers(${toJson()})';
}

/// A checkpoint's words: the big number, the status line and the line under it.
typedef FeedCheckpointText = ({String big, String status, String line});

/// The mark of a row in "This feed".
enum FeedRowMark { kept, seen, right, wrong }

/// One row of "This feed" (the web's `sheetRows`).
@immutable
class FeedSheetRow {
  const FeedSheetRow({required this.id, required this.n, required this.kind, required this.words, this.mark});

  final String id;
  final int n;

  /// "Key card", "Question", "Old mistake".
  final String kind;
  final String words;
  final FeedRowMark? mark;
}

/// One hairline row of the end ("Cards" / "12 seen, 3 kept").
typedef FeedEndLine = ({String label, String text});

// ---------------------------------------------------------------- the rules

abstract final class FeedModel {
  /// A checkpoint after every 8 items...
  static const int checkpointEvery = 8;

  /// ...only when 4 or more items follow it.
  static const int checkpointMinAfter = 4;

  /// The checkpoint's line when something was kept (`CHECKPOINT_LINE`).
  static const String checkpointLine = 'Keep going, or end here. What you kept is already in Revise.';

  /// The checkpoint's line when nothing was kept.
  static const String checkpointLineQuiet = 'Keep going, or end here.';

  static String _plural(int n, String one, [String? many]) => '$n ${n == 1 ? one : (many ?? '${one}s')}';

  /// `feedSlots`: every item in order, with a checkpoint after each [every] items when at least [checkpointMinAfter]
  /// items follow it. A checkpoint never closes the feed (the end does that).
  static List<FeedSlot> slots(List<LearnItem> items, {int every = checkpointEvery}) {
    final out = <FeedSlot>[];
    for (var i = 0; i < items.length; i++) {
      final n = i + 1;
      out.add(FeedItemSlot(items[i], n));
      if (every > 0 && n % every == 0 && items.length - n >= checkpointMinAfter) out.add(FeedCheckpointSlot(id: 'cp-$n', after: n));
    }
    return out;
  }

  /// `checkpointNumber`: "2 of 3 right" once a question is answered, else "6 cards seen, 2 kept".
  static String checkpointNumber({int answered = 0, int right = 0, int seen = 0, int kept = 0}) {
    if (answered > 0) return '$right of $answered right';
    return '${_plural(seen, 'card')} seen, $kept kept';
  }

  /// `keptLine`: "6 kept. They are first in Revise." (no return day: none is scheduled yet), null at 0.
  static String? keptLine(int count) => count > 0 ? '$count kept. They are first in Revise.' : null;

  /// An item's own seconds, or 60 for a question and 15 for a card when it has none.
  static int secondsOf(LearnItem item) {
    if (item.seconds > 0) return item.seconds;
    return item is LearnQuestionItem ? 60 : 15;
  }

  /// `secondsFrom`: seconds of the items from index [from] on (the current one counts until it is finished).
  static int secondsFrom(List<LearnItem> items, int from) => items.skip(math.max(0, from)).fold(0, (s, i) => s + secondsOf(i));

  /// `feedNumbers`: the session's numbers from the phone's item states.
  static FeedNumbers numbers(List<LearnItem> items, Map<String, FeedItemState> states) {
    var answered = 0, right = 0, mistakes = 0, fixed = 0, kept = 0, seen = 0;
    for (final item in items) {
      final st = states[item.id] ?? const FeedItemState();
      if (item is! LearnQuestionItem) {
        if (item is LearnCardItem) {
          if (st.kept) kept += 1;
          if (st.seen) seen += 1;
        }
        continue;
      }
      final res = st.res;
      if (res == null) continue;
      if (item.isMistake) {
        mistakes += 1;
        if (res.correct) fixed += 1;
      } else {
        answered += 1;
        if (res.correct) right += 1;
      }
    }
    return FeedNumbers(answered: answered, right: right, mistakes: mistakes, fixed: fixed, kept: kept, seen: seen);
  }

  /// `checkpointText`: the checkpoint's number, its status ("8 of 21 done. About 6 min left.") and its line.
  static FeedCheckpointText checkpointText(FeedNumbers n, {required int done, required int of, required num seconds}) {
    final big = checkpointNumber(answered: n.answered, right: n.right, seen: n.seen, kept: n.kept);
    final mins = seconds > 0
        ? (seconds * 1.1 < 60 ? ' Under a minute left.' : ' About ${math.max(1, ((seconds * 1.1) / 60).round())} min left.')
        : '';
    return (big: big, status: '$done of $of done.$mins', line: n.kept > 0 ? checkpointLine : checkpointLineQuiet);
  }

  /// `upNextText`: "Up next: ..." from the next slot, null when nothing follows.
  static String? upNextText(FeedSlot? slot) {
    switch (slot) {
      case null:
        return null;
      case FeedEndSlot():
        return 'Up next: how it went';
      case FeedCheckpointSlot():
        return 'Up next: a checkpoint';
      case FeedItemSlot(:final item):
        if (item is LearnCardItem) return 'Up next: a Key card';
        if (item is LearnQuestionItem && item.isMistake) {
          final label = item.mistake?.label ?? '';
          final said = label.replaceFirst(RegExp(r'^You missed this\s*', caseSensitive: false), '').trim();
          return said.isNotEmpty ? 'Up next: a question you missed $said' : 'Up next: an old mistake';
        }
        return 'Up next: a question';
    }
  }

  /// `questionPlaces`: each plain question's place among the feed's plain questions.
  static Map<String, ({int n, int of})> questionPlaces(List<LearnItem> items) {
    final qs = [
      for (final i in items)
        if (i is LearnQuestionItem && !i.isMistake) i,
    ];
    return {for (final (i, q) in qs.indexed) q.id: (n: i + 1, of: qs.length)};
  }

  /// The re-insert's place as the web reads it (`Number(reinsert.at)`): null when it is missing or not a number.
  static int? _at(LearnReinsert r) {
    if (r.raw.isEmpty) return r.at;
    if (!r.raw.containsKey('at')) return null;
    final v = r.raw['at'];
    return v == null ? 0 : asInt(v);
  }

  /// `spliceReinsert`: the list after an answer's re-insert. A [LearnReinsert.moved] card already in the list moves to
  /// `at` (or stays when it is closer), never a copy; otherwise the copy goes in at `at`, once (an id already in the list
  /// is never added twice). `at` is a place in the server's full list; a [resumed] list holds only what was not done, so
  /// there it is the answered item's place plus 3 (the server's gap). Returns [list] itself when nothing changes.
  static List<LearnItem> spliceReinsert(List<LearnItem> list, {required String answeredId, LearnReinsert? reinsert, bool resumed = false}) {
    if (reinsert == null) return list;
    final id = reinsert.item?.id ?? reinsert.itemId;
    if (id.isEmpty) return list;
    final from = list.indexWhere((x) => x.id == answeredId);
    final at = _at(reinsert);
    final wanted = resumed || at == null ? from + 3 : at;
    if (reinsert.moved) {
      final j = list.indexWhere((x) => x.id == id);
      if (j < 0) return list;
      final target = math.max(from + 1, math.min(list.length - 1, wanted));
      if (j <= target) return list;
      final next = [
        for (var k = 0; k < list.length; k++)
          if (k != j) list[k],
      ]..insert(target, list[j]);
      return next;
    }
    final item = reinsert.item;
    if (item == null || list.any((x) => x.id == id)) return list;
    return [...list]..insert(math.max(from + 1, math.min(list.length, wanted)), item);
  }

  static final RegExp _blanks = RegExp(r'_{3,}');
  static final RegExp _spaces = RegExp(r'\s+');

  /// `sheetRows`: the phone sheet "This feed", one row per item with its mark.
  static List<FeedSheetRow> sheetRows(List<LearnItem> items, Map<String, FeedItemState> states, [int base = 0]) => [
    for (final (i, item) in items.indexed) _row(item, states[item.id] ?? const FeedItemState(), base + i + 1),
  ];

  static FeedSheetRow _row(LearnItem item, FeedItemState st, int n) {
    final FeedRowMark? mark;
    final String kind;
    final String words;
    switch (item) {
      case LearnCardItem(:final card):
        mark = st.kept ? FeedRowMark.kept : (st.seen ? FeedRowMark.seen : null);
        kind = 'Key card';
        words = card.front;
      case LearnQuestionItem(:final question):
        final res = st.res;
        mark = res != null ? (res.correct ? FeedRowMark.right : FeedRowMark.wrong) : (st.skipped != null ? FeedRowMark.seen : null);
        kind = item.isMistake ? 'Old mistake' : 'Question';
        words = question.body;
      case LearnLessonItem():
        mark = null;
        kind = 'Question';
        words = '';
    }
    return FeedSheetRow(id: item.id, n: n, kind: kind, words: words.replaceAll(_blanks, '___').replaceAll(_spaces, ' ').trim(), mark: mark);
  }

  // ---------------------------------------------------------------- the end (ChapterFeed.jsx)

  static final RegExp _minutesOn = RegExp(r'^.*?\bminutes?\s+on\s+', caseSensitive: false);

  /// The end's chapter title (`endTitle`): the end's chapter, else the run's chapter title, else the title of
  /// "10 minutes on X", else "This feed".
  static String endTitle({String? endChapterTitle, String? runTitle, String? feedTitle, String? endTitle}) {
    if (endChapterTitle != null && endChapterTitle.isNotEmpty) return endChapterTitle;
    if (runTitle != null && runTitle.isNotEmpty) return runTitle;
    final said = (feedTitle != null && feedTitle.isNotEmpty ? feedTitle : (endTitle ?? '')).replaceFirst(_minutesOn, '');
    return said.isNotEmpty ? said : FeedCopy.endTitleFallback;
  }

  static final RegExp _allFixed = RegExp(r'^(\d+) old mistakes?$');
  static final RegExp _someFixed = RegExp(r'^(\d+) of (\d+) old mistakes?$');

  /// The end's lines in A1's order (`endLines`): Cards (from this phone: seen and kept), then the server's lines with
  /// its "Fixed" said as "Old mistakes: 2 of 2 fixed".
  static List<FeedEndLine> endLines(List<({String label, String text})> lines, {required int seen, required int kept, required bool hasCards}) {
    final out = <FeedEndLine>[];
    if (hasCards && (seen > 0 || kept > 0)) out.add((label: 'Cards', text: '${math.max(seen, kept)} seen, $kept kept'));
    for (final l in lines) {
      if (l.label == 'Fixed') {
        final all = _allFixed.firstMatch(l.text);
        final some = _someFixed.firstMatch(l.text);
        out.add((
          label: 'Old mistakes',
          text: all != null ? '${all.group(1)} of ${all.group(1)} fixed' : (some != null ? '${some.group(1)} of ${some.group(2)} fixed' : l.text),
        ));
      } else {
        out.add((label: l.label, text: l.text));
      }
    }
    return out;
  }

  static final RegExp _keptLead = RegExp(r'^\d+ kept\.\s*');

  /// The kept pile's line without its count ("They are first in Revise."), null when nothing is left.
  static String? pileLine(String? line) {
    final rest = (line ?? '').replaceFirst(_keptLead, '');
    return rest.isEmpty ? null : rest;
  }

  /// "Stop for now?"'s detail: questions right, old mistakes fixed, kept in Revise; null when there is nothing to say.
  static String? stopDetail(FeedNumbers n) {
    final parts = [
      if (n.answered > 0) FeedCopy.questionsRight(n.right, n.answered),
      if (n.mistakes > 0) FeedCopy.mistakesFixed(n.fixed, n.mistakes),
      if (n.kept > 0) FeedCopy.keptInRevise(n.kept),
    ];
    return parts.isEmpty ? null : parts.join(' ');
  }

  /// Items done for the stop rule: a card once its back was read or it was kept, a question once it was graded.
  static int itemsDone(List<LearnItem> items, Map<String, FeedItemState> states, {int base = 0}) {
    var n = base;
    for (final item in items) {
      final st = states[item.id] ?? const FeedItemState();
      if (item is LearnCardItem) {
        if (st.seenBack || st.kept) n += 1;
      } else if (st.res != null) {
        n += 1;
      }
    }
    return n;
  }
}
