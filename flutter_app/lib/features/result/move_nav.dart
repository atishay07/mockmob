import '../../core/router/routes.dart';
import 'model/next_move.dart';

/// Where the result's next move and its alternative lead, as app locations. One place, so the practice result and the
/// full mock result send a student to the same screen for the same move.
abstract final class MoveNav {
  /// The volt key's location. A repair opens that one mistake's repair; a check opens the saved repair, where Check
  /// it held lives (a repaired mistake never offers a paid repair again); a chapter set starts through the auto-start
  /// route with its cost confirmed there; a harder paper opens the setup.
  static String forMove(ResultMove m, {required String attemptId, required String subject}) => switch (m.kind) {
    MoveKind.repair => Uri(path: AppRoutes.reviewRepair(attemptId, m.qid!), queryParameters: const {'count': '1'}).toString(),
    MoveKind.check => AppRoutes.reviewRepair(attemptId, m.qid!),
    MoveKind.practise => practise(subject: subject, chapter: m.chapter),
    MoveKind.harder => harder(subject: subject, mock: m.label.contains('mock')),
  };

  /// The alternative's location; null for one with nowhere to go.
  static String? forAlt(MoveAlt a, {required String attemptId, required String subject, bool mock = false}) => switch (a.kind) {
    AltKind.repair => a.qid == null ? null : Uri(path: AppRoutes.reviewRepair(attemptId, a.qid!), queryParameters: const {'count': '1'}).toString(),
    AltKind.practise => practise(subject: subject, chapter: a.chapter),
    AltKind.paper => mock ? Uri(path: AppRoutes.practiceSetup('full'), queryParameters: {'subject': subject}).toString() : practise(subject: subject),
    AltKind.credits => AppRoutes.youCredits,
  };

  /// "Practise 10 on {chapter}", or 10 in the subject.
  static String practise({required String subject, String? chapter}) => Uri(
    path: AppRoutes.practiceStart,
    queryParameters: {
      'mode': chapter == null ? 'quick' : 'chapter',
      'subject': subject,
      'count': '${NextMoveRules.setSize}',
      'chapter': ?chapter,
    },
  ).toString();

  static String harder({required String subject, required bool mock}) => mock
      ? Uri(path: AppRoutes.practiceSetup('full'), queryParameters: {'subject': subject, 'difficulty': 'hard'}).toString()
      : Uri(
          path: AppRoutes.practiceStart,
          queryParameters: {'mode': 'quick', 'subject': subject, 'count': '${NextMoveRules.setSize}', 'difficulty': 'hard'},
        ).toString();
}
