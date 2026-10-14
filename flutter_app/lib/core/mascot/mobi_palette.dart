import 'dart:ui';

/// Mobi's own colours. The character is the same lime paper and soft black in both themes; only
/// the light around it changes: a warm lamp rim and a deep shadow at Night, a paper-white rim and
/// a soft warm shadow in Daylight, so the black boots never sink into the charcoal ground.
class MobiPalette {
  const MobiPalette._({
    required this.night,
    required this.rim,
    required this.rimAlpha,
    required this.shadow,
    required this.shadowAlpha,
    required this.pool,
    required this.poolAlpha,
    required this.lit,
    required this.zzz,
    required this.limb,
    required this.limbHi,
    required this.limbLo,
  });

  /// The soft black of the arms, legs, boots and antenna: a touch lighter at Night so it holds
  /// its shape against the charcoal ground.
  final Color limb;
  final Color limbHi;
  final Color limbLo;

  final bool night;

  /// Light catching the upper-left edges of the black parts.
  final Color rim;
  final double rimAlpha;

  /// Contact shadow under the boots.
  final Color shadow;

  /// The contact shadow's strength where the boots meet the floor (SPACING.md 8.4: black 24% at
  /// Night, sepia 12% in Daylight, set here once for every Mobi).
  final double shadowAlpha;

  /// The soft lamp-light pool on a stage.
  final Color pool;

  /// The pool's strength at its centre: a little softer in Daylight than at Night, as the subject
  /// light fields are.
  final double poolAlpha;

  /// The lit bulb's edge in Daylight, in place of a glow (MOTION.md 1.4: no glows on paper, a
  /// 1 dp `#526700` edge instead). Null at Night, where the bulb glows.
  final Color? lit;

  /// Sleepy z's.
  final Color zzz;

  // ---- Paper body (volt family) ------------------------------------------------------------
  static const Color limeHi = Color(0xFFEFFF7A);
  static const Color limeLight = Color(0xFFE2FA2E);
  static const Color lime = Color(0xFFD2F000);
  static const Color limeMid = Color(0xFFBFDB00);
  static const Color limeLo = Color(0xFFA2BB00);
  static const Color limeDeep = Color(0xFF6F8200);
  static const Color limeShade = Color(0xFF4F5D00);

  // ---- Soft black (visor, limbs, boots) ----------------------------------------------------
  static const Color black = Color(0xFF262421);
  static const Color blackHi = Color(0xFF45413B);
  static const Color blackLo = Color(0xFF131210);
  static const Color visorTop = Color(0xFF2B2926);
  static const Color visorBottom = Color(0xFF0B0A09);

  // ---- Eyes --------------------------------------------------------------------------------
  static const Color eye = Color(0xFFFFFAEE);
  static const Color eyeShade = Color(0xFFD9D0BD);

  static const MobiPalette nightPalette = MobiPalette._(
    night: true,
    rim: Color(0xFFF2B865),
    rimAlpha: 0.5,
    shadow: Color(0xFF000000),
    shadowAlpha: 0.24,
    pool: Color(0xFFF2A93B),
    poolAlpha: 0.26,
    lit: null,
    zzz: Color(0xFFF4F0E6),
    limb: Color(0xFF3A3631),
    limbHi: Color(0xFF6A6358),
    limbLo: Color(0xFF1D1B18),
  );

  static const MobiPalette dayPalette = MobiPalette._(
    night: false,
    rim: Color(0xFFFFFFFF),
    rimAlpha: 0.22,
    shadow: Color(0xFF3B2A12),
    shadowAlpha: 0.12,
    pool: Color(0xFFF2C46B),
    poolAlpha: 0.17,
    lit: Color(0xFF526700),
    zzz: Color(0xFF17150F),
    limb: black,
    limbHi: blackHi,
    limbLo: blackLo,
  );

  static MobiPalette of({required bool night}) => night ? nightPalette : dayPalette;
}
