import 'package:flutter/material.dart';

import '../../../core/widgets/widgets.dart';
import '../../you/you_routes.dart' show YouPaths, openYouPage;
import '../copy.dart';
import '../data/practice_catalog.dart';
import 'plain_notice.dart';

/// "Edit subjects": the subjects editor under You (`/you/subjects`, the website's
/// `/onboarding?edit=true`). Saving there changes the tiles here.
void openEditSubjects(BuildContext context) => openYouPage(context, YouPaths.subjects);

/// Saved subjects practice cannot start in (not offered, merged or retired), each with the
/// server's own reason, and the way to change them. The website shows the same banner.
class StaleSubjectsBanner extends StatelessWidget {
  const StaleSubjectsBanner({super.key, required this.entries});

  final List<CatalogEntry> entries;

  @override
  Widget build(BuildContext context) {
    final lines = [for (final e in entries) PracticeCopy.staleSubject(fallbackSubjectNames[e.subject.id] ?? e.subject.name, e.reason)];
    return PlainNotice(
      message: lines.join('\n'),
      tone: BannerTone.warning,
      actionLabel: PracticeCopy.editSubjects,
      onAction: () => openEditSubjects(context),
    );
  }
}
