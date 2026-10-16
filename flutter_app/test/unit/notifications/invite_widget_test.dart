// The reminders invitation on You: when it shows, what each key does, how it answers, and that it
// never appears once reminders are on or on a day the post-result sheet asked.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/notification_prefs.dart';
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/notifications/copy.dart';
import 'package:mockmob/features/notifications/data/invite_store.dart';
import 'package:mockmob/features/notifications/logic/pre_prompt_policy.dart' show PrePromptMoment;
import 'package:mockmob/features/notifications/services/notification_providers.dart';
import 'package:mockmob/features/notifications/services/system_settings.dart';
import 'package:mockmob/features/notifications/widgets/notifications_invite.dart';

import '../../helpers/golden_harness.dart';
import 'support.dart';
import 'widget_support.dart';

class _Settings extends SystemSettings {
  int opened = 0;

  @override
  Future<bool> openNotificationSettings() async {
    opened++;
    return true;
  }
}

void main() {
  late Rig rig;
  late FakePrefsRepo repo;
  late FakePermissionRequester permission;
  var memory = MemoryPrefsStore();
  late InviteStore store;
  var appPrefs = AppPrefs(MemoryPrefsStore());
  late _Settings settings;

  Future<void> pumpStrip(
    WidgetTester tester, {
    NotificationPermission perm = NotificationPermission.notAsked,
    NotificationPermission afterRequest = NotificationPermission.granted,
    NotificationPrefs? prefs,
    DateTime? start,
    bool keepStore = false,
  }) async {
    rig = Rig(prefs: prefs ?? prefsWith(), start: start);
    repo = FakePrefsRepo(prefs ?? prefsWith());
    permission = FakePermissionRequester(perm, afterRequest: afterRequest);
    if (!keepStore) {
      memory = MemoryPrefsStore();
      appPrefs = AppPrefs(MemoryPrefsStore());
    }
    store = InviteStore(memory, userId: 'u1');
    settings = _Settings();
    await pumpMockmob(
      tester,
      const SingleChildScrollView(child: NotificationsInvite()),
      brightness: Brightness.dark,
      disableAnimations: true,
      overrides: [
        ...featureOverrides(rig: rig, repo: repo, permission: permission, appPrefs: appPrefs),
        inviteStoreProvider.overrideWithValue(store),
        systemSettingsProvider.overrideWithValue(settings),
      ],
    );
    await tester.pumpAndSettle();
  }

  testWidgets('while reminders are off it says so, with a Turn on key and Not now', (tester) async {
    await pumpStrip(tester);
    expect(find.text(NotificationsCopy.inviteTitle), findsOneWidget);
    expect(find.text(NotificationsCopy.inviteLine), findsOneWidget);
    expect(find.text(NotificationsCopy.inviteTurnOn), findsOneWidget);
    expect(find.text(NotificationsCopy.inviteNotNow), findsOneWidget);
    // Both keys are real 48 dp targets.
    expect(tester.getSize(find.bySemanticsLabel(NotificationsCopy.inviteTurnOnLabel)).height, greaterThanOrEqualTo(48));
    // Being on screen today is recorded, so the post-result sheet waits until tomorrow.
    final history = await store.load();
    expect(history.shownOn, isNotNull);
  });

  testWidgets('it is not there once Android allows reminders and the setting is on', (tester) async {
    await pumpStrip(tester, perm: NotificationPermission.granted);
    expect(find.text(NotificationsCopy.inviteTitle), findsNothing);
    expect((await store.load()).shownOn, isNull, reason: 'nothing was shown, so nothing is recorded');
  });

  testWidgets('Android allows it but every reminder is off in the app: invited, and Turn on switches the setting on', (tester) async {
    final allOff = const NotificationPrefs(
      channels: {
        NotificationChannelKeys.checkDue: false,
        NotificationChannelKeys.weeklyPlan: false,
        NotificationChannelKeys.studyWindow: false,
        NotificationChannelKeys.resultReady: false,
      },
    );
    await pumpStrip(tester, perm: NotificationPermission.granted, prefs: allOff);
    expect(find.text(NotificationsCopy.inviteTitle), findsOneWidget);
    await tester.tap(find.text(NotificationsCopy.inviteTurnOn));
    await tester.pumpAndSettle();
    expect(permission.requests, 0, reason: 'Android already allows it, so no system question');
    expect(repo.saved, hasLength(1));
    expect((repo.saved.single['channels']! as Map)[NotificationChannelKeys.studyWindow], isTrue);
    expect(repo.saved.single['studyWindow'], isNotNull, reason: 'a study time is set when there was none');
  });

  testWidgets('Turn on asks Android, then reads "Reminders are on" and folds away', (tester) async {
    await pumpStrip(tester);
    await tester.tap(find.text(NotificationsCopy.inviteTurnOn));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(permission.requests, 1);
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.textContaining('Reminders are on'), findsOneWidget);
    expect(find.text(NotificationsCopy.inviteTurnOn), findsNothing);
    expect(find.text(NotificationsCopy.inviteNotNow), findsNothing);

    await tester.pump(const Duration(milliseconds: 2600));
    await tester.pumpAndSettle();
    expect(find.textContaining('Reminders are on'), findsNothing);
    // Turning on is not a refusal: nothing was counted as a Not now.
    expect((await store.load()).declinedAsks, 0);
  });

  testWidgets('Not now folds it away and counts one ask', (tester) async {
    await pumpStrip(tester);
    await tester.tap(find.text(NotificationsCopy.inviteNotNow));
    await tester.pumpAndSettle();
    expect(find.text(NotificationsCopy.inviteTitle), findsNothing);
    final history = await store.load();
    expect(history.declinedAsks, 1);
    expect(history.lastDeclinedAt, isNotNull);
    expect(permission.requests, 0);
  });

  testWidgets('after a Not now it stays away for 2 days, then returns in a different wording', (tester) async {
    await pumpStrip(tester);
    await tester.tap(find.text(NotificationsCopy.inviteNotNow));
    await tester.pumpAndSettle();

    // The next day: not yet.
    await tester.pumpWidget(const SizedBox());
    await pumpStrip(tester, keepStore: true, start: rig.now.add(const Duration(days: 1)));
    expect(find.text(NotificationsCopy.inviteTitle), findsNothing);
    expect(find.text(NotificationsCopy.promptStudyTitle), findsNothing);

    // Two days later: back, and it asks a different way.
    await tester.pumpWidget(const SizedBox());
    await pumpStrip(tester, keepStore: true, start: rig.now.add(const Duration(days: 2, minutes: 1)));
    expect(find.text(NotificationsCopy.inviteTitle), findsNothing, reason: 'the second ask does not repeat the first wording');
    expect(find.text(NotificationsCopy.promptStudyTitle), findsOneWidget);
  });

  testWidgets('a day the post-result sheet asked, the strip stays away', (tester) async {
    appPrefs = AppPrefs(MemoryPrefsStore());
    final base = kolkata(2026, 10, 12, 18).toUtc();
    await appPrefs.setLastPrePromptAt(base.subtract(const Duration(hours: 2)));
    await pumpStrip(tester, keepStore: true, start: base);
    expect(find.text(NotificationsCopy.inviteTitle), findsNothing);
  });

  testWidgets('when Android has stopped asking, the key opens Android settings', (tester) async {
    await pumpStrip(tester, perm: NotificationPermission.denied);
    expect(find.text(NotificationsCopy.inviteBlockedLine), findsOneWidget);
    expect(find.text(NotificationsCopy.inviteTurnOn), findsNothing);
    await tester.tap(find.text(NotificationsCopy.inviteOpenSettings));
    await tester.pumpAndSettle();
    expect(settings.opened, 1);
    expect(permission.requests, 0);
  });

  testWidgets('a refusal keeps the strip, offers Open settings and counts as an ask', (tester) async {
    await pumpStrip(tester, afterRequest: NotificationPermission.denied);
    await tester.tap(find.text(NotificationsCopy.inviteTurnOn));
    await tester.pumpAndSettle();
    expect(find.text(NotificationsCopy.inviteRefused), findsOneWidget);
    expect(find.text(NotificationsCopy.inviteOpenSettings), findsOneWidget);
    expect((await store.load()).declinedAsks, 1);
  });

  testWidgets('allowing in Android settings and coming back turns it to the on state', (tester) async {
    await pumpStrip(tester, afterRequest: NotificationPermission.denied);
    await tester.tap(find.text(NotificationsCopy.inviteTurnOn));
    await tester.pumpAndSettle();
    expect(find.text(NotificationsCopy.inviteRefused), findsOneWidget);

    // The student allows it in Android settings and the app resumes: the permission is re-read.
    permission.current = NotificationPermission.granted;
    final container = ProviderScope.containerOf(tester.element(find.byType(NotificationsInvite)));
    container.invalidate(notificationPermissionProvider);
    await tester.pumpAndSettle(const Duration(milliseconds: 100));
    expect(find.textContaining('Reminders are on'), findsOneWidget);
  });

  testWidgets('it has no paper to live in: the runner and NTA moments never ask', (tester) async {
    // The strip is a plain widget that only You places. The policy answers false for any paper.
    await pumpStrip(tester);
    final container = ProviderScope.containerOf(tester.element(find.byType(NotificationsInvite)));
    for (final moment in [PrePromptMoment.inSession, PrePromptMoment.ntaMode]) {
      expect(await container.read(prePromptDueAtProvider(moment).future), isFalse);
    }
  });
}
