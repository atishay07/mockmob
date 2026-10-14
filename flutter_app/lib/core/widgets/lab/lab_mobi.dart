import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../controls/chip.dart';
import '../mobi.dart';

/// Mobi in the lab: a live stage with every act and mood, a line to say, a target to point at
/// and a pad the eyes follow; a walk across a row; the 15 Oct acts and moods held still with
/// Night and Day side by side; then the pose-based Mobi as screens use it.
class LabMobi extends StatefulWidget {
  const LabMobi({super.key});

  @override
  State<LabMobi> createState() => _LabMobiState();
}

class _LabMobiState extends State<LabMobi> {
  final MobiController _mobi = MobiController();
  final GlobalKey _target = GlobalKey();
  MobiAct? _last;
  MobiMood _mood = MobiMood.calm;
  int _line = 0;
  int _walks = 0;
  bool _walkRight = true;
  String? _reacted;

  static const List<String> _lines = [
    "Hi, I'm Mobi. Let's find where your marks go.",
    'Mock 7 done. That is your third full paper this month.',
    'Late one tonight. Ten minutes, then sleep.',
  ];

  /// The acts added on 15 Oct, for the still gallery.
  static const List<MobiAct> _newActs = [MobiAct.nod, MobiAct.tilt, MobiAct.wave, MobiAct.startle, MobiAct.brace, MobiAct.relief, MobiAct.walk];

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  void _play(MobiAct act) {
    setState(() => _last = act);
    _mobi.play(act);
  }

  void _setMood(MobiMood mood) {
    setState(() => _mood = mood);
    _mobi.setMood(mood);
  }

  void _react(MobiEvent event) {
    final played = _mobi.react(MobiMoments.act(event), key: 'lab:${event.name}');
    setState(() => _reacted = played ? '${event.name}: ${MobiMoments.act(event).name}' : '${event.name}: held back (rate limit)');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    const poses = [MobiPose.greet, MobiPose.point, MobiPose.think, MobiPose.cheer, MobiPose.rest, MobiPose.sleepy, MobiPose.read];
    Widget label(String text) => Padding(
          padding: const EdgeInsets.only(top: MmSpace.s16, bottom: MmSpace.s8),
          child: Text(text, style: type.caption.copyWith(color: colors.ink3)),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: MobiStage(
            controller: _mobi,
            size: 170,
            semanticLabel: 'Mobi',
            bubbleWidth: 300,
            tapCycle: MobiTapCycle.standard,
            followPointer: true,
          ),
        ),
        Center(child: Text('Tap him a few times. Move a finger anywhere: he watches it.', style: type.caption.copyWith(color: colors.ink3))),
        label('Acts'),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [
            for (final act in MobiAct.values)
              if (act != MobiAct.talk) MmChip(label: act.name, selected: _last == act, onTap: () => _play(act)),
            MmChip(
              label: 'say',
              selected: false,
              onTap: () => _mobi.say(_lines[_line++ % _lines.length]),
            ),
            MmChip(label: 'point at the dot', selected: false, onTap: () => _mobi.pointAtWidget(_target)),
          ],
        ),
        label('Mood (the face under every act)'),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [for (final m in MobiMood.values) MmChip(label: m.name, selected: _mood == m, onTap: () => _setMood(m))],
        ),
        label('Reactions by event (rate-limited per event, Celebrations setting and reduced motion apply)'),
        Wrap(
          spacing: MmSpace.s8,
          runSpacing: MmSpace.s8,
          children: [
            for (final e in const [
              MobiEvent.saveConfirmed,
              MobiEvent.saveFailed,
              MobiEvent.answerRight,
              MobiEvent.answerWrong,
              MobiEvent.choiceWitnessed,
              MobiEvent.goalMet,
              MobiEvent.refused,
              MobiEvent.goodbye,
            ])
              MmChip(label: e.name, selected: false, onTap: () => _react(e)),
          ],
        ),
        if (_reacted != null) Padding(padding: const EdgeInsets.only(top: MmSpace.s8), child: Text(_reacted!, style: type.caption.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s12),
        GestureDetector(
          onPanDown: (d) => _mobi.lookAt(d.globalPosition),
          onPanUpdate: (d) => _mobi.lookAt(d.globalPosition),
          onPanEnd: (_) => _mobi.lookAt(null),
          onPanCancel: () => _mobi.lookAt(null),
          child: Container(
            height: 88,
            decoration: BoxDecoration(
              color: colors.sunken,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.line),
            ),
            child: Stack(
              children: [
                Center(child: Text('Drag here: Mobi watches', style: type.caption.copyWith(color: colors.ink3))),
                Positioned(
                  right: 18,
                  top: 18,
                  child: Container(key: _target, width: 14, height: 14, decoration: BoxDecoration(color: colors.volt, shape: BoxShape.circle)),
                ),
              ],
            ),
          ),
        ),
        label('Walk (arrives with a nod)'),
        LayoutBuilder(
          builder: (context, box) {
            final room = (box.maxWidth - MobiFigure.widthFor(72)).clamp(0.0, 400.0);
            return Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: SizedBox(
                    height: 72,
                    child: _walks == 0
                        ? const SizedBox.shrink()
                        : MobiWalker(
                            key: ValueKey(_walks),
                            size: 72,
                            fromX: _walkRight ? 0 : room * 0.7,
                            toX: _walkRight ? room * 0.7 : 0,
                            onArrive: (c) => c.react(MobiAct.nod),
                          ),
                  ),
                ),
                MmChip(
                  label: 'walk',
                  selected: false,
                  onTap: () => setState(() {
                    if (_walks > 0) _walkRight = !_walkRight;
                    _walks++;
                  }),
                ),
              ],
            );
          },
        ),
        label('New acts, held still: Night and Day'),
        _NightDay(
          builder: (context) => Wrap(
            spacing: 4,
            runSpacing: 8,
            children: [for (final a in _newActs) _Still(rig: MobiMoves.keyPose(a), caption: a.name)],
          ),
        ),
        label('Moods, standing: Night and Day'),
        _NightDay(
          builder: (context) => Wrap(
            spacing: 4,
            runSpacing: 8,
            children: [for (final m in MobiMood.values) _Still(rig: MobiMoods.apply(m, const MobiRig()), caption: m.name, head: true)],
          ),
        ),
        const SizedBox(height: MmSpace.s20),
        Wrap(spacing: 4, runSpacing: 8, children: [for (final p in poses) Mobi(pose: p, size: 72)]),
        const SizedBox(height: 12),
        const Mobi(pose: MobiPose.sleepy, size: 88, say: 'Late one tonight. Ten minutes, then sleep.'),
      ],
    );
  }
}

/// The same content under the Night theme and the Day theme, side by side (stacked when narrow).
class _NightDay extends StatelessWidget {
  const _NightDay({required this.builder});

  final WidgetBuilder builder;

  Widget _panel(Brightness b, String name) => Theme(
        data: buildTheme(b),
        child: Builder(
          builder: (context) {
            final colors = context.mmColors;
            return Container(
              padding: const EdgeInsets.all(MmSpace.s12),
              decoration: BoxDecoration(
                color: colors.ground,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: colors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: context.mmType.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s8),
                  builder(context),
                ],
              ),
            );
          },
        ),
      );

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          final night = _panel(Brightness.dark, 'Night');
          final day = _panel(Brightness.light, 'Day');
          if (box.maxWidth < 560) return Column(children: [night, const SizedBox(height: MmSpace.s8), day]);
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [Expanded(child: night), const SizedBox(width: MmSpace.s8), Expanded(child: day)],
          );
        },
      );
}

class _Still extends StatelessWidget {
  const _Still({required this.rig, required this.caption, this.head = false});

  final MobiRig rig;
  final String caption;
  final bool head;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MobiFigure.still(rig, size: head ? 56 : 72, head: head),
          Text(caption, style: context.mmType.caption.copyWith(color: context.mmColors.ink3)),
        ],
      );
}
