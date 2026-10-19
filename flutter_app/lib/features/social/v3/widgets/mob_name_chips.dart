// The Mob name chips (spec 5.3 D0a and SET): six names at a time from the fixed kind list, a note that
// says why the list is the list, and "Show six more" (then "Back to the first six" after the last).
// There is no free text: the key sent is the index into `mobNames`, which the server holds too.

import 'package:flutter/material.dart';

import '../../../../core/motion/motion.dart';
import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/widgets.dart';
import '../copy_v3.dart';
import '../logic/mob_names.dart';

class MobNameChips extends StatefulWidget {
  const MobNameChips({super.key, required this.selected, required this.onChanged, this.showNote = true, this.perPage = 6});

  /// The chosen name's key, or null when none is (a Mob that still shows its subject).
  final int? selected;
  final ValueChanged<int> onChanged;
  final bool showNote;
  final int perPage;

  @override
  State<MobNameChips> createState() => _MobNameChipsState();
}

class _MobNameChipsState extends State<MobNameChips> {
  late int _page = widget.selected == null ? 0 : (widget.selected! ~/ widget.perPage).clamp(0, _pages - 1);

  int get _pages => (mobNames.length / widget.perPage).ceil();

  void _more() => setState(() => _page = (_page + 1) % _pages);

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final start = _page * widget.perPage;
    final end = (start + widget.perPage).clamp(0, mobNames.length);
    final last = _page == _pages - 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MmOverlapSwitcher(
          duration: Motion.ui,
          alignment: Alignment.topLeft,
          child: Wrap(
            key: ValueKey(_page),
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s4,
            children: [
              for (var i = start; i < end; i++) MmChip(label: mobNames[i], showBubble: false, selected: widget.selected == i, onTap: () => widget.onChanged(i)),
            ],
          ),
        ),
        if (widget.showNote) ...[
          const SizedBox(height: MmSpace.s4),
          Text(MobV3Copy.namesKind, style: type.small.copyWith(color: c.ink2)),
        ],
        KeyButton.quiet(label: last ? MobV3Copy.showFirstSix : MobV3Copy.showSixMore, onPressed: _more),
      ],
    );
  }
}
