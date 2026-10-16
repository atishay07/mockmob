import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/copy/copy.dart' show formatTime12;
import '../../../core/motion/motion.dart';
import '../../../core/permissions/permission_requester.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_motion.dart' show YouIconMotion, YouMovingIcon, YouSizeEase;
import '../copy.dart';
import '../logic/pre_prompt_policy.dart';
import '../logic/pre_prompt_variants.dart';
import '../services/notification_providers.dart' show notificationPermissionProvider;
import '../services/reminder_invite.dart';
import 'balanced_text.dart';
import 'invite_pill.dart';

enum _Phase { invite, asking, refused, on }

/// How long "Reminders are on" stays before the strip folds away.
const Duration _onLinger = Duration(milliseconds: 2400);

/// The invitation to turn reminders on (owner, 14 and 16 Oct: keep inviting until they are on).
/// It is a flat panel on You, under This week, and only while reminders are off: Android's
/// permission missing, blocked, or the app's own reminders setting switched off. It is a
/// secondary action (a small volt pill, never a full-width key) and it is never hosted by a
/// paper, the runner or NTA mode.
///
/// - Turn on asks Android (or only switches the setting on when Android already allows it). On
///   allow it says "Reminders are on. Next: ...", then folds away.
/// - Not now folds it away. It comes back after 2, 4, 7 and then every 10 days, with the next
///   of the six wordings each time ([prePromptVariantFor]); it also keeps away on a day the
///   post-result sheet asked.
/// - After Android stops asking, the key opens Android's settings, and coming back from there
///   with notifications on turns the strip to its on state without a restart.
///
/// Nothing is shown until the invitation's own history has loaded, so it never flashes in and
/// out. Once on screen it stays until the student answers it.
class NotificationsInvite extends ConsumerStatefulWidget {
  const NotificationsInvite({super.key});

  @override
  ConsumerState<NotificationsInvite> createState() => _NotificationsInviteState();
}

class _NotificationsInviteState extends ConsumerState<NotificationsInvite> {
  /// The calendar day the bell last swung, so it swings once a day and not on every visit.
  static DateTime? _swungOn;

  _Phase _phase = _Phase.invite;
  bool _latched = false;
  bool _gone = false;
  bool _bell = false;
  int _asks = 0;
  InviteAction _action = InviteAction.turnOn;
  String _onLine = NotificationsCopy.inviteOnPlain;
  Timer? _linger;
  bool _closing = false;

  @override
  void initState() {
    super.initState();
    ref.listenManual<AsyncValue<InviteDue>>(youInviteDueProvider, (_, next) {
      final due = next.value;
      if (due == null || _latched || !due.show) return;
      setState(() {
        _latched = true;
        _asks = due.declinedAsks;
        _action = due.action;
      });
      unawaited(ref.read(reminderInviteProvider).shown());
      _swingBell();
    }, fireImmediately: true);
    // Back from Android settings (or the settings page) with notifications allowed: the strip
    // turns to its on state, without a restart.
    ref.listenManual<AsyncValue<NotificationPermission>>(notificationPermissionProvider, (_, next) {
      final permission = next.value;
      if (!_latched || _gone || permission == null) return;
      if (permission == NotificationPermission.granted && ref.read(remindersSettingOnProvider)) {
        if (_phase == _Phase.invite || _phase == _Phase.refused) _showOn();
      } else if (permission == NotificationPermission.denied && _action != InviteAction.openSettings && _phase == _Phase.invite) {
        setState(() => _action = InviteAction.openSettings);
      }
    });
  }

  @override
  void dispose() {
    _linger?.cancel();
    super.dispose();
  }

  void _swingBell() {
    final now = ref.read(nowProvider)();
    final last = _swungOn;
    if (last != null && sameCalendarDay(last, now)) return;
    _swungOn = now;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _bell = true);
    });
  }

  void _showOn() {
    final next = ref.read(reminderInviteProvider).nextWhen();
    setState(() {
      _phase = _Phase.on;
      _onLine = next == null ? NotificationsCopy.inviteOnPlain : NotificationsCopy.inviteOnNext(next);
    });
    _linger?.cancel();
    _linger = Timer(_onLinger, _fold);
  }

  void _fold() {
    if (!mounted || _gone) return;
    setState(() => _gone = true);
  }

  Future<void> _turnOn() async {
    if (_phase == _Phase.asking) return;
    final invite = ref.read(reminderInviteProvider);
    setState(() => _phase = _Phase.asking);
    final result = await invite.turnOn();
    if (!mounted) return;
    if (result == TurnOnResult.refused) {
      setState(() {
        _phase = _Phase.refused;
        _action = InviteAction.openSettings;
      });
      // A refusal counts as an ask: the gap starts.
      unawaited(invite.declined());
    } else {
      _showOn();
    }
  }

  Future<void> _openSettings() async {
    final messenger = ScaffoldMessenger.maybeOf(context);
    final done = await ref.read(reminderInviteProvider).openSettings();
    if (!done) {
      messenger?.showSnackBar(const SnackBar(content: Text(NotificationsCopy.settingsDidNotOpen)));
    }
  }

  Future<void> _notNow() async {
    if (_closing) return;
    _closing = true;
    await ref.read(reminderInviteProvider).declined();
    if (mounted) _fold();
  }

  ({String title, String line}) _words() {
    if (_phase == _Phase.on) return (title: _onLine, line: '');
    if (_phase == _Phase.refused) {
      return (title: NotificationsCopy.inviteTitle, line: NotificationsCopy.inviteRefused);
    }
    final window = ref.watch(notificationPrefsRepositoryProvider.select((s) => s.value?.studyWindow));
    final studyTime = window == null ? null : formatTime12(DateTime(2000, 1, 1, window.start.hour, window.start.minute));
    // The first ask says what is off; each return after that uses the next wording.
    final variant = prePromptVariantIndex(_asks) == 0
        ? const PrePromptVariant(title: NotificationsCopy.inviteTitle, line: NotificationsCopy.inviteLine)
        : prePromptVariantFor(_asks, studyTime: studyTime);
    final line = _action == InviteAction.openSettings ? NotificationsCopy.inviteBlockedLine : variant.line;
    return (title: variant.title, line: line);
  }

  @override
  Widget build(BuildContext context) {
    final show = _latched && !_gone;
    final colors = context.mmColors;
    final type = context.mmType;

    Widget panel() {
      final words = _words();
      final on = _phase == _Phase.on;
      final blocked = _action == InviteAction.openSettings;
      final pill = on
          ? null
          : blocked
              ? InvitePill(label: NotificationsCopy.inviteOpenSettings, onPressed: () => unawaited(_openSettings()))
              : InvitePill(
                  label: NotificationsCopy.inviteTurnOn,
                  semanticsLabel: NotificationsCopy.inviteTurnOnLabel,
                  loading: _phase == _Phase.asking,
                  onPressed: () => unawaited(_turnOn()),
                );
      return Semantics(
        container: true,
        liveRegion: on,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.raised,
            borderRadius: MmRadius.keyAll,
            border: Border.all(color: colors.line),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s8, MmSpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: on
                          ? Icon(LucideIcons.check, size: 22, color: colors.ink)
                          : YouMovingIcon(
                              icon: LucideIcons.bell,
                              size: 22,
                              color: colors.ink,
                              pressed: _bell,
                              motion: YouIconMotion.swing,
                            ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: MmOverlapSwitcher.fade(
                          duration: Motion.crossFade,
                          child: Column(
                            key: ValueKey('${_phase.name}-${words.title}-${words.line}'),
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Semantics(
                                header: true,
                                child: BalancedText(words.title, style: type.labelLarge.copyWith(fontSize: 16, color: colors.ink)),
                              ),
                              if (words.line.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(words.line, style: type.small.copyWith(color: colors.ink2)),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                    if (pill != null) ...[const SizedBox(width: MmSpace.s8), pill],
                  ],
                ),
                if (!on)
                  Align(
                    alignment: Alignment.centerRight,
                    child: KeyButton.quiet(
                      label: NotificationsCopy.inviteNotNow,
                      onPressed: _phase == _Phase.asking ? null : () => unawaited(_notNow()),
                    ),
                  )
                else
                  const SizedBox(height: MmSpace.s8),
              ],
            ),
          ),
        ),
      );
    }

    return YouSizeEase(
      child: MmOverlapSwitcher.fade(
        duration: Motion.card,
        child: show
            ? KeyedSubtree(
                key: const ValueKey('invite'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
                  child: panel(),
                ),
              )
            : const SizedBox(key: ValueKey('none'), width: double.infinity),
      ),
    );
  }
}
