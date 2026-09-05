/**
 * Login-screen layout & styling — "Vault Terminal".
 *
 * Emerald Vault identity: the left/top panel is the same dark vault chrome as
 * the app sidebar (—sidebar), the workspace is porcelain (—background). Strict
 * design-system tokens throughout; color-mix() derives tints from tokens so no
 * raw literals enter this file.
 */
export function renderLoginStylesHtml(): string {
  return `<style>
    /* --- Screen (base: shared with PinSetup) --- */
    .gl-login-screen {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) var(--space-4);
      background: var(--background);
      color: var(--foreground);
      font-family: var(--font-sans);
      position: relative;
    }

    /* --- Split-screen vault terminal (LoginPage only) --- */
    .gl-login-screen--vault {
      padding: 0;
    }

    .gl-login-vault {
      display: grid;
      grid-template-columns: minmax(380px, 500px) minmax(0, 1fr);
      width: 100%;
      min-height: 100vh;
    }

    .gl-vault-panel {
      background: var(--sidebar);
      color: var(--sidebar-foreground);
      border-right: 1px solid color-mix(in srgb, var(--sidebar-primary) 22%, transparent);
      padding: var(--space-7) var(--space-6);
      display: flex;
      flex-direction: column;
    }

    .gl-vault-panel__inner {
      width: 100%;
      max-width: 380px;
      margin: 0 auto;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .gl-vault-brand {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .gl-vault-mark {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-lg);
      background: var(--sidebar-accent);
      color: var(--sidebar-primary);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      border: 1px solid color-mix(in srgb, var(--sidebar-primary) 30%, transparent);
    }

    .gl-vault-brandtext {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .gl-vault-wordmark {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: var(--weight-bold);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--sidebar-foreground);
    }

    .gl-vault-church {
      font-size: var(--text-xs);
      color: color-mix(in srgb, var(--sidebar-foreground) 72%, transparent);
      letter-spacing: 0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .gl-vault-hero {
      margin-top: auto;
      padding-top: var(--space-7);
    }

    .gl-vault-hero::before {
      content: "";
      display: block;
      width: 36px;
      height: 2px;
      background: var(--gl-brass-500);
      border-radius: var(--radius-sm);
      margin-bottom: var(--space-4);
    }

    .gl-vault-eyebrow {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--sidebar-primary) 80%, var(--sidebar-foreground));
      margin: 0 0 var(--space-2);
    }

    .gl-vault-title {
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      color: var(--sidebar-foreground);
      margin: 0 0 var(--space-3);
    }

    .gl-vault-sub {
      font-size: var(--text-sm);
      line-height: var(--leading-body);
      color: color-mix(in srgb, var(--sidebar-foreground) 72%, transparent);
      margin: 0;
    }

    .gl-vault-facts {
      list-style: none;
      margin: var(--space-6) 0 0;
      padding: var(--space-5) 0 0;
      border-top: 1px solid color-mix(in srgb, var(--sidebar-primary) 18%, transparent);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .gl-vault-facts li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--text-sm);
      color: color-mix(in srgb, var(--sidebar-foreground) 86%, transparent);
    }

    .gl-vault-facts svg {
      color: var(--sidebar-primary);
      flex-shrink: 0;
    }

    .gl-vault-foot {
      margin-top: auto;
      padding-top: var(--space-7);
      font-size: var(--text-2xs);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--sidebar-foreground) 55%, transparent);
    }

    .gl-login-workspace {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-7) var(--space-5);
    }

    @media (max-width: 959px) {
      .gl-login-vault {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
      }

      .gl-vault-panel {
        border-right: none;
        border-bottom: 1px solid color-mix(in srgb, var(--sidebar-primary) 22%, transparent);
        padding: var(--space-3) var(--space-4);
      }

      .gl-vault-panel__inner {
        max-width: none;
      }

      .gl-vault-hero,
      .gl-vault-facts,
      .gl-vault-foot {
        display: none;
      }

      .gl-vault-mark {
        width: 40px;
        height: 40px;
      }

      .gl-login-workspace {
        align-items: flex-start;
        padding: var(--space-5) var(--space-4);
      }
    }

    /* --- Card --- */
    .gl-login-card {
      width: 100%;
      max-width: 480px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-elevated);
      padding: var(--space-7) var(--space-6);
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      animation: gl-login-card-in var(--duration-component) var(--ease-out);
    }

    .gl-login-card--narrow {
      max-width: 420px;
      padding: var(--space-6) var(--space-5);
    }

    @media (max-width: 400px) {
      .gl-login-card {
        padding: var(--space-6) var(--space-4);
      }
    }

    @keyframes gl-login-card-in {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.99);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .gl-login-card {
        animation: none;
      }

      .gl-pin-status--error {
        animation: none;
      }

      .gl-profile-item,
      .gl-pin-key,
      .gl-profile-chevron {
        transition: none;
      }
    }

    /* --- Stage & Hero Typography --- */
    .gl-login-stage {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .gl-login-hero {
      width: 100%;
      text-align: center;
      margin-bottom: var(--space-5);
    }

    .gl-login-eyebrow {
      font-size: var(--text-xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted-foreground);
      margin: 0 0 var(--space-1);
    }

    .gl-login-heading {
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
      line-height: var(--leading-heading);
      color: var(--foreground);
      margin: 0 0 var(--space-2);
    }

    .gl-login-subheading {
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      line-height: var(--leading-body);
      margin: 0;
    }

    /* --- Profile Selection Roster --- */
    .gl-login-profiles {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      width: 100%;
      margin: 0 0 var(--space-4);
      padding: 0;
    }

    .gl-profile-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      min-height: var(--touch-target-min);
      padding: var(--space-3) var(--space-4);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: inherit;
      transition: all var(--duration-micro) var(--ease-out);
    }

    .gl-profile-item:hover {
      border-color: var(--ring);
      background: var(--muted);
      transform: translateY(-1px);
    }

    .gl-profile-item:active {
      /* 0.98, matching .gl-pin-key. D14 brought the PIN key into the contract
         and this control, the first one a user touches, was missed. */
      transform: scale(0.98);
    }

    .gl-profile-item:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .gl-profile-item[data-selected="true"] {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, var(--card));
    }

    .gl-profile-avatar {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      background: var(--primary);
      color: var(--primary-foreground);
      font-weight: var(--weight-bold);
      font-size: var(--text-sm);
      display: grid;
      place-items: center;
      flex-shrink: 0;
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
      transition: transform var(--duration-micro) var(--ease-out);
    }

    .gl-profile-item:hover .gl-profile-chevron {
      transform: translateX(3px);
      color: var(--foreground);
    }

    /* --- PIN Entry Identity Header --- */
    .gl-pin-back {
      align-self: flex-start;
      margin-bottom: var(--space-4);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--muted-foreground);
      padding: var(--space-2) var(--space-2);
      border-radius: var(--radius-sm);
      cursor: pointer;
      background: none;
      border: none;
      font-family: inherit;
    }

    .gl-pin-back:hover {
      color: var(--foreground);
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
      margin-bottom: var(--space-4);
    }

    .gl-pin-avatar {
      width: 52px;
      height: 52px;
      border-radius: var(--radius-full);
      background: var(--primary);
      color: var(--primary-foreground);
      font-weight: var(--weight-bold);
      font-size: var(--text-base);
      display: grid;
      place-items: center;
      margin-bottom: var(--space-2);
      box-shadow: var(--shadow-sm);
    }

    .gl-pin-identity-pill {
      font-size: var(--text-2xs);
      font-weight: var(--weight-semibold);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      background: var(--muted);
      color: var(--muted-foreground);
      margin-bottom: var(--space-1);
    }

    .gl-pin-name {
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
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
      margin: var(--space-3) 0 var(--space-1);
      text-align: center;
    }

    .gl-pin-hint {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      margin: 0 0 var(--space-4);
      text-align: center;
    }

    /* --- PIN Dots Indicator --- */
    .gl-pin-group {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      margin-bottom: var(--space-2);
      outline: none;
      border-radius: var(--radius-sm);
    }

    .gl-pin-group:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: var(--space-2);
    }

    .gl-pin-dot {
      width: 14px;
      height: 14px;
      border-radius: var(--radius-full);
      border: 2px solid var(--border);
      background: transparent;
      transition: all var(--duration-micro) var(--ease-out);
    }

    .gl-pin-dot.is-filled {
      background: var(--primary);
      border-color: var(--primary);
      transform: scale(1.15);
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

    /* --- PIN Keypad --- */
    .gl-pin-keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3);
      width: 100%;
      max-width: 280px;
      margin: 0 auto var(--space-5);
    }

    .gl-pin-key {
      min-height: 56px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--foreground);
      font-family: var(--font-display);
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--duration-micro) var(--ease-out);
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .gl-pin-key:hover:not(:disabled) {
      background: var(--muted);
      border-color: var(--ring);
      transform: translateY(-1px);
    }

    .gl-pin-key:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    .gl-pin-key:active:not(:disabled) {
      transform: scale(0.98);
    }

    .gl-pin-key:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .gl-pin-key--action {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      color: var(--muted-foreground);
    }

    .gl-pin-clear-text {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
    }

    /* --- Security Trust Badge & Bootstrap --- */
    .gl-login-trust-badge {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border);
      width: 100%;
      justify-content: center;
      text-align: center;
    }

    .gl-pin-bootstrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-1);
      margin-top: var(--space-2);
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
      font-weight: var(--weight-medium);
      font-family: inherit;
      cursor: pointer;
      text-decoration: underline;
      border-radius: var(--radius-sm);
    }

    .gl-login-text-btn:hover {
      color: var(--foreground);
    }

    .gl-login-text-btn:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    /* --- Status Helpers --- */
    .gl-login-profiles-status {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) 0;
      text-align: center;
      gap: var(--space-2);
    }

    .gl-login-hint {
      font-size: var(--text-sm);
      color: var(--muted-foreground);
      margin: 0;
    }

    .gl-login-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid color-mix(in srgb, var(--primary) 20%, transparent);
      border-top-color: var(--primary);
      border-radius: var(--radius-full);
      animation: gl-spin 0.6s linear infinite;
    }

    .gl-pin-banner {
      width: 100%;
      padding: var(--space-3);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
      margin-bottom: var(--space-3);
      text-align: center;
    }

    .gl-pin-banner--warning {
      background: var(--pending-muted);
      color: var(--on-pending-muted);
      border: 1px solid var(--pending);
    }
  </style>`;
}
