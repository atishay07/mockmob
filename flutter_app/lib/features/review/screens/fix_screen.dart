import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api/api_error.dart';
import '../../../core/models/attempt.dart' show AttemptDetail;
import '../../../core/models/question.dart' show SnapshotQuestion;
import '../../../core/models/repair.dart';
import '../../../core/models/repair_check.dart';
import '../../../core/repositories/attempts_repository.dart';
import '../../../core/repositories/credits_repository.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/data/feed_api.dart' show feedApiProvider, reportQuestion;
import '../../insights/data/mobi_models.dart' show CheckMark;
import '../data/fix_api.dart';
import '../data/repair_api.dart';
import '../widgets/ai_explanation_note.dart';
import '../widgets/check_card.dart';
import '../widgets/outcome_views.dart' show RuleCard;

/// "Fix it for good" (MOBI-CONTRACT 4; ASK-MOBI-VALUE 2.2 and 4.2): the Repair as Mobi's job, reached from "Ask Mobi
/// about Q7". One credit buys the whole job, in this order: the option you picked, why it looked right (with how often
/// this trap has caught you), why the key is right, one rule to keep, then 2 fresh questions on the same idea (the
/// first, then the second), and the fix is "held" when both are right.
///
/// The price was said on the key before the tap. A fix already written opens free and says so; a failure costs
/// nothing and says so; a dispute about the key is free.
class FixScreen extends ConsumerStatefulWidget {
  const FixScreen({super.key, required this.attemptId, required this.questionId, this.number});

  final String attemptId;
  final String questionId;

  /// The question's number on its paper, for "Q7". Null when the opener did not say.
  final int? number;

  @override
  ConsumerState<FixScreen> createState() => _FixScreenState();
}

class _Slot {
  CheckQuestion? question;
  CheckMark? mark;
  String? note;
  bool loading = false;
  bool marking = false;
  int? pending;
  String? error;
  String requestId = const Uuid().v4();
}

class _FixScreenState extends ConsumerState<FixScreen> {
  String _requestId = const Uuid().v4();
  RepairResponse? _repair;
  ApiError? _error;
  bool _failedOther = false;
  bool _writing = false;
  final _slots = [_Slot(), _Slot()];
  bool? _held;
  String? _heldLine;
  bool _disputed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _write();
    });
  }

  Future<void> _write() async {
    if (_writing) return;
    setState(() {
      _writing = true;
      _error = null;
      _failedOther = false;
    });
    try {
      final r = await ref.read(repairApiProvider).repair(attemptId: widget.attemptId, questionId: widget.questionId, requestId: _requestId);
      if (!mounted) return;
      setState(() {
        _repair = r;
        _writing = false;
      });
      ref.read(creditsRepositoryProvider.notifier).refresh();
      if (r.status.countsAsRepaired) await _load(0);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _writing = false;
        // Released on the server: the next try is a new request.
        if (e.chargedNothing) _requestId = const Uuid().v4();
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _failedOther = true;
        _writing = false;
      });
    }
  }

  int get _offered => (_repair?.mobi?.checks ?? 2).clamp(1, 2);

  Future<void> _load(int i) async {
    final slot = _slots[i];
    setState(() {
      slot.loading = true;
      slot.error = null;
    });
    try {
      final got = await ref.read(fixCheckApiProvider).load(attemptId: widget.attemptId, questionId: widget.questionId, slot: i + 1);
      if (!mounted) return;
      setState(() {
        slot.loading = false;
        if (got.held != null) _held = got.held;
        if (got.heldLine != null) _heldLine = got.heldLine;
        switch (got.load) {
          case CheckReady(:final question):
            slot.question = question;
          case CheckStored(:final question, :final result):
            slot.question = question;
            slot.mark = CheckMark.fromResult(result);
          case final CheckNone none:
            slot.note = none.line;
        }
        _deriveHeld();
      });
      // A reopened fix whose first check is answered goes straight on to the second.
      if (i == 0 && slot.mark != null && _offered > 1) await _load(1);
    } on Object {
      if (!mounted) return;
      setState(() {
        slot.loading = false;
        slot.error = CheckCopyFix.loadFailed;
      });
    }
  }

  Future<void> _answer(int i, int pick) async {
    final slot = _slots[i];
    final q = slot.question;
    if (q == null || slot.marking || slot.mark != null) return;
    setState(() {
      slot.marking = true;
      slot.pending = pick;
      slot.error = null;
    });
    try {
      final a = await ref.read(fixCheckApiProvider).submit(
            attemptId: widget.attemptId,
            questionId: widget.questionId,
            checkQuestionId: q.checkQuestionId,
            pick: pick,
            requestId: slot.requestId,
            slot: i + 1,
          );
      if (!mounted) return;
      setState(() {
        slot.marking = false;
        slot.mark = CheckMark.fromResult(a.result);
        if (a.held != null) _held = a.held;
        if (a.heldLine != null) _heldLine = a.heldLine;
        _deriveHeld();
      });
      if (i == 0 && _offered > 1) await _load(1);
    } on Object {
      if (!mounted) return;
      setState(() {
        slot.marking = false;
        slot.pending = null;
        slot.error = CheckCopyFix.markFailed;
      });
    }
  }

  /// The verdict when the server has not said it (a fix reopened from its stored answers): held only when every check
  /// offered is answered right; not held as soon as one is wrong.
  void _deriveHeld() {
    final answered = [
      for (var i = 0; i < _offered; i++)
        ?_slots[i].mark,
    ];
    final stillOpen = [for (var i = 0; i < _offered; i++) if (_slots[i].mark == null && _slots[i].note == null) i].isNotEmpty;
    if (answered.any((m) => !m.right)) {
      _held ??= false;
    } else if (!stillOpen && answered.isNotEmpty) {
      _held ??= true;
    }
  }

  Future<void> _dispute() async {
    // The interact route accepts only mock, review, explore or shadow as the flow ('fix' was refused, so every dispute
    // said it did not reach us).
    final ok = await reportQuestion(ref.read(feedApiProvider), widget.questionId, FixCopy.disputeReason, flow: 'review');
    if (!mounted) return;
    setState(() => _disputed = ok);
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(ok ? FixCopy.disputeSent : FixCopy.disputeFailed), behavior: SnackBarBehavior.floating));
  }

  SnapshotQuestion? _question(AttemptDetail? d) {
    for (final q in d?.attempt.questions ?? const <SnapshotQuestion>[]) {
      if (q.id == widget.questionId) return q;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final detail = ref.watch(attemptDetailProvider(widget.attemptId)).value;
    final q = _question(detail);
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            MmPageHeader(title: FixCopy.title, fallbackRoute: AppRoutes.review),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s4, MmSpace.gutter, MmSpace.s32 + MediaQuery.paddingOf(context).bottom),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _body(context, q)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(BuildContext context, SnapshotQuestion? q) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = _repair;
    final head = <Widget>[
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(padding: EdgeInsets.only(top: 2), child: MmMark(size: 28)),
          const SizedBox(width: MmSpace.s12),
          Expanded(child: Text(FixCopy.lead(widget.number), style: type.body.copyWith(color: colors.ink2, height: 22 / 16))),
        ],
      ),
      if (q != null && q.question.trim().isNotEmpty) ...[
        const SizedBox(height: MmSpace.s16),
        DecoratedBox(
          decoration: ShapeDecoration(color: colors.sunken, shape: const RoundedRectangleBorder(borderRadius: MmRadius.keyAll)),
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.s16),
            child: Text(q.question.trim(), style: type.small.copyWith(color: colors.ink, height: 1.5), maxLines: 4, overflow: TextOverflow.ellipsis),
          ),
        ),
      ],
    ];

    if (r == null) {
      final e = _error;
      final failed = e != null || _failedOther;
      return [
        ...head,
        const SizedBox(height: MmSpace.s32),
        if (!failed) ...[
          Row(
            children: [
              SizedBox.square(dimension: 20, child: MmSpinner(color: colors.ink2)),
              const SizedBox(width: MmSpace.s12),
              Expanded(child: Semantics(liveRegion: true, child: Text(FixCopy.writing, style: type.body.copyWith(color: colors.ink)))),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          Text(FixCopy.writingNote, style: type.small.copyWith(color: colors.ink2)),
        ] else ...[
          Semantics(liveRegion: true, child: Text(FixCopy.failure(e), style: type.body.copyWith(fontWeight: FontWeight.w600))),
          const SizedBox(height: MmSpace.s4),
          // L-11: only a failure the server reported says nothing was charged; a lost answer says what trying again does.
          Text(FixCopy.outcomeUnknown(e) ? FixCopy.unknownNote : FixCopy.nothingCharged, style: type.small.copyWith(color: colors.ink2)),
          if (!(e?.kind == ApiErrorKind.paymentRequired || (e?.hasCode('insufficient_ai_credits') ?? false))) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: FixCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: _write),
          ],
        ],
      ];
    }

    if (!r.status.countsAsRepaired) {
      return [
        ...head,
        const SizedBox(height: MmSpace.s32),
        Text(r.status == RepairStatus.heldForRecheck ? FixCopy.heldForRecheck : FixCopy.notExplained, style: type.body.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: MmSpace.s4),
        Text(FixCopy.nothingCharged, style: type.small.copyWith(color: colors.ink2)),
      ];
    }

    final e = r.explanation!;
    final m = r.mobi;
    final pick = m?.yourPick ?? (r.chosenIndex == null ? null : FixOption(index: r.chosenIndex!));
    final key = m?.key ?? (r.keyIndex == null ? null : FixOption(index: r.keyIndex!));
    String? optionText(FixOption? o) => o?.text ?? (o != null && q != null && o.index < q.options.length ? q.options[o.index].text : null);
    final lookedRight = e.whyWrong ?? e.whyTempting;
    final trapType = m?.trapType ?? e.trapType;

    return [
      ...head,
      _Step(
        label: FixCopy.yourOption,
        children: [
          if (pick != null) Text(FixCopy.youPicked(pick.letter), style: type.body.copyWith(fontWeight: FontWeight.w700)),
          if (optionText(pick) case final t?) ...[const SizedBox(height: MmSpace.s4), Text(t, style: type.body)],
          if (trapType != null) ...[
            const SizedBox(height: MmSpace.s12),
            _TrapTag(label: repairTrapLabel(trapType)),
          ],
        ],
      ),
      if (lookedRight != null)
        _Step(
          label: FixCopy.whyLookedRight,
          children: [
            Text(lookedRight, style: type.body),
            if (m?.historyLine case final h?) ...[
              const SizedBox(height: MmSpace.s12),
              _History(line: h),
            ],
          ],
        ),
      _Step(
        label: FixCopy.whyKeyRight,
        children: [
          if (key != null) Text(FixCopy.keyIs(key.letter), style: type.body.copyWith(fontWeight: FontWeight.w700, color: colors.goodText)),
          if (optionText(key) case final t?) ...[const SizedBox(height: MmSpace.s4), Text(t, style: type.body)],
          const SizedBox(height: MmSpace.s8),
          Text(e.whyRight ?? e.keyIdea, style: type.body),
        ],
      ),
      _Step(label: FixCopy.oneRule, children: [RuleCard(rule: e.keepLine, animate: false)]),
      _Step(
        label: FixCopy.testIt,
        children: [
          Text(FixCopy.testLead(_offered), style: type.small.copyWith(color: colors.ink2)),
          for (var i = 0; i < _offered; i++)
            if (i == 0 || _slots[0].mark != null || _slots[0].note != null) ...[
              SizedBox(height: i == 0 ? MmSpace.s16 : MmSpace.s32),
              _slot(context, i),
            ],
        ],
      ),
      if (_held != null) ...[
        const SizedBox(height: MmSpace.s32),
        _HeldPanel(held: _held!, line: _heldLine ?? (_held! ? FixCopy.heldFallback : FixCopy.notHeldFallback)),
      ],
      const SizedBox(height: MmSpace.s32),
      Divider(height: 1, thickness: 1, color: colors.line),
      const SizedBox(height: MmSpace.s12),
      // L-06: the fix is written by AI, so it says it can be wrong and can be reported.
      AiExplanationNote(questionId: widget.questionId, surface: 'fix', excerpt: e.whyRight ?? e.keyIdea),
      const SizedBox(height: MmSpace.s8),
      if (FixCopy.chargeLine(r) case final line?) Text(line, style: type.caption.copyWith(color: colors.ink3)),
      const SizedBox(height: MmSpace.s4),
      if (_disputed)
        Text(FixCopy.disputeSent, style: type.caption.copyWith(color: colors.ink2))
      else
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(FixCopy.disputeLead, style: type.caption.copyWith(color: colors.ink3)),
            MmPressable(
              semanticsLabel: FixCopy.disputeKey,
              onTap: _dispute,
              haptic: MmPressHaptic.selection,
              focusRadius: MmRadius.smallAll,
              builder: (context, pressed, _) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: MmTarget.min),
                child: Align(
                  widthFactor: 1,
                  child: Text(
                    FixCopy.disputeKey,
                    style: type.caption.copyWith(
                      color: pressed ? colors.ink3 : colors.ink,
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                      decorationColor: colors.lineStrong,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
    ];
  }

  Widget _slot(BuildContext context, int i) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = _slots[i];
    final q = s.question;
    if (q != null) {
      return CheckCard(
        key: ValueKey('fix-check-$i'),
        number: i + 1,
        of: _offered,
        question: q,
        mark: s.mark,
        marking: s.marking,
        pending: s.pending,
        error: s.error,
        onAnswer: (pick) => _answer(i, pick),
      );
    }
    if (s.note != null) return Text(s.note!, style: type.small.copyWith(color: colors.ink2));
    if (s.error != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(s.error!, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          KeyButton.secondary(label: FixCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: () => _load(i)),
        ],
      );
    }
    return Semantics(liveRegion: true, child: Text(FixCopy.findingCheck, style: type.caption.copyWith(color: colors.ink2)));
  }
}

/// One step of the fix: a quiet label over its words, with room between steps (no boxes, no numbered badges).
class _Step extends StatelessWidget {
  const _Step({required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(label, style: context.mmType.cardTitle)),
          const SizedBox(height: MmSpace.s8),
          ...children,
        ],
      ),
    );
  }
}

class _TrapTag extends StatelessWidget {
  const _TrapTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Align(
      alignment: Alignment.centerLeft,
      child: DecoratedBox(
        decoration: ShapeDecoration(color: colors.sunken, shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 5, 12, 5),
          child: Text(FixCopy.trapIs(label), style: context.mmType.label.copyWith(fontSize: 13, color: colors.ink)),
        ),
      ),
    );
  }
}

/// "This trap has caught you 4 times in 6 chances.": the student's own history with the trap, from Traps you meet.
class _History extends StatelessWidget {
  const _History({required this.line});

  final String line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.history, size: 16, color: colors.ink2)),
        const SizedBox(width: MmSpace.s8),
        Expanded(child: Text(line, style: context.mmType.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600))),
      ],
    );
  }
}

/// The job's verdict: held when both checks are right, said in words with the server's line.
class _HeldPanel extends StatelessWidget {
  const _HeldPanel({required this.held, required this.line});

  final bool held;
  final String line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: held ? Color.alphaBlend(colors.volt.withValues(alpha: colors.isNight ? 0.10 : 0.22), colors.raised) : colors.raised,
          shape: mmShapeBorder(MmRadius.panelAll, side: BorderSide(color: held ? colors.voltEdge : colors.line)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.s16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(held ? LucideIcons.shieldCheck : LucideIcons.repeat, size: 22, color: held ? colors.ink : colors.ink2),
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(held ? FixCopy.held : FixCopy.notHeld, style: type.cardTitle),
                    const SizedBox(height: MmSpace.s4),
                    Text(line, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The words of Fix it for good, in the owner's voice: plain full sentences, no exclamation marks, no arrows.
abstract final class FixCopy {
  static const title = 'Fix it for good';
  static String lead(int? n) => n == null
      ? 'Mobi fixes this mistake for good: why your option looked right, why the key is right, one rule to keep, then 2 fresh questions to test it.'
      : 'Mobi fixes Q$n for good: why your option looked right, why the key is right, one rule to keep, then 2 fresh questions to test it.';

  static const writing = 'Mobi is writing your fix.';
  static const writingNote = 'It can take up to a minute. If it fails, nothing is charged.';
  static const nothingCharged = 'Nothing was charged.';
  static const tryAgain = 'Try again';
  static const noCredits = 'You have no credits left, so Mobi cannot write this fix. A fix uses 1 credit.';
  static const failed = 'Mobi could not write this fix just now.';

  /// The answer did not reach the phone, so whether the fix was written (and charged) is not known.
  static const lost = 'Your fix did not reach this phone.';

  /// L-11: what trying again does when the outcome is not known. A fix that was written is stored and opens free.
  static const unknownNote = 'Try again. If Mobi wrote it, it opens free, because a fix is charged only once.';

  /// True when the server never said what happened: no answer (offline, a timeout), a server failure with no charge
  /// figure, or an answer the phone could not read. Never "Nothing was charged" or "You are offline" then.
  static bool outcomeUnknown(ApiError? e) {
    if (e == null) return true;
    if (e.chargedNothing) return false;
    return switch (e.kind) {
      ApiErrorKind.network || ApiErrorKind.timeout || ApiErrorKind.server || ApiErrorKind.unavailable || ApiErrorKind.cancelled || ApiErrorKind.unknown => true,
      _ => false,
    };
  }

  static String failure(ApiError? e) {
    if (e != null && (e.kind == ApiErrorKind.paymentRequired || e.hasCode('insufficient_ai_credits'))) return noCredits;
    if (e != null && e.chargedNothing) return e.serverMessage ?? failed;
    if (outcomeUnknown(e)) return lost;
    return e?.serverMessage ?? failed;
  }

  static const heldForRecheck = 'This question is being checked again, so Mobi is not fixing it yet.';
  static const notExplained = 'Mobi could not write a fix it trusts for this question.';

  static const yourOption = 'Your option';
  static String youPicked(String letter) => 'You picked $letter.';
  static String trapIs(String label) => 'The trap: ${label[0].toLowerCase()}${label.substring(1)}';
  static const whyLookedRight = 'Why it looked right';
  static const whyKeyRight = 'Why the key is right';
  static String keyIs(String letter) => 'The key is $letter.';
  static const oneRule = 'One rule to keep';
  static const testIt = 'Test the fix';
  static String testLead(int n) => n == 2
      ? 'Two questions on the same idea that you have not seen. They come with this fix, so they use no extra credit.'
      : 'One question on the same idea that you have not seen. It comes with this fix, so it uses no extra credit.';
  static const findingCheck = 'Finding a question you have not seen.';

  static const held = 'Fixed for good';
  static const notHeld = 'Not held yet';
  static const heldFallback = 'Both checks right. Revise brings it back in a few days to keep it.';
  static const notHeldFallback = 'One check slipped. Revise brings this mistake back, so you can try it again.';

  /// What this fix cost, as the server reported it.
  static String? chargeLine(RepairResponse r) => switch (r.charged) {
        0 => r.status == RepairStatus.stored ? 'This fix was already written, so it opened free.' : 'This fix used no credit.',
        1 => 'This fix used 1 credit.',
        final int n => 'This fix used $n credits.',
        null => null,
      };

  static const disputeLead = 'Think the key is wrong? ';
  static const disputeKey = 'Tell us. A dispute is free.';
  static const disputeReason = 'The answer key is wrong';
  static const disputeSent = 'Sent. The key is checked again, and a dispute never uses a credit.';
  static const disputeFailed = 'That did not reach us. Try again in a moment. Nothing was charged.';
}

abstract final class CheckCopyFix {
  static const loadFailed = 'The question could not be loaded. Nothing was charged.';
  static const markFailed = 'We could not confirm the mark. Tap Check my answer again. It counts once.';
}
