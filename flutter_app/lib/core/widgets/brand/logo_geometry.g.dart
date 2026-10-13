// GENERATED FILE. DO NOT EDIT BY HAND.
//
// mockmob logo geometry, finalist B "Closing Mobi" (Mobi as the o at index 5 of "mockmob"), written by
// tmp/logo/final-B/make_dart.py from the same geometry as the production SVGs in
// tmp/logo/final-B/svg/ (wordmark-*-{full,small,micro}.svg, icon-*.svg; lib/logo.py + build_final.py).
// Letters: Cabinet Grotesk Black (wght 900) outlines, unaltered (ITF Free Font License 2.0 (Fontshare)); Mobi is an added shape.
// Regenerate: cd tmp/logo/final-B && python make_dart.py   (python make_dart.py --which 1 for Mobi as the first o)
//
// Units: font units (1000 per em). y grows DOWN (canvas convention); the baseline is y = 0 and the
// x-height line is y = -xHeight. Every outline is in its own local coordinates: pen origin at x = 0.
// Place a part in the word by translating it by letterX[index] (or LogoLetter.x / MobiGlyph.x).
// Paths are SVG path strings (absolute M L Q C Z) parsed once on first use; no package dependency.

import 'dart:ui';

/// Which detail master to draw. See [LogoGeometry.detailForMobiPx].
enum LogoDetail {
  /// Inked left eye, empty answer-bubble ring for the right eye, flap cut in the body.
  full,

  /// Both eyes filled (the real mascot), no flap cut.
  small,

  /// Visor only, no eyes, no cut.
  micro,
}

/// One outline: SVG path data in font units, y down, baseline y = 0, local to its part.
class LogoPathData {
  const LogoPathData(this.d, {this.evenOdd = false});

  /// Absolute SVG path commands (M, L, H, V, Q, C, Z).
  final String d;

  /// Fill with [PathFillType.evenOdd] (the ring eye: outer oval plus its hole).
  final bool evenOdd;

  /// A new [Path] in font units, shifted by [offset]. Parsed once, then copied.
  Path toPath([Offset offset = Offset.zero]) {
    final base = _logoPathCache.putIfAbsent(d, () => _parseLogoPath(d));
    final p = base.shift(offset);
    p.fillType = evenOdd ? PathFillType.evenOdd : PathFillType.nonZero;
    return p;
  }
}

/// A letter of the word (font outline, unaltered).
class LogoLetter {
  const LogoLetter({
    required this.char,
    required this.index,
    required this.x,
    required this.advance,
    required this.outline,
    required this.bounds,
  });

  /// The character, e.g. 'm'.
  final String char;

  /// Position in "mockmob" (0 to 6).
  final int index;

  /// Pen x of this letter in the word (font units).
  final double x;

  /// The font's advance width (font units), before tracking and the logo's spacing.
  final double advance;

  /// The outline, local (pen origin at x = 0).
  final LogoPathData outline;

  /// Ink bounds, local (y down).
  final Rect bounds;
}

/// Mobi as the o, at one detail master. Colours: body volt, visor charcoal, eyes warm white.
/// All parts are local to Mobi's pen origin (x = 0 is Mobi's left edge).
class MobiGlyph {
  const MobiGlyph({
    required this.detail,
    required this.x,
    required this.body,
    required this.visor,
    required this.eyeLeft,
    required this.eyeRight,
    required this.eyeRightRing,
    required this.bounds,
    required this.visorRect,
    required this.eyeLeftRect,
    required this.eyeRightRect,
  });

  final LogoDetail detail;

  /// Pen x of Mobi in the word (font units).
  final double x;

  /// The volt folded-paper diamond; at [LogoDetail.full] with the flap cut (one contour).
  final LogoPathData body;

  /// The charcoal visor (a stadium centred on the x-height midline).
  final LogoPathData visor;

  /// The inked left eye (filled oval). Null at [LogoDetail.micro].
  final LogoPathData? eyeLeft;

  /// The right eye as a filled oval (what [LogoDetail.small] draws; at [LogoDetail.full] the filled
  /// version of the ring, e.g. for a bubble-inking animation). Null at [LogoDetail.micro].
  final LogoPathData? eyeRight;

  /// The right eye as an empty answer bubble: outer oval plus hole, even-odd. Only at
  /// [LogoDetail.full], where it replaces [eyeRight] in the static logo.
  final LogoPathData? eyeRightRing;

  /// Body bounds, local.
  final Rect bounds;

  /// Visor, inked-eye and right-eye boxes, local (for blinks, looks and masks).
  final Rect visorRect;
  final Rect? eyeLeftRect;
  final Rect? eyeRightRect;

  /// True when the static logo draws the right eye as a ring.
  bool get rightEyeIsRing => eyeRightRing != null;

  /// The eye paths the static logo draws, in order.
  List<LogoPathData> get drawnEyes => [?eyeLeft, ?(eyeRightRing ?? eyeRight)];
}

/// The logo's geometry. Font units, y down, baseline y = 0.
abstract final class LogoGeometry {
  static const String word = 'mockmob';

  /// Index in [word] of the o that is Mobi (5: finalist B, the second o; 1 would be finalist A).
  static const int mobiIndex = 5;
  static const double unitsPerEm = 1000;
  static const double xHeight = 494;

  /// Height of the b's ascender above the baseline (the tallest point of the word).
  static const double ascender = 670;

  /// The font's own hhea ascender and descender (positive up), for line boxes.
  static const double fontAscender = 870;
  static const double fontDescender = -280;

  /// Mobi's overshoot past the baseline and the x-height line.
  static const double mobiOvershoot = 32.11;
  static const double mobiHeight = 558.22;

  /// Pen x of each of the 7 letters of [word] (index [mobiIndex] is Mobi), spacing included.
  static const List<double> letterX = [0, 865, 1445, 1968, 2549, 3423.22, 3987.35];

  /// Ink bounds of the whole word (y down: top is negative).
  static const Rect wordBounds = Rect.fromLTRB(40, -670, 4544.35, 32.11);

  /// Clear space around the word: 1 x-height on every side.
  static const double clearSpace = 494;

  /// App-icon crop, a square in word units: the "mo" (the m before Mobi, and Mobi) fills
  /// [iconFill] of its width, with the x-height band lifted [iconLift] of the side above centre.
  /// Map it onto the icon tile; draw only [iconM] and Mobi.
  static const Rect iconCrop = Rect.fromLTWH(2416.61, -1083.08, 1723.87, 1723.87);

  /// The same for an Android adaptive-icon foreground (108 dp canvas, "mo" sized to the 72 dp
  /// visible area, inside the 66 dp safe circle).
  static const Rect adaptiveIconCrop = Rect.fromLTWH(1985.64, -1514.05, 2585.81, 2585.81);
  static const double iconFill = 0.80;
  static const double iconLift = 0.015;

  /// Horizontal extent of the "mo" ink in word units (left of the m to right of Mobi).
  static const double moLeft = 2589;
  static const double moRight = 3968.1;

  /// Mobi height in PHYSICAL pixels (logical size x devicePixelRatio) from which each master is used.
  static const double fullFromMobiPx = 96;
  static const double smallFromMobiPx = 11;

  /// The master for a Mobi drawn [mobiPx] physical pixels tall.
  static LogoDetail detailForMobiPx(double mobiPx) => mobiPx >= fullFromMobiPx
      ? LogoDetail.full
      : (mobiPx >= smallFromMobiPx ? LogoDetail.small : LogoDetail.micro);

  /// The master for the word drawn at [scale] physical pixels per font unit.
  static LogoDetail detailForScale(double scale) => detailForMobiPx(mobiHeight * scale);

  // Brand colours.
  static const Color volt = Color(0xFFD2F000);
  static const Color charcoal = Color(0xFF12110E);
  static const Color warmWhite = Color(0xFFF3EFE4);

  /// The first m (of "mock").
  static const LogoLetter mFirst = LogoLetter(
    char: 'm',
    index: 0,
    x: 0,
    advance: 857,
    outline: LogoPathData(
      'M820 0L640 0L640 -276Q640 -321 628.5 -344.5Q617 -368 580 -368Q557 -368 543.5 -360Q530 -352 525 -330.5Q520 -309 520 -269L517 -326Q522 -371 538 -412Q554 -453 588.5 -478.5Q623 -504 682 -504Q747 -504 783.5 -463Q820 -422 820 -346ZM220 0L40 0L40 -494L220 -494ZM520 0L340 0L340 -276Q340 -321 328.5 -344.5Q317 -368 280 -368Q257 -368 243.5 -360Q230 -352 225 -330.5Q220 -309 220 -269L217 -326Q222 -371 238 -412Q254 -453 288.5 -478.5Q323 -504 382 -504Q447 -504 483.5 -463Q520 -422 520 -346Z',
    ),
    bounds: Rect.fromLTRB(40, -504, 820, 0),
  );

  /// The plain o (the o that is not Mobi).
  static const LogoLetter o = LogoLetter(
    char: 'o',
    index: 1,
    x: 865,
    advance: 562,
    outline: LogoPathData(
      'M277 10Q198 10 140.5 -23.5Q83 -57 51.5 -115.5Q20 -174 20 -247Q20 -321 51.5 -379Q83 -437 140.5 -470.5Q198 -504 277 -504Q360 -504 419.5 -470.5Q479 -437 510.5 -379Q542 -321 542 -247Q542 -174 510.5 -115.5Q479 -57 419.5 -23.5Q360 10 277 10ZM281 -134Q304 -134 321.5 -144.5Q339 -155 349 -179.5Q359 -204 359 -247Q359 -290 349 -314.5Q339 -339 321.5 -349.5Q304 -360 281 -360Q258 -360 240.5 -349.5Q223 -339 213 -314.5Q203 -290 203 -247Q203 -204 213 -179.5Q223 -155 240.5 -144.5Q258 -134 281 -134Z',
    ),
    bounds: Rect.fromLTRB(20, -504, 542, 10),
  );

  /// The c.
  static const LogoLetter c = LogoLetter(
    char: 'c',
    index: 2,
    x: 1445,
    advance: 513,
    outline: LogoPathData(
      'M277 10Q198 10 140.5 -23.5Q83 -57 51.5 -115.5Q20 -174 20 -247Q20 -321 51.5 -379Q83 -437 140.5 -470.5Q198 -504 277 -504Q360 -504 421 -466Q482 -428 508 -371L368 -279Q358 -317 337.5 -336Q317 -355 285 -355Q262 -355 243 -343.5Q224 -332 213.5 -308.5Q203 -285 203 -247Q203 -210 213.5 -186Q224 -162 243 -150.5Q262 -139 285 -139Q317 -139 337.5 -158Q358 -177 368 -215L508 -123Q482 -66 421 -28Q360 10 277 10Z',
    ),
    bounds: Rect.fromLTRB(20, -504, 508, 10),
  );

  /// The k.
  static const LogoLetter k = LogoLetter(
    char: 'k',
    index: 3,
    x: 1968,
    advance: 595,
    outline: LogoPathData(
      'M220 0L40 0L40 -670L220 -670L220 -453L210 -284L312 -418L379 -494L587 -494L334 -224L312 -221L220 -118ZM583 0L382 0L247 -249L391 -307Z',
    ),
    bounds: Rect.fromLTRB(40, -670, 587, 0),
  );

  /// The second m (of "mob").
  static const LogoLetter mSecond = LogoLetter(
    char: 'm',
    index: 4,
    x: 2549,
    advance: 857,
    outline: LogoPathData(
      'M820 0L640 0L640 -276Q640 -321 628.5 -344.5Q617 -368 580 -368Q557 -368 543.5 -360Q530 -352 525 -330.5Q520 -309 520 -269L517 -326Q522 -371 538 -412Q554 -453 588.5 -478.5Q623 -504 682 -504Q747 -504 783.5 -463Q820 -422 820 -346ZM220 0L40 0L40 -494L220 -494ZM520 0L340 0L340 -276Q340 -321 328.5 -344.5Q317 -368 280 -368Q257 -368 243.5 -360Q230 -352 225 -330.5Q220 -309 220 -269L217 -326Q222 -371 238 -412Q254 -453 288.5 -478.5Q323 -504 382 -504Q447 -504 483.5 -463Q520 -422 520 -346Z',
    ),
    bounds: Rect.fromLTRB(40, -504, 820, 0),
  );

  /// The b.
  static const LogoLetter b = LogoLetter(
    char: 'b',
    index: 6,
    x: 3987.35,
    advance: 577,
    outline: LogoPathData(
      'M366 10Q308 10 277.5 -16Q247 -42 234.5 -82.5Q222 -123 217 -168L220 -225Q220 -185 229.5 -163.5Q239 -142 255 -134Q271 -126 290 -126Q334 -126 354 -159Q374 -192 374 -247Q374 -302 354 -335Q334 -368 290 -368Q271 -368 255 -360Q239 -352 229.5 -330.5Q220 -309 220 -269L217 -326Q222 -371 237 -412Q252 -453 285 -478.5Q318 -504 376 -504Q430 -504 471 -475Q512 -446 534.5 -389Q557 -332 557 -247Q557 -163 534 -105.5Q511 -48 468 -19Q425 10 366 10ZM220 0L40 0L40 -670L220 -670Z',
    ),
    bounds: Rect.fromLTRB(40, -670, 557, 10),
  );

  /// The six letters in word order (Mobi excluded).
  static const List<LogoLetter> letters = [mFirst, o, c, k, mSecond, b];

  /// The m that starts the app icon's "mo" (the letter before Mobi).
  static LogoLetter get iconM => letters.firstWhere((l) => l.index == mobiIndex - 1);

  static const MobiGlyph mobiFull = MobiGlyph(
    detail: LogoDetail.full,
    x: 3423.22,
    body: LogoPathData(
      'M263.43 -525.63C289.27 -528.4 315.49 -519.25 338.75 -498.18Q416.97 -427.3 491.93 -353.02C562.54 -283.06 562.54 -197.29 491.93 -127.33Q430.97 -66.92 367.85 -8.76C308.7 45.73 236.19 45.73 177.04 -8.76Q113.91 -66.92 52.95 -127.33C-17.65 -197.29 -17.65 -283.06 52.95 -353.02Q127.91 -427.3 206.14 -498.18C215.37 -506.54 225.08 -513.03 235.04 -517.64C258.56 -497.14 281.87 -476.41 304.98 -455.44C328.19 -434.38 351.18 -413.09 373.97 -391.56C396.74 -370.04 419.06 -348.04 441.66 -326.34C464.45 -304.53 489.59 -285.32 516.42 -268.76C501.05 -295.02 482.67 -319.45 461.49 -341.3C440.53 -362.85 418.46 -383.42 396.65 -404.1C374.81 -424.8 352.77 -445.3 330.54 -465.58C308.36 -485.81 285.99 -505.82 263.43 -525.63Z',
    ),
    visor: LogoPathData(
      'M198.4 -353.06L335 -353.06C393.58 -353.06 441.06 -305.58 441.06 -247L441.06 -247C441.06 -188.42 393.58 -140.94 335 -140.94L198.4 -140.94C139.82 -140.94 92.34 -188.42 92.34 -247L92.34 -247C92.34 -305.58 139.82 -353.06 198.4 -353.06Z',
    ),
    eyeLeft: LogoPathData(
      'M208.16 -237.64C208.16 -202.5 195.34 -174 179.52 -174C163.7 -174 150.88 -202.5 150.88 -237.64C150.88 -272.79 163.7 -301.28 179.52 -301.28C195.34 -301.28 208.16 -272.79 208.16 -237.64Z',
    ),
    eyeRight: LogoPathData(
      'M382.52 -237.64C382.52 -202.5 369.7 -174 353.88 -174C338.07 -174 325.25 -202.5 325.25 -237.64C325.25 -272.79 338.07 -301.28 353.88 -301.28C369.7 -301.28 382.52 -272.79 382.52 -237.64Z',
    ),
    eyeRightRing: LogoPathData(
      'M382.52 -237.64C382.52 -202.5 369.7 -174 353.88 -174C338.07 -174 325.25 -202.5 325.25 -237.64C325.25 -272.79 338.07 -301.28 353.88 -301.28C369.7 -301.28 382.52 -272.79 382.52 -237.64ZM368.77 -237.64C368.77 -265.2 362.11 -287.53 353.88 -287.53C345.66 -287.53 338.99 -265.2 338.99 -237.64C338.99 -210.09 345.66 -187.75 353.88 -187.75C362.11 -187.75 368.77 -210.09 368.77 -237.64Z',
      evenOdd: true,
    ),
    bounds: Rect.fromLTRB(0, -526.11, 544.88, 32.11),
    visorRect: Rect.fromLTRB(92.34, -353.06, 441.06, -140.94),
    eyeLeftRect: Rect.fromLTRB(150.88, -301.28, 208.16, -174),
    eyeRightRect: Rect.fromLTRB(325.25, -301.28, 382.52, -174),
  );

  static const MobiGlyph mobiSmall = MobiGlyph(
    detail: LogoDetail.small,
    x: 3423.22,
    body: LogoPathData(
      'M338.75 -498.18Q416.97 -427.3 491.93 -353.02C562.54 -283.06 562.54 -197.29 491.93 -127.33Q430.97 -66.92 367.85 -8.76C308.7 45.73 236.19 45.73 177.04 -8.76Q113.91 -66.92 52.95 -127.33C-17.65 -197.29 -17.65 -283.06 52.95 -353.02Q127.91 -427.3 206.14 -498.18C247.25 -535.42 297.64 -535.42 338.75 -498.18Z',
    ),
    visor: LogoPathData(
      'M198.4 -353.06L335 -353.06C393.58 -353.06 441.06 -305.58 441.06 -247L441.06 -247C441.06 -188.42 393.58 -140.94 335 -140.94L198.4 -140.94C139.82 -140.94 92.34 -188.42 92.34 -247L92.34 -247C92.34 -305.58 139.82 -353.06 198.4 -353.06Z',
    ),
    eyeLeft: LogoPathData(
      'M213.46 -237.64C213.46 -201.32 198.26 -171.88 179.52 -171.88C160.78 -171.88 145.58 -201.32 145.58 -237.64C145.58 -273.96 160.78 -303.4 179.52 -303.4C198.26 -303.4 213.46 -273.96 213.46 -237.64Z',
    ),
    eyeRight: LogoPathData(
      'M387.82 -237.64C387.82 -201.32 372.63 -171.88 353.88 -171.88C335.14 -171.88 319.94 -201.32 319.94 -237.64C319.94 -273.96 335.14 -303.4 353.88 -303.4C372.63 -303.4 387.82 -273.96 387.82 -237.64Z',
    ),
    eyeRightRing: null,
    bounds: Rect.fromLTRB(0, -526.11, 544.88, 32.11),
    visorRect: Rect.fromLTRB(92.34, -353.06, 441.06, -140.94),
    eyeLeftRect: Rect.fromLTRB(145.58, -303.4, 213.46, -171.88),
    eyeRightRect: Rect.fromLTRB(319.94, -303.4, 387.82, -171.88),
  );

  static const MobiGlyph mobiMicro = MobiGlyph(
    detail: LogoDetail.micro,
    x: 3423.22,
    body: LogoPathData(
      'M338.75 -498.18Q416.97 -427.3 491.93 -353.02C562.54 -283.06 562.54 -197.29 491.93 -127.33Q430.97 -66.92 367.85 -8.76C308.7 45.73 236.19 45.73 177.04 -8.76Q113.91 -66.92 52.95 -127.33C-17.65 -197.29 -17.65 -283.06 52.95 -353.02Q127.91 -427.3 206.14 -498.18C247.25 -535.42 297.64 -535.42 338.75 -498.18Z',
    ),
    visor: LogoPathData(
      'M198.4 -353.06L335 -353.06C393.58 -353.06 441.06 -305.58 441.06 -247L441.06 -247C441.06 -188.42 393.58 -140.94 335 -140.94L198.4 -140.94C139.82 -140.94 92.34 -188.42 92.34 -247L92.34 -247C92.34 -305.58 139.82 -353.06 198.4 -353.06Z',
    ),
    eyeLeft: null,
    eyeRight: null,
    eyeRightRing: null,
    bounds: Rect.fromLTRB(0, -526.11, 544.88, 32.11),
    visorRect: Rect.fromLTRB(92.34, -353.06, 441.06, -140.94),
    eyeLeftRect: null,
    eyeRightRect: null,
  );

  static MobiGlyph mobi(LogoDetail detail) => switch (detail) {
    LogoDetail.full => mobiFull,
    LogoDetail.small => mobiSmall,
    LogoDetail.micro => mobiMicro,
  };
}

final Map<String, Path> _logoPathCache = <String, Path>{};

/// Parses the absolute SVG subset this file uses: M L H V Q C Z.
Path _parseLogoPath(String d) {
  final path = Path();
  final n = d.length;
  var i = 0;
  var cmd = '';
  var cx = 0.0, cy = 0.0;

  bool isNumStart(int c) => (c >= 48 && c <= 57) || c == 45 || c == 43 || c == 46; // 0-9 - + .
  double num() {
    while (i < n && (d.codeUnitAt(i) == 32 || d.codeUnitAt(i) == 44)) {
      i++;
    }
    final start = i;
    if (i < n && (d.codeUnitAt(i) == 45 || d.codeUnitAt(i) == 43)) {
      i++;
    }
    while (i < n) {
      final c = d.codeUnitAt(i);
      if ((c >= 48 && c <= 57) || c == 46 || c == 101 || c == 69) {
        if ((c == 101 || c == 69) &&
            i + 1 < n &&
            (d.codeUnitAt(i + 1) == 45 || d.codeUnitAt(i + 1) == 43)) {
          i++;
        }
        i++;
      } else {
        break;
      }
    }
    return double.parse(d.substring(start, i));
  }

  while (i < n) {
    final c = d.codeUnitAt(i);
    if (c == 32 || c == 44) {
      i++;
      continue;
    }
    if (!isNumStart(c)) {
      cmd = d[i];
      i++;
      if (cmd == 'Z' || cmd == 'z') {
        path.close();
        continue;
      }
    }
    switch (cmd) {
      case 'M':
        cx = num();
        cy = num();
        path.moveTo(cx, cy);
        cmd = 'L'; // implicit lineto after a moveto
      case 'L':
        cx = num();
        cy = num();
        path.lineTo(cx, cy);
      case 'H':
        cx = num();
        path.lineTo(cx, cy);
      case 'V':
        cy = num();
        path.lineTo(cx, cy);
      case 'Q':
        final x1 = num(), y1 = num();
        cx = num();
        cy = num();
        path.quadraticBezierTo(x1, y1, cx, cy);
      case 'C':
        final x1 = num(), y1 = num(), x2 = num(), y2 = num();
        cx = num();
        cy = num();
        path.cubicTo(x1, y1, x2, y2, cx, cy);
      default:
        throw FormatException('Unsupported path command "$cmd" in logo geometry');
    }
  }
  return path;
}
