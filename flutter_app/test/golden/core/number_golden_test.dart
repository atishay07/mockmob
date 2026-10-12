import 'package:flutter/material.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

Widget _numbers() {
  return Builder(
    builder: (context) {
      final t = context.mmType;
      final c = context.mmColors;
      return SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mock 7, Accountancy, received at 10:42 PM', style: t.caption.copyWith(color: c.ink2)),
            const SizedBox(height: 8),
            const MonumentalNumber(value: '183', unit: 'of 250'),
            const SizedBox(height: 4),
            Text('38 right, 7 wrong, 5 left', style: t.body.copyWith(color: c.ink2)),
            const SizedBox(height: 28),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MonumentalNumber(value: '6', style: t.hero.copyWith(fontSize: 96, height: 82 / 96)),
                const SizedBox(width: 14),
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text('mistakes\nready to repair', style: t.title.copyWith(height: 1.15)),
                ),
              ],
            ),
            const SizedBox(height: 28),
            MonumentalNumber(value: '30', unit: 'weeks', style: t.figure),
            const SizedBox(height: 16),
            MonumentalNumber(value: '1,000', style: t.figureCompact, unit: 'CSAS scale'),
          ],
        ),
      );
    },
  );
}

void main() {
  nightGolden('number', _numbers);
}
