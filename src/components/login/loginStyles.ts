/**
 * Login-screen layout & styling.
 * Architectural Vault Terminal design — sleek, calm, secure, and authoritative.
 * Uses strict design-system tokens throughout.
 */
export function renderLoginStylesHtml(): string {
  return `<style>
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

    .gl-login-card {
      width: 100%;
      max-width: 520px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-elevated);
      padding: var(--space-8) var(--space-6);
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      animation: gl-login-card-in var(--duration-component) var(--ease-out);
    }

    .gl-login-card--narrow {
      max-width: 420px;
      padding: var(--space-7) var(--space-5);
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

    /* --- Institutional Brand Header --- */
    .gl-login-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: var(--space-6);
    }

    .gl-login-mark {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--primary);
      color: var(--primary-foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-3);
      box-shadow: var(--shadow-sm);
    }

    .gl-login-wordmark {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: var(--weight-bold);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--foreground);
      margin: 0;
    }

    .gl-login-tagline {
      font-size: var(--text-xs);
      color: var(--muted-foreground);
      margin: var(--space-1) 0 0;
      letter-spacing: 0.02em;
    }

    .gl-login-divider {
      width: 100%;
      height: 1px;
      background: var(--border);
      margin: 0 0 var(--space-6);
      border: none;
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
      transform: scale(0.99);
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
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
    }

    .gl-pin-back:hover {
      color: var(--foreground);
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
      min-height: 54px;
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

    .gl-pin-key:active:not(:disabled) {
      transform: scale(0.95);
      background: color-mix(in srgb, var(--primary) 12%, var(--card));
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
      padding: 0;
      color: var(--primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      cursor: pointer;
      text-decoration: underline;
    }

    .gl-login-text-btn:hover {
      color: var(--foreground);
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
      color: var(--pending-foreground);
      border: 1px solid var(--pending);
    }
  </style>`;
}
