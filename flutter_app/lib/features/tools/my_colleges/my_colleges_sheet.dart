// The sheet behind "Choose colleges", "Edit" and "Add a college": the list (reorder by dragging,
// remove with Undo, the On Today line after rank 3) and the chooser (a course, then its colleges
// as a ladder with their Round 1 figures). One sheet for Today, Colleges, Compass and You.
//
// Keyboard-safe (L24): the sheet pads itself by the keyboard and the chooser's height is
// min(92% of the screen, what is left above the keyboard), so the pinned search field and at
// least three results always sit above the keys; the list resizes with the keyboard frame by frame.
// It opens on its first frame (L25), whatever the list's state, and never pushes a tab.

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/my_colleges.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart' as ob show DuCatalog, onboardingAnswersProvider;
import '../colleges/college_rung.dart' show RungRank;
import '../colleges/colleges_copy.dart';
import '../copy.dart' show categoryLabel;
import '../data/du_repository.dart';
import '../data/my_colleges_actions.dart';
import '../domain/du_models.dart';
import '../domain/du_eligibility.dart' show duEffectiveCutoff;
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
import '../widgets/tools_page.dart';
import 'college_search.dart';
import 'my_colleges_body.dart';
import 'my_colleges_copy.dart';

/// Where the sheet opens: the list when it has colleges, the chooser otherwise ([auto]).
enum MyCollegesEntry { auto, list, chooser }

/// Opens My colleges. [adding] (or [entry] chooser) goes straight to the chooser; with
/// [programmeId] the chooser opens on that course's ladder.
Future<void> showMyCollegesSheet(
  BuildContext context, {
  bool adding = false,
  MyCollegesEntry entry = MyCollegesEntry.auto,
  String? programmeId,
}) {
  final colors = context.mmColors;
  final reduced = Motion.reduced(context);
  final start = adding || programmeId != null ? MyCollegesEntry.chooser : entry;
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: colors.sheetScrim,
    elevation: 0,
    clipBehavior: Clip.none,
    constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
    shape: const RoundedRectangleBorder(),
    sheetAnimationStyle: AnimationStyle(
      duration: reduced ? Motion.reducedFade : Motion.sheetIn,
      reverseDuration: reduced ? Motion.reducedFade : Motion.sheetOut,
      curve: reduced ? Curves.linear : Motion.emphasized,
      reverseCurve: reduced ? Curves.linear : Motion.drawer,
    ),
    builder: (context) => MyCollegesSheet(entry: start, programmeId: programmeId),
  );
}

class MyCollegesSheet extends ConsumerStatefulWidget {
  const MyCollegesSheet({super.key, this.entry = MyCollegesEntry.auto, this.programmeId});

  final MyCollegesEntry entry;
  final String? programmeId;

  @override
  ConsumerState<MyCollegesSheet> createState() => _MyCollegesSheetState();
}

class _MyCollegesSheetState extends ConsumerState<MyCollegesSheet> {
  late bool _chooser;

  /// The chooser was reached from the list (its Back returns there).
  bool _fromList = false;

  /// The course whose ladder is open, or null for the programme list.
  String? _course;

  /// Opened as the chooser before the list had loaded: once it lands, the chooser moves to the
  /// student's own course (their first college's), unless they have already typed or chosen.
  bool _awaitCourse = false;
  final _search = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  String _query = '';
  bool _showAll = false;
  String _line = '';
  final Map<String, ValueNotifier<int>> _shakes = {};

  // Undo after a remove in the list.
  MyColleges? _undo;
  String _undoName = '';
  Timer? _undoTimer;

  @override
  void initState() {
    super.initState();
    final view = ref.read(myCollegesProvider);
    _chooser = switch (widget.entry) {
      MyCollegesEntry.chooser => true,
      MyCollegesEntry.list => false,
      MyCollegesEntry.auto => !(view.ready && !view.list.isEmpty),
    };
    if (_chooser) {
      _course = widget.programmeId ?? _knownCourse(view);
      _awaitCourse = _course == null && !view.ready;
      if (_course == null) _focusSoon();
    }
  }

  String? _knownCourse(MyCollegesView view) {
    if (view.ready && view.colleges.isNotEmpty) return view.colleges.first.programmeId;
    return ref.read(ob.onboardingAnswersProvider).value?.courseId;
  }

  void _focusSoon() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focus.requestFocus();
      });

  @override
  void dispose() {
    _search.dispose();
    _focus.dispose();
    _scroll.dispose();
    _undoTimer?.cancel();
    for (final n in _shakes.values) {
      n.dispose();
    }
    super.dispose();
  }

  void _setQuery(String v) {
    _awaitCourse = false;
    setState(() => _query = v);
    // Each new query starts at the top, without animation, so typing never lags.
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  void _openCourse(String? id, {bool keepQuery = false}) {
    _awaitCourse = false;
    setState(() {
      _course = id;
      if (!keepQuery) {
        _query = '';
        _search.clear();
      }
      _showAll = false;
      _line = '';
    });
    if (id == null) _focusSoon();
    if (id != null && !keepQuery) _focus.unfocus();
  }

  void _toChooser() => setState(() {
        _chooser = true;
        _fromList = true;
        _course = _knownCourse(ref.read(myCollegesProvider));
        if (_course == null) _focusSoon();
      });

  void _back() {
    if (_course != null) return _openCourse(null);
    setState(() {
      _chooser = false;
      _query = '';
      _search.clear();
      _line = '';
    });
    _focus.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<MyCollegesView>(myCollegesProvider, (_, next) {
      if (!_awaitCourse || !next.ready) return;
      _awaitCourse = false;
      if (!_chooser || _course != null || _query.isNotEmpty || next.colleges.isEmpty) return;
      setState(() => _course = next.colleges.first.programmeId);
      _focus.unfocus();
    });
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: LayoutBuilder(
        builder: (context, c) {
          final screen = MediaQuery.sizeOf(context).height;
          final room = math.max(200.0, c.maxHeight - 8);
          final body = _chooser ? _chooserBody(context) : _listBody(context);
          final Widget sized = _chooser || large
              ? SizedBox(height: large ? c.maxHeight : math.min(screen * 0.92, room), child: body)
              : ConstrainedBox(constraints: BoxConstraints(maxHeight: math.min(680, room)), child: body);
          return MmSheetGlass(child: SafeArea(top: false, bottom: inset == 0, child: sized));
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Shared header.

  Widget _titleRow(BuildContext context, String title, {bool back = false}) {
    final colors = context.mmColors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: Padding(padding: EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s4), child: MmSheetHandle())),
        SizedBox(
          height: 48,
          child: Row(
            children: [
              if (back)
                IconButton(
                  tooltip: CollegesCopy.back,
                  onPressed: _back,
                  icon: Icon(LucideIcons.chevronLeft, size: 22, color: colors.ink),
                )
              else
                const SizedBox(width: MmSpace.s20),
              Expanded(child: Semantics(header: true, child: Text(title, style: context.mmType.screenTitle.copyWith(fontSize: 22), maxLines: 1, overflow: TextOverflow.ellipsis))),
              KeyButton.quiet(label: CollegesCopy.done, onPressed: () => Navigator.of(context).maybePop()),
              const SizedBox(width: MmSpace.s8),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------------------------
  // List mode.

  Widget _listBody(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    final actions = ref.read(myCollegesActionsProvider.notifier);
    final rows = view.colleges;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _titleRow(context, MyCollegesCopy.sheetTitle),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s8),
          child: view.ready ? Text(CollegesCopy.caption(view.list.count), style: type.caption.copyWith(color: colors.ink2)) : const SizedBox.shrink(),
        ),
        Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20), child: const MyCollegesAvailability()),
        if (view.ready && rows.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s12),
            child: Text(MyCollegesCopy.empty, style: type.body.copyWith(color: colors.ink2)),
          ),
        if (view.ready && rows.isNotEmpty)
          Flexible(
            child: ReorderableListView.builder(
              shrinkWrap: true,
              buildDefaultDragHandles: false,
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
              itemCount: rows.length,
              proxyDecorator: (child, _, anim) => AnimatedBuilder(
                animation: anim,
                builder: (context, _) => Transform.scale(
                  scale: 1 + 0.02 * Motion.out.transform(anim.value),
                  child: Material(color: colors.raised, elevation: 6 * anim.value, borderRadius: BorderRadius.circular(MmSpace.s12), child: child),
                ),
              ),
              onReorderItem: (from, to) {
                if (view.busy) return;
                unawaited(hapticsOf(context)?.light());
                unawaited(actions.move(from, to));
              },
              itemBuilder: (context, i) => _ListRow(
                key: ValueKey(rows[i].key),
                college: rows[i],
                index: i,
                count: rows.length,
                busy: view.busy,
                onRemove: () => _remove(view, rows[i]),
                onMove: (to) => unawaited(actions.move(i, to)),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const MyCollegesNotice(),
              if (_undo != null)
                Semantics(
                  liveRegion: true,
                  child: Row(
                    children: [
                      Expanded(child: Text(CollegesCopy.removed(_undoName), style: type.caption.copyWith(color: colors.ink2))),
                      KeyButton.quiet(label: CollegesCopy.undo, onPressed: _doUndo),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (view.ready)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s12, MmSpace.s20, MmSpace.s20),
            child: view.list.isFull
                ? Text(MyCollegesCopy.fullLine, style: type.caption.copyWith(color: colors.ink2))
                : KeyButton(label: MyCollegesCopy.add, onPressed: view.busy ? null : _toChooser),
          )
        else
          const SizedBox(height: MmSpace.s20),
      ],
    );
  }

  Future<void> _remove(MyCollegesView view, MyCollege c) async {
    final before = view.list;
    final outcome = await ref.read(myCollegesActionsProvider.notifier).remove(c);
    if (!mounted || outcome != MyCollegesOutcome.saved) return;
    _undoTimer?.cancel();
    setState(() {
      _undo = before;
      _undoName = c.college;
    });
    _undoTimer = Timer(const Duration(seconds: 6), () {
      if (mounted) setState(() => _undo = null);
    });
  }

  void _doUndo() {
    final prev = _undo;
    if (prev == null) return;
    _undoTimer?.cancel();
    setState(() => _undo = null);
    unawaited(ref.read(myCollegesActionsProvider.notifier).replace(prev));
  }

  // ---------------------------------------------------------------------------------------------
  // Chooser.

  Widget _chooserBody(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(myCollegesProvider);
    final catalog = ref.watch(duCatalogProvider);
    final group = _course == null ? null : catalog.value?.group(_course!);
    final category = ref.watch(estimateCategoryProvider);
    final picked = view.ready ? view.colleges.length : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _titleRow(context, CollegesCopy.addTitle, back: _fromList || _course != null),
        // Pinned: the course, the field and the count stay put; only the results scroll.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_course != null) ...[
                Row(
                  children: [
                    Flexible(
                      child: MmChip(
                        label: CollegesCopy.courseChip(group?.name ?? ob.DuCatalog.course(_course)?.name ?? ''),
                        selected: true,
                        onTap: () => _openCourse(null),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    Text(categoryLabel(category), style: type.caption.copyWith(color: colors.ink2)),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
              ],
              SizedBox(
                height: 52,
                child: ToolsSearchField(
                  controller: _search,
                  focusNode: _focus,
                  hint: _course == null ? CollegesCopy.findProgramme : CollegesCopy.findCollege,
                  onChanged: _setQuery,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    _line.isNotEmpty ? _line : (view.notice.isNotEmpty ? view.notice : CollegesCopy.picked(picked)),
                    style: type.caption.copyWith(color: _line.isNotEmpty || view.notice.isNotEmpty ? colors.warnText : colors.ink2),
                  ),
                ),
              ),
              if (view.status == MyCollegesStatus.signedOut)
                Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s8),
                  child: Text(MyCollegesCopy.signedOut, style: type.caption.copyWith(color: colors.ink2)),
                ),
            ],
          ),
        ),
        Expanded(
          child: MmOverlapSwitcher.axis(
            duration: Motion.glideDuration,
            alignment: Alignment.topLeft,
            fit: StackFit.expand,
            child: KeyedSubtree(
              key: ValueKey(_course ?? '_programmes'),
              child: switch (catalog) {
                AsyncData(:final value) => _course == null ? _programmeList(context, value, category) : _ladder(context, value, _course!, category, view),
                AsyncError(:final error) => _failed(error, MyCollegesCopy.programmesOffline, MyCollegesCopy.programmesFailed, () => ref.invalidate(duCatalogProvider)),
                _ => _skeleton(MyCollegesCopy.loadingProgrammes),
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _failed(Object error, String offline, String failed, VoidCallback retry) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20),
        child: Align(
          alignment: Alignment.topCenter,
          child: InlineBanner(
            tone: error is DuLoadError && error.offline ? BannerTone.offline : BannerTone.error,
            message: error is DuLoadError && error.offline ? offline : failed,
            actionLabel: MyCollegesCopy.tryAgain,
            onAction: retry,
          ),
        ),
      );

  Widget _skeleton(String label) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20),
        child: SkeletonGroup(
          label: label,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < 5; i++) ...[const Skeleton.line(width: 220), const SizedBox(height: MmSpace.s8), const Skeleton.line(width: 140), const SizedBox(height: MmSpace.s24)],
            ],
          ),
        ),
      );

  /// No query: the student's course first, then the six Commerce programmes, then A to Z.
  List<DuGroup> _ordered(DuCatalog catalog) {
    final first = <String>[
      ?_knownCourse(ref.read(myCollegesProvider)),
      for (final c in ob.DuCatalog.courses) c.id,
    ];
    final seen = <String>{};
    final lead = <DuGroup>[
      for (final id in first)
        if (seen.add(id))
          if (catalog.group(id) case final DuGroup g) g,
    ];
    final rest = [for (final g in catalog.groups) if (!seen.contains(g.id)) g]..sort((a, b) {
        if (a.hasCutoffs != b.hasCutoffs) return a.hasCutoffs ? -1 : 1;
        return a.name.compareTo(b.name);
      });
    return [...lead, ...rest];
  }

  Widget _programmeList(BuildContext context, DuCatalog catalog, String category) {
    final colors = context.mmColors;
    final type = context.mmType;
    final all = _ordered(catalog);
    final shown = duSearch(
      _query,
      all,
      (g) => g.name,
      extra: (g) => [g.id.replaceAll('-', ' '), g.family],
      weight: (g) => g.hasCutoffs ? g.colleges : -1,
    );
    if (shown.isEmpty) {
      // A college's name typed where a course goes: search the colleges of the student's course.
      final own = _knownCourse(ref.read(myCollegesProvider));
      final ownGroup = own == null ? null : catalog.group(own);
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(CollegesCopy.nothingMatches(_query.trim()), style: type.body.copyWith(color: colors.ink3)),
            if (ownGroup != null && ownGroup.hasCutoffs)
              Transform.translate(
                offset: const Offset(-MmSpace.s12, 0),
                child: KeyButton.quiet(label: CollegesCopy.searchCollegesIn(ownGroup.name), onPressed: () => _openCourse(ownGroup.id, keepQuery: true)),
              ),
          ],
        ),
      );
    }
    return ListView.builder(
      controller: _scroll,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
      padding: const EdgeInsets.fromLTRB(MmSpace.s8, 0, MmSpace.s8, MmSpace.s16),
      itemCount: shown.length + (_query.trim().isEmpty ? 0 : 1),
      itemBuilder: (context, i) {
        if (_query.trim().isNotEmpty && i == 0) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s12, 0, MmSpace.s12, MmSpace.s4),
            child: Text(CollegesCopy.programmeCount(shown.length), style: type.caption.copyWith(color: colors.ink3)),
          );
        }
        final g = shown[_query.trim().isEmpty ? i : i - 1];
        final r1 = g.roundOne(category);
        final note = g.hasCutoffs
            ? CollegesCopy.programmeNote(g.colleges, r1?.low == null ? null : estimateFigure(r1!.low!), r1?.high == null ? null : estimateFigure(r1!.high!))
            : CollegesCopy.noList;
        return ToolsRowFrame(
          key: ValueKey('programme-${g.id}'),
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
          semanticsLabel: '${g.name}. $note',
          onTap: g.hasCutoffs ? () => _openCourse(g.id) : null,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(g.name, style: type.labelLarge.copyWith(color: g.hasCutoffs ? colors.ink : colors.ink2)),
                    const SizedBox(height: 2),
                    Text(note, style: type.caption.copyWith(color: g.hasCutoffs ? colors.ink2 : colors.ink3)),
                  ],
                ),
              ),
              if (g.hasCutoffs) Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
            ],
          ),
        );
      },
    );
  }

  Widget _ladder(BuildContext context, DuCatalog catalog, String courseId, String category, MyCollegesView view) {
    final async = ref.watch(duOfferingsProvider(courseId));
    final group = catalog.group(courseId);
    return switch (async) {
      AsyncData(:final value) => _ladderList(context, catalog, group, value, category, view),
      AsyncError(:final error) => _failed(error, MyCollegesCopy.collegesOffline, MyCollegesCopy.collegesFailed, () => ref.invalidate(duOfferingsProvider(courseId))),
      _ => _skeleton(MyCollegesCopy.loadingColleges),
    };
  }

  Widget _ladderList(BuildContext context, DuCatalog catalog, DuGroup? group, DuOfferings offerings, String category, MyCollegesView view) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ci = catalog.categoryIndex(category);
    double? fig(DuSeat s) {
      final r1 = s.rounds.isEmpty ? null : s.rounds.first;
      return duEffectiveCutoff(r1, ci);
    }

    final byName = <String, double?>{};
    for (final s in offerings.seats) {
      byName.putIfAbsent(s.college, () => fig(s));
    }
    final names = byName.keys.toList()
      ..sort((a, b) {
        final fa = byName[a], fb = byName[b];
        if (fa == null && fb == null) return a.compareTo(b);
        if (fa == null) return 1;
        if (fb == null) return -1;
        final c = fb.compareTo(fa);
        return c != 0 ? c : a.compareTo(b);
      });
    final programmeId = group?.id ?? offerings.id;
    final programme = group?.name ?? '';
    MyCollege entry(String n) => MyCollege(programmeId: programmeId, programme: programme, college: n);
    bool isPicked(String n) => view.ready && view.list.contains(entry(n));
    final q = _query.trim();
    final List<String> visible;
    var hidden = 0;
    if (q.isNotEmpty) {
      final hits = duSearch(q, names, (n) => n).toSet();
      // Picked rows always show, so a filter never hides what is on the list.
      visible = [for (final n in names) if (hits.contains(n) || isPicked(n)) n];
    } else if (_showAll) {
      visible = names;
    } else {
      final firstSeven = names.take(7).toSet();
      visible = [for (final n in names) if (firstSeven.contains(n) || isPicked(n)) n];
      hidden = names.length - visible.length;
    }
    final withFigure = [for (final n in visible) if (byName[n] != null) n];
    final without = [for (final n in visible) if (byName[n] == null) n];
    final estimate = ref.watch(estimateProvider);
    final items = <Widget>[
      for (final n in withFigure) _ladderRow(context, entry(n), byName[n], view, estimate),
      if (hidden > 0)
        ToolsRowFrame(
          key: const ValueKey('show-all'),
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s12),
          semanticsLabel: CollegesCopy.showAll(names.length),
          onTap: () => setState(() => _showAll = true),
          child: Row(children: [
            Expanded(child: Text(CollegesCopy.showAll(names.length), style: type.labelLarge.copyWith(color: colors.accentText))),
            Icon(LucideIcons.chevronDown, size: 18, color: colors.accentText),
          ]),
        ),
      if (without.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s16, MmSpace.s12, MmSpace.s4),
          child: Text(CollegesCopy.noRoundOneFor(category), style: type.caption.copyWith(color: colors.ink3)),
        ),
        for (final n in without) _ladderRow(context, entry(n), null, view, estimate),
      ],
      if (visible.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
          child: Text(CollegesCopy.nothingMatches(q), style: type.body.copyWith(color: colors.ink3)),
        ),
    ];
    return ListView.builder(
      controller: _scroll,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
      padding: const EdgeInsets.fromLTRB(MmSpace.s8, 0, MmSpace.s8, MmSpace.s16),
      itemCount: items.length,
      itemBuilder: (context, i) => items[i],
    );
  }

  Widget _ladderRow(BuildContext context, MyCollege e, double? figure, MyCollegesView view, Estimate? estimate) {
    final colors = context.mmColors;
    final type = context.mmType;
    final index = view.ready ? view.colleges.indexWhere(e.sameAs) : -1;
    final on = index >= 0;
    final n = on ? index + 1 : null;
    final pulse = _shakes.putIfAbsent(e.key, () => ValueNotifier<int>(0));
    final figText = figure == null ? '' : estimateFigure(figure);
    final verdict = estimate != null && figure != null ? verdictFor(estimate, figure) : null;
    final canTap = view.ready && !view.busy;
    return MmShake(
      key: ValueKey('ladder-${e.key}'),
      pulse: pulse,
      child: ToolsRowFrame(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s8),
        semanticsLabel: CollegesCopy.pickLabel(e.college, figText.isEmpty ? CollegesCopy.noSeat : '$figText of 1000', on, n),
        toggled: on,
        onTap: canTap ? () => _toggle(e, on, view, pulse) : null,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 40),
          child: Row(
            children: [
              _PickBubble(n: n),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(e.college, style: type.labelLarge.copyWith(color: on ? colors.ink : colors.ink2)),
                    if (n != null && n <= 3) Text(CollegesCopy.onToday, style: type.caption.copyWith(color: colors.accentText)),
                    if (verdict != null) Text(verdictWords(verdict), style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ),
              ),
              if (figText.isNotEmpty) ...[
                const SizedBox(width: MmSpace.s12),
                Text(figText, style: type.figureCompact.copyWith(fontSize: 17, color: on ? colors.ink : colors.ink2, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _toggle(MyCollege e, bool on, MyCollegesView view, ValueNotifier<int> pulse) async {
    final actions = ref.read(myCollegesActionsProvider.notifier);
    if (!on && view.list.isFull) {
      pulse.value++;
      setState(() => _line = CollegesCopy.full);
      return;
    }
    if (_line.isNotEmpty) setState(() => _line = '');
    unawaited(hapticsOf(context)?.selection());
    await (on ? actions.remove(e) : actions.add(e));
  }
}

/// The ladder's rail bubble: an empty ring, or volt with the pick number (it grows in on a spring).
class _PickBubble extends StatelessWidget {
  const _PickBubble({required this.n});

  final int? n;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final on = n != null;
    return AnimatedContainer(
      duration: Motion.of(context, Motion.card),
      curve: Motion.out,
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: on ? colors.volt : Colors.transparent,
        border: on ? null : Border.all(color: colors.lineStrong, width: 1.4),
      ),
      alignment: Alignment.center,
      child: MmOverlapSwitcher.rise(
        duration: Motion.card,
        alignment: Alignment.center,
        child: on
            ? Text('$n', key: ValueKey(n), textScaler: TextScaler.noScaling, style: context.mmType.caption.copyWith(fontSize: 13, height: 1, fontWeight: FontWeight.w700, color: colors.voltInk))
            : Icon(LucideIcons.plus, key: const ValueKey('plus'), size: 14, color: colors.ink3),
      ),
    );
  }
}

/// A row of the list in the sheet: rank, name and programme, remove, and a drag handle. Long press
/// anywhere lifts it too; screen readers get Move up, Move down and Remove as actions.
class _ListRow extends StatelessWidget {
  const _ListRow({super.key, required this.college, required this.index, required this.count, required this.busy, required this.onRemove, required this.onMove});

  final MyCollege college;
  final int index;
  final int count;
  final bool busy;
  final VoidCallback onRemove;
  final ValueChanged<int> onMove;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final row = Row(
      children: [
        const SizedBox(width: MmSpace.s8),
        RungRank(index + 1),
        const SizedBox(width: MmSpace.s12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(college.college, style: type.labelLarge.copyWith(color: colors.ink)),
                if (college.programme.isNotEmpty) Text(college.programme, style: type.caption.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ),
        IconButton(
          tooltip: MyCollegesCopy.remove(college.college),
          onPressed: busy ? null : onRemove,
          icon: Icon(LucideIcons.x, size: 18, color: colors.ink2),
        ),
        ReorderableDragStartListener(
          index: index,
          enabled: !busy,
          child: SizedBox(width: 48, height: 48, child: Icon(LucideIcons.gripVertical, size: 18, color: colors.ink3)),
        ),
      ],
    );
    return Semantics(
      container: true,
      label: MyCollegesCopy.position(index + 1, college.college, college.programme),
      customSemanticsActions: {
        if (index > 0) CustomSemanticsAction(label: MyCollegesCopy.moveUp(college.college)): () => onMove(index - 1),
        if (index < count - 1) CustomSemanticsAction(label: MyCollegesCopy.moveDown(college.college)): () => onMove(index + 1),
      },
      child: ReorderableDelayedDragStartListener(
        index: index,
        enabled: !busy,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ConstrainedBox(constraints: const BoxConstraints(minHeight: 56), child: row),
            // What Today shows ends after the third.
            if (index == 2 && count > 3)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s4),
                child: Row(children: [
                  Expanded(child: Divider(color: colors.line, height: 1)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
                    child: Text(CollegesCopy.onTodayLine, style: type.caption.copyWith(color: colors.ink3)),
                  ),
                  Expanded(child: Divider(color: colors.line, height: 1)),
                ]),
              ),
          ],
        ),
      ),
    );
  }
}
