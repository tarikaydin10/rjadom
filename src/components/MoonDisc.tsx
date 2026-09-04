/**
 * The moon, with the phase it actually has tonight.
 *
 * A plain white dot is a placeholder; the phase is free information — SunCalc
 * already knows it — and it is the difference between "there is a moon" and
 * "that is tonight's moon". The lit limb is turned to face wherever the sun is
 * drawn in the band, which is both what the eye expects and what is true: the
 * moon is lit by the sun, so the bright side points at it even when it is below
 * the horizon.
 */
interface Props {
  size: number;
  /** Lit fraction, 0 new to 1 full. */
  illuminated: number;
  waxing: boolean;
  /** Degrees to turn the lit limb, so it faces the sun. */
  tilt: number;
  opacity: number;
  style?: React.CSSProperties;
}

const LIT = '#EFEAF0';

export function MoonDisc({ size, illuminated, waxing, tilt, opacity, style }: Props) {
  const r = 50;
  const lit = Math.min(1, Math.max(0, illuminated));

  // The terminator is an ellipse seen edge-on: a straight line at half phase,
  // bowing into the dark side as the moon fills, into the lit side as it thins.
  const rx = Math.abs(1 - 2 * lit) * r;
  const sweep = lit > 0.5 ? 1 : 0;
  const shape =
    lit > 0.985
      ? null
      : `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx.toFixed(2)} ${r} 0 0 ${sweep} 0 ${-r}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-55 -55 110 110"
      style={{ ...style, opacity, overflow: 'visible' }}
      aria-hidden="true"
    >
      <g transform={`rotate(${tilt.toFixed(1)}) scale(${waxing ? 1 : -1} 1)`}>
        {/* The unlit disc stays faintly visible — earthshine, and it keeps the
            moon from looking like a stray fragment on a dark sky. */}
        <circle r={r} fill={LIT} opacity={0.13} />
        {shape ? <path d={shape} fill={LIT} /> : <circle r={r} fill={LIT} />}
      </g>
    </svg>
  );
}
