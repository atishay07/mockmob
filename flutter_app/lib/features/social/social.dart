/// The Mob: MockMob's one social loop (SOCIAL-SPEC). Private groups of 2 to 5, one shared paper a
/// week, a ring that only fills. No chat, no DMs, no public profiles, no credits or rewards.
library;

export 'copy.dart' show MobCopy;
export 'data/mob_models.dart';
export 'data/mob_navigator.dart' show MobNavigator, mobNavigatorProvider, mobPaperStarterProvider, MobPaperStarter, startMobPaperRequest;
export 'data/mob_repository.dart' show mobRepositoryProvider, mobAvailableProvider, currentMobProvider, mobActionsProvider, MobFailure;
export 'mob_routes.dart';
export 'widgets/mob_hub_row.dart';
export 'widgets/mob_today_card.dart';
