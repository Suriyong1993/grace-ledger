/**
 * Login-screen layout. Every value is a design-system token — this file adds
 * composition (grid, keypad geometry, entrance), never a new palette, scale or
 * radius. Surfaces, borders and buttons come from .gl-card / .gl-btn in the
 * application stylesheet.
 */
export function renderLoginStylesHtml(): string {
  return `<style>
    .gl-login-screen {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-10) var(--space-6);
      font-family: var(--font-sans);
      background: var(--background);
      color: var(--foreground);
    }
    .gl-login-stage {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      animation: gl-login-rise var(--duration-page) var(--ease-out);
    }
    .gl-login-stage--narrow { max-width: 380px; }
    @keyframes gl-login-rise {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* --- brand ------------------------------------------------------------ */
    .gl-login-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }
    .gl-login-mark {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--primary);
      color: var(--primary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gl-login-wordmark {
      font-family: var(--font-display);
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--foreground);
      margin: var(--space-1) 0 0;
    }
    .gl-login-tagline {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 0;
    }

    .gl-login-hero {
      width: 100%;
      text-align: center;
      margin-bottom: var(--space-2);
    }
    .gl-login-hero--compact {
      margin-bottom: 0;
    }
    .gl-login-subheading {
      max-width: 52ch;
      margin: 0 auto;
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      line-height: var(--leading-body);
    }
    .gl-login-identity-strip {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }
    .gl-login-identity-chip {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 82%, transparent);
      color: var(--foreground);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      letter-spacing: 0.02em;
    }
    .gl-login-identity-chip--muted {
      color: var(--muted-foreground);
    }

    /* --- heading ---------------------------------------------------------- */
    .gl-login-heading {
      font-size: var(--text-3xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      text-align: center;
      margin: 0 0 var(--space-8);
    }
    .gl-login-eyebrow {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--muted-foreground);
      letter-spacing: var(--tracking-heading);
      text-align: center;
      margin: 0 0 var(--space-2);
    }

    /* --- profile layouts --------------------------------------------------- */
    .gl-login-profiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-4);
      width: 100%;
      max-width: 880px;
      margin: 0;
      padding: 0;
    }
    .gl-login-profiles--row-compact {
      display: flex;
      justify-content: center;
    }
    .gl-profile-item {
      font-family: inherit;
      color: inherit;
      cursor: pointer;
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      background:
        color-mix(in srgb, var(--primary) 4%, var(--card));
      box-shadow: var(--shadow-card);
      transition: transform var(--duration-micro) var(--ease-spring),
                  border-color var(--duration-micro) var(--ease-out),
                  box-shadow var(--duration-micro) var(--ease-out);
    }
    .gl-profile-item--card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      text-align: center;
      gap: var(--space-4);
      width: 100%;
      min-height: 190px;
      padding: var(--space-6) var(--space-4);
    }
    .gl-profile-item--row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      text-align: left;
      gap: var(--space-4);
      min-height: max(72px, var(--touch-target-min));
      padding: var(--space-3) var(--space-4);
    }
    .gl-profile-item:hover {
      border-color: var(--primary);
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
      background: color-mix(in srgb, var(--primary) 4%, var(--card));
    }
    .gl-profile-avatar {
      width: 68px;
      height: 68px;
      flex: none;
      border-radius: var(--radius-full);
      border: 1.5px solid color-mix(in srgb, var(--primary) 24%, var(--border));
      background: color-mix(in srgb, var(--secondary) 88%, var(--card));
      color: var(--secondary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      transition: transform var(--duration-component) var(--ease-spring),
                  background-color var(--duration-micro) var(--ease-out),
                  color var(--duration-micro) var(--ease-out),
                  border-color var(--duration-micro) var(--ease-out);
    }
    .gl-profile-item[data-selected="true"] .gl-profile-avatar {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--primary-foreground);
    }
    .gl-profile-text {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }
    .gl-profile-name {
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
      line-height: 1.35;
      word-break: normal;
      overflow-wrap: break-word;
    }
    .gl-profile-role {
      font-size: var(--text-xs);
      line-height: 1.45;
      color: var(--muted-foreground);
      overflow-wrap: anywhere;
      background: var(--secondary);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-full);
      align-self: center;
    }
    .gl-profile-chevron { display: none; color: var(--muted-foreground); flex: none; }
    .gl-profile-avatar--sm {
      width: 50px;
      height: 50px;
      font-size: var(--text-base);
    }
    .gl-profile-role--inline {
      background: transparent;
      padding: 0;
      align-self: auto;
    }

    .gl-login-hint {
      margin: var(--space-6) 0 0;
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      text-align: center;
    }
    .gl-login-profiles-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-10) 0;
    }
    .gl-login-spinner--dark {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full);
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      animation: gl-login-spin 0.7s linear infinite;
    }
    .gl-login-profiles-hint {
      margin-top: var(--space-8);
      display: flex;
      justify-content: center;
    }
    .gl-login-text-btn {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch-target-min);
      background: transparent;
      border: none;
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      transition: color var(--duration-micro) var(--ease-out);
    }
    .gl-login-text-btn:hover {
      color: var(--foreground);
    }
    .gl-login-text-btn:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    /* --- pin entry -------------------------------------------------------- */
    .gl-pin-back {
      align-self: flex-start;
      margin-bottom: var(--space-4);
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      color: var(--muted-foreground);
    }
    .gl-pin-back:hover { color: var(--foreground); }
    .gl-pin-identity {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      text-align: center;
      margin-bottom: var(--space-6);
    }
    .gl-pin-identity-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 var(--space-3);
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      color: var(--primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .gl-pin-avatar {
      width: 76px;
      height: 76px;
      border-radius: var(--radius-full);
      background:
        radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 55%),
        var(--accent);
      color: var(--accent-foreground);
      border: 2px solid color-mix(in srgb, var(--primary) 28%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
    }
    .gl-pin-name {
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      margin: 0;
      overflow-wrap: anywhere;
    }
    .gl-pin-role {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 0;
      background: var(--secondary);
      padding: 2px var(--space-3);
      border-radius: var(--radius-full);
    }
    .gl-pin-prompt {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      color: var(--foreground);
      margin: 0;
    }
    .gl-pin-hint {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 0 0 var(--space-3);
      text-align: center;
    }
    .gl-pin-banner {
      width: 100%;
      border-radius: var(--radius-lg);
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-3);
      border: 1px solid var(--border);
      background: var(--secondary);
      color: var(--foreground);
      font-size: var(--text-xs);
      line-height: var(--leading-body);
    }
    .gl-pin-banner--warning {
      border-color: color-mix(in srgb, var(--warning) 40%, var(--border));
      background: color-mix(in srgb, var(--warning) 10%, var(--card));
    }
    .gl-pin-group {
      display: flex;
      justify-content: center;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
      padding: var(--space-2);
    }
    .gl-pin-group:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 8px;
      border-radius: var(--radius-full);
    }
    .gl-pin-group[data-shake="true"] { animation: gl-pin-shake 320ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
    @keyframes gl-pin-shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
      40%, 60% { transform: translate3d(4px, 0, 0); }
    }
    .gl-pin-dot {
      width: 14px;
      height: 14px;
      border-radius: var(--radius-full);
      border: 2px solid color-mix(in srgb, var(--border) 82%, var(--foreground));
      background: color-mix(in srgb, var(--card) 92%, var(--muted));
      transition: background-color var(--duration-micro) var(--ease-out),
                  border-color var(--duration-micro) var(--ease-out),
                  transform var(--duration-micro) var(--ease-spring);
    }
    .gl-pin-dot.is-filled {
      background: var(--primary);
      border-color: var(--primary);
      transform: scale(1.12);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent);
    }
    .gl-pin-status {
      min-height: 22px;
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
      text-align: center;
      padding: 0 var(--space-4);
    }
    .gl-pin-status--error {
      color: var(--destructive);
      font-weight: var(--weight-medium);
    }
    .gl-pin-spinner {
      width: 14px;
      height: 14px;
      flex: none;
      border-radius: var(--radius-full);
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      animation: gl-login-spin 0.7s linear infinite;
    }
    @keyframes gl-login-spin { to { transform: rotate(360deg); } }
    .gl-pin-keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      width: 100%;
      max-width: 270px;
      margin: 0 auto;
    }
    .gl-pin-key {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      min-height: 56px;
      min-width: 56px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background:
        color-mix(in srgb, var(--accent) 45%, var(--card));
      color: var(--foreground);
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: var(--weight-semibold);
      cursor: pointer;
      touch-action: manipulation;
      transition: background-color var(--duration-micro) var(--ease-out),
                  border-color var(--duration-micro) var(--ease-out),
                  transform var(--duration-micro) var(--ease-out),
                  box-shadow var(--duration-micro) var(--ease-out);
    }
    .gl-pin-key:hover:not(:disabled) {
      background: var(--secondary);
      border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
    }
    .gl-pin-key:active:not(:disabled) {
      transform: scale(0.98);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
    }
    .gl-pin-key:disabled {
      cursor: not-allowed;
      color: var(--muted-foreground);
      opacity: 0.6;
    }
    .gl-pin-key--zero {
      grid-column: 2;
    }
    .gl-pin-key--action {
      color: var(--muted-foreground);
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      letter-spacing: 0.02em;
    }
    .gl-pin-key--clear {
      grid-column: 1;
      grid-row: 4;
    }
    .gl-pin-clear-text {
      font-size: var(--text-sm);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.05em;
    }

    /* --- pin setup & bootstrap -------------------------------------------- */
    .gl-setup-prompt-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: var(--space-4);
    }
    .gl-setup-step-badge {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      color: var(--primary);
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      padding: 2px var(--space-3);
      border-radius: var(--radius-full);
      margin: 0 0 var(--space-2);
    }
    .gl-setup-prompt-sub {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 0;
    }
    .gl-setup-success-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-8) var(--space-6);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-2xl);
      box-shadow: 0 12px 32px color-mix(in srgb, var(--foreground) 5%, transparent);
      animation: gl-login-rise var(--duration-page) var(--ease-out);
    }
    .gl-setup-success-icon {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-full);
      background: color-mix(in srgb, var(--success) 15%, transparent);
      color: var(--success);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-4);
    }
    .gl-setup-success-title {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      margin: 0 0 var(--space-2);
    }
    .gl-setup-success-sub {
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      margin: 0;
      line-height: var(--leading-body);
    }

    /* --- responsive ------------------------------------------------------- */
    /* --- modern login polish ---------------------------------------------- */
    .gl-login-screen {
      position: relative;
      overflow: hidden;
      background: var(--background);
    }
    .gl-login-screen::before,
    .gl-login-screen::after { content: none; }

    /* --- split-screen shell -------------------------------------------------
       One persistent brand panel, one working column. The panel carries the
       wordmark and the three steps of sign-in — a real sequence, so it is
       numbered. Flat solid surface: no gradient, no glow, no circles. */
    .gl-login-main {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
    .gl-login-panel { display: none; }
    @media (min-width: 880px) {
      .gl-login-screen {
        display: grid;
        grid-template-columns: minmax(320px, 420px) 1fr;
        padding: 0;
        align-items: stretch;
      }
      .gl-login-panel {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--space-8);
        padding: var(--space-10) var(--space-8) var(--space-10) var(--space-10);
        background: var(--primary-dark);
        color: var(--primary-foreground);
      }
      .gl-login-panel .gl-login-brand {
        align-items: flex-start;
        text-align: left;
      }
      .gl-login-panel .gl-login-mark {
        background: var(--primary-foreground);
        color: var(--primary-dark);
      }
      .gl-login-panel .gl-login-wordmark {
        font-size: var(--text-lg);
        letter-spacing: 0.16em;
        color: var(--primary-foreground);
      }
      .gl-login-panel .gl-login-tagline {
        color: color-mix(in srgb, var(--primary-foreground) 72%, transparent);
      }
      .gl-login-steps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
      }
      .gl-login-steps li {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-3) 0;
        font-size: var(--text-sm);
        color: color-mix(in srgb, var(--primary-foreground) 88%, transparent);
      }
      .gl-login-steps li + li {
        border-top: 1px solid color-mix(in srgb, var(--primary-foreground) 16%, transparent);
      }
      .gl-login-step-num {
        font-family: var(--font-display);
        font-weight: var(--weight-bold);
        font-size: var(--text-xs);
        color: color-mix(in srgb, var(--primary-foreground) 60%, transparent);
      }
      .gl-login-main { padding: var(--space-10) var(--space-6); }
      .gl-login-stage--narrow { max-width: 400px; }
    }
    @media (max-width: 879px) {
      .gl-login-screen {
        flex-direction: column;
        padding: var(--space-6) var(--space-4);
      }
      .gl-login-main { width: 100%; display: flex; justify-content: center; }
      /* Compact brand header — the panel's steps belong to wide screens only. */
      .gl-login-panel {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        max-width: 420px;
        margin: 0 auto var(--space-6);
        padding: 0;
        background: transparent;
        color: inherit;
      }
      .gl-login-panel .gl-login-brand {
        flex-direction: row;
        align-items: center;
        gap: var(--space-3);
        margin: 0;
      }
      .gl-login-panel .gl-login-wordmark { margin: 0; }
      .gl-login-panel .gl-login-tagline { display: none; }
      .gl-login-steps { display: none; }
    }

    /* --- view transitions ----------------------------------------------------
       Direction-aware: selecting a profile (deeper into the flow) arrives from
       the right; going back arrives from the left. Cross-fade under reduced
       motion, matching the motion token contract. */
    .gl-login-stage {
      animation: gl-view-forward var(--duration-page) var(--ease-out);
    }
    .gl-login-stage--narrow {
      animation-name: gl-view-back;
    }
    @keyframes gl-view-forward {
      from { opacity: 0; transform: translateX(24px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes gl-view-back {
      from { opacity: 0; transform: translateX(-24px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .gl-login-stage {
        animation-name: gl-login-rise;
      }
      @keyframes gl-login-rise {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    }
    .gl-login-stage { gap: var(--space-5); }
    .gl-login-brand { margin-bottom: var(--space-3); }
    .gl-login-mark {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      box-shadow: 0 10px 24px color-mix(in srgb, var(--primary) 20%, transparent);
    }
    .gl-login-heading { letter-spacing: -0.03em; }
    .gl-login-profiles {
      gap: var(--space-3);
      max-width: 920px;
    }
    .gl-profile-item {
      border-radius: 18px;
      box-shadow: 0 8px 22px rgb(23 23 23 / 0.05);
    }
    .gl-profile-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px color-mix(in srgb, var(--primary) 14%, transparent);
    }
    .gl-pin-keypad { gap: var(--space-3); max-width: 282px; }
    .gl-pin-key {
      border-width: 1px;
      box-shadow: 0 4px 12px rgb(23 23 23 / 0.04);
    }
    .gl-pin-key:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 18px color-mix(in srgb, var(--primary) 12%, transparent);
    }
    .gl-pin-bootstrap {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding-top: var(--space-4);
      border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    }
    .gl-pin-bootstrap-text {
      margin: 0;
      color: var(--muted-foreground);
      font-size: var(--text-xs);
    }
    .gl-login-text-btn {
      color: var(--primary);
      font-weight: var(--weight-semibold);
    }
    .gl-login-text-btn:hover:not(:disabled) {
      color: var(--primary-dark);
      background: var(--primary-light);
    }
    .gl-login-text-btn:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    @media (max-width: 640px) {
      .gl-login-screen {
        padding: var(--space-6) var(--space-4);
        align-items: center;
      }
      .gl-login-brand { margin-bottom: var(--space-6); }
      .gl-login-heading { font-size: var(--text-2xl); margin-bottom: var(--space-6); }
      .gl-login-subheading { font-size: var(--text-xs); }
      .gl-login-profiles {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-3);
      }
      .gl-profile-item {
        width: 100%;
      }
      .gl-profile-item--card {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        min-height: max(72px, var(--touch-target-min));
        padding: var(--space-3) var(--space-4);
      }
      .gl-profile-avatar { width: 52px; height: 52px; font-size: var(--text-base); }
      .gl-profile-text { flex: 1; align-items: flex-start; }
      .gl-profile-role { align-self: flex-start; }
      .gl-profile-chevron { display: block; }
      .gl-pin-keypad { max-width: 260px; gap: var(--space-2); }
      .gl-pin-key { min-height: 52px; min-width: 52px; font-size: var(--text-xl); }
    }
  </style>`;
}
