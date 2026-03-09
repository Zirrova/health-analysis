export function renderTable({ data, treatmentsByPeriod, categoryMap }) {
  const wrapper = document.getElementById('table-wrapper');

  if (!data.length) {
    wrapper.innerHTML = '';
    return;
  }

  const periods = [...new Set(data.map(r => String(r.period)))].sort();
  const indicators = [...new Set(data.map(r => r.indicator))];

  // Sort indicators by category sort order, then alphabetically within category
  indicators.sort((a, b) => {
    const ca = categoryMap?.[a] || { sortOrder: 999, category: 'Other' };
    const cb = categoryMap?.[b] || { sortOrder: 999, category: 'Other' };
    if (ca.sortOrder !== cb.sortOrder) return ca.sortOrder - cb.sortOrder;
    if (ca.category !== cb.category) return ca.category.localeCompare(cb.category);
    return a.localeCompare(b);
  });

  // Group indicators by category (preserving sort order)
  const groups = [];
  let currentCategory = null;
  for (const ind of indicators) {
    const cat = categoryMap?.[ind]?.category || 'Other';
    if (cat !== currentCategory) {
      currentCategory = cat;
      groups.push({ category: cat, indicators: [] });
    }
    groups[groups.length - 1].indicators.push(ind);
  }

  // Build lookup: indicator -> period -> { avg_value, units }
  const lookup = {};
  data.forEach(r => {
    if (!lookup[r.indicator]) lookup[r.indicator] = {};
    lookup[r.indicator][String(r.period)] = { value: r.avg_value, units: r.units || '' };
  });

  // Treatment lookup: period -> text
  const treatLookup = {};
  (treatmentsByPeriod || []).forEach(r => {
    treatLookup[String(r.period)] = r.treatments || '';
  });

  const formatPeriod = (p) => {
    const d = new Date(p);
    if (isNaN(d)) return p;
    return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
  };

  const formatValue = (v) => {
    if (v == null) return '—';
    const num = Number(v);
    if (isNaN(num)) return '—';
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  const colCount = periods.length + 1;
  let html = '<table><thead><tr><th class="sticky-col">Indicator</th>';
  periods.forEach(p => {
    html += `<th>${formatPeriod(p)}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (const group of groups) {
    html += `<tr class="category-row"><td class="sticky-col" colspan="${colCount}">${group.category}</td></tr>`;
    for (const ind of group.indicators) {
      html += `<tr><td class="sticky-col">${ind}</td>`;
      periods.forEach(p => {
        const cell = lookup[ind]?.[p];
        const val = cell ? formatValue(cell.value) : '—';
        const title = cell?.units ? `${val} ${cell.units}` : val;
        html += `<td title="${title}">${val}</td>`;
      });
      html += '</tr>';
    }
  }

  // Treatment row
  html += `<tr class="treatment-row"><td class="sticky-col">Treatments</td>`;
  periods.forEach(p => {
    const text = treatLookup[p] || '—';
    html += `<td title="${text}">${text}</td>`;
  });
  html += '</tr>';

  html += '</tbody></table>';
  wrapper.innerHTML = html;
}
