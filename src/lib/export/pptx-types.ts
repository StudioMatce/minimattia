import type { PathCmd } from "./svg-parse";

export type CoordFn = (v: number) => number;
export type ScaleFn = (v: number) => number;
export type AddPathFn = (
  cmds: PathCmd[], off: { x: number; y: number },
  color: string, width: number, dashed: boolean, hasArrow: boolean
) => void;
