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
      animation: gl-login-rise var(--duration-page) var(--ease-out);
    }
    .gl-login-stage--narrow { max-width: 400px; }
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
      margin-bottom: var(--space-10);
    }
    .gl-login-mark {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: var(--primary);
      color: var(--primary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gl-login-wordmark {
      font-family: var(--font-display);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--foreground);
      margin: var(--space-1) 0 0;
    }
    .gl-login-tagline {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 0;
    }

    /* --- heading ---------------------------------------------------------- */
    .gl-login-heading {
      font-size: var(--text-4xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      text-align: center;
      margin: 0 0 var(--space-8);
    }

    /* --- profile grid ----------------------------------------------------- */
    .gl-profile-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--space-4);
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .gl-profile-grid > li { display: flex; }
    .gl-profile-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      text-align: center;
      gap: var(--space-4);
      width: 100%;
      min-height: 208px;
      padding: var(--space-6) var(--space-4);
      font-family: inherit;
      color: inherit;
      cursor: pointer;
    }
    .gl-profile-card:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    .gl-profile-card[data-selected="true"] {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--accent);
    }
    .gl-profile-avatar {
      width: 72px;
      height: 72px;
      flex: none;
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background: var(--secondary);
      color: var(--secondary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      transition: transform var(--duration-component) var(--ease-spring),
                  background-color var(--duration-micro) var(--ease-out),
                  color var(--duration-micro) var(--ease-out),
                  border-color var(--duration-micro) var(--ease-out);
    }
    .gl-profile-card:hover .gl-profile-avatar { transform: scale(1.05); }
    .gl-profile-card[data-selected="true"] .gl-profile-avatar {
      background: var(--primary);
      border-color: var(--primary);
      color: var(--primary-foreground);
      transform: scale(1.05);
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
      line-height: var(--leading-heading);
      overflow-wrap: anywhere;
    }
    .gl-profile-role {
      font-size: var(--text-xs);
      line-height: 1.45;
      color: var(--muted-foreground);
      overflow-wrap: anywhere;
    }
    .gl-profile-chevron { display: none; color: var(--muted-foreground); flex: none; }

    .gl-login-hint {
      margin: var(--space-8) 0 0;
      font-size: var(--text-xs);
      color: var(--muted-foreground);
    }
    .gl-login-profiles-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-10) 0;
    }
    .gl-login-spinner--dark {
      width: 20px;
      height: 20px;
      border-radius: var(--radius-full);
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      animation: gl-login-spin 0.7s linear infinite;
    }
    .gl-login-alt {
      margin-top: var(--space-3);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--muted-foreground);
    }

    /* --- pin entry -------------------------------------------------------- */
    .gl-pin-back { align-self: flex-start; margin-bottom: var(--space-6); }
    .gl-pin-identity {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      text-align: center;
      margin-bottom: var(--space-8);
    }
    .gl-pin-avatar {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-full);
      background: var(--accent);
      color: var(--accent-foreground);
      border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--text-2xl);
      font-weight: var(--weight-semibold);
    }
    .gl-pin-name {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      margin: 0;
      overflow-wrap: anywhere;
    }
    .gl-pin-role { font-size: var(--text-xs); color: var(--muted-foreground); margin: 0; }
    .gl-pin-prompt {
      font-size: var(--text-md);
      font-weight: var(--weight-semibold);
      margin: 0 0 var(--space-5);
    }
    .gl-pin-group {
      display: flex;
      justify-content: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .gl-pin-group:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 8px;
      border-radius: var(--radius-full);
    }
    .gl-pin-group[data-shake="true"] { animation: gl-pin-shake var(--duration-component) var(--ease-out); }
    @keyframes gl-pin-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    .gl-pin-dot {
      width: 13px;
      height: 13px;
      border-radius: var(--radius-full);
      border: 1.5px solid var(--border);
      transition: background-color var(--duration-micro) var(--ease-out),
                  border-color var(--duration-micro) var(--ease-out),
                  transform var(--duration-micro) var(--ease-spring);
    }
    .gl-pin-dot.is-filled {
      background: var(--primary);
      border-color: var(--primary);
      transform: scale(1.15);
    }
    .gl-pin-status {
      min-height: 20px;
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin-bottom: var(--space-5);
      text-align: center;
    }
    .gl-pin-status--error { color: var(--destructive); }
    .gl-pin-spinner {
      width: 13px;
      height: 13px;
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
      max-width: 240px;
      margin: 0 auto;
    }
    .gl-pin-key {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      min-height: var(--touch-target-min);
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--foreground);
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: var(--weight-semibold);
      cursor: pointer;
      transition: background-color var(--duration-micro) var(--ease-out),
                  transform var(--duration-micro) var(--ease-out);
    }
    .gl-pin-key:hover:not(:disabled) { background: var(--secondary); }
    .gl-pin-key:active:not(:disabled) { transform: scale(0.94); background: var(--secondary); }
    .gl-pin-key:disabled { cursor: not-allowed; color: var(--muted-foreground); }
    .gl-pin-key--zero { grid-column: 2; }
    .gl-pin-key--action { color: var(--muted-foreground); }
    .gl-pin-note {
      margin: var(--space-6) 0 0;
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      text-align: center;
      line-height: var(--leading-body);
    }

    /* --- email fallback --------------------------------------------------- */
    .gl-login-panel { width: 100%; padding: var(--space-8) var(--space-6); }
    .gl-login-panel-title {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      margin: 0 0 var(--space-1);
    }
    .gl-login-panel-sub {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: 0 0 var(--space-6);
    }
    .gl-login-alert { margin-bottom: var(--space-5); }
    .gl-login-alert-icon { flex: none; width: 16px; height: 16px; margin-top: 1px; }
    .gl-login-field { margin-bottom: var(--space-4); }
    .gl-login-label { display: block; margin-bottom: var(--space-1); }
    .gl-login-input-wrap { position: relative; }
    .gl-login-input--pw { padding-right: var(--touch-target-min); }
    .gl-login-toggle-pw {
      position: absolute;
      top: 0; bottom: 0; right: 4px;
      width: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--muted-foreground);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: color var(--duration-micro) var(--ease-out);
    }
    .gl-login-toggle-pw:hover { color: var(--foreground); }
    .gl-login-toggle-pw:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px; }
    .gl-login-submit { margin-top: var(--space-2); }
    .gl-login-spinner {
      width: 16px; height: 16px;
      border-radius: var(--radius-full);
      border: 2px solid color-mix(in srgb, var(--primary-foreground) 35%, transparent);
      border-top-color: var(--primary-foreground);
      animation: gl-login-spin 0.7s linear infinite;
    }

    /* --- responsive ------------------------------------------------------- */
    @media (max-width: 900px) {
      .gl-profile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 640px) {
      .gl-login-screen { padding: var(--space-8) var(--space-5); align-items: flex-start; }
      .gl-login-brand { margin-bottom: var(--space-8); }
      .gl-login-heading { font-size: var(--text-3xl); margin-bottom: var(--space-6); }
      .gl-profile-grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
      .gl-profile-card {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        min-height: 88px;
        padding: var(--space-4);
      }
      .gl-profile-avatar { width: 56px; height: 56px; font-size: var(--text-lg); }
      .gl-pin-keypad { max-width: 272px; }
      .gl-profile-text { flex: 1; }
      .gl-profile-chevron { display: block; }
      .gl-login-hint { margin-top: var(--space-6); }
    }
  </style>`;
}
