// The list itself: the rows of My colleges and every honest state around them (loading, did not
// load, offline copy, a change that did not save). Shared by the sheet, the Compass section and
// the You field, so the list reads the same wherever the student meets it.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/my_colleges.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/my_colleges_actions.dart';
import 'my_colleges_copy.dart';

/// The rank of a college, printed in a ring (1 is the dream pick).
class MyCollegeRank extends StatelessWidget {
  const MyCollegeRank(this.rank, {super.key});

  final int rank;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.lineStrong, width: 1.4)),
      alignment: Alignment.center,
      child: Text(
        '$rank',
        textScaler: TextScaler.noScaling,
        style: context.mmType.caption.copyWith(fontSize: 12, height: 1, fontWeight: FontWeight.w700, color: colors.ink2),
      ),
    );
  }
}

/// One college of the list: its place, its name and its programme. With [editable] it also has
/// the keys to move it up or down and to take it off.
class MyCollegeRow extends ConsumerWidget {
  const MyCollegeRow({super.key, required this.college, required this.index, required this.count, this.editable = false, this.busy = false});

  final MyCollege college;

  /// 0-based place on the list.
  final int index;
  final int count;
  final bool editable;

  /// A change is being saved: the keys wait for it.
  final bool busy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final actions = ref.read(myCollegesActionsProvider.notifier);
    final canUp = !busy && index > 0;
    final canDown = !busy && index < count - 1;
    Color ink(bool on) => on ? colors.ink2 : colors.ink3.withValues(alpha: 0.4);
    final text = Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(college.college, style: type.labelLarge.copyWith(color: colors.ink)),
          if (college.programme.isNotEmpty) Text(college.programme, style: type.caption.copyWith(color: colors.ink2)),
        ],
      ),
    );
    return Semantics(
      container: true,
      label: MyCollegesCopy.position(index + 1, college.college, college.programme),
      excludeSemantics: !editable,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          MyCollegeRank(index + 1),
          const SizedBox(width: MmSpace.s12),
          Expanded(child: text),
          if (editable) ...[
            IconButton(
              tooltip: MyCollegesCopy.moveUp(college.college),
              onPressed: canUp ? () => actions.move(index, index - 1) : null,
              icon: Icon(LucideIcons.arrowUp, size: 18, color: ink(canUp)),
            ),
            IconButton(
              tooltip: MyCollegesCopy.moveDown(college.college),
              onPressed: canDown ? () => actions.move(index, index + 1) : null,
              icon: Icon(LucideIcons.arrowDown, size: 18, color: ink(canDown)),
            ),
            IconButton(
              tooltip: MyCollegesCopy.remove(college.college),
              onPressed: busy ? null : () => actions.remove(college),
              icon: Icon(LucideIcons.trash2, size: 18, color: colors.ink2),
            ),
          ],
        ],
      ),
    );
  }
}

/// What is not a row: nobody signed in, the first read still running, a read that failed, or a list
/// that is the copy kept on this phone. Nothing when the server's list is showing. Nothing here
/// claims the list is empty unless the server said so.
class MyCollegesAvailability extends ConsumerWidget {
  const MyCollegesAvailability({super.key, this.signedOutNote = true});

  /// Say so when nobody is signed in (false leaves the space empty).
  final bool signedOutNote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    final actions = ref.read(myCollegesActionsProvider.notifier);
    switch (view.status) {
      case MyCollegesStatus.signedOut:
        return signedOutNote ? Text(MyCollegesCopy.signedOut, style: type.body.copyWith(color: colors.ink2)) : const SizedBox.shrink();
      case MyCollegesStatus.loading:
        return const SkeletonGroup(
          label: MyCollegesCopy.loading,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [Skeleton.line(width: 220), SizedBox(height: MmSpace.s16), Skeleton.line(width: 180), SizedBox(height: MmSpace.s16), Skeleton.line(width: 200)],
          ),
        );
      case MyCollegesStatus.failed:
        return InlineBanner(
          tone: view.offline ? BannerTone.offline : BannerTone.error,
          message: view.offline ? MyCollegesCopy.failedOffline : MyCollegesCopy.failed,
          actionLabel: MyCollegesCopy.tryAgain,
          onAction: () => actions.retry(),
        );
      case MyCollegesStatus.ready:
        if (!view.stale) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s12),
          child: InlineBanner(
            tone: view.offline ? BannerTone.offline : BannerTone.error,
            message: view.offline ? MyCollegesCopy.staleOffline : MyCollegesCopy.staleError,
            actionLabel: MyCollegesCopy.tryAgain,
            onAction: () => actions.retry(),
          ),
        );
    }
  }
}

/// The line about the last change that did not save (and nothing when every change saved).
class MyCollegesNotice extends ConsumerWidget {
  const MyCollegesNotice({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notice = ref.watch(myCollegesProvider.select((v) => v.notice));
    if (notice.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s8),
      child: Semantics(liveRegion: true, child: Text(notice, style: context.mmType.caption.copyWith(color: context.mmColors.warnText))),
    );
  }
}

/// The list and its states. [editable] adds the move and remove keys; [limit] shows only the
/// first rows (Today's three).
class MyCollegesBody extends ConsumerWidget {
  const MyCollegesBody({super.key, this.editable = false, this.limit, this.signedOutNote = true});

  final bool editable;
  final int? limit;
  final bool signedOutNote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final view = ref.watch(myCollegesProvider);
    final rows = limit == null ? view.colleges : view.colleges.take(limit!).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MyCollegesAvailability(signedOutNote: signedOutNote),
        if (view.ready)
          if (rows.isEmpty)
            Text(MyCollegesCopy.empty, style: context.mmType.body.copyWith(color: colors.ink2))
          else
            for (final (i, c) in rows.indexed) MyCollegeRow(key: ValueKey(c.key), college: c, index: i, count: view.colleges.length, editable: editable, busy: view.busy),
        const MyCollegesNotice(),
      ],
    );
  }
}
