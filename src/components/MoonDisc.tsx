/**
 * The moon, with the phase it actually has tonight.
 *
 * A plain white dot is a placeholder; the phase is free information — SunCalc
 * already knows it — and it is the difference between "there is a moon" and
 * "that is tonight's moon".
 *
 * The lit limb faces the sun, always, and that single rule is the whole
 * orientation. Waxing and waning are not a second fact needing a second
 * transform: they are what it looks like when the sun is on one side rather than
 * the other. Mirroring the shape on top of the rotation, as this first did,
 * turned the light a further 180° and pointed a waning moon's bright side away
 * from the sun.
 */
interface Props {
  size: number;
  /** Lit fraction, 0 new to 1 full. */
  illuminated: number;
  /** Degrees to turn the lit limb, so it faces the sun. */
  tilt: number;
  opacity: number;
  style?: React.CSSProperties;
}

const LIT = '#EFEAF0';

export function MoonDisc({ size, illuminated, tilt, opacity, style }: Props) {
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
      <g transform={`rotate(${tilt.toFixed(1)})`}>
        {/* The unlit disc stays faintly visible — earthshine, and it keeps the
            moon from looking like a stray fragment on a dark sky. */}
        <circle r={r} fill={LIT} opacity={0.13} />
        {shape ? <path d={shape} fill={LIT} /> : <circle r={r} fill={LIT} />}
      </g>
    </svg>
  );
}
