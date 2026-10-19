// The invite card (spec 5.3 D5): its words, the PNG rendered off-screen for the share sheet with the
// WhatsApp message beside it, and Copy the code with its quiet toast.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/platform/share_image.dart';
import 'package:mockmob/features/social/v3/copy_v3.dart';
import 'package:mockmob/features/social/v3/widgets/invite_card.dart';

import '../../../unit/social/v3/mob_v3_test_kit.dart';
import '../../../unit/social/v3/social_test_kit.dart';

class _FakeShare implements ShareSurface {
  Uint8List? png;
  String? name;
  String? text;

  @override
  Future<bool> shareImage({required Uint8List png, required String name, required String text}) async {
    this.png = png;
    this.name = name;
    this.text = text;
    return true;
  }
}

class _Host extends StatelessWidget {
  const _Host({required this.onShare, required this.onCopy});

  final void Function(BuildContext) onShare;
  final void Function(BuildContext) onCopy;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Column(children: [
          Builder(builder: (c) => TextButton(onPressed: () => onShare(c), child: const Text('share'))),
          Builder(builder: (c) => TextButton(onPressed: () => onCopy(c), child: const Text('copy'))),
        ]),
      );
}

void main() {
  setUpAll(loadFoldManifestForTest);

  testWidgets('the card says who saved you a seat, in which Mob, and the code', (tester) async {
    await pumpSocial(
      tester,
      const InviteCardPreview(youName: 'Aarav', mobName: 'Chai Circle', subjectName: 'Accountancy', display: 'K7P 2M9'),
      SocialServer(scenario: 'one'),
    );
    expect(find.text('Aarav saved you a seat in Chai Circle'), findsOneWidget);
    expect(find.text('An Accountancy Mob on MockMob. Code K7P 2M9.'), findsOneWidget);
    // The wordmark is the painted logo, never live text.
    expect(find.text('mockmob'), findsNothing);
  });

  testWidgets('an article that fits the subject: An for a vowel, A for a consonant', (tester) async {
    expect(MobV3Copy.inviteCardLineFor('Economics', 'K7P 2M9'), 'An Economics Mob on MockMob. Code K7P 2M9.');
    expect(MobV3Copy.inviteCardLineFor('Business Studies', 'K7P 2M9'), 'A Business Studies Mob on MockMob. Code K7P 2M9.');
  });

  testWidgets('Copy the code puts the code on the clipboard and says so quietly', (tester) async {
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String?;
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));
    String? result;
    await pumpSocial(tester, _Host(onShare: (_) {}, onCopy: (c) async => result = await copyInviteCode(c)), SocialServer(scenario: 'one'));
    await tester.tap(find.text('copy'));
    await settleSocial(tester);
    expect(copied, 'K7P 2M9');
    expect(result, 'K7P 2M9');
    expect(find.text(MobV3Copy.codeCopied), findsOneWidget);
    // The toast is plain: no price, no exclamation.
    expect(MobV3Copy.codeCopied, 'The code is copied.');
  });

  testWidgets('Share renders the card to a PNG and hands it to the share sheet with the WhatsApp message', (tester) async {
    final share = _FakeShare();
    await pumpSocial(tester, _Host(onShare: (c) => shareInviteCard(c), onCopy: (_) {}), SocialServer(scenario: 'one'), extra: [shareSurfaceProvider.overrideWithValue(share)]);
    await tester.tap(find.text('share'));
    for (var i = 0; i < 60 && share.png == null; i++) {
      await tester.pump(const Duration(milliseconds: 40));
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 40)));
    }
    expect(share.png, isNotNull, reason: 'the card was rendered and shared');
    // A PNG, three times the 360 dp card width.
    final p = share.png!;
    expect(p.sublist(0, 8), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    final size = await tester.runAsync(() async {
      final img = await decodeImageFromList(p);
      final r = (w: img.width, h: img.height);
      img.dispose();
      return r;
    });
    expect(size!.w, 1080);
    expect(size.h, greaterThan(900));
    expect(share.name, 'mockmob-invite.png');
    expect(share.text, MobV3Copy.inviteShare('Aarav', 'Chai Circle', 'Accountancy', 'K7P 2M9', 'https://www.mockmob.in/join/K7P2M9'));
    expect(share.text, contains('K7P 2M9'));
    expect(share.text, contains('https://www.mockmob.in/join/K7P2M9'));
    // The off-screen entry is gone again.
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(InviteCardPreview), findsNothing);
  });
}
