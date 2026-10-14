import '../../core/router/routes.dart';

/// Learn's own in-app paths that `AppRoutes` does not carry yet. The integrator binds them in
/// `router.dart` under the `/learn` page, before `:unitId` (see `learn_routes.dart`).
abstract final class LearnPaths {
  /// The chapter reader: `/learn/summary/:subject/:chapter`.
  static const String summaryTemplate = 'summary/:subject/:chapter';

  static String summary(String subject, String chapter) =>
      '${AppRoutes.learn}/summary/${Uri.encodeComponent(subject)}/${Uri.encodeComponent(chapter)}';

  /// Chapter practice through setup, so the cost shows before anything starts.
  static String practiseChapter(String subject, String chapter) => Uri(
    path: AppRoutes.practiceSetup('chapter'),
    queryParameters: {'subject': subject, 'chapter': chapter},
  ).toString();
}
