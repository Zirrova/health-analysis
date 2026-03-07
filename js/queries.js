function aggDateExpr(agg) {
  switch (agg) {
    case 'days':   return `CAST(a.date AS DATE)`;
    case 'weeks':  return `DATE_TRUNC('week', CAST(a.date AS DATE))`;
    case 'months': return `DATE_TRUNC('month', CAST(a.date AS DATE))`;
    default:       return `CAST(a.date AS DATE)`;
  }
}

export function autoAggregation(spanDays) {
  if (spanDays < 90) return 'days';
  if (spanDays <= 365) return 'weeks';
  return 'months';
}

function escapeSQL(s) {
  return s.replace(/'/g, "''");
}

export function buildIndicatorListQuery() {
  return `
    SELECT DISTINCT COALESCE(ia.canonical_name, a.indicator) AS name
    FROM analysis a
    LEFT JOIN indicator_aliases ia ON LOWER(TRIM(a.indicator)) = LOWER(TRIM(ia.alias))
    ORDER BY name;
  `;
}

export function buildAnalysisQuery({ indicators, dateFrom, dateTo, agg }) {
  const datePart = aggDateExpr(agg);
  const indicatorList = indicators.map(i => `'${escapeSQL(i)}'`).join(',');

  return `
    SELECT
      STRFTIME(${datePart}, '%Y-%m-%d') AS period,
      COALESCE(ia.canonical_name, a.indicator) AS indicator,
      AVG(CAST(a.value AS DOUBLE)) AS avg_value,
      COUNT(*) AS obs_count,
      MIN(a.laboratory_reference) AS laboratory_reference,
      MIN(a.units) AS units
    FROM analysis a
    LEFT JOIN indicator_aliases ia ON LOWER(TRIM(a.indicator)) = LOWER(TRIM(ia.alias))
    WHERE COALESCE(ia.canonical_name, a.indicator) IN (${indicatorList})
      AND CAST(a.date AS DATE) >= '${dateFrom}'::DATE
      AND CAST(a.date AS DATE) <= '${dateTo}'::DATE
    GROUP BY ${datePart}, COALESCE(ia.canonical_name, a.indicator)
    ORDER BY period, indicator;
  `;
}

export function buildMinMaxQuery({ indicators }) {
  const indicatorList = indicators.map(i => `'${escapeSQL(i)}'`).join(',');
  return `
    SELECT
      COALESCE(ia.canonical_name, a.indicator) AS indicator,
      MIN(CAST(a.value AS DOUBLE)) AS min_val,
      MAX(CAST(a.value AS DOUBLE)) AS max_val
    FROM analysis a
    LEFT JOIN indicator_aliases ia ON LOWER(TRIM(a.indicator)) = LOWER(TRIM(ia.alias))
    WHERE COALESCE(ia.canonical_name, a.indicator) IN (${indicatorList})
    GROUP BY COALESCE(ia.canonical_name, a.indicator);
  `;
}

export function buildTreatmentsQuery({ dateFrom, dateTo }) {
  return `
    SELECT
      treatment,
      STRFTIME(CAST(start_date AS DATE), '%Y-%m-%d') AS start_date,
      STRFTIME(COALESCE(NULLIF(TRIM(end_date), '')::DATE, '${dateTo}'::DATE), '%Y-%m-%d') AS end_date
    FROM treatments
    WHERE start_date::DATE <= '${dateTo}'::DATE
      AND COALESCE(NULLIF(TRIM(end_date), '')::DATE, CURRENT_DATE) >= '${dateFrom}'::DATE
    ORDER BY start_date;
  `;
}

export function buildTreatmentsByPeriodQuery({ dateFrom, dateTo, agg }) {
  const interval = agg === 'days' ? '1 DAY' : agg === 'weeks' ? '7 DAY' : '1 MONTH';
  return `
    WITH periods AS (
      SELECT UNNEST(generate_series(
        '${dateFrom}'::DATE,
        '${dateTo}'::DATE,
        INTERVAL ${interval}
      )) AS period
    )
    SELECT
      STRFTIME(p.period, '%Y-%m-%d') AS period,
      STRING_AGG(DISTINCT t.treatment, ', ') AS treatments
    FROM periods p
    LEFT JOIN treatments t
      ON t.start_date::DATE <= p.period + INTERVAL ${interval}
      AND COALESCE(NULLIF(TRIM(t.end_date), '')::DATE, CURRENT_DATE) >= p.period
    GROUP BY p.period
    ORDER BY p.period;
  `;
}

export function buildDateRangeQuery() {
  return `
    SELECT
      STRFTIME(MIN(CAST(date AS DATE)), '%Y-%m-%d') AS min_date,
      STRFTIME(MAX(CAST(date AS DATE)), '%Y-%m-%d') AS max_date
    FROM analysis;
  `;
}
