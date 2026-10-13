// A session still open (or a mock that ended while the student was away) holds the hero: the
// answered count as the monumental number, when it ends, whether the server has the answers,
// and one key. Never a ticking clock here: the end time is fixed, so it is written as a time.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'number_block.dart';

class ResumeHeroCard extends StatelessWidget {
  const ResumeHeroCard({super.key, required this.resume, required this.onContinue});

  final ResumeHero resume;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final art = MmArt.subjectObject(resume.subjectId);
    return HeroStage(
      subjectId: resume.subjectId,
      art: art == null ? null : HeroArtView(art: HeroArt.object(art)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Beside the object: the overline, the paper and the answered count, with no hole.
            Padding(
              padding: EdgeInsets.only(right: art == null ? 0 : heroArtWidth - MmSpace.cardPadding + 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(TodayCopy.resumeOverline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Semantics(header: true, child: Text(resume.title, style: type.title.copyWith(fontSize: 20, height: 24 / 20))),
                  const SizedBox(height: MmSpace.s4),
                  NumberBlock(
                    number: '${resume.answered}',
                    label: TodayCopy.answeredLabel(resume.total),
                    semanticsLabel: '${resume.answered} of ${resume.total} answered',
                  ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s12),
            Text(resume.line, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s20),
            KeyButton(label: resume.keyLabel, onPressed: onContinue),
          ],
        ),
      ),
    );
  }
}

class EndedHeroCard extends StatelessWidget {
  const EndedHeroCard({super.key, required this.ended, required this.onAction, this.retrying = false});

  final EndedHero ended;
  final void Function(TodayAction action) onAction;

  /// A Try again read is running: a key that retries shows it is working.
  final bool retrying;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return HeroStage(
      subjectId: ended.subjectId,
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(TodayCopy.endedOverline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
            const SizedBox(height: MmSpace.s8),
            Semantics(header: true, child: Text(ended.title, style: type.title)),
            const SizedBox(height: MmSpace.s12),
            Text(ended.line, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s20),
            KeyButton(
              label: ended.action.label,
              onPressed: () => onAction(ended.action),
              loading: retrying && ended.action.target is RetryLoad,
            ),
          ],
        ),
      ),
    );
  }
}
