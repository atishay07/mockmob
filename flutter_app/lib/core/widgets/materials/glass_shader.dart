import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

/// The lens of MockMob Glass (GLASS-1017 section 5.3): `shaders/mm_glass.frag`, loaded once
/// before the first frame ([GlassBoot.read] awaits [load]) and used as a backdrop filter by
/// [MmGlass] on the navigation layer only.
///
/// The lens runs only when all of these hold:
/// * the engine supports shader filters ([ui.ImageFilter.isShaderFilterSupported]: Impeller);
/// * the program loaded;
/// * [enabled] is true.
///
/// [enabled] defaults to the `MM_GLASS_SHADER` build flag, which is **off**: the shipped Full
/// tier is "Full without the shader" (blur, saturation and a thicker tint) until acceptance
/// check A4 (the debug grid lines up on the emulator and on one Vulkan phone) and the section 7
/// budget (bar raster p90 at or under 2.0 ms on a Galaxy M06) are proven on a device. Neither
/// could be measured in this pass: no device run was allowed. Build with
/// `--dart-define=MM_GLASS_SHADER=true` to run the lens, and with `MM_GLASS_GRID=true` as well to
/// draw the A4 grid (magenta through the shader, cyan on the screen: they must coincide).
abstract final class GlassShader {
  /// The asset key in `pubspec.yaml`.
  static const String asset = 'shaders/mm_glass.frag';

  /// The build flag (see the class comment).
  static const bool enabledByDefine = bool.fromEnvironment('MM_GLASS_SHADER');

  /// Debug builds only: draws the A4 alignment grid through the shader.
  static const bool gridByDefine = bool.fromEnvironment('MM_GLASS_GRID');

  /// Whether the lens may run at all (the build flag; tests and the lab may switch it).
  static bool enabled = enabledByDefine;

  /// Tests fake the engine's support (the golden engine has none).
  @visibleForTesting
  static bool? debugSupportedOverride;

  static ui.FragmentProgram? _program;
  static Future<void>? _loading;

  /// Why the lens is not running, once [load] has failed (for the one analytics event,
  /// `glass_shader_unavailable`). Null while loading or when it loaded.
  static String? failure;

  static bool get supported => debugSupportedOverride ?? ui.ImageFilter.isShaderFilterSupported;

  /// True when [MmGlass] draws the lens; false means "Full without the shader".
  static bool get ready => enabled && supported && _program != null;

  /// Loads the program once; never throws. Safe to call more than once.
  static Future<void> load() => _loading ??= _load();

  static Future<void> _load() async {
    if (!enabled) {
      failure = 'off';
      return;
    }
    if (!supported) {
      failure = 'unsupported';
      return;
    }
    try {
      _program = await ui.FragmentProgram.fromAsset(asset);
      failure = null;
    } on Object catch (e) {
      failure = 'load: ${e.runtimeType}';
    }
  }

  /// A fresh shader from the loaded program, or null when the lens is not [ready].
  static ui.FragmentShader? newShader() => ready ? _program!.fragmentShader() : null;

  /// Tests: forget the program so [load] runs again.
  @visibleForTesting
  static void debugReset() {
    _program = null;
    _loading = null;
    failure = null;
    enabled = enabledByDefine;
    debugSupportedOverride = null;
  }

  /// Tests: hand in a program loaded by the test itself.
  @visibleForTesting
  static set debugProgram(ui.FragmentProgram? program) => _program = program;
}

/// One surface's lens settings, in physical pixels (section 5.1). [GlassLens.apply] writes them
/// into a shader in the order `mm_glass.frag` declares its uniforms.
@immutable
class GlassLens {
  const GlassLens({
    required this.rect,
    required this.radius,
    required this.band,
    required this.bend,
    required this.core,
    required this.lumMax,
    required this.lumMin,
    this.saturation = 1.15,
    this.slack = 96,
    this.grid = 0,
  });

  /// The surface in the filter's pixel space: its global rect times the device pixel ratio.
  final ui.Rect rect;
  final double radius;
  final double band;
  final double bend;
  final double core;

  /// Night's ceiling (1 is off) and Day's floor (0 is off) on the backdrop's luminance.
  final double lumMax;
  final double lumMin;
  final double saturation;

  /// How much larger than the surface the filter's input may be and still read as local.
  final double slack;

  /// The A4 grid spacing in pixels; 0 is off.
  final double grid;

  /// Writes the uniforms. Index 0 and 1 (`uSize`) belong to the engine.
  void apply(ui.FragmentShader shader) {
    var i = 2;
    void f(double v) => shader.setFloat(i++, v);
    f(rect.left);
    f(rect.top);
    f(rect.right);
    f(rect.bottom);
    f(radius);
    f(band);
    f(bend);
    f(core);
    f(lumMax);
    f(lumMin);
    f(saturation);
    f(slack);
    f(grid);
  }

  @override
  bool operator ==(Object other) =>
      other is GlassLens &&
      other.rect == rect &&
      other.radius == radius &&
      other.band == band &&
      other.bend == bend &&
      other.core == core &&
      other.lumMax == lumMax &&
      other.lumMin == lumMin &&
      other.saturation == saturation &&
      other.slack == slack &&
      other.grid == grid;

  @override
  int get hashCode => Object.hash(rect, radius, band, bend, core, lumMax, lumMin, saturation, slack, grid);
}
