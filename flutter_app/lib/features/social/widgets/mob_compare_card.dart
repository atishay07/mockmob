import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_repository.dart';
import '../mob_routes.dart';
import 'mob_parts.dart';

/// Compare with your Mob: the free teaser (where the Mob split, one line), what the plan allows next
/// to it, and the key that opens the side-by-side. Free: the teaser and one free side-by-side, once.
/// Pro: every week. The server decides what may open (`compare.access`); this only draws it and says
/// plainly what is waiting behind Pro. Sharing is reciprocal and the student's own choice, so the
/// switch is off until they turn it on and it says who sees what (rule 14). Nothing ranks anyone.
class MobCompareCard extends ConsumerStatefulWidget {
  const MobCompareCard({super.key, required this.mob, this.summary, this.week, this.extra, this.subtitle});

  final Mob mob;

  /// The summary of the paper this card is about (the week's, or an extra paper's).
  final MobCompareSummary? summary;

  /// A past or the current week's Monday, or null for this week.
  final String? week;
  final MobExtra? extra;
  final String? subtitle;

  @override
  ConsumerState<MobCompareCard> createState() => _MobCompareCardState();
}

class _MobCompareCardState extends ConsumerState<MobCompareCard> {
  bool _opening = false;
  bool _sharing = false;
  String? _notice;

  Future<void> _open() async {
    setState(() {
      _opening = true;
      _notice = null;
    });
    final (compare, failure) = await ref.read(mobActionsProvider).compare(week: widget.extra == null ? widget.week : null, extra: widget.extra?.id);
    if (!mounted) return;
    setState(() {
      _opening = false;
      _notice = failure == null ? null : MobCopy.failure(failure);
    });
    if (compare != null) {
      await openMobCompare(context, compare, week: widget.week, extra: widget.extra?.id);
    }
  }

  Future<void> _share(bool on) async {
    ref.read(hapticsProvider).toggle(on);
    setState(() {
      _sharing = true;
      _notice = null;
    });
    final failure = await ref.read(mobActionsProvider).updateMe(showScore: on);
    if (!mounted) return;
    setState(() {
      _sharing = false;
      _notice = failure == null ? null : MobCopy.failure(failure);
    });
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.summary;
    if (summary == null) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    final note = MobCopy.compareNote(summary);
    final canOpen = summary.canOpen;
    final showShare = !summary.youShare && !summary.locked;
    return MobCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(widget.subtitle == null ? MobCopy.compareTitle : '${MobCopy.compareTitle}: ${widget.subtitle}', style: type.label.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          if (summary.teaser != null)
            Text(summary.teaser!.text, style: type.title.copyWith(color: colors.ink))
          else
            Text(MobCopy.compareEmpty(summary), style: type.body.copyWith(color: colors.ink2)),
          if (note != null) ...[
            const SizedBox(height: MmSpace.s8),
            Text(note, style: type.small.copyWith(color: colors.ink2)),
          ],
          if (showShare) ...[
            const SizedBox(height: MmSpace.s12),
            MobSwitchRow(title: MobCopy.shareLabel, note: MobCopy.shareHint, value: false, enabled: !_sharing, onChanged: _share, padding: EdgeInsets.zero),
          ],
          if (canOpen) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: _opening ? MobCopy.opening : MobCopy.openCompare, loading: _opening, onPressed: _opening ? null : _open),
          ],
          if (_notice != null) ...[
            const SizedBox(height: MmSpace.s8),
            Semantics(liveRegion: true, child: Text(_notice!, style: type.small.copyWith(color: colors.ink))),
          ],
        ],
      ),
    );
  }
}

/// What you and the sitters who show their score have in common (a count and a shared miss: no
/// rank, no names, nobody who keeps their score private).
class MobTogetherCard extends StatelessWidget {
  const MobTogetherCard({super.key, required this.together});

  final MobTogether together;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return MobCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(header: true, child: Text(MobCopy.togetherTitle, style: type.label.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          Text(MobCopy.togetherLine(together), style: type.body.copyWith(color: colors.ink)),
        ],
      ),
    );
  }
}
