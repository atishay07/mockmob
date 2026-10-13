import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'nta_integrity.dart' show ntaPrefsProvider;
import 'nta_skin.dart';

/// How NTA mode looks (WEB-PARITY N1): the exam's own paper (the default, what the student will
/// meet on exam day) or the MockMob sheet in the app's theme. The look only: the rules, the
/// clock, the palette and the warnings are the same in both.
enum NtaStyle { nta, mockmob }

class NtaStyleNotifier extends Notifier<NtaStyle> {
  static const String _key = 'nta.style';

  @override
  NtaStyle build() {
    unawaited(_load());
    return NtaStyle.nta;
  }

  Future<void> _load() async {
    try {
      final v = await ref.read(ntaPrefsProvider).getInt(_key);
      if (v != null && ref.mounted && v >= 0 && v < NtaStyle.values.length) state = NtaStyle.values[v];
    } on Object {
      // The exam paper is the default.
    }
  }

  void set(NtaStyle style) {
    if (style == state) return;
    state = style;
    unawaited(ref.read(ntaPrefsProvider).setInt(_key, style.index).catchError((Object _) {}));
  }
}

final ntaStyleProvider = NotifierProvider<NtaStyleNotifier, NtaStyle>(NtaStyleNotifier.new);

/// The exam paper's colours (nta-classic.css): the #EAF0F4 page, white cards on a #C4CFD6
/// hairline, #222222 and #455969 ink, the #2769BD radio. Pinned in Night and Daylight.
abstract final class NtaPaper {
  static final MmColors colors = MmColors.light.copyWith(
    ground: const Color(0xFFEAF0F4),
    raised: const Color(0xFFFFFFFF),
    raised2: const Color(0xFFF4F7F9),
    sunken: const Color(0xFFDDE5EB),
    line: const Color(0xFFC4CFD6),
    lineStrong: const Color(0xFFA3B2BD),
    ink: const Color(0xFF222222),
    ink2: const Color(0xFF455969),
    ink3: const Color(0xFF4F6070),
    ink4: const Color(0xFF8E9DA8),
    accentText: const Color(0xFF2769BD),
    focusRing: const Color(0xFF306A92),
    scrim: const Color(0x66101820),
    optionLip: const Color(0xFFC4CFD6),
    cardShadow: const [],
  );

  static final ThemeData theme = () {
    final base = buildTheme(Brightness.light);
    return base.copyWith(
      scaffoldBackgroundColor: colors.ground,
      canvasColor: colors.ground,
      colorScheme: base.colorScheme.copyWith(surface: colors.raised, onSurface: colors.ink, outline: colors.lineStrong),
      extensions: <ThemeExtension<dynamic>>[colors, MmType.build(colors)],
    );
  }();
}

/// The exam paper's theme in the NTA style, the app's own theme in the MockMob style. Follows a
/// change of style live, so a drawer or page pushed over the runner switches with it.
///
/// The same widgets wrap [child] in both styles, so switching the look only rebuilds it. A
/// different tree would remount the runner under it mid-exam: a new integrity guard (and a false
/// "opened again" warning), immersive mode dropped, and the open drawer tied to a dead screen.
class NtaStyleTheme extends ConsumerWidget {
  const NtaStyleTheme({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final exam = ref.watch(ntaStyleProvider) == NtaStyle.nta;
    return Theme(
      data: exam ? NtaPaper.theme : Theme.of(context),
      child: NtaExamLook(exam: exam, child: child),
    );
  }
}

/// Puts an NTA screen on the exam paper (or leaves it in the app theme in the MockMob style),
/// paints the status bar the exam's blue with light icons, and, while [secure], keeps the paper
/// out of screenshots and the recents preview.
class NtaPaperTheme extends StatelessWidget {
  const NtaPaperTheme({super.key, required this.child, this.secure = false});

  final Widget child;
  final bool secure;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: StatusTint(color: NtaSkin.bar, secure: secure, child: NtaStyleTheme(child: child)),
    );
  }
}

/// "Exam look: NTA | MockMob", on the instructions page and in the palette. The look only.
class NtaStyleSwitch extends ConsumerWidget {
  const NtaStyleSwitch({super.key});

  static const String title = 'Exam look';
  static const String nta = 'NTA';
  static const String mockmob = 'MockMob';
  static const String note = 'Changes the look only. The rules, clock and marking stay the same.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: type.label.copyWith(color: colors.ink)),
        const SizedBox(height: MmSpace.s8),
        MmSegmented<NtaStyle>(
          semanticsLabel: title,
          segments: const [MmSegment(NtaStyle.nta, nta), MmSegment(NtaStyle.mockmob, mockmob)],
          value: ref.watch(ntaStyleProvider),
          onChanged: (s) => ref.read(ntaStyleProvider.notifier).set(s),
        ),
        const SizedBox(height: MmSpace.s6),
        Text(note, style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}
