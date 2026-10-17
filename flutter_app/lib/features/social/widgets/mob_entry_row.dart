import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../you/widgets/you_page.dart' show PillKey;
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../logic/mob_entry.dart';
import '../mob_routes.dart';
import '../screens/mob_sheets.dart' show InviteSheet;
import 'mob_parts.dart';

/// The Mob's one calm line on Practice and Review (the website's entry lines, from [mobEntryFor]).
/// Practice: this week's paper with an outlined "Sit it" key, or "See your answers" once sat. Review:
/// the Mob's shared trap, or where the Mob split, opening the student's own answers. Nothing at all
/// (no gap either) when the student is in no Mob, the Mob is off on the server, nothing has been read,
/// or the line has nothing true to say. Rows of the page's own kind (icon, title, one note, a hairline
/// below), so they sit among Revise and Rules without a card.
class MobEntryRow extends ConsumerStatefulWidget {
  const MobEntryRow({super.key, required this.place, this.divider = true});

  final MobEntryPlace place;

  /// A hairline under the row when it shows (the page's rows are ruled), so a row that is not drawn
  /// leaves no stray line.
  final bool divider;

  @override
  ConsumerState<MobEntryRow> createState() => _MobEntryRowState();
}

class _MobEntryRowState extends ConsumerState<MobEntryRow> {
  bool _opening = false;

  Future<void> _act(Mob mob, MobEntry entry) async {
    switch (entry.act) {
      case MobEntryAct.sit:
        if (_opening) return;
        setState(() => _opening = true);
        final failure = await ref.read(mobNavigatorProvider).sitPaper(context, ref, mob);
        if (!mounted) return;
        setState(() => _opening = false);
        if (failure != null) showMobToast(context, ref.read(mobActionsProvider).say(failure));
      case MobEntryAct.answers:
        final id = entry.resultId;
        if (id == null) return openMobPage(context);
        ref.read(mobNavigatorProvider).openAnswers(context, id);
      case MobEntryAct.invite:
        await showMmSheet<void>(context: context, title: MobCopy.inviteTitle, builder: (_) => const InviteSheet());
      case MobEntryAct.openMob:
        await openMobPage(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mob = ref.watch(currentMobProvider);
    if (mob == null) return const SizedBox.shrink();
    final entry = mobEntryFor(widget.place, mob, now: ref.watch(nowProvider)());
    if (entry == null) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    final hasKey = entry.key != null;
    final text = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Row(
        children: [
          Icon(LucideIcons.usersRound, size: 22, color: colors.ink2),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(entry.title, style: type.labelLarge.copyWith(color: colors.ink)),
                Text(entry.line, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
          if (hasKey) ...[
            const SizedBox(width: MmSpace.s12),
            PillKey(label: _opening ? MobCopy.openingPaper : entry.key!, onPressed: _opening ? null : () => _act(mob, entry)),
          ] else
            Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          // A line with a key is read as one sentence with its key; a line without one opens the
          // student's own answers or the Mob when pressed.
          child: hasKey
              ? text
              : MmPressable(
                  onTap: () => _act(mob, entry),
                  semanticsLabel: '${entry.title}. ${entry.line}',
                  pressedScale: 0.98,
                  focusRadius: MmRadius.keyAll,
                  haptic: MmPressHaptic.selection,
                  highlight: true,
                  builder: (context, pressed, _) => text,
                ),
        ),
        if (widget.divider) Divider(height: 1, color: colors.line),
      ],
    );
  }
}
