import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/repositories/attempts_repository.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'data/practice_catalog.dart';
import 'model/practice_link.dart';
import 'model/practice_selection.dart';
import 'widgets/practice_app_bar.dart';
import 'widgets/practice_composer.dart';

/// `/practice/setup/:mode`: the confirm step as a page, for links from Today, the quick-start
/// sheet and notifications. The same composer as the confirm sheet, with the subject tiles on
/// top so a link can still change the subject. Everything the link names (subject, length,
/// chapters, difficulty) is kept.
class PracticeSetupScreen extends ConsumerStatefulWidget {
  const PracticeSetupScreen({super.key, required this.mode, this.link = const PracticeLink()});

  final PracticeMode mode;
  final PracticeLink link;

  @override
  ConsumerState<PracticeSetupScreen> createState() => _PracticeSetupScreenState();
}

class _PracticeSetupScreenState extends ConsumerState<PracticeSetupScreen> {
  /// The selection the composer starts from, fixed once the default subject has settled.
  PracticeSelection? _initial;

  /// A link that names no subject follows the student's default until the catalogue and their
  /// papers have loaded (a cold start opens before either), then holds it.
  PracticeSelection _resolveInitial() {
    final fixed = _initial;
    if (fixed != null) return fixed;
    final subject = ref.watch(practiceSubjectProvider);
    final selection = widget.link.selectionFor(widget.mode, fallbackSubject: subject)!;
    final settled = widget.link.subject != null ||
        (!ref.watch(practiceSubjectsProvider).isLoading && ref.watch(attemptsRepositoryProvider.select((s) => s.value != null || s.error != null)));
    if (settled) _initial = selection;
    return selection;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final initial = _resolveInitial();
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(top: 0, left: 0, right: 0, height: 360, child: IgnorePointer(child: LightField.lamp(context, strength: 0.7))),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  children: [
                    const PracticeAppBar(),
                    Expanded(
                      // Start is pinned at the bottom: the dock is hidden here, like the runner.
                      // Keyed by the page, not the subject: a default that settles late is
                      // applied inside the composer, keeping what the student already set.
                      child: PracticeComposer(
                        key: ValueKey('setup-${widget.mode.name}'),
                        initial: initial,
                        // A link asking for a length this mode does not offer says so here.
                        askedCount: widget.link.count,
                        showSubjects: true,
                        pinKey: true,
                        exits: ComposerExits(
                          run: (id) => context.go(AppRoutes.run(id)),
                          concepts: () => context.push(AppRoutes.learn),
                          review: () => context.go(AppRoutes.review),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
