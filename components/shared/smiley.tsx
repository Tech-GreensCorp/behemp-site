type SmileyProps = {
  bg: string;
  face: string;
  className?: string;
};

export function Smiley({ bg, face, className = '' }: SmileyProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="30" fill={bg} />
      <path
        d="M18 34 Q32 52 46 34"
        stroke={face}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
