import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/learn_models.dart';
import 'home_copy.dart';
import 'home_entrance.dart';
import 'home_model.dart';

/// Learn home's suggestions (the web's Suggestions.jsx): the server's three, of different kinds, each with one line of
/// evidence. The first leads, larger, with the page's one volt key; the other two are compact with a line key under their
/// words. No subject object (the subject row already shows it once) and no minimum height: a tile is as tall as what it
/// says. A pick-up tile carries a thin track of the real "6 of 16". Every key starts at once: [onOpen] gets the
/// suggestion and the caller goes to its run, its feed or its href.
class HomeSuggestions extends StatelessWidget {
  const HomeSuggestions({super.key, required this.suggestions, required this.onOpen, this.firstIndex = 0});

  final List<LearnSuggestion> suggestions;
  final ValueChanged<LearnSuggestion> onOpen;

  /// The entrance slot of the first tile (see [HomeRise]).
  final int firstIndex;

  @override
  Widget build(BuildContext context) {
    final list = HomeModel.homeSuggestions(suggestions);
    if (list.isEmpty) return const SizedBox.shrink();
    return Semantics(
      container: true,
      label: HomeCopy.suggestionsGroup,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < list.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            HomeRise(
              index: firstIndex + i,
              child: _SuggestionTile(key: ValueKey('lh-suggestion-$i'), suggestion: list[i], lead: i == 0, onOpen: () => onOpen(list[i])),
            ),
          ],
        ],
      ),
    );
  }
}

class _SuggestionTile extends StatelessWidget {
  const _SuggestionTile({super.key, required this.suggestion, required this.lead, required this.onOpen});

  final LearnSuggestion suggestion;
  final bool lead;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final target = HomeModel.suggestionTarget(suggestion);
    final evidence = suggestion.evidence;
    final progress = lead ? HomeModel.pickupProgress(suggestion) : null;
    final label = suggestion.action.label;

    final Widget title;
    if (lead) {
      title = Text(
        HomeModel.displayTitle(suggestion.title),
        style: type.title.copyWith(fontSize: 22, height: 1.18, letterSpacing: -0.022 * 22, color: colors.ink),
      );
    } else {
      final base = type.body.copyWith(fontSize: 15, height: 1.3, fontWeight: FontWeight.w500, color: colors.ink, letterSpacing: -0.012 * 15);
      final split = HomeModel.splitTitle(suggestion);
      title = split.headline.isEmpty
          ? Text(HomeModel.displayTitle(suggestion.title), style: base)
          : Text.rich(
              TextSpan(
                style: base,
                children: [
                  TextSpan(text: HomeModel.displayTitle(split.headline), style: const TextStyle(fontWeight: FontWeight.w700)),
                  TextSpan(text: HomeModel.displayTitle(split.rest)),
                ],
              ),
            );
    }

    final words = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(header: lead, child: title),
        if (evidence != null) ...[
          SizedBox(height: lead ? 6 : 4),
          Text(evidence, style: type.body.copyWith(fontSize: lead ? 15 : 14, height: lead ? 1.45 : 1.4, fontWeight: FontWeight.w500, color: colors.ink2)),
        ],
        if (progress != null) ...[
          const SizedBox(height: 12),
          _Track(done: progress.done, of: progress.of),
        ],
      ],
    );

    final key = target == null
        ? null
        : lead
            ? KeyButton(key: const ValueKey('lh-suggestion-key'), label: label, minHeight: 52, onPressed: onOpen)
            : KeyButton.secondary(label: label, minHeight: MmTarget.min, onPressed: onOpen);

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        words,
        if (key != null) ...[SizedBox(height: lead ? 14 : 12), key],
      ],
    );

    return lead
        ? MmSurface.hero(radius: 20, padding: const EdgeInsets.fromLTRB(16, 18, 16, 16), child: body)
        : MmSurface.plain(radius: 16, padding: const EdgeInsets.all(16), child: body);
  }
}

/// The pick-up tile's thin track: only steps that are done (the real "6 of 16"), filled once per visit.
class _Track extends StatelessWidget {
  const _Track({required this.done, required this.of});

  final int done;
  final int of;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final share = of <= 0 ? 0.0 : (done / of).clamp(0.0, 1.0);
    return Semantics(
      label: HomeCopy.progressDone(done, of),
      child: ExcludeSemantics(
        child: Align(
          alignment: Alignment.centerLeft,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 240),
            child: SizedBox(
              height: 4,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(color: colors.line),
                    // The fill grows from the left once: 420 ms after a 120 ms wait; at rest under reduced motion.
                    TweenAnimationBuilder<double>(
                      tween: Tween<double>(begin: 0, end: share),
                      duration: Motion.of(context, const Duration(milliseconds: 420)),
                      curve: Motion.emphasized,
                      builder: (context, v, _) => Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: v,
                          heightFactor: 1,
                          child: ColoredBox(color: colors.ink2),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The tiles before the data, at the heights they will have (a lead of about 182, compact tiles of about 150), so nothing
/// moves when the real ones land.
class HomeSuggestionsSkeleton extends StatelessWidget {
  const HomeSuggestionsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Skeleton(height: 182, radius: 20),
        SizedBox(height: 10),
        Skeleton(height: 150, radius: 16),
        SizedBox(height: 10),
        Skeleton(height: 150, radius: 16),
      ],
    );
  }
}
