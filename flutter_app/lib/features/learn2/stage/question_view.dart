/// A question on the study stage (the web's `QuestionView`, `Stem`, `Options`, `Verdict`, `LineInPlace`; BUILD-1101 B1,
/// B7; A1 3.5; A8 3.1, 3.3): on the canvas, top-aligned, graded by the server (no key on the phone before the answer).
///
///   head      "Question 2 of 5" (13 semibold ink-3), or an old mistake's own head in ink-2
///   stem      set by its shape: Assertion and Reason as two labelled parts, List-I and List-II as two lists,
///             Statement I, II, III as a list, inline steps as a list, else plain (Hanken 20/1.42; over 200
///             characters 18/1.45; 19 and 17.5 under 380 dp wide)
///   options   rows (radius 16, 1 dp strong line, raised, at least 56 dp): a 30 dp letter tile, the words, a 20 dp mark.
///             They answer once (the first tap locks them). Pending: a spinner in the chosen row's mark. Right: the row
///             fills volt with volt ink, settles from 1.04 in 200 ms, a check, and the confirm haptic. Wrong: the bad
///             wash and line, an X, a 4 dp shake twice in 240 ms, no haptic; the right row is outlined in the select
///             colour; the rest recede by colour (ink-3, the hairline, no fill)
///   verdict   "Right." / "Right. 4 in a row." (from 3) / the server's fixed text / "Not quite. The answer is B."
///   the line  after a wrong answer, "The line you needed" opens in place under the verdict (height and opacity, 240 ms
///             after 180 ms): NCERT's line with the key words marked and its source; locked: the server's words and
///             "See Pro"; no card: "Why" and the explanation. Nothing covers the options. The chosen row then scrolls
///             to 12 dp under the top of the page.
///   states    [QuestionView.skipped] replaces the options with its line (a 409); [QuestionView.locked] shows them
///             answering nothing with its line under them (a closed run); [QuestionView.error] is said under them.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/mm_spinner.dart';
import '../../../core/widgets/pressable.dart';
import '../../keycards/data/keycards_models.dart';
import 'stage_keys.dart';
import 'stage_motion.dart';
import 'stage_ncert.dart';
import 'stage_text.dart';

/// The line the server sends with a wrong answer: a linked [card], or [locked] with its [text] (Free), or neither
/// (then the explanation stands in).
@immutable
class StageLine {
  const StageLine({this.card, this.locked = false, this.text});

  final KeyCard? card;
  final bool locked;
  final String? text;
}

/// The server's grade of an answer.
@immutable
class StageResult {
  const StageResult({required this.correct, required this.key, this.line, this.explanation, this.fixedText});

  final bool correct;

  /// The right option's key.
  final String key;
  final StageLine? line;
  final String? explanation;

  /// An old mistake answered right: "Right this time. Back on Wed to check it held."
  final String? fixedText;
}

/// An answer: [choice] on its way ([result] null), or graded.
@immutable
class StageAnswer {
  const StageAnswer.pending(this.choice) : result = null;
  const StageAnswer.graded(this.choice, StageResult this.result);

  final String choice;
  final StageResult? result;

  bool get pending => result == null;
}

/// How one option row stands.
enum StageOptionState { idle, pending, right, wrong, key, rest }

class QuestionView extends StatefulWidget {
  const QuestionView({
    super.key,
    required this.head,
    required this.stem,
    required this.options,
    this.mistake = false,
    this.answer,
    this.streak = 0,
    this.skipped,
    this.locked,
    this.error,
    this.onChoose,
    this.onSeePro,
  });

  final String head;

  /// An old mistake: the head reads in ink-2.
  final bool mistake;
  final String stem;

  /// As served; drawn A, B, C...
  final List<StageOption> options;
  final StageAnswer? answer;

  /// Right answers in a row, this one included ("Right. 4 in a row." from 3).
  final int streak;

  /// The item was left out (a 409): this line stands in place of the options.
  final String? skipped;

  /// The run is closed: the options answer nothing and this line says why.
  final String? locked;

  /// "That answer was not saved. Try again."; the options answer again.
  final String? error;
  final ValueChanged<String>? onChoose;

  /// "See Pro" in a locked line.
  final VoidCallback? onSeePro;

  @override
  State<QuestionView> createState() => _QuestionViewState();
}

class _QuestionViewState extends State<QuestionView> {
  // By position, so a bank that repeats a key can never give two rows one key.
  final Map<int, GlobalKey> _rows = {};
  String? _tapped;
  Timer? _scroll;
  String? _scrollTo;

  GlobalKey _rowKey(int index) => _rows.putIfAbsent(index, GlobalKey.new);

  @override
  void didUpdateWidget(QuestionView old) {
    super.didUpdateWidget(old);
    // An answer that came back (an error, a refusal) frees the rows again.
    if ((old.answer != null && widget.answer == null) || widget.error != old.error) _tapped = null;
    final was = old.answer?.result;
    final now = widget.answer?.result;
    if (now != null && was == null) {
      if (now.correct) {
        hapticsOf(context)?.confirm();
      } else {
        _scrollTo = widget.answer!.choice;
        _scroll?.cancel();
        _scroll = Timer(const Duration(milliseconds: 300), _scrollChosen);
      }
    }
  }

  @override
  void dispose() {
    _scroll?.cancel();
    super.dispose();
  }

  void _choose(String key) {
    if (_tapped != null || widget.answer != null || widget.locked != null) return;
    setState(() => _tapped = key);
    widget.onChoose?.call(key);
  }

  /// The chosen row to 12 dp under the top of its page, so the pick, the verdict and the line read together (M2).
  void _scrollChosen() {
    final choice = _scrollTo;
    if (!mounted || choice == null) return;
    final index = widget.options.indexWhere((o) => o.key == choice);
    final rowContext = index < 0 ? null : _rows[index]?.currentContext;
    if (rowContext == null) return;
    final box = rowContext.findRenderObject();
    final scrollable = Scrollable.maybeOf(rowContext);
    if (box is! RenderBox || !box.attached || scrollable == null) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    final position = scrollable.position;
    if (viewport == null || !position.hasContentDimensions) return;
    final target = (viewport.getOffsetToReveal(box, 0).offset - 12).clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() < 1) return;
    if (Motion.reduced(context)) {
      position.jumpTo(target);
    } else {
      unawaited(position.animateTo(target, duration: const Duration(milliseconds: 320), curve: Motion.drawer));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final res = widget.answer?.result;
    final texts = StageText.optionTexts(widget.options);
    final pending = widget.answer?.pending ?? false;
    final off = res != null || pending || widget.locked != null;
    final width = MediaQuery.sizeOf(context).width;
    final children = <Widget>[
      Text(widget.head, style: type.label.copyWith(fontSize: 13, height: 1.35, color: widget.mistake ? colors.ink2 : colors.ink3)),
      StageStem(text: widget.stem, width: width),
    ];
    if (widget.skipped != null) {
      children.add(_LeftOut(text: widget.skipped!));
    } else {
      children.add(
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s8),
          child: Semantics(
            container: true,
            explicitChildNodes: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (i, o) in widget.options.indexed) ...[
                  if (i > 0) const SizedBox(height: 10),
                  StageOptionRow(
                    key: _rowKey(i),
                    letter: StageText.letterAt(i, o.key),
                    text: texts[i],
                    state: _stateOf(o.key, res, pending),
                    chosen: widget.answer?.choice == o.key,
                    narrow: width < 380,
                    onTap: off || _tapped != null ? null : () => _choose(o.key),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
      if (widget.locked != null && res == null) children.add(_LeftOut(text: widget.locked!));
      if (res != null) {
        children.add(
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s4),
            child: StageVerdict(result: res, letter: StageText.letterOf(widget.options, res.key), streak: widget.streak),
          ),
        );
      }
      final line = res != null && !res.correct;
      children.add(
        StageReveal(
          open: line,
          onOpened: _scrollChosen,
          child: line ? StageLineBlock(result: res, onSeePro: widget.onSeePro) : const SizedBox(width: double.infinity),
        ),
      );
    }
    if (widget.error != null) {
      children.add(
        Semantics(
          liveRegion: true,
          child: Text(widget.error!, style: type.label.copyWith(fontSize: 14, height: 1.5, color: colors.badText)),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, c) in children.indexed) ...[
          if (i > 0) const SizedBox(height: MmSpace.s12),
          c,
        ],
      ],
    );
  }

  StageOptionState _stateOf(String key, StageResult? res, bool pending) {
    final chosen = widget.answer?.choice == key;
    if (res == null) return pending && chosen ? StageOptionState.pending : StageOptionState.idle;
    if (res.key == key) return chosen ? StageOptionState.right : StageOptionState.key;
    return chosen ? StageOptionState.wrong : StageOptionState.rest;
  }
}

/// A left-out or closed line: 15/1.5 ink-2.
class _LeftOut extends StatelessWidget {
  const _LeftOut({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 440),
      child: Text(text, style: context.mmType.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: context.mmColors.ink2)),
    );
  }
}

/// The stem as its shape asks (the web's `Stem`).
class StageStem extends StatelessWidget {
  const StageStem({super.key, required this.text, this.width});

  final String text;

  /// The screen's width (under 380 dp the stem is a step smaller); null reads it from the screen.
  final double? width;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final narrow = (width ?? MediaQuery.sizeOf(context).width) < 380;
    final long = StageText.stemSize(text) == 'l';
    final stem = type.body.copyWith(
      fontSize: long ? (narrow ? 17.5 : 18) : (narrow ? 19 : 20),
      height: long ? 1.45 : 1.42,
      fontWeight: FontWeight.w600,
      color: colors.ink,
    );
    final small = type.label.copyWith(fontSize: 13, height: 1.3, fontWeight: FontWeight.w700, color: colors.ink3);
    final listText = type.body.copyWith(fontSize: 16, height: 1.45, fontWeight: FontWeight.w400, color: colors.ink);

    final ar = StageText.assertionReason(text);
    if (ar != null) {
      Widget part(String name, String words) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(name, style: small),
          const SizedBox(height: 2),
          Text(words, style: stem, semanticsLabel: '$name. $words'),
        ],
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [part('Assertion', ar.assertion), const SizedBox(height: 10), part('Reason', ar.reason)],
      );
    }

    final lists = StageText.matchLists(text);
    if (lists != null) {
      Widget list(String name, List<StageListItem> rows) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(name, style: small),
          const SizedBox(height: 4),
          _Steps(rows: rows, style: listText, labelStyle: listText.copyWith(color: colors.ink3, fontWeight: FontWeight.w600), gap: 6),
        ],
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (lists.lead.isNotEmpty) Text(lists.lead, style: stem),
          const SizedBox(height: 10),
          list('List-I', lists.one),
          const SizedBox(height: 12),
          list('List-II', lists.two),
          const SizedBox(height: 4),
          if (lists.tail.isNotEmpty) ...[const SizedBox(height: 6), Text(lists.tail, style: stem)],
        ],
      );
    }

    final statements = StageText.statementList(text);
    if (statements != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (statements.lead.isNotEmpty) Text(statements.lead, style: stem),
          const SizedBox(height: 10),
          for (final (i, s) in statements.items.indexed) ...[
            if (i > 0) const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 36,
                  child: ExcludeSemantics(child: Text(s.label, style: listText.copyWith(color: colors.ink3, fontWeight: FontWeight.w600))),
                ),
                Expanded(child: Text(s.text, style: listText, semanticsLabel: 'Statement ${s.label}. ${s.text}')),
              ],
            ),
          ],
          const SizedBox(height: 4),
          if (statements.tail.isNotEmpty) ...[const SizedBox(height: 6), Text(statements.tail, style: stem)],
        ],
      );
    }

    final parts = StageText.stemParts(text);
    if (parts != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (parts.lead.isNotEmpty) Text(parts.lead, style: stem),
          const SizedBox(height: 6),
          _Steps(rows: parts.steps, style: stem, labelStyle: stem.copyWith(color: colors.ink3), gap: 6),
          if (parts.tail.isNotEmpty) ...[const SizedBox(height: 6), Text(parts.tail, style: stem)],
        ],
      );
    }

    return Semantics(header: true, child: Text(text, style: stem));
  }
}

/// Lettered rows: "(A)" in a 2.2 em column, then the words.
class _Steps extends StatelessWidget {
  const _Steps({required this.rows, required this.style, required this.labelStyle, required this.gap});

  final List<StageListItem> rows;
  final TextStyle style;
  final TextStyle labelStyle;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final em = MediaQuery.textScalerOf(context).scale(style.fontSize ?? 16);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, r) in rows.indexed) ...[
          if (i > 0) SizedBox(height: gap),
          MergeSemantics(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 2.2 * em, child: Text('(${r.label})', style: labelStyle, softWrap: false, overflow: TextOverflow.visible)),
                Expanded(child: Text(r.text, style: style)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// One option row (the web's `.st-opt`).
class StageOptionRow extends StatefulWidget {
  const StageOptionRow({
    super.key,
    required this.letter,
    required this.text,
    required this.state,
    this.chosen = false,
    this.narrow = false,
    this.onTap,
  });

  final String letter;
  final String text;
  final StageOptionState state;
  final bool chosen;

  /// Under 380 dp wide the words are 15.5 rather than 16.
  final bool narrow;

  /// Null while the row answers nothing (graded, pending, locked).
  final VoidCallback? onTap;

  @override
  State<StageOptionRow> createState() => _StageOptionRowState();
}

class _StageOptionRowState extends State<StageOptionRow> with SingleTickerProviderStateMixin {
  late final AnimationController _settle = AnimationController(vsync: this, duration: const Duration(milliseconds: 200), value: 1);
  final ValueNotifier<int> _shake = ValueNotifier(0);

  @override
  void didUpdateWidget(StageOptionRow old) {
    super.didUpdateWidget(old);
    if (widget.state == old.state) return;
    if (widget.state == StageOptionState.right && !Motion.reduced(context)) _settle.forward(from: 0);
    if (widget.state == StageOptionState.wrong) _shake.value++;
  }

  @override
  void dispose() {
    _settle.dispose();
    _shake.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final s = widget.state;
    final select = stageSelect(colors);
    final (fill, border, ink) = switch (s) {
      StageOptionState.right => (colors.volt, colors.volt, colors.voltInk),
      StageOptionState.wrong => (colors.wrongSurface, colors.badText, colors.ink),
      StageOptionState.key => (colors.raised, select, colors.ink),
      StageOptionState.rest => (colors.raised.withValues(alpha: 0), colors.line, colors.ink3),
      _ => (colors.raised, colors.lineStrong, colors.ink),
    };
    final tileFill = s == StageOptionState.right ? colors.voltInk.withValues(alpha: 0.12) : colors.raised2;
    final tileInk = s == StageOptionState.right ? colors.voltInk : colors.ink2;
    final fade = Motion.of(context, const Duration(milliseconds: 150));
    final inkFade = Motion.of(context, const Duration(milliseconds: 250));
    final Widget mark = switch (s) {
      StageOptionState.pending => MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2.2),
      StageOptionState.right => Icon(LucideIcons.check, size: 18, color: colors.voltInk),
      StageOptionState.key => Icon(LucideIcons.check, size: 18, color: colors.accentText),
      StageOptionState.wrong => Icon(LucideIcons.x, size: 18, color: colors.badText),
      _ => const SizedBox.shrink(),
    };
    final r = BorderRadius.circular(16);
    Widget row(bool pressed) => AnimatedContainer(
      duration: fade,
      curve: Motion.out,
      constraints: const BoxConstraints(minHeight: 56),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: r,
        border: Border.all(color: border),
      ),
      // The key row's outline is the line plus a second one inside it: 1 + 1 dp in the select colour.
      foregroundDecoration: s == StageOptionState.key
          ? BoxDecoration(borderRadius: r, border: Border.all(color: select, width: 2))
          : null,
      child: Row(
        children: [
          Opacity(
            opacity: s == StageOptionState.rest ? 0.7 : 1,
            child: AnimatedContainer(
              duration: fade,
              curve: Motion.out,
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: tileFill, borderRadius: BorderRadius.circular(9)),
              child: Text(widget.letter, style: type.label.copyWith(fontSize: 13, height: 1, fontWeight: FontWeight.w700, color: tileInk)),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: AnimatedDefaultTextStyle(
              duration: inkFade,
              curve: const Interval(0.36, 1, curve: Motion.out),
              style: type.body.copyWith(fontSize: widget.narrow ? 15.5 : 16, height: 1.4, fontWeight: FontWeight.w500, color: ink),
              child: Text(widget.text),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          SizedBox(width: 20, child: Center(child: mark)),
        ],
      ),
    );
    final settled = AnimatedBuilder(
      animation: _settle,
      builder: (context, child) {
        final v = _settle.value;
        if (v >= 1) return child!;
        return Transform.scale(scale: 1.04 - 0.04 * Motion.out.transform(v), child: child);
      },
      child: MmShake(
        pulse: _shake,
        haptic: false,
        size: 4,
        cycles: 2,
        length: const Duration(milliseconds: 240),
        child: MmPressable(
          onTap: widget.onTap,
          pressedScale: 0.985,
          lift: false,
          haptic: MmPressHaptic.selection,
          focusRadius: r,
          semanticsLabel: 'Option ${widget.letter}. ${widget.text}',
          selected: widget.chosen,
          builder: (context, pressed, focused) => row(pressed),
        ),
      ),
    );
    return settled;
  }
}

/// The verdict line under the options (15 semibold, an 18 dp icon), arriving 120 ms after the grade.
class StageVerdict extends StatelessWidget {
  const StageVerdict({super.key, required this.result, required this.letter, this.streak = 0});

  final StageResult result;

  /// The right option's letter as drawn.
  final String letter;
  final int streak;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.body.copyWith(fontSize: 15, height: 1.45, fontWeight: FontWeight.w600, color: colors.ink);
    final Widget words;
    if (result.correct) {
      final fixed = result.fixedText;
      if (fixed != null && fixed.isNotEmpty) {
        words = Text(fixed, style: style);
      } else if (streak >= 3) {
        words = Text.rich(
          TextSpan(
            style: style,
            children: [
              const TextSpan(text: 'Right. '),
              WidgetSpan(
                alignment: PlaceholderAlignment.baseline,
                baseline: TextBaseline.alphabetic,
                child: ClipRect(child: StageCount(value: streak, child: Text('$streak', style: style))),
              ),
              const TextSpan(text: ' in a row.'),
            ],
          ),
          semanticsLabel: 'Right. $streak in a row.',
        );
      } else {
        words = Text('Right.', style: style);
      }
    } else {
      words = Text('Not quite. The answer is $letter.', style: style);
    }
    return StageIn(
      delay: const Duration(milliseconds: 120),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(result.correct ? LucideIcons.check : LucideIcons.x, size: 18, color: result.correct ? colors.goodText : colors.badText),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(child: words),
        ],
      ),
    );
  }
}

/// The line you needed, as a block (the web's `.st-line`): radius 16, a 1 dp hairline, raised, 14/16 padding.
class StageLineBlock extends StatelessWidget {
  const StageLineBlock({super.key, required this.result, this.onSeePro});

  final StageResult result;
  final VoidCallback? onSeePro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final line = result.line;
    final card = line?.card;
    final locked = line?.locked ?? false;
    final title = card != null || locked ? 'The line you needed' : 'Why';
    final quiet = type.body.copyWith(fontSize: 15, height: 1.55, fontWeight: FontWeight.w500, color: colors.ink2);
    final Widget body;
    if (locked) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(line?.text ?? '', style: quiet),
          if (onSeePro != null) ...[const SizedBox(height: 4), StageTextKey(label: 'See Pro', onTap: onSeePro)],
        ],
      );
    } else if (card != null) {
      body = StageNcert(card: card, size: 16.5, height: 1.6);
    } else {
      final why = result.explanation;
      body = Text(why == null || why.trim().isEmpty ? 'The right answer is marked above.' : why, style: quiet);
    }
    return Padding(
      padding: const EdgeInsets.only(top: MmSpace.s4),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Semantics(
            container: true,
            explicitChildNodes: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    title,
                    style: type.title.copyWith(fontSize: 15, height: 1.3, letterSpacing: -0.15, wordSpacing: 0, color: colors.ink),
                  ),
                ),
                const SizedBox(height: 10),
                body,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
