import 'package:flutter/material.dart';

import '../../theme/theme.dart';
import '../controls/segmented.dart';
import 'lab_sections.dart';

/// `/lab` (debug builds only): every Night Sheet foundation component on one long page, in Night
/// or Daylight, for review screenshots. Not linked from anywhere in the app.
class LabScreen extends StatefulWidget {
  const LabScreen({super.key, this.initialBrightness = Brightness.dark});

  final Brightness initialBrightness;

  @override
  State<LabScreen> createState() => _LabScreenState();
}

class _LabScreenState extends State<LabScreen> {
  late Brightness _brightness = widget.initialBrightness;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: buildTheme(_brightness),
      child: Builder(
        builder: (context) {
          final colors = context.mmColors;
          final type = context.mmType;
          return Scaffold(
            backgroundColor: colors.ground,
            body: SafeArea(
              bottom: false,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s64),
                children: [
                  Row(
                    children: [
                      Expanded(child: Text('Design lab', style: type.screenTitle)),
                      SizedBox(
                        width: 180,
                        child: MmSegmented<Brightness>(
                          segments: const [MmSegment(Brightness.dark, 'Night'), MmSegment(Brightness.light, 'Daylight')],
                          value: _brightness,
                          onChanged: (b) => setState(() => _brightness = b),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: MmSpace.s24),
                  for (final section in labSections) ...[
                    LabHeading(section.title),
                    section.builder(context),
                    const SizedBox(height: MmSpace.s32),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A section heading in the lab.
class LabHeading extends StatelessWidget {
  const LabHeading(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: MmSpace.s12),
      child: Text(text, style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink3)),
    );
  }
}
