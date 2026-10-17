import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart' show nowProvider;
import '../../../core/models/repair_check.dart';
import '../../../core/motion/motion.dart';
import '../../../core/notes/feature_note_view.dart';
import '../../../core/notes/feature_notes.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/ask_mobi.dart';
import '../copy.dart';
import '../data/repair_check_controller.dart';
import '../data/repair_check_logic.dart';
import 'outcome_views.dart' show ExplanationBlock;
import 'question_panel.dart' show MarkedOption, OptionMark;
import 'review_bits.dart' show FlushKey;

/// The in-app place Ask opens at for the mistake [attemptId]:[questionId]: `/ask?q=...`. The Ask
/// screen reads the reference, shows the question it was handed and sends it with the message.
String askAboutLocation(String attemptId, String questionId) =>
    Uri(path: AppRoutes.ask, queryParameters: {'q': '$attemptId:$questionId'}).toString();

/// Where "Check it held" sits on the page, so a key outside the scroll can bring it into view.
GlobalKey checkAnchorKey(String attemptId, String questionId) => GlobalObjectKey('check-$attemptId/$questionId');

/// What follows a repair's explanation, in the order the website has it (MistakeRepair.jsx):
/// "Ask Mobi about Q3" (the follow-up about the mistake just explained), then "Check it held" (one
/// fresh question, marked by the server, with no extra credit).
///
/// Both are drawn only for a repair whose response carried a `check` (an older server, a held repair
/// and one that was not explained have none, and nothing is drawn).
class RepairFollowUp extends ConsumerStatefulWidget {
  const RepairFollowUp({super.key, required this.attemptId, required this.questionId, required this.number, required this.check, this.receipt});

  /// What the receipt under an answered check says (the paper, the marks, the trap, the run's checks).
  final CheckReceipt? receipt;

  final String attemptId;
  final String questionId;

  /// The mistake's number on the paper, for "Ask Mobi about Q3".
  final int? number;
  final RepairCheckInfo check;

  @override
  ConsumerState<RepairFollowUp> createState() => _RepairFollowUpState();
}

class _RepairFollowUpState extends ConsumerState<RepairFollowUp> {
  CheckKey get _key => (attemptId: widget.attemptId, questionId: widget.questionId);

  @override
  void initState() {
    super.initState();
    // The repair response is read once, when the repair appears; the screen then follows the
    // server's own answers.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(repairCheckProvider(_key).notifier).begin(widget.check);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Divider(height: 1, color: colors.line),
          const SizedBox(height: MmSpace.s16),
          AskAboutMistake(attemptId: widget.attemptId, questionId: widget.questionId, number: widget.number),
          const SizedBox(height: MmSpace.s24),
          KeyedSubtree(
            key: checkAnchorKey(widget.attemptId, widget.questionId),
            child: CheckItHeld(attemptId: widget.attemptId, questionId: widget.questionId, receipt: widget.receipt),
          ),
        ],
      ),
    );
  }
}

/// "Ask Mobi about Q3", with its cost line from the AI wallet, or one line that written replies
/// are paused, out of credits or unreadable (and that nothing is charged). It belongs to the
/// mistake being repaired, so it names the question by its number, and it hands that mistake over:
/// never the check question below it.
class AskAboutMistake extends ConsumerWidget {
  const AskAboutMistake({super.key, required this.attemptId, required this.questionId, required this.number});

  final String attemptId;
  final String questionId;
  final int? number;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final credits = ref.watch(creditsRepositoryProvider);
    // A wallet that cannot be read at all is said once, not held open for ever.
    final offer = credits.value == null && credits.isFailedEmpty ? AskOffer.unreadable : AskOffer.of(credits.value);
    // Until the wallet is read the place is held (48 dp) with nothing in it: no link and no price
    // that could be taken back.
    if (offer.pending) return const SizedBox(height: MmTarget.min, width: double.infinity);
    if (!offer.ask) {
      return Semantics(liveRegion: true, child: Text(offer.line!, style: type.small.copyWith(color: colors.ink2)));
    }
    // The first time, one line says Mobi can be asked about any question under review (F18): it
    // sits right above the key that does it, and using the key closes it.
    final intro = ref.watch(featureNotesProvider).visible(FeatureNote.askMobi);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (intro) ...[
          const FeatureNoteView(note: FeatureNote.askMobi, lead: ReviewCopy.noteAskLead, text: ReviewCopy.noteAsk, gotIt: false),
          const SizedBox(height: MmSpace.s12),
        ],
        KeyButton.secondary(
          label: CheckCopy.askLabel(number),
          expanded: false,
          onPressed: () {
            ref.read(featureNotesProvider.notifier).done(FeatureNote.askMobi);
            // Ask Mobi opens over the repair, about this mistake (ASK-MOBI-1018 3).
            openAskMobi(context, AskMobiContext.question(number: number, ref: '$attemptId:$questionId'));
          },
        ),
        const SizedBox(height: MmSpace.s8),
        Text('${offer.line} ${CheckCopy.askSees(number)}', style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

/// "Check it held": one new question that was not seen, picked in place, marked by the server.
class CheckItHeld extends ConsumerWidget {
  const CheckItHeld({super.key, required this.attemptId, required this.questionId, this.receipt});

  final String attemptId;
  final String questionId;
  final CheckReceipt? receipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (attemptId: attemptId, questionId: questionId);
    final view = ref.watch(repairCheckProvider(key));
    final controller = ref.read(repairCheckProvider(key).notifier);
    final colors = context.mmColors;
    final type = context.mmType;
    final quiet = view.phase == CheckPhase.none || view.phase == CheckPhase.loadError;
    final loading = view.phase == CheckPhase.idle || view.phase == CheckPhase.loading;
    final open = view.question;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(header: true, child: Text(CheckCopy.title, style: type.cardTitle)),
        if (!quiet) ...[
          const SizedBox(height: MmSpace.s4),
          Text(CheckCopy.lead(open?.basis), style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s12),
        if (loading) const _CheckSkeleton(),
        if (quiet)
          Semantics(
            liveRegion: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(view.message ?? CheckCopy.loadFailed, style: type.body.copyWith(color: colors.ink2)),
                if (view.canRetry) FlushKey(label: CheckCopy.retry, onPressed: controller.load),
              ],
            ),
          ),
        if (open != null && !quiet && !loading) _Body(view: view, controller: controller, receipt: receipt),
      ],
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.view, required this.controller, this.receipt});

  final CheckView view;
  final RepairCheckController controller;
  final CheckReceipt? receipt;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final open = view.question!;
    final answered = view.answered;
    final result = view.result;
    final pool = answered ? null : CheckCopy.poolLine(view.pool ?? open.pool);
    // The app's own clock (India days, like Revise), so the day label is the same in a test.
    final nowUtc = ref.watch(nowProvider)().toUtc();
    final revise = result == null ? null : CheckCopy.reviseLine(result.revise, right: result.right, nowUtc: nowUtc);
    // The receipt counts only the checks of this repair's own run that were answered, each one a
    // real answer the server marked: nothing is claimed beyond them.
    String? receiptLine;
    if (answered && result != null && receipt != null) {
      final r = receipt!;
      final tally = HeldTally.of([for (final k in r.runKeys) ref.watch(repairCheckProvider(k))]);
      receiptLine = CheckCopy.receipt(right: result.right, source: r.source, marks: r.marks, trap: r.trap, held: tally.held, answered: tally.answered);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (open.basisLine != null || pool != null) ...[
          if (open.basisLine != null) Text(open.basisLine!, style: type.labelLarge.copyWith(color: colors.ink2)),
          if (pool != null) Text(pool, style: type.caption.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s12),
        ],
        Text(open.question, style: type.question),
        const SizedBox(height: MmSpace.s16),
        if (answered && result != null)
          for (var i = 0; i < result.options.length; i++) ...[
            if (i > 0) const SizedBox(height: MmSpace.s8),
            _AnsweredRow(option: result.options[i], keyIndex: result.keyIndex, pickIndex: result.pickIndex),
          ]
        else
          Semantics(
            container: true,
            explicitChildNodes: true,
            label: open.question,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < open.options.length; i++) ...[
                  if (i > 0) const SizedBox(height: MmSpace.s8),
                  _OpenRow(
                    option: open.options[i],
                    selected: !view.refetch && view.pick == open.options[i].index,
                    // A withdrawn question stays readable but stops taking taps: the only action
                    // is another question.
                    onTap: view.sending || view.refetch ? null : () => controller.pick(open.options[i].index),
                  ),
                ],
              ],
            ),
          ),
        if (!answered) ...[
          const SizedBox(height: MmSpace.s16),
          if (view.refetch)
            KeyButton.secondary(label: CheckCopy.another, expanded: false, onPressed: controller.load)
          else ...[
            // Outlined, not filled: the pinned "Next mistake" below is the screen's one filled key.
            KeyButton.secondary(
              label: view.sending
                  ? CheckCopy.marking
                  : (view.error != null && view.errorCanRetry ? CheckCopy.retry : CheckCopy.submit),
              loading: view.sending,
              onPressed: view.pick == null ? null : controller.submit,
            ),
            const SizedBox(height: MmSpace.s8),
            Text(
              view.pick == null ? '${CheckCopy.pickOne} ${CheckCopy.firstCounts}' : CheckCopy.firstCounts,
              style: type.caption.copyWith(color: colors.ink2),
            ),
          ],
          if (view.error != null) ...[
            const SizedBox(height: MmSpace.s8),
            Semantics(liveRegion: true, child: Text(view.error!, style: type.small.copyWith(color: colors.badText, fontWeight: FontWeight.w600))),
          ],
        ],
        if (answered && result != null) _Result(result: result, replayed: view.replayed, revise: revise, receipt: receiptLine),
      ],
    );
  }
}

/// One option of the open question: the app's radio row (letter bubble, 56 dp, selected state in
/// ink and surface), so the pick reads as a pick, not a button.
class _OpenRow extends StatelessWidget {
  const _OpenRow({required this.option, required this.selected, required this.onTap});

  final CheckOption option;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => MmSelectRow(title: option.text, letter: option.letter, selected: selected, onTap: onTap);
}

/// One option of the answered question: the key and the student's pick tagged in words, in the
/// order the student saw them. A right answer is one row: "Your pick and the key".
class _AnsweredRow extends StatelessWidget {
  const _AnsweredRow({required this.option, required this.keyIndex, required this.pickIndex});

  final CheckOption option;
  final int keyIndex;
  final int? pickIndex;

  @override
  Widget build(BuildContext context) {
    final isKey = option.isKey || option.index == keyIndex;
    final isPick = option.isPick || option.index == pickIndex;
    final mark = isKey ? OptionMark.correct : (isPick ? OptionMark.yours : OptionMark.none);
    return MarkedOption(letter: option.letter, text: option.text, mark: mark, word: CheckCopy.tag(isKey: isKey, isPick: isPick));
  }
}

/// The answer: the verdict in words first, then the bank's explanation, the rule when it was
/// missed, and the Revise line only when the server wrote cards.
class _Result extends StatelessWidget {
  const _Result({required this.result, required this.replayed, required this.revise, this.receipt});

  final CheckResult result;
  final bool replayed;
  final String? revise;

  /// "Fixed. This trap cost you 6 marks in Mock 3. Held 1 of 1.", or null.
  final String? receipt;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final right = result.right;
    Widget rise(int i, Widget child) => replayed ? child : MmEntrance(delay: Motion.staggerStep * i, child: child);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: MmSpace.s20),
        rise(
          0,
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: right ? colors.goodText : colors.ink3, width: 1.5),
                    ),
                    child: SizedBox.square(
                      dimension: 24,
                      child: Icon(right ? LucideIcons.check : LucideIcons.rotateCcw, size: 14, color: right ? colors.goodText : colors.ink2),
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(result.line, style: type.body.copyWith(fontWeight: FontWeight.w600))),
              ],
            ),
          ),
        ),
        if (receipt != null)
          rise(
            1,
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s8),
              child: Text(receipt!, key: const ValueKey('check-receipt'), style: type.small.copyWith(color: colors.ink2)),
            ),
          ),
        if (replayed) ...[
          const SizedBox(height: MmSpace.s8),
          Text(CheckCopy.answeredEarlier, style: type.caption.copyWith(color: colors.ink2)),
        ],
        if (result.explanation != null) rise(1, ExplanationBlock(label: CheckCopy.explanation, paragraphs: [result.explanation!])),
        if (!right && result.ruleLine != null) rise(2, ExplanationBlock(label: CheckCopy.yourRule, paragraphs: [result.ruleLine!])),
        if (revise != null)
          rise(
            2,
            Padding(
              padding: const EdgeInsets.only(top: MmSpace.s16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Icon(LucideIcons.repeat, size: 14, color: colors.ink3),
                  ),
                  const SizedBox(width: MmSpace.s8),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${CheckCopy.reviseLabel}. ', style: type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w700)),
                          TextSpan(text: revise, style: type.small.copyWith(color: colors.ink2)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// While the question is found: one plain line, and the shape of the question (stem, four rows,
/// the button) so nothing jumps when it arrives.
class _CheckSkeleton extends StatelessWidget {
  const _CheckSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(liveRegion: true, child: Text(CheckCopy.loading, style: context.mmType.caption.copyWith(color: colors.ink2))),
        const SizedBox(height: MmSpace.s12),
        ExcludeSemantics(
          child: SkeletonGroup(
            label: CheckCopy.loading,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Skeleton.line(),
                const SizedBox(height: MmSpace.s8),
                const Skeleton.line(width: 200),
                const SizedBox(height: MmSpace.s16),
                for (var i = 0; i < 4; i++) ...[
                  if (i > 0) const SizedBox(height: MmSpace.s8),
                  const Skeleton(height: 56, radius: MmRadius.key),
                ],
                const SizedBox(height: MmSpace.s16),
                const Skeleton(height: MmTarget.primaryKey, radius: 999),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
