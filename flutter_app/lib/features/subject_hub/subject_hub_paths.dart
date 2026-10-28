import '../../core/router/routes.dart';

/// The subject hub's own in-app paths, which `AppRoutes` does not carry yet. The integrator binds
/// them in `router.dart` inside the `/practice` branch (see `subject_hub_routes.dart`).
abstract final class SubjectHubPaths {
  /// The route's template under the Practice tab: `/practice/subject/:subject`.
  static const String template = 'subject/:subject';

  /// The path template for `AppRoutes.templates`.
  static const String fullTemplate = '${AppRoutes.practice}/subject/:subject';

  /// The hub of one subject. [subjectId] is the public id (`business_studies`); the website's
  /// slug (`business-studies`) is read the same way.
  static String of(String subjectId) => '${AppRoutes.practice}/subject/${Uri.encodeComponent(subjectId)}';

  /// The native path of a website subject hub (`/cuet/business-studies`), or null for any other
  /// website path. For the ActionRouter's website-link table.
  static String? fromWebPath(String path) {
    final match = RegExp(r'^/cuet/([a-z0-9-]{1,40})/?$').firstMatch(path);
    if (match == null) return null;
    return of(match.group(1)!.replaceAll('-', '_'));
  }

  /// Practice in the whole subject, through the setup page so the cost shows before anything
  /// starts.
  static String practise(String subjectId) =>
      Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'subject': subjectId}).toString();

  /// Practice in one chapter, through the setup page.
  static String practiseChapter(String subjectId, String chapter) =>
      Uri(path: AppRoutes.practiceSetup('chapter'), queryParameters: {'subject': subjectId, 'chapter': chapter}).toString();
}
