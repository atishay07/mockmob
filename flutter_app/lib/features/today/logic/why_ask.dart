import '../../../core/copy/formatters.dart' show plural;
import '../../insights/data/ask_mobi_context.dart';
import '../copy.dart';
import 'why_model.dart';

/// What Today hands Ask Mobi (ASK-MOBI-1018 section 3, Today's "Why this"): the reason in the
/// plan's own words and its real counts, with their denominators, so the sheet opens on the
/// answer, free. Only what the cached paper says; at most three chapters.
AskMobiContext askContextOfWhy(WhyModel m) => AskMobiContext.today(
      reason: TodayCopy.whyFrom(m.source, m.subject, m.date),
      facts: [
        TodayCopy.whyCounts(m.wrong, m.correct, m.blank),
        for (final c in m.chapters.take(3)) '${c.chapter}: ${TodayCopy.chapterRow(c.wrong, c.blank)} in ${plural(c.questions, 'question')}',
      ],
    );
