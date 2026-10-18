import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart';
import '../../../core/copy/sentences.dart';
import '../../../core/platform/share_image.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/brand/wordmark.dart';
import '../../../core/widgets/key_button.dart';
import '../../../core/widgets/materials/grain.dart';
import '../../../core/widgets/materials/light_field.dart';
import '../../../core/widgets/mm_sheet.dart';
import '../../../core/widgets/monumental_number.dart';
import '../../../core/widgets/mobi.dart' show MobiCharacter;
import '../../../core/mascot/mascot.dart' show MobiAct;

/// What a share card says. Private by default: a count and a date, never marks, chapters or weak
/// areas. The subject is the one optional extra, off until the student turns it on in the preview.
class ShareCardData {
  const ShareCardData({
    required this.kicker,
    required this.number,
    required this.unit,
    required this.dateLine,
    required this.shareText,
    required this.fileName,
    this.subject,
  });

  /// A finished repair: how many mistakes were repaired, and the day.
  factory ShareCardData.repair({required int repaired, required DateTime day, String? subject}) => ShareCardData(
        kicker: 'Mistake repair',
        number: '$repaired',
        unit: 'repaired',
        dateLine: formatDayMonthShort(day),
        shareText: repaired == 1 ? '1 mistake repaired on MockMob.' : '$repaired mistakes repaired on MockMob.',
        fileName: 'mockmob-repair.png',
        subject: subject,
      );

  /// A study week that met its goal: the days studied and the week's dates.
  factory ShareCardData.week({required int studyDays, required DateTime start, required DateTime end}) => ShareCardData(
        kicker: 'Study week',
        number: '$studyDays',
        unit: studyDays == 1 ? 'day' : 'days',
        dateLine: '${formatDayMonthShort(start)} to ${formatDayMonthShort(end)}',
        shareText: studyDays == 1 ? '1 study day this week on MockMob.' : '$studyDays study days this week on MockMob.',
        fileName: 'mockmob-week.png',
      );

  final String kicker;
  final String number;
  final String unit;
  final String dateLine;
  final String shareText;
  final String fileName;

  /// The subject name, shown only when the student asks for it.
  final String? subject;
}

/// The card itself: 360 by 450 logical pixels (a 1080 by 1350 image at 3x), always in the dark
/// brand look, whatever the app theme and text size are, so every share looks the same.
class ShareCard extends StatelessWidget {
  const ShareCard({super.key, required this.data, this.showSubject = false});

  static const Size size = Size(360, 450);

  final ShareCardData data;
  final bool showSubject;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: buildTheme(Brightness.dark),
      child: Builder(
        builder: (context) {
          final colors = context.mmColors;
          final type = context.mmType;
          final subject = showSubject ? data.subject : null;
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling, disableAnimations: true),
            child: SizedBox.fromSize(
              size: size,
              child: Semantics(
                label: joinSentences(['${data.number} ${data.unit}', data.kicker, data.dateLine]),
                excludeSemantics: true,
                child: ColoredBox(
                  color: colors.ground,
                  child: Stack(
                    children: [
                      const Positioned.fill(child: LampScene()),
                      Positioned.fill(child: IgnorePointer(child: Grain(opacity: colors.grain))),
                      Padding(
                        padding: const EdgeInsets.all(MmSpace.s32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Wordmark(height: 26),
                            const Spacer(),
                            Text(data.kicker, style: type.label.copyWith(color: colors.ink2)),
                            const SizedBox(height: MmSpace.s8),
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: MonumentalNumber(value: data.number, unit: data.unit, roll: false),
                            ),
                            if (subject != null) ...[
                              const SizedBox(height: MmSpace.s8),
                              Text(subject, style: type.lead, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ],
                            const SizedBox(height: MmSpace.s8),
                            Text(data.dateLine, style: type.body.copyWith(color: colors.ink2)),
                            const Spacer(),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('mockmob.in', style: type.caption.copyWith(color: colors.ink2)),
                                const Spacer(),
                                const MobiCharacter(size: 96, entrance: MobiAct.rest, shadow: false),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Opens the preview sheet: the card exactly as it will be shared, an optional subject line, and
/// the share key. Nothing leaves the phone until the student taps Share.
Future<void> showShareCardSheet(BuildContext context, {required ShareCardData data}) =>
    showMmSheet<void>(context: context, title: 'Share a card', builder: (_) => ShareCardPreview(data: data));

class ShareCardPreview extends ConsumerStatefulWidget {
  const ShareCardPreview({super.key, required this.data});

  final ShareCardData data;

  @override
  ConsumerState<ShareCardPreview> createState() => _ShareCardPreviewState();
}

class _ShareCardPreviewState extends ConsumerState<ShareCardPreview> {
  final GlobalKey _boundary = GlobalKey();
  bool _showSubject = false;
  bool _busy = false;
  bool _failed = false;

  Future<void> _share() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    final surface = ref.read(shareSurfaceProvider);
    final png = await capturePng(_boundary);
    final shared = png != null && await surface.shareImage(png: png, name: widget.data.fileName, text: widget.data.shareText);
    if (!mounted) return;
    if (shared) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _busy = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final data = widget.data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: MmRadius.keyAll,
                border: Border.all(color: colors.line),
              ),
              child: ClipRRect(
                borderRadius: MmRadius.keyAll,
                child: FittedBox(
                  fit: BoxFit.fitWidth,
                  child: RepaintBoundary(key: _boundary, child: ShareCard(data: data, showSubject: _showSubject)),
                ),
              ),
            ),
          ),
        ),
        if (data.subject != null) ...[
          const SizedBox(height: MmSpace.s12),
          MergeSemantics(
            child: Row(
              children: [
                Expanded(child: Text('Add the subject', style: type.body)),
                Switch(value: _showSubject, onChanged: _busy ? null : (v) => setState(() => _showSubject = v)),
              ],
            ),
          ),
        ],
        if (_failed) ...[
          const SizedBox(height: MmSpace.s8),
          Text('Could not make the card. Try again.', style: type.small.copyWith(color: colors.badText)),
        ],
        const SizedBox(height: MmSpace.s16),
        KeyButton(label: 'Share', onPressed: _busy ? null : () => unawaited(_share()), loading: _busy),
        Align(child: KeyButton.quiet(label: 'Not now', onPressed: () => Navigator.of(context).maybePop())),
      ],
    );
  }
}
