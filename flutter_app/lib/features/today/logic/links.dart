// In-app locations Today opens. Built from AppRoutes, never from string literals elsewhere.
import '../../../core/router/routes.dart';
import 'subjects.dart';

abstract final class TodayLinks {
  /// Quick practice started straight from Today (no setup screen).
  static String quick({String? subject, int count = 10, String? chapter, String? purpose}) => Uri(
        path: AppRoutes.practiceStart,
        queryParameters: {
          'mode': chapter == null ? 'quick' : 'chapter',
          if (subject != null) 'subject': canonicalSubject(subject),
          'count': '$count',
          'chapter': ?chapter,
          'purpose': ?purpose,
        },
      ).toString();

  /// A full mock goes through setup for the pre-start sheet.
  static String fullMock({String? subject}) => subject == null
      ? AppRoutes.practiceSetup('full')
      : Uri(path: AppRoutes.practiceSetup('full'), queryParameters: {'subject': canonicalSubject(subject)}).toString();

  /// Repair starts on the first mistake; `count` is how many the chosen duration holds.
  static String repair(String attemptId, String questionId, int count) =>
      '${AppRoutes.reviewRepair(attemptId, questionId)}?count=$count';

  static String why(String attemptId) => AppRoutes.todayWhy(attemptId);

  /// Smart practice started straight from Today (Pro): questions from the weak chapters.
  static String smart({String? subject, int count = 10}) => Uri(
        path: AppRoutes.practiceStart,
        queryParameters: {'mode': 'smart', if (subject != null) 'subject': canonicalSubject(subject), 'count': '$count'},
      ).toString();

  /// Today's Revise round.
  static const String revise = AppRoutes.reviewRevise;

  /// The repair record in Review (the done state's "Open the repair").
  static const String repairRecord = AppRoutes.reviewRecord;
}
