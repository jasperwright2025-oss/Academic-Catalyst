// Academic Catalyst mark: an "A" inside a "C", with a star. `light` is for dark backgrounds.
export default function Logo({ light = false, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 800 800" aria-hidden="true">
      {!light && <circle cx="400" cy="400" r="390" fill="#14306B" />}
      <path d="M560 255 A210 210 0 1 0 560 545" fill="none" stroke="#FFFFFF" strokeWidth="60" strokeLinecap="round" />
      <path d="M322 515 L400 310 L478 515" fill="none" stroke="#F2A93B" strokeWidth="50" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M350 450 H450" stroke="#F2A93B" strokeWidth="42" strokeLinecap="round" />
      <path d="M590 335 l20 -45 l20 45 l45 20 l-45 20 l-20 45 l-20 -45 l-45 -20 z" fill="#FFFFFF" />
    </svg>
  );
}
