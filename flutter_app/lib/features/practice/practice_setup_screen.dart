import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'data/practice_catalog.dart';
import 'model/practice_selection.dart';
import 'widgets/practice_app_bar.dart';
import 'widgets/practice_composer.dart';

String modeTitle(PracticeMode mode) => switch (mode) {
      PracticeMode.full => PracticeCopy.fullMockTitle,
      PracticeMode.quick => PracticeCopy.quickTitle,
      PracticeMode.chapter => PracticeCopy.chapterTitle,
      PracticeMode.nta => PracticeCopy.ntaTitle,
    };

/// `/practice/setup/:mode`: the confirm step as a page, for links from Today, the quick-start
/// sheet and notifications. The same composer as the confirm sheet, with the subject tiles on
/// top so a link can still change the subject.
class PracticeSetupScreen extends ConsumerStatefulWidget {
  const PracticeSetupScreen({super.key, required this.mode, this.subject, this.count, this.chapter, this.purpose});

  final PracticeMode mode;
  final String? subject;
  final int? count;
  final String? chapter;

  /// `baseline` or `full_sample`, from a link that asks for a first-use allowance.
  final String? purpose;

  @override
  ConsumerState<PracticeSetupScreen> createState() => _PracticeSetupScreenState();
}

class _PracticeSetupScreenState extends ConsumerState<PracticeSetupScreen> {
  late final PracticeSelection _initial = PracticeSelection(
    mode: widget.mode,
    subjectId: widget.subject ?? ref.read(practiceSubjectProvider),
    count: nearestPracticeCount(widget.count),
    chapter: widget.mode == PracticeMode.chapter ? widget.chapter : null,
    purpose: widget.purpose == 'baseline' || widget.purpose == 'full_sample' ? widget.purpose : null,
  );

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(top: 0, left: 0, right: 0, height: 360, child: IgnorePointer(child: LightField.lamp(context, strength: 0.7))),
          SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  children: [
                    const PracticeAppBar(),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                        children: [
                          PracticeComposer(
                            initial: _initial,
                            showSubjects: true,
                            exits: ComposerExits(
                              run: (id) => context.go(AppRoutes.run(id)),
                              concepts: () => context.push(AppRoutes.learn),
                              review: () => context.go(AppRoutes.review),
                            ),
                          ),
                        ],
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
