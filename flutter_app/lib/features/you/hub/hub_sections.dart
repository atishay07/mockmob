import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/copy/copy.dart';
import '../../../core/models/consent.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/settings/appearance_settings.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';

/// Hairlines of a flat list on the ground start where the row text starts: 4 dp, a 28 dp bare icon, 16 dp.
const double _flatInset = 28 + MmSpace.s16;

/// Weekly goal and rhythm, the repair record and personal bests.
class ProgressPanel extends ConsumerWidget {
  const ProgressPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goal = ref.watch(goalRepositoryProvider).value;
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(
          flat: true,
          icon: LucideIcons.target,
          title: YouCopy.rowRhythm,
          note: rhythmNote(goal?.daysPerWeek, goal?.pausedUntil),
          onTap: () => context.push(AppRoutes.youRhythm),
        ),
        YouRow(flat: true, icon: LucideIcons.clipboardCheck, title: YouCopy.rowRecord, onTap: () => context.push(AppRoutes.reviewRecord)),
        YouRow(flat: true, icon: LucideIcons.medal, title: YouCopy.rowBests, onTap: () => context.push(AppRoutes.youBests)),
      ],
    );
  }

  /// "Goal: 4 days a week", or the pause beneath it. The run itself is on the sheet card above,
  /// so the row does not repeat it.
  static String? rhythmNote(int? days, String? pausedUntil) {
    final parts = <String>[];
    if (days != null) parts.add(YouCopy.goalNote(days));
    final pause = _pauseDate(pausedUntil);
    if (pause != null) parts.add(YouCopy.pausedUntil(formatDayMonth(pause)));
    return parts.isEmpty ? null : parts.join('\n');
  }

  static DateTime? _pauseDate(String? raw) {
    final date = raw == null ? null : DateTime.tryParse(raw);
    if (date == null) return null;
    final now = DateTime.now();
    return date.isBefore(DateTime(now.year, now.month, now.day)) ? null : date;
  }
}

/// Notifications, appearance, privacy, account, help and about. Each row carries the one live
/// fact worth seeing from here.
class SettingsPanel extends ConsumerWidget {
  const SettingsPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consent = ref.watch(consentRepositoryProvider);
    final mode = ref.watch(themeModeProvider);
    final pro = ref.watch(authSnapshotProvider.select((a) => a.isPro));
    final credits = ref.watch(authSnapshotProvider.select((a) => a.creditBalance));
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(flat: true, icon: LucideIcons.bell, title: YouCopy.rowNotifications, onTap: () => context.push(AppRoutes.youNotifications)),
        YouRow(
          flat: true,
          icon: LucideIcons.moonStar,
          title: YouCopy.rowAppearance,
          value: themeName(mode),
          onTap: () => context.push(AppRoutes.youAppearance),
        ),
        YouRow(
          flat: true,
          icon: LucideIcons.shieldCheck,
          title: YouCopy.rowPrivacy,
          note: privacyNote(consent),
          onTap: () => context.push(AppRoutes.youPrivacy),
        ),
        YouRow(
          flat: true,
          icon: LucideIcons.user,
          title: YouCopy.rowAccount,
          value: pro ? YouCopy.accountPro : credits == null ? null : YouCopy.accountCredits(credits),
          onTap: () => context.push(AppRoutes.youAccount),
        ),
        YouRow(flat: true, icon: LucideIcons.lifeBuoy, title: YouCopy.rowHelp, onTap: () => context.push(AppRoutes.youHelp)),
      ],
    );
  }

  static String themeName(ThemeMode mode) => switch (mode) {
        ThemeMode.dark => YouCopy.themeDark,
        ThemeMode.light => YouCopy.themeLight,
        ThemeMode.system => YouCopy.themeSystem,
      };

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

/// The quiet sign-off at the foot of You: Mobi resting and the version.
class HubFooter extends ConsumerWidget {
  const HubFooter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final version = ref.watch(appVersionProvider).value;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s40),
      child: Column(
        children: [
          // Mobi sits at the foot of the page; a tap makes him hop.
          const Mobi(pose: MobiPose.rest, size: 64, interactive: true),
          // No wordmark under him: its o is Mobi too, so the pair read as two Mobis stacked.
          if (version != null) ...[
            const SizedBox(height: MmSpace.s12),
            Text(YouCopy.helpVersion(version), style: context.mmType.caption.copyWith(color: colors.ink3)),
          ],
        ],
      ),
    );
  }
}
