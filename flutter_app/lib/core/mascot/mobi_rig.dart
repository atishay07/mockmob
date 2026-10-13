import 'dart:ui' show lerpDouble;

double _l(double a, double b, double t) => lerpDouble(a, b, t)!;

/// One eye on the visor. [open] scales it vertically (1 open, 0 a closed line), [happy] morphs
/// the oval into a smiling arc, [lid] lowers a flat upper lid (sleepy, squint).
class MobiEye {
  const MobiEye({this.open = 1, this.happy = 0, this.lid = 0});

  final double open;
  final double happy;
  final double lid;

  MobiEye copyWith({double? open, double? happy, double? lid}) =>
      MobiEye(open: open ?? this.open, happy: happy ?? this.happy, lid: lid ?? this.lid);

  static MobiEye lerp(MobiEye a, MobiEye b, double t) =>
      MobiEye(open: _l(a.open, b.open, t), happy: _l(a.happy, b.happy, t), lid: _l(a.lid, b.lid, t));
}

/// One rubber-hose arm. [angle] is the shoulder rotation in radians from straight down, outward
/// positive (pi is straight up). [bend] curves the hose (positive bows outward), [twist] turns
/// the mitten at the wrist, [front] draws the arm over the body, [point] morphs the mitten into a
/// pointing hand, [reach] scales the arm's length.
class MobiArm {
  const MobiArm({required this.angle, this.bend = 0.25, this.twist = 0, this.front = 0, this.point = 0, this.reach = 1});

  final double angle;
  final double bend;
  final double twist;
  final double front;
  final double point;
  final double reach;

  MobiArm copyWith({double? angle, double? bend, double? twist, double? front, double? point, double? reach}) => MobiArm(
        angle: angle ?? this.angle,
        bend: bend ?? this.bend,
        twist: twist ?? this.twist,
        front: front ?? this.front,
        point: point ?? this.point,
        reach: reach ?? this.reach,
      );

  static MobiArm lerp(MobiArm a, MobiArm b, double t) => MobiArm(
        angle: _l(a.angle, b.angle, t),
        bend: _l(a.bend, b.bend, t),
        twist: _l(a.twist, b.twist, t),
        front: _l(a.front, b.front, t),
        point: _l(a.point, b.point, t),
        reach: _l(a.reach, b.reach, t),
      );
}

/// One boot, offset from its rest spot on the ground (design units, up is negative) and rotated
/// about its heel (positive lifts the toe).
class MobiBoot {
  const MobiBoot({this.dx = 0, this.dy = 0, this.rot = 0});

  final double dx;
  final double dy;
  final double rot;

  MobiBoot copyWith({double? dx, double? dy, double? rot}) => MobiBoot(dx: dx ?? this.dx, dy: dy ?? this.dy, rot: rot ?? this.rot);

  static MobiBoot lerp(MobiBoot a, MobiBoot b, double t) => MobiBoot(dx: _l(a.dx, b.dx, t), dy: _l(a.dy, b.dy, t), rot: _l(a.rot, b.rot, t));
}

/// Every joint of Mobi for one frame, in design units (the character is drawn in a 140 by 168
/// box). The painter draws exactly this; the simulation produces one per tick.
class MobiRig {
  const MobiRig({
    this.x = 0,
    this.y = 0,
    this.tilt = 0,
    this.squash = 0,
    this.lookX = 0,
    this.lookY = 0,
    this.eyeL = const MobiEye(),
    this.eyeR = const MobiEye(),
    this.armL = const MobiArm(angle: 0.3, bend: 0.3),
    this.armR = const MobiArm(angle: 0.28, bend: 0.3),
    this.bootL = const MobiBoot(),
    this.bootR = const MobiBoot(),
    this.antenna = 0,
    this.burst = -1,
    this.zzz = -1,
    this.sheet = 0,
  });

  /// Body offset; [y] negative lifts Mobi off the ground.
  final double x;
  final double y;

  /// Body lean about the hips, radians, positive clockwise.
  final double tilt;

  /// Squash and stretch: positive stretches tall and thin, negative squashes.
  final double squash;

  /// Where the eyes look, -1 to 1 on each axis (positive is right and down).
  final double lookX;
  final double lookY;

  final MobiEye eyeL;
  final MobiEye eyeR;
  final MobiArm armL;
  final MobiArm armR;
  final MobiBoot bootL;
  final MobiBoot bootR;

  /// Antenna sway, radians, positive clockwise.
  final double antenna;

  /// Celebration bubbles: progress 0 to 1, or negative for none.
  final double burst;

  /// Sleepy z's drifting up: progress 0 to 1 (cyclic), or negative for none.
  final double zzz;

  /// The little answer sheet held for reading, 0 hidden to 1 held.
  final double sheet;

  MobiRig copyWith({
    double? x,
    double? y,
    double? tilt,
    double? squash,
    double? lookX,
    double? lookY,
    MobiEye? eyeL,
    MobiEye? eyeR,
    MobiArm? armL,
    MobiArm? armR,
    MobiBoot? bootL,
    MobiBoot? bootR,
    double? antenna,
    double? burst,
    double? zzz,
    double? sheet,
  }) =>
      MobiRig(
        x: x ?? this.x,
        y: y ?? this.y,
        tilt: tilt ?? this.tilt,
        squash: squash ?? this.squash,
        lookX: lookX ?? this.lookX,
        lookY: lookY ?? this.lookY,
        eyeL: eyeL ?? this.eyeL,
        eyeR: eyeR ?? this.eyeR,
        armL: armL ?? this.armL,
        armR: armR ?? this.armR,
        bootL: bootL ?? this.bootL,
        bootR: bootR ?? this.bootR,
        antenna: antenna ?? this.antenna,
        burst: burst ?? this.burst,
        zzz: zzz ?? this.zzz,
        sheet: sheet ?? this.sheet,
      );

  /// Both eyes at once.
  MobiRig eyes(MobiEye e) => copyWith(eyeL: e, eyeR: e);

  static double _pick(double a, double b, double t) => (a < 0 || b < 0) ? (t < 0.5 ? a : b) : _l(a, b, t);

  static MobiRig lerp(MobiRig a, MobiRig b, double t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    return MobiRig(
      x: _l(a.x, b.x, t),
      y: _l(a.y, b.y, t),
      tilt: _l(a.tilt, b.tilt, t),
      squash: _l(a.squash, b.squash, t),
      lookX: _l(a.lookX, b.lookX, t),
      lookY: _l(a.lookY, b.lookY, t),
      eyeL: MobiEye.lerp(a.eyeL, b.eyeL, t),
      eyeR: MobiEye.lerp(a.eyeR, b.eyeR, t),
      armL: MobiArm.lerp(a.armL, b.armL, t),
      armR: MobiArm.lerp(a.armR, b.armR, t),
      bootL: MobiBoot.lerp(a.bootL, b.bootL, t),
      bootR: MobiBoot.lerp(a.bootR, b.bootR, t),
      antenna: _l(a.antenna, b.antenna, t),
      burst: _pick(a.burst, b.burst, t),
      zzz: _pick(a.zzz, b.zzz, t),
      sheet: _l(a.sheet, b.sheet, t),
    );
  }
}
