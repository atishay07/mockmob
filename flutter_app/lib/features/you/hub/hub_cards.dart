// The sections of the You hub (audit 3, "You as a real hub"): Plan and credits, Appearance, Study
// days, Notifications, Account and privacy, and Help with its questions. Each is the content of a
// titled section on the hub; the screen owns the titles and the rhythm between them. Every row
// carries the one live fact worth seeing from here and opens the screen that owns that setting.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/copy.dart';
import '../../../core/models/notification_prefs.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../account_access/access_gateway.dart' show accessMethodsProvider;
import '../../credits/credits.dart';
import '../../credits/credits_screen.dart' show PlanTag;
import '../../credits/widgets/credit_tile.dart';
import '../../notifications/services/notification_providers.dart' show nextReminderProvider, notificationPermissionProvider;
import '../../rhythm/rhythm.dart' show studyDayPlanProvider;
import '../account/sign_out_key.dart';
import '../appearance/theme_switch.dart';
import '../copy.dart';
import '../data/goal_pause.dart';
import '../help/faq.dart';
import '../widgets/you_motion.dart';
import '../widgets/you_page.dart' show youText;
import '../widgets/you_row.dart';
import '../you_routes.dart';
import 'hub_sections.dart' show HubFacts;

/// Hairlines of a flat list on the ground start where the row text starts: 4 dp, a 28 dp bare icon, 16 dp.
const double _flatInset = 28 + MmSpace.s16;

// ---------------------------------------------------------------------------------------------
// Plan and credits
// ---------------------------------------------------------------------------------------------

/// The plan and both pools: Free or Pro (with its date), Practice credits and AI credits as two
/// tiles with what each pays for and when it renews. Either tile opens the Credits page, where
/// the history is. No price and no purchase.
class PlanCreditsCard extends ConsumerWidget {
  const PlanCreditsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final figures = ref.watch(creditFiguresProvider);
    final until = figures.proUntil;
    final line = figures.isPro ? (until == null ? CreditsCopy.planProActive : CreditsCopy.planUntil(until)) : CreditsCopy.planFreeLine;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: youText),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              PlanTag(pro: figures.isPro),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Text(line, style: type.body.copyWith(color: colors.ink2))),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          CreditTiles(figures: figures, keyPrefix: 'hub-credits', onOpen: () => openCreditsPage(context)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------------------------

/// Night, Day or Match phone in one tap, with the other looks (glass, touch feedback,
/// celebrations) one row down.
class AppearanceCard extends ConsumerWidget {
  const AppearanceCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: youText),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const ThemeSwitch(),
              const SizedBox(height: MmSpace.s8),
              Text(YouCopy.themeExplainer, style: context.mmType.caption.copyWith(color: colors.ink2)),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.sparkles,
              motion: YouIconMotion.tilt,
              changeKey: ChangedRowKeys.appearance,
              title: YouCopy.rowFeel,
              note: YouCopy.rowFeelNote,
              onTap: () => context.push(AppRoutes.youAppearance),
            ),
          ],
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Study days
// ---------------------------------------------------------------------------------------------

/// The weekly goal, the weekdays the student plans, and the pause: three rows, each opening the
/// editor that owns it.
class StudyDaysPanel extends ConsumerWidget {
  const StudyDaysPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goal = ref.watch(goalRepositoryProvider).value;
    final plan = ref.watch(studyDayPlanProvider);
    final now = ref.watch(nowProvider)();
    final pause = goal == null ? null : activePauseEnd(goal.pausedUntil, now);
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(
          flat: true,
          icon: LucideIcons.target,
          motion: YouIconMotion.ping,
          changeKey: ChangedRowKeys.rhythm,
          title: YouCopy.goalTitle,
          value: goal == null ? null : YouCopy.goalFigure(goal.daysPerWeek),
          note: goal == null ? null : YouCopy.goalCounts,
          onTap: () => context.push(AppRoutes.youGoal),
        ),
        _PlannedDaysRow(plan: plan, onTap: () => openYouPage(context, YouPaths.sheet)),
        YouRow(
          flat: true,
          icon: LucideIcons.pause,
          title: pause == null ? YouCopy.pauseRow : YouCopy.pausedRow,
          note: pause == null ? YouCopy.pauseRowNote : YouCopy.pausedUntil(formatDayMonth(pause)),
          onTap: () => context.push(AppRoutes.youRhythm),
        ),
      ],
    );
  }
}

/// "Planned days": seven weekday marks, the planned ones inked, so the plan reads at a glance.
/// The weekdays are the student's own plan (kept on this phone); the whole row opens the editor.
class _PlannedDaysRow extends StatelessWidget {
  const _PlannedDaysRow({required this.plan, required this.onTap});

  /// Weekdays planned, 0 = Monday, or null when none are chosen (or they no longer match the goal).
  final Set<int>? plan;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final names = plan == null ? <String>[] : [for (var i = 0; i < 7; i++) if (plan!.contains(i)) weekdayNames[i]];
    final label = plan == null ? YouCopy.plannedDaysNone : joinWithAnd(names);
    return RowFrame(
      onTap: onTap,
      semanticsLabel: '${YouCopy.plannedDays}. $label',
      padding: const EdgeInsets.symmetric(horizontal: 0, vertical: MmSpace.s12),
      child: Row(
        children: [
          SizedBox.square(dimension: 28, child: Center(child: Icon(LucideIcons.calendarDays, size: 22, color: colors.ink))),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(YouCopy.plannedDays, style: type.labelLarge.copyWith(fontSize: 16)),
                const SizedBox(height: MmSpace.s8),
                ExcludeSemantics(
                  child: Row(
                    children: [
                      for (var i = 0; i < 7; i++) ...[
                        if (i > 0) const SizedBox(width: MmSpace.s8),
                        _DayMark(initial: weekdayInitials[i], planned: plan?.contains(i) ?? false),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: MmSpace.s8),
                Text(label, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
        ],
      ),
    );
  }
}

class _DayMark extends StatelessWidget {
  const _DayMark({required this.initial, required this.planned});

  final String initial;
  final bool planned;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: planned ? colors.ink : null,
        border: planned ? null : Border.all(color: colors.lineStrong, width: 1.2),
      ),
      child: SizedBox.square(
        dimension: 28,
        child: Center(
          child: Text(
            initial,
            textScaler: TextScaler.noScaling,
            style: context.mmType.caption.copyWith(fontSize: 12, height: 1, fontWeight: FontWeight.w700, color: planned ? colors.ground : colors.ink3),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------------------------

/// Reminders and quiet hours with their times. The reminders row says what is next (from the
/// scheduler's own answer) or when the study reminder is set for, and "Blocked" when Android is
/// blocking this app; quiet hours show the window.
class NotificationsPanel extends ConsumerWidget {
  const NotificationsPanel({super.key});

  static String clock(ClockTime t) => formatTime12(DateTime(2000, 1, 1, t.hour, t.minute));

  /// "11:00 PM to 7:00 AM", or the words for no quiet hours.
  static String quietLine(NotificationPrefs prefs) =>
      prefs.quietStart == prefs.quietEnd ? YouCopy.quietOff : YouCopy.quietRange(clock(prefs.quietStart), clock(prefs.quietEnd));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(notificationPrefsRepositoryProvider.select((s) => s.value)) ?? NotificationPrefs.defaults;
    final permission = ref.watch(notificationPermissionProvider).value;
    final next = ref.watch(nextReminderProvider);
    final now = ref.watch(nowProvider)();
    final blocked = permission == NotificationPermission.denied;
    final anyOn = NotificationChannelKeys.all.any(prefs.channelOn);
    final window = prefs.studyWindow;

    final String value;
    final String? note;
    if (blocked) {
      value = YouCopy.remindersBlocked;
      note = YouCopy.remindersBlockedNote;
    } else if (!anyOn) {
      value = YouCopy.remindersOff;
      note = null;
    } else {
      value = YouCopy.remindersOn;
      note = next != null && next.isScheduled
          ? next.headline(now)
          : window != null
              ? YouCopy.studyReminderAt(clock(window.start))
              : YouCopy.noStudyTime;
    }
    return YouPanel(
      flat: true,
      inset: _flatInset,
      children: [
        YouRow(
          flat: true,
          icon: LucideIcons.bell,
          motion: YouIconMotion.swing,
          changeKey: ChangedRowKeys.notifications,
          title: YouCopy.rowReminders,
          value: value,
          note: note,
          onTap: () => context.push(AppRoutes.youNotifications),
        ),
        YouRow(
          flat: true,
          icon: LucideIcons.moon,
          title: YouCopy.rowQuietHours,
          note: quietLine(prefs),
          onTap: () => context.push(AppRoutes.youNotifications),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Account and privacy
// ---------------------------------------------------------------------------------------------

/// Name and email, the ways to sign in, the usage-data choice, and Sign out.
class AccountPanel extends ConsumerWidget {
  const AccountPanel({super.key});

  /// "Email code, password, Google": what this account can sign in with on this build.
  static String methodsNote({required bool google, required bool phone}) =>
      joinWithAnd([YouCopy.methodEmailCode, YouCopy.methodPassword, if (google) YouCopy.methodGoogle, if (phone) YouCopy.methodPhone]);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final methods = ref.watch(accessMethodsProvider);
    final consent = ref.watch(consentRepositoryProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.user,
              motion: YouIconMotion.hop,
              changeKey: ChangedRowKeys.account,
              title: YouCopy.rowNameEmail,
              note: YouCopy.rowNameEmailNote,
              onTap: () => context.push(AppRoutes.youAccount),
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.keyRound,
              title: YouCopy.rowSignInMethods,
              note: methodsNote(google: methods.google || methods.googleBrowser, phone: methods.phone),
              onTap: () => context.push(AppRoutes.youAccount),
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.shieldCheck,
              motion: YouIconMotion.tick,
              tickIcon: LucideIcons.shield,
              changeKey: ChangedRowKeys.privacy,
              title: YouCopy.rowPrivacy,
              note: HubFacts.privacyNote(consent),
              onTap: () => context.push(AppRoutes.youPrivacy),
            ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(youText, MmSpace.s24, youText, 0),
          child: SignOutKey(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------------------------

/// The four questions students ask most, open in place, then the way to every question, the
/// contact and the policies.
class HelpPanel extends StatelessWidget {
  const HelpPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FaqList(items: FaqCopy.quick),
        YouPanel(
          flat: true,
          inset: _flatInset,
          margin: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.lifeBuoy,
              motion: YouIconMotion.turn,
              title: YouCopy.rowHelp,
              note: YouCopy.rowHelpNote,
              onTap: () => context.push(AppRoutes.youHelp),
            ),
          ],
        ),
      ],
    );
  }
}
