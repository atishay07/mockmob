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
    // The open paper's subject stands in the corner as its code-drawn emblem.
    final subject = resume.subjectId;
    final art = subject == null ? null : HeroArtView(art: HeroArt.object(subject: subject));
    return HeroStage(
      subjectId: subject,
      art: art,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding, MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Beside the object: the overline, the paper and the answered count, with no hole.
            Padding(
              padding: EdgeInsets.only(right: art == null ? 0 : heroArtClear - MmSpace.cardPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(TodayCopy.resumeOverline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                  const SizedBox(height: MmSpace.s4),
                  // A two-part title ("Mock 8, Accountancy") takes the title cut, so it stays on
                  // one line beside the object instead of wrapping into the number (audit T5).
                  Semantics(
                    header: true,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(resume.title, style: resume.title.contains(' ') ? type.title : type.headline, maxLines: 1, softWrap: false),
                    ),
                  ),
                  const SizedBox(height: MmSpace.s12),
                  NumberBlock(
                    number: '${resume.answered}',
                    label: TodayCopy.answeredLabel(resume.total),
                    semanticsLabel: '${resume.answered} of ${resume.total} answered',
                  ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s8),
            Text(resume.line, style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            KeyButton(label: resume.keyLabel, onPressed: onContinue),
          ],
        ),
      ),
    );
  }
}

class EndedHeroCard extends StatelessWidget {
  const EndedHeroCard({super.key, required this.ended, required this.onAction, this.retrying = false, this.demoteAction = false});

  final EndedHero ended;

  /// Tonight's move under the card holds the volt key; this card's own key is a text key.
  final bool demoteAction;
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
            SizedBox(height: demoteAction ? MmSpace.s8 : MmSpace.s20),
            if (demoteAction)
              Align(
                alignment: Alignment.centerLeft,
                child: Transform.translate(
                  offset: const Offset(-MmSpace.s16, 0),
                  child: KeyButton.quiet(label: ended.action.label, onPressed: () => onAction(ended.action)),
                ),
              )
            else
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
