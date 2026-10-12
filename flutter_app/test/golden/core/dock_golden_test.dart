import 'package:flutter/material.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

Widget _dock(int index, {bool startPressed = false, bool dot = false}) {
  return GoldenRoom(
    child: Align(
      alignment: Alignment.bottomCenter,
      child: BackdropGroup(
        child: SplitDock(
          currentIndex: index,
          showReviewDot: dot,
          startPressed: startPressed,
          onTab: (_) {},
          onStart: (_) {},
        ),
      ),
    ),
  );
}

void main() {
  nightGolden('dock_today', () => _dock(0));
  nightGolden('dock_practice', () => _dock(1));
  nightGolden('dock_review_dot', () => _dock(2, dot: true));
  nightGolden('dock_start_pressed', () => _dock(0, startPressed: true));
}
