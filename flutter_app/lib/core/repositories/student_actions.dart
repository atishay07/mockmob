import 'package:flutter_riverpod/flutter_riverpod.dart';

/// How many real actions the student has taken since the app started: a set or a mock that was
/// submitted and scored. It counts only what happened in this run (it starts at 0), so a feature
/// can say "after the first action of this session" without reading the whole record.
class StudentActions extends Notifier<int> {
  @override
  int build() => 0;

  /// A set or a mock was submitted and the server's answer came back.
  void submitted() => state = state + 1;
}

final studentActionsProvider = NotifierProvider<StudentActions, int>(StudentActions.new);

/// Whether the student finished onboarding (sealed their plan) in this run of the app. Like
/// [studentActionsProvider] it starts false on every cold start. The first-session Pro pop-up (as on
/// the website, where onboarding marks it as it finishes) treats the run in which onboarding finished
/// as the student's first usage session; a student who signed straight in never sets it.
class OnboardedThisRun extends Notifier<bool> {
  @override
  bool build() => false;

  /// The student sealed their onboarding plan.
  void sealed() => state = true;
}

final onboardedThisRunProvider = NotifierProvider<OnboardedThisRun, bool>(OnboardedThisRun.new);
