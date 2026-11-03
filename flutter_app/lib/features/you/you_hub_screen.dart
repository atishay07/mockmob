import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_state.dart';
import '../../core/copy/copy.dart';
import '../../core/models/consent.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/repositories.dart';
import '../../core/router/action_router.dart';
import '../../core/router/external_link_opener.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'widgets/you_page.dart';
import 'widgets/you_row.dart';

/// The You tab (spec 5.10): list rows, not cards, in three quiet groups. Each row shows one live
/// fact when we have it, so the hub answers "where am I" before you open anything.
class YouHubScreen extends ConsumerStatefulWidget {
  const YouHubScreen({super.key});

  @override
  ConsumerState<YouHubScreen> createState() => _YouHubScreenState();
}

class _YouHubScreenState extends ConsumerState<YouHubScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(vsync: this, duration: Motion.milestone);
  bool _started = false;
  bool _openFailed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _enter.value = 1;
    } else {
      _enter.forward();
    }
  }

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  Future<void> _openTool(String path) async {
    final target = ActionRouter.resolve(path);
    var ok = false;
    if (target is ExternalTarget) ok = await ref.read(externalLinkOpenerProvider).open(target.uri);
    if (mounted) setState(() => _openFailed = !ok);
  }

  /// One group rises 8 dp and fades in over 200 ms, each 70 ms after the one before. It plays
  /// once when the tab is first built and never again.
  Widget _group(int index, Widget child) {
    final start = index * 70 / Motion.milestone.inMilliseconds;
    final end = start + Motion.ui.inMilliseconds / Motion.milestone.inMilliseconds;
    final curve = CurvedAnimation(parent: _enter, curve: Interval(start, end.clamp(0, 1).toDouble(), curve: Motion.out));
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(curve),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final auth = ref.watch(authSnapshotProvider);
    final goal = ref.watch(goalRepositoryProvider).value;
    final rhythm = ref.watch(rhythmRepositoryProvider).value;
    final consent = ref.watch(consentRepositoryProvider);

    return YouPage(
      title: YouCopy.hubTitle,
      showBack: false,
      large: true,
      children: [
        if (auth.email != null)
          Padding(
            padding: youGutter,
            child: Text(YouCopy.signedInAs(auth.email!), style: type.small.copyWith(color: colors.ink2)),
          ),
        if (_openFailed)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s16, MmSpace.gutter, 0),
            child: const InlineBanner(message: YouCopy.toolOpenFailed, tone: BannerTone.error),
          ),
        _group(
          0,
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const GroupHeading(YouCopy.hubProgress),
              YouRow(
                icon: LucideIcons.target,
                title: YouCopy.rowRhythm,
                note: _rhythmNote(goal?.daysPerWeek, goal?.pausedUntil, rhythm?.weeksMetStreak),
                onTap: () => context.push(AppRoutes.youRhythm),
              ),
              YouRow(
                icon: LucideIcons.clipboardCheck,
                title: YouCopy.rowRecord,
                onTap: () => context.push(AppRoutes.reviewRecord),
              ),
              YouRow(
                icon: LucideIcons.calendarDays,
                title: YouCopy.rowMilestones,
                onTap: () => context.push(AppRoutes.youMilestones),
              ),
              YouRow(
                icon: LucideIcons.medal,
                title: YouCopy.rowBests,
                onTap: () => context.push(AppRoutes.youBests),
              ),
            ],
          ),
        ),
        _group(
          1,
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const GroupHeading(YouCopy.hubSettings),
              YouRow(
                icon: LucideIcons.bell,
                title: YouCopy.rowNotifications,
                onTap: () => context.push(AppRoutes.youNotifications),
              ),
              YouRow(
                icon: LucideIcons.palette,
                title: YouCopy.rowAppearance,
                onTap: () => context.push(AppRoutes.youAppearance),
              ),
              YouRow(
                icon: LucideIcons.shieldCheck,
                title: YouCopy.rowPrivacy,
                note: _privacyNote(consent),
                onTap: () => context.push(AppRoutes.youPrivacy),
              ),
              YouRow(
                icon: LucideIcons.user,
                title: YouCopy.rowAccount,
                onTap: () => context.push(AppRoutes.youAccount),
              ),
              YouRow(
                icon: LucideIcons.lifeBuoy,
                title: YouCopy.rowHelp,
                onTap: () => context.push(AppRoutes.youHelp),
              ),
            ],
          ),
        ),
        _group(
          2,
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const GroupHeading(YouCopy.hubTools),
              YouRow(
                icon: LucideIcons.compass,
                title: YouCopy.toolCompass,
                external: true,
                onTap: () => _openTool('/admission-compass'),
              ),
              YouRow(
                icon: LucideIcons.layoutGrid,
                title: YouCopy.toolCombo,
                external: true,
                onTap: () => _openTool('/cuet-subject-combination'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// "Goal: 4 days a week" over "Weeks in rhythm: 3". The weeks figure is left out at zero (a run that
  /// has not started is not shown as a number), and a pause replaces it.
  static String? _rhythmNote(int? days, String? pausedUntil, int? weeks) {
    final parts = <String>[];
    if (days != null) parts.add(YouCopy.goalNote(days));
    final pause = _pauseDate(pausedUntil);
    if (pause != null) {
      parts.add(YouCopy.pausedUntil(formatDayMonth(pause)));
    } else if (weeks != null && weeks > 0) {
      parts.add(YouCopy.weeksInRhythm(weeks));
    }
    return parts.isEmpty ? null : parts.join('\n');
  }

  static DateTime? _pauseDate(String? raw) {
    final date = raw == null ? null : DateTime.tryParse(raw);
    if (date == null) return null;
    final now = DateTime.now();
    return date.isBefore(DateTime(now.year, now.month, now.day)) ? null : date;
  }

  static String? _privacyNote(ConsentState consent) {
    if (!consent.isLoaded) return null;
    if (consent.consent.ageBand != AgeBand.adult) return YouCopy.privacyOffForAccount;
    return consent.analyticsActive ? YouCopy.privacyOn : YouCopy.privacyOff;
  }
}
