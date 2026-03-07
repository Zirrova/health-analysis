export function initTheme() {
  // Theme is handled purely via CSS @media (prefers-color-scheme: dark) in tokens.css.
  // This module exists for Plotly chart theming which needs JS.
}

export function getPlotlyTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    paper_bgcolor: isDark ? '#1a1a2e' : '#f8f9fa',
    plot_bgcolor: isDark ? '#1a1a2e' : '#f8f9fa',
    font: { color: isDark ? '#e0e0e0' : '#1a1a2e' },
    gridcolor: isDark ? '#333' : '#dee2e6',
  };
}
