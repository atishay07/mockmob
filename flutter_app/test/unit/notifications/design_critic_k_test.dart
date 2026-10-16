// Design critic packet K (16 Oct), finding 26 on Notifications: the desk bell at the end of the
// title row is never cropped at the top, at any system-inset height.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/hybrid/hybrid.dart' show HybridBell;
import 'package:mockmob/core/permissions/permission_requester.dart';
import 'package:mockmob/features/notifications/screens/notification_settings_screen.dart';

import '../../helpers/golden_harness.dart';
import 'support.dart';
import 'widget_support.dart';

void main() {
  for (final inset in [0.0, 24.0, 48.0]) {
    testWidgets('the bell sits whole inside the 56 dp title row under a $inset dp status area', (tester) async {
      tester.view.padding = FakeViewPadding(top: inset * 2);
      tester.view.viewPadding = FakeViewPadding(top: inset * 2);
      addTearDown(tester.view.resetPadding);
      addTearDown(tester.view.resetViewPadding);
      final prefs = prefsWith(weeklyOn: false);
      final rig = Rig(prefs: prefs);
      await pumpMockmob(
        tester,
        const NotificationSettingsScreen(),
        size: const Size(360, 900),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: featureOverrides(rig: rig, repo: FakePrefsRepo(prefs), permission: FakePermissionRequester(NotificationPermission.granted)),
      );
      await tester.pumpAndSettle();
      final bell = tester.getRect(find.byType(HybridBell));
      final title = tester.getRect(find.text('Notifications').first);
      expect(bell.top, greaterThanOrEqualTo(inset + 4), reason: 'a clear margin under the status area, never above the first visible pixel');
      expect(bell.bottom, lessThanOrEqualTo(inset + 56 - 4), reason: 'inside the title row');
      expect(bell.center.dy, closeTo(title.center.dy, 6), reason: 'the bell and the title share a line');
      expect(tester.takeException(), isNull);
    });
  }
}
