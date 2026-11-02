/// The one end screen of a study session (the web's `EndScreen`, `KeptFan`, `EndKey`; R2 ruling 5, LK31, R3-SPEC L5, R4), for
/// the feed and the run alike. Top to bottom, in one column at most 560 dp wide:
///
///   close      the X and the word "Close" in a 72 dp row (the safe top above it): the only other way out
///   content    centred in the space between the close row and the keys: the chapter's name (15 ink-2, one line), the
///              headline (Bricolage 34 w750, -0.03 em) with Mobi (64 dp, a nod) at its right, the small fan of the cards sent
///              to Revise, one row of up to 3 numbers (32 w700, counting up 300 ms, 60 ms apart), the chapter's bar (3 dp,
///              growing 600 ms from the old share) with its label
///   keys       pinned to the foot, padding-bottom max(24, safe bottom): Free's one quiet line when the day's session is used,
///              the one main key (volt, at least 56 dp, a second line inside it for the next chapter's name), at most one
///              quiet text link
///   loading    the final shape in skeletons ("Adding it up"); error: its title and line with Try again (never invented numbers)
/// The numbers, the headline and the bar come from `StageEndModel` (zeros dropped); the screens only draw them.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/mascot/mascot.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/skeleton.dart';
import '../../keycards/data/keycards_lines.dart' show cardFace;
import '../../keycards/data/keycards_models.dart';
import 'stage_balance.dart';
import 'stage_end_model.dart';
import 'stage_keys.dart';
import 'stage_motion.dart';

/// A card the fan draws: its kind label and its front.
@immutable
class StagePileCard {
  const StagePileCard({required this.label, required this.front, this.id});

  /// From the server's short card (`{ id, kind, front }`): the kind's label and the front as a card shows them.
  factory StagePileCard.of({required String kind, required String front, String? id}) {
    final face = cardFace(KeyCard(id: id ?? 'pile', kind: kind, front: front, back: front));
    return StagePileCard(label: face.label, front: face.front, id: id);
  }

  final String label;
  final String front;
  final String? id;
}

/// A failed end read: "Your feed is saved" / "Its summary did not load."
typedef StageEndError = ({String title, String line});

/// The end screen. Everything is optional but the keys the screen wants to give.
class EndScreen extends StatelessWidget {
  const EndScreen({
    super.key,
    this.close,
    this.chapter,
    this.headline,
    this.mobi,
    this.pile,
    this.numbers = const [],
    this.progress,
    this.free,
    this.main,
    this.quiet,
    this.titleKey,
    this.loading = false,
    this.error,
    this.onRetry,
    this.retryKeys = const [],
  });

  /// The X and the word: a `StageCloseKey`.
  final Widget? close;

  /// The chapter's name, a quiet line.
  final String? chapter;

  /// "18 done in 12 min" / "5 of 20 done"; null leads with the chapter instead.
  final String? headline;

  /// An act for the 64 dp Mobi beside the headline (`nod`, `encourage`, `think`), or null for none.
  final String? mobi;

  /// The cards sent to Revise this session: the small fan above the numbers. Null or empty draws none.
  final List<StagePileCard>? pile;

  /// Up to three figures (`StageEndModel.endNumbers`); each counts up from 0.
  final List<EndNumber> numbers;

  /// The chapter's bar (`StageEndModel.endProgress`), growing from `from` to `to`.
  final EndProgress? progress;

  /// Free's one quiet line directly above the keys (ruling F).
  final String? free;

  /// The one main key (`StageEndKey`) and the one quiet text link (`StageTextKey`).
  final Widget? main;
  final Widget? quiet;

  /// On the headline, which takes the screen reader's focus when the end comes into view.
  final GlobalKey? titleKey;
  final bool loading;
  final StageEndError? error;
  final VoidCallback? onRetry;

  /// Keys under Try again ("Back to Explore").
  final List<Widget> retryKeys;

  /// The column's widest.
  static const double maxWidth = 560;

  /// The close row's height (the safe top comes on top of it).
  static const double closeRow = 72;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final pad = MediaQuery.paddingOf(context);
    final headStyle = type.headline.copyWith(fontSize: 34, height: 1.08, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]);
    final quietStyle = type.body.copyWith(fontSize: 15, height: 1.4, fontWeight: FontWeight.w500, color: colors.ink2);

    Widget top() => SizedBox(
      height: closeRow + pad.top,
      child: Padding(
        padding: EdgeInsets.only(top: pad.top),
        child: Align(alignment: Alignment.centerLeft, child: Transform.translate(offset: const Offset(-10, 0), child: close ?? const SizedBox.shrink())),
      ),
    );

    Widget frame(Widget body, Widget keys) => ColoredBox(
      color: colors.ground,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: maxWidth),
          child: LayoutBuilder(
            builder: (context, c) => SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: c.maxHeight),
                // The content sits in the middle of the space between the close row and the keys, which stay at the foot.
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [top(), body, keys],
                ),
              ),
            ),
          ),
        ),
      ),
    );

    if (loading) {
      return Semantics(
        label: 'Adding it up',
        liveRegion: true,
        child: frame(
          const SkeletonGroup(
            label: 'Adding it up',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: 0.5, child: Skeleton(height: 16, radius: 10))),
                SizedBox(height: 18),
                Align(alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: 0.7, child: Skeleton(height: 36, radius: 10))),
                SizedBox(height: 18),
                Skeleton(height: 64, radius: 10),
                SizedBox(height: 18),
                Skeleton(height: 6, radius: 3),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.only(bottom: math.max(24, pad.bottom)),
            child: const Skeleton(height: 56, radius: 14),
          ),
        ),
      );
    }

    final err = error;
    if (err != null) {
      return frame(
        const SizedBox.shrink(),
        Padding(
          padding: EdgeInsets.only(bottom: math.max(24, pad.bottom)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(key: titleKey, header: true, liveRegion: true, child: StageBalancedText(TextSpan(text: err.title, style: headStyle))),
              const SizedBox(height: 14),
              Text(err.line, style: quietStyle),
              const SizedBox(height: 22),
              StageStepKey(label: 'Try again', onTap: onRetry, minHeight: 56),
              for (final k in retryKeys) ...[const SizedBox(height: 6), Center(child: k)],
            ],
          ),
        ),
      );
    }

    final head = headline ?? chapter ?? '';
    final cards = pile ?? const <StagePileCard>[];
    final body = Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8, bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (chapter != null && chapter!.isNotEmpty) ...[
            Text(chapter!, maxLines: 1, overflow: TextOverflow.ellipsis, style: quietStyle),
            const SizedBox(height: 6),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: StageIn(
                  duration: const Duration(milliseconds: 240),
                  child: Semantics(key: titleKey, header: true, child: StageBalancedText(TextSpan(text: head, style: headStyle))),
                ),
              ),
              if (mobi != null) ...[const SizedBox(width: MmSpace.s12), StageMobi(act: mobi!)],
            ],
          ),
          if (cards.isNotEmpty) ...[
            const SizedBox(height: 20),
            Center(child: StageKeptFan(cards: cards, small: true, height: 132)),
          ],
          if (numbers.isNotEmpty) ...[
            SizedBox(height: cards.isNotEmpty ? 24 : 24),
            _Numbers(numbers: numbers),
          ],
          if (progress != null) ...[
            const SizedBox(height: 20),
            _Bar(progress: progress!),
          ],
        ],
      ),
    );
    final keys = Padding(
      padding: EdgeInsets.only(bottom: math.max(24, pad.bottom)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (free != null && free!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(free!, style: quietStyle.copyWith(fontSize: 13.5, height: 1.5)),
            ),
          ?main,
          if (quiet != null) ...[const SizedBox(height: 6), Center(child: quiet)],
        ],
      ),
    );
    return frame(body, keys);
  }
}

/// The main key of the end (the web's `EndKey`): the one volt key, at least 56 dp, with a second line inside it when there is one
/// (the next chapter's name).
class StageEndKey extends StatelessWidget {
  const StageEndKey({super.key, required this.label, required this.onTap, this.sub, this.semanticsLabel});

  final String label;
  final VoidCallback? onTap;
  final String? sub;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) => StageStepKey(label: label, sub: sub, onTap: onTap, minHeight: 56, semanticsLabel: semanticsLabel ?? (sub == null ? null : '$label. $sub'));
}

/// One row of up to three figures: the leading number counts up from 0 over 300 ms on `Motion.out` (60 ms apart), the rest of
/// the figure ("of 2") stays put; the label sits under it (13 w500 ink-2). Equal columns, 12 dp apart.
class _Numbers extends StatelessWidget {
  const _Numbers({required this.numbers});

  final List<EndNumber> numbers;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final width = MediaQuery.sizeOf(context).width;
    // Three figures: the figure shrinks with the screen (clamp(24, 7.4 vw, 32)).
    final size = numbers.length == 3 ? (width * 0.074).clamp(24.0, 32.0) : 32.0;
    final figure = type.title.copyWith(fontSize: size, height: 1, fontWeight: FontWeight.w700, letterSpacing: -0.02 * size, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]);
    final label = type.body.copyWith(fontSize: 13, height: 1.35, fontWeight: FontWeight.w500, color: colors.ink2);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (i, n) in numbers.indexed) ...[
          if (i > 0) const SizedBox(width: MmSpace.s12),
          Expanded(
            child: MergeSemantics(
              child: StageIn(
                delay: Duration(milliseconds: i * 60),
                duration: const Duration(milliseconds: 220),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _CountUp(n: n.n, value: n.value, style: figure, delay: Duration(milliseconds: i * 60)),
                    const SizedBox(height: 4),
                    Text(n.label, style: label),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// The leading figure counts from 0 to [n] over 300 ms on `Motion.out` after [delay]; the rest of [value] stays put. Nothing
/// moves under reduced motion.
class _CountUp extends StatefulWidget {
  const _CountUp({required this.n, required this.value, required this.style, required this.delay});

  final int n;
  final String value;
  final TextStyle style;
  final Duration delay;

  @override
  State<_CountUp> createState() => _CountUpState();
}

class _CountUpState extends State<_CountUp> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: widget.delay + const Duration(milliseconds: 300), value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context) && widget.n > 0) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rest = widget.value.replaceFirst(RegExp(r'^\d+'), '');
    final total = _c.duration!.inMicroseconds;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final p = ((_c.value * total - widget.delay.inMicroseconds) / 300000).clamp(0.0, 1.0);
        final shown = (widget.n * Motion.out.transform(p)).round();
        return Text('$shown$rest', maxLines: 1, softWrap: false, style: widget.style);
      },
    );
  }
}

/// The chapter's bar (3 dp, radius 2, the strong line, filled in the select colour from the left): it grows from `from` to `to`
/// over 600 ms on `Motion.out` after 200 ms, one frame after the end is drawn; the label sits 8 dp under it.
class _Bar extends StatefulWidget {
  const _Bar({required this.progress});

  final EndProgress progress;

  @override
  State<_Bar> createState() => _BarState();
}

class _BarState extends State<_Bar> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final p = widget.progress;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          label: p.label,
          image: true,
          excludeSemantics: true,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: SizedBox(
              height: 3,
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, _) {
                  // 200 ms still, then 600 ms of growth.
                  final t = Motion.out.transform(((_c.value * 800 - 200) / 600).clamp(0.0, 1.0));
                  final share = p.from + (p.to - p.from) * t;
                  return Stack(
                    children: [
                      Positioned.fill(child: ColoredBox(color: colors.lineStrong)),
                      Positioned.fill(
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: share.clamp(0.0, 1.0),
                          child: ColoredBox(color: stageSelect(colors)),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(p.label, style: type.label.copyWith(fontSize: 13, height: 1.3, fontWeight: FontWeight.w500, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
      ],
    );
  }
}

/// Mobi beside the headline, 64 dp: a nod, a lean in, or thinking (`nod`, `encourage`, `think`). Decoration only.
class StageMobi extends StatelessWidget {
  const StageMobi({super.key, required this.act, this.size = 64});

  final String act;
  final double size;

  static MobiAct actFor(String name) => switch (name) {
    'think' => MobiAct.think,
    'nod' => MobiAct.nod,
    _ => MobiAct.encourage,
  };

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: RepaintBoundary(
      child: SizedBox(
        height: size,
        child: MobiCharacter(size: size, entrance: actFor(act), seed: 41, interactive: true),
      ),
    ),
  );
}

/// The kept fan (the web's `KeptFan`): up to four small cards, fanned open one frame after they are drawn. The small fan (the
/// end's and the checkpoint's) is 260 dp wide with 108 x 116 cards, fanned by (i - mid) x 7 degrees and 0.75 x (i - mid) x 26 dp
/// over 220 ms on `Motion.drawer` with 40 ms steps; the top card shows its kind label and a whole-word front of at most 54
/// characters (three lines), the others three hairlines. The larger one is 112 x 140 with 72 characters.
class StageKeptFan extends StatefulWidget {
  const StageKeptFan({super.key, required this.cards, this.open = true, this.small = false, this.height});

  final List<StagePileCard> cards;

  /// False holds the fan closed (a screen that opens it itself).
  final bool open;
  final bool small;

  /// The fan's height: 132 for the end's small fan, 128 for the checkpoint's; 156 for the larger one.
  final double? height;

  static const Duration step = Duration(milliseconds: 40);

  @override
  State<StageKeptFan> createState() => _StageKeptFanState();
}

class _StageKeptFanState extends State<StageKeptFan> with SingleTickerProviderStateMixin {
  late final AnimationController _open = AnimationController(vsync: this, duration: _duration + StageKeptFan.step * 3);

  Duration get _duration => Duration(milliseconds: widget.small ? 220 : 320);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void didUpdateWidget(StageKeptFan old) {
    super.didUpdateWidget(old);
    if (widget.open != old.open) _start();
  }

  void _start() {
    if (!mounted) return;
    if (!widget.open) {
      _open.value = 0;
    } else if (Motion.reduced(context)) {
      _open.value = 1;
    } else if (_open.value < 1 && !_open.isAnimating) {
      _open.forward();
    }
  }

  @override
  void dispose() {
    _open.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shown = widget.cards.take(4).toList();
    final mid = (shown.length - 1) / 2;
    final total = _open.duration!.inMicroseconds;
    final small = widget.small;
    final height = widget.height ?? (small ? 132 : 156);
    return ExcludeSemantics(
      child: SizedBox(
        height: height,
        width: small ? 260 : double.infinity,
        child: AnimatedBuilder(
          animation: _open,
          builder: (context, _) => Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              for (final (i, c) in shown.indexed)
                Positioned(
                  top: 6,
                  child: Builder(
                    builder: (context) {
                      final start = StageKeptFan.step.inMicroseconds * i / total;
                      final span = _duration.inMicroseconds / total;
                      final t = Motion.drawer.transform(((_open.value - start) / span).clamp(0.0, 1.0));
                      final k = (i - mid) * t;
                      return Transform.translate(
                        offset: Offset((small ? 0.75 : 1) * 26 * k, 0),
                        child: Transform.rotate(
                          angle: 7 * k * math.pi / 180,
                          alignment: const Alignment(0, 0.8),
                          child: _PileCard(card: c, top: i == shown.length - 1, small: small),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PileCard extends StatelessWidget {
  const _PileCard({required this.card, required this.top, required this.small});

  final StagePileCard card;
  final bool top;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final front = StageEndModel.miniFront(card.front, max: small ? 54 : 72);
    return Container(
      width: small ? 108 : 112,
      height: small ? 116 : 140,
      padding: small ? const EdgeInsets.fromLTRB(9, 9, 9, 10) : const EdgeInsets.fromLTRB(11, 11, 11, 12),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(small ? 10 : 12),
        border: Border.all(color: colors.lineStrong),
        boxShadow: colors.cardShadow,
      ),
      child: top
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(card.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.label.copyWith(fontSize: small ? 10.5 : 12, height: 1.2, color: colors.ink3)),
                SizedBox(height: small ? 5 : 6),
                Flexible(
                  child: Text(
                    front,
                    maxLines: small ? 3 : 5,
                    overflow: TextOverflow.ellipsis,
                    style: type.title.copyWith(
                      fontSize: small ? 10.5 : StageEndModel.pileFrontSize(front).toDouble(),
                      height: 1.28,
                      letterSpacing: small ? -0.005 * 10.5 : 0,
                      wordSpacing: 0,
                      color: colors.ink,
                    ),
                  ),
                ),
              ],
            )
          : Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (i, w) in [1.0, 1.0, 0.62].indexed) ...[
                    if (i > 0) const SizedBox(height: 10),
                    FractionallySizedBox(widthFactor: w, child: SizedBox(height: 1, child: ColoredBox(color: colors.lineStrong))),
                  ],
                ],
              ),
            ),
    );
  }
}
