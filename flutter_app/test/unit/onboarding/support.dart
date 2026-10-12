import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/connectivity/connectivity_providers.dart' show NetworkStatusNotifier;
import 'package:mockmob/core/router/routes.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/onboarding/data/guest_sample.dart';
import 'package:mockmob/features/onboarding/onboarding_routes.dart';
import 'package:mockmob/features/onboarding/state/onboarding_providers.dart';
import 'package:mockmob/features/onboarding/state/subject_choices.dart';

import '../../helpers/golden_harness.dart';
import '../core_data/support/fakes.dart';

/// The bundled sample file, read from the project root (tests run from there).
String sampleSource() => File('assets/sample/sample_questions.json').readAsStringSync();

/// Subject choices without the network read.
class StaticChoices extends SubjectChoicesNotifier {
  @override
  SubjectChoices build() => const SubjectChoices();
}

class FakeNetworkStatus extends NetworkStatusNotifier {
  FakeNetworkStatus(this.value);

  final NetworkStatus value;

  @override
  NetworkStatus build() => value;
}

const signedInAuth = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'asha@example.com');

/// A guest that answered the first [answered] questions the way [keys] says (default: all right).
GuestSample guestWith({String subject = 'accountancy', List<String> keys = const [], bool imported = false}) => GuestSample(
      importKey: 'import-key-0000000001',
      subject: subject,
      answers: {for (var i = 0; i < keys.length; i++) 'q${i + 1}': keys[i]},
      imported: imported,
    );

/// The right keys of the five questions, in order.
const rightKeys = ['B', 'B', 'C', 'C', 'B'];

/// Everything a screen test needs: scripted HTTP, the guest store and the overrides.
class OnboardingHarness {
  OnboardingHarness({GuestSample? guest}) : guestPrefs = MemoryPrefsStore() {
    if (guest != null) {
      store.save(guest);
    }
  }

  final FakeHttpAdapter http = FakeHttpAdapter();
  final MemoryPrefsStore guestPrefs;
  final MemoryPrefsStore appPrefsBacking = MemoryPrefsStore();
  late final GuestSampleStore store = GuestSampleStore(guestPrefs);

  List<Override> overrides({AuthSnapshot auth = AuthSnapshot.signedOut, NetworkStatus network = NetworkStatus.online}) => [
        authSnapshotProvider.overrideWithBuild((ref, notifier) => auth),
        apiClientProvider.overrideWithValue(newApiClient(http)),
        appPrefsProvider.overrideWithValue(AppPrefs(appPrefsBacking)),
        guestSampleStoreProvider.overrideWithValue(store),
        sampleSourceProvider.overrideWithValue(() async => sampleSource()),
        subjectChoicesProvider.overrideWith(StaticChoices.new),
        networkStatusProvider.overrideWith(() => FakeNetworkStatus(network)),
      ];

  /// Pumps the real onboarding builders inside a small router, with stubs for the other routes.
  Future<GoRouter> pumpFlow(
    WidgetTester tester, {
    String initial = AppRoutes.welcome,
    AuthSnapshot auth = AuthSnapshot.signedOut,
    NetworkStatus network = NetworkStatus.online,
    Brightness brightness = Brightness.light,
  }) async {
    tester.view.physicalSize = const Size(720, 1560);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    Widget stub(String name) => Scaffold(body: Center(child: Text('STUB $name')));
    final router = GoRouter(
      initialLocation: initial,
      routes: [
        GoRoute(path: AppRoutes.welcome, builder: welcomeScreen),
        GoRoute(path: AppRoutes.onboardingSubject, builder: onboardingSubjectScreen),
        GoRoute(path: AppRoutes.onboardingSampleResult, builder: onboardingSampleResultScreen),
        GoRoute(path: '/onboarding/sample/:i', builder: onboardingSampleScreen),
        GoRoute(path: AppRoutes.signIn, builder: (c, s) => stub('sign-in')),
        GoRoute(path: AppRoutes.today, builder: (c, s) => stub('today')),
        GoRoute(
          path: AppRoutes.beforeYouStart,
          builder: (c, s) => Scaffold(
            backgroundColor: c.mmColors.raised,
            body: SafeArea(child: SingleChildScrollView(padding: const EdgeInsets.all(20), child: beforeYouStartScreen(c, s))),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides(auth: auth, network: network),
        child: DefaultAssetBundle(
          bundle: FileAssetBundle(),
          child: MaterialApp.router(
            debugShowCheckedModeBanner: false,
            theme: buildTheme(brightness),
            routerConfig: router,
          ),
        ),
      ),
    );
    await settleFlow(tester);
    return router;
  }
}

/// Lets futures, images and the short animations of the flow finish.
Future<void> settleFlow(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump(const Duration(milliseconds: 100));
  }
  await tester.pump(const Duration(milliseconds: 600));
}

/// The path of the page on top of [router], including pages added with `push`.
String locationOf(GoRouter router) => router.routerDelegate.currentConfiguration.last.matchedLocation;
