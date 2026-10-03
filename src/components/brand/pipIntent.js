// A gesture needs a destination. Reading/transit never implies sleep or failure.
export function guideFacing(x, width, viewportWidth) {
  return x + width / 2 > viewportWidth / 2 ? 'left' : 'right';
}
export function guidePose(pose, { settled, reactionPose } = {}) {
  return reactionPose || (!settled ? 'attentive' : pose === 'idle' || pose === 'thinking' ? 'attentive' : pose);
}
