export function initTheme() {
  // Theme is handled purely via CSS @media (prefers-color-scheme: dark) in tokens.css.
  // This module exists for Plotly chart theming which needs JS.
}

export function getPlotlyTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return {
    paper_bgcolor: isDark ? '#1a1a1a' : '#ffffff',
    plot_bgcolor: isDark ? '#1a1a1a' : '#ffffff',
    font: {
      color: isDark ? '#e8e8e8' : '#222222',
      family: "'Source Sans 3', system-ui, -apple-system, sans-serif",
    },
    gridcolor: isDark ? '#404040' : '#d9d9d9',
  };
}
