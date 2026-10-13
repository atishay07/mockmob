/// Public surface of the rhythm feature for other modules (Today, Result, Review, You).
///
/// - Today: `WeekStripSection`, `WeeklyEndingSection`, `ReturningSection`, `CelebrationSlot`.
/// - Result and Review: `celebrationControllerProvider` with `CelebrationEvent`, and a
///   `CelebrationSlot` placed in the screen's layout.
/// - You: `rhythmVisibleProvider`, `bestMocksProvider`, `CelebrationsPicker`, `showGoalEditor`.
library;

export 'celebration/celebration_controller.dart';
export 'celebration/celebration_event.dart';
export 'celebration/celebration_slot.dart';
export 'celebration/rhythm_watcher.dart' show rhythmWatcherProvider;
export 'data/bests.dart' show bestMocksProvider, bestsRepositoryProvider;
export 'data/rhythm_prefs.dart' show CelebrationMode, celebrationModeProvider, rhythmPrefsProvider, rhythmVisibleProvider;
export 'data/study_days.dart' show studyDayPlanProvider;
export 'data/rhythm_providers.dart' show RhythmSnapshot, rhythmActionsProvider, rhythmSnapshotProvider, weeklyEndingProvider;
export 'logic/late_night.dart';
export 'logic/plan_week.dart';
export 'logic/week_outlook.dart' show OutlookKind, WeekOutlook, weekOutlook;
export 'logic/week_view.dart' show WeekStatus;
export 'widgets/late_night_line.dart' show LateNightLine;
export 'widgets/plan_week_strip.dart' show PlanWeekStrip;
export 'widgets/goal_editor.dart' show GoalEditor, showGoalEditor;
export 'widgets/returning_card.dart' show ReturningCard, ReturningSection, returningGreetsWithMobi, showReturning;
export 'widgets/rhythm_body.dart' show CelebrationsPicker;
export 'widgets/week_strip_section.dart' show WeekStripSection;
export 'widgets/weekly_ending_card.dart' show WeeklyEndingCard, WeeklyEndingSection;
