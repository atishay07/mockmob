import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/consent.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';

/// Hairlines of a flat list on the ground start where the row text starts: 4 dp, a 28 dp bare icon, 16 dp.
const double _flatInset = 28 + MmSpace.s16;

/// The repair record and personal bests (the milestones have their own shelf above, and the
/// weekly goal and study days have their own section).
class ProgressPanel extends StatelessWidget {
  const ProgressPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(flat: true, icon: LucideIcons.clipboardCheck, title: YouCopy.rowRecord, onTap: () => context.push(AppRoutes.reviewRecord)),
        YouRow(flat: true, icon: LucideIcons.medal, title: YouCopy.rowBests, onTap: () => context.push(AppRoutes.youBests)),
      ],
    );
  }
}

/// The live facts the hub's rows print.
abstract final class HubFacts {
  /// The usage-data line, or null while the choice has not been read (never "off" for a choice
  /// that is unknown).
  static String? privacyNote(ConsentState consent) {
    if (!consent.isLoaded) return null;
    if (consent.consent.ageBand != AgeBand.adult) return YouCopy.privacyOffForAccount;
    return consent.analyticsActive ? YouCopy.privacyOn : YouCopy.privacyOff;
  }
}

/// The two website tools, opened in a Custom Tab on www.mockmob.in.
class ToolsPanel extends StatelessWidget {
  const ToolsPanel({super.key, required this.onOpen});

  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(flat: true, icon: LucideIcons.compass, title: YouCopy.toolCompass, external: true, onTap: () => onOpen('/admission-compass')),
        YouRow(flat: true, icon: LucideIcons.layoutGrid, title: YouCopy.toolCombo, external: true, onTap: () => onOpen('/cuet-subject-combination')),
      ],
    );
  }
}

/// The quiet sign-off at the foot of You: the version. Mobi is not here a second time: the sheet
/// at the top has him (one Mobi per screen).
class HubFooter extends ConsumerWidget {
  const HubFooter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final version = ref.watch(appVersionProvider).value;
    if (version == null) return const SizedBox(height: MmSpace.s24);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s32),
      child: Center(child: Text(YouCopy.helpVersion(version), style: context.mmType.caption.copyWith(color: colors.ink3))),
    );
  }
}
