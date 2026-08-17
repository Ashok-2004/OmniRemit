import styles from './LoginHero.module.css'
import { APP_NAME, COPYRIGHT_YEAR } from '../../../shared/config/branding'

export function LoginHero() {
  return (
    <div className={styles.heroContainer}>

      {/* Ambient glows */}
      <div className={styles.bgOrb}        aria-hidden="true" />
      <div className={styles.bgCenterGlow} aria-hidden="true" />

      {/* Dot grid — top-right accent */}
      <svg className={styles.dotGrid} viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <pattern id="dp" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#38bdf8" />
        </pattern>
        <rect width="120" height="120" fill="url(#dp)" />
      </svg>

      <div className={styles.heroContent}>

        {/* Brand */}
        <header className={styles.brandHeader}>
          <div className={styles.logoIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              <polygon points="18,2 32,10 32,26 18,34 4,26 4,10"
                stroke="url(#lg1)" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
              <line x1="18" y1="18" x2="18" y2="34" stroke="url(#lg1)" strokeWidth="2.2" />
              <line x1="18" y1="18" x2="32" y2="10" stroke="url(#lg1)" strokeWidth="2.2" />
              <line x1="18" y1="18" x2="4"  y2="10" stroke="url(#lg1)" strokeWidth="2.2" />
              <polygon points="18,7 27,12 18,17 9,12"
                stroke="#38bdf8" strokeWidth="1.3" strokeOpacity="0.9"
                fill="rgba(56,189,248,0.18)" />
              <polyline points="9,12 9,21 18,26 27,21 27,12"
                stroke="#38bdf8" strokeWidth="1.3" strokeOpacity="0.9" fill="none" />
            </svg>
          </div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandTitle}>
              <span className={styles.brandOmni}>Omni</span>
              <span className={styles.brandConnect}>Connect</span>
            </span>
          </div>
        </header>

        {/* Headline */}
        <div className={styles.textSection}>
          <h1 className={styles.mainHeading}>
            One platform.<br />
            Every team,{' '}
            <em className={styles.highlightText}>every app.</em>
          </h1>
          <p className={styles.description}>
            Access every tool your role unlocks — unified,
            secure, and always available.
          </p>

          {/* Three stats — social proof, not repeated elsewhere */}
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>12<span className={styles.statAccent}>k+</span></span>
              <span className={styles.statLabel}>Active users</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>99<span className={styles.statAccent}>.9%</span></span>
              <span className={styles.statLabel}>Uptime SLA</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}><span className={styles.statAccent}>24</span>/7</span>
              <span className={styles.statLabel}>Support</span>
            </div>
          </div>
        </div>

        {/* 3D Illustration */}
        <div className={styles.graphicSection}>
          <svg
            className={styles.isometricSvg}
            viewBox="0 0 600 420"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="deckTop" x1="20%" y1="0%"  x2="80%"  y2="100%">
                <stop offset="0%"   stopColor="#0f3da8" />
                <stop offset="60%"  stopColor="#082578" />
                <stop offset="100%" stopColor="#04164d" />
              </linearGradient>
              <linearGradient id="deckRim" x1="0%"  y1="0%"  x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#38bdf8" />
                <stop offset="50%"  stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="sideL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#1e40af" />
                <stop offset="100%" stopColor="#0b205e" />
              </linearGradient>
              <linearGradient id="sideR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#112b77" />
                <stop offset="100%" stopColor="#051238" />
              </linearGradient>
              <linearGradient id="baseL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#0d2466" />
                <stop offset="100%" stopColor="#030b21" />
              </linearGradient>
              <linearGradient id="baseR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#081745" />
                <stop offset="100%" stopColor="#020717" />
              </linearGradient>
              <linearGradient id="wTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </linearGradient>
              <linearGradient id="wL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
              <linearGradient id="wR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              <linearGradient id="rbTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="rbL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="rbR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#172554" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="ebTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="ebL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <linearGradient id="ebR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>
              <linearGradient id="sbTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#bae6fd" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
              <linearGradient id="sbL" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <linearGradient id="sbR" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="rgba(20,55,145,0.9)"  />
                <stop offset="100%" stopColor="rgba(8,25,75,0.95)"   />
              </linearGradient>
              <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="rgba(56,189,248,0.4)" />
                <stop offset="100%" stopColor="rgba(56,189,248,0)"   />
              </linearGradient>
              <filter id="glow"   x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="b" />
                <feComposite in="SourceGraphic" in2="b" operator="over" />
              </filter>
              <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="15" />
              </filter>
              <filter id="cg" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2" result="b" />
                <feComposite in="SourceGraphic" in2="b" operator="over" />
              </filter>
            </defs>

            {/* Floor shadow */}
            <ellipse cx="320" cy="335" rx="192" ry="64" fill="#010a26" opacity="0.72" filter="url(#shadow)" />

            {/* Lower base */}
            <polygon points="140,295 320,385 320,398 140,308" fill="url(#baseL)" />
            <polygon points="320,385 500,295 500,308 320,398" fill="url(#baseR)" />
            <polygon points="320,205 500,295 320,385 140,295" fill="#061a54" />

            {/* Main deck */}
            <polygon points="152,284 320,368 320,382 152,298" fill="url(#sideL)" />
            <polygon points="320,368 488,284 488,298 320,382" fill="url(#sideR)" />
            <path d="M320,200 L488,284 L320,368 L152,284 Z"
              stroke="url(#deckRim)" strokeWidth="3.5" fill="url(#deckTop)" filter="url(#glow)" />
            <path d="M320,212 L472,284 L320,356 L168,284 Z"
              stroke="#38bdf8" strokeWidth="1.1" strokeOpacity="0.42" fill="none" />

            {/* Circuit traces */}
            <path d="M210,284 L250,304 L250,320 L275,332"
              stroke="#38bdf8" strokeWidth="1.1" strokeOpacity="0.52" fill="none" />
            <circle cx="210" cy="284" r="3" fill="#38bdf8" className={styles.glowingNode} />
            <path d="M430,284 L390,304 L390,324 L365,336"
              stroke="#38bdf8" strokeWidth="1.1" strokeOpacity="0.52" fill="none" />
            <circle cx="430" cy="284" r="3" fill="#38bdf8" className={styles.glowingNode} />

            {/* Back-left electric blue pillar */}
            <polygon points="270,248 246,236 246,164 270,176" fill="url(#ebL)" />
            <polygon points="270,248 294,236 294,164 270,176" fill="url(#ebR)" />
            <polygon points="270,176 294,164 270,152 246,164" fill="url(#ebTop)" />

            {/* Back-right sky blue pillar */}
            <polygon points="370,250 346,238 346,174 370,186" fill="url(#sbL)" />
            <polygon points="370,250 394,238 394,174 370,186" fill="url(#sbR)" />
            <polygon points="370,186 394,174 370,162 346,174" fill="url(#sbTop)" />

            {/* Center tallest white pillar */}
            <polygon points="320,252 350,237 365,245 335,260" fill="rgba(2,10,35,0.38)" />
            <polygon points="320,252 290,237 290,119 320,134" fill="url(#wL)" />
            <polygon points="320,252 350,237 350,119 320,134" fill="url(#wR)" />
            <polygon points="320,134 350,119 320,104 290,119" fill="url(#wTop)" />

            {/* Front-left white pillar */}
            <polygon points="270,298 244,285 244,237 270,250" fill="url(#wL)" />
            <polygon points="270,298 296,285 296,237 270,250" fill="url(#wR)" />
            <polygon points="270,250 296,237 270,224 244,237" fill="url(#wTop)" />

            {/* Front-center royal blue pillar */}
            <polygon points="320,320 290,305 290,209 320,224" fill="url(#rbL)" />
            <polygon points="320,320 350,305 350,209 320,224" fill="url(#rbR)" />
            <polygon points="320,224 350,209 320,194 290,209" fill="url(#rbTop)" />

            {/* Front-right sky blue pillar */}
            <polygon points="375,295 352,283 352,247 375,259" fill="url(#sbL)" />
            <polygon points="375,295 398,283 398,247 375,259" fill="url(#sbR)" />
            <polygon points="375,259 398,247 375,235 352,247" fill="url(#sbTop)" />

            {/* Shield card — left */}
            <g className={styles.floatA}>
              <path d="M195,248 L195,274 L225,289"
                stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="2 2" strokeOpacity="0.6" fill="none" />
              <circle cx="225" cy="289" r="2.8" fill="#38bdf8" className={styles.glowingNode} />
              <g transform="translate(158,190)">
                <rect width="50" height="54" rx="12" fill="#000e38" opacity="0.5" filter="url(#shadow)" />
                <rect width="50" height="54" rx="12" fill="url(#hg)" stroke="#38bdf8" strokeWidth="1.4" strokeOpacity="0.75" filter="url(#cg)" />
                <g transform="translate(13,13)">
                  <path d="M12 2L3 6V12C3 17.5 7 22.5 12 24C17 22.5 21 17.5 21 12V6L12 2Z"
                    fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="2.8" fill="#38bdf8" />
                </g>
                <rect x="8" y="42" width="34" height="2.5" rx="1.2" fill="#38bdf8" opacity="0.32" />
              </g>
            </g>

            {/* Team badge — back */}
            <g className={styles.floatB}>
              <g transform="translate(372,162)">
                <rect width="48" height="44" rx="11" fill="#000e38" opacity="0.5" filter="url(#shadow)" />
                <rect width="48" height="44" rx="11" fill="url(#hg)" stroke="#60a5fa" strokeWidth="1.3" strokeOpacity="0.7" filter="url(#cg)" />
                <g transform="translate(12,10)" stroke="#fff" strokeWidth="1.7" fill="none">
                  <circle cx="12" cy="7" r="3" />
                  <path d="M7,19 C7,15.5 9.5,13.5 12,13.5 C14.5,13.5 17,15.5 17,19" />
                  <circle cx="5.5" cy="8.5" r="2" strokeOpacity="0.7" />
                  <path d="M2,18 C2,15.5 3.5,14 5.5,14" strokeOpacity="0.7" />
                  <circle cx="18.5" cy="8.5" r="2" strokeOpacity="0.7" />
                  <path d="M22,18 C22,15.5 20.5,14 18.5,14" strokeOpacity="0.7" />
                </g>
              </g>
            </g>

            {/* Analytics card — right */}
            <g className={styles.floatC}>
              <path d="M452,252 L452,272 L424,286"
                stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="2 2" strokeOpacity="0.6" fill="none" />
              <circle cx="424" cy="286" r="2.8" fill="#38bdf8" className={styles.glowingNode} />
              <g transform="translate(438,150)">
                <rect width="114" height="100" rx="12" fill="#000e38" opacity="0.56" filter="url(#shadow)" />
                <rect width="114" height="100" rx="12" fill="url(#hg)" stroke="#38bdf8" strokeWidth="1.4" strokeOpacity="0.72" filter="url(#cg)" />
                <line x1="10" y1="19" x2="104" y2="19" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.3" />
                <circle cx="16"  cy="11.5" r="2" fill="#38bdf8" opacity="0.72" />
                <circle cx="23"  cy="11.5" r="2" fill="#60a5fa" opacity="0.72" />
                <line x1="32" y1="11.5" x2="62" y2="11.5" stroke="#93c5fd" strokeWidth="1.4" strokeLinecap="round" opacity="0.46" />
                <polygon points="14,51 30,39 48,47 68,35 88,43 104,31 104,57 14,57" fill="url(#chartFill)" />
                <polyline points="14,51 30,39 48,47 68,35 88,43 104,31"
                  stroke="#38bdf8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="30"  cy="39" r="2.3" fill="#38bdf8" />
                <circle cx="68"  cy="35" r="2.3" fill="#38bdf8" />
                <circle cx="104" cy="31" r="2.3" fill="#38bdf8" />
                <line x1="14" y1="61" x2="104" y2="61" stroke="#38bdf8" strokeWidth="0.6" strokeOpacity="0.2" />
                <g transform="translate(14,66)">
                  <rect x="0"  y="16" width="7" height="13" rx="1.5" fill="#38bdf8" opacity="0.78" />
                  <rect x="13" y="8"  width="7" height="21" rx="1.5" fill="#60a5fa" opacity="0.88" />
                  <rect x="26" y="12" width="7" height="17" rx="1.5" fill="#38bdf8" opacity="0.82" />
                  <rect x="39" y="3"  width="7" height="26" rx="1.5" fill="#93c5fd" opacity="0.94" />
                  <rect x="52" y="10" width="7" height="19" rx="1.5" fill="#60a5fa" opacity="0.82" />
                  <rect x="65" y="1"  width="7" height="28" rx="1.5" fill="#38bdf8" opacity="0.94" />
                  <rect x="78" y="14" width="7" height="15" rx="1.5" fill="#60a5fa" opacity="0.78" />
                </g>
              </g>
            </g>
          </svg>
        </div>

      </div>{/* heroContent */}

      {/* Footer */}
      <footer className={styles.footer}>
        <span>© {COPYRIGHT_YEAR} {APP_NAME} · All rights reserved</span>
        <div className={styles.footerLinks}>
          <a href="#" className={styles.footerLink}>Privacy</a>
          <a href="#" className={styles.footerLink}>Terms</a>
        </div>
      </footer>

    </div>
  )
}
