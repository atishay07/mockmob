import '../../core/router/action_router.dart';
import '../../core/router/routes.dart';

/// The insights feature's in-app paths. The integrator binds them in `router.dart` (see
/// `insights_routes.dart`) and adds them to `AppRoutes.templates`.
abstract final class InsightsPaths {
  /// Your record: ledger, findings, trend, chapters, pace, week, subjects.
  static const String insights = '/review/insights';

  /// Saved questions.
  static const String saved = '/review/saved';

  /// The question stream (website Explore): `?subject=&chapter=&difficulty=`.
  static const String stream = '/practice/stream';

  /// Ask your record.
  static const String ask = '/ask';

  static String streamFor({String? subject, String? chapter, String? difficulty}) {
    final q = {'subject': ?subject, 'chapter': ?chapter, 'difficulty': ?difficulty};
    return q.isEmpty ? stream : Uri(path: stream, queryParameters: q).toString();
  }

  /// The saved questions in the same stream, one at a time, starting at [questionId].
  static String savedStreamFrom(String? questionId) =>
      Uri(path: stream, queryParameters: {'source': 'saved', 'start': ?questionId}).toString();

  /// Chapter practice for one chapter, through setup so the cost shows before anything starts.
  static String practiseChapter(String subject, String chapter) =>
      Uri(path: AppRoutes.practiceSetup('chapter'), queryParameters: {'subject': subject, 'chapter': chapter}).toString();

  /// Maps a web href from the server (a finding's action, a reply's action) to an in-app
  /// location, or null when the app cannot or must not open it (pricing, other domains).
  static String? locationFor(String href) {
    final uri = Uri.tryParse(href.trim());
    if (uri != null && !uri.hasScheme) {
      switch (uri.path) {
        case '/review':
          return AppRoutes.review;
        case '/saved':
          return saved;
        case '/explore':
          return stream;
        case '/analytics' || '/mentor':
          return uri.queryParameters['tab'] == 'ask' ? ask : insights;
      }
    }
    return switch (ActionRouter.resolve(href)) {
      NativeTarget(:final location) => location,
      _ => null,
    };
  }
}
