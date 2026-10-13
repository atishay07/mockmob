/// The words of You's editors: subjects, the sheet, the week, the name and the plan card. Same
/// binding rules as [YouCopy]: sentence case, no exclamation successes, "Saved" only after the
/// server answered, phone-only choices called "kept on this phone".
library;

import '../../core/copy/copy.dart';

abstract final class EditCopy {
  // Subjects editor (WEB-PARITY F1).
  static const subjectsTitle = 'Your subjects';
  static const subjectsMobi = 'Five at most, like the exam. Pick the papers you will write.';
  static String subjectsCount(int n) => '$n of 5 chosen';
  static const subjectsCap = 'Five is the most. Remove one to add another.';
  static const subjectsNeedOne = 'Keep at least one subject.';
  static const subjectsSave = 'Save subjects';
  static const subjectsUnchanged = 'Change a subject to save.';
  static const subjectsMobiSaved = 'Done. Practice and Today follow these now.';
  static String subjectsSaved(DateTime at) => 'Subjects saved at ${formatTime12(at)}. Practice and Today now use them.';
  static const subjectsOffline = 'You are offline. Your subjects were not changed. Try again when you are connected.';
  static const subjectsRejected = 'That set was not accepted. Choose up to five listed subjects.';
  static const subjectsFailed = 'We could not save your subjects. Nothing was changed. Try again.';
  static const subjectsFallback =
      'We could not load the latest list, so this is the usual one. Your choice is checked when you save.';
  static const staleHeading = 'On your profile, but practice cannot open these';
  static const staleNoReason = 'Practice is not open for this subject.';
  static const remove = 'Remove';
  static String chosenLabel(String name, bool chosen) => chosen ? '$name, chosen' : name;

  // The sheet editor.
  static const sheetTitle = 'Your sheet';
  static const sheetIntro = 'This is what you told me in setup. Change anything and Today plans from it.';
  static const editSheet = 'Edit';
  static const editSheetLabel = 'Edit your sheet';
  static const groupAbout = 'About you';
  static const groupTarget = 'Your target';
  static const groupSubjects = 'Subjects';
  static const groupWeek = 'Your week';
  static const rowName = 'Name';
  static const rowStage = 'Where you are';
  static const rowCourse = 'Course';
  static const rowColleges = 'Colleges';
  static const rowCategory = 'Category for college figures';
  static const rowSubjects = 'Subjects';
  static const rowConfidence = 'How solid each feels';
  static const rowWorry = 'What costs you marks';
  static const notSet = 'Not set';
  static const courseNotSure = 'Not sure yet';
  static const phoneOnly =
      'Where you are, your course, colleges, category, how solid each subject feels and what costs '
      'you marks are kept on this phone. Your name, subjects, study days and study time are saved to '
      'your account, and the usual length too while lessons are open.';
  static String confidenceValue(int rated, int total) => '$rated of $total rated';

  // Choice sheets.
  static const stageSheet = 'Where are you on the road to CUET?';
  static const courseSheet = 'Which course are you aiming for?';
  static const courseNote = 'Changing the course clears your colleges, because they belong to a course.';
  static const collegesSheet = 'Your colleges, in order';
  static String collegesNote(String category) =>
      'Pick up to three. Figures are the CSAS 2026 Round 1 minimum for $category, out of 1000. '
      'They are last year\'s, not a promise for 2027.';
  static const collegesNeedCourse = 'Pick a course first. Colleges belong to a course.';
  static const collegesCap = 'Three is the most. Remove one to add another.';
  static const noSeat = 'No Round 1 seat';
  static const categorySheet = 'Which category should college figures use?';
  static const categoryNote = 'Only changes the figures you see. It stays on this phone.';
  static const confidenceSheet = 'How solid does each subject feel?';
  static const confidenceNote = 'Your own guess is enough. Today starts with the shakiest.';
  static const worrySheet = 'What costs you the most marks?';
  static const done = 'Done';
  static const keptOnPhone = 'Kept on this phone.';

  // The week.
  static const weekDays = 'Study days';
  static const weekTime = 'Time of day';
  static const weekLength = 'Usual length';
  static String minutesLabel(int m) => '$m min';
  static const weekNote = 'How many days becomes your weekly goal. The time sets when reminders come.';
  static const weekSave = 'Save your week';
  static String weekSaved(DateTime at, int days, String plural, String time) =>
      'Week saved at ${formatTime12(at)}. Goal: ${days == 1 ? '1 day' : '$days days'} a week, $plural from $time.';
  static const weekOffline = 'You are offline. Your week was not changed. Try again when you are connected.';
  static const weekFailed = 'We could not save your week. Nothing was changed. Try again.';
  static const weekTimeFailed = 'Your study days were saved. The study time was not. Try again.';
  static const weekLengthFailed = 'Your days and time were saved. The usual length was not saved to your account. Try again.';
  static const weekGoalUnknown = 'We could not check your current goal, so nothing was changed. Try again.';
  static String dayLabel(String day, bool chosen) => chosen ? '$day, study day' : '$day, rest day';

  // Name (WEB-PARITY F2).
  static const nameSheet = 'Your name';
  static const nameNote = 'How it shows on your sheet. 1 to 80 characters.';
  static const nameSave = 'Save name';
  static const nameEmpty = 'Write a name first.';
  static const nameTooLong = 'Keep it to 80 characters.';
  static String nameSaved(DateTime at) => 'Name saved at ${formatTime12(at)}.';
  static const nameOffline = 'You are offline. Your name was not changed.';
  static const nameFailed = 'We could not save your name. Nothing was changed. Try again.';
  static const nameAdd = 'Add your name';
  static const nameEdit = 'Edit';
  static String nameRowLabel(String? name) => name == null ? 'Name, not set. Add your name' : 'Name, $name. Edit';

  // Plan card (WEB-PARITY F3). No price, no purchase.
  static const planFree = 'Free';
  static const planPro = 'Pro';
  static String credits(int n) => n == 1 ? '1 practice credit' : '$n practice credits';
  static const creditsUnknown = 'Credit balance not loaded';
  static const unlimited = 'Unlimited practice';
  static const planOverline = 'Your plan';
  static const creditUnit = 'practice credits';
  static const creditUnitOne = 'practice credit';
  static const proActive = 'Pro is active.';
  static String proUntil(String date) => 'Pro is active until $date.';
  static const manage = 'Plans are managed on mockmob.in. Pro bought there works here.';
}
