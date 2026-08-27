/**
 * Grace AI Drawer — composition stylesheet.
 *
 * Every value is a design-system token (design-system-extracted/tokens/*)
 * or a documented app-level pairing token from app.css (`--on-pending-muted`).
 * No new palette, radius, or motion curve. `prefers-reduced-motion` is
 * covered globally by the design-system motion guard (tokens/motion.css).
 */
export function renderAiDrawerStyles(): string {
  return `<style>
    /* --- floating action button -------------------------------------------- */
    .gl-aid-fab {
      position: fixed;
      right: var(--space-4);
      bottom: calc(var(--gl-mobilenav-h, 60px) + var(--space-4));
      width: calc(var(--touch-target-min) + var(--space-3));
      height: calc(var(--touch-target-min) + var(--space-3));
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      background: var(--primary);
      color: var(--primary-foreground);
      cursor: pointer;
      box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 25%, transparent);
      z-index: 300;
      transition: transform var(--duration-micro) var(--ease-out),
                  box-shadow var(--duration-micro) var(--ease-out);
    }
    .gl-aid-fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px color-mix(in srgb, var(--primary) 30%, transparent);
    }
    .gl-aid-fab:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    @media (min-width: 641px) {
      .gl-aid-fab { bottom: var(--space-6); }
    }

    /* --- backdrop + drawer --------------------------------------------------- */
    .gl-aid-backdrop {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--foreground) 40%, transparent);
      z-index: 800;
      animation: gl-aid-fade var(--duration-component) var(--ease-out);
    }
    .gl-aid-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(420px, 100vw);
      display: flex;
      flex-direction: column;
      background: var(--background);
      border-left: 1px solid var(--border);
      z-index: 810;
      animation: gl-aid-slide var(--duration-component) var(--ease-out);
    }
    @keyframes gl-aid-slide {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes gl-aid-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @media (max-width: 640px) {
      .gl-aid-drawer { width: 100vw; border-left: none; }
    }

    /* --- header ---------------------------------------------------------------- */
    .gl-aid-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--border);
      background: var(--card);
    }
    .gl-aid-mark {
      width: var(--space-8);
      height: var(--space-8);
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: var(--primary);
      color: var(--primary-foreground);
    }
    .gl-aid-heading {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .gl-aid-heading strong {
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      letter-spacing: var(--tracking-heading);
    }
    .gl-aid-heading span {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
    }
    .gl-aid-close {
      margin-left: auto;
      min-width: var(--touch-target-min);
      min-height: var(--touch-target-min);
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--muted-foreground);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: color var(--duration-micro) var(--ease-out);
    }
    .gl-aid-close:hover { color: var(--foreground); }
    .gl-aid-close:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }

    /* --- message stream ---------------------------------------------------------- */
    .gl-aid-stream {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
    }
    .gl-aid-row {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
      max-width: 100%;
    }
    .gl-aid-row--user {
      align-self: flex-end;
      align-items: flex-end;
    }
    .gl-aid-bubble {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      border-top-left-radius: 0;
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-sm);
      line-height: var(--leading-body);
    }
    .gl-aid-bubble--user {
      background: var(--primary);
      color: var(--primary-foreground);
      border: none;
      border-radius: var(--radius-md);
      border-bottom-right-radius: 0;
    }
    .gl-aid-bubble--error {
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
    }
    .gl-aid-bubble--typing {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--muted-foreground);
    }
    .gl-aid-meta {
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
    }
    .gl-aid-spinner {
      width: var(--space-3);
      height: var(--space-3);
      flex: none;
      border-radius: var(--radius-full);
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      animation: gl-aid-spin 0.7s linear infinite;
    }
    @keyframes gl-aid-spin { to { transform: rotate(360deg); } }

    /* --- cards --------------------------------------------------------------------- */
    .gl-aid-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--card);
    }
    .gl-aid-card--proposal {
      border-color: var(--warning);
    }
    .gl-aid-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .gl-aid-card-label {
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: var(--foreground);
    }
    .gl-aid-status {
      background: var(--pending-muted);
      color: var(--on-pending-muted);
      border-radius: var(--radius-full);
      padding: 1px var(--space-2);
      font-size: var(--text-2xs);
      font-weight: var(--weight-semibold);
      white-space: nowrap;
    }
    .gl-aid-warning {
      border: 1px solid var(--warning);
      background: color-mix(in srgb, var(--warning) 12%, transparent);
      color: var(--on-pending-muted);
      border-radius: var(--radius-sm);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
      line-height: var(--leading-body);
    }
    .gl-aid-facts {
      display: grid;
      gap: var(--space-1);
      font-size: var(--text-xs);
      line-height: var(--leading-body);
    }
    .gl-aid-fact {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .gl-aid-fact > span:first-child {
      color: var(--muted-foreground);
      flex: none;
    }
    .gl-aid-fact strong {
      font-weight: var(--weight-semibold);
      text-align: right;
    }
    .gl-aid-note {
      margin: 0;
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
      line-height: var(--leading-body);
    }
    .gl-aid-note--ai {
      color: var(--on-pending-muted);
      background: color-mix(in srgb, var(--warning) 8%, transparent);
      border-radius: var(--radius-sm);
      padding: var(--space-1) var(--space-2);
    }
    .gl-aid-provenance {
      display: grid;
      gap: var(--space-1);
      border-top: 1px dashed var(--border);
      padding-top: var(--space-2);
      font-size: var(--text-2xs);
      color: var(--muted-foreground);
    }
    .gl-aid-prov-row {
      display: flex;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .gl-aid-prov-row span:last-child {
      text-align: right;
      overflow-wrap: anywhere;
    }
    .gl-aid-card-btn {
      width: 100%;
      justify-content: center;
    }

    /* --- chips + input bar ------------------------------------------------------------ */
    .gl-aid-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: 0 var(--space-4) var(--space-3);
    }
    .gl-aid-chip {
      min-height: var(--touch-target-min);
      display: inline-flex;
      align-items: center;
      padding: 0 var(--space-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      background: var(--secondary);
      color: var(--secondary-foreground);
      font-family: inherit;
      font-size: var(--text-xs);
      cursor: pointer;
      transition: border-color var(--duration-micro) var(--ease-out),
                  color var(--duration-micro) var(--ease-out);
    }
    .gl-aid-chip:hover:not(:disabled) {
      border-color: var(--primary);
      color: var(--primary);
    }
    .gl-aid-chip:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    .gl-aid-chip:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .gl-aid-inputbar {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--border);
      background: var(--card);
    }
    .gl-aid-inputbar .gl-input {
      flex: 1;
      min-width: 0;
    }
    .gl-aid-send {
      min-width: var(--touch-target-min);
      min-height: var(--touch-target-min);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

  </style>`;
}
