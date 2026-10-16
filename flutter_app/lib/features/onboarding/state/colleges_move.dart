import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../tools/data/my_colleges_actions.dart' show MyCollegesStatus, myCollegesProvider;
import '../model/answers.dart';
import 'answers_controller.dart';

/// Where the colleges picked in the onboarding stand once the student has signed in: they move
/// into the My colleges list on the account (the Colleges tab's list), one at a time, and only the
/// server's own list can say they arrived.
enum CollegesMove {
  /// The sheet has no colleges (or no course): there is nothing to move or to say.
  none,

  /// Not on the server list yet, and nothing has gone wrong: the move is running or about to.
  /// Nothing is claimed.
  pending,

  /// Every pick is on the server's list for this account.
  moved,

  /// The server could not be reached or refused a pick: the colleges are still on this phone and
  /// move when it works again.
  later,
}

/// The state of the move for the signed-in account. Saved is said about the colleges only when this
/// is [CollegesMove.moved] (R17: "saved" means the server confirmed it).
final collegesMoveProvider = Provider<CollegesMove>((ref) {
  final OnboardingAnswers? answers = ref.watch(onboardingAnswersProvider).value;
  final course = answers?.course;
  if (answers == null || course == null || answers.colleges.isEmpty) return CollegesMove.none;
  final view = ref.watch(myCollegesProvider);
  switch (view.status) {
    case MyCollegesStatus.signedOut:
    case MyCollegesStatus.loading:
      return CollegesMove.pending;
    case MyCollegesStatus.failed:
      return CollegesMove.later;
    case MyCollegesStatus.ready:
      // A copy kept on the phone is not the server's word.
      if (view.stale) return CollegesMove.later;
      final onServer = {for (final c in view.colleges) if (c.programmeId == course.id) c.college};
      final landed = answers.colleges.every((name) {
        final offering = course.offeringAt(name);
        return offering != null && onServer.contains(offering.college);
      });
      if (landed) return CollegesMove.moved;
      if (view.busy) return CollegesMove.pending;
      return view.notice.isNotEmpty ? CollegesMove.later : CollegesMove.pending;
  }
});
