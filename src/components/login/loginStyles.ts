/**
 * Login-screen layout & styling — "Aurora Vault" (D24).
 *
 * The sign-in scene is the one screen with no data on it, so it is the one
 * place the identity may speak at full volume. The whole viewport becomes the
 * dark vault (--gl-vault-grad) lit by two slow aurora fields built from the
 * emerald and brass the palette already owns; a single frosted porcelain card
 * floats at the centre of it. Everything inside the card is the same porcelain
 * language as the app, so the handover from login to dashboard is continuous.
 *
 * Strict design-system tokens throughout: color-mix() derives every tint from
 * a token, so no literal colour, radius, or font-size enters this file. The
 * card keeps the single frosted surface (standard + -webkit- pair) allowed by
 * scripts/lint-design.mjs; nothing else blurs.
 */
export function renderLoginStylesHtml(): string {
  return `<style>
    /* ---------------------------------------------------------------
       Scene — the dark vault fills the viewport
       --------------------------------------------------------------- */
    .gl-login-screen {
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) var(--space-4);
      background-color: var(--gl-vault-950);
      background-image: var(--gl-vault-grad);
      color: var(--sidebar-foreground);
      font-family: var(--font-sans);
      position: relative;
      overflow: hidden;
      isolation: isolate;
    }

    /* Two aurora fields drift across the vault. They are pure decoration on a
       screen with no figures, so the movement can be slow and large without
       competing with anything the user must read. */
    .gl-login-screen::before,
    .gl-login-screen::after {
      content: "";
      position: absolute;
      z-index: -1;
      pointer-events: none;
      border-radius: var(--radius-full);
      filter: blur(90px);
    }

    .gl-login-screen::before {
      width: 68vmax;
      height: 68vmax;
      top: -28vmax;
      left: -22vmax;
      background:
        radial-gradient(closest-side, color-mix(in srgb, var(--gl-emerald-600) 62%, transparent), transparent 72%);
      animation: gl-aurora-a 22s var(--ease-in-out) infinite alternate;
    }

    .gl-login-screen::after {
      width: 56vmax;
      height: 56vmax;
      right: -20vmax;
      bottom: -24vmax;
      background:
        radial-gradient(closest-side, color-mix(in srgb, var(--gl-brass-500) 48%, transparent), transparent 72%);
      animation: gl-aurora-b 26s var(--ease-in-out) infinite alternate;
    }

    @keyframes gl-aurora-a {
      from { transform: translate3d(0, 0, 0) scale(1); }
      to   { transform: translate3d(8vmax, 6vmax, 0) scale(1.12); }
    }

    @keyframes gl-aurora-b {
      from { transform: translate3d(0, 0, 0) scale(1.06); }
      to   { transform: translate3d(-7vmax, -5vmax, 0) scale(1); }
    }

    /* A faint vertical rule grid gives the vault a machined texture and keeps
       the dark field from reading as flat black. */
    .gl-login-vault-grid {
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background-image:
        linear-gradient(to right, color-mix(in srgb, var(--sidebar-foreground) 5%, transparent) 1px, transparent 1px),
        linear-gradient(to bottom, color-mix(in srgb, var(--sidebar-foreground) 5%, transparent) 1px, transparent 1px);
      background-size: 72px 72px;
      mask-image: radial-gradient(70% 60% at 50% 45%, black, transparent 78%);
      -webkit-mask-image: radial-gradient(70% 60% at 50% 45%, black, transparent 78%);
    }

    .gl-login-screen--vault {
      padding: var(--space-8) var(--space-4);
    }

    /* ---------------------------------------------------------------
       Column — brand lockup above the card, assurances below it
       --------------------------------------------------------------- */
    .gl-login-vault {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 460px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
    }

    .gl-vault-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      text-align: center;
      animation: gl-login-rise var(--duration-page) var(--ease-out) both;
    }

    .gl-vault-mark {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-2xl);
      background: var(--gl-mark-grad);
      color: var(--sidebar-primary-foreground);
      display: grid;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--sidebar-foreground) 22%, transparent);
      box-shadow: var(--shadow-glass-btn);
      position: relative;
    }

    /* Halo ring — the dial reads as a lit object rather than a flat tile. */
    .gl-vault-mark::after {
      content: "";
      position: absolute;
      inset: calc(-1 * var(--space-2));
      border-radius: inherit;
      border: 1px solid color-mix(in srgb, var(--sidebar-primary) 34%, transparent);
      pointer-events: none;
    }

    .gl-vault-brandtext {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      min-width: 0;
      max-width: 100%;
    }

    .gl-vault-wordmark {
      font-family: var(--font-display);
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--sidebar-foreground);
    }

    .gl-vault-church {
      font-size: var(--text-xs);
      color: color-mix(in srgb, var(--sidebar-foreground) 66%, transparent);
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gl-login-workspace {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    /* The three assurances sit under the card as quiet chips on the vault —
       present, but never louder than the sign-in action itself. */
    .gl-vault-facts {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
      animation: gl-login-rise var(--duration-page) var(--ease-out) both;
      animation-delay: 90ms;
    }

    .gl-vault-facts li {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid color-mix(in srgb, var(--sidebar-foreground) 14%, transparent);
      background: color-mix(in srgb, var(--sidebar-accent) 46%, transparent);
      font-size: var(--text-2xs);
      color: color-mix(in srgb, var(--sidebar-foreground) 82%, transparent);
    }

    .gl-vault-facts svg {
      color: var(--sidebar-primary);
      flex-shrink: 0;
    }

    .gl-vault-foot {
      margin: 0;
      font-size: var(--text-2xs);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--sidebar-foreground) 42%, transparent);
      text-align: center;
    }

    /* Hero copy is carried by the card on this direction; the old panel
       headline stays in the DOM for screen readers only. */
    .gl-vault-hero {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .gl-vault-panel,
    .gl-vault-panel__inner {
      display: contents;
    }

    @keyframes gl-login-rise {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ---------------------------------------------------------------
       Card — one frosted porcelain surface floating on the vault
       --------------------------------------------------------------- */
    .gl-login-card {
      width: 100%;
      max-width: 460px;
      background: color-mix(in srgb, var(--card) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--gl-white) 60%, transparent);
      border-radius: var(--radius-sheet);
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, var(--gl-white) 70%, transparent),
        var(--shadow-glass-card);
      backdrop-filter: var(--glass-blur-surface);
      -webkit-backdrop-filter: var(--glass-blur-surface);
      padding: var(--space-8) var(--space-6) var(--space-6);
      display: flex;
      flex-direction: column;
      align-items: center;
      color: var(--foreground);
      position: relative;
      overflow: hidden;
      animation: gl-login-card-in var(--duration-page) var(--ease-out) both;
    }

    /* Emerald hairline along the top edge: the card is a lit panel set into
       the vault door. */
    .gl-login-card::before {
      content: "";
      position: absolute;
      top: 0;
      left: 12%;
      right: 12%;
      height: 1px;
      background: linear-gradient(
        to right,
        transparent,
        color-mix(in srgb, var(--income) 70%, transparent),
        transparent
      );
      pointer-events: none;
    }

    .gl-login-card--narrow {
      max-width: 400px;
      padding: var(--space-6) var(--space-5);
    }

    @media (max-width: 400px) {
      .gl-login-card {
        padding: var(--space-6) var(--space-4);
      }
    }

    @keyframes gl-login-card-in {
      from { opacity: 0; transform: translateY(16px) scale(0.985); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .gl-login-screen::before,
      .gl-login-screen::after,
      .gl-login-card,
      .gl-vault-brand,
      .gl-vault-facts,
      .gl-pin-status--error,
      .gl-pin-dot.is-filled {
        animation: none;
      }

      .gl-profile-item,
      .gl-pin-key,
      .gl-profile-chevron {
        transition: none;
      }
    }

    /* ---------------------------------------------------------------
       Stage & hero typography
       --------------------------------------------------------------- */
    .gl-login-stage {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .gl-login-hero {
      width: 100%;
      text-align: center;
      margin-bottom: var(--space-6);
    }

    .gl-login-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-2xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
      border-radius: var(--radius-full);
      padding: var(--space-1) var(--space-3);
      margin: 0 0 var(--space-3);
    }

    .gl-login-eyebrow::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: var(--radius-full);
      background: var(--income);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--income) 18%, transparent);
    }

    .gl-login-heading {
      font-size: var(--text-3xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      color: var(--foreground);
      margin: 0 0 var(--space-2);
      text-wrap: balance;
    }

    .gl-login-subheading {
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      line-height: var(--leading-body);
      margin: 0;
    }

    /* ---------------------------------------------------------------
       Profile roster
       --------------------------------------------------------------- */
    .gl-login-profiles {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .gl-profile-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      min-height: var(--touch-target-min);
      padding: var(--space-3);
      background: color-mix(in srgb, var(--card) 70%, transparent);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: inherit;
      position: relative;
      overflow: hidden;
      transition:
        transform var(--duration-micro) var(--ease-out),
        border-color var(--duration-micro) var(--ease-out),
        background var(--duration-micro) var(--ease-out),
        box-shadow var(--duration-micro) var(--ease-out);
    }

    /* Emerald rail on the leading edge grows in on hover — the row announces
       which identity is about to be taken without moving any text. */
    .gl-profile-item::before {
      content: "";
      position: absolute;
      left: 0;
      top: 50%;
      width: 3px;
      height: 0;
      transform: translateY(-50%);
      border-radius: var(--radius-full);
      background: var(--gl-primary-grad);
      transition: height var(--duration-micro) var(--ease-out);
    }

    .gl-profile-item:hover {
      border-color: color-mix(in srgb, var(--ring) 55%, var(--border));
      background: var(--card);
      transform: translateY(-1px);
      box-shadow: var(--shadow-card);
    }

    .gl-profile-item:hover::before,
    .gl-profile-item[data-selected="true"]::before {
      height: 58%;
    }

    .gl-profile-item:active {
      transform: scale(0.98);
    }

    .gl-profile-item:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .gl-profile-item[data-selected="true"] {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 7%, var(--card));
    }

    .gl-profile-avatar {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-lg);
      background: var(--gl-mark-grad);
      color: var(--primary-foreground);
      font-weight: var(--weight-bold);
      font-size: var(--text-sm);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: var(--shadow-glass-btn);
    }

    .gl-profile-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .gl-profile-name {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--foreground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gl-profile-role {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      font-weight: var(--weight-medium);
    }

    .gl-profile-chevron {
      color: var(--muted-foreground);
      flex-shrink: 0;
      transition:
        transform var(--duration-micro) var(--ease-out),
        color var(--duration-micro) var(--ease-out);
    }

    .gl-profile-item:hover .gl-profile-chevron {
      transform: translateX(3px);
      color: var(--primary);
    }

    /* ---------------------------------------------------------------
       PIN entry — identity header
       --------------------------------------------------------------- */
    .gl-pin-back {
      align-self: flex-start;
      margin-bottom: var(--space-3);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--muted-foreground);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 70%, transparent);
      cursor: pointer;
      font-family: inherit;
      transition: color var(--duration-micro) var(--ease-out);
    }

    .gl-pin-back:hover {
      color: var(--foreground);
      border-color: var(--ring);
    }

    .gl-pin-back:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .gl-pin-identity {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: var(--space-3);
    }

    .gl-pin-avatar {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-2xl);
      background: var(--gl-mark-grad);
      color: var(--primary-foreground);
      font-weight: var(--weight-bold);
      font-size: var(--text-lg);
      display: grid;
      place-items: center;
      margin-bottom: var(--space-3);
      box-shadow: var(--shadow-glass-btn);
    }

    .gl-pin-identity-pill {
      font-size: var(--text-2xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 2px var(--space-3);
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
      color: var(--primary);
      margin-bottom: var(--space-2);
    }

    .gl-pin-name {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      margin: 0;
      color: var(--foreground);
    }

    .gl-pin-role {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 2px 0 0;
    }

    .gl-pin-prompt {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--foreground);
      margin: var(--space-2) 0 var(--space-1);
      text-align: center;
    }

    .gl-pin-hint {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      margin: 0 0 var(--space-3);
      text-align: center;
    }

    /* ---------------------------------------------------------------
       PIN dots
       --------------------------------------------------------------- */
    .gl-pin-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      margin-bottom: var(--space-2);
      outline: none;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--muted) 70%, transparent);
      border: 1px solid var(--border);
    }

    .gl-pin-group:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: var(--space-2);
    }

    .gl-pin-dot {
      width: 12px;
      height: 12px;
      border-radius: var(--radius-full);
      border: 2px solid color-mix(in srgb, var(--muted-foreground) 42%, transparent);
      background: transparent;
      transition:
        background var(--duration-micro) var(--ease-out),
        border-color var(--duration-micro) var(--ease-out),
        transform var(--duration-micro) var(--ease-out);
    }

    .gl-pin-dot.is-filled {
      background: var(--gl-primary-grad);
      border-color: transparent;
      animation: gl-pin-pop var(--duration-micro) var(--ease-out);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--income) 14%, transparent);
    }

    @keyframes gl-pin-pop {
      from { transform: scale(0.6); }
      to   { transform: scale(1); }
    }

    .gl-pin-status {
      min-height: 24px;
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--muted-foreground);
      text-align: center;
      margin: 0 0 var(--space-4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
    }

    .gl-pin-status--error {
      color: var(--expense);
      animation: gl-shake 0.3s ease-in-out;
    }

    @keyframes gl-shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-4px); }
      40%, 80% { transform: translateX(4px); }
    }

    .gl-pin-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid color-mix(in srgb, var(--primary) 25%, transparent);
      border-top-color: var(--primary);
      border-radius: var(--radius-full);
      animation: gl-spin 0.6s linear infinite;
      display: inline-block;
    }

    @keyframes gl-spin {
      to { transform: rotate(360deg); }
    }

    /* ---------------------------------------------------------------
       Keypad
       --------------------------------------------------------------- */
    .gl-pin-keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
      width: 100%;
      max-width: 300px;
      margin: 0 auto var(--space-5);
    }

    .gl-pin-key {
      min-height: 60px;
      border-radius: var(--radius-xl);
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 74%, transparent);
      color: var(--foreground);
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      font-variant-numeric: lining-nums tabular-nums;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition:
        transform var(--duration-micro) var(--ease-out),
        background var(--duration-micro) var(--ease-out),
        border-color var(--duration-micro) var(--ease-out),
        box-shadow var(--duration-micro) var(--ease-out);
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .gl-pin-key:hover:not(:disabled) {
      background: var(--card);
      border-color: color-mix(in srgb, var(--ring) 55%, var(--border));
      transform: translateY(-1px);
      box-shadow: var(--shadow-card);
    }

    .gl-pin-key:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .gl-pin-key:active:not(:disabled) {
      transform: scale(0.96);
      background: color-mix(in srgb, var(--primary) 8%, var(--card));
      border-color: var(--primary);
    }

    .gl-pin-key:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .gl-pin-key--action {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      background: transparent;
      border-color: transparent;
    }

    .gl-pin-key--action:hover:not(:disabled) {
      background: var(--muted);
      border-color: var(--border);
      box-shadow: none;
    }

    .gl-pin-clear-text {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
    }

    /* ---------------------------------------------------------------
       Trust badge, bootstrap, status helpers
       --------------------------------------------------------------- */
    .gl-login-trust-badge {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-2xs);
      line-height: var(--leading-body);
      color: var(--muted-foreground);
      margin-top: var(--space-5);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border);
      width: 100%;
      justify-content: center;
      text-align: center;
    }

    .gl-login-trust-badge svg {
      color: var(--income);
      flex-shrink: 0;
    }

    .gl-pin-bootstrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-1);
      margin-top: var(--space-1);
    }

    .gl-pin-bootstrap-text {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      margin: 0;
    }

    .gl-login-text-btn {
      background: none;
      border: none;
      padding: var(--space-1);
      color: var(--primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      font-family: inherit;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
      border-radius: var(--radius-sm);
    }

    .gl-login-text-btn:hover {
      color: var(--foreground);
    }

    .gl-login-text-btn:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .gl-login-profiles-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) 0;
      text-align: center;
      gap: var(--space-3);
    }

    .gl-login-hint {
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      margin: 0;
    }

    .gl-login-spinner {
      width: 26px;
      height: 26px;
      border: 3px solid color-mix(in srgb, var(--primary) 18%, transparent);
      border-top-color: var(--primary);
      border-radius: var(--radius-full);
      animation: gl-spin 0.6s linear infinite;
    }

    /* Dev-only harness notice. Deliberately loud enough to never be mistaken
       for production chrome; it only renders on a dev build. */
    .gl-login-devnotice {
      width: 100%;
      margin: 0 0 var(--space-4);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
      border: 1px dashed var(--pending);
      background: var(--pending-muted);
      color: var(--on-pending-muted);
      font-size: var(--text-2xs);
      line-height: var(--leading-body);
      text-align: center;
    }

    .gl-pin-banner {
      width: 100%;
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      font-size: var(--text-xs);
      margin-bottom: var(--space-3);
      text-align: center;
    }

    .gl-pin-banner--warning {
      background: var(--pending-muted);
      color: var(--on-pending-muted);
      border: 1px solid var(--pending);
    }

    /* ---------------------------------------------------------------
       PIN setup (shares this stylesheet, no card wrapper of its own)
       --------------------------------------------------------------- */
    .gl-login-screen > .gl-login-stage {
      width: 100%;
      max-width: 420px;
      background: color-mix(in srgb, var(--card) 92%, transparent);
      border: 1px solid color-mix(in srgb, var(--gl-white) 60%, transparent);
      border-radius: var(--radius-sheet);
      box-shadow: var(--shadow-glass-card);
      padding: var(--space-7) var(--space-5) var(--space-6);
      color: var(--foreground);
      position: relative;
      z-index: 1;
    }

    .gl-setup-prompt-wrap {
      text-align: center;
      margin-bottom: var(--space-3);
    }

    .gl-setup-step-badge {
      display: inline-block;
      font-size: var(--text-2xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.1em;
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
      border-radius: var(--radius-full);
      padding: var(--space-1) var(--space-3);
      margin: 0 0 var(--space-2);
    }

    .gl-setup-prompt-sub,
    .gl-pin-note {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      margin: var(--space-1) 0 0;
      text-align: center;
    }

    .gl-setup-success-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-3);
      padding: var(--space-4) 0;
    }

    .gl-setup-success-icon {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-full);
      display: grid;
      place-items: center;
      background: var(--gl-primary-grad);
      color: var(--primary-foreground);
      box-shadow: var(--shadow-glass-btn);
    }

    .gl-setup-success-title {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      margin: 0;
      color: var(--foreground);
    }

    .gl-setup-success-sub {
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      margin: 0;
      line-height: var(--leading-body);
    }

    .gl-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  </style>`;
}
