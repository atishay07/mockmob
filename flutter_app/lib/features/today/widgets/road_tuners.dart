// The two tuners under the road (L05, app-today-1016 sections 8.7 and 8.8): study days a week as a
// seven-stop strip you tap or slide, and full mocks before your date as a ruler you scroll under a
// fixed needle. Both report live while the finger moves (the rail and the figure follow) and once
// when it lets go (the save). Vertical drags pass to the page.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../logic/road_board.dart' show mockTargetMax, mockTargetMin;

/// Study days a week (8.7): seven stops in one 48 dp row; a tap picks one, a horizontal drag
/// slides the pill. [onPreview] runs live while dragging; [onCommit] once on release or tap.
class PaceStrip extends StatefulWidget {
  const PaceStrip({super.key, required this.value, required this.onPreview, required this.onCommit, this.enabled = true, this.semanticsValue});

  /// The selected count, or null when no goal is set (no pill).
  final int? value;
  final ValueChanged<int> onPreview;
  final ValueChanged<int> onCommit;
  final bool enabled;
  final String? semanticsValue;

  @override
  State<PaceStrip> createState() => _PaceStripState();
}

class _PaceStripState extends State<PaceStrip> {
  int? _drag;
  Timer? _tapCommit;

  @override
  void dispose() {
    _tapCommit?.cancel();
    super.dispose();
  }

  int _stopAt(double x, double width) => ((x / (width / 7)).floor() + 1).clamp(1, 7);

  void _preview(int n) {
    if (n == (_drag ?? widget.value)) return;
    HapticFeedback.selectionClick();
    setState(() => _drag = n);
    widget.onPreview(n);
  }

  void _commit() {
    final n = _drag;
    if (n == null) return;
    setState(() => _drag = null);
    if (n != widget.value) widget.onCommit(n);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = _drag ?? widget.value;
    final enabled = widget.enabled;
    return Semantics(
      slider: true,
      label: TodayCopy.paceTitle,
      value: widget.semanticsValue ?? (shown == null ? '' : '$shown'),
      increasedValue: shown == null || shown >= 7 ? null : '${shown + 1}',
      decreasedValue: shown == null || shown <= 1 ? null : '${shown - 1}',
      onIncrease: !enabled || shown == null || shown >= 7 ? null : () => widget.onCommit(shown + 1),
      onDecrease: !enabled || shown == null || shown <= 1 ? null : () => widget.onCommit(shown - 1),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, box) {
          final width = box.maxWidth;
          final stop = width / 7;
          return GestureDetector(
            key: const ValueKey('road-pace'),
            behavior: HitTestBehavior.opaque,
            onTapUp: !enabled
                ? null
                : (d) {
                    _preview(_stopAt(d.localPosition.dx, width));
                    _tapCommit?.cancel();
                    _tapCommit = Timer(const Duration(milliseconds: 400), _commit);
                  },
            onHorizontalDragStart: !enabled ? null : (d) => _preview(_stopAt(d.localPosition.dx, width)),
            onHorizontalDragUpdate: !enabled ? null : (d) => _preview(_stopAt(d.localPosition.dx, width)),
            onHorizontalDragEnd: !enabled ? null : (_) => _commit(),
            onHorizontalDragCancel: !enabled ? null : _commit,
            child: SizedBox(
              height: 48,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: colors.raised, borderRadius: BorderRadius.circular(24)),
                    ),
                  ),
                  if (shown != null && enabled)
                    AnimatedPositioned(
                      duration: Motion.of(context, const Duration(milliseconds: 220)),
                      curve: Motion.out,
                      left: (shown - 1) * stop + (stop - 44) / 2,
                      top: 4,
                      width: 44,
                      height: 40,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.volt,
                          borderRadius: BorderRadius.circular(20),
                          border: colors.isNight ? null : Border.all(color: colors.ink, width: 1),
                        ),
                      ),
                    ),
                  Row(
                    children: [
                      for (var n = 1; n <= 7; n++)
                        Expanded(
                          child: Center(
                            child: Text(
                              '$n',
                              style: type.labelLarge.copyWith(
                                color: n == shown && enabled ? colors.voltInk : (enabled ? colors.ink2 : colors.ink3),
                                fontWeight: n == shown ? FontWeight.w700 : FontWeight.w500,
                                fontFeatures: const [FontFeature.tabularFigures()],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Full mocks before your date (8.8): a ruler of ticks, one every 10 dp for 1 to 60, that scrolls
/// under a fixed needle. A long tick and its number every 5. [onPreview] follows the scroll;
/// [onCommit] runs once the ruler comes to rest on a value. Ticks up to [taken] are quieter: the
/// target can go below them, but it would already be met.
class MockRuler extends StatefulWidget {
  const MockRuler({super.key, required this.value, required this.onPreview, required this.onCommit, this.taken = 0, this.suggested = false});

  /// The value under the needle at rest.
  final int value;
  final ValueChanged<int> onPreview;
  final ValueChanged<int> onCommit;
  final int taken;

  /// The value is only a suggestion (no target set yet): the ruler is dimmed until moved.
  final bool suggested;

  static const double tick = 10;
  static const double height = 48;

  @override
  State<MockRuler> createState() => _MockRulerState();
}

class _MockRulerState extends State<MockRuler> {
  late final ScrollController _scroll = ScrollController(initialScrollOffset: _offsetOf(widget.value));
  bool _user = false;
  int? _live;

  static double _offsetOf(int v) => (v.clamp(mockTargetMin, mockTargetMax) - mockTargetMin) * MockRuler.tick;
  static int _valueAt(double offset) => ((offset / MockRuler.tick).round() + mockTargetMin).clamp(mockTargetMin, mockTargetMax);

  @override
  void didUpdateWidget(MockRuler old) {
    super.didUpdateWidget(old);
    // A value set elsewhere (the mocks sheet) moves the ruler, unless the finger is on it.
    if (old.value != widget.value && !_user && _scroll.hasClients && _valueAt(_scroll.offset) != widget.value) {
      _scroll.jumpTo(_offsetOf(widget.value));
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  bool _onNote(ScrollNotification n) {
    if (n.metrics.axis != Axis.horizontal) return false;
    if (n is ScrollStartNotification && n.dragDetails != null) _user = true;
    if (n is ScrollUpdateNotification && _user) {
      final v = _valueAt(n.metrics.pixels);
      if (v != (_live ?? widget.value)) {
        if (v % 5 == 0) HapticFeedback.selectionClick();
        _live = v;
        widget.onPreview(v);
      }
    }
    if (n is ScrollEndNotification && _user) {
      final v = _valueAt(n.metrics.pixels);
      final rest = _offsetOf(v);
      if ((n.metrics.pixels - rest).abs() > 0.5) {
        // Settle onto the nearest tick; the end of that glide commits.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_scroll.hasClients) return;
          final d = Motion.of(context, const Duration(milliseconds: 160));
          if (d <= Duration.zero) {
            _scroll.jumpTo(rest);
            _finish(v);
          } else {
            unawaited(_scroll.animateTo(rest, duration: d, curve: Motion.out).whenComplete(() => _finish(v)));
          }
        });
      } else {
        _finish(v);
      }
    }
    return false;
  }

  void _finish(int v) {
    if (!mounted || !_user) return;
    _user = false;
    _live = null;
    if (v != widget.value || widget.suggested) widget.onCommit(v);
  }

  void _tapAt(double localX, double width) {
    if (!_scroll.hasClients) return;
    final target = _valueAt(_scroll.offset + localX - width / 2);
    _user = true;
    _live = target;
    widget.onPreview(target);
    final d = Motion.of(context, Motion.glideDuration);
    if (d <= Duration.zero) {
      _scroll.jumpTo(_offsetOf(target));
      _finish(target);
    } else {
      unawaited(_scroll.animateTo(_offsetOf(target), duration: d, curve: Motion.glide).whenComplete(() => _finish(target)));
    }
  }

  void _stepBy(int by) {
    final v = (widget.value + by).clamp(mockTargetMin, mockTargetMax);
    if (_scroll.hasClients) _scroll.jumpTo(_offsetOf(v));
    widget.onCommit(v);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final shown = _live ?? widget.value;
    return Semantics(
      slider: true,
      label: TodayCopy.mocksTitle,
      value: TodayCopy.mocksSemantics(shown, widget.taken),
      increasedValue: shown >= mockTargetMax ? null : TodayCopy.mocksSemantics(shown + 1, widget.taken),
      decreasedValue: shown <= mockTargetMin ? null : TodayCopy.mocksSemantics(shown - 1, widget.taken),
      onIncrease: shown >= mockTargetMax ? null : () => _stepBy(1),
      onDecrease: shown <= mockTargetMin ? null : () => _stepBy(-1),
      excludeSemantics: true,
      child: LayoutBuilder(
        builder: (context, box) {
          final width = box.maxWidth;
          final side = width / 2 - MockRuler.tick / 2;
          return AnimatedOpacity(
            opacity: widget.suggested && !_user ? 0.5 : 1,
            duration: Motion.of(context, Motion.crossFade),
            child: SizedBox(
              key: const ValueKey('road-ruler'),
              height: MockRuler.height,
              child: Stack(
                children: [
                  NotificationListener<ScrollNotification>(
                    onNotification: _onNote,
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTapUp: (d) => _tapAt(d.localPosition.dx, width),
                      child: ShaderMask(
                        blendMode: BlendMode.dstIn,
                        shaderCallback: (rect) => LinearGradient(
                          colors: const [Color(0x00000000), Color(0xFF000000), Color(0xFF000000), Color(0x00000000)],
                          stops: [0, 40 / rect.width, 1 - 40 / rect.width, 1],
                        ).createShader(rect),
                        child: ListView.builder(
                          controller: _scroll,
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          padding: EdgeInsets.symmetric(horizontal: side),
                          itemExtent: MockRuler.tick,
                          itemCount: mockTargetMax - mockTargetMin + 1,
                          itemBuilder: (context, i) => _Tick(value: i + mockTargetMin, taken: widget.taken, colors: colors, type: type),
                        ),
                      ),
                    ),
                  ),
                  // The needle: fixed at the centre, the value under it is the target.
                  Positioned(
                    left: width / 2 - 1,
                    top: 0,
                    width: 2,
                    height: 30,
                    child: IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: colors.isNight ? colors.volt : colors.ink,
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Tick extends StatelessWidget {
  const _Tick({required this.value, required this.taken, required this.colors, required this.type});

  final int value, taken;
  final MmColors colors;
  final MmType type;

  @override
  Widget build(BuildContext context) {
    final long = value % 5 == 0 || value == mockTargetMin;
    final color = value <= taken ? colors.ink3 : colors.ink2;
    return OverflowBox(
      maxWidth: 28,
      child: Column(
        children: [
          const SizedBox(height: 4),
          Container(width: long ? 1.5 : 1, height: long ? 18 : 10, color: color.withValues(alpha: long ? 1 : 0.7)),
          if (long) ...[
            const SizedBox(height: 4),
            Text(
              '$value',
              textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.2),
              style: type.small.copyWith(fontSize: 11, height: 1.1, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ],
      ),
    );
  }
}
