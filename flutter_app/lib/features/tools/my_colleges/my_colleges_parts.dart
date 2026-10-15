// The small pieces other screens embed: the Compass section, the key on a cutoff row, Today's
// "N more" line and the You field. Each reads the one list (myCollegesProvider) and says what
// happened when a change did not save.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/my_colleges.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/my_colleges_actions.dart';
import '../pro/compass_pro_repository.dart';
import '../widgets/tools_card.dart';
import '../widgets/tools_parts.dart';
import 'my_colleges_body.dart';
import 'my_colleges_copy.dart';
import 'my_colleges_sheet.dart';

/// Compass: the student's list, in order, with the keys to change it and to add a college. Absent
/// when nobody is signed in, and absent where the Pro projection is on the page, because its
/// shortlist is this same list with each college set against the projected range.
class MyCollegesSection extends ConsumerWidget {
  const MyCollegesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myCollegesProvider);
    if (view.status == MyCollegesStatus.signedOut) return const SizedBox.shrink();
    final proShowing = ref.watch(compassProAccessProvider) && (ref.watch(compassProRepositoryProvider.select((s) => s.value))?.locked == false);
    if (proShowing) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsHeading(
          MyCollegesCopy.title,
          note: view.ready ? MyCollegesCopy.count(view.list.count) : null,
          trailing: view.ready && !view.list.isEmpty
              ? ToolsInlineAction(label: MyCollegesCopy.change, icon: LucideIcons.pencilLine, onTap: () => showMyCollegesSheet(context))
              : null,
        ),
        ToolsCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const MyCollegesBody(),
              if (view.ready && !view.list.isFull) ...[
                const SizedBox(height: MmSpace.s16),
                KeyButton.secondary(label: MyCollegesCopy.add, onPressed: () => showMyCollegesSheet(context, adding: true)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// The key on a college row in a cutoff list: adds the college in this programme to My colleges, or
/// takes it off again. A change that did not save says so in a line at the bottom of the screen.
class AddToMyCollegesKey extends ConsumerWidget {
  const AddToMyCollegesKey({super.key, required this.programmeId, required this.programme, required this.college});

  final String programmeId;
  final String programme;
  final String college;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myCollegesProvider);
    if (view.status == MyCollegesStatus.signedOut) return const SizedBox.shrink();
    final colors = context.mmColors;
    final entry = MyCollege(programmeId: programmeId, programme: programme, college: college);
    final on = view.ready && view.list.contains(entry);
    final full = view.ready && !on && view.list.isFull;
    if (full) {
      return Text(MyCollegesCopy.listFull, style: context.mmType.caption.copyWith(color: colors.ink3));
    }
    final waiting = !view.ready || view.busy;
    final label = on ? MyCollegesCopy.inList : MyCollegesCopy.addToList;
    final ink = on ? colors.goodText : colors.accentText;
    return MmPressable(
      semanticsLabel: on ? MyCollegesCopy.remove(college) : MyCollegesCopy.addCollege(college),
      selected: on,
      onTap: waiting ? null : () => _tap(context, ref, entry, on),
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(on ? LucideIcons.check : LucideIcons.plus, size: 16, color: waiting ? colors.ink3 : ink),
            const SizedBox(width: MmSpace.s6),
            Text(label, style: context.mmType.labelLarge.copyWith(fontSize: 14, color: waiting ? colors.ink3 : ink)),
          ],
        ),
      ),
    );
  }

  Future<void> _tap(BuildContext context, WidgetRef ref, MyCollege entry, bool on) async {
    final actions = ref.read(myCollegesActionsProvider.notifier);
    final messenger = ScaffoldMessenger.maybeOf(context);
    final outcome = await (on ? actions.remove(entry) : actions.add(entry));
    if (outcome == MyCollegesOutcome.saved || outcome == MyCollegesOutcome.notLoaded) return;
    final line = ref.read(myCollegesProvider).notice;
    if (line.isEmpty) return;
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(line), behavior: SnackBarBehavior.floating));
  }
}

/// Today: under the first three, how many more are on the list. Nothing when there are none.
class MyCollegesMoreLine extends ConsumerWidget {
  const MyCollegesMoreLine({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myCollegesProvider);
    if (!view.ready || view.list.more == 0) return const SizedBox.shrink();
    return Align(
      alignment: Alignment.centerLeft,
      child: ToolsInlineAction(label: MyCollegesCopy.more(view.list.more), onTap: () => showMyCollegesSheet(context)),
    );
  }
}

/// True when the You sheet has colleges to show: the list when it is known, otherwise [fallback]
/// (the colleges named in the setup, shown until the list loads or when nobody is signed in).
bool myCollegesHaveAny(MyCollegesView view, List<String> fallback) => view.hasList ? !view.list.isEmpty : fallback.isNotEmpty;

/// The You field's colleges: every college of the list, in order, with its programme.
class MyCollegesFieldList extends ConsumerWidget {
  const MyCollegesFieldList({super.key, required this.fallback});

  /// Shown while the list is not known (loading, did not load, or signed out).
  final Widget fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(myCollegesProvider);
    if (!view.hasList) return fallback;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [for (final (i, c) in view.colleges.indexed) MyCollegeRow(key: ValueKey(c.key), college: c, index: i, count: view.colleges.length)],
    );
  }
}
