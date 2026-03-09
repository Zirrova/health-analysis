import { getPlotlyTheme } from './theme.js';

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
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
    xaxis: {
      type: 'date',
      gridcolor: 'rgba(0,0,0,0)',
      showgrid: false,
      linecolor: theme.gridcolor,
      linewidth: 1,
    },
    hovermode: 'x unified',
    legend: {
      orientation: 'h',
      y: -0.15,
      font: { size: 12 },
    },
    margin: { t: 16, r: 80, b: 60, l: 60 },
    paper_bgcolor: theme.paper_bgcolor,
    plot_bgcolor: theme.plot_bgcolor,
    font: theme.font,
    shapes: [],
  };

  if (mode === 'normalized') {
    layout.yaxis = {
      title: { text: 'Normalized (0–100%)', font: { size: 12, color: theme.font.color } },
      range: [-5, 105],
      gridcolor: theme.gridcolor,
      gridwidth: 1,
      zeroline: false,
    };

    indicators.forEach((ind, i) => {
      const rows = grouped[ind];
      const mm = minMax[ind] || { min_val: 0, max_val: 1 };
      const range = mm.max_val - mm.min_val || 1;
      const color = COLORS[i % COLORS.length];

      traces.push({
        x: rows.map(r => r.period),
        y: rows.map(r => ((r.avg_value - mm.min_val) / range) * 100),
        name: ind,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color, width: 2 },
        marker: { color, size: 5 },
        customdata: rows.map(r => [r.avg_value, r.obs_count, r.units || '']),
        hovertemplate: `<b>${ind}</b>  %{customdata[0]:.2f} %{customdata[2]}<extra></extra>`,
      });

      // Reference range as dashed lines
      const ref = findReference(rows);
      if (ref) {
        const yLow = ((ref.low - mm.min_val) / range) * 100;
        const yHigh = ((ref.high - mm.min_val) / range) * 100;
        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1,
          yref: 'y', y0: yLow, y1: yLow,
          line: { color: hexToRgba(color, 0.3), width: 1, dash: 'dash' },
          layer: 'below',
        });
        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1,
          yref: 'y', y0: yHigh, y1: yHigh,
          line: { color: hexToRgba(color, 0.3), width: 1, dash: 'dash' },
          layer: 'below',
        });
      }
    });
  } else {
    // Raw mode: multiple Y axes, cleaner
    indicators.forEach((ind, i) => {
      const yAxisName = i === 0 ? 'y' : `y${i + 1}`;
      const yAxisKey = i === 0 ? 'yaxis' : `yaxis${i + 1}`;
      const rows = grouped[ind];
      const units = rows[0]?.units || '';
      const color = COLORS[i % COLORS.length];

      traces.push({
        x: rows.map(r => r.period),
        y: rows.map(r => r.avg_value),
        name: `${ind}${units ? ' (' + units + ')' : ''}`,
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: yAxisName,
        line: { color, width: 2 },
        marker: { color, size: 5 },
        customdata: rows.map(r => [r.obs_count]),
        hovertemplate: `<b>${ind}</b>  %{y:.2f} ${units}<extra></extra>`,
      });

      // Only show gridlines for first axis, clean up axis display
      const showTicks = i < 2; // only show ticks for first two axes
      layout[yAxisKey] = {
        overlaying: i > 0 ? 'y' : undefined,
        side: i % 2 === 0 ? 'left' : 'right',
        showgrid: i === 0,
        gridcolor: theme.gridcolor,
        gridwidth: 1,
        zeroline: false,
        showticklabels: showTicks,
        tickfont: { color, size: 11 },
        showline: false,
      };

      // Offset additional axes
      if (i >= 2) {
        const offset = Math.floor(i / 2) * 0.06;
        layout[yAxisKey].position = i % 2 === 0 ? offset : 1 - offset;
        layout[yAxisKey].anchor = 'free';
      }

      // Reference range as dashed lines
      const ref = findReference(rows);
      if (ref) {
        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1,
          yref: yAxisName, y0: ref.low, y1: ref.low,
          line: { color: hexToRgba(color, 0.3), width: 1, dash: 'dash' },
          layer: 'below',
        });
        shapes.push({
          type: 'line', xref: 'paper', x0: 0, x1: 1,
          yref: yAxisName, y0: ref.high, y1: ref.high,
          line: { color: hexToRgba(color, 0.3), width: 1, dash: 'dash' },
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
      fillcolor: 'rgba(147, 112, 219, 0.08)',
      line: { width: 1, color: 'rgba(147, 112, 219, 0.25)', dash: 'dot' },
      layer: 'below',
    });
  });

  layout.shapes = shapes;

  // Treatment annotations
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

  try {
    Plotly.react(chartEl, traces, layout, { responsive: true, displayModeBar: false });
  } catch (err) {
    console.error('Chart render error:', err);
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
