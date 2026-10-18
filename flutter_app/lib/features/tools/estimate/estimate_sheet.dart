// Your estimate, and Check a score (L26). One sheet, two modes:
//
// - estimate: opened from "Change" or "Type an estimate" on any estimate bar, from Your plan and
//   from Today's range card. The student picks where their estimate comes from (their latest full
//   mocks, the practice projection, a range they type, or "I don't know my range yet") and sees,
//   live, how many of their course's colleges it makes safe and how many it puts in reach. Done saves.
// - check (`/colleges/cutoff`, the website's /cuet-cutoff-calculator): a typed score or range
//   against one course's 2026 Round 1 cutoffs. Nothing is kept unless they tap "Use as my estimate".
//
// It never asks first for a score the student does not have: it opens with no keyboard, the
// category and the result come first, and the fields focus only on a tap. The sheet pads itself by
// the keyboard, so the keys stay pinned above it. No Mobi: the ring is the moment.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart' as ob show onboardingAnswersProvider;
import '../colleges/college_rung.dart';
import '../colleges/colleges_copy.dart';
import '../compass/compass_controller.dart';
import '../copy.dart' show categoryLabel;
import '../data/du_repository.dart';
import '../data/my_colleges_actions.dart';
import '../domain/du_eligibility.dart' show duEffectiveCutoff, duMainCategories;
import '../domain/du_models.dart';
import '../tools_paths.dart';
import '../widgets/size_reveal.dart';
import '../widgets/tools_parts.dart' show ToolsRing;
import 'estimate.dart';
import 'estimate_copy.dart';
import 'estimate_providers.dart';
import 'mock_estimate.dart' show RangeProgress;
import 'range_choice.dart';
import 'range_steps_bar.dart';

enum EstimateMode { estimate, check }

/// Opens the sheet over the current screen. [initialScore] ("612", "600-650" or "600 to 650") and
/// [initialCategory] prefill check mode (a web link's `?score=`). [typeOwn] opens on "Type your own"
/// (Today's "I know my range").
Future<void> showEstimateSheet(
  BuildContext context, {
  EstimateMode mode = EstimateMode.estimate,
  String? initialScore,
  String? initialCategory,
  bool typeOwn = false,
}) {
  final colors = context.mmColors;
  final reduced = Motion.reduced(context);
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
    builder: (context) => EstimateSheet(mode: mode, initialScore: initialScore, initialCategory: initialCategory, typeOwn: typeOwn),
  );
}

/// Check a score, the sheet the Colleges tab's row and `/colleges/cutoff` open.
Future<void> showCheckScoreSheet(BuildContext context, {String? initialScore, String? initialCategory}) =>
    showEstimateSheet(context, mode: EstimateMode.check, initialScore: initialScore, initialCategory: initialCategory);

/// `/colleges/cutoff` as a go_router page: the same sheet, presented over the shell.
class CheckScorePage extends Page<void> {
  const CheckScorePage({super.key, this.initialScore, this.initialCategory});

  final String? initialScore;
  final String? initialCategory;

  @override
  Route<void> createRoute(BuildContext context) {
    final colors = context.mmColors;
    return ModalBottomSheetRoute<void>(
      settings: this,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      modalBarrierColor: colors.sheetScrim,
      elevation: 0,
      clipBehavior: Clip.none,
      constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
      shape: const RoundedRectangleBorder(),
      builder: (context) => EstimateSheet(mode: EstimateMode.check, initialScore: initialScore, initialCategory: initialCategory),
    );
  }
}

enum _Source { mocks, projection, typed, unknown }

class EstimateSheet extends ConsumerStatefulWidget {
  const EstimateSheet({super.key, this.mode = EstimateMode.estimate, this.initialScore, this.initialCategory, this.embedded = false, this.typeOwn = false});

  final EstimateMode mode;
  final String? initialScore;
  final String? initialCategory;

  /// Opens on "Type your own".
  final bool typeOwn;

  /// Inside a host sheet that brings its own glass, handle and scroll (the router's `sheet(...)`):
  /// only the body and the keys, with room under them for the keyboard so the fields can scroll
  /// above it.
  final bool embedded;

  @override
  ConsumerState<EstimateSheet> createState() => _EstimateSheetState();
}

class _EstimateSheetState extends ConsumerState<EstimateSheet> {
  late final TextEditingController _from;
  late final TextEditingController _to;
  final _fromFocus = FocusNode();
  final _toFocus = FocusNode();
  final _fromShake = ValueNotifier<int>(0);
  final _toShake = ValueNotifier<int>(0);
  _Source? _source;

  /// The student chose a source themselves; until then the sheet follows the estimate that wins
  /// (their mocks can land after the sheet opens, and then they come first).
  bool _picked = false;
  String? _course;
  bool _saved = false;

  bool get _check => widget.mode == EstimateMode.check;

  @override
  void initState() {
    super.initState();
    final current = ref.read(estimateProvider);
    final typed = ref.read(typedEstimateProvider);
    // A link's score ("600-650", "600 to 650", "600–650") reads with the same parser as the fields.
    final given = widget.initialScore == null ? null : parseRange(widget.initialScore);
    // Check mode starts from the estimate the student has; estimate mode from what they typed.
    final Estimate? seed = given?.estimate() ?? (_check ? current : typed);
    _from = TextEditingController(text: seed == null ? (widget.initialScore ?? '') : estimateFigure(seed.low));
    _to = TextEditingController(text: seed == null || seed.isPoint ? '' : estimateFigure(seed.high));
    if (!_check) {
      _source = _sourceNow(current);
      if (widget.typeOwn) {
        _source = _Source.typed;
        _picked = true;
      }
    }
    final category = widget.initialCategory;
    if (category != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_check) ref.read(compassControllerProvider.notifier).setCategory(category);
      });
      _category = category;
    }
  }

  String? _category;

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    _fromFocus.dispose();
    _toFocus.dispose();
    _fromShake.dispose();
    _toShake.dispose();
    super.dispose();
  }

  /// Which row the sheet opens on: what the student said, else the estimate that wins.
  _Source _sourceNow(Estimate? current) => _sourceFor(current, ref.read(rangeChoiceProvider).value, ref.read(typedEstimateProvider));

  static _Source _sourceFor(Estimate? current, RangeMemory? memory, Estimate? typed) {
    if (memory?.choice == RangeChoice.unknown && typed == null) return _Source.unknown;
    return switch (current?.source) {
      EstimateSource.mocks => _Source.mocks,
      EstimateSource.projection => _Source.projection,
      _ => _Source.typed,
    };
  }

  /// Set by Done: the fields are read strictly, even a To still shorter than From.
  bool _strict = false;

  /// To is still being typed: fewer figures than From ("92" on the way to "920"), so it is not
  /// read yet and no problem shows for it until Done.
  bool get _toStillTyping {
    if (_strict) return false;
    final f = RegExp(r'\d+').firstMatch(_from.text)?.group(0) ?? '';
    final t = RegExp(r'\d+').firstMatch(_to.text)?.group(0) ?? '';
    return t.isNotEmpty && t.length < f.length;
  }

  /// The two fields read as one range (G18): "900", "900 to 920", "900-920", a pasted range in
  /// From, or a lower To that swaps. Over 200 marks apart is too wide to say anything.
  ParsedRange get _parsed => _toStillTyping ? parseRange(_from.text) : parseRangeFields(_from.text, _to.text);

  bool get _typing => _from.text.trim().isNotEmpty || _to.text.trim().isNotEmpty;

  /// The problem to show, once something is typed.
  RangeProblem? get _problem => _typing ? _parsed.problem : null;

  /// From is at fault when it is empty under a To, or holds something that is not a score.
  bool get _fromError {
    final p = _problem;
    if (p == null || p == RangeProblem.tooWide) return false;
    if (p == RangeProblem.empty) return true;
    final f = _from.text.trim();
    return f.isNotEmpty && !parseRange(f).ok;
  }

  bool get _toError => _problem != null && !_fromError;

  /// The typed range, or null while it is empty or has a problem.
  Estimate? get _typed => _parsed.estimate();

  /// A whole range typed or pasted into From moves its high end into To, so the two fields always
  /// show what is read. Only once the second figure is as long as the first: "100-12" is still
  /// being typed, "100-120" is a range.
  void _fromChanged(String text) {
    final r = parseRange(text);
    final figures = RegExp(r'\d+').allMatches(text).map((m) => m.group(0)!.length).toList();
    final finished = figures.length >= 2 && figures.last >= figures.first;
    if (r.ok && !r.isPoint && finished && _to.text.trim().isEmpty) {
      _from.value = TextEditingValue(text: estimateFigure(r.low!), selection: TextSelection.collapsed(offset: estimateFigure(r.low!).length));
      _to.text = estimateFigure(r.high!);
    }
    setState(() {
      _saved = false;
      _strict = false;
    });
  }

  /// The courses to show it against: the programmes on My colleges, then the onboarding course,
  /// then B.Com. (Hons.).
  List<String> _courses() {
    final view = ref.watch(myCollegesProvider);
    final ids = <String>{
      if (view.ready) for (final c in view.colleges) c.programmeId,
      ?ref.watch(ob.onboardingAnswersProvider).value?.courseId,
      'b-com-hons',
    };
    return ids.toList();
  }

  String _categoryNow() => _check ? (_category ?? ref.watch(estimateCategoryProvider)) : ref.watch(estimateCategoryProvider);

  void _setCategory(String c) {
    if (_check) {
      setState(() => _category = c);
    } else {
      ref.read(compassControllerProvider.notifier).setCategory(c);
    }
  }

  /// The estimate the ring shows: in check mode the typed one; in estimate mode the chosen source
  /// ("I don't know my range yet" shows the mocks' estimate once there is one).
  Estimate? _shown(Estimate? mocks, Estimate? projection) => switch (_check ? _Source.typed : _source) {
        _Source.mocks || _Source.unknown => mocks,
        _Source.projection => projection,
        _ => _typed,
      };

  /// Done with an invalid field focuses it and shakes it; Done with nothing typed changes nothing.
  void _done(Estimate? mocks, Estimate? projection) {
    final c = ref.read(compassControllerProvider.notifier);
    final choice = ref.read(rangeChoiceProvider.notifier);
    switch (_source) {
      case _Source.typed || null:
        setState(() => _strict = true);
        if (_fromError) {
          _fromShake.value++;
          _fromFocus.requestFocus();
          return;
        }
        if (_toError) {
          _toShake.value++;
          _toFocus.requestFocus();
          return;
        }
        final t = _typed;
        if (t != null) {
          c.setEstimate(t.low, t.isPoint ? null : t.high);
          choice.chooseTyped();
        }
      case _Source.mocks || _Source.projection:
        // Mocks or the projection: a typed figure would outrank them, so it goes.
        c.clearEstimate();
        choice.accept();
      case _Source.unknown:
        // Their mocks will find it: Today shows the way, one full mock in each subject.
        c.clearEstimate();
        choice.chooseUnknown();
    }
    Navigator.of(context).maybePop();
  }

  void _useAsEstimate() {
    final t = parseRangeFields(_from.text, _to.text).estimate();
    if (t == null) {
      setState(() => _strict = true);
      return;
    }
    final c = ref.read(compassControllerProvider.notifier);
    c.setCategory(_categoryNow());
    c.setEstimate(t.low, t.isPoint ? null : t.high);
    ref.read(rangeChoiceProvider.notifier).chooseTyped();
    HapticFeedback.selectionClick();
    setState(() => _saved = true);
  }

  void _seeEvery() {
    final q = <String, String>{
      'from': 'colleges',
      'category': _categoryNow(),
      'score': ?_parsed.link,
    };
    final router = GoRouter.of(context);
    Navigator.of(context).maybePop();
    router.push(Uri(path: ToolsPaths.compass, queryParameters: q).toString());
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    final large = MediaQuery.textScalerOf(context).scale(1) >= kSheetFullPageTextScale;
    final mocks = ref.watch(mocksEstimateProvider);
    final projection = mocks == null ? ref.watch(projectionEstimateProvider) : null;
    if (!_check && !_picked) {
      _source = _sourceFor(ref.watch(estimateProvider), ref.watch(rangeChoiceProvider).value, ref.watch(typedEstimateProvider));
    }
    final shown = _shown(mocks, projection);
    final colors = context.mmColors;
    final footer = DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s12, MmSpace.s20, MmSpace.s12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: _check ? _checkKeys() : _estimateKeys(mocks, projection),
        ),
      ),
    );
    if (widget.embedded) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _body(context, shown, mocks, projection),
          const SizedBox(height: MmSpace.s16),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: _check ? _checkKeys() : _estimateKeys(mocks, projection),
          ),
          SizedBox(height: inset),
        ],
      );
    }
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: LayoutBuilder(
        builder: (context, c) {
          final room = math.max(240.0, c.maxHeight - 8);
          final column = Column(
            mainAxisSize: large ? MainAxisSize.max : MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Center(child: Padding(padding: EdgeInsets.only(top: MmSpace.s12, bottom: MmSpace.s8), child: MmSheetHandle())),
              Flexible(
                child: SingleChildScrollView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
                  padding: const EdgeInsets.fromLTRB(MmSpace.s20, 0, MmSpace.s20, MmSpace.s16),
                  child: _body(context, shown, mocks, projection),
                ),
              ),
              footer,
            ],
          );
          return MmSheetGlass(
            child: SafeArea(
              top: large,
              bottom: inset == 0,
              child: large ? SizedBox(height: c.maxHeight, child: column) : ConstrainedBox(constraints: BoxConstraints(maxHeight: math.min(720, room)), child: column),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _estimateKeys(Estimate? mocks, Estimate? projection) => [
        KeyButton(label: CollegesCopy.done, onPressed: () => _done(mocks, projection)),
        if (ref.watch(typedEstimateProvider) != null) ...[
          const SizedBox(height: MmSpace.s4),
          Center(
            child: KeyButton.quiet(
              label: CollegesCopy.clearEstimate,
              onPressed: () {
                ref.read(compassControllerProvider.notifier).clearEstimate();
                ref.read(rangeChoiceProvider.notifier).clear();
                Navigator.of(context).maybePop();
              },
            ),
          ),
        ],
      ];

  List<Widget> _checkKeys() => [
        KeyButton(label: CollegesCopy.seeEvery, onPressed: _seeEvery),
        const SizedBox(height: MmSpace.s8),
        KeyButton.secondary(
          label: _saved ? CollegesCopy.savedEstimate : CollegesCopy.useAsEstimate,
          onPressed: _typed == null || _saved ? null : _useAsEstimate,
          disabledReason: _typed == null && !_saved ? CollegesCopy.typeToUse : null,
        ),
      ];

  Widget _body(BuildContext context, Estimate? shown, Estimate? mocks, Estimate? projection) {
    final colors = context.mmColors;
    final type = context.mmType;
    final category = _categoryNow();
    final courses = _courses();
    final course = _course != null && courses.contains(_course) ? _course! : courses.first;
    final catalog = ref.watch(duCatalogProvider).value;
    final categoryChips = [
      Text(CollegesCopy.category, style: type.caption.copyWith(color: colors.ink2)),
      const SizedBox(height: MmSpace.s8),
      Wrap(
        spacing: MmSpace.s8,
        runSpacing: MmSpace.s8,
        children: [for (final c in duMainCategories) MmChip(label: categoryLabel(c), selected: category == c, onTap: () => _setCategory(c))],
      ),
    ];
    final courseChips = courses.length < 2
        ? const <Widget>[]
        : [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final id in courses)
                    Padding(
                      padding: const EdgeInsets.only(right: MmSpace.s8),
                      child: MmChip(label: catalog?.group(id)?.name ?? id, selected: id == course, onTap: () => setState(() => _course = id)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s12),
          ];
    final result = _Result(course: course, category: category, estimate: shown, catalog: catalog, unknown: !_check && _source == _Source.unknown);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(_check ? CollegesCopy.checkHeading : CollegesCopy.yourEstimate, style: type.screenTitle.copyWith(fontSize: 24))),
        const SizedBox(height: MmSpace.s16),
        if (_check) ...[
          ...categoryChips,
          const SizedBox(height: MmSpace.s16),
          _fields(context),
          const SizedBox(height: MmSpace.s20),
          ...courseChips,
          result,
        ] else ...[
          ...courseChips,
          result,
          const SizedBox(height: MmSpace.s20),
          ...categoryChips,
          const SizedBox(height: MmSpace.s16),
          ..._sources(context, mocks, projection, catalog),
        ],
      ],
    );
  }

  List<Widget> _sources(BuildContext context, Estimate? mocks, Estimate? projection, DuCatalog? catalog) {
    final colors = context.mmColors;
    final type = context.mmType;
    final partial = mocks == null ? ref.watch(mockPartialProvider) : null;
    String subject(String id) => catalog?.language(id)?.shortName ?? catalog?.domain(id)?.shortName ?? id;
    final figure = type.figureCompact.copyWith(fontSize: 20, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]);
    return [
      if (mocks != null)
        _SourceRow(
          selected: _source == _Source.mocks,
          title: CollegesCopy.fromMocks,
          onTap: () => setState(() {
            _picked = true;
            _source = _Source.mocks;
          }),
          children: [
            Text('${estimateRange(mocks)} ${CollegesCopy.of1000}', style: figure),
            const SizedBox(height: MmSpace.s4),
            Text([for (final p in mocks.papers) '${subject(p.id)} ${p.marks}'].join(' · '), style: type.caption.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s4),
            Text(EstimateCopy.mocksTruth, style: type.caption.copyWith(color: colors.ink3)),
          ],
        )
      else if (partial != null)
        _SourceRow(
          selected: false,
          title: CollegesCopy.fromMocks,
          onTap: null,
          children: [
            Text(CollegesCopy.partial(partial.filled, [for (final m in partial.missing) subject(m)]), style: type.caption.copyWith(color: colors.ink2)),
            if (partial.missing.isNotEmpty)
              Container(
                alignment: Alignment.centerLeft,
                // The quiet key's own padding pulled back, so its words line up with the line above.
                transform: Matrix4.translationValues(-MmSpace.s16, 0, 0),
                child: KeyButton.quiet(
                  label: CollegesCopy.practise(subject(partial.missing.first)),
                  onPressed: () {
                    final router = GoRouter.of(context);
                    Navigator.of(context).maybePop();
                    router.push(Uri(path: AppRoutes.practiceSetup('full'), queryParameters: {'subject': partial.missing.first}).toString());
                  },
                ),
              ),
          ],
        ),
      if (projection != null)
        _SourceRow(
          selected: _source == _Source.projection,
          title: CollegesCopy.fromProjection,
          onTap: () => setState(() {
            _picked = true;
            _source = _Source.projection;
          }),
          children: [Text('${estimateRange(projection)} ${CollegesCopy.of1000}', style: figure)],
        ),
      _SourceRow(
        selected: _source == _Source.typed,
        title: CollegesCopy.typeOwn,
        onTap: () => setState(() {
            _picked = true;
            _source = _Source.typed;
          }),
        children: [
          SizeReveal(
            duration: Motion.card,
            child: _source == _Source.typed ? Padding(padding: const EdgeInsets.only(top: MmSpace.s8), child: _fields(context)) : const SizedBox(width: double.infinity),
          ),
        ],
      ),
      // "I don't know my range yet" (D109): their mocks find it, one full mock in each subject.
      _SourceRow(
        selected: _source == _Source.unknown,
        title: EstimateCopy.unknownTitle,
        onTap: () => setState(() {
          _picked = true;
          _source = _Source.unknown;
        }),
        children: [
          SizeReveal(
            duration: Motion.card,
            child: _source == _Source.unknown ? _unknownBody(context) : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    ];
  }

  Widget _unknownBody(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final RangeProgress? progress = ref.watch(rangeProgressProvider);
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s4, bottom: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(EstimateCopy.unknownBody, style: type.caption.copyWith(color: colors.ink2)),
          if (progress != null && progress.total > 0) ...[
            const SizedBox(height: MmSpace.s12),
            RangeStepsBar(progress: progress),
          ],
        ],
      ),
    );
  }

  Widget _fields(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final error = _fromError || _toError;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: MmShake(pulse: _fromShake, child: _field(_from, _fromFocus, CollegesCopy.from, _fromError, whole: true))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 16),
              child: Text(CollegesCopy.toWord, style: type.body.copyWith(color: colors.ink2)),
            ),
            Expanded(child: MmShake(pulse: _toShake, child: _field(_to, _toFocus, CollegesCopy.to, _toError))),
          ],
        ),
        const SizedBox(height: MmSpace.s4),
        Semantics(
          liveRegion: error,
          child: Text(
            error ? EstimateCopy.problem(_problem!) : EstimateCopy.fieldHelp,
            style: type.caption.copyWith(color: error ? colors.badText : colors.ink3),
          ),
        ),
      ],
    );
  }

  /// [whole]: From also takes a whole range ("900-920", "900 to 920"), typed or pasted.
  Widget _field(TextEditingController c, FocusNode focus, String label, bool error, {bool whole = false}) => TextField(
        controller: c,
        focusNode: focus,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: whole
            ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9. \-–—~toTO]')), LengthLimitingTextInputFormatter(16)]
            : [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')), LengthLimitingTextInputFormatter(6)],
        textInputAction: TextInputAction.done,
        onChanged: whole
            ? _fromChanged
            : (_) => setState(() {
                  _saved = false;
                  _strict = false;
                }),
        // Embedded, the host does not lift itself over the keyboard: ask for the keys' room too.
        scrollPadding: EdgeInsets.fromLTRB(120, 120, 120, 120 + (widget.embedded ? MediaQuery.viewInsetsOf(context).bottom : 0)),
        style: context.mmType.body.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        decoration: InputDecoration(labelText: label, isDense: true, errorText: error ? '' : null, errorStyle: const TextStyle(height: 0, fontSize: 0)),
      );
}

/// One source: a 56 dp radio row (the whole row is the target), with what it holds under it.
class _SourceRow extends StatelessWidget {
  const _SourceRow({required this.selected, required this.title, required this.onTap, this.children = const []});

  final bool selected;
  final String title;
  final VoidCallback? onTap;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final on = onTap != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          MmPressable(
            semanticsLabel: title,
            onTap: onTap,
            builder: (context, pressed, _) => SizedBox(
              height: 56,
              child: Semantics(
                inMutuallyExclusiveGroup: true,
                checked: selected,
                child: Row(
                  children: [
                    AnimatedContainer(
                      duration: Motion.of(context, Motion.ui),
                      curve: Motion.out,
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: selected ? colors.accentText : (on ? colors.lineStrong : colors.line), width: selected ? 6 : 1.6),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(child: Text(title, style: type.labelLarge.copyWith(color: on ? colors.ink : colors.ink3))),
                  ],
                ),
              ),
            ),
          ),
          if (children.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 34),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: children),
            ),
        ],
      ),
    );
  }
}

/// The ring: how many of the course's colleges the estimate makes safe or puts in reach in Round 1
/// (the ring's figure is both together), the same two words the rows use, what they mean in the
/// student's own figures, then their own colleges counted the same way (G18).
class _Result extends ConsumerWidget {
  const _Result({required this.course, required this.category, required this.estimate, required this.catalog, this.unknown = false});

  final String course;
  final String category;
  final Estimate? estimate;
  final DuCatalog? catalog;

  /// "I don't know my range yet" is chosen and the mocks have no estimate yet.
  final bool unknown;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final async = ref.watch(duOfferingsProvider(course));
    final cat = catalog;
    if (async.hasError && !async.hasValue) {
      return InlineBanner(
        tone: BannerTone.offline,
        message: CollegesCopy.cutoffsOffline,
        actionLabel: CollegesCopy.tryAgain,
        onAction: () => ref.invalidate(duOfferingsProvider(course)),
      );
    }
    final offerings = async.value;
    if (offerings == null || cat == null) {
      return const SkeletonGroup(
        label: CollegesCopy.loadingCutoffs,
        child: Row(children: [Skeleton.circle(size: 88), SizedBox(width: MmSpace.s16), Expanded(child: Skeleton.line(width: 180))]),
      );
    }
    final ci = cat.categoryIndex(category);
    final figures = <double>[];
    final seen = <String>{};
    for (final s in offerings.seats) {
      if (!seen.add(s.college)) continue;
      final r1 = s.rounds.isEmpty ? null : s.rounds.first;
      final f = duEffectiveCutoff(r1, ci);
      if (f != null) figures.add(f);
    }
    final total = figures.length;
    final e = estimate;
    final reach = e == null ? const Reach() : reachOf(e, figures);
    final name = cat.group(course)?.name ?? course;
    final view = ref.watch(myCollegesProvider);
    final mine = <double?>[];
    if (e != null && view.ready) {
      for (final c in view.colleges) {
        final f = ref.watch(collegeFigureProvider((c.programmeId, c.college, category)));
        if (!f.known || f.figure == null) continue;
        mine.add(f.figure);
      }
    }
    final mineReach = e == null ? const Reach() : reachOf(e, mine);
    return MergeSemantics(
      child: Row(
        children: [
          ToolsRing(
            size: 88,
            stroke: 7,
            fraction: total == 0 || e == null ? 0 : reach.reachable / total,
            child: Text(e == null ? '–' : '${reach.reachable}', style: type.figureCompact.copyWith(color: colors.ink)),
          ),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (e == null)
                  Text(unknown ? EstimateCopy.unknownRing : CollegesCopy.typeToSee, style: type.body.copyWith(color: colors.ink2))
                else ...[
                  Text(EstimateCopy.courseReach(reach, name), style: type.labelLarge.copyWith(color: colors.ink)),
                  const SizedBox(height: MmSpace.s4),
                  Text(EstimateCopy.meaning(e, category), style: type.caption.copyWith(color: colors.ink2)),
                  if (mineReach.total > 0) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(EstimateCopy.yourColleges(mineReach), style: type.caption.copyWith(color: colors.accentText)),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
