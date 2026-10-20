// The Mob setup, one question a screen (owner D166, D168): each question's words, the key that goes on
// only with its answer, nothing preselected but the first subject (T001), the name rule, the one create
// call with the right values, the server's own sentences inline with every answer kept, Back stepping
// back, the steps a returning student or a one-subject student skips, the field and key above the
// keyboard, large text on a small phone, and reduced motion leaving nothing drawing.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/logic/explainer_flow.dart';
import 'package:mockmob/features/social/v3/logic/mob_names.dart';
import 'package:mockmob/features/social/v3/mob_v3_nav.dart';
import 'package:mockmob/features/social/v3/screens/mob_setup_screen.dart';
import 'package:mockmob/features/social/v3/widgets/fold_picker.dart';

import '../../../golden/you/you_golden_kit.dart' show setUpGoldenFonts;
import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

const _oneSubject = AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'aarav.k@example.com', name: 'Aarav', subjects: ['accountancy']);

/// D0 in miniature: one key that opens the setup the way D0 does (a pushed page), so Back and the
/// finished setup have somewhere to go.
class _Launcher extends StatelessWidget {
  const _Launcher();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(child: TextButton(key: const ValueKey('open-setup'), onPressed: () => MobV3Nav.setup(context), child: const Text('D0'))),
      );
}

Future<SocialServer> _open(
  WidgetTester tester, {
  Map<String, String> failures = const {},
  FoldKey? seat,
  AuthSnapshot auth = aaravAuth,
  Size size = const Size(360, 780),
  double scale = 1,
  bool reduced = true,
}) async {
  final server = SocialServer(scenario: 'fresh', failures: failures);
  if (seat != null) await server.profile(seat);
  server.calls.clear();
  await pumpSocial(tester, const _Launcher(), server, auth: auth, size: size, scale: scale, reduced: reduced);
  await tester.tap(find.byKey(const ValueKey('open-setup')));
  await settleSocial(tester);
  if (reduced) await tester.pumpAndSettle();
  return server;
}

Finder get _key => find.byKey(const ValueKey('setup-key'));
KeyButton _keyButton(WidgetTester tester) => tester.widget<KeyButton>(_key);
bool _keyOn(WidgetTester tester) => _keyButton(tester).onPressed != null;
String _keyLabel(WidgetTester tester) => _keyButton(tester).label;

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

Future<void> _next(WidgetTester tester) async {
  await tester.tap(_key);
  await settleSocial(tester);
  await tester.pumpAndSettle();
}

Future<void> _back(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Back').first);
  await tester.pumpAndSettle();
}

/// A fresh student's way to the last question: Dart, [name] (a key into the list), the first subject.
Future<void> _toLast(WidgetTester tester, {FoldKey fold = FoldKey.dart, int name = 0, String? subject}) async {
  await _tap(tester, find.text(MobV3Copy.foldName(fold)));
  await _next(tester);
  await _tap(tester, find.byKey(ValueKey('mob-name-$name')));
  await _next(tester);
  if (subject != null) await _tap(tester, find.byKey(ValueKey('setup-subject-$subject')));
  await _next(tester);
}

void main() {
  setUpGoldenFonts();
  setUpAll(loadFoldManifestForTest);

  group('the steps a student gets', () {
    test('fresh: four; a seat skips the Fold; one subject skips the subject', () {
      expect(setupStepsFor(hasSeat: false, subjectCount: 3), [SetupStep.fold, SetupStep.name, SetupStep.subject, SetupStep.you]);
      expect(setupStepsFor(hasSeat: true, subjectCount: 3), [SetupStep.name, SetupStep.subject, SetupStep.you]);
      expect(setupStepsFor(hasSeat: false, subjectCount: 1), [SetupStep.fold, SetupStep.name, SetupStep.you]);
      expect(setupStepsFor(hasSeat: true, subjectCount: 1), [SetupStep.name, SetupStep.you]);
      // No subjects yet: the subject question stays, with its way to choose them.
      expect(setupStepsFor(hasSeat: false, subjectCount: 0), contains(SetupStep.subject));
    });
  });

  group('each question', () {
    testWidgets('1, your Fold: the words, four starters, nothing picked, the key waits for a pick', (tester) async {
      await _open(tester);
      expect(find.text(MobExplainerCopy.foldTitle), findsOneWidget);
      expect(find.text(MobExplainerCopy.foldLine), findsOneWidget);
      expect(find.byType(FoldCard), findsNWidgets(4));
      for (final f in FoldKey.starters) {
        expect(find.text(MobV3Copy.foldName(f)), findsOneWidget);
        expect(find.text(MobV3Copy.foldLine(f)), findsOneWidget);
      }
      expect(find.text(MobV3Copy.foldName(FoldKey.hop)), findsNothing);
      expect(_keyLabel(tester), MobV3Copy.pickFold);
      expect(_keyOn(tester), isFalse);
      // The den: "Pick a Fold" under the empty seat, "Your Mob" on the pennant, four dots, the first on.
      expect(find.text(MobExplainerCopy.pickAFold), findsOneWidget);
      expect(find.text(MobExplainerCopy.yourMob), findsOneWidget);
      expect(find.bySemanticsLabel(MobExplainerCopy.stepOf(0, 4)), findsOneWidget);
      expect(find.byKey(const ValueKey('setup-dot-3')), findsOneWidget);
      // Every card is above the key on a 780 dp phone: no scrolling to see the four.
      final key = tester.getRect(_key);
      for (final card in tester.widgetList<FoldCard>(find.byType(FoldCard))) {
        expect(tester.getRect(find.byWidget(card)).bottom, lessThan(key.top), reason: '${card.fold.name} sits above the key');
      }

      await _tap(tester, find.text('Hexa'));
      expect(_keyLabel(tester), MobExplainerCopy.next);
      expect(_keyOn(tester), isTrue);
      expect(find.text(MobExplainerCopy.pickAFold), findsNothing);
      expect(find.text(MobExplainerCopy.you), findsOneWidget, reason: 'the tag says You once a Fold sits');
    });

    testWidgets('2, the name: the words, six names, none chosen, the key waits; a pick goes on the pennant', (tester) async {
      await _open(tester);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      expect(find.text(MobExplainerCopy.nameTitle), findsOneWidget);
      expect(find.text(MobV3Copy.namesKind), findsOneWidget);
      for (var i = 0; i < 6; i++) {
        expect(find.text(mobNames[i]), findsOneWidget);
        expect(find.descendant(of: find.byKey(ValueKey('mob-name-$i')), matching: find.byIcon(LucideIcons.check)), findsNothing, reason: 'nothing is preselected');
      }
      expect(find.text(mobNames[6]), findsNothing);
      expect(_keyLabel(tester), MobV3Copy.pickName);
      expect(_keyOn(tester), isFalse);

      await _tap(tester, find.byKey(const ValueKey('mob-name-1')));
      expect(find.descendant(of: find.byKey(const ValueKey('mob-name-1')), matching: find.byIcon(LucideIcons.check)), findsOneWidget);
      expect(_keyLabel(tester), MobExplainerCopy.next);
      expect(_keyOn(tester), isTrue);
      final pennant = tester.widget<Text>(find.byKey(const ValueKey('setup-pennant-name')));
      expect(pennant.data, 'Quiet Comets');
      expect(find.text(MobExplainerCopy.yourMob), findsNothing);
    });

    testWidgets('Show six more pages through the 24 names, then back to the first six; Night Owls is gone', (tester) async {
      await _open(tester);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      final seen = <String>{};
      for (var page = 0; page < 4; page++) {
        for (var i = page * 6; i < page * 6 + 6; i++) {
          expect(find.text(mobNames[i]), findsOneWidget, reason: 'page $page shows ${mobNames[i]}');
          seen.add(mobNames[i]);
        }
        expect(find.text(page == 3 ? MobV3Copy.showFirstSix : MobV3Copy.showSixMore), findsOneWidget);
        await _tap(tester, find.byKey(const ValueKey('mob-names-more')));
      }
      expect(seen.length, 24);
      expect(seen.contains('Night Owls'), isFalse);
      expect(find.text(mobNames[0]), findsOneWidget);
    });

    testWidgets('3, the subject: the words, your subjects with their art, the first chosen, the key on', (tester) async {
      await _open(tester);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      await _tap(tester, find.byKey(const ValueKey('mob-name-0')));
      await _next(tester);
      expect(find.text(MobExplainerCopy.subjectTitle), findsOneWidget);
      expect(find.text(MobExplainerCopy.subjectLine), findsOneWidget);
      for (final s in ['accountancy', 'business_studies', 'economics']) {
        expect(find.byKey(ValueKey('setup-subject-$s')), findsOneWidget);
        expect(find.descendant(of: find.byKey(ValueKey('setup-subject-$s')), matching: find.byType(Image)), findsOneWidget, reason: '$s has its object art');
      }
      expect(find.descendant(of: find.byKey(const ValueKey('setup-subject-accountancy')), matching: find.byIcon(LucideIcons.check)), findsOneWidget);
      expect(_keyLabel(tester), MobExplainerCopy.next);
      expect(_keyOn(tester), isTrue);
      expect(tester.widget<Text>(find.byKey(const ValueKey('setup-pennant-subject'))).data, 'Accountancy');

      await _tap(tester, find.byKey(const ValueKey('setup-subject-economics')));
      expect(find.descendant(of: find.byKey(const ValueKey('setup-subject-economics')), matching: find.byIcon(LucideIcons.check)), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('setup-subject-accountancy')), matching: find.byIcon(LucideIcons.check)), findsNothing);
      expect(tester.widget<Text>(find.byKey(const ValueKey('setup-pennant-subject'))).data, 'Economics');
    });

    testWidgets('4, you: the words, your first name, the notes, the colours, what comes next, the key', (tester) async {
      await _open(tester);
      await _toLast(tester);
      expect(find.text(MobExplainerCopy.youTitle), findsOneWidget);
      expect(find.text(MobV3Copy.nameLabel), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'Aarav');
      expect(find.text(MobV3Copy.nameNote), findsOneWidget);
      expect(find.text(MobV3Copy.colourLabel), findsOneWidget);
      expect(find.text(MobV3Copy.marksNote), findsOneWidget);
      expect(find.text(MobV3Copy.startNext), findsOneWidget);
      expect(_keyLabel(tester), MobV3Copy.startKey('Chai Circle'));
      expect(_keyOn(tester), isTrue);
      // The tag under the Fold is the name being typed.
      expect(find.descendant(of: find.byKey(const ValueKey('setup-tag')), matching: find.text('Aarav')), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Zoya');
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byKey(const ValueKey('setup-tag')), matching: find.text('Zoya')), findsOneWidget);
    });
  });

  group('the name rule and the create call', () {
    testWidgets('a name that fails the rule: the key says what to do and nothing is sent', (tester) async {
      final server = await _open(tester);
      await _toLast(tester);
      for (final bad in ['', 'A', '12', 'Aarav!']) {
        await tester.enterText(find.byType(TextField), bad);
        await tester.pumpAndSettle();
        expect(_keyLabel(tester), MobExplainerCopy.typeYourName, reason: '"$bad" fails the rule');
        expect(_keyOn(tester), isFalse);
      }
      await tester.tap(_key);
      await settleSocial(tester);
      expect(server.calls.where((c) => c.startsWith('createMob')), isEmpty);
      await tester.enterText(find.byType(TextField), 'Aarav K');
      await tester.pumpAndSettle();
      expect(_keyOn(tester), isTrue);
    });

    testWidgets('start: one call with the subject, the first name, the colour, the name key and the Fold; then back to the Mob tab', (tester) async {
      final server = await _open(tester);
      await _toLast(tester, fold: FoldKey.hexa, name: 1, subject: 'economics');
      expect(_keyLabel(tester), MobV3Copy.startKey('Quiet Comets'));
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      final calls = server.calls.where((c) => c.startsWith('createMob')).toList();
      expect(calls, ['createMob:economics:Aarav:3:1:hexa']);
      expect(find.byType(MobSetupScreen), findsNothing, reason: 'the setup closes on the new Mob');
      expect(find.byKey(const ValueKey('open-setup')), findsOneWidget);
    });

    testWidgets('a colour tap is sent', (tester) async {
      final server = await _open(tester);
      await _toLast(tester);
      await _tap(tester, find.bySemanticsLabel(RegExp('^Teal')).first);
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(server.calls.where((c) => c.startsWith('createMob')).single, 'createMob:accountancy:Aarav:1:0:dart');
    });

    testWidgets('FOLD_LOCKED: the server sentence, inline, every answer kept, ready to try again', (tester) async {
      await _open(tester, failures: {'createMob': 'FOLD_LOCKED'});
      await _toLast(tester, name: 2, subject: 'business_studies');
      await tester.enterText(find.byType(TextField), 'Kabir');
      await tester.pumpAndSettle();
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.errors['FOLD_LOCKED']!), findsOneWidget);
      expect(find.byType(MobSetupScreen), findsOneWidget);
      expect(find.text(MobExplainerCopy.youTitle), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'Kabir');
      expect(_keyLabel(tester), MobV3Copy.startKey(mobNames[2]));
      expect(_keyOn(tester), isTrue);
      // Back keeps the earlier answers too.
      await _back(tester);
      expect(find.descendant(of: find.byKey(const ValueKey('setup-subject-business_studies')), matching: find.byIcon(LucideIcons.check)), findsOneWidget);
    });

    testWidgets('NAME_KEY_INVALID: the server sentence, inline', (tester) async {
      await _open(tester, failures: {'createMob': 'NAME_KEY_INVALID'});
      await _toLast(tester);
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.errors['NAME_KEY_INVALID']!), findsOneWidget);
      expect(find.byKey(const ValueKey('setup-error')), findsOneWidget);
    });

    testWidgets('a name the server refuses is said under the field', (tester) async {
      await _open(tester, failures: {'createMob': 'NAME_INVALID'});
      await _toLast(tester);
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('setup-error')), findsNothing);
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.decoration?.errorText, isNotNull);
    });
  });

  group('Back and the skipped steps', () {
    testWidgets('Back steps back with the answers kept; Back on the first question returns to D0', (tester) async {
      await _open(tester);
      await _tap(tester, find.text('Kandil'));
      await _next(tester);
      await _tap(tester, find.byKey(const ValueKey('mob-name-3')));
      await _next(tester);
      expect(find.text(MobExplainerCopy.subjectTitle), findsOneWidget);
      await _back(tester);
      expect(find.text(MobExplainerCopy.nameTitle), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('mob-name-3')), matching: find.byIcon(LucideIcons.check)), findsOneWidget);
      await _back(tester);
      expect(find.text(MobExplainerCopy.foldTitle), findsOneWidget);
      expect(_keyOn(tester), isTrue, reason: 'Kandil is still picked');
      await _back(tester);
      expect(find.byType(MobSetupScreen), findsNothing);
      expect(find.byKey(const ValueKey('open-setup')), findsOneWidget);
    });

    testWidgets('the system back steps back too, and leaves from the first question', (tester) async {
      await _open(tester);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text(MobExplainerCopy.foldTitle), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(MobSetupScreen), findsNothing);
    });

    testWidgets('a returning student: no Fold question, three dots, "You play as Dart" with Change on the last', (tester) async {
      final server = await _open(tester, seat: FoldKey.dart);
      expect(find.text(MobExplainerCopy.foldTitle), findsNothing);
      expect(find.text(MobExplainerCopy.nameTitle), findsOneWidget);
      expect(find.byKey(const ValueKey('setup-dot-2')), findsOneWidget);
      expect(find.byKey(const ValueKey('setup-dot-3')), findsNothing);
      expect(find.text(MobExplainerCopy.you), findsOneWidget, reason: 'your Fold already sits in the den');
      await _tap(tester, find.byKey(const ValueKey('mob-name-0')));
      await _next(tester);
      await _next(tester);
      expect(find.text(MobExplainerCopy.youTitle), findsOneWidget);
      expect(find.text(MobV3Copy.youPlayAs('Dart')), findsOneWidget);
      expect(find.byType(FoldCard), findsNothing);
      await _tap(tester, find.byKey(const ValueKey('setup-change-fold')));
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(find.text(MobV3Copy.changeFoldTitle), findsOneWidget);
      expect(find.text(MobV3Copy.foldName(FoldKey.hop)), findsNothing, reason: 'only the Folds you own');
      await _tap(tester, find.text('Hexa').last);
      expect(find.text(MobV3Copy.youPlayAs('Hexa')), findsOneWidget);
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(server.calls.where((c) => c.startsWith('createMob')).single, 'createMob:accountancy:Aarav:3:0:hexa');
    });

    testWidgets('one subject: no subject question, and the pennant shows it on the last', (tester) async {
      final server = await _open(tester, auth: _oneSubject);
      expect(find.byKey(const ValueKey('setup-dot-2')), findsOneWidget);
      expect(find.byKey(const ValueKey('setup-dot-3')), findsNothing);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      await _tap(tester, find.byKey(const ValueKey('mob-name-0')));
      await _next(tester);
      expect(find.text(MobExplainerCopy.subjectTitle), findsNothing);
      expect(find.text(MobExplainerCopy.youTitle), findsOneWidget);
      expect(tester.widget<Text>(find.byKey(const ValueKey('setup-pennant-subject'))).data, 'Accountancy');
      await tester.tap(_key);
      await settleSocial(tester);
      await tester.pumpAndSettle();
      expect(server.calls.where((c) => c.startsWith('createMob')).single, 'createMob:accountancy:Aarav:3:0:dart');
    });

    testWidgets('no subjects yet: the subject question says so and its key opens the subjects', (tester) async {
      await _open(tester, auth: noSubjectsAuth);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      await _tap(tester, find.byKey(const ValueKey('mob-name-0')));
      await _next(tester);
      expect(find.text(MobV3Copy.noSubjects), findsOneWidget);
      expect(_keyLabel(tester), MobV3Copy.chooseSubjects);
      expect(_keyOn(tester), isTrue);
    });
  });

  group('layout and motion', () {
    testWidgets('keyboard: tap the field with the keyboard down, the keys rise: same field, focus kept, field and key above the keys', (tester) async {
      await _open(tester);
      await _toLast(tester);
      final field = find.byType(TextField);
      await tester.tap(field);
      await tester.pump();
      final before = tester.state<EditableTextState>(find.byType(EditableText));
      expect(before.widget.focusNode.hasFocus, isTrue);
      // The keyboard rises the way Android reports it: in steps, after the focus (300 dp on a 780 dp phone).
      addTearDown(tester.view.resetViewInsets);
      for (final h in [90.0, 200.0, 300.0]) {
        tester.view.viewInsets = FakeViewPadding(bottom: h * 2);
        await tester.pump(const Duration(milliseconds: 16));
      }
      await tester.pumpAndSettle();
      final after = tester.state<EditableTextState>(find.byType(EditableText));
      expect(identical(before, after), isTrue, reason: 'the keys rising must not rebuild the field');
      expect(after.widget.focusNode.hasFocus, isTrue);
      expect(tester.testTextInput.isVisible, isTrue, reason: 'the keyboard stays open');
      final rect = tester.getRect(field);
      expect(rect.bottom, lessThanOrEqualTo(780 - 300), reason: 'the field is above the keys');
      expect(rect.top, greaterThan(0));
      final key = tester.getRect(_key);
      expect(key.bottom, lessThanOrEqualTo(780 - 300), reason: 'the key is above the keys');
      expect(rect.bottom, lessThanOrEqualTo(key.top));
      // Your Fold and its tag are still in the den, with the name as it is typed.
      tester.testTextInput.enterText('Aarav K');
      await tester.pump();
      expect(after.widget.controller.text, 'Aarav K');
      await tester.pumpAndSettle();
      expect(find.descendant(of: find.byKey(const ValueKey('setup-tag')), matching: find.text('Aarav K')), findsOneWidget);
      expect(tester.getRect(find.byKey(const ValueKey('setup-tag'))).bottom, lessThanOrEqualTo(rect.top));
    });

    testWidgets('1.3x text on a 320 x 700 phone: no overflow on any question', (tester) async {
      await _open(tester, size: const Size(320, 700), scale: 1.3);
      expect(tester.takeException(), isNull);
      await _tap(tester, find.text('Dart'));
      await _next(tester);
      expect(tester.takeException(), isNull);
      await _tap(tester, find.byKey(const ValueKey('mob-name-0')));
      await _next(tester);
      expect(tester.takeException(), isNull);
      await _tap(tester, find.byKey(const ValueKey('setup-subject-business_studies')));
      await _next(tester);
      expect(tester.takeException(), isNull);
      expect(find.text(MobExplainerCopy.youTitle), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Abhimanyuveer');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('reduced motion: nothing keeps drawing frames, on a question or after a step', (tester) async {
      await _open(tester);
      await tester.pumpAndSettle(); // would time out if a loop kept running
      expect(tester.binding.hasScheduledFrame, isFalse);
      await _tap(tester, find.text('Dart'));
      expect(tester.binding.hasScheduledFrame, isFalse);
      await _next(tester);
      expect(tester.binding.hasScheduledFrame, isFalse);
      // No pane is left half-way: one question shows.
      expect(find.text(MobExplainerCopy.foldTitle), findsNothing);
      expect(find.text(MobExplainerCopy.nameTitle), findsOneWidget);
    });

    testWidgets('full motion: the old question slides out as the new one comes in, and only one stays', (tester) async {
      await _open(tester, reduced: false);
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.text('Dart'));
      await tester.pump(const Duration(milliseconds: 1500));
      await tester.tap(_key);
      await tester.pump(const Duration(milliseconds: 100));
      // Mid-swap both are drawn; the one leaving takes no taps.
      expect(find.text(MobExplainerCopy.foldTitle), findsOneWidget);
      expect(find.text(MobExplainerCopy.nameTitle), findsOneWidget);
      expect(find.ancestor(of: find.text(MobExplainerCopy.foldTitle), matching: find.byWidgetPredicate((w) => w is IgnorePointer && w.ignoring)), findsWidgets);
      await tester.pump(const Duration(milliseconds: 900));
      expect(find.text(MobExplainerCopy.foldTitle), findsNothing);
      expect(find.text(MobExplainerCopy.nameTitle), findsOneWidget);
      // Leave nothing running behind the test.
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 1));
    });
  });
}
