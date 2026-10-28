// The route builder of the subject hub. lib/core/router/screens.dart re-exports it and
// router.dart binds it. The lines the integrator adds:
//
//   router.dart, inside tabRoot('/practice', practiceScreen, routes: [ ... ]):
//     page(SubjectHubPaths.template, subjectHubScreen, transition: MmTransition.container, root: true),
//   routes.dart: add SubjectHubPaths.fullTemplate ('/practice/subject/:subject') to AppRoutes.templates.
//   screens.dart: export '../../features/subject_hub/subject_hub_routes.dart';
//
// Entry points: the Practice subject tiles and Today's subject line call
// context.push(SubjectHubPaths.of(subjectId)); the website's /cuet/<slug> links resolve through
// SubjectHubPaths.fromWebPath in the ActionRouter.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'subject_hub_screen.dart';

export 'subject_hub_paths.dart';

/// `/practice/subject/:subject`. The id is a public subject id; the website's slug reads the same.
Widget subjectHubScreen(BuildContext context, GoRouterState state) => SubjectHubScreen(
  key: ValueKey(state.pathParameters['subject']),
  subject: state.pathParameters['subject'] ?? '',
);
