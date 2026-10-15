/// The one time rule for a finished paper: a port of the time part of the website's
/// `data/paper_trace.js` (`recordOf` and `readTrace`), the calculator every result reads time from.
/// The server builds the result's time read with it (`lab.time`); this port is for a screen that has
/// no such read, so the app and the site never count the same record two ways.
///
/// The record is what the server kept of the device's events (`selectionMeta.recovery`):
/// `timeline` (visits and answers), `marks`, `presence` (away and back), `strikes` and `end`. The rule:
///  1. The interval from one event to the next is credited to the question on screen: the one the
///     last visit or answer named. A mark or a strike-out on another question never moves time.
///  2. Time away from the paper is not counted: from an away to the next event of any kind.
///  3. With an end event, the last question runs to the end. Without one, the time after the last
///     event is not in the record.
///  4. Only when the record has no away or back data at all, a gap over 30 minutes is skipped as a
///     break (an app left open). With away data the device said when the student left.
///  5. A visit with via `set` (the website shows a passage set on one page) is a question shown with
///     its set: opened, never time. The question in focus keeps the time.
///  6. A visit with via `sheet` is the submit page (or sheet) opening over the question in focus:
///     until the next visit or answer no question is on screen and the time is credited to none.
/// A record from before slice 2 (visits and answers only) gets the numbers it always got on the site.
///
/// Pure: no I/O, no clock.
library;

import '../models/json_helpers.dart';

abstract final class TraceRules {
  /// Rule 4: a break, only when the record has no away or back data.
  static const maxGapMs = 30 * 60 * 1000;
}

const _extraTypes = {'mark', 'strike', 'away', 'back', 'end'};

/// The time part of a paper's trace.
class PaperTime {
  const PaperTime({required this.eventCount, required this.dwellMs, required this.awayKnown, required this.hasEnd});

  /// Every event of the record (visits, answers, marks, away and back, strike-outs, the end).
  final int eventCount;

  /// Milliseconds on each question under the rule, for questions that got any interval at all.
  final Map<String, double> dwellMs;

  /// The record holds away or back events (rule 4 is then off).
  final bool awayKnown;

  /// The record ends with an end event (rule 3).
  final bool hasEnd;
}

class _Ev {
  _Ev(this.qid, this.at, this.seq, this.type, this.order, [this.via]);

  final String qid;
  final double at;
  final int seq;
  final String type;
  final String? via;

  bool get isSet => type == 'visit' && via == 'set';
  bool get isSheet => type == 'visit' && via == 'sheet';

  /// A visit or an answer that puts its question in focus (rule 1).
  bool get isFocus => (type == 'answer' || type == 'visit') && !isSet && !isSheet;

  /// Position before sorting: equal clocks and sequences keep it, as the site's stable sort does.
  final int order;
}

/// Reads [input]: a recovery object (`{timeline, marks, presence, strikes, end}`) or a bare
/// timeline list, as the site's `readTrace` takes either.
PaperTime readPaperTime(Object? input) {
  final rec = input is List ? <String, dynamic>{'timeline': input} : (input is Map ? asJson(input) : const <String, dynamic>{});
  var order = 0;
  List<_Ev> list(Object? v, bool Function(Json e) keep, String Function(Json e) typeOf) => [
        for (final e in asJsonList(v))
          if (_okEvent(e) && keep(e)) _Ev(asString(e['qid'])!, asDouble(e['at'])!, asInt(e['seq']) ?? 0, typeOf(e), order++, asString(e['via'])),
      ];
  int byClock(_Ev a, _Ev b) {
    final at = a.at.compareTo(b.at);
    if (at != 0) return at;
    final seq = a.seq.compareTo(b.seq);
    return seq != 0 ? seq : a.order.compareTo(b.order);
  }

  final timeline = list(rec['timeline'], (e) => !_extraTypes.contains(e['type']), (e) => asStringOr(e['type'], ''))..sort(byClock);
  // The merge keeps the site's order for ties: the timeline first, then marks, presence, strikes.
  order = 0;
  final ordered = [for (final e in timeline) _Ev(e.qid, e.at, e.seq, e.type, order++, e.via)];
  final marks = list(rec['marks'], (e) => e['marked'] is bool, (_) => 'mark');
  final presence = list(rec['presence'], (e) => e['type'] == 'away' || e['type'] == 'back', (e) => e['type'] as String);
  final strikes = list(rec['strikes'], (e) => e['option'] is int && e['on'] is bool, (_) => 'strike');
  final events = [...ordered, ...marks, ...presence, ...strikes]..sort(byClock);
  final rawEnd = rec['end'];
  final end = rawEnd is Map && _okEvent(asJson(rawEnd)) ? asJson(rawEnd) : null;
  if (end != null) {
    // The end is the last event by definition (the server keeps it only then); a stray earlier clock is clamped.
    final at = asDouble(end['at'])!;
    final lastAt = events.isEmpty ? 0.0 : events.last.at;
    events.add(_Ev(asString(end['qid'])!, at > lastAt ? at : lastAt, asInt(end['seq']) ?? 0, 'end', order++));
  }

  final awayKnown = presence.isNotEmpty;
  final dwell = <String, double>{};
  var awayOpen = false;
  var sheet = false;
  String? onScreen;
  for (var i = 0; i < events.length; i++) {
    final e = events[i];
    if (e.isSheet) {
      sheet = true;
    } else if (e.isFocus) {
      onScreen = e.qid;
      sheet = false;
    }
    // Rule 1: the question named by the last visit or answer. Rule 6: none while the submit page is
    // open. Rule 5: a set shown before any question is in focus owns nothing.
    final owner = sheet ? null : onScreen ?? (e.isSet || e.isSheet ? null : e.qid);
    if (e.type == 'away') {
      awayOpen = true;
    } else if (awayOpen) {
      awayOpen = false;
    }
    if (i + 1 >= events.length || e.type == 'end') continue;
    final gap = events[i + 1].at - e.at;
    if (awayOpen) continue; // rule 2
    if (owner == null) continue; // rules 5 and 6: time on no question
    if (!awayKnown && gap > TraceRules.maxGapMs) continue; // rule 4
    if (gap >= 0) dwell[owner] = (dwell[owner] ?? 0) + gap; // rule 1
  }
  return PaperTime(eventCount: events.length, dwellMs: dwell, awayKnown: awayKnown, hasEnd: end != null);
}

bool _okEvent(Json e) {
  final qid = e['qid'];
  final at = e['at'];
  return qid is String && qid.isNotEmpty && at is num && at.isFinite;
}
