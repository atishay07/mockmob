// The preset sticker row (spec 5.3 D3, L1, R8; M12). Used by the den, the podium, the lobby and
// Everyone's moment. Stickers are a fixed enum drawn locally as paper: a die-cut paper chip with a
// painted glyph and its words, never an emoji (they change per phone).
//
// Sending: a selection haptic on the tap, then mobV3ActionsProvider.sticker. The phone spaces stickers
// 3 s apart: a tap inside that gap does nothing alarming (no error, no toast). After a send the sticker
// flies (M12): 24 dp up from the sender's Fold in the den (the den listens on [stickerBusProvider]); on
// any other screen it rises from the chip itself. Scale 0.9 to 1 on iconPop, holds 1800 ms, fades in
// 300 ms; at most 3 in flight at once. Reduced motion: it fades in and out in 120 ms.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api.dart';
import '../../../../core/haptics/haptics.dart';
import '../../../../core/motion/springs.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../data/mob_v3_den.dart';
import '../data/mob_v3_models.dart';
import 'den_motion.dart';
import 'mob_fx.dart';

/// One sticker on its way: who sent it and which.
class StickerSend {
  const StickerSend({required this.memberId, required this.kind, required this.id});

  final String memberId;
  final StickerKind kind;
  final int id;
}

/// Where a sent sticker goes to fly. The den listens while it is on screen; with no listener the row
/// flies it from the chip.
class StickerBus extends ChangeNotifier {
  final List<StickerSend> _sent = [];
  int _ids = 0;
  int _listeners = 0;

  bool get heard => _listeners > 0;

  List<StickerSend> get recent => List.unmodifiable(_sent);

  void post(String memberId, StickerKind kind) {
    _sent.add(StickerSend(memberId: memberId, kind: kind, id: ++_ids));
    if (_sent.length > 6) _sent.removeAt(0);
    notifyListeners();
  }

  @override
  void addListener(VoidCallback listener) {
    _listeners++;
    super.addListener(listener);
  }

  @override
  void removeListener(VoidCallback listener) {
    _listeners = math.max(0, _listeners - 1);
    super.removeListener(listener);
  }
}

final stickerBusProvider = Provider<StickerBus>((ref) {
  final bus = StickerBus();
  ref.onDispose(bus.dispose);
  return bus;
});

class StickerRow extends ConsumerStatefulWidget {
  const StickerRow({super.key, this.kinds = StickerKind.results, this.gameId, this.label});

  final List<StickerKind> kinds;
  final String? gameId;

  /// A caption above the row ("Send your Mob a sticker"), or none.
  final String? label;

  @override
  ConsumerState<StickerRow> createState() => _StickerRowState();
}

class _StickerRowState extends ConsumerState<StickerRow> {
  final List<(int, StickerKind, int)> _flights = [];
  int _ids = 0;
  String? _note;

  Future<void> _send(int index, StickerKind kind) async {
    ref.read(hapticsProvider).selection();
    final actions = ref.read(mobV3ActionsProvider);
    bool sent;
    try {
      sent = await actions.sticker(kind, game: widget.gameId);
    } on ApiError catch (e) {
      if (mounted) setState(() => _note = MobV3Copy.error(e));
      return;
    } on Object {
      if (mounted) setState(() => _note = MobV3Copy.generic);
      return;
    }
    if (!sent || !mounted) return;
    setState(() => _note = null);
    final bus = ref.read(stickerBusProvider);
    final you = ref.read(denViewProvider)?.v3.you?.memberId ?? '';
    if (bus.heard && you.isNotEmpty) {
      bus.post(you, kind);
      return;
    }
    setState(() {
      _flights.add((++_ids, kind, index));
      while (_flights.length > 3) {
        _flights.removeAt(0);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[Text(widget.label!, style: type.label.copyWith(color: colors.ink2)), const SizedBox(height: MmSpace.s8)],
        LayoutBuilder(
          builder: (context, box) {
            return Wrap(
              spacing: MmSpace.s8,
              runSpacing: MmSpace.s8,
              children: [
                for (var i = 0; i < widget.kinds.length; i++)
                  Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.topCenter,
                    children: [
                      MmPressable(
                        onTap: () => _send(i, widget.kinds[i]),
                        semanticsLabel: MobV3Copy.stickerSemantics(widget.kinds[i]),
                        pressedScale: 0.94,
                        focusRadius: BorderRadius.circular(14),
                        builder: (context, pressed, _) => PaperSticker(kind: widget.kinds[i]),
                      ),
                      for (final f in _flights)
                        if (f.$3 == i)
                          Positioned(
                            bottom: 40,
                            child: StickerFlight(
                              key: ValueKey(f.$1),
                              kind: f.$2,
                              onDone: () {
                                if (mounted) setState(() => _flights.removeWhere((x) => x.$1 == f.$1));
                              },
                            ),
                          ),
                    ],
                  ),
              ],
            );
          },
        ),
        if (_note != null) ...[const SizedBox(height: MmSpace.s8), Text(_note!, style: type.caption.copyWith(color: colors.ink2))],
      ],
    );
  }
}

/// A paper sticker: a die-cut chip (paper with a white sticker edge), a painted glyph and its words.
class PaperSticker extends StatelessWidget {
  const PaperSticker({super.key, required this.kind, this.small = false});

  final StickerKind kind;

  /// The flying size (no target needed): a hair smaller.
  final bool small;

  /// A fixed small tilt per kind, so a row reads as stuck-on paper, never a button bar.
  static double tiltOf(StickerKind k) => const [-1.5, 1.2, -0.8, 1.6, 1.0, -1.4, 0.8, -1.0][k.index] * math.pi / 180;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final night = context.mmColors.isNight;
    final paper = night ? const Color(0xFFEDE5D3) : const Color(0xFFFFFDF8);
    const ink = Color(0xFF1E1B15);
    final g = small ? 16.0 : 18.0;
    return Transform.rotate(
      angle: tiltOf(kind),
      child: Container(
        constraints: BoxConstraints(minHeight: small ? 34 : MmTarget.min),
        padding: EdgeInsets.symmetric(horizontal: small ? 10 : 12, vertical: 6),
        decoration: BoxDecoration(
          color: paper,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: night ? const Color(0xFFF7F2E6) : const Color(0xFFE2D9C6), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: night ? 0.35 : 0.10),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            CustomPaint(
              size: Size(g, g),
              painter: StickerGlyph(kind, ink: ink),
            ),
            const SizedBox(width: MmSpace.s6),
            Flexible(
              child: Text(
                MobV3Copy.sticker(kind),
                style: type.label.copyWith(color: ink, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One glyph per sticker, painted in one weight (BRAND-MOTION-KIT 4): exam stationery, never emoji.
class StickerGlyph extends CustomPainter {
  StickerGlyph(this.kind, {required this.ink});

  final StickerKind kind;
  final Color ink;

  static const Color _lamp = Color(0xFFC98A2E);

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width;
    final p = Paint()
      ..color = ink
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.11
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = _lamp;
    final c = Offset(w / 2, w / 2);
    switch (kind) {
      case StickerKind.niceOne:
        // A tick in an answer bubble.
        canvas.drawCircle(c, w * 0.44, fill..color = _lamp.withValues(alpha: 0.35));
        canvas.drawPath(
          Path()
            ..moveTo(w * 0.26, w * 0.52)
            ..lineTo(w * 0.43, w * 0.68)
            ..lineTo(w * 0.74, w * 0.34),
          p,
        );
      case StickerKind.soClose:
        // A ruler with two marks a hair apart.
        canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.06, w * 0.34, w * 0.88, w * 0.36), Radius.circular(w * 0.06)), p..strokeWidth = w * 0.09);
        for (final x in [0.3, 0.5, 0.7]) {
          canvas.drawLine(Offset(w * x, w * 0.34), Offset(w * x, w * (x == 0.5 ? 0.56 : 0.48)), p);
        }
        canvas.drawCircle(Offset(w * 0.58, w * 0.2), w * 0.07, fill..color = _lamp);
      case StickerKind.teachMe:
        // A pencil.
        canvas.save();
        canvas.translate(c.dx, c.dy);
        canvas.rotate(-math.pi / 4);
        final body = Rect.fromCenter(center: Offset.zero, width: w * 0.86, height: w * 0.26);
        canvas.drawRect(Rect.fromLTRB(body.left + w * 0.18, body.top, body.right, body.bottom), fill..color = _lamp);
        canvas.drawRect(Rect.fromLTRB(body.left + w * 0.18, body.top, body.right, body.bottom), p..strokeWidth = w * 0.08);
        canvas.drawPath(
          Path()
            ..moveTo(body.left + w * 0.18, body.top)
            ..lineTo(body.left, 0)
            ..lineTo(body.left + w * 0.18, body.bottom),
          p,
        );
        canvas.restore();
      case StickerKind.again:
        // A loop that comes round again.
        final r = Rect.fromCircle(center: c, radius: w * 0.34);
        canvas.drawArc(r, -math.pi * 0.35, math.pi * 1.6, false, p);
        final end = Offset(c.dx + w * 0.34 * math.cos(-math.pi * 0.35), c.dy + w * 0.34 * math.sin(-math.pi * 0.35));
        canvas.drawPath(
          Path()
            ..moveTo(end.dx - w * 0.2, end.dy - w * 0.04)
            ..lineTo(end.dx, end.dy)
            ..lineTo(end.dx + w * 0.02, end.dy + w * 0.2),
          p,
        );
      case StickerKind.goodLuck:
        // A four-point glint.
        final path = Path()
          ..moveTo(c.dx, w * 0.04)
          ..quadraticBezierTo(c.dx + w * 0.06, c.dy - w * 0.06, w * 0.96, c.dy)
          ..quadraticBezierTo(c.dx + w * 0.06, c.dy + w * 0.06, c.dx, w * 0.96)
          ..quadraticBezierTo(c.dx - w * 0.06, c.dy + w * 0.06, w * 0.04, c.dy)
          ..quadraticBezierTo(c.dx - w * 0.06, c.dy - w * 0.06, c.dx, w * 0.04)
          ..close();
        canvas.drawPath(path, fill..color = _lamp);
        canvas.drawPath(path, p..strokeWidth = w * 0.07);
      case StickerKind.letsGo:
        // A pennant on its pole.
        canvas.drawLine(Offset(w * 0.24, w * 0.08), Offset(w * 0.24, w * 0.94), p);
        final flag = Path()
          ..moveTo(w * 0.24, w * 0.12)
          ..lineTo(w * 0.88, w * 0.3)
          ..lineTo(w * 0.24, w * 0.5)
          ..close();
        canvas.drawPath(flag, fill..color = _lamp);
        canvas.drawPath(flag, p..strokeWidth = w * 0.08);
      case StickerKind.oneSec:
        // A stopwatch.
        canvas.drawCircle(Offset(c.dx, c.dy + w * 0.06), w * 0.36, p);
        canvas.drawLine(Offset(c.dx, w * 0.02), Offset(c.dx, w * 0.16), p);
        canvas.drawLine(Offset(c.dx, c.dy + w * 0.06), Offset(c.dx + w * 0.16, c.dy - w * 0.08), p);
      case StickerKind.ready:
        // A filled OMR bubble.
        canvas.drawCircle(c, w * 0.42, p..strokeWidth = w * 0.09);
        canvas.drawCircle(c, w * 0.26, fill..color = ink);
    }
  }

  @override
  bool shouldRepaint(StickerGlyph old) => old.kind != kind || old.ink != ink;
}

/// M12: one sticker in flight. Rises 24 dp and scales 0.9 to 1 on iconPop, holds 1800 ms, fades in
/// 300 ms, then calls [onDone]. Reduced motion: fade in and out over 120 ms, no rise.
class StickerFlight extends StatefulWidget {
  const StickerFlight({super.key, required this.kind, this.onDone});

  final StickerKind kind;
  final VoidCallback? onDone;

  static const Duration rise = Duration(milliseconds: 420);
  static const Duration hold = Duration(milliseconds: 1800);
  static const Duration fade = Duration(milliseconds: 300);
  static Duration get total => rise + hold + fade;

  @override
  State<StickerFlight> createState() => _StickerFlightState();
}

class _StickerFlightState extends State<StickerFlight> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: StickerFlight.total);
  static final Curve _pop = SpringCurve(Springs.iconPop);

  @override
  void initState() {
    super.initState();
    _c.forward().whenComplete(() => widget.onDone?.call());
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MobFx.reduced(context);
    final total = StickerFlight.total.inMilliseconds.toDouble();
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final ms = _c.value * total;
          final double opacity;
          var dy = 0.0;
          var scale = 1.0;
          if (reduced) {
            opacity = math.min(windowOf(ms, 0, 120), 1 - windowOf(ms, total - 120, 120));
          } else {
            final v = windowOf(ms, 0, 420, _pop);
            dy = -24 * v;
            scale = 0.9 + 0.1 * v;
            opacity = math.min(windowOf(ms, 0, 120), 1 - windowOf(ms, total - 300, 300));
          }
          return Opacity(
            opacity: opacity.clamp(0.0, 1.0),
            child: Transform.translate(
              offset: Offset(0, dy),
              child: Transform.scale(scale: scale, alignment: Alignment.bottomCenter, child: child),
            ),
          );
        },
        child: PaperSticker(kind: widget.kind, small: true),
      ),
    );
  }
}
