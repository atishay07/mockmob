import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../../core/mascot/mascot.dart';
import '../model/answer_items.dart';

/// Mobi's reaction to the answer the student has just opened on the full result: a wrong or blank
/// one gets an encouraging nod and then Mobi holds a point at the row (come and look); a right
/// one gets the small correct hop and a glance. One act per [gap]: opening five rows in a row
/// reads as browsing, not as five reactions.
///
/// Held answers (the key is being checked) get nothing. When [allowed] is false (Celebrations on
/// Quiet or Off, reduced motion, an NTA result) nothing plays at all and Mobi keeps its reading
/// pose; the screen's words say everything the act would.
class AnswerReactor {
  AnswerReactor(this.controller, {DateTime Function()? now}) : _now = now ?? DateTime.now;

  final MobiController controller;
  final DateTime Function() _now;

  /// One act per this long.
  static const Duration gap = Duration(milliseconds: 2500);

  DateTime? _last;
  Timer? _follow;

  /// Reacts to [verdict]; [row] is the opened row, which Mobi turns toward. Returns whether an act
  /// was played.
  bool react(Verdict verdict, {GlobalKey? row, bool allowed = true}) {
    if (!allowed || verdict == Verdict.held) return false;
    final at = _now();
    final last = _last;
    if (last != null && at.difference(last) < gap) return false;
    _last = at;
    _follow?.cancel();
    switch (verdict) {
      case Verdict.wrong || Verdict.blank:
        controller.play(MobiAct.encourage);
        final ms = (MobiMoves.duration(MobiAct.encourage) * 1000).round();
        _follow = Timer(Duration(milliseconds: ms), () {
          if (row != null) controller.pointAtWidget(row);
        });
      case Verdict.correct:
        controller.play(MobiAct.correct);
        if (row != null) controller.glanceAtWidget(row);
        final ms = (MobiMoves.duration(MobiAct.correct) * 1000).round();
        // Back to reading the sheet once the hop is done.
        _follow = Timer(Duration(milliseconds: ms), () => controller.play(MobiAct.read));
      case Verdict.held:
        return false;
    }
    return true;
  }

  void dispose() => _follow?.cancel();
}
