/// The Mob: MockMob's one social loop (SOCIAL-SPEC). Private groups of 2 to 5, one shared paper a
/// week, a ring that only fills. No chat, no DMs, no public profiles, no credits or rewards. Open
/// to everyone (owner decision D-S1): no age step. Free: one Mob, the weekly paper, the ring, your
/// own result and a one-line teaser. Pro: the full side-by-side, history, extra papers, 3 Mobs.
library;

export 'copy.dart' show MobCopy;
export 'data/mob_models.dart';
export 'data/mob_navigator.dart' show MobNavigator, mobNavigatorProvider;
export 'data/mob_paper.dart' show MobPaperLauncher, MobPaperOutcome, MobPaperStarted, MobPaperFailed, mobPaperLauncherProvider, mobPaperDraftKey;
export 'data/mob_repository.dart' show mobRepositoryProvider, mobAvailableProvider, currentMobProvider, mobActionsProvider, MobFailure;
export 'mob_routes.dart';
export 'widgets/mob_hub_row.dart';
export 'widgets/mob_today_card.dart';
