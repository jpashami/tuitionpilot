// TuitionPilot brand mark and lockup (see public/brand/*.svg).
// Mark: 64-unit grid, red apex over a navy (or white, when reversed) delta wing. Never rotate, stretch or add effects.

export function LogoMark({ size = 32, reversed = false, title }: { size?: number; reversed?: boolean; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flex: 'none' }}
    >
      <path d="M32 6 L42.1 23 L21.9 23 Z" fill="#D2102C" />
      <path d="M21.9 23 L42.1 23 L57 48 L32 36 L7 48 Z" fill={reversed ? '#FFFFFF' : '#0A0B3B'} />
    </svg>
  );
}

/**
 * Horizontal lockup: mark height = cap height × 1.6, gap = 0.45 × mark height.
 * The endorsement line is dropped below 28px mark height, per the logo sheet.
 */
export function Lockup({ size = 32, reversed = false, endorsement = true }: { size?: number; reversed?: boolean; endorsement?: boolean }) {
  const capHeight = size / 1.6;
  const fontSize = capHeight / 0.7; // Space Grotesk cap height ≈ 0.7 em
  const showEndorsement = endorsement && size >= 28;
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.45 }} aria-label="TuitionPilot">
      <LogoMark size={size} reversed={reversed} />
      <span className="flex flex-col" aria-hidden="true">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            fontSize,
            lineHeight: 1,
            color: reversed ? '#FFFFFF' : 'var(--navy-900)',
          }}
        >
          TuitionPilot
        </span>
        {showEndorsement && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: Math.max(9, fontSize * 0.28),
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginTop: fontSize * 0.28,
              color: reversed ? 'var(--navy-300)' : 'var(--slate-500)',
            }}
          >
            A Novalycs product
          </span>
        )}
      </span>
    </span>
  );
}
