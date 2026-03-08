import { getPlotlyTheme } from './theme.js';

const COLORS = [
  '#4361ee', '#e63946', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#e76f51', '#606c38', '#9b2226', '#6a4c93',
];

export function renderChart({ data, treatments, minMax, mode }) {
  const chartEl = document.getElementById('chart');

  if (!data.length) {
    Plotly.purge(chartEl);
    chartEl.innerHTML = '<p class="empty-state">Select indicators and a date range to view data.</p>';
    return;
  }

  Plotly.purge(chartEl);
  const grouped = groupBy(data, 'indicator');
  const indicators = Object.keys(grouped);
  const traces = [];
  const shapes = [];
  const theme = getPlotlyTheme();

  const layout = {
    xaxis: { type: 'date', gridcolor: theme.gridcolor },
    hovermode: 'closest',
    legend: { orientation: 'h', y: -0.15 },
    margin: { t: 20, r: 80, b: 60, l: 60 },
    paper_bgcolor: theme.paper_bgcolor,
    plot_bgcolor: theme.plot_bgcolor,
    font: theme.font,
    shapes: [],
  };

  if (mode === 'normalized') {
    layout.yaxis = {
      title: 'Normalized (0–100%)',
      range: [-5, 105],
      gridcolor: theme.gridcolor,
    };

    indicators.forEach((ind, i) => {
      const rows = grouped[ind];
      const mm = minMax[ind] || { min_val: 0, max_val: 1 };
      const range = mm.max_val - mm.min_val || 1;

      traces.push({
        x: rows.map(r => r.period),
        y: rows.map(r => ((r.avg_value - mm.min_val) / range) * 100),
        name: ind,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: COLORS[i % COLORS.length] },
        marker: { color: COLORS[i % COLORS.length], size: 7 },
        customdata: rows.map(r => [r.avg_value, r.obs_count, r.units || '']),
        hovertemplate: `<b>${ind}</b><br>Value: %{customdata[0]:.2f} %{customdata[2]}<br>Normalized: %{y:.1f}%<br>Observations: %{customdata[1]}<extra></extra>`,
      });

      const ref = findReference(rows);
      if (ref) {
        const yLow = ((ref.low - mm.min_val) / range) * 100;
        const yHigh = ((ref.high - mm.min_val) / range) * 100;
        shapes.push({
          type: 'rect', xref: 'paper', x0: 0, x1: 1,
          yref: 'y', y0: yLow, y1: yHigh,
          fillcolor: COLORS[i % COLORS.length].replace(')', ', 0.07)').replace('rgb', 'rgba').replace('#', ''),
          line: { width: 0 },
          layer: 'below',
        });
        // Use a simpler approach for hex colors
        shapes[shapes.length - 1].fillcolor = hexToRgba(COLORS[i % COLORS.length], 0.07);
      }
    });
  } else {
    // Raw mode: multiple Y axes
    indicators.forEach((ind, i) => {
      const yAxisName = i === 0 ? 'y' : `y${i + 1}`;
      const yAxisKey = i === 0 ? 'yaxis' : `yaxis${i + 1}`;
      const rows = grouped[ind];
      const units = rows[0]?.units || '';

      traces.push({
        x: rows.map(r => r.period),
        y: rows.map(r => r.avg_value),
        name: `${ind}${units ? ' (' + units + ')' : ''}`,
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: yAxisName,
        line: { color: COLORS[i % COLORS.length] },
        marker: { color: COLORS[i % COLORS.length], size: 7 },
        customdata: rows.map(r => [r.obs_count]),
        hovertemplate: `<b>${ind}</b><br>Value: %{y:.2f} ${units}<br>Observations: %{customdata[0]}<extra></extra>`,
      });

      layout[yAxisKey] = {
        title: { text: ind, font: { color: COLORS[i % COLORS.length], size: 12 } },
        overlaying: i > 0 ? 'y' : undefined,
        side: i % 2 === 0 ? 'left' : 'right',
        showgrid: i === 0,
        gridcolor: theme.gridcolor,
        tickfont: { color: COLORS[i % COLORS.length] },
      };

      // Offset additional axes
      if (i >= 2) {
        const offset = Math.floor(i / 2) * 0.07;
        layout[yAxisKey].position = i % 2 === 0 ? offset : 1 - offset;
        layout[yAxisKey].anchor = 'free';
      }

      const ref = findReference(rows);
      if (ref) {
        shapes.push({
          type: 'rect', xref: 'paper', x0: 0, x1: 1,
          yref: yAxisName, y0: ref.low, y1: ref.high,
          fillcolor: hexToRgba(COLORS[i % COLORS.length], 0.07),
          line: { width: 0 },
          layer: 'below',
        });
      }
    });
  }

  // Treatment spans
  treatments.forEach(t => {
    shapes.push({
      type: 'rect',
      xref: 'x', x0: t.start_date, x1: t.end_date,
      yref: 'paper', y0: 0, y1: 1,
      fillcolor: 'rgba(147, 112, 219, 0.12)',
      line: { width: 1, color: 'rgba(147, 112, 219, 0.35)', dash: 'dot' },
      layer: 'below',
    });
    // Add annotation for treatment name
    traces.push({
      x: [t.start_date],
      y: [1.02],
      text: [t.treatment],
      mode: 'text',
      textposition: 'top right',
      textfont: { size: 9, color: 'rgba(147, 112, 219, 0.8)' },
      showlegend: false,
      yaxis: mode === 'normalized' ? 'y' : 'y',
      hoverinfo: 'skip',
      yref: 'paper',
    });
  });

  layout.shapes = shapes;

  // Treatment annotations instead of traces (cleaner)
  layout.annotations = treatments.map(t => ({
    x: t.start_date,
    y: 1,
    yref: 'paper',
    text: t.treatment,
    showarrow: false,
    font: { size: 9, color: 'rgba(147, 112, 219, 0.9)' },
    yanchor: 'bottom',
    xanchor: 'left',
  }));

  // Remove the text traces for treatments (we use annotations instead)
  const plotTraces = traces.filter(t => t.mode !== 'text');

  window._chartDebug = { traceCount: plotTraces.length, mode, shapeCount: shapes.length, indicatorCount: indicators.length };
  try {
    Plotly.react(chartEl, plotTraces, layout, { responsive: true, displayModeBar: false })
      .catch(err => {
        console.error('Chart async error:', err);
        window._chartAsyncError = err.message;
        chartEl.innerHTML = `<p class="empty-state">Chart error: ${err.message}</p>`;
      });
  } catch (err) {
    console.error('Chart render error:', err);
    window._chartSyncError = err.message;
    chartEl.innerHTML = `<p class="empty-state">Chart error: ${err.message}</p>`;
  }
}

function parseReference(text) {
  if (!text) return null;
  const rangeMatch = text.match(/([\d.]+)\s*[-–—]\s*([\d.]+)/);
  if (rangeMatch) return { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[2]) };
  const ltMatch = text.match(/<\s*([\d.]+)/);
  if (ltMatch) return { low: 0, high: parseFloat(ltMatch[1]) };
  return null;
}

function findReference(rows) {
  for (const r of rows) {
    const parsed = parseReference(r.laboratory_reference);
    if (parsed) return parsed;
  }
  return null;
}

function groupBy(arr, key) {
  return arr.reduce((acc, row) => {
    (acc[row[key]] = acc[row[key]] || []).push(row);
    return acc;
  }, {});
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
