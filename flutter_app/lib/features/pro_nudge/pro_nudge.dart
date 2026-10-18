/// Pro nudges (owner, 18 Oct 2026, D79 to D84): inline rows, the Upgrade sheet that every Pro-only
/// feature opens, the student's own benefit lines, and the first-session pop-up. All of it exists only
/// with `PLAY_BILLING` on, never for a Pro student, and sells through Google Play Billing alone.
library;

export 'copy.dart';
export 'data/nudge_rules.dart' show InlineRules, PopupRules, PopupVerdict;
export 'data/pro_benefits.dart' show ProBenefits, ProFacts;
export 'data/pro_nudge_controller.dart' show proNudgesOnProvider, proNudgeProvider, proNudgeVisibleProvider, upgradePopupDueProvider;
export 'widgets/first_session_popup.dart' show showFirstSessionUpgradeIfDue;
export 'widgets/pro_nudge_row.dart' show ProNudgeRow;
export 'widgets/upgrade_sheet.dart' show showUpgradeSheetIfOn;
export 'widgets/upgrade_entry.dart' show UpgradeEntry;
