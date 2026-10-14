// Today's type roles that sit between the shared ones, so no widget here sets a font size of
// its own. Every size is a Today role named for what it does, and nothing is below 12 (the
// floor at 1x; the text scale then only grows it).
import 'package:flutter/painting.dart';

import '../../../core/theme/theme.dart';

extension TodayType on MmType {
  /// The smallest text on Today: 12/16 Hanken. Chart labels, small tags, a split line.
  TextStyle get micro => caption.copyWith(fontSize: 12, height: 16 / 12);

  /// Chart labels that name something (a lane, a flag, a month on the track).
  TextStyle get microStrong => micro.copyWith(fontWeight: FontWeight.w700);

  /// The week's count figure, "1" in "1 of 4 study days": the condensed 40.
  TextStyle get countFigure => figureCompact.copyWith(letterSpacing: -0.5);

  /// A subject on a hero that carries Mobi: a notch under the headline.
  TextStyle get stageSubject => title.copyWith(fontSize: 22, height: 26 / 22);

  /// The line of a stage under the subject: 16/22.
  TextStyle get stageLead => labelLarge.copyWith(fontSize: 16, height: 22 / 16);

  /// What the monumental number means ("to repair tonight").
  TextStyle get stageLabel => title.copyWith(fontSize: 20, height: 24 / 20, letterSpacing: -0.3);

  /// The monumental number: 124 for one or two digits, 112 for more.
  TextStyle stageNumber(String number) =>
      hero.copyWith(fontSize: number.length <= 2 ? 124 : 112, height: number.length <= 2 ? 104 / 124 : 96 / 112);

  /// A paper's marks.
  TextStyle get paperFigure => figureCompact.copyWith(fontSize: 32, height: 1, letterSpacing: -0.3);

  /// A college's closing score.
  TextStyle get scoreFigure => figureCompact.copyWith(fontSize: 28, height: 1);

  /// The weeks to go on the road.
  TextStyle get countdownFigure => figure.copyWith(fontSize: 76, height: 68 / 76);

  /// A pick's number at the head of its row on the college list.
  TextStyle get pickNumber => figureCompact.copyWith(fontSize: 26, height: 1);

  /// A pick's number on the score scale.
  TextStyle get pickMark => figureCompact.copyWith(fontSize: 17, height: 1, letterSpacing: 0);
}
