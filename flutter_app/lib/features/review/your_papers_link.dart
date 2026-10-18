import '../../core/router/routes.dart';

/// The query parameter that names the paper Your papers opens on (G20, D106).
const String yourPapersFocusParam = 'paper';

/// Where "See it in Your papers" goes from a result: Your papers with this paper's row brought into
/// view and marked for a moment. One place builds it, so when Your papers moves (D105 puts it
/// inside Practice) only this line and the route that reads [yourPapersFocusParam] change.
String yourPapersLocation(String attemptId) =>
    Uri(path: AppRoutes.review, queryParameters: {yourPapersFocusParam: attemptId}).toString();
