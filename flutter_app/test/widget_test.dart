import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app.dart';
import 'package:mockmob/core/auth/auth.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers/fonts.dart';

/// Stays signed out without touching Supabase or secure storage.
class _SignedOut extends AuthController {
  @override
  AuthSnapshot build() => AuthSnapshot.signedOut;
}

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await loadAppFonts();
  });

  testWidgets('a signed-out student lands on the welcome screen', (tester) async {
    await tester.pumpWidget(ProviderScope(overrides: [authSnapshotProvider.overrideWith(_SignedOut.new), rhythmPrefsStoreProvider.overrideWithValue(MemoryPrefsStore())], child: const MockMobApp()));
    await tester.pumpAndSettle();

    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.text('I already have an account'), findsOneWidget);
  });
}
