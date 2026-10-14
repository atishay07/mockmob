import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth.dart' show GoogleOutcome;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/widgets.dart' show KeyButton;
import 'package:mockmob/features/auth/after_sign_in.dart';
import 'package:mockmob/features/auth/copy.dart';
import 'package:mockmob/features/auth/sign_in_controller.dart';
import 'package:mockmob/features/auth/sign_in_gateway.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/steps/save_step.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../auth/fakes.dart';

void main() {
  setUpAll(loadAppFonts);

  testWidgets('Google handed over to the browser says so, with a Cancel that stops the wait', (tester) async {
    final gateway = FakeGateway()..googleOutcome = GoogleOutcome.browserOpened;
    await pumpMockmob(
      tester,
      SaveStep(answers: const OnboardingAnswers(age: AgeAnswer.adult), onNotNow: () {}),
      size: kPhone,
      overrides: [
        ...onboardingOverrides(),
        signInGatewayProvider.overrideWithValue(gateway),
        afterSignInSheetLauncherProvider.overrideWithValue(() {}),
        signInPrefsStoreProvider.overrideWithValue(MemoryPrefsStore()),
      ],
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text(AuthCopy.googleInBrowser), findsNothing);

    await tester.tap(find.text(OnboardingCopy.continueWithGoogle));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(gateway.googleCalls, 1);
    expect(find.text(AuthCopy.googleInBrowser), findsOneWidget);
    expect(find.widgetWithText(KeyButton, OnboardingCopy.cancelBrowser), findsOneWidget);
    // Not asked twice while the browser has it.
    expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, OnboardingCopy.continueWithGoogle)).onPressed, isNull);

    final container = ProviderScope.containerOf(tester.element(find.byType(SaveStep)));
    await tester.tap(find.text(OnboardingCopy.cancelBrowser));
    await tester.pump(const Duration(milliseconds: 500));
    expect(container.read(signInControllerProvider).googleInBrowser, isFalse);
    expect(find.text(AuthCopy.googleInBrowser), findsNothing);
    expect(tester.widget<KeyButton>(find.widgetWithText(KeyButton, OnboardingCopy.continueWithGoogle)).onPressed, isNotNull);
  });
}
