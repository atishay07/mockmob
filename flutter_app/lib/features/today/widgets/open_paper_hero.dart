// A paper that is open and that this phone is not running leads Today the way a running one does (v15 walk,
// credits): the credits are already spent, so the one key continues it. It says what the paper is and, when
// the server gave a clock, when it ends; a start nobody ever read says what happened to it. "Not now" lets a
// start nobody read go. Nothing here charges: continuing asks for the same paper again, and the server
// answers with the paper it already has.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/copy.dart' show PracticeCopy;
import '../../practice/data/open_paper.dart' show ContinueFailed, ContinueResult, Continued, OpenPaper;
import '../../practice/widgets/failure_copy.dart' show StartFailureView;
import '../logic/today_model.dart';
import 'hero_stage.dart';

class OpenPaperHeroCard extends StatefulWidget {
  const OpenPaperHeroCard({super.key, required this.hero, required this.onContinue, required this.onOpened, this.onLetGo});

  final OpenPaperHero hero;

  /// Asks for the paper again and says how it went. Null where nothing can (a fixture): the key is off.
  final Future<ContinueResult> Function(OpenPaper paper)? onContinue;

  /// The paper is on the phone: open it.
  final ValueChanged<String> onOpened;

  /// "Not now" for a start nobody read.
  final Future<void> Function(OpenPaper paper)? onLetGo;

  @override
  State<OpenPaperHeroCard> createState() => _OpenPaperHeroCardState();
}

class _OpenPaperHeroCardState extends State<OpenPaperHeroCard> {
  bool _busy = false;
  String? _message;

  Future<void> _continue() async {
    final ask = widget.onContinue;
    if (_busy || ask == null) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    final result = await ask(widget.hero.paper);
    if (!mounted) return;
    switch (result) {
      case Continued(:final sessionId):
        setState(() => _busy = false);
        widget.onOpened(sessionId);
      case ContinueFailed(:final failure, :final message):
        setState(() {
          _busy = false;
          _message = StartFailureView(failure, message: message).text;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final hero = widget.hero;
    final colors = context.mmColors;
    final type = context.mmType;
    final subject = hero.subjectId;
    final art = subject == null ? null : HeroArtView(art: HeroArt.object(subject: subject));
    return HeroStage(
      subjectId: subject,
      art: art,
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Beside the object: the overline and the paper, with no hole.
            Padding(
              padding: EdgeInsets.only(right: art == null ? 0 : heroArtClear - MmSpace.cardPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(hero.overline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600)),
                  const SizedBox(height: MmSpace.s4),
                  // A two-part title ("Mock 8, Accountancy") takes the title cut, so it stays on one line beside
                  // the object (the resume card does the same).
                  Semantics(
                    header: true,
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(hero.title, style: hero.title.contains(' ') ? type.title : type.headline, maxLines: 1, softWrap: false),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: MmSpace.s12),
            Text(hero.line, style: type.body.copyWith(color: colors.ink2)),
            if (_message != null) ...[
              const SizedBox(height: MmSpace.s12),
              Semantics(liveRegion: true, child: Text(_message!, style: type.small.copyWith(color: colors.badText))),
            ],
            const SizedBox(height: MmSpace.s20),
            KeyButton(
              key: const ValueKey('open-paper-continue'),
              label: hero.keyLabel,
              loading: _busy,
              onPressed: widget.onContinue == null || _busy ? null : _continue,
            ),
            if (hero.canLetGo && widget.onLetGo != null)
              Center(
                child: KeyButton.quiet(
                  key: const ValueKey('open-paper-let-go'),
                  label: PracticeCopy.openNotNow,
                  onPressed: _busy ? null : () => widget.onLetGo!(hero.paper),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
