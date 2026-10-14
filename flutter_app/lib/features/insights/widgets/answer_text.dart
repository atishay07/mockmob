import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';

/// A reply split for reading: a short first sentence as the lead, then the rest.
class AnswerParts {
  const AnswerParts({this.lead, required this.body});

  final String? lead;
  final String body;
}

/// Splits [text] into a lead (the first sentence, when it is short and something follows) and a
/// body. A reply that is one sentence or one long paragraph has no lead.
AnswerParts splitAnswer(String text, {bool wantLead = true}) {
  final t = text.trim();
  if (!wantLead) return AnswerParts(body: t);
  final m = RegExp(r'^(.{12,150}?[.?!])\s+(\S.*)$', dotAll: true).firstMatch(t);
  if (m == null) return AnswerParts(body: t);
  return AnswerParts(lead: m.group(1), body: m.group(2)!);
}

const Set<String> _units = {
  'marks', 'mark', 'questions', 'question', 'right', 'wrong', 'blank', 'sessions', 'session', 'changes', 'change', 'minutes', 'seconds',
};

final RegExp _figure = RegExp(r'^[+\-]?\d[\d,.:]*%?[.,;:]?$');

/// One word of a reply with its trailing space, and whether it is a figure to set heavier.
class _Word {
  const _Word(this.text, this.strong);

  final String text;
  final bool strong;
}

List<_Word> _words(String text, {required bool figures}) {
  final tokens = RegExp(r'\S+\s*').allMatches(text).map((m) => m.group(0)!).toList();
  final out = <_Word>[];
  for (var i = 0; i < tokens.length; i++) {
    final core = tokens[i].trim();
    var strong = figures && _figure.hasMatch(core);
    if (figures && !strong && i > 0 && out[i - 1].strong) {
      final unit = core.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
      // "35 marks", "6 right": the unit after a figure is set with it.
      strong = _units.contains(unit);
    }
    out.add(_Word(tokens[i], strong));
  }
  return out;
}

/// A reply, set for reading: the lead in the display face, the body quieter with every figure
/// ("35 marks", "6 right") set heavier. A reply that has just arrived reveals word by word
/// (about 18 ms a word, 900 ms at most); [animate] false, history and reduced motion show it at
/// once. Layout never changes while it reveals: only each word's opacity does.
class AnswerText extends StatefulWidget {
  const AnswerText({super.key, required this.parts, this.animate = false, this.figures = true, this.onRevealed});

  final AnswerParts parts;
  final bool animate;

  /// Set figures heavier (record answers, whose numbers are the point).
  final bool figures;

  /// Called once when the last word is in, so what follows can rise.
  final VoidCallback? onRevealed;

  @override
  State<AnswerText> createState() => _AnswerTextState();
}

class _AnswerTextState extends State<AnswerText> with SingleTickerProviderStateMixin {
  late final List<_Word> _lead = widget.parts.lead == null ? const [] : _words(widget.parts.lead!, figures: false);
  late final List<_Word> _body = _words(widget.parts.body, figures: widget.figures);
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: ((_lead.length + _body.length) * 18).clamp(300, 900)),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!widget.animate || Motion.reduced(context)) {
      _c.value = 1;
      return;
    }
    _c.forward().whenComplete(() {
      if (mounted) widget.onRevealed?.call();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  InlineSpan _spans(List<_Word> words, int offset, double reveal, TextStyle base, TextStyle strong) {
    return TextSpan(
      children: [
        for (var i = 0; i < words.length; i++)
          TextSpan(
            text: words[i].text,
            style: (words[i].strong ? strong : base).copyWith(
              color: (words[i].strong ? strong : base).color!.withValues(alpha: (words[i].strong ? strong : base).color!.a * ((reveal - (offset + i)) / 2.5).clamp(0.0, 1.0)),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final lead = type.title.copyWith(fontSize: 20, height: 25 / 20, color: colors.ink);
    final body = type.body.copyWith(color: colors.ink2);
    final strong = type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w700);
    final total = _lead.length + _body.length;
    final full = '${widget.parts.lead ?? ''} ${widget.parts.body}'.trim();

    return Semantics(
      label: full,
      liveRegion: true,
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final reveal = _c.value >= 1 ? total + 3.0 : Curves.easeOutCubic.transform(_c.value) * (total + 3);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_lead.isNotEmpty) ...[
                Text.rich(_spans(_lead, 0, reveal, lead, lead)),
                const SizedBox(height: MmSpace.s8),
              ],
              Text.rich(_spans(_body, _lead.length, reveal, body, strong)),
            ],
          );
        },
      ),
    );
  }
}
