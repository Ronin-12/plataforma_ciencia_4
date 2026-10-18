export default function MascotaMurcielago({ className = "h-16 w-16", label = "Murciélago curioso" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17 56C6 44 7 29 10 19c12 4 22 13 27 25 7-5 15-8 23-8s16 3 23 8c5-12 15-21 27-25 3 10 4 25-7 37 4 16 0 32-11 42-9 9-20 13-32 13S37 107 28 98C17 88 13 72 17 56Z" fill="#7657D6" />
      <path d="M11 20c12 5 20 13 25 24-8-2-15 0-21 6C9 40 8 29 11 20Zm98 0c-12 5-20 13-25 24 8-2 15 0 21 6 6-10 7-21 4-30Z" fill="#FF9B71" />
      <path d="M31 58c5-7 13-9 20-5l-2 20c-8 1-15-2-18-8-2-2-2-5 0-7Zm58 0c-5-7-13-9-20-5l2 20c8 1 15-2 18-8 2-2 2-5 0-7Z" fill="#FFF8DC" />
      <ellipse cx="42" cy="65" rx="4" ry="6" fill="#27314F" />
      <ellipse cx="78" cy="65" rx="4" ry="6" fill="#27314F" />
      <path d="M56 76c2-4 6-4 8 0l-4 5-4-5Z" fill="#FF8A9B" />
      <path d="M52 84c5 6 11 6 16 0" fill="none" stroke="#27314F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="31" cy="77" r="5" fill="#FFB5A6" opacity=".8" />
      <circle cx="89" cy="77" r="5" fill="#FFB5A6" opacity=".8" />
      <path d="M47 101c3-7 8-10 13-10s10 3 13 10" fill="#61D6C5" />
      <path d="m53 96 7 7 7-7" fill="none" stroke="#FFF8DC" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
