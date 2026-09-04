// Small module to show an HMR indicator and update it when this module is replaced.
// Dev server only — import.meta.env.DEV is false in a production build.
if (import.meta.env.DEV) {
  const el = document.createElement("div");
  el.id = "hmr-indicator";
  el.className = "hmr-indicator";
  el.textContent = "HMR DEMO: " + new Date().toLocaleTimeString();

  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(el);
  });

  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      el.textContent = "HMR: " + new Date().toLocaleTimeString();
    });
  }
}
