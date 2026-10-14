import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/core/mascot/mobi_geometry.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../core/night_support.dart';

/// A labelled grid of Mobi frames for goldens. Every cell has the same fixed height and its
/// own hairline on Mobi's ground line, so a hop reads against a shared baseline, and the sheet's
/// height is exactly [heightFor] (the golden is cropped to its content, not to a phone).
class MobiSheet extends StatelessWidget {
  const MobiSheet({super.key, required this.title, required this.frames, this.size = 132, this.columns = 3, this.width = 384});

  final String title;
  final List<(String, MobiRig)> frames;
  final double size;
  final int columns;

  /// The golden's logical width.
  final double width;

  static const double _top = 20;
  static const double _titleHeight = 34;
  static const double _titleGap = 8;
  static const double _captionGap = 4;
  static const double _captionHeight = 24;
  static const double _rowGap = 10;
  static const double _bottom = 12;
  static const double _side = 12;

  /// The exact height of a sheet of [count] frames.
  static double heightFor(int count, {double size = 132, int columns = 3}) {
    final rows = (count / columns).ceil();
    final cell = size + _captionGap + _captionHeight;
    return _top + _titleHeight + _titleGap + rows * cell + (rows - 1) * _rowGap + _bottom;
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final cellWidth = (width - _side * 2) / columns;
    final ground = size * MobiGeo.ground / MobiGeo.height;
    return Padding(
      padding: const EdgeInsets.fromLTRB(_side, _top, _side, _bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(height: _titleHeight, child: Text(title, style: type.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
          const SizedBox(height: _titleGap),
          Wrap(
            runSpacing: _rowGap,
            children: [
              for (final (label, rig) in frames)
                SizedBox(
                  width: cellWidth,
                  height: size + _captionGap + _captionHeight,
                  child: Column(children: [
                    SizedBox(
                      width: cellWidth,
                      height: size,
                      child: Stack(
                        alignment: Alignment.topCenter,
                        children: [
                          Positioned(left: 10, right: 10, top: ground, height: 1, child: ColoredBox(color: colors.line)),
                          MobiFigure.still(rig, size: size),
                        ],
                      ),
                    ),
                    const SizedBox(height: _captionGap),
                    SizedBox(
                      height: _captionHeight,
                      child: Text(label, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ]),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A frame-sheet golden cropped to its content height (the width stays the Night Sheet's).
void mobiSheetGolden(String name, String title, List<(String, MobiRig)> frames, {double size = 132, int columns = 3}) {
  nightGolden(
    name,
    () => MobiSheet(title: title, frames: frames, size: size, columns: columns),
    size: Size(kNightSize.width, MobiSheet.heightFor(frames.length, size: size, columns: columns)),
  );
}

/// Frames of [act] at [times] (seconds), stepped exactly as a 60 fps screen would. A [name]
/// prefixes each caption ("hello 400 ms"), so a sheet that joins several acts reads in order.
List<(String, MobiRig)> framesOf(MobiAct act, List<double> times, {void Function(MobiSim)? setup, double? seconds, String? name}) {
  final sim = MobiSim();
  setup?.call(sim);
  sim.run(0.5);
  sim.play(act, seconds: seconds);
  var at = 0.0;
  final out = <(String, MobiRig)>[];
  for (final t in times) {
    final rig = sim.run(t - at, fps: 60).copyWith();
    at = t;
    final ms = '${(t * 1000).round()} ms';
    out.add((name == null ? ms : '$name $ms', rig));
  }
  return out;
}

/// Like `nightGolden`, but pumps [settle] more after Mobi appears (a line typed in full, say),
/// then tears the tree down so Mobi's rest timer does not outlive the test.
void settledGolden(String name, Widget Function() build, {Duration settle = const Duration(seconds: 5)}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      await pumpMockmob(
        tester,
        Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: build())),
        brightness: brightness,
        size: kNightSize,
      );
      for (var t = Duration.zero; t < settle; t += const Duration(milliseconds: 100)) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await expectLater(find.byType(Scaffold).first, matchesGoldenFile('goldens/${name}_$tag.png'));
      await tester.pumpWidget(const SizedBox());
    });
  }
}
