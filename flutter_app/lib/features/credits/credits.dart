/// What other modules use from the credits feature.
///
/// - `openCreditsPage(context)` opens the Credits page.
/// - `creditFiguresProvider` is the best-known Practice credits and AI credits balances, with
///   their renew dates and the plan; a figure nothing has told us is null, never 0.
/// - `meCreditsProvider` is the `GET /api/me/credits` read (balances, plan, first history page).
library;

export 'credits_copy.dart' show CreditsCopy;
export 'credits_routes.dart' show CreditsPaths, creditsScreen, openCreditsPage;
export 'data/credit_figures.dart' show CreditFigures, creditFiguresProvider;
export 'data/credits_data.dart' show creditsMoreProvider, meCreditsProvider;
export 'data/credits_models.dart' show CreditEntry, CreditPool, CreditsOverview;
