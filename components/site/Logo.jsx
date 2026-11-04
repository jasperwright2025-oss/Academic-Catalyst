export default function Logo({ light = false }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="13" fill="none" stroke={light ? "#FFFFFF" : "#10203A"} strokeWidth="2" />
      <circle cx="14" cy="14" r="5" fill={light ? "#3CC2A2" : "#0E7C66"} />
      <circle cx="22" cy="7" r="2.5" fill="#E8A33D" />
    </svg>
  );
}
