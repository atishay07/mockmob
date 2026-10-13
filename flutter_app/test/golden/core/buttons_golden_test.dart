import 'package:flutter/material.dart';
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/widgets/lab/lab_sections.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import 'night_support.dart';

Widget _controls() {
  return SingleChildScrollView(
    physics: const NeverScrollableScrollPhysics(),
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmSelectRow(title: 'Class 12, writing in 2027', note: 'Boards and CUET in the same months.', selected: true, onTap: () {}),
        const SizedBox(height: 8),
        MmSelectRow(title: 'Passed Class 12', selected: false, onTap: () {}),
        const SizedBox(height: 8),
        const MmSelectRow(title: 'Not sure yet', selected: false, onTap: null),
        const SizedBox(height: 16),
        MmSegmented<int>(
          segments: const [MmSegment(0, 'Full'), MmSegment(1, 'Lite'), MmSegment(2, 'Off')],
          value: 1,
          onChanged: (_) {},
        ),
        const SizedBox(height: 16),
        Wrap(spacing: 8, children: [
          MmChip(label: '10 min', selected: false, onTap: () {}),
          MmChip(label: '20 min', selected: true, onTap: () {}),
          MmChip(label: '30 min', selected: false, onTap: () {}),
          const MmChip(label: 'Later', selected: false, onTap: null),
        ]),
        const SizedBox(height: 16),
        QuickStartRow(glyph: SheetGlyph.quick, title: 'Quick 10', note: '10 questions, about 10 minutes.', lit: true, onTap: () {}),
        const SizedBox(height: 8),
        QuickStartRow(glyph: SheetGlyph.repair, title: 'Repair the next mistake', note: 'A worked explanation for your next mistake, in Partnership.', onTap: () {}),
        const SizedBox(height: 16),
        const TabRootHeader(title: 'Practice', overline: 'Tuesday, 13 October'),
      ],
    ),
  );
}

void main() {
  nightGolden(
    'buttons',
    () => const SingleChildScrollView(physics: NeverScrollableScrollPhysics(), padding: EdgeInsets.all(16), child: LabButtons()),
  );
  nightGolden('controls', _controls);
}
