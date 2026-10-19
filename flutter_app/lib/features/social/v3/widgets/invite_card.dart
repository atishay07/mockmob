// The WhatsApp invite card (spec 5.3 D5): the group art with the wordmark, "Aarav saved you a seat in
// Chai Circle", "An Accountancy Mob on MockMob. Code K7P 2M9." It is drawn on screen as a preview and
// rendered off-screen to a PNG (a RepaintBoundary, three times the layout size) for the system share
// sheet, with the WhatsApp message beside it. The wordmark is the brand's painted logo, never text.

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/haptics/haptics.dart';
import '../../../../core/platform/share_image.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../data/mob_navigator.dart';
import '../../widgets/mob_parts.dart' show showMobToast;
import '../copy_v3.dart';
import '../data/mob_v3_api.dart';
import '../data/mob_v3_den.dart';

const String inviteArtAsset = 'assets/art/group-desk.webp';

/// The card as drawn on screen (the preview in D5), and the picture that is shared.
class InviteCardPreview extends StatelessWidget {
  const InviteCardPreview({super.key, required this.youName, required this.mobName, required this.subjectName, required this.display});

  final String youName;
  final String mobName;
  final String subjectName;

  /// "K7P 2M9".
  final String display;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: '${MobV3Copy.inviteCardTitle(youName, mobName)}. ${MobV3Copy.inviteCardLineFor(subjectName, display)}',
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: c.raised,
            borderRadius: MmRadius.panelAll,
            border: Border.all(color: c.line),
            boxShadow: c.cardShadow,
          ),
          child: ClipRRect(
            borderRadius: MmRadius.panelAll,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AspectRatio(
                  aspectRatio: 3 / 2,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.asset(inviteArtAsset, fit: BoxFit.cover, filterQuality: FilterQuality.medium, errorBuilder: (_, _, _) => ColoredBox(color: c.raised2)),
                      // A functional scrim so the wordmark reads on any part of the art.
                      Positioned(
                        left: 0,
                        top: 0,
                        right: 0,
                        height: 76,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [const Color(0x99000000), const Color(0x00000000)]),
                          ),
                        ),
                      ),
                      const Positioned(left: 16, top: 14, child: Wordmark(height: 26, color: Color(0xFFF4F0E6))),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(MobV3Copy.inviteCardTitle(youName, mobName), style: type.cardTitle.copyWith(color: c.ink)),
                      const SizedBox(height: MmSpace.s4),
                      Text(MobV3Copy.inviteCardLineFor(subjectName, display), style: type.caption.copyWith(color: c.ink2)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// What the card says, from the den.
({String you, String mob, String subject})? _inviteFacts(ProviderContainer container) {
  final den = container.read(denViewProvider);
  if (den == null || den.mob == null) return null;
  final you = den.v3.you?.name ?? den.mob!.you.name;
  final mob = den.v3.name.text.isEmpty ? den.subjectName : den.v3.name.text;
  return (you: you, mob: mob, subject: den.subjectName);
}

/// Renders the card to a PNG, three times its 360 dp layout width, on an off-screen overlay entry.
/// Null when it cannot (no overlay, a render failure): the caller then shares the message alone.
Future<Uint8List?> renderInviteCardPng(BuildContext context, {required String you, required String mob, required String subject, required String display}) async {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return null;
  final key = GlobalKey();
  // The picture is always the Night card at normal text size, whatever the phone is set to, so every
  // friend sees the same card.
  final entry = OverlayEntry(
    builder: (ctx) => Positioned(
      left: -4000,
      top: 0,
      width: 360,
      child: Theme(
        data: buildTheme(Brightness.dark),
        child: MediaQuery(
          data: MediaQuery.of(ctx).copyWith(textScaler: TextScaler.noScaling),
          child: Material(
            type: MaterialType.transparency,
            child: RepaintBoundary(
              key: key,
              child: ColoredBox(
                color: const Color(0xFF12110E),
                child: Padding(padding: const EdgeInsets.all(MmSpace.s12), child: InviteCardPreview(youName: you, mobName: mob, subjectName: subject, display: display)),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  try {
    try {
      await precacheImage(const AssetImage(inviteArtAsset), context);
    } on Object {
      // The card still renders with its plain ground.
    }
    for (var i = 0; i < 2; i++) {
      SchedulerBinding.instance.scheduleFrame();
      await SchedulerBinding.instance.endOfFrame;
    }
    return await capturePng(key, pixelRatio: 3);
  } on Object {
    return null;
  } finally {
    entry.remove();
  }
}

/// Fetches an invite, renders the card to PNG and opens the share sheet (WhatsApp first).
Future<void> shareInviteCard(BuildContext context) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final facts = _inviteFacts(container);
  final den = container.read(denViewProvider);
  if (facts == null || den == null) return;
  try {
    final invite = await container.read(mobV3ApiProvider).invite(den.mobId);
    if (!context.mounted) return;
    final text = MobV3Copy.inviteShare(facts.you, facts.mob, facts.subject, invite.display, invite.url);
    final png = await renderInviteCardPng(context, you: facts.you, mob: facts.mob, subject: facts.subject, display: invite.display);
    final shared = png != null
        ? await container.read(shareSurfaceProvider).shareImage(png: png, name: 'mockmob-invite.png', text: text)
        : await container.read(mobNavigatorProvider).shareLink(text);
    if (!shared && context.mounted) showMobToast(context, MobV3Copy.generic);
  } on Object catch (e) {
    if (context.mounted) showMobToast(context, MobV3Copy.error(e));
  }
}

/// Fetches an invite and copies its code; returns the display code or null.
Future<String?> copyInviteCode(BuildContext context, {bool aboveBar = false}) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final den = container.read(denViewProvider);
  if (den == null) return null;
  try {
    final invite = await container.read(mobV3ApiProvider).invite(den.mobId);
    await Clipboard.setData(ClipboardData(text: invite.display));
    container.read(hapticsProvider).confirm();
    if (context.mounted) showMobToast(context, MobV3Copy.codeCopied, aboveBar: aboveBar);
    return invite.display;
  } on Object catch (e) {
    if (context.mounted) showMobToast(context, MobV3Copy.error(e), aboveBar: aboveBar);
    return null;
  }
}
