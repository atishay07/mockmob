import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/theme.dart';
import '../art/mm_art.dart';
import '../brand/cold_open.dart';
import '../brand/mark.dart';
import '../brand/wordmark.dart';
import '../bubbles/bubble.dart';
import '../bubbles/bubble_grid.dart';
import '../bubbles/bubble_row.dart';
import '../bubbles/week_bubbles.dart';
import '../controls/chip.dart';
import '../controls/segmented.dart';
import '../controls/select_row.dart';
import '../key_button.dart';
import '../key_button_face.dart';
import '../monumental_number.dart';
import 'lab_materials.dart';

/// One section of the lab.
class LabSection {
  const LabSection(this.title, this.builder);

  final String title;
  final WidgetBuilder builder;
}

final List<LabSection> labSections = [
  LabSection('Brand', (_) => const _Brand()),
  LabSection('Colour', (_) => const _Swatches()),
  LabSection('Type', (_) => const _Type()),
  LabSection('Buttons', (_) => const LabButtons()),
  LabSection('Controls', (_) => const _Controls()),
  LabSection('Bubbles', (_) => const LabBubbles()),
  LabSection('Monumental number', (_) => const _Numbers()),
  LabSection('Glass and light', (_) => const LabMaterials()),
  LabSection('Subjects', (_) => const LabSubjects()),
  LabSection('Mobi', (_) => const LabMobi()),
  LabSection('States', (_) => const LabStates()),
  LabSection('Dock', (_) => const LabDock()),
];

class _Brand extends StatelessWidget {
  const _Brand();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(children: [MmMark(size: 72), SizedBox(width: 16), MmMark(size: 40), SizedBox(width: 16), MmMark(size: 24)]),
        const SizedBox(height: 20),
        const Wordmark(height: 40),
        const SizedBox(height: 20),
        Row(
          children: [
            for (final p in const [0.25, 0.5, 1.0]) ...[
              Expanded(
                child: ClipRRect(
                  borderRadius: MmRadius.keyAll,
                  child: SizedBox(height: 180, child: ColdOpen(onDone: () {}, progress: p)),
                ),
              ),
              if (p != 1.0) const SizedBox(width: 8),
            ],
          ],
        ),
      ],
    );
  }
}

class _Swatches extends StatelessWidget {
  const _Swatches();

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final roles = <String, Color>{
      'ground': c.ground,
      'raised': c.raised,
      'raised 2': c.raised2,
      'hairline': c.line,
      'ink': c.ink,
      'ink 2': c.ink2,
      'ink 3': c.ink3,
      'volt': c.volt,
      'lamp': c.lamp,
      'wrong': c.wrongSurface,
    };
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final e in roles.entries)
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(color: e.value, borderRadius: MmRadius.smallAll, border: Border.all(color: c.line)),
                child: const SizedBox(width: 56, height: 40),
              ),
              const SizedBox(height: 4),
              Text(e.key, style: context.mmType.caption.copyWith(color: c.ink3, fontSize: 11)),
            ],
          ),
      ],
    );
  }
}

class _Type extends StatelessWidget {
  const _Type();

  @override
  Widget build(BuildContext context) {
    final t = context.mmType;
    final c = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Every lost mark has a pattern.', style: t.moment),
        const SizedBox(height: 8),
        Text('Practice', style: t.screenTitle),
        const SizedBox(height: 8),
        Text('Partnership accounts', style: t.cardTitle),
        const SizedBox(height: 6),
        Text('Seven of your wrong answers came from admission of a partner. Ten minutes fixes most of them.', style: t.body.copyWith(color: c.ink2)),
        const SizedBox(height: 6),
        Text('Which of these is not a feature of a partnership?', style: t.question),
        const SizedBox(height: 6),
        Text('Tonight at 8:00 PM', style: t.labelLarge),
        Text('Mock 7 done. That is your third full paper this month.', style: t.caption.copyWith(color: c.ink3)),
      ],
    );
  }
}

/// Every button state.
class LabButtons extends StatelessWidget {
  const LabButtons({super.key});

  @override
  Widget build(BuildContext context) {
    Widget letter(String l) => Text(l, style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink2));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyButton(label: 'Build my plan', onPressed: () {}),
        const SizedBox(height: MmSpace.s12),
        const KeyButtonFace(label: 'Build my plan', depth: 1),
        const SizedBox(height: MmSpace.s12),
        const KeyButton(label: 'Start repair', onPressed: null, disabledReason: 'Connect to start.'),
        const SizedBox(height: MmSpace.s12),
        KeyButton(label: 'Starting', loading: true, onPressed: () {}),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: 'I already have an account', onPressed: () {}),
        const SizedBox(height: MmSpace.s12),
        const KeyButtonFace(label: 'I already have an account', variant: KeyVariant.secondary, depth: 1),
        const SizedBox(height: MmSpace.s12),
        const KeyButtonFace(label: 'Save and next', focused: true),
        const SizedBox(height: 4),
        Align(alignment: Alignment.centerLeft, child: KeyButton.quiet(label: 'Not now', onPressed: () {})),
        const SizedBox(height: 4),
        KeyButton.option(label: 'Admission of a partner', selected: false, leading: letter('A'), onPressed: () {}),
        const SizedBox(height: MmSpace.s12),
        KeyButton.option(label: 'Retirement of a partner', selected: true, leading: letter('B'), onPressed: () {}),
      ],
    );
  }
}

class _Controls extends StatefulWidget {
  const _Controls();

  @override
  State<_Controls> createState() => _ControlsState();
}

class _ControlsState extends State<_Controls> {
  int _stage = 0;
  String _glass = 'full';
  int _minutes = 20;

  @override
  Widget build(BuildContext context) {
    const stages = ['Class 12, writing in 2027', 'Passed Class 12', 'Class 11'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < stages.length; i++) ...[
          MmSelectRow(
            title: stages[i],
            note: i == 0 ? 'Boards and CUET in the same months.' : null,
            selected: _stage == i,
            onTap: () => setState(() => _stage = i),
          ),
          const SizedBox(height: 8),
        ],
        const MmSelectRow(title: 'Not available yet', selected: false, onTap: null),
        const SizedBox(height: 16),
        MmSegmented<String>(
          segments: const [MmSegment('full', 'Full'), MmSegment('lite', 'Lite'), MmSegment('off', 'Off')],
          value: _glass,
          onChanged: (v) => setState(() => _glass = v),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          children: [
            for (final m in const [10, 20, 30]) MmChip(label: '$m min', selected: _minutes == m, onTap: () => setState(() => _minutes = m)),
            const MmChip(label: 'Economics', selected: false, onTap: null, leading: LucideIcons.lock),
          ],
        ),
      ],
    );
  }
}

/// Bubble states, a row, the 50-cell sheet and the week.
class LabBubbles extends StatelessWidget {
  const LabBubbles({super.key});

  static final List<BubbleState> sheet = [
    for (var i = 0; i < 50; i++)
      i % 9 == 4 ? BubbleState.wrong : (i % 13 == 7 ? BubbleState.blank : (i % 17 == 3 ? BubbleState.marked : BubbleState.filled)),
  ];

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final t = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (final s in BubbleState.values) ...[
              Column(children: [
                Bubble(state: s, size: 26),
                const SizedBox(height: 4),
                Text(s.name, style: t.caption.copyWith(fontSize: 10, color: c.ink3)),
              ]),
              const SizedBox(width: 12),
            ],
          ],
        ),
        const SizedBox(height: 16),
        Row(children: [
          Text('Mock 7', style: t.labelLarge),
          const SizedBox(width: 12),
          BubbleRow(states: sheet.sublist(0, 16)),
        ]),
        const SizedBox(height: 16),
        BubbleGrid(states: sheet),
        const SizedBox(height: 16),
        BubbleGrid(states: sheet.sublist(0, 20), sealed: true, numbers: false),
        const SizedBox(height: 16),
        WeekBubbles(days: const [
          WeekBubbleDay(mark: WeekDayMark.done),
          WeekBubbleDay(mark: WeekDayMark.done),
          WeekBubbleDay(mark: WeekDayMark.rest),
          WeekBubbleDay(mark: WeekDayMark.done, isToday: true),
          WeekBubbleDay(),
          WeekBubbleDay(),
          WeekBubbleDay(mark: WeekDayMark.rest),
        ]),
      ],
    );
  }
}

class _Numbers extends StatelessWidget {
  const _Numbers();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const MonumentalNumber(value: '183', unit: 'of 250'),
        const SizedBox(height: 12),
        MonumentalNumber(value: '30', unit: 'weeks', style: context.mmType.figure),
        const SizedBox(height: 12),
        Row(children: [
          const ArtImage(MmArt.tokenFirstMock, height: 64),
          const SizedBox(width: 8),
          const ArtImage(MmArt.tokenFirstRepair, height: 64),
          const SizedBox(width: 8),
          const ArtImage(MmArt.tokenHeld, height: 64),
          const SizedBox(width: 8),
          const ArtImage(MmArt.foilSeal, height: 64),
        ]),
      ],
    );
  }
}
