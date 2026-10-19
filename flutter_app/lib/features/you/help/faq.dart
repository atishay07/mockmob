import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../widgets/you_motion.dart' show YouSizeEase;
import '../widgets/you_page.dart' show youText;

/// One question on Help and its answer, in the plain words a Class 12 student uses. Each is
/// written from what the app really does; nothing here is a promise the app does not keep.
class FaqItem {
  const FaqItem({
    required this.id,
    required this.question,
    required this.answer,
  });

  /// The key `/you/help?q=<id>` opens expanded.
  final String id;
  final String question;

  /// One paragraph per entry.
  final List<String> answer;
}

abstract final class FaqCopy {
  static const heading = 'Common questions';

  static const credits = FaqItem(
    id: 'credits',
    question: 'How do credits work?',
    answer: [
      'One balance pays for everything: practice sets, full mocks, Ask Mobi replies and repair explanations. Every account gets 50 free credits each month, and they are used first. They refill to 50 at the start of every month, so unused free credits do not carry over.',
      '1 credit buys 1 practice question or 1 Ask Mobi reply. A full mock costs 50, and your first one in each subject is free. The cost shows before you start.',
      'On Pro, practice is unlimited. Your credits still count for Ask Mobi and repairs.',
    ],
  );

  static const history = FaqItem(
    id: 'history',
    question: 'How do I see what I have used?',
    answer: [
      'Tap your picture at the top left of any tab, then a credit tile. Every line says which credits it used, how many, and how many are left.',
    ],
  );

  static const nta = FaqItem(
    id: 'nta',
    question: 'What is NTA mode?',
    answer: [
      'NTA mode sets a paper out like the real CUET screen. The question palette, Mark for Review and the timer look and behave as they do on exam day.',
      'Nothing else appears while the paper runs. Your result, review and repair come after you submit.',
    ],
  );

  static const studyDays = FaqItem(
    id: 'study-days',
    question: 'What counts as a study day?',
    answer: [
      'A study day is any day you answer at least 5 questions in a practice or a mock, or finish a repair. Your weekly goal is how many study days you aim for in a week.',
      'The weekdays you plan are your own and stay on this phone. MockMob counts only the days that meet that rule. Going away? Pause study days and your run is kept.',
    ],
  );

  static const signIn = FaqItem(
    id: 'sign-in',
    question: 'I cannot sign in. What can I do?',
    answer: [
      'Choose Email code. We send an 8-digit code to your address, and it works even when Google does not. Not there? Check your spam folder.',
      'If Google opens the MockMob website instead of the app, close the browser and sign in here with an email code. Forgot your password? Use an email code, then set a new one.',
      'Still stuck? Write to support@mockmob.in from your account address.',
    ],
  );

  static const offline = FaqItem(
    id: 'offline',
    question: 'What happens to my answers if I lose connection?',
    answer: [
      'They stay on this phone and send when you are back online. Signing out warns you first if anything has not been sent.',
    ],
  );

  static const all = [credits, history, nta, studyDays, signIn, offline];

  /// The four most asked. Help shows every question; this short list is for a screen with room for four.
  static const quick = [credits, nta, studyDays, signIn];
}

/// The questions as an accordion: one open at a time, each question a 56 dp row that opens its
/// answer under it (a height ease and a turning chevron; instant under reduced motion). [openId]
/// starts one open.
class FaqList extends StatefulWidget {
  const FaqList({super.key, this.items = FaqCopy.all, this.openId});

  final List<FaqItem> items;
  final String? openId;

  @override
  State<FaqList> createState() => _FaqListState();
}

class _FaqListState extends State<FaqList> {
  late String? _open = widget.openId;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: youText),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.symmetric(horizontal: BorderSide(color: colors.line)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < widget.items.length; i++) ...[
              if (i > 0)
                SizedBox(height: 1, child: ColoredBox(color: colors.line)),
              _FaqRow(
                item: widget.items[i],
                open: _open == widget.items[i].id,
                onToggle: () => setState(
                  () => _open = _open == widget.items[i].id
                      ? null
                      : widget.items[i].id,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FaqRow extends StatelessWidget {
  const _FaqRow({
    required this.item,
    required this.open,
    required this.onToggle,
  });

  final FaqItem item;
  final bool open;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          onTap: onToggle,
          haptic: MmPressHaptic.selection,
          semanticsLabel: '${item.question}. ${open ? 'Open' : 'Closed'}',
          focusRadius: MmRadius.smallAll,
          pressedScale: 0.99,
          builder: (context, pressed, focused) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      item.question,
                      style: type.labelLarge.copyWith(fontSize: 16),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: reduced ? Duration.zero : Motion.ui,
                    curve: Motion.glide,
                    child: Icon(
                      LucideIcons.chevronDown,
                      size: 18,
                      color: colors.ink3,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        YouSizeEase(
          child: open
              ? Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < item.answer.length; i++) ...[
                        if (i > 0) const SizedBox(height: MmSpace.s8),
                        Text(
                          item.answer[i],
                          style: type.body.copyWith(color: colors.ink2),
                        ),
                      ],
                    ],
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}
