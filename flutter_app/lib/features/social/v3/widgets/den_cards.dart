// The den's card under the stage (spec 5.3 D1 to D5) and D6's failed card. Which one shows is
// decided by logic/den_copy_state.dart; this file only draws it and wires its keys. One volt thing:
// the card's primary key. Every sentence comes from MobV3Copy.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/api/api.dart';
import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/motion.dart';
import '../../../../core/motion/motion_tokens.g.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../../core/auth/auth_state.dart';
import '../../../pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import '../../copy.dart';
import '../../data/mob_models.dart';
import '../../data/mob_navigator.dart';
import '../../widgets/mob_pro_entry.dart' show sayMobFailure;
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/den_copy_state.dart';
import '../mob_v3_nav.dart';
import 'fold_manifest.dart';
import 'free_pro_sheet.dart' show showFreeProSheet;
import 'invite_card.dart';
import 'sheet_parts.dart' show LinkKey;
import 'sit_mock_sheet.dart' show mockSitCost;
import 'v4_sheet_hooks.dart';
import 'start_game_sheet.dart';
import 'sticker_row.dart';

/// The den's card for [card]. [now] is the app clock (times are IST, 12-hour).
class DenCardView extends ConsumerStatefulWidget {
  const DenCardView({super.key, required this.card, required this.v3, required this.mob, required this.now});

  final DenCard card;
  final MobV3 v3;
  final Mob mob;
  final DateTime now;

  @override
  ConsumerState<DenCardView> createState() => _DenCardViewState();
}

class _DenCardViewState extends ConsumerState<DenCardView> {
  bool _sitting = false;
  bool _asking = false;
  String? _note;

  MobV3 get v3 => widget.v3;
  DenCard get card => widget.card;

  Future<void> _sit() async {
    if (_sitting) return;
    setState(() => _sitting = true);
    final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, widget.mob);
    if (!mounted) return;
    setState(() => _sitting = false);
    if (failure != null) sayMobFailure(context, failure, MobCopy.failure(failure, sell: ref.read(proNudgesOnProvider)));
  }

  Future<void> _askAgain() async {
    if (_asking) return;
    setState(() => _asking = true);
    try {
      final sent = await ref.read(mobV3ActionsProvider).sticker(StickerKind.again);
      if (!mounted) return;
      if (sent) {
        final you = v3.you?.memberId;
        final bus = ref.read(stickerBusProvider);
        if (you != null && bus.heard) bus.post(you, StickerKind.again);
        setState(() => _note = MobV3Copy.stickerSent);
        ref.read(hapticsProvider).confirm();
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _note = MobV3Copy.error(e));
    } on Object {
      if (mounted) setState(() => _note = MobV3Copy.generic);
    } finally {
      if (mounted) setState(() => _asking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final g = card.game;
    final now = widget.now;
    final children = <Widget>[];
    switch (card.kind) {
      case DenCardKind.quiet:
        final friends = [for (final m in v3.members) if (!m.you) m.name];
        children
          ..add(
            _MobiPointing(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(header: true, child: Text(card.fresh ? MobV4DenCopy.freshTitle : MobV3Copy.quietTitle, style: type.subhead.copyWith(color: colors.ink))),
                  const SizedBox(height: MmSpace.s8),
                  Text(card.fresh ? MobV4DenCopy.freshLine(friends.take(2).toList()) : MobV3Copy.quietLine, style: type.body.copyWith(color: colors.ink2)),
                ],
              ),
            ),
          )
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: const ValueKey('den-start-key'), label: MobV3Copy.startAGame, onPressed: () => showStartGame(context)))
          ..add(const SizedBox(height: MmSpace.s4));
      case DenCardKind.cantStart:
        children
          ..add(Text(MobV3Copy.askTitle, style: type.subhead.copyWith(color: colors.ink)))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(Text(MobV3Copy.askLine, style: type.body.copyWith(color: colors.ink2)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.askKey, loading: _asking, hapticOnCommit: false, onPressed: _askAgain))
          ..add(const SizedBox(height: MmSpace.s4));
      case DenCardKind.open:
        final raced = [for (final r in g!.runs) if (r.memberId != v3.you?.memberId && r.memberId != g.host?.memberId) r];
        children
          ..add(_HostLine(game: g, v3: v3, title: MobV4DenCopy.opened(g)))
          ..add(const SizedBox(height: MmSpace.s12))
          // Full card width (not indented under the head disc): one line less at 360 dp (H5).
          ..add(Text(keepTimes(MobV4DenCopy.openLine(g, now)), style: type.body.copyWith(color: colors.ink2)));
        // The price at the point of choice (D174, D175), the server's number and the student's balance. A Free
        // member also gets one honest way to Pro under the key; Pro reads "included". No price sent: no line.
        final cost = mockSitCost(g, v3.starts);
        final priced = g.format == GameFormat.mock && g.yourRun == YourRun.none && v3.starts.billingOn && (g.costCredits != null || v3.starts.mockSitCredits != null);
        final proSits = priced && v3.starts.via == StartVia.pro;
        final costStyle = type.label.copyWith(color: colors.ink, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]);
        if (priced && (cost > 0 || proSits)) {
          final have = ref.watch(authSnapshotProvider.select((s) => s.creditBalance));
          children
            ..add(const SizedBox(height: MmSpace.s8))
            ..add(Text(proSits ? MobV4DenCopy.sitIncludedPro : MobV4DenCopy.sitCostLine(cost, have), key: const ValueKey('den-sit-cost'), style: costStyle));
        }
        final proWay = priced && cost > 0 && ref.watch(proNudgesOnProvider);
        if (raced.isNotEmpty) {
          children
            ..add(const SizedBox(height: MmSpace.s12))
            ..add(_RacedRow(members: [for (final r in raced) v3.member(r.memberId)], text: MobV4DenCopy.raced([for (final r in raced) r.name], mock: g.format == GameFormat.mock)));
        }
        children
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: const ValueKey('den-play-key'), label: MobV3Copy.playKey(g), onPressed: () => MobV3Nav.play(context, g)));
        if (proWay) {
          children
            ..add(const SizedBox(height: MmSpace.s4))
            ..add(LinkKey(key: const ValueKey('den-sit-pro'), label: MobV4DenCopy.sitFreeWithPro, alignment: Alignment.center, onPressed: () => showFreeProSheet(context)));
        }
        children.add(const SizedBox(height: MmSpace.s4));
      case DenCardKind.fix:
      case DenCardKind.check:
        final f = card.fix!;
        final check = card.kind == DenCardKind.check;
        children
          ..add(Semantics(header: true, child: Text(check ? MobV4DenCopy.checkTitle : MobV4DenCopy.fixTitle, style: type.subhead.copyWith(color: colors.ink))))
          ..add(const SizedBox(height: MmSpace.s8))
          ..add(Text(check ? MobV4DenCopy.checkLine(f.question) : MobV4DenCopy.fixLine(f.question), style: type.body.copyWith(color: colors.ink2)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: ValueKey(check ? 'den-check-key' : 'den-fix-key'), label: check ? MobV4DenCopy.checkKey : MobV4DenCopy.fixKey(f.question), onPressed: () => MobV3Nav.fix(context, f.gameId, f.question - 1)))
          ..add(const SizedBox(height: MmSpace.s4));
      case DenCardKind.paper:
        final paper = widget.mob.week.paper;
        children
          ..add(Semantics(header: true, child: Text(MobV4DenCopy.paperTitle, style: type.subhead.copyWith(color: colors.ink))))
          ..add(const SizedBox(height: MmSpace.s8))
          ..add(Text(MobV4DenCopy.paperLine(paper.count, (paper.durationSec / 60).round(), v3.name.text.isEmpty ? 'your Mob' : v3.name.text), style: type.body.copyWith(color: colors.ink2)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: const ValueKey('den-paper-key'), label: MobV4DenCopy.paperKey, loading: _sitting, onPressed: _sit))
          ..add(const SizedBox(height: MmSpace.s4));
      case DenCardKind.played:
        final yours = _yourRunAt(g!);
        children
          ..add(_HostLine(game: g, v3: v3, title: _titleOf(g)))
          ..add(const SizedBox(height: MmSpace.s4));
        if (yours != null && g.closesAt != null) {
          children.add(
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s4),
              child: Text(keepTimes(MobV3Copy.playedAt(yours, g.closesAt!, now)), style: type.body.copyWith(color: colors.ink2)),
            ),
          );
        }
        children
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: const ValueKey('den-podium-key'), label: g.format == GameFormat.mock ? MobV3Copy.seeMarkSheets : MobV4DenCopy.seeWhereYouStand, onPressed: () => MobV3Nav.podium(context, g.id)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(StickerRow(gameId: g.id));
      case DenCardKind.live:
        children
          ..add(_HostLine(game: g!, v3: v3, title: MobV3Copy.liveOpened(g), live: true))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s4),
              child: Text(MobV3Copy.liveLine(g), style: type.body.copyWith(color: colors.ink2)),
            ),
          )
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: const ValueKey('den-join-room'), label: MobV3Copy.joinRoom(g), onPressed: () => MobV3Nav.room(context, g.id)));
        if (g.closesAt != null) {
          children
            ..add(const SizedBox(height: MmSpace.s12))
            ..add(
              Text(
                keepTimes(MobV3Copy.playLater(g.closesAt!, now)),
                textAlign: TextAlign.center,
                style: type.label.copyWith(color: colors.ink2),
              ),
            );
        }
      case DenCardKind.liveRunning:
        children
          ..add(_HostLine(game: g!, v3: v3, title: MobV3Copy.liveOpened(g), live: true))
          ..add(const SizedBox(height: MmSpace.s4));
        final started = g.room?.startsAt;
        if (started != null && g.closesAt != null) {
          children.add(
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s4),
              child: Text(keepTimes(MobV3Copy.roomStarted(started, g.closesAt!, now)), style: type.body.copyWith(color: colors.ink2)),
            ),
          );
        }
        children
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.playItNow, onPressed: () => MobV3Nav.run(context, g.id)));
      case DenCardKind.one:
        // V4 3.1 step 9: a Mob of one gets the same Now card as every other step. The invite is the one volt
        // key; copying the code is a quiet text key. The week's paper and any game of yours are rows below.
        final code = widget.mob.invite?.code;
        children
          ..add(Semantics(header: true, child: Text(MobV3Copy.oneTitle, style: type.subhead.copyWith(color: colors.ink))))
          ..add(const SizedBox(height: MmSpace.s8))
          ..add(Text(MobV3Copy.oneLine, style: type.body.copyWith(color: colors.ink2)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(key: const ValueKey('den-invite-key'), label: MobV3Copy.inviteWhatsApp, onPressed: () => shareInviteCard(context)));
        if (code != null) {
          children
            ..add(const SizedBox(height: MmSpace.s4))
            // One toast, above the dock (it said it twice, the second over the bar: L6).
            ..add(LinkKey(key: const ValueKey('den-copy-code'), label: MobV3Copy.copyCode, alignment: Alignment.center, onPressed: () => copyInviteCode(context, aboveBar: true)));
        }
        children.add(const SizedBox(height: MmSpace.s4));
    }
    if (_note != null) {
      children
        ..add(const SizedBox(height: MmSpace.s8))
        ..add(
          Text(
            _note!,
            textAlign: TextAlign.center,
            style: type.caption.copyWith(color: colors.ink2),
          ),
        );
    }
    return DenPaperCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children),
    );
  }

  bool _mine(MobGameSummary g) => g.host == null || g.host!.you || g.host!.memberId == v3.you?.memberId;

  /// "Your sprint" for a game you opened (the server may name you), else the server's title.
  String _titleOf(MobGameSummary g) {
    if (_mine(g)) return 'Your ${MobV3Copy.gameKind(g.format)}';
    return (g.title?.isNotEmpty ?? false) ? g.title! : MobV3Copy.gameTitle(g);
  }

  DateTime? _yourRunAt(MobGameSummary g) {
    final you = v3.you?.memberId;
    for (final r in g.runs) {
      if (r.memberId == you) return r.at;
    }
    return null;
  }
}

/// Keeps a clock time whole on one line ("4:55 PM", never "4:55" and "PM" apart).
String keepTimes(String s) => s.replaceAllMapped(RegExp(r'(\d) (AM|PM)'), (m) => '${m[1]} ${m[2]}');

/// The host's head disc and the card title ("Riya opened a sprint").
class _HostLine extends ConsumerWidget {
  const _HostLine({required this.game, required this.v3, required this.title, this.live = false});

  final MobGameSummary game;
  final MobV3 v3;
  final String title;
  final bool live;

  static const double disc = 44;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final host = game.host == null ? null : v3.member(game.host!.memberId);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        HeadDisc(member: host, size: disc, live: live),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Semantics(
            header: true,
            child: Text(title, style: type.subhead.copyWith(color: colors.ink)),
          ),
        ),
      ],
    );
  }
}

/// A member's head disc: their Fold's head on their colour, or their initial (spec 5.2 fallback).
class HeadDisc extends ConsumerWidget {
  const HeadDisc({super.key, required this.member, this.size = 44, this.live = false});

  final MobV3Member? member;
  final double size;

  /// A small "here now" dot (live rooms): lamp, never volt (the key is the volt thing).
  final bool live;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final m = member;
    final manifest = foldManifestOf(ref);
    final head = m == null ? null : manifest?.folds[m.fold]?.head;
    final tint = m == null ? colors.raised2 : MobColours.of(context, m.colour).withValues(alpha: colors.isNight ? 0.30 : 0.22);
    return ExcludeSemantics(
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: tint,
                shape: BoxShape.circle,
                border: Border.all(color: colors.line),
              ),
              clipBehavior: Clip.antiAlias,
              alignment: Alignment.center,
              child: head != null
                  ? Transform.translate(
                      offset: Offset(0, size * 0.06),
                      child: Image.asset(head, width: size * 0.92, height: size * 0.92, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
                    )
                  : Text(
                      m?.initial ?? '?',
                      style: context.mmType.label.copyWith(color: colors.ink, fontSize: size * 0.4, fontWeight: FontWeight.w700),
                    ),
            ),
            if (live)
              Positioned(
                right: -1,
                bottom: -1,
                child: Container(
                  width: size * 0.3,
                  height: size * 0.3,
                  decoration: BoxDecoration(
                    color: colors.lamp,
                    shape: BoxShape.circle,
                    border: Border.all(color: colors.raised, width: 2),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TickRule extends CustomPainter {
  _TickRule({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = colour
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, 0.5), Offset(size.width, 0.5), p);
    for (var x = 0.0, i = 0; x <= size.width; x += 8, i++) {
      canvas.drawLine(Offset(x, 0.5), Offset(x, i % 5 == 0 ? 6 : 3.5), p);
    }
  }

  @override
  bool shouldRepaint(_TickRule old) => old.colour != colour;
}

/// The den's card surface: raised paper with a hairline, a lamp-lit top edge and a folded corner.
class DenPaperCard extends StatelessWidget {
  const DenPaperCard({super.key, required this.child, this.padding = const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s16, MmSpace.s20, MmSpace.s12)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return CustomPaint(
      foregroundPainter: _CornerFold(colour: colors.isNight ? colors.raised2 : const Color(0xFFEDE6D6), edge: colors.line),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: colors.line),
          boxShadow: colors.cardShadow,
        ),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class _CornerFold extends CustomPainter {
  _CornerFold({required this.colour, required this.edge});

  final Color colour;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    const f = 14.0;
    const inset = 18.0;
    final x = size.width - inset;
    final path = Path()
      ..moveTo(x - f, 0.5)
      ..lineTo(x, 0.5)
      ..lineTo(x, f)
      ..close();
    canvas.drawPath(path, Paint()..color = colour);
    canvas.drawPath(
      path,
      Paint()
        ..color = edge
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1,
    );
  }

  @override
  bool shouldRepaint(_CornerFold old) => old.colour != colour || old.edge != edge;
}

/// A text link on the den ("More ways to play"): underlined label, 48 dp tall, centred.
class DenLink extends StatelessWidget {
  const DenLink({super.key, required this.label, required this.onTap, this.busy = false});

  final String label;
  final VoidCallback? onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Center(
      child: MmPressable(
        onTap: busy ? null : onTap,
        semanticsLabel: label,
        pressedScale: 0.97,
        haptic: MmPressHaptic.selection,
        focusRadius: BorderRadius.circular(MmRadius.small),
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
            child: Center(
              widthFactor: 1,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: type.button.copyWith(color: busy ? colors.ink3 : colors.ink, decoration: TextDecoration.underline, decorationColor: colors.ink3, decorationThickness: 1.2),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// D6 failed: "Your Mob didn't load." with "Try again".
class DenFailedCard extends StatelessWidget {
  const DenFailedCard({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return DenPaperCard(
      padding: const EdgeInsets.all(MmSpace.s20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(MobV3Copy.failed, style: type.subhead.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: MobV3Copy.tryAgain, onPressed: onRetry),
        ],
      ),
    );
  }
}

/// The ruler-tick divider and "Kabir and Zoya have raced it" with their heads (V4 3.1 item 3, version 13's
/// ruler kept). Replaces the list of run times.
class _RacedRow extends StatelessWidget {
  const _RacedRow({required this.members, required this.text});

  final List<MobV3Member?> members;
  final String text;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    const head = 28.0;
    final shown = members.take(4).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CustomPaint(size: const Size(double.infinity, 6), painter: _TickRule(colour: colors.line)),
        const SizedBox(height: MmSpace.s12),
        Semantics(
          label: text,
          child: ExcludeSemantics(
            child: Row(
              children: [
                SizedBox(
                  width: head + (shown.length - 1) * head * 0.62,
                  height: head,
                  child: Stack(
                    children: [
                      for (var i = 0; i < shown.length; i++) Positioned(left: i * head * 0.62, child: HeadDisc(member: shown[i], size: head)),
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: Text(text, style: type.label.copyWith(color: colors.ink2, fontWeight: FontWeight.w500))),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Mobi points at the card's text from the top right ("Nobody has played yet", the approved empty den): 96 dp,
/// facing left into the card, breaking the card's top edge by 24 dp (left of the paper's folded corner). It rises
/// 14 dp with the card over 360 ms; reduced motion: still.
class _MobiPointing extends StatelessWidget {
  const _MobiPointing({required this.child});

  final Widget child;

  static const String art = 'assets/art/mobi-point.webp';
  static const double size = 96;

  /// How far Mobi rises above the card's top edge (the card's own top padding is 16).
  static const double over = 24;

  @override
  Widget build(BuildContext context) {
    final still = Motion.reduced(context);
    final mobi = ExcludeSemantics(
      child: Transform.flip(
        flipX: true,
        child: Image.asset(art, width: size, height: size, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox(width: size, height: size)),
      ),
    );
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // The text keeps clear of Mobi's body; his arm reaches over its end.
        Padding(padding: const EdgeInsets.only(right: size - 26), child: child),
        Positioned(
          key: const ValueKey('den-mobi-pointing'),
          right: 4,
          top: -MmSpace.s16 - over,
          width: size,
          height: size,
          child: still
              ? mobi
              : TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 360),
                  curve: MotionCurves.emphasized,
                  builder: (context, v, c) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 14 * (1 - v)), child: c)),
                  child: mobi,
                ),
        ),
      ],
    );
  }
}

/// "Your shelf · 5 of 12 Folds · next: Patang, beat your best" (3.1 item 6, D170): the den's entry to the
/// Shelf, after the This week panel. Overlapping heads of the Folds you own lead it. Hidden until the shelf has
/// loaded (it is the last thing on the den, so nothing moves when it arrives).
class DenShelfRow extends ConsumerWidget {
  const DenShelfRow({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shelf = ref.watch(shelfProvider).value;
    if (shelf == null) return const SizedBox.shrink();
    final owned = shelf.owned;
    final next = nextFoldOf(shelf);
    final manifest = foldManifestOf(ref);
    const head = 36.0;
    const step = head * 0.6;
    final shown = owned.take(4).toList();
    final leadW = shown.isEmpty ? 44.0 : head + (shown.length - 1) * step;
    return DenRow(
      key: const ValueKey('den-row-shelf'),
      leadWidth: math.max(44, leadW),
      lead: SizedBox(
        width: leadW,
        height: head + 4,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            for (var i = 0; i < shown.length; i++)
              Positioned(
                left: i * step,
                top: 0,
                width: head + 4,
                height: head + 4,
                child: manifest?.folds[shown[i]]?.head == null
                    ? const SizedBox.shrink()
                    : Image.asset(manifest!.folds[shown[i]]!.head!, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink()),
              ),
          ],
        ),
      ),
      title: MobV4DenCopy.shelfRowTitle,
      line: MobV4DenCopy.shelfRowLine(owned.length, FoldKey.values.length, next),
      onTap: () => V4Sheets.shelf(context),
    );
  }
}

/// The Fold to show as "next": the locked one with the most progress (have of need), else the first locked one.
FoldKey? nextFoldOf(Shelf shelf) {
  ShelfFold? best;
  double bestShare = -1;
  for (final f in shelf.folds) {
    if (f.owned) continue;
    final share = (f.need ?? 0) > 0 ? (f.have ?? 0) / f.need! : 0.0;
    if (share > bestShare) {
      best = f;
      bestShare = share;
    }
  }
  if (best != null) return best.key;
  final owned = shelf.owned.toSet();
  for (final k in FoldKey.values) {
    if (!owned.contains(k)) return k;
  }
  return null;
}

/// The den rows under the Now card (V4 3.1 item 4): "Start a game" first and always (or "Invite friends" when
/// the card's key already is Start a game), then this week's paper while it is not the card, then every other
/// open game as "Also open". No "more games" or "more ways to play" links: one place for each thing.
class DenRows extends ConsumerWidget {
  const DenRows({super.key, required this.card, required this.v3, required this.mob, required this.now});

  final DenCard card;
  final MobV3 v3;
  final Mob mob;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final rows = <Widget>[];
    final seatsOpen = (5 - v3.members.length).clamp(0, 5);
    // First, always, Start a game; when Start a game is already the card's key, Invite friends instead,
    // after the week's paper (the approved empty den).
    if (!card.keyIsStart) {
      rows.add(DenRow(key: const ValueKey('den-row-start'), lead: const _RowGlyph(kind: _Glyph.start), title: MobV4DenCopy.startRowTitle, line: MobV4DenCopy.startRowLine, onTap: () => showStartGame(context)));
    }
    final week = mob.week;
    if (card.kind != DenCardKind.paper && !week.youSat) {
      rows.add(
        DenRow(
          key: const ValueKey('den-row-paper'),
          lead: const _RowGlyph(kind: _Glyph.paper),
          title: MobV4DenCopy.paperTitle,
          line: MobV4DenCopy.paperRowLine(week.paper.count, (week.paper.durationSec / 60).round()),
          onTap: () => ref.read(mobNavigatorProvider).sitPaper(context, ref, mob),
        ),
      );
    }
    // Sat this week's paper: the row stays as the way back to your answers.
    final resultId = week.yourResultId;
    if (week.youSat && resultId != null) {
      rows.add(
        DenRow(
          key: const ValueKey('den-row-paper-sat'),
          lead: const _RowGlyph(kind: _Glyph.paper),
          title: MobV4DenCopy.paperTitle,
          line: MobV4DenCopy.paperRowSat,
          onTap: () => ref.read(mobNavigatorProvider).openAnswers(context, resultId),
        ),
      );
    }
    if (card.keyIsStart && seatsOpen > 0) {
      rows.add(DenRow(key: const ValueKey('den-row-invite'), lead: const _RowGlyph(kind: _Glyph.invite), title: MobV4DenCopy.inviteRowTitle, line: MobV4DenCopy.inviteRowLine(seatsOpen), onTap: () => V4Sheets.invite(context)));
    }
    for (final g in v3.openGames) {
      // The card's own game is not repeated as a row (a Mob of one's card is the invite, so its game is a row).
      if (g.id == card.game?.id && card.kind != DenCardKind.one) continue;
      final closes = g.closesAt;
      rows.add(
        DenRow(
          key: ValueKey('den-row-game-${g.id}'),
          lead: HeadDisc(member: g.host == null ? null : v3.member(g.host!.memberId), size: 44),
          title: MobV3Copy.gameTitle(g),
          line: (closes == null ? MobV4DenCopy.alsoOpenNoTime : keepTimes(MobV4DenCopy.alsoOpen(closes, now))) + (mockSitCost(g, v3.starts) > 0 ? MobV4DenCopy.sitCostSuffix(mockSitCost(g, v3.starts)) : ''),
          onTap: () => g.yourRun == YourRun.finished ? MobV3Nav.podium(context, g.id) : MobV3Nav.play(context, g),
        ),
      );
    }
    if (rows.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
          rows[i],
        ],
      ],
    );
  }
}

/// One den row: a 44 dp lead, a title and a line, and a chevron. The whole row is the target (at least 72 dp).
class DenRow extends StatelessWidget {
  const DenRow({super.key, required this.lead, required this.title, required this.line, required this.onTap, this.leadWidth = 44});

  final Widget lead;

  /// The lead's width (44 dp; wider for the shelf row's overlapping heads).
  final double leadWidth;
  final String title;
  final String line;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: '$title. $line',
      pressedScale: 0.98,
      haptic: MmPressHaptic.selection,
      focusRadius: BorderRadius.circular(MmRadius.small),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 72),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Row(
            children: [
              SizedBox(width: leadWidth, height: 44, child: Center(child: lead)),
              const SizedBox(width: MmSpace.s16),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: type.subhead.copyWith(color: colors.ink)),
                    const SizedBox(height: MmSpace.s2),
                    Text(line, style: type.label.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s8),
              Icon(LucideIcons.chevronRight, size: 20, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

enum _Glyph { start, invite, paper }

/// The row's lead: Start a game is a ringed plus, Invite a dashed-ring plus, the paper a calendar tile.
class _RowGlyph extends StatelessWidget {
  const _RowGlyph({required this.kind});

  final _Glyph kind;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final ring = colors.isNight ? colors.volt : colors.ink;
    return ExcludeSemantics(
      child: switch (kind) {
        _Glyph.start => Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: ring, width: 1.6)),
            child: Icon(LucideIcons.plus, size: 22, color: ring),
          ),
        _Glyph.invite => CustomPaint(
            size: const Size(40, 40),
            painter: _DashedRing(colour: colors.ink2),
            child: SizedBox(width: 40, height: 40, child: Icon(LucideIcons.plus, size: 20, color: colors.ink)),
          ),
        _Glyph.paper => Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: colors.raised2, borderRadius: BorderRadius.circular(MmRadius.small)),
            child: Icon(LucideIcons.calendarDays, size: 20, color: colors.ink),
          ),
      },
    );
  }
}

class _DashedRing extends CustomPainter {
  _DashedRing({required this.colour});

  final Color colour;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;
    final r = size.width / 2 - 1;
    const n = 18;
    for (var i = 0; i < n; i++) {
      final a = i * 2 * math.pi / n;
      canvas.drawArc(Rect.fromCircle(center: size.center(Offset.zero), radius: r), a, math.pi / n, false, p);
    }
  }

  @override
  bool shouldRepaint(_DashedRing old) => old.colour != colour;
}
