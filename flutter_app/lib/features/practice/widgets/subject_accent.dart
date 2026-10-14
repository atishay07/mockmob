import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// A subject's identity accent: its own light field's hue, lifted to a tone that reads as a
/// small mark (a bar, a dot, an underline) on Night and on Daylight. Never a button fill and
/// never the only sign of a choice: the volt bubble still marks what is chosen.
Color subjectAccent(String? subjectId, Brightness brightness) {
  final light = SubjectLight.forSubject(subjectId) ?? SubjectLight.language;
  final hsl = HSLColor.fromColor(light.night);
  final night = brightness == Brightness.dark;
  return hsl.withSaturation((hsl.saturation * 1.15).clamp(0.38, 0.62)).withLightness(night ? 0.64 : 0.36).toColor();
}

extension SubjectAccentContext on BuildContext {
  Color subjectAccentOf(String? subjectId) => subjectAccent(subjectId, Theme.of(this).brightness);
}
