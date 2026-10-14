import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// "How Concepts work": the three steps in one line (Learn, Lock in, Apply). On the first visit
/// Mobi stands beside it and points at it; after that the line stands alone.
class HowConcepts extends StatefulWidget {
  const HowConcepts({super.key, this.withMobi = false});

  final bool withMobi;

  @override
  State<HowConcepts> createState() => _HowConceptsState();
}

class _HowConceptsState extends State<HowConcepts> {
  final _mobi = MobiController();
  final _line = GlobalKey();
  bool _pointed = false;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (widget.withMobi && !_pointed) {
      _pointed = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.pointAtWidget(_line);
      });
    }
    final text = Column(
      key: _line,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(LearnCopy.howTitle, style: type.subhead),
        ),
        const SizedBox(height: MmSpace.s4),
        Text(LearnCopy.howLine, style: type.body.copyWith(color: colors.ink2)),
      ],
    );
    if (!widget.withMobi) return text;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: text),
        const SizedBox(width: MmSpace.s8),
        Mobi(pose: MobiPose.point, size: 80, controller: _mobi),
      ],
    );
  }
}
