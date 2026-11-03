import '../../../core/router/routes.dart';
import '../data/guest_sample.dart';
import '../data/sample_questions.dart';

/// Where "Try 5 questions" or "Continue the sample" should land: the subject step for a fresh
/// start, the first unanswered question part way through, the result once all five are answered.
String sampleEntryRoute(GuestSample guest) {
  if (!guest.hasStarted) return AppRoutes.onboardingSubject;
  final next = guest.firstUnanswered(kSampleQuestionIds);
  return next == null ? AppRoutes.onboardingSampleResult : AppRoutes.onboardingSample(next);
}

/// Where a chosen subject leads: the first unanswered question, or the result when the sample
/// is already finished.
String afterSubjectRoute(GuestSample guest) {
  final next = guest.firstUnanswered(kSampleQuestionIds);
  return next == null ? AppRoutes.onboardingSampleResult : AppRoutes.onboardingSample(next);
}
