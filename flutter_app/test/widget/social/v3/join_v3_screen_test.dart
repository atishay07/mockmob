// J1 Join with a code (spec 5.3): typing and pasting, the boxes growing to eight, the preview with no
// names, the four failure states with their sentences, the Fold and name to join as, and the server's
// own errors on the key.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_repository.dart' show mobRepositoryProvider;
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/data/mob_v3_models.dart';
import 'package:mockmob/features/social/v3/screens/join_v3_screen.dart';
import 'package:mockmob/features/social/v3/widgets/code_boxes.dart';
import 'package:mockmob/features/social/v3/widgets/fold_picker.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

Finder get _field => find.descendant(of: find.byType(CodeBoxes), matching: find.byType(TextField));
int _boxes(WidgetTester t) => find.descendant(of: find.byType(CodeBoxes), matching: find.byType(AnimatedContainer)).evaluate().length;

Future<SocialServer> _open(WidgetTester tester, {String code = '', SocialServer? server, String scenario = 'fresh'}) async {
  final s = server ?? SocialServer(scenario: scenario);
  await pumpSocial(tester, JoinV3Screen(code: code), s);
  await settleSocial(tester);
  return s;
}

void main() {
  setUpAll(loadFoldManifestForTest);

  group('the code', () {
    testWidgets('empty: the line, six boxes, no preview and no Join key', (tester) async {
      await _open(tester);
      expect(find.text(MobV3Copy.joinTitle), findsOneWidget);
      expect(find.text(MobV3Copy.joinLine), findsOneWidget);
      expect(_boxes(tester), 6);
      expect(find.text(MobV3Copy.pickWho), findsNothing);
      expect(find.byKey(const ValueKey('j1-join')), findsNothing);
    });

    testWidgets('typing six characters shows them as K7P 2M9 and, after a short pause, the preview', (tester) async {
      final semantics = tester.ensureSemantics();
      final server = await _open(tester);
      // Typed one character at a time, like a thumb (a jump of several characters is a paste).
      await tester.enterText(_field, 'k7p2m');
      await tester.enterText(_field, 'k7p2m9');
      await tester.pump(const Duration(milliseconds: 100));
      // Typing waits a moment before asking.
      expect(server.calls.where((c) => c.startsWith('preview')), isEmpty);
      expect(tester.getSemantics(find.byType(CodeBoxes)).value, 'K7P 2M9');
      await tester.pump(const Duration(milliseconds: 500));
      await settleSocial(tester);
      expect(server.calls.where((c) => c.startsWith('preview')).toList(), ['preview:K7P2M9']);
      expect(find.text(MobV3Copy.seatsTaken(3)), findsOneWidget);
      semantics.dispose();
    });

    testWidgets('a pasted link is accepted and asked at once', (tester) async {
      final server = await _open(tester);
      await tester.enterText(_field, 'https://www.mockmob.in/join/K7P2M9');
      await tester.pump(const Duration(milliseconds: 50));
      await settleSocial(tester);
      expect(server.calls, contains('preview:K7P2M9'));
      expect((tester.widget<TextField>(_field).controller)!.text, 'K7P2M9');
    });

    testWidgets('a pasted 8-character code grows the boxes to eight', (tester) async {
      final server = await _open(tester);
      await tester.enterText(_field, 'k7p2-m9xy');
      await tester.pump(const Duration(milliseconds: 50));
      await settleSocial(tester);
      expect(_boxes(tester), 8);
      expect(server.calls, contains('preview:K7P2M9XY'));
    });

    testWidgets('a seventh character grows the boxes, and a sixth followed by a seventh is never asked', (tester) async {
      final server = await _open(tester);
      await tester.enterText(_field, 'K7P2M');
      await tester.enterText(_field, 'K7P2M9');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(_field, 'K7P2M9X');
      await tester.pump(const Duration(milliseconds: 600));
      await settleSocial(tester);
      expect(_boxes(tester), 8);
      expect(server.calls.where((c) => c.startsWith('preview')), isEmpty);
    });

    testWidgets('a code given by a link opens already checked', (tester) async {
      final server = await _open(tester, code: 'https://www.mockmob.in/join/K7P2M9');
      expect(server.calls, contains('preview:K7P2M9'));
      expect(find.text(MobV3Copy.pickWho), findsOneWidget);
    });

    testWidgets('editing the code clears the preview', (tester) async {
      await _open(tester, code: 'K7P2M9');
      expect(find.text(MobV3Copy.pickWho), findsOneWidget);
      await tester.enterText(_field, 'K7P2M');
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text(MobV3Copy.pickWho), findsNothing);
      expect(find.byKey(const ValueKey('j1-join')), findsNothing);
    });
  });

  group('the preview', () {
    testWidgets('names the Mob and its seats and never a member', (tester) async {
      await _open(tester, code: 'K7P2M9');
      expect(find.text('Steady Kites, Accountancy'), findsOneWidget);
      expect(find.text('3 of 5 seats taken'), findsOneWidget);
      for (final name in ['Riya', 'Kabir', 'Zoya', 'Aarav']) {
        // Aarav is the student typing into the name field, so only look outside the field.
        if (name == 'Aarav') continue;
        expect(find.textContaining(name), findsNothing, reason: '$name must not appear in the preview');
      }
      expect(find.byType(JoinPreviewCard), findsOneWidget);
      // The Folds of the members stand as silhouettes: three of them in the card.
      expect(find.descendant(of: find.byType(JoinPreviewCard), matching: find.textContaining('Riya')), findsNothing);
    });

    testWidgets('the inviter is not named either', (tester) async {
      final server = SocialServer(scenario: 'fresh', previews: {
        'K7P2M9': const JoinPreview(status: 'valid', subjectName: 'Accountancy', name: 'Chai Circle', size: 3, seatsLeft: 2, inviter: 'Aarav', folds: [FoldKey.patang, FoldKey.naav, FoldKey.cutting]),
      });
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text('Chai Circle, Accountancy'), findsOneWidget);
      expect(find.textContaining('saved you a seat'), findsNothing);
    });

    testWidgets('Pick who you will be: the four starters, then a name, the privacy line and the key', (tester) async {
      await _open(tester, code: 'K7P2M9');
      expect(find.text(MobV3Copy.pickWho), findsOneWidget);
      for (final f in FoldKey.starters) {
        expect(find.text(MobV3Copy.foldName(f)), findsOneWidget);
      }
      expect(find.text(MobV3Copy.foldName(FoldKey.hop)), findsNothing);
      expect(find.text(MobV3Copy.joinPrivacy), findsOneWidget);
      expect(find.text(MobV3Copy.joinKey('Steady Kites')), findsOneWidget);
    });

    testWidgets('the Folds you own are offered, and only those', (tester) async {
      // In this scenario the quest is done, so the Mob has already given Hop.
      final server = SocialServer(scenario: 'questdone');
      server.denNow(); // the den was read before the student came here, so the quest has paid out
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text(MobV3Copy.foldName(FoldKey.hop)), findsOneWidget);
      expect(find.text(MobV3Copy.foldName(FoldKey.crane)), findsNothing);
    });
  });

  group('a code that does not work', () {
    testWidgets('expired', (tester) async {
      await _open(tester, code: 'EXP1RE');
      expect(find.text(MobV3Copy.joinCodeExpired), findsOneWidget);
      expect(find.text(MobV3Copy.joinStartOwn), findsOneWidget);
      expect(find.byKey(const ValueKey('j1-join')), findsNothing);
    });

    testWidgets('full', (tester) async {
      final server = SocialServer(scenario: 'fresh', previews: {'K7P2M9': const JoinPreview(status: 'full')});
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text(MobV3Copy.errors['MOB_FULL']!), findsOneWidget);
      expect(find.byKey(const ValueKey('j1-join')), findsNothing);
    });

    testWidgets('invalid', (tester) async {
      final server = SocialServer(scenario: 'fresh', previews: {'K7P2M9': const JoinPreview(status: 'invalid')});
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text(MobV3Copy.joinCodeInvalid), findsOneWidget);
    });

    testWidgets('paused', (tester) async {
      final server = SocialServer(scenario: 'fresh', previews: {'K7P2M9': const JoinPreview(status: 'paused')});
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text(MobV3Copy.joinPaused), findsOneWidget);
      expect(find.byKey(const ValueKey('j1-join')), findsNothing);
    });

    testWidgets('a server error that is about the code says so in its sentence', (tester) async {
      final server = SocialServer(scenario: 'fresh', failures: {'joinPreview': 'JOIN_PAUSED'});
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text(MobV3Copy.joinPaused), findsOneWidget);
    });

    testWidgets('a server fault is a state of the call: a plain sentence and Try again', (tester) async {
      final server = SocialServer(scenario: 'fresh', failures: {'joinPreview': 'SOMETHING_ELSE'});
      await _open(tester, code: 'K7P2M9', server: server);
      expect(find.text(MobV3Copy.generic), findsOneWidget);
      expect(find.byKey(const ValueKey('j1-retry')), findsOneWidget);
    });

    testWidgets('the boxes keep the code so a character can be fixed', (tester) async {
      await _open(tester, code: 'EXP1RE');
      expect((tester.widget<TextField>(_field).controller)!.text, 'EXP1RE');
    });
  });

  group('joining', () {
    testWidgets('one call with the code, your first name, a colour and the Fold you picked', (tester) async {
      final server = await _open(tester, code: 'K7P2M9');
      await tester.tap(find.text('Hexa'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('j1-join')));
      await settleSocial(tester);
      final joins = server.calls.where((c) => c.startsWith('join:')).toList();
      expect(joins, hasLength(1));
      expect(joins.single, 'join:K7P2M9:Aarav:6:hexa');
      // Opened on its own (an invite link), there is nothing to go back to: the Mob opens over it (walk 20 Oct).
      final container = ProviderScope.containerOf(tester.element(find.byType(JoinV3Screen, skipOffstage: false)));
      expect(container.read(mobRepositoryProvider).value?.v3?.name.text, 'Steady Kites');
    });

    testWidgets('a name that fails the rule is said under the field and nothing is sent', (tester) async {
      final server = await _open(tester, code: 'K7P2M9');
      await tester.enterText(find.byType(TextField).last, 'A');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('j1-join')));
      await settleSocial(tester);
      expect(find.text(MobCopy.nameRule), findsOneWidget);
      expect(server.calls.where((c) => c.startsWith('join:')), isEmpty);
    });

    testWidgets('FOLD_LOCKED on the key: the server sentence, inline', (tester) async {
      final server = SocialServer(scenario: 'fresh', failures: {'join': 'FOLD_LOCKED'});
      await _open(tester, code: 'K7P2M9', server: server);
      await tester.tap(find.byKey(const ValueKey('j1-join')));
      await settleSocial(tester);
      expect(find.text(MobV3Copy.errors['FOLD_LOCKED']!), findsOneWidget);
      expect(find.byKey(const ValueKey('j1-join')), findsOneWidget);
    });

    testWidgets('a code that expired between the preview and the key turns the page to the sentence', (tester) async {
      final server = SocialServer(scenario: 'fresh', failures: {'join': 'INVITE_EXPIRED'});
      await _open(tester, code: 'K7P2M9', server: server);
      await tester.tap(find.byKey(const ValueKey('j1-join')));
      await settleSocial(tester);
      expect(find.text(MobV3Copy.joinCodeExpired), findsOneWidget);
      expect(find.byKey(const ValueKey('j1-join')), findsNothing);
    });

    testWidgets('the Mob filling up between the preview and the key says it is full', (tester) async {
      final server = SocialServer(scenario: 'fresh', failures: {'join': 'MOB_FULL'});
      await _open(tester, code: 'K7P2M9', server: server);
      await tester.tap(find.byKey(const ValueKey('j1-join')));
      await settleSocial(tester);
      expect(find.text(MobV3Copy.errors['MOB_FULL']!), findsOneWidget);
    });
  });

  testWidgets('narrow phone and large text: no overflow, with a preview and with eight boxes', (tester) async {
    final server = SocialServer(scenario: 'fresh');
    await pumpSocial(tester, const JoinV3Screen(code: 'K7P2M9XY'), server, size: const Size(320, 700), scale: 1.3);
    await settleSocial(tester);
    expect(tester.takeException(), isNull);
    expect(find.byType(FoldPickerRow), findsOneWidget);
  });
}
