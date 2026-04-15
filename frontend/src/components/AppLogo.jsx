export default function AppLogo() {
  return (
    <div className="brand-mark" aria-label="GeoServi Lab">
      <svg viewBox="0 0 160 160" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="geoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f7b267" />
            <stop offset="100%" stopColor="#f4845f" />
          </linearGradient>
          <linearGradient id="labGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d7f1ef" />
            <stop offset="100%" stopColor="#78c6be" />
          </linearGradient>
        </defs>

        <rect x="10" y="10" width="140" height="140" rx="34" fill="rgba(255,255,255,0.14)" />

        <path
          d="M44 34h44v10l-8 14v22c0 6 3 12 8 17l15 16c7 8 4 21-6 24H35c-10-3-13-16-6-24l15-16c5-5 8-11 8-17V58l-8-14V34z"
          fill="url(#labGradient)"
          stroke="#e6fffc"
          strokeWidth="4"
        />

        <path
          d="M43 116c12-8 24-7 36-2s25 6 39-4v18c-8 7-18 10-29 10H49c-7 0-12-4-14-10l8-12z"
          fill="url(#geoGradient)"
          opacity="0.95"
        />
        <path d="M42 103c10-6 22-6 33-1 12 5 24 5 38-3" fill="none" stroke="#91522d" strokeWidth="5" strokeLinecap="round" />
        <path d="M44 90c10-5 20-5 31-1 11 4 22 4 35-2" fill="none" stroke="#c97841" strokeWidth="5" strokeLinecap="round" />

        <circle cx="104" cy="54" r="11" fill="#f8ffff" opacity="0.95" />
        <path d="M104 42v25" stroke="#0f5d5e" strokeWidth="4" strokeLinecap="round" />
        <path d="M92 54h24" stroke="#0f5d5e" strokeWidth="4" strokeLinecap="round" />

        <path
          d="M55 34c8 8 15 12 25 12s17-4 25-12"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.85"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
