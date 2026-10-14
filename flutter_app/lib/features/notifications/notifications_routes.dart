// Route builders for the notifications feature. This feature module owns this file. Keep the
// function names: lib/core/router/screens.dart re-exports them and router.dart binds them to
// the paths of spec 4.2.

import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'screens/notification_settings_screen.dart';
import 'screens/reminders_prompt_sheet.dart';

/// `/you/notifications`: the notifications settings (spec 5.12.1).
Widget youNotificationsScreen(BuildContext context, GoRouterState state) =>
    const NotificationSettingsScreen();

/// `/permissions/notifications`: the pre-prompt sheet body "Remind me when it matters" (spec 8).
/// A sheet route returns a body with no `Scaffold`: `MmSheetPage` supplies the frame.
Widget permissionsNotificationsScreen(
  BuildContext context,
  GoRouterState state,
) => const RemindersPromptSheet();

/// The pre-prompt sheet's keys, pinned in the sheet's footer under the scrolling body.
Widget permissionsNotificationsFooter(
  BuildContext context,
  GoRouterState state,
) => const RemindersPromptKeys();
