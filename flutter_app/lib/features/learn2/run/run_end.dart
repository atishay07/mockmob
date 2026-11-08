/// The run's end (the web's `RunEnd.jsx` as amended by R2 ruling 5, LK31 and R3-SPEC L5; the same one end screen as the feed's,
/// `../stage/end_form.dart`): the chapter as a quiet line, the headline with Mobi beside it, the cards this run sent to Revise as a
/// small fan, one row of up to three numbers (zeros dropped), the chapter's progress bar growing, then the key group: Free's one
/// line when the day's session is used, one main key and at most one quiet link. The X is the only other way out.
///
/// The keys are the server's (`GET /api/learn/runs/:id/end`, `lead` and `options`), word for word (ruling W):
///   "Keep going · 10 min" / "Next chapter · 10 min" over the chapter's name; quiet "Fix 3 open mistakes · 3 min"
///   a stopped run: "Continue · 6 min" resumes it by its id; the fix key starts a NEW mistakes-only run (`fresh`)
///   Free after the day's session: "Quick recap · 1 min" (or See Pro), See Pro quiet; never a key the server would refuse
/// A key that starts a chapter run starts it in place ([RunEndScreen.onKey]); a feed or a page opens.
library;

import 'package:flutter/material.dart';

import '../../../core/models/json_helpers.dart';
import '../data/learn_models.dart';
import '../stage/end_form.dart';
import '../stage/stage_end_model.dart';
import '../stage/stage_keys.dart';
import 'run_copy.dart';
import 'run_controller.dart' show RunEndStatus;
import 'run_math.dart';
import 'run_view.dart';

/// What a key of the end does with its option (the web's `keyTarget`).
enum RunKeyKind { pro, href, run, none }

/// The end of a run, from the server's end (or its loading and its failure).
class RunEndScreen extends StatelessWidget {
  const RunEndScreen({
    super.key,
    required this.status,
    required this.data,
    required this.kind,
    required this.chapterTitle,
    required this.tally,
    required this.stoppedAt,
    required this.total,
    required this.close,
    required this.onRetry,
    required this.keyKind,
    required this.onKey,
    this.titleKey,
    this.unsaved = 0,
  });

  final RunEndStatus status;
  final LearnEnd? data;
  final String kind;
  final String chapterTitle;
  final RunTally tally;

  /// How far the student got when they stopped part way ("5 of 20 done"); null for a run that reached its last item.
  final int? stoppedAt;
  final int total;

  /// The X and the word: a `StageCloseKey`.
  final Widget close;
  final VoidCallback onRetry;

  /// What an option's key does here (`pro`, an `href` to open, a `run` to start, or none: the key is left out).
  final RunKeyKind Function(LearnOption option) keyKind;

  /// An option's key was pressed.
  final ValueChanged<LearnOption> onKey;
  final GlobalKey? titleKey;

  /// Ratings and answers that failed to save this run (R8 APP-07): the error end then names them, never "is saved".
  final int unsaved;

  @override
  Widget build(BuildContext context) {
    if (status == RunEndStatus.loading || status == RunEndStatus.idle) return EndScreen(close: close, loading: true);
    final d = data;
    if (status == RunEndStatus.error || d == null) {
      return EndScreen(
        close: close,
        titleKey: titleKey,
        onRetry: onRetry,
        error: unsaved > 0
            ? (title: StageEndModel.unsavedLine(unsaved), line: RunCopy.endErrorUnsavedLine)
            : (title: RunCopy.endErrorTitle, line: RunCopy.endErrorLine),
      );
    }
    final raw = d.raw;
    final runKind = asString(raw['kind']) ?? kind;
    // The name: the end's chapter, else the title the server wrote ("10 minutes on X" without its length), else the screen's.
    final name = asString(asJson(raw['chapter'])['title']) ?? _nameOf(d, runKind) ?? (chapterTitle.isEmpty ? null : chapterTitle);
    final hasDone = raw['done'] is Map;
    final reached = hasDone ? d.done.reached : (total > 0 ? (stoppedAt ?? total) : 0);
    final of = hasDone ? d.done.of : total;
    final minutes = hasDone && asJson(raw['done'])['minutes'] != null ? d.done.minutes : null;
    final stopped = raw['stopped'] == true || (stoppedAt != null && of > 0 && stoppedAt! < of);
    final headline = runKind == LearnKinds.recap ? RunCopy.recapDone : StageEndModel.endHeadline(reached: reached, of: of, minutes: minutes, stopped: stopped);
    final hasCards = runKind != LearnKinds.level && runKind != LearnKinds.recap;
    final summary = RunView.reviseSummary(d.revisePile).total;
    final sent = hasCards ? (summary > 0 ? summary : d.reviseCards.length) : 0;
    final qLine = d.lines.where((l) => l.label == 'Questions').map((l) => l.text).firstOrNull ?? '';
    final right = int.tryParse(RegExp(r'^(\d+) of').firstMatch(qLine)?.group(1) ?? '') ?? 0;
    final nums = asJson(raw['numbers']);
    final numbers = StageEndModel.endNumbers(
      revise: sent,
      reviseText: StageEndModel.reviseLabel(raw['revisePile']),
      answered: asInt(nums['questions']) ?? 0,
      right: right,
      mistakes: asInt(nums['mistakes']) ?? 0,
      fixed: asInt(nums['fixed']) ?? 0,
    );
    final progress = hasCards && raw['progress'] is Map ? StageEndModel.endProgress(asJson(raw['progress'])) : null;
    final lead = d.lead != null && keyKind(d.lead!) != RunKeyKind.none ? d.lead : null;
    LearnOption? quiet;
    for (final o in d.options) {
      if (!identical(o, lead) && keyKind(o) != RunKeyKind.none) {
        quiet = o;
        break;
      }
    }
    final level = d.level;
    Widget? mainKey;
    if (lead != null) {
      final sub = lead.kind == 'next' ? asString(lead.raw['chapterTitle']) : (runKind == LearnKinds.level && level != null ? RunCopy.levelSub(level.right, level.of) : null);
      mainKey = StageEndKey(label: lead.label, sub: sub, onTap: () => onKey(lead));
    }
    return EndScreen(
      close: close,
      titleKey: titleKey,
      chapter: name,
      headline: headline,
      mobi: RunMath.endAct(tally),
      pile: sent > 0 ? [for (final c in d.reviseCards) StagePileCard.of(kind: c.kind, front: c.front ?? '', id: c.id)] : null,
      numbers: numbers,
      progress: progress,
      free: lead?.line,
      main: mainKey,
      quiet: quiet == null ? null : StageTextKey(label: quiet.label, onTap: () => onKey(quiet!)),
    );
  }

  /// The title the server wrote ("10 minutes on Goodwill"), without the length and the "on".
  String? _nameOf(LearnEnd d, String runKind) {
    final name = RunView.endTitle(d.title.isNotEmpty ? d.title : chapterTitle, kind: runKind).name;
    return name.isEmpty ? null : name;
  }
}

/// A quick recap's own end: "That was all 12 Must-know lines", Study these 12 (the one main key) and Quick recap again.
class RunRecapEnd extends StatelessWidget {
  const RunRecapEnd({super.key, required this.chapterTitle, required this.cards, required this.close, required this.onStudy, required this.onAgain, this.titleKey});

  final String chapterTitle;

  /// The distinct Must-know cards the recap showed.
  final int cards;
  final Widget close;
  final VoidCallback onStudy;
  final VoidCallback onAgain;
  final GlobalKey? titleKey;

  @override
  Widget build(BuildContext context) => EndScreen(
    close: close,
    titleKey: titleKey,
    chapter: chapterTitle.isEmpty ? null : chapterTitle,
    headline: RunCopy.recapAll(cards),
    mobi: 'nod',
    main: StageEndKey(label: RunCopy.studyThese(cards), onTap: onStudy),
    quiet: StageTextKey(label: RunCopy.quickRecapAgain, onTap: onAgain),
  );
}
