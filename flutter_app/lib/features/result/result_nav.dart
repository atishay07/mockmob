import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../core/domain/domain.dart';
import '../../core/router/routes.dart';
import 'model/recap_model.dart';
import 'model/subject_names.dart';

/// Where the result feature sends the student. One place, so every key goes to a real route.
abstract final class ResultNav {
  /// The full result, optionally opened at question [question] (1-based).
  static String fullResult(String attemptId, {int? question}) {
    final base = AppRoutes.result(attemptId);
    return question == null ? base : '$base?q=$question';
  }

  static void toFullResult(BuildContext context, String attemptId, {int? question}) =>
      context.go(fullResult(attemptId, question: question));

  /// Mistake Repair for the first [mistakes] candidates. The repair flow reads `count` (how many
  /// mistakes the chosen duration holds) and `minutes`.
  static String repair(RecapModel m, {int? minutes}) {
    final first = m.candidates.first;
    final option = repairDurationOptions(m.candidates.length).where((o) => o.minutes == minutes).firstOrNull;
    final count = option?.mistakes ?? m.candidates.length;
    final mins = minutes ?? repairMinutes(count);
    return Uri(
      path: AppRoutes.reviewRepair(m.attemptId, first.questionId),
      queryParameters: {'count': '$count', 'minutes': '$mins'},
    ).toString();
  }

  /// Quick practice on one chapter (for a chapter whose loss was blanks only).
  static String practiseChapter(RecapModel m, String chapter) => Uri(
    path: AppRoutes.practiceSetup('chapter'),
    queryParameters: {'subject': publicSubjectId(m.subjectId), 'chapter': chapter},
  ).toString();
}
