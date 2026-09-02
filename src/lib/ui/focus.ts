/**
 * The app re-renders a route by replacing innerHTML on every state change.
 * For text fields that fire on every keystroke (search, amount inputs), that
 * destroys the field mid-typing: focus drops to <body> and Thai IME
 * composition breaks. Render, then re-focus the same field and restore its
 * caret so typing flows uninterrupted.
 *
 * Re-query by the input's `id`, or pass `requerySelector` for fields that
 * have none (e.g. dynamic rows keyed by data-row-id).
 */
export function restoreFocusAfterRender(
  input: HTMLInputElement,
  render: () => void,
  requerySelector?: string,
): void {
  const selection = input.selectionStart;
  const id = input.id;
  render();
  const again = id
    ? (document.getElementById(id) as HTMLInputElement | null)
    : requerySelector
      ? document.querySelector<HTMLInputElement>(requerySelector)
      : null;
  if (!again) return;
  again.focus();
  if (selection !== null) {
    try {
      again.setSelectionRange(selection, selection);
    } catch {
      // Number inputs reject caret APIs in some browsers — focus is enough.
    }
  }
}
