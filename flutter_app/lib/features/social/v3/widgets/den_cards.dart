// The den's card under the stage (spec 5.3 D1 to D5) and D6's failed card. Which one shows is
// decided by logic/den_copy_state.dart; this file only draws it and wires its keys. One volt thing:
// the card's primary key. Every sentence comes from MobV3Copy.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api.dart';
import '../../../../core/haptics/haptics.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../../../pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import '../../copy.dart';
import '../../data/mob_models.dart';
import '../../data/mob_navigator.dart';
import '../../widgets/mob_parts.dart' show showMobToast;
import '../../widgets/mob_pro_entry.dart' show sayMobFailure;
import '../../widgets/mob_ring.dart' show MobColours;
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import '../logic/den_copy_state.dart';
import '../mob_v3_nav.dart';
import 'fold_manifest.dart';
import 'invite_card.dart';
import 'play_picker_sheet.dart';
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

  void _answers() {
    final id = widget.mob.week.yourResultId;
    if (id == null) return;
    ref.read(mobNavigatorProvider).openAnswers(context, id);
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

  Widget _paperLink() {
    final sat = widget.mob.week.youSat;
    if (sat && widget.mob.week.yourResultId == null) return const SizedBox.shrink();
    return DenLink(label: sat ? MobV3Copy.seeAnswers : MobV3Copy.sitPaper, busy: _sitting, onTap: sat ? _answers : _sit);
  }

  Widget? _moreLink() {
    if (card.moreOpen <= 0) return null;
    return DenLink(label: MobV3Copy.moreOpen(card.moreOpen), onTap: () => showPlayPicker(context));
  }

  @override
  Widget build(BuildContext context) {
    if (card.kind == DenCardKind.one) return _one(context);
    final type = context.mmType;
    final colors = context.mmColors;
    final g = card.game;
    final now = widget.now;
    final children = <Widget>[];
    switch (card.kind) {
      case DenCardKind.quiet:
        children
          ..add(Text(MobV3Copy.quietTitle, style: type.subhead.copyWith(color: colors.ink)))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(Text(MobV3Copy.quietLine, style: type.body.copyWith(color: colors.ink2)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.startAGame, onPressed: () => showStartGame(context)))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(_paperLink());
      case DenCardKind.cantStart:
        children
          ..add(Text(MobV3Copy.askTitle, style: type.subhead.copyWith(color: colors.ink)))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(Text(MobV3Copy.askLine, style: type.body.copyWith(color: colors.ink2)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.askKey, loading: _asking, hapticOnCommit: false, onPressed: _askAgain))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(_paperLink());
      case DenCardKind.open:
        final runs = MobV3Copy.runsSoFar(g!.runs, now);
        children
          ..add(_HostLine(game: g, v3: v3, title: MobV3Copy.openedA(g)))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(
            Padding(
              padding: const EdgeInsets.only(left: _HostLine.indent),
              child: Text(keepTimes(MobV3Copy.openLine(g, now)), style: type.body.copyWith(color: colors.ink2)),
            ),
          );
        if (runs != null) {
          children
            ..add(const SizedBox(height: MmSpace.s12))
            ..add(_RunsRow(text: runs));
        }
        children
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.playKey(g), onPressed: () => MobV3Nav.run(context, g.id)))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(_moreLink() ?? DenLink(label: MobV3Copy.moreWays, onTap: () => showPlayPicker(context)));
      case DenCardKind.played:
        final yours = _yourRunAt(g!);
        children
          ..add(_HostLine(game: g, v3: v3, title: MobV3Copy.gameTitle(g)))
          ..add(const SizedBox(height: MmSpace.s4));
        if (yours != null && g.closesAt != null) {
          children.add(
            Padding(
              padding: const EdgeInsets.only(left: _HostLine.indent),
              child: Text(keepTimes(MobV3Copy.playedAt(yours, g.closesAt!, now)), style: type.body.copyWith(color: colors.ink2)),
            ),
          );
        }
        children
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.seePodiumSoFar, onPressed: () => MobV3Nav.podium(context, g.id)))
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(StickerRow(gameId: g.id));
        final more = _moreLink();
        if (more != null) {
          children
            ..add(const SizedBox(height: MmSpace.s8))
            ..add(more);
        }
      case DenCardKind.live:
        children
          ..add(_HostLine(game: g!, v3: v3, title: MobV3Copy.liveOpened(g), live: true))
          ..add(const SizedBox(height: MmSpace.s4))
          ..add(
            Padding(
              padding: const EdgeInsets.only(left: _HostLine.indent),
              child: Text(MobV3Copy.liveLine(g), style: type.body.copyWith(color: colors.ink2)),
            ),
          )
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.joinRoom(g), onPressed: () => MobV3Nav.run(context, g.id)));
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
              padding: const EdgeInsets.only(left: _HostLine.indent),
              child: Text(keepTimes(MobV3Copy.roomStarted(started, g.closesAt!, now)), style: type.body.copyWith(color: colors.ink2)),
            ),
          );
        }
        children
          ..add(const SizedBox(height: MmSpace.s16))
          ..add(KeyButton(label: MobV3Copy.playItNow, onPressed: () => MobV3Nav.run(context, g.id)));
      case DenCardKind.one:
        break;
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

  DateTime? _yourRunAt(MobGameSummary g) {
    final you = v3.you?.memberId;
    for (final r in g.runs) {
      if (r.memberId == you) return r.at;
    }
    return null;
  }

  /// D5: a Mob of one. The invite is the one volt thing; the weekly paper and a sprint still work alone.
  Widget _one(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final mob = widget.mob;
    final code = mob.invite?.code;
    final sat = mob.week.youSat;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          child: Text(MobV3Copy.oneTitle, style: type.headline.copyWith(color: colors.ink)),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(MobV3Copy.oneLine, style: type.body.copyWith(color: colors.ink2)),
        if (code != null) ...[const SizedBox(height: MmSpace.s16), InviteCardPreview(youName: v3.you?.name ?? '', mobName: v3.name.text, subjectName: mob.subjectName, display: displayCode(code))],
        const SizedBox(height: MmSpace.s16),
        KeyButton(label: MobV3Copy.inviteWhatsApp, onPressed: () => shareInviteCard(context)),
        const SizedBox(height: MmSpace.s8),
        KeyButton.secondary(
          label: MobV3Copy.copyCode,
          onPressed: () async {
            final shown = await copyInviteCode(context);
            if (shown != null && context.mounted) showMobToast(context, MobV3Copy.codeCopied);
          },
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          MobV3Copy.inviteWorks,
          textAlign: TextAlign.center,
          style: type.caption.copyWith(color: colors.ink2),
        ),
        const SizedBox(height: MmSpace.s24),
        DenPaperCard(
          padding: const EdgeInsets.all(MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(MobV3Copy.onePaper, style: type.body.copyWith(color: colors.ink2)),
              if (!sat || mob.week.yourResultId != null) ...[
                const SizedBox(height: MmSpace.s12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: sat
                      ? KeyButton.secondary(label: MobV3Copy.answers, expanded: false, onPressed: _answers)
                      : KeyButton.secondary(label: MobV3Copy.sitIt, expanded: false, loading: _sitting, onPressed: _sit),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s4),
        DenLink(label: MobV3Copy.startSprint, onTap: () => showStartGame(context)),
      ],
    );
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
  static const double indent = disc + MmSpace.s12;

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

/// "Runs so far: Riya, 2:10 PM. Kabir, 4:55 PM." Finished runs as a row of their own, with a ruler-tick
/// rule above it (exam stationery). Never a tag under a Fold (F2).
class _RunsRow extends StatelessWidget {
  const _RunsRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(left: _HostLine.indent),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CustomPaint(
            size: const Size(double.infinity, 6),
            painter: _TickRule(colour: colors.line),
          ),
          const SizedBox(height: MmSpace.s8),
          Text(
            keepTimes(text),
            style: type.label.copyWith(color: colors.ink2, fontWeight: FontWeight.w500),
          ),
        ],
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
  const DenPaperCard({super.key, required this.child, this.padding = const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s12)});

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
