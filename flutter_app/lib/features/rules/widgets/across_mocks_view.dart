import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/lab_loop.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/widgets/motion_bits.dart' show WhenInView;
import '../copy.dart';

/// "Across your mocks" (Mistake Lab v4 slice 3, spec 4.9): what the student's timed mocks show
/// together, at the end of the Lab and on You. Every line is the server's sentence with its
/// denominator; a line below its own gate states the gate in words and is drawn as not yet
/// measured (a dashed ring, quieter ink), never as a finding. At most three lines show, ranked by
/// the server by marks lost; the rest open under "Show all".
///
/// Motion: the first time a block comes into view in this app run, its lines rise in one after
/// another (180 ms each on the ease-out curve, 60 ms apart). Opening "Show all" grows the block
/// to fit and the new lines fade in after it. Under reduced motion everything is at rest at once.
/// The line shown while Across your mocks is not open yet: the app's own plain words for no timed
/// mock yet and for the mocks still to go (the gate read from the server's sentence, "opens at 2"),
/// else the server's sentence as it is.
String acrossGateLine(AcrossMocks across) {
  if (across.state == AcrossMocks.none) return RulesCopy.acrossNone;
  final message = across.message ?? '';
  if (across.state == AcrossMocks.belowGate) {
    final gate = int.tryParse(RegExp(r'opens at (\d+)').firstMatch(message)?.group(1) ?? '');
    final have = across.mocks;
    if (gate != null && have != null && have < gate) return RulesCopy.acrossBelowGate(gate - have);
  }
  return message;
}

class AcrossMocksView extends StatefulWidget {
  const AcrossMocksView({super.key, required this.across, required this.seenKey, this.titled = true});

  final AcrossMocks across;

  /// Which block this is (`attempt:<id>` or `you`), so its entrance plays once per app run.
  final String seenKey;

  /// Draws the block's own title. Off where the host already titles it (You's hub section).
  final bool titled;

  /// The timings shared with the tests.
  static const Duration rise = Duration(milliseconds: 180);
  static const Duration step = Duration(milliseconds: 60);

  /// Forgets which blocks have played their entrance (tests only).
  @visibleForTesting
  static void debugResetSeen() => _AcrossMocksViewState._seen.clear();

  @override
  State<AcrossMocksView> createState() => _AcrossMocksViewState();
}

class _AcrossMocksViewState extends State<AcrossMocksView> with SingleTickerProviderStateMixin {
  static final Set<String> _seen = {};

  late final AnimationController _arrive;
  bool _all = false;
  bool _decided = false;

  int get _rows => widget.across.isReady ? widget.across.lines.length : 1;

  Duration get _length => AcrossMocksView.rise + AcrossMocksView.step * (_rows - 1).clamp(0, 8);

  @override
  void initState() {
    super.initState();
    _arrive = AnimationController(vsync: this, duration: _length, value: 1);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_decided) return;
    _decided = true;
    if (!_seen.contains(widget.seenKey) && !Motion.reduced(context)) _arrive.value = 0;
  }

  @override
  void didUpdateWidget(AcrossMocksView old) {
    super.didUpdateWidget(old);
    _arrive.duration = _length;
    if (widget.across.more.isEmpty) _all = false;
  }

  @override
  void dispose() {
    _arrive.dispose();
    super.dispose();
  }

  void _onVisible() {
    if (!mounted || _arrive.value >= 1) return;
    if (!_seen.add(widget.seenKey) || Motion.reduced(context)) {
      _arrive.value = 1;
      return;
    }
    unawaited(_arrive.forward(from: 0));
  }

  Animation<double> _rowArrival(int i) {
    final total = _length.inMicroseconds;
    final start = (AcrossMocksView.step * i).inMicroseconds / total;
    final end = start + AcrossMocksView.rise.inMicroseconds / total;
    return _arrive.drive(CurveTween(curve: Interval(start.clamp(0.0, 1.0), end.clamp(0.0, 1.0), curve: Motion.out)));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final across = widget.across;
    final fine = type.small.copyWith(color: colors.ink3);

    final Widget body;
    if (!across.isReady) {
      body = _Rise(
        animation: _rowArrival(0),
        child: _LineRow(icon: LucideIcons.circleDashed, text: acrossGateLine(across), gated: true),
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < across.lines.length; i++) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
            _Rise(animation: _rowArrival(i), child: _LineRow.of(across.lines[i], lead: i == 0)),
          ],
          if (across.more.isNotEmpty) ...[
            MmSizeEase(
              duration: Motion.of(context, Motion.card),
              curve: Motion.out,
              alignment: Alignment.topCenter,
              child: !_all
                  ? const SizedBox(width: double.infinity)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final line in across.more) ...[
                          Divider(height: 1, thickness: 1, color: colors.line),
                          _FadeIn(child: _LineRow.of(line)),
                        ],
                      ],
                    ),
            ),
            const SizedBox(height: MmSpace.s4),
            _ShowAll(
              label: _all ? across.showFewer : (across.showAll ?? RulesCopy.showAll(across.lines.length + across.more.length)),
              open: _all,
              onTap: () => setState(() => _all = !_all),
            ),
          ],
          if (across.basis != null) ...[
            SizedBox(height: across.more.isEmpty ? MmSpace.s12 : MmSpace.s4),
            Text(across.basis!, style: fine),
          ],
        ],
      );
    }

    final content = WhenInView(onVisible: _onVisible, child: body);
    if (!widget.titled) return content;
    return MmSection(title: across.title, child: content);
  }
}

/// One line: a glyph for what it measures, then the server's sentence. The first line (the most
/// marks) reads a little stronger; a gated line is quieter and wears a dashed ring.
class _LineRow extends StatelessWidget {
  const _LineRow({required this.icon, required this.text, this.gated = false, this.lead = false});

  factory _LineRow.of(AcrossLine line, {bool lead = false}) => _LineRow(
        icon: line.gated ? LucideIcons.circleDashed : _iconFor(line.id),
        text: line.id == AcrossLine.neverOpened && !line.gated ? RulesCopy.neverOpenedLine(line.text) : line.text,
        gated: line.gated,
        lead: lead && !line.gated,
      );

  static IconData _iconFor(String id) => switch (id) {
        AcrossLine.secondThoughts => LucideIcons.arrowLeftRight,
        AcrossLine.changesHelp => LucideIcons.gitCompareArrows,
        AcrossLine.neverOpened => LucideIcons.eyeOff,
        AcrossLine.longStays => LucideIcons.hourglass,
        AcrossLine.lastTen => LucideIcons.timer,
        _ => LucideIcons.chartNoAxesColumn,
      };

  final IconData icon;
  final String text;
  final bool gated;
  final bool lead;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = (lead ? type.body.copyWith(fontWeight: FontWeight.w500) : type.body).copyWith(color: gated ? colors.ink2 : colors.ink);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: ShapeDecoration(
                color: gated ? null : colors.sunken,
                shape: RoundedSuperellipseBorder(
                  borderRadius: const BorderRadius.all(Radius.circular(10)),
                  side: gated ? BorderSide.none : BorderSide(color: colors.line),
                ),
              ),
              child: Icon(icon, size: 16, color: gated ? colors.ink3 : colors.ink2),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: Padding(
              // The first line of text sits on the glyph's centre line.
              padding: const EdgeInsets.only(top: 4),
              child: Text(text, style: style),
            ),
          ),
        ],
      ),
    );
  }
}

/// "Show all 5" / "Show fewer", with a chevron that turns as the block opens.
class _ShowAll extends StatelessWidget {
  const _ShowAll({required this.label, required this.open, required this.onTap});

  final String label;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Align(
      alignment: Alignment.centerLeft,
      child: MmPressable(
        onTap: onTap,
        semanticsLabel: label,
        selected: open,
        focusRadius: MmRadius.smallAll,
        haptic: MmPressHaptic.selection,
        builder: (context, pressed, _) => ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.min),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: context.mmType.labelLarge.copyWith(color: pressed ? colors.ink2 : colors.ink)),
              const SizedBox(width: MmSpace.s4),
              AnimatedRotation(
                turns: open ? 0.5 : 0,
                duration: Motion.of(context, Motion.ui),
                curve: Motion.out,
                child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Fades and rises a line in with its block's entrance.
class _Rise extends StatelessWidget {
  const _Rise({required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final t = animation.value;
        if (t >= 1) return child!;
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 6 * (1 - t)), child: child));
      },
    );
  }
}

/// A folded line arriving once "Show all" has opened room for it.
class _FadeIn extends StatelessWidget {
  const _FadeIn({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Motion.ui,
      curve: Motion.out,
      child: child,
      builder: (context, t, child) => Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 4 * (1 - t)), child: child)),
    );
  }
}
