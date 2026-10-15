/// The words of You's editors: subjects, the sheet, the week, the name and the plan card. Same
/// binding rules as [YouCopy]: sentence case, no exclamation successes, "Saved" only after the
/// server answered, phone-only choices called "kept on this phone".
library;

import '../../core/copy/copy.dart';

/// A category as a row or option title: the words a student says, first letter capitalised
/// ("Unreserved", "Sikh minority"). The stored value stays the portal code.
String categoryTitle(String? category) => categoryWordsTitle(category);

abstract final class EditCopy {
  // Subjects editor (WEB-PARITY F1).
  static const subjectsTitle = 'Your subjects';
  static const subjectsHint = 'Up to five, like the exam.';
  static String subjectsCount(int n) => '$n of 5 chosen';
  static const subjectsCap = 'Five is the most. Remove one to add another.';
  static const subjectsNeedOne = 'Keep at least one subject.';
  static const subjectsSave = 'Save subjects';
  static const subjectsUnchanged = 'Pick or remove a subject to save.';
  static const subjectsProfileLoading = 'Loading your profile. Save turns on once it has.';
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
  static const sheetTitle = 'Your plan';
  static const sheetIntro = 'Change anything. Today plans from it.';
  static const editSheet = 'Edit';
  static const editSheetLabel = 'Edit your plan';
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
  static const phoneOnly = 'Setup answers stay on this phone. Your name, subjects and study week are saved to your account.';
  static String confidenceValue(int rated, int total) => '$rated of $total rated';

  // Choice sheets.
  static const stageSheet = 'Where are you on the road to CUET?';
  static const courseSheet = 'Which course are you aiming for?';
  static const courseNote = 'Changing the course clears your colleges, because they belong to a course.';
  static String courseConfirmTitle(int n) => n == 1 ? 'Remove your college?' : 'Remove your $n colleges?';
  static String courseConfirmBody(String course, String colleges) =>
      'Colleges belong to a course. Switching to $course removes $colleges.';
  static const courseConfirmUndo = 'You can undo it right after.';
  static const courseKeep = 'Keep course';
  static const courseChange = 'Change course';
  static String courseChanged(int n) => n == 1 ? 'Course changed. Your college was removed.' : 'Course changed. Your $n colleges were removed.';
  static const courseUndo = 'Undo';
  static const courseRestored = 'Your course and colleges are back.';
  static const collegesSheet = 'Your colleges, in order';
  static String collegesNote(String category) =>
      'Pick up to three. Figures are Round 1 minimum scores, 2026, for ${categoryWords(category)}, out of 1000.';
  static const collegesNeedCourse = 'Pick a course first. Colleges belong to a course.';
  static const collegesCap = 'Three is the most. Remove one to add another.';
  static const noSeat = 'No seat in Round 1, 2026';
  static const categorySheet = 'Which category should college figures use?';
  static const categoryNote = 'Only changes the figures you see. It stays on this phone.';
  static const confidenceSheet = 'How solid does each subject feel?';
  static const confidenceNote = 'Your own guess is enough. Today starts with the shakiest.';
  static const worrySheet = 'What costs you the most marks?';
  static const done = 'Done';
  static const keptOnPhone = 'Kept on this phone.';

  // The week.
  static const weekDays = 'Study days';
  static String weekDaysCount(int n) => n == 1 ? '1 day a week' : '$n days a week';
  static const weekTime = 'Time of day';
  static const weekLength = 'Usual length';
  static String minutesLabel(int m) => '$m min';
  static const weekNote = 'How many days becomes your weekly goal. The time sets when reminders come.';
  static const weekSave = 'Save your week';
  static const weekUnchanged = 'Change a day, time or length to save.';
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
  static const nameNote = 'Shown on your plan.';
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
  static String credits(int n) => n == 1 ? '1 Practice credit' : '$n Practice credits';
  static const creditsUnknown = 'Practice credits did not load.';
  static const creditsRetry = 'Try again';
  static const creditsRetrying = 'Trying again';
  static const unlimited = 'Unlimited practice';
  static const otherDevicesNote = 'Ends MockMob on other phones and the website. You stay signed in here.';
  static const planOverline = 'Your plan';
  static const creditUnit = 'Practice credits';
  static const creditUnitOne = 'Practice credit';
  static const proActive = 'Pro is active.';
  static String proUntil(String date) => 'Pro is active until $date.';
}
