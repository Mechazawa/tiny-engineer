export const DEFAULT_SERVO_RANGES = [
  [60, 130],
  [40, 130],
  [45, 135],
  [35, 125],
  [40, 130],
];

export const cloneRanges = (ranges) => ranges.map(([min, max]) => [min, max]);

export const servoRanges = cloneRanges(DEFAULT_SERVO_RANGES);

export function applyServoRanges(settings) {
  const { servo_mins: mins, servo_maxs: maxs } = settings;

  if (mins?.length !== servoRanges.length || maxs?.length !== servoRanges.length) {
    return;
  }

  mins.forEach((min, index) => {
    servoRanges[index] = [min, maxs[index]];
  });
}
