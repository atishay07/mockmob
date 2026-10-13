/// What other features may use from the onboarding: the student's sealed sheet (stage, course,
/// colleges with real CSAS 2026 figures, subjects and confidence, worry, rhythm and the first
/// move), whether it was written to the account, and two ready-made widgets for Today.
///
/// ```dart
/// final sheet = ref.watch(studentSheetProvider);   // null until a sheet is sealed
/// final move = sheet?.firstMove;                   // move.route opens the starting-point Quick 10
/// final saved = ref.watch(sheetSyncProvider).phase; // saved only after the server acknowledged
/// ```
library;

export 'data/calendar.dart' show CuetCalendar;
export 'data/du_catalog.dart' show DuCatalog, DuCourse, DuOffering;
export 'data/subjects.dart' show Confidence, SheetSubject;
export 'model/choices.dart' show AgeAnswer, Stage, StudyTime, Worry;
export 'model/plan.dart' show FirstMove, PlanSummary;
export 'state/answers_controller.dart' show onboardingAnswersProvider;
export 'state/sheet_sync.dart' show SheetSyncPhase, SheetSyncState, sheetSyncProvider;
export 'state/student_sheet.dart' show SheetCollege, StudentSheet, studentSheetProvider;
export 'widgets/first_move_hero.dart' show FirstMoveHero;
export 'widgets/sheet_status.dart' show SheetStatus;
