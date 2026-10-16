// Check a score (`/colleges/cutoff`, and the website's /cuet-cutoff-calculator): a typed score or
// range against one course's 2026 Round 1 cutoffs, live as the student types. Nothing typed here
// is kept unless they tap "Use as my estimate". It opens with no keyboard: the category and the
// result are seen first.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../onboarding/onboarding.dart' as ob show onboardingAnswersProvider;
import '../compass/compass_controller.dart';
import '../copy.dart' show categoryLabel;
import '../data/du_repository.dart';
import '../data/my_colleges_actions.dart';
import '../domain/du_eligibility.dart' show duMainCategories;
import '../domain/du_models.dart';
import '../estimate/estimate.dart';
import '../estimate/estimate_providers.dart';
import '../tools_paths.dart';
import '../widgets/tools_parts.dart' show ToolsRing;
import 'college_rung.dart';
import 'colleges_copy.dart';

class CheckScoreSheet extends ConsumerStatefulWidget {
  const CheckScoreSheet({super.key, this.initialScore, this.initialCategory});

  final String? initialScore;
  final String? initialCategory;

  @override
  ConsumerState<CheckScoreSheet> createState() => _CheckScoreSheetState();
}

class _CheckScoreSheetState extends ConsumerState<CheckScoreSheet> {
  late final TextEditingController _from;
  late final TextEditingController _to;
  String? _course;
  String? _category;
  String _saved = '';

  @override
  void initState() {
    super.initState();
    final e = ref.read(estimateProvider);
    final given = widget.initialScore?.split('-');
    _from = TextEditingController(text: given != null ? given.first.trim() : (e == null ? '' : estimateFigure(e.low)));
    _to = TextEditingController(text: given != null && given.length > 1 ? given[1].trim() : (e == null || e.isPoint ? '' : estimateFigure(e.high)));
    _category = widget.initialCategory;
  }

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    super.dispose();
  }

  double? _parse(String t) {
    final v = double.tryParse(t.trim());
    if (v == null || v < 0 || v > 1000) return null;
    return v;
  }

  /// The courses to check against: those on My colleges, then the onboarding course, then B.Com. (Hons.).
  List<String> _courses() {
    final view = ref.watch(myCollegesProvider);
    final ids = <String>{
      if (view.ready) for (final c in view.colleges) c.programmeId,
      ?ref.watch(ob.onboardingAnswersProvider).value?.courseId,
      'b-com-hons',
    };
    return ids.toList();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final String category = _category ?? ref.watch(estimateCategoryProvider);
    final courses = _courses();
    final course = _course ?? courses.first;
    final low = _parse(_from.text);
    final highTyped = _to.text.trim().isEmpty ? low : _parse(_to.text);
    final fromError = _from.text.trim().isNotEmpty && low == null;
    final toError = _to.text.trim().isNotEmpty && _parse(_to.text) == null;
    final Estimate? typed = low == null || highTyped == null ? null : Estimate(source: EstimateSource.typed, low: math.min(low, highTyped), high: math.max(low, highTyped));
    final catalog = ref.watch(duCatalogProvider).value;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(header: true, child: Text(CollegesCopy.checkHeading, style: type.screenTitle.copyWith(fontSize: 24))),
          const SizedBox(height: MmSpace.s16),
          Text(CollegesCopy.category, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s8,
            children: [
              for (final c in duMainCategories) MmChip(label: categoryLabel(c), selected: category == c, onTap: () => setState(() => _category = c)),
            ],
          ),
          const SizedBox(height: MmSpace.s16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _field(_from, CollegesCopy.from, fromError)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: 16),
                child: Text('to', style: type.body.copyWith(color: colors.ink2)),
              ),
              Expanded(child: _field(_to, CollegesCopy.to, toError)),
            ],
          ),
          const SizedBox(height: MmSpace.s4),
          Text(fromError || toError ? CollegesCopy.fieldError : CollegesCopy.fieldHelp, style: type.caption.copyWith(color: fromError || toError ? colors.badText : colors.ink3)),
          const SizedBox(height: MmSpace.s20),
          if (courses.length > 1) ...[
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
          ],
          _Result(course: course, category: category, estimate: typed, catalog: catalog),
          const SizedBox(height: MmSpace.s20),
          KeyButton(
            label: CollegesCopy.seeEvery,
            onPressed: () {
              final q = <String, String>{
                'from': 'colleges',
                'category': category,
                if (typed != null) 'score': typed.isPoint ? estimateFigure(typed.low) : '${estimateFigure(typed.low)}-${estimateFigure(typed.high)}',
              };
              final router = GoRouter.of(context);
              Navigator.of(context).maybePop();
              router.push(Uri(path: ToolsPaths.compass, queryParameters: q).toString());
            },
          ),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(
            label: _saved.isNotEmpty ? CollegesCopy.savedEstimate : CollegesCopy.useAsEstimate,
            onPressed: typed == null
                ? null
                : () {
                    final c = ref.read(compassControllerProvider.notifier);
                    c.setCategory(category);
                    // Compass keeps one figure: the low end, so "clears" never overstates.
                    c.setScore(estimateFigure(typed.low));
                    setState(() => _saved = estimateFigure(typed.low));
                    HapticFeedback.selectionClick();
                  },
          ),
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label, bool error) => TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')), LengthLimitingTextInputFormatter(6)],
        textInputAction: TextInputAction.done,
        onChanged: (_) => setState(() => _saved = ''),
        scrollPadding: const EdgeInsets.all(120),
        style: context.mmType.body.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        decoration: InputDecoration(labelText: label, isDense: true, errorText: error ? '' : null, errorStyle: const TextStyle(height: 0, fontSize: 0)),
      );
}

/// The ring: how many of the course's colleges the score clears in Round 1, and how many more it
/// is within; then the student's own colleges.
class _Result extends ConsumerWidget {
  const _Result({required this.course, required this.category, required this.estimate, required this.catalog});

  final String course;
  final String category;
  final Estimate? estimate;
  final DuCatalog? catalog;

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
      return const SkeletonGroup(label: CollegesCopy.loadingCutoffs, child: Row(children: [Skeleton.circle(size: 88), SizedBox(width: MmSpace.s16), Expanded(child: Skeleton.line(width: 180))]));
    }
    final ci = cat.categoryIndex(category);
    final figures = <double>[];
    final seen = <String>{};
    for (final s in offerings.seats) {
      if (!seen.add(s.college)) continue;
      final r1 = s.rounds.isEmpty ? null : s.rounds.first;
      final f = r1 == null || ci >= r1.length ? null : r1[ci];
      if (f != null) figures.add(f);
    }
    final total = figures.length;
    final e = estimate;
    var clears = 0;
    var within = 0;
    if (e != null) {
      for (final f in figures) {
        final v = verdictFor(e, f).v;
        if (v == Verdict.clears) clears++;
        if (v == Verdict.within) within++;
      }
    }
    final name = cat.group(course)?.name ?? course;
    final view = ref.watch(myCollegesProvider);
    var mineClear = 0;
    var mineKnown = 0;
    if (e != null && view.ready) {
      for (final c in view.colleges) {
        final f = ref.watch(collegeFigureProvider((c.programmeId, c.college, category)));
        if (!f.known || f.figure == null) continue;
        mineKnown++;
        if (verdictFor(e, f.figure).v == Verdict.clears) mineClear++;
      }
    }
    return MergeSemantics(
      child: Row(
        children: [
          ToolsRing(
            size: 88,
            stroke: 7,
            fraction: total == 0 || e == null ? 0 : clears / total,
            child: Text(e == null ? '–' : '$clears', style: type.figureCompact.copyWith(color: colors.ink)),
          ),
          const SizedBox(width: MmSpace.s16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (e == null)
                  Text(CollegesCopy.typeToSee, style: type.body.copyWith(color: colors.ink2))
                else ...[
                  Text('${CollegesCopy.clearsOf(clears, total)} $name colleges', style: type.labelLarge.copyWith(color: colors.ink)),
                  const SizedBox(height: MmSpace.s4),
                  Text(
                    CollegesCopy.clearsLine(estimateRange(e), category, within),
                    style: type.caption.copyWith(color: colors.ink2),
                  ),
                  if (mineKnown > 0) ...[
                    const SizedBox(height: MmSpace.s4),
                    Text(CollegesCopy.yourCollegesClear(mineClear, mineKnown), style: type.caption.copyWith(color: colors.accentText)),
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
