import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/auth/auth_load_failed_screen.dart';
import 'package:mockmob/features/auth/copy.dart';

import '../../helpers/fonts.dart';

class _RetryAuth extends AuthController {
  int retries = 0;

  @override
  AuthSnapshot build() => const AuthSnapshot(status: AuthStatus.unknown, loadFailed: true);

  @override
  Future<void> retryStart() async => retries++;
}

void main() {
  setUpAll(loadAppFonts);

  testWidgets('says the account did not open, that the work is safe, and Try again retries', (tester) async {
    final auth = _RetryAuth();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authSnapshotProvider.overrideWith(() => auth)],
        child: MaterialApp(theme: buildTheme(Brightness.light), home: const AuthLoadFailedScreen()),
      ),
    );
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('We could not open your account'), findsOneWidget);
    expect(find.text('Your work is still on this phone.'), findsOneWidget);
    expect(find.byType(Mobi), findsOneWidget);
    expect(find.text('Sign in'), findsNothing, reason: 'this is not a sign-out');

    await tester.tap(find.text(AuthCopy.tryAgain));
    await tester.pump();
    expect(auth.retries, 1);
  });
}
