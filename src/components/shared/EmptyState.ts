export interface EmptyStateAction {
  label: string;
  type: 'button' | 'link';
  href?: string;
  id?: string;
  variant?: 'primary' | 'secondary';
}

export interface EmptyStateProps {
  icon?: string;
  message: string;
  hint?: string;
  action?: EmptyStateAction;
}

/**
 * Shared empty-state renderer (R3 candidate promoted).
 *
 * Consolidates the three divergent empty-state paddings across
 * TransactionsPage / FundsPage / MembersPage / OfferingPage
 * into a single component-class pattern.
 *
 * Structure:
 *   .gl-card.gl-empty-center
 *     .gl-empty-center__icon   (optional, SVG)
 *     .gl-empty-center__msg
 *     .gl-empty-center__hint    (optional)
 *     button.gl-btn / a.gl-btn  (optional action)
 */
export function renderEmptyStateHtml(props: EmptyStateProps): string {
  const { icon, message, hint, action } = props;

  const iconHtml = icon
    ? `<div class="gl-empty-center__icon" aria-hidden="true">${icon}</div>`
    : '';

  const hintHtml = hint
    ? `<p class="gl-empty-center__hint">${hint}</p>`
    : '';

  let actionHtml = '';
  if (action) {
    const variant = action.variant || (action.type === 'link' ? 'secondary' : 'primary');
    if (action.type === 'link') {
      actionHtml = `<a href="${action.href}" class="gl-btn gl-btn--${variant} gl-btn--sm gl-empty-center__action">${action.label}</a>`;
    } else {
      actionHtml = `<button id="${action.id}" class="gl-btn gl-btn--${variant} gl-btn--sm gl-empty-center__action">${action.label}</button>`;
    }
  }

  return `
    <div class="gl-card gl-empty-center">
      ${iconHtml}
      <p class="gl-empty-center__msg">${message}</p>
      ${hintHtml}
      ${actionHtml}
    </div>
  `;
}
