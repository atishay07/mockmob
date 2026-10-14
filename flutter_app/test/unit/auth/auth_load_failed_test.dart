import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/repositories/session_draft_repository.dart';
import 'package:mockmob/core/sync/outbox_repository.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/auth/auth_load_failed_screen.dart';
import 'package:mockmob/features/auth/copy.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mocktail/mocktail.dart';

import '../../helpers/fonts.dart';

class _RetryAuth extends AuthController {
  int retries = 0;

  @override
  AuthSnapshot build() =>
      const AuthSnapshot(status: AuthStatus.unknown, loadFailed: true);

  @override
  Future<void> retryStart() async => retries++;
}

class _RetryingAuth extends _RetryAuth {
  @override
  AuthSnapshot build() => const AuthSnapshot(
    status: AuthStatus.unknown,
    loadFailed: true,
    retrying: true,
  );
}

class _SignOutAuth extends _RetryAuth {
  int signOuts = 0;
  bool? keptWork;

  @override
  bool get canSignOut => true;

  @override
  Future<void> signOut({bool keepQueuedWork = true}) async {
    signOuts++;
    keptWork = keepQueuedWork;
  }
}

class _Drafts extends Mock implements SessionDraftRepository {}

class _Outbox extends Mock implements OutboxRepository {}

void main() {
  setUpAll(loadAppFonts);

  testWidgets(
    'says the account did not open, that the work is safe, and Try again retries',
    (tester) async {
      final auth = _RetryAuth();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authSnapshotProvider.overrideWith(() => auth)],
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            home: const AuthLoadFailedScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('We could not open your account'), findsOneWidget);
      expect(find.text('Your work is still on this phone.'), findsOneWidget);
      expect(find.byType(Mobi), findsOneWidget);
      expect(
        find.text('Sign in'),
        findsNothing,
        reason: 'this is not a sign-out',
      );

      await tester.tap(find.text(AuthCopy.tryAgain));
      await tester.pump();
      expect(auth.retries, 1);
    },
  );

  testWidgets(
    'while a retry runs the screen stays, says it is trying, and ignores more taps',
    (tester) async {
      final auth = _RetryingAuth();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authSnapshotProvider.overrideWith(() => auth)],
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            home: const AuthLoadFailedScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text(AuthCopy.loadFailedTitle), findsOneWidget);
      expect(find.text(AuthCopy.tryingAgain), findsOneWidget);
      // The key shows its spinner while the retry runs (StateAction.loading).
      expect(
        tester
            .widget<KeyButton>(
              find.widgetWithText(KeyButton, AuthCopy.tryingAgain),
            )
            .loading,
        isTrue,
      );
      await tester.tap(find.text(AuthCopy.tryingAgain));
      await tester.pump();
      expect(auth.retries, 0);
    },
  );

  testWidgets(
    'Sign out is a way out when the account keeps failing; it warns about unsent answers first',
    (tester) async {
      final auth = _SignOutAuth();
      final drafts = _Drafts();
      when(drafts.unsentAnswerCount).thenAnswer((_) async => 3);
      final outbox = _Outbox();
      when(() => outbox.pending()).thenAnswer((_) async => const []);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authSnapshotProvider.overrideWith(() => auth),
            sessionDraftRepositoryProvider.overrideWithValue(drafts),
            outboxRepositoryProvider.overrideWithValue(outbox),
          ],
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            home: const AuthLoadFailedScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));

      final key = find.text(AuthCopy.signOut);
      expect(key, findsOneWidget);
      // A quiet key is painted at 40 dp and reaches 48 dp through MmHitSlop (SPACING.md 3.3).
      final keyButton = find.ancestor(of: key, matching: find.byType(KeyButton)).first;
      final slop = tester.widget<MmHitSlop>(find.ancestor(of: keyButton, matching: find.byType(MmHitSlop)).first).slop;
      expect(
        tester.getSize(keyButton).height + slop.vertical,
        greaterThanOrEqualTo(48),
      );

      await tester.tap(key);
      await tester.pumpAndSettle();
      expect(find.text(YouCopy.signOutUnsent(3)), findsOneWidget);
      expect(
        auth.signOuts,
        0,
        reason: 'nothing happens before the student confirms',
      );

      await tester.tap(find.text(YouCopy.signOutAnyway));
      await tester.pumpAndSettle();
      expect(auth.signOuts, 1);
      expect(
        auth.keptWork,
        isTrue,
        reason: 'queued study writes stay for this account',
      );
    },
  );

  testWidgets(
    'no Sign out while the auth service has not started, since it could not clear anything',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authSnapshotProvider.overrideWith(_RetryAuth.new)],
          child: MaterialApp(
            theme: buildTheme(Brightness.light),
            home: const AuthLoadFailedScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text(AuthCopy.signOut), findsNothing);
    },
  );
}
