import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/art/art.dart';
import '../../core/motion/motion.dart';
import '../../core/repositories/attempts_repository.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import '../practice/data/practice_catalog.dart';
import 'subject_hub_content.dart';
import 'subject_hub_copy.dart';
import 'subject_hub_data.dart';
import 'subject_hub_paths.dart';
import 'subject_hub_widgets.dart';

/// A subject's hub (`/practice/subject/:subject`): the website's subject page and previous-year
/// guide as a native screen.
///
/// Top to bottom: the subject's object beside what the student has answered in it, the one
/// primary key (practise this subject), the website's introduction, the chapters with the
/// student's own accuracy in each, the website's approach for the subject, the previous-year
/// guide, and the website's questions and answers. Nothing here is written for the screen: the
/// words about the subject are the website's, and the numbers are the student's own attempts.
class SubjectHubScreen extends ConsumerWidget {
  const SubjectHubScreen({super.key, required this.subject});

  /// A public subject id, the website's slug, or an attempt-side id.
  final String subject;

  void _leave(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.practice);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final id = hubSubjectId(subject);
    final content = hubContentFor(id);
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final name = content?.name ?? subjectNameFor(id, catalog);
    final chapters = ref.watch(subjectHubChaptersProvider(id));
    final attempts = ref.watch(attemptsRepositoryProvider);
    final record = ref.watch(subjectHubRecordProvider(id));
    void practise(String path) => context.push(path);

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            MmPageHeader(title: name, fallbackRoute: AppRoutes.practice, backLabel: SubjectHubCopy.back),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                  child: MmStagger(
                    driver: MmStaggerDriver.route,
                    child: ListView(
                      padding: EdgeInsets.only(bottom: MmSpace.s48 + MediaQuery.viewPaddingOf(context).bottom),
                      children: [
                        MmStaggerItem(
                          index: 0,
                          child: _Hero(
                            subjectId: id,
                            name: name,
                            attemptsLoading: attempts.isInitialLoading,
                            failed: attempts.isFailedEmpty,
                            record: record,
                            savedAt: attempts.isStale ? attempts.fetchedAt : null,
                            onRetry: () => ref.read(attemptsRepositoryProvider.notifier).refresh(force: true),
                          ),
                        ),
                        MmStaggerItem(
                          index: 1,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s20, MmSpace.gutter, 0),
                            child: KeyButton(
                              label: SubjectHubCopy.practise(name),
                              onPressed: () => practise(SubjectHubPaths.practise(id)),
                            ),
                          ),
                        ),
                        if (content != null)
                          MmStaggerItem(
                            index: 2,
                            child: Padding(
                              padding: const EdgeInsets.only(top: MmSpace.s24),
                              child: HubProse([content.intro]),
                            ),
                          ),
                        ..._chapterSection(
                          id: id,
                          chapters: chapters,
                          record: record,
                          onPractise: (chapter) => practise(SubjectHubPaths.practiseChapter(id, chapter)),
                        ),
                        if (content != null) ...[
                          HubHeading(content.approach.heading),
                          HubProse(content.approach.paragraphs),
                        ],
                        ..._guideSection(),
                        if (content != null && content.faqs.isNotEmpty) ..._faqSection(content),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _chapterSection({
    required String id,
    required List<String> chapters,
    required SubjectRecord record,
    required void Function(String chapter) onPractise,
  }) {
    final hasRecord = record.attempts > 0;
    if (chapters.isEmpty) {
      return const [HubHeading(SubjectHubCopy.chaptersNoneTitle, note: SubjectHubCopy.chaptersNoneNote)];
    }
    return [
      HubHeading(SubjectHubCopy.chaptersTitle, note: SubjectHubCopy.chaptersNote(chapters.length, hasRecord: hasRecord)),
      for (var i = 0; i < chapters.length; i++) ...[
        if (i > 0) const HubRule(),
        HubChapterRow(
          chapter: chapters[i],
          record: record.chapters[chapters[i]],
          showStanding: hasRecord && record.hasChapterDetail,
          onTap: () => onPractise(chapters[i]),
        ),
      ],
    ];
  }

  /// The website's previous-year guide: its own first paragraph says what the guide is, and its
  /// four sections and four questions open in place.
  List<Widget> _guideSection() => [
    const HubHeading(SubjectHubCopy.guideTitle),
    HubProse([pyqGuide.intro]),
    const SizedBox(height: MmSpace.s8),
    for (final s in pyqGuide.sections) ...[
      const HubRule(),
      HubDisclosure(title: s.heading, paragraphs: s.paragraphs),
    ],
    for (final f in pyqGuide.faqs) ...[
      const HubRule(),
      HubDisclosure(title: f.question, paragraphs: [f.answer]),
    ],
  ];

  List<Widget> _faqSection(SubjectHubContent content) => [
    HubHeading(SubjectHubCopy.questionsTitle(content.name)),
    for (var i = 0; i < content.faqs.length; i++) ...[
      if (i > 0) const HubRule(),
      HubDisclosure(title: content.faqs[i].question, paragraphs: [content.faqs[i].answer]),
    ],
  ];
}

/// The object beside the student's record in the subject.
class _Hero extends StatelessWidget {
  const _Hero({
    required this.subjectId,
    required this.name,
    required this.attemptsLoading,
    required this.failed,
    required this.record,
    required this.savedAt,
    required this.onRetry,
  });

  final String subjectId;
  final String name;
  final bool attemptsLoading;
  final bool failed;
  final SubjectRecord record;
  final DateTime? savedAt;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final Widget text;
    if (attemptsLoading) {
      text = const HubRecordSkeleton();
    } else if (failed) {
      text = HubRecordText(
        title: SubjectHubCopy.recordFailedTitle,
        note: SubjectHubCopy.recordFailedNote,
        action: KeyButton.quiet(label: SubjectHubCopy.tryAgain, onPressed: onRetry),
      );
    } else if (record.attempts == 0) {
      text = const HubRecordText(title: SubjectHubCopy.notPractisedTitle, note: SubjectHubCopy.notPractisedNote);
    } else {
      final note = SubjectHubCopy.recordNote(record.attempts, record.lastAt);
      text = HubRecordText(
        title: SubjectHubCopy.recordTitle(record.correct, record.answered),
        note: savedAt == null ? note : '$note ${SubjectHubCopy.savedCopy(savedAt!)}',
      );
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SubjectEmblem(subject: subjectId, size: EmblemSizes.hero, framed: false, animate: true, semanticLabel: name),
          const SizedBox(width: MmSpace.s16),
          Expanded(child: text),
        ],
      ),
    );
  }
}
