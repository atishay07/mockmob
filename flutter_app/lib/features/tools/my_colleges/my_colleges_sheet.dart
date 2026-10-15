// The sheet behind "Choose colleges" and "Change": the whole list with its keys to move and
// remove, and the chooser that adds to it (a programme, then a college). One sheet for Today,
// Compass and You, so the list is edited in one place.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/my_colleges.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/du_repository.dart';
import '../data/my_colleges_actions.dart';
import '../domain/du_models.dart';
import '../widgets/tools_page.dart';
import 'my_colleges_body.dart';
import 'my_colleges_copy.dart';

/// Opens My colleges as a sheet: the list, or (with [adding]) straight to the chooser.
Future<void> showMyCollegesSheet(BuildContext context, {bool adding = false}) => showMmSheet<void>(
      context: context,
      title: MyCollegesCopy.sheetTitle,
      builder: (_) => MyCollegesSheetBody(adding: adding),
    );

class MyCollegesSheetBody extends ConsumerStatefulWidget {
  const MyCollegesSheetBody({super.key, this.adding = false});

  final bool adding;

  @override
  ConsumerState<MyCollegesSheetBody> createState() => _MyCollegesSheetBodyState();
}

class _MyCollegesSheetBodyState extends ConsumerState<MyCollegesSheetBody> {
  late bool _adding = widget.adding;

  @override
  Widget build(BuildContext context) {
    if (_adding) return MyCollegesChooser(onBack: () => setState(() => _adding = false));
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (view.ready) ...[
          Text(MyCollegesCopy.count(view.list.count), style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
        ],
        Text(MyCollegesCopy.lede, style: type.caption.copyWith(color: colors.ink2)),
        const SizedBox(height: MmSpace.s12),
        const MyCollegesBody(editable: true),
        if (view.ready) ...[
          const SizedBox(height: MmSpace.s16),
          if (view.list.isFull)
            Text(MyCollegesCopy.fullLine, style: type.caption.copyWith(color: colors.ink2))
          else
            KeyButton.secondary(label: MyCollegesCopy.add, onPressed: () => setState(() => _adding = true)),
        ],
      ],
    );
  }
}

/// A programme, then one of its colleges. A college already on the list shows its tick and cannot be
/// added twice; a full list says so.
class MyCollegesChooser extends ConsumerStatefulWidget {
  const MyCollegesChooser({super.key, required this.onBack});

  final VoidCallback onBack;

  @override
  ConsumerState<MyCollegesChooser> createState() => _MyCollegesChooserState();
}

class _MyCollegesChooserState extends ConsumerState<MyCollegesChooser> {
  DuGroup? _group;
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _pick(DuGroup? g) => setState(() {
        _group = g;
        _query = '';
        _search.clear();
      });

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    final group = _group;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: KeyButton.quiet(
            label: group == null ? MyCollegesCopy.back : MyCollegesCopy.backToProgrammes,
            onPressed: group == null ? widget.onBack : () => _pick(null),
          ),
        ),
        if (group != null) Text(group.name, style: type.title),
        Text(group == null ? MyCollegesCopy.chooseProgramme : MyCollegesCopy.chooseCollege, style: type.caption.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s8),
        if (view.ready && view.list.isFull) ...[
          Text(MyCollegesCopy.fullLine, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
        ],
        if (group == null) _programmes(context) else _colleges(context, group, view),
        if (view.notice.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(liveRegion: true, child: Text(view.notice, style: type.caption.copyWith(color: colors.warnText))),
        ],
      ],
    );
  }

  Widget _programmes(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final async = ref.watch(duCatalogProvider);
    return switch (async) {
      AsyncData(:final value) => _programmeList(context, value),
      AsyncError(:final error) => InlineBanner(
          tone: error is DuLoadError && error.offline ? BannerTone.offline : BannerTone.error,
          message: error is DuLoadError && error.offline ? MyCollegesCopy.programmesOffline : MyCollegesCopy.programmesFailed,
          actionLabel: MyCollegesCopy.tryAgain,
          onAction: () => ref.invalidate(duCatalogProvider),
        ),
      _ => SkeletonGroup(
          label: MyCollegesCopy.loadingProgrammes,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Skeleton.line(width: 220),
            const SizedBox(height: MmSpace.s16),
            const Skeleton.line(width: 180),
            const SizedBox(height: MmSpace.s8),
            Text(MyCollegesCopy.loadingProgrammes, style: type.caption.copyWith(color: colors.ink3)),
          ]),
        ),
    };
  }

  Widget _programmeList(BuildContext context, DuCatalog catalog) {
    final q = _query.trim().toLowerCase();
    final all = [for (final g in catalog.groups) if (g.hasCutoffs) g]..sort((a, b) => a.name.compareTo(b.name));
    final shown = [for (final g in all) if (q.isEmpty || g.name.toLowerCase().contains(q)) g];
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsSearchField(controller: _search, hint: MyCollegesCopy.searchProgrammes, onChanged: (v) => setState(() => _query = v)),
        const SizedBox(height: MmSpace.s4),
        for (final g in shown)
          ToolsRowFrame(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            semanticsLabel: g.name,
            onTap: () => _pick(g),
            child: Row(children: [
              Expanded(child: Text(g.name, style: type.labelLarge)),
              Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3),
            ]),
          ),
        if (shown.isEmpty) Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: Text(MyCollegesCopy.nothingMatches, style: type.caption.copyWith(color: colors.ink3))),
      ],
    );
  }

  Widget _colleges(BuildContext context, DuGroup group, MyCollegesView view) {
    final async = ref.watch(duOfferingsProvider(group.id));
    return switch (async) {
      AsyncData(:final value) => _collegeList(context, group, value, view),
      AsyncError(:final error) => InlineBanner(
          tone: error is DuLoadError && error.offline ? BannerTone.offline : BannerTone.error,
          message: error is DuLoadError && error.offline ? MyCollegesCopy.collegesOffline : MyCollegesCopy.collegesFailed,
          actionLabel: MyCollegesCopy.tryAgain,
          onAction: () => ref.invalidate(duOfferingsProvider(group.id)),
        ),
      _ => const SkeletonGroup(
          label: MyCollegesCopy.loadingColleges,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton.line(width: 220), SizedBox(height: MmSpace.s16), Skeleton.line(width: 180)]),
        ),
    };
  }

  Widget _collegeList(BuildContext context, DuGroup group, DuOfferings offerings, MyCollegesView view) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = _query.trim().toLowerCase();
    final names = {for (final s in offerings.seats) s.college}.toList()..sort();
    final shown = [for (final n in names) if (q.isEmpty || n.toLowerCase().contains(q)) n];
    final actions = ref.read(myCollegesActionsProvider.notifier);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (names.length > 6) ...[
          ToolsSearchField(controller: _search, hint: MyCollegesCopy.searchColleges, onChanged: (v) => setState(() => _query = v)),
          const SizedBox(height: MmSpace.s4),
        ],
        for (final name in shown) _collegeRow(context, group, name, view, actions, colors, type),
        if (shown.isEmpty) Padding(padding: const EdgeInsets.only(top: MmSpace.s12), child: Text(MyCollegesCopy.nothingMatches, style: type.caption.copyWith(color: colors.ink3))),
      ],
    );
  }

  Widget _collegeRow(BuildContext context, DuGroup group, String name, MyCollegesView view, MyCollegesActions actions, MmColors colors, MmType type) {
    final entry = MyCollege(programmeId: group.id, programme: group.name, college: name);
    final on = view.list.contains(entry);
    final blocked = !view.ready || view.busy || (!on && view.list.isFull);
    return ToolsRowFrame(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      semanticsLabel: on ? '$name. ${MyCollegesCopy.alreadyAdded}' : MyCollegesCopy.addCollege(name),
      onTap: on || blocked ? null : () => actions.add(entry),
      child: Row(
        children: [
          Expanded(child: Text(name, style: type.labelLarge.copyWith(color: on ? colors.ink2 : colors.ink))),
          Icon(on ? LucideIcons.check : LucideIcons.plus, size: 16, color: on ? colors.goodText : colors.ink3),
        ],
      ),
    );
  }
}
