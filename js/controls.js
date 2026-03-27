let state = {
  person: null,
  indicators: [],
  dateFrom: null,
  dateTo: null,
  agg: null,
  mode: 'normalized',
};

let allIndicators = [];
let onChangeCallback = null;

export function initPersonSelect(people, initialPerson, onPersonChange) {
  const select = document.getElementById('person-select');
  select.innerHTML = people.map(p =>
    `<option value="${p.id}" ${p.id === initialPerson ? 'selected' : ''}>${p.name}</option>`
  ).join('');
  state.person = initialPerson;
  select.addEventListener('change', () => {
    state.person = select.value;
    onPersonChange(select.value);
  });
}

export function initControls(indicators, initialState, onChange) {
  allIndicators = indicators;
  onChangeCallback = onChange;

  state = { ...state, ...initialState };

  buildMultiSelect();
  bindDatePresets();
  bindDateInputs();
  bindAggButtons();
  bindModeButtons();

  syncUIFromState();
}

export function updateIndicators(indicators) {
  allIndicators = indicators;
  const validNames = new Set(indicators.map(i => i.name));
  state.indicators = state.indicators.filter(n => validNames.has(n));
  buildMultiSelect();
}

export function getControlState() {
  return { ...state };
}

export function setDateRange(from, to) {
  state.dateFrom = from;
  state.dateTo = to;
  document.getElementById('date-from').value = from || '';
  document.getElementById('date-to').value = to || '';
}

// --- Multi-select dropdown ---

function buildMultiSelect() {
  const container = document.getElementById('indicator-select');
  const input = container.querySelector('.multi-select-input');
  const dropdown = container.querySelector('.multi-select-dropdown');
  const pills = container.querySelector('.multi-select-pills');

  function getFilteredIndicators(filter = '') {
    const lower = filter.toLowerCase();
    return allIndicators.filter(ind =>
      ind.name.toLowerCase().includes(lower) ||
      ind.category.toLowerCase().includes(lower)
    );
  }

  function groupByCategory(indicators) {
    const groups = [];
    const seen = new Set();
    for (const ind of indicators) {
      if (!seen.has(ind.category)) {
        seen.add(ind.category);
        groups.push({ category: ind.category, items: [] });
      }
      groups.find(g => g.category === ind.category).items.push(ind.name);
    }
    return groups;
  }

  function renderOptions(filter = '') {
    const filtered = getFilteredIndicators(filter);
    const groups = groupByCategory(filtered);
    let html = `
      <div class="multi-select-actions">
        <a href="#" class="select-all">Select all</a>
        <span class="action-sep">·</span>
        <a href="#" class="clear-all">Clear all</a>
      </div>
    `;
    for (const group of groups) {
      const allChecked = group.items.every(n => state.indicators.includes(n));
      html += `<div class="multi-select-group">
        <div class="multi-select-group-header" data-category="${group.category}">
          <input type="checkbox" class="group-checkbox" ${allChecked ? 'checked' : ''}>
          <span>${group.category}</span>
        </div>`;
      for (const name of group.items) {
        html += `
        <label class="multi-select-option">
          <input type="checkbox" value="${name}" ${state.indicators.includes(name) ? 'checked' : ''}>
          <span>${name}</span>
        </label>`;
      }
      html += `</div>`;
    }
    dropdown.innerHTML = html;
  }

  function renderPills() {
    pills.innerHTML = state.indicators.map(name => `
      <span class="pill">
        ${name}
        <span class="pill-remove" data-name="${name}">&times;</span>
      </span>
    `).join('');
  }

  input.addEventListener('focus', () => {
    container.classList.add('open');
    renderOptions(input.value);
  });

  input.addEventListener('input', () => {
    renderOptions(input.value);
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      container.classList.remove('open');
    }
  });

  dropdown.addEventListener('click', (e) => {
    const selectAll = e.target.closest('.select-all');
    const clearAll = e.target.closest('.clear-all');
    const groupHeader = e.target.closest('.multi-select-group-header');
    if (selectAll) {
      e.preventDefault();
      const filtered = getFilteredIndicators(input.value);
      filtered.forEach(ind => {
        if (!state.indicators.includes(ind.name)) state.indicators.push(ind.name);
      });
      renderOptions(input.value);
      renderPills();
      fireChange();
      return;
    }
    if (clearAll) {
      e.preventDefault();
      state.indicators = [];
      renderOptions(input.value);
      renderPills();
      fireChange();
      return;
    }
    if (groupHeader) {
      const category = groupHeader.dataset.category;
      const groupItems = getFilteredIndicators(input.value)
        .filter(ind => ind.category === category)
        .map(ind => ind.name);
      const allSelected = groupItems.every(n => state.indicators.includes(n));
      if (allSelected) {
        state.indicators = state.indicators.filter(n => !groupItems.includes(n));
      } else {
        groupItems.forEach(n => {
          if (!state.indicators.includes(n)) state.indicators.push(n);
        });
      }
      renderOptions(input.value);
      renderPills();
      fireChange();
      return;
    }
  });

  dropdown.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const name = e.target.value;
    if (e.target.checked) {
      if (!state.indicators.includes(name)) state.indicators.push(name);
    } else {
      state.indicators = state.indicators.filter(i => i !== name);
    }
    renderPills();
    fireChange();
  });

  pills.addEventListener('click', (e) => {
    const remove = e.target.closest('.pill-remove');
    if (!remove) return;
    const name = remove.dataset.name;
    state.indicators = state.indicators.filter(i => i !== name);
    renderOptions(input.value);
    renderPills();
    fireChange();
  });

  renderOptions();
  renderPills();
}

// --- Date presets ---

function bindDatePresets() {
  const buttons = document.querySelectorAll('.date-presets button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const range = btn.dataset.range;
      const now = new Date();
      const to = now.toISOString().slice(0, 10);
      let from;

      if (range === '3m') {
        from = new Date(now.setMonth(now.getMonth() - 3)).toISOString().slice(0, 10);
      } else if (range === '1y') {
        from = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().slice(0, 10);
      } else {
        from = null;
      }

      state.dateFrom = from;
      state.dateTo = range === 'all' ? null : to;
      document.getElementById('date-from').value = from || '';
      document.getElementById('date-to').value = range === 'all' ? '' : to;
      state.agg = null; // reset to auto
      syncAggButtons();
      fireChange();
    });
  });
}

function bindDateInputs() {
  const fromInput = document.getElementById('date-from');
  const toInput = document.getElementById('date-to');

  const handler = () => {
    state.dateFrom = fromInput.value || null;
    state.dateTo = toInput.value || null;
    // Clear preset selection
    document.querySelectorAll('.date-presets button').forEach(b => b.classList.remove('active'));
    state.agg = null;
    syncAggButtons();
    fireChange();
  };

  fromInput.addEventListener('change', handler);
  toInput.addEventListener('change', handler);
}

// --- Aggregation ---

function bindAggButtons() {
  const buttons = document.querySelectorAll('#agg-controls button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.agg = btn.dataset.agg;
      fireChange();
    });
  });
}

function syncAggButtons() {
  const buttons = document.querySelectorAll('#agg-controls button');
  buttons.forEach(b => b.classList.toggle('active', b.dataset.agg === state.agg));
}

// --- Mode ---

function bindModeButtons() {
  const buttons = document.querySelectorAll('#mode-controls button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
      fireChange();
    });
  });
}

// --- Sync UI from state ---

function syncUIFromState() {
  document.getElementById('date-from').value = state.dateFrom || '';
  document.getElementById('date-to').value = state.dateTo || '';

  // Sync date presets
  if (!state.dateFrom && !state.dateTo) {
    document.querySelectorAll('.date-presets button').forEach(b =>
      b.classList.toggle('active', b.dataset.range === 'all')
    );
  }

  // Sync agg
  syncAggButtons();

  // Sync mode
  document.querySelectorAll('#mode-controls button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === state.mode)
  );
}

function fireChange() {
  if (onChangeCallback) onChangeCallback();
}
