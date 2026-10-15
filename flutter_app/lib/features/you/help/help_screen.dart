import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/action_router.dart';
import '../../../core/router/external_link_opener.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_motion.dart' show YouMobi;
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';

/// Help and about: the support address (always on screen as text, so nothing depends on an email
/// app), the two policies, and About, which is where the non-affiliation statement and the
/// official sources live (brief section 8).
class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  /// Mobi waves hello the first time Help opens today, then he is simply there (sleepy late at
  /// night). His taps play the app's one tap cycle.
  late final MobiAct _entrance = MobiRation.greeting('help');
  final MobiController _mobi = MobiController();
  String? _notice;
  bool _noticeIsError = false;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  Future<void> _email() async {
    final ok = await ref.read(supportMailerProvider).compose();
    if (!mounted) return;
    // He shrugs once if no mail app opened; a mail that opened needs no reaction (the student
    // has left for it).
    if (!ok) _mobi.react(MobiMoments.act(MobiEvent.saveFailed), key: 'help:mail');
    setState(() {
      _notice = ok ? null : YouCopy.helpMailFailed;
      _noticeIsError = !ok;
    });
  }

  Future<void> _copy() async {
    await ref.read(supportMailerProvider).copyAddress();
    if (!mounted) return;
    _mobi.react(MobiMoments.act(MobiEvent.saveConfirmed), key: 'help:copy');
    setState(() {
      _notice = YouCopy.helpCopied;
      _noticeIsError = false;
    });
  }

  Future<void> _open(String path) async {
    final target = ActionRouter.resolve(path);
    if (target is! ExternalTarget) return;
    final ok = await ref.read(externalLinkOpenerProvider).open(target.uri);
    if (!mounted) return;
    if (!ok) _mobi.react(MobiMoments.act(MobiEvent.setback), key: 'help:open');
    setState(() {
      _notice = ok ? null : YouCopy.toolOpenFailed;
      _noticeIsError = !ok;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final version = ref.watch(appVersionProvider).value;

    return YouPage(
      title: YouCopy.helpTitle,
      children: [
        const SizedBox(height: MmSpace.s8),
        YouPanel(
          children: [
            Padding(
              padding: const EdgeInsets.all(MmSpace.s20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      // Mobi is the face of the mail: a person, not a ticket queue, reads it.
                      YouMobi(size: 56, controller: _mobi, entrance: _entrance, seed: 53),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(child: Text(YouCopy.helpContact, style: type.title)),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s12),
                  Text(YouCopy.helpContactNote, style: type.body.copyWith(color: colors.ink2)),
                  const SizedBox(height: MmSpace.s12),
                  SelectableText(YouCopy.supportEmail, style: type.labelLarge.copyWith(fontSize: 17)),
                  const SizedBox(height: MmSpace.s16),
                  if (_notice != null) ...[
                    if (_noticeIsError)
                      InlineBanner(message: _notice!, tone: BannerTone.warning)
                    else
                      Semantics(liveRegion: true, child: ReceiptLine(text: _notice!)),
                    const SizedBox(height: MmSpace.s16),
                  ],
                  KeyButton(label: YouCopy.helpEmail, onPressed: _email),
                  const SizedBox(height: MmSpace.s4),
                  Align(child: KeyButton.quiet(label: YouCopy.helpCopy, onPressed: _copy)),
                ],
              ),
            ),
          ],
        ),
        const GroupHeading(YouCopy.helpPolicies),
        YouPanel(
          inset: MmSpace.gutter + 48,
          children: [
            YouRow(icon: LucideIcons.shieldCheck, title: YouCopy.helpPrivacyPolicy, external: true, onTap: () => _open('/privacy')),
            YouRow(icon: LucideIcons.fileText, title: YouCopy.helpTerms, external: true, onTap: () => _open('/terms')),
          ],
        ),
        const GroupHeading(YouCopy.aboutHeading),
        YouPanel(
          children: [
            Padding(
              padding: const EdgeInsets.all(MmSpace.s20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // The wordmark alone: a "mo" tile beside it read as "mo mockmob".
                  ExcludeSemantics(child: Wordmark(height: 26, color: colors.ink)),
                  const SizedBox(height: MmSpace.s16),
                  Text(YouCopy.helpNonAffiliation, style: type.body.copyWith(color: colors.ink2)),
                  if (version != null) ...[
                    const SizedBox(height: MmSpace.s12),
                    Text(YouCopy.helpVersion(version), style: type.caption.copyWith(color: colors.ink3)),
                  ],
                ],
              ),
            ),
          ],
        ),
        const GroupHeading(YouCopy.sourcesHeading),
        const YouPanel(
          children: [
            _Source(YouCopy.sourceExam, YouCopy.sourceExamFrom),
            _Source(YouCopy.sourceCourses, YouCopy.sourceCoursesFrom),
            _Source(YouCopy.sourceScores, YouCopy.sourceScoresFrom),
          ],
        ),
      ],
    );
  }
}

/// One official source: what it is used for, then where it comes from. Selectable, never a link
/// out of the app.
class _Source extends StatelessWidget {
  const _Source(this.what, this.from);

  final String what;
  final String from;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(what, style: type.small.copyWith(color: colors.ink3)),
          const SizedBox(height: 2),
          SelectableText(from, style: type.labelLarge.copyWith(color: colors.ink)),
        ],
      ),
    );
  }
}
