import { initDB, getConnection, loadPersonData, getPeople } from './db.js';
import {
  buildIndicatorListWithCategoriesQuery,
  buildAnalysisQuery,
  buildMinMaxQuery,
  buildTreatmentsQuery,
  buildTreatmentsByPeriodQuery,
  buildDateRangeQuery,
  autoAggregation,
} from './queries.js';
import { renderChart } from './chart.js';
import { renderTable } from './table.js';
import { readState, writeState } from './url-state.js';
import { initControls, getControlState, setDateRange, initPersonSelect, updateIndicators } from './controls.js';
import { initTheme } from './theme.js';

let categoryMap = {}; // indicator name → { category, sortOrder }

async function main() {
  initTheme();

  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error-banner');

  try {
    const conn = await initDB();
    window._dbReady = true;
    loadingEl.style.display = 'none';

    const people = getPeople();
    const urlState = readState();

    // Resolve person: URL param (if valid) or first person
    const validIds = new Set(people.map(p => p.id));
    const initialPerson = (urlState.person && validIds.has(urlState.person))
      ? urlState.person
      : people[0].id;

    // Load initial person's data
    await loadPersonData(initialPerson);

    // Fetch indicators for this person
    const allIndicators = await fetchIndicators(conn);

    // Get data date range for defaults
    const dateRangeResult = await conn.query(buildDateRangeQuery());
    const dateRange = dateRangeResult.toArray()[0];
    const dataMinDate = dateRange?.min_date || null;
    const dataMaxDate = dateRange?.max_date || null;

    // Merge URL state with defaults
    if (!urlState.dateFrom && dataMinDate) urlState.dateFrom = dataMinDate;
    if (!urlState.dateTo && dataMaxDate) urlState.dateTo = dataMaxDate;

    // Build category map for table rendering
    allIndicators.forEach(ind => {
      categoryMap[ind.name] = { category: ind.category, sortOrder: ind.sortOrder };
    });

    // Init person select
    initPersonSelect(people, initialPerson, onPersonChange);

    // Init other controls
    initControls(allIndicators, { ...urlState, person: initialPerson }, refresh);

    if (allIndicators.length === 0) {
      loadingEl.style.display = 'block';
      loadingEl.textContent = 'No data yet. Use /add_analysis to add lab results.';
    }

    await refresh();
  } catch (err) {
    console.error('Initialization error:', err);
    loadingEl.style.display = 'none';
    errorEl.textContent = `Failed to initialize: ${err.message}`;
    errorEl.classList.add('visible');
  }
}

async function onPersonChange(personId) {
  const conn = getConnection();
  const loadingEl = document.getElementById('loading');

  await loadPersonData(personId);

  const allIndicators = await fetchIndicators(conn);

  // Rebuild category map
  categoryMap = {};
  allIndicators.forEach(ind => {
    categoryMap[ind.name] = { category: ind.category, sortOrder: ind.sortOrder };
  });

  // Update indicator dropdown, preserving valid selections
  updateIndicators(allIndicators);

  if (allIndicators.length === 0) {
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'No data yet. Use /add_analysis to add lab results.';
  } else {
    loadingEl.style.display = 'none';
  }

  await refresh();
}

async function fetchIndicators(conn) {
  const result = await conn.query(buildIndicatorListWithCategoriesQuery());
  return result.toArray().map(r => {
    const obj = rowToObj(r);
    return {
      name: obj.indicator_name,
      category: obj.category,
      sortOrder: Number(obj.sort_order),
    };
  });
}

async function refresh() {
  const conn = getConnection();
  if (!conn) return;

  const state = getControlState();

  if (!state.indicators.length) {
    renderChart({ data: [], treatments: [], minMax: {}, mode: state.mode });
    renderTable({ data: [], treatmentsByPeriod: [] });
    writeState(state);
    return;
  }

  // Determine effective date range
  let { dateFrom, dateTo } = state;
  if (!dateFrom) {
    const dr = await conn.query(buildDateRangeQuery());
    const row = dr.toArray()[0];
    dateFrom = row?.min_date || new Date().toISOString().slice(0, 10);
  }
  if (!dateTo) {
    dateTo = new Date().toISOString().slice(0, 10);
  }

  // Auto aggregation
  const spanDays = (new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24);
  const agg = state.agg || autoAggregation(spanDays);

  const effectiveState = { ...state, dateFrom, dateTo, agg };

  try {
    const [analysisResult, treatmentsResult, minMaxResult, treatmentsByPeriodResult] =
      await Promise.all([
        conn.query(buildAnalysisQuery(effectiveState)),
        conn.query(buildTreatmentsQuery(effectiveState)),
        conn.query(buildMinMaxQuery(effectiveState)),
        conn.query(buildTreatmentsByPeriodQuery(effectiveState)),
      ]);

    const data = analysisResult.toArray().map(rowToObj);
    const treatments = treatmentsResult.toArray().map(rowToObj);
    const minMaxRows = minMaxResult.toArray().map(rowToObj);
    const treatmentsByPeriod = treatmentsByPeriodResult.toArray().map(rowToObj);

    const minMax = {};
    minMaxRows.forEach(r => {
      minMax[r.indicator] = { min_val: Number(r.min_val), max_val: Number(r.max_val) };
    });

    // Convert numeric fields
    const chartData = data.map(r => ({
      ...r,
      period: formatDate(r.period),
      avg_value: Number(r.avg_value),
      obs_count: Number(r.obs_count),
    }));

    const chartTreatments = treatments.map(r => ({
      ...r,
      start_date: formatDate(r.start_date),
      end_date: formatDate(r.end_date),
    }));

    const tableTreatments = treatmentsByPeriod.map(r => ({
      ...r,
      period: formatDate(r.period),
    }));

    renderChart({ data: chartData, treatments: chartTreatments, minMax, mode: state.mode });
    renderTable({ data: chartData, treatmentsByPeriod: tableTreatments, categoryMap });
    writeState({ ...state, agg });
  } catch (err) {
    console.error('Query error:', err);
  }
}

function rowToObj(row) {
  if (typeof row.toJSON === 'function') return row.toJSON();
  if (row instanceof Object && !Array.isArray(row)) {
    const obj = {};
    for (const key of Object.keys(row)) {
      obj[key] = row[key];
    }
    return obj;
  }
  return row;
}

function formatDate(val) {
  if (val == null) return null;
  return String(val).slice(0, 10);
}

main().catch(console.error);
