import type { Settings } from "./api/types";

export type Range = readonly [min: number, max: number];

export const SERVO_NAMES = ["Head", "Neck", "Left hand", "Right hand", "Body"];

export const DEFAULT_SERVO_RANGES: Range[] = [
  [60, 130],
  [40, 130],
  [45, 135],
  [35, 125],
  [40, 130],
];

export function savedRanges(settings: Settings | null): Range[] {
  const mins = settings?.servo_mins;
  const maxs = settings?.servo_maxs;

  if (mins?.length !== SERVO_NAMES.length || maxs?.length !== SERVO_NAMES.length) {
    return DEFAULT_SERVO_RANGES;
  }

  return mins.map((min, index) => [min, maxs[index]] as const);
}
