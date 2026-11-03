import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/router/action_router.dart';
import '../../../core/router/external_link_opener.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_providers.dart';

/// Help (spec 5.12.4): the support address, the two policies, the non-affiliation line and the
/// app version. The address is always on screen as text, so nothing depends on an email app.
class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  String? _notice;
  bool _noticeIsError = false;

  Future<void> _email() async {
    final ok = await ref.read(supportMailerProvider).compose();
    if (!mounted) return;
    setState(() {
      _notice = ok ? null : YouCopy.helpMailFailed;
      _noticeIsError = !ok;
    });
  }

  Future<void> _copy() async {
    await ref.read(supportMailerProvider).copyAddress();
    if (!mounted) return;
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
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(YouCopy.helpContact, style: type.title),
              const SizedBox(height: MmSpace.s8),
              Text(YouCopy.helpContactNote, style: type.body.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s12),
              SelectableText(YouCopy.supportEmail, style: type.subhead),
              const SizedBox(height: MmSpace.s16),
              if (_notice != null) ...[
                if (_noticeIsError)
                  InlineBanner(message: _notice!, tone: BannerTone.warning)
                else
                  Semantics(liveRegion: true, child: ReceiptLine(text: _notice!)),
                const SizedBox(height: MmSpace.s16),
              ],
              KeyButton(label: YouCopy.helpEmail, onPressed: _email),
              const SizedBox(height: MmSpace.s8),
              Align(child: KeyButton.quiet(label: YouCopy.helpCopy, onPressed: _copy)),
            ],
          ),
        ),
        const GroupHeading(YouCopy.helpPolicies),
        YouRow(icon: LucideIcons.shieldCheck, title: YouCopy.helpPrivacyPolicy, external: true, onTap: () => _open('/privacy')),
        YouRow(icon: LucideIcons.fileText, title: YouCopy.helpTerms, external: true, onTap: () => _open('/terms')),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.group, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(YouCopy.helpNonAffiliation, style: type.small.copyWith(color: colors.ink2)),
              if (version != null) ...[
                const SizedBox(height: MmSpace.s8),
                Text(YouCopy.helpVersion(version), style: type.small.copyWith(color: colors.ink2)),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
