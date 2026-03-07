export function readState() {
  const params = new URLSearchParams(window.location.search);
  return {
    indicators: params.get('indicators')?.split(',').filter(Boolean) || [],
    dateFrom: params.get('from') || null,
    dateTo: params.get('to') || null,
    agg: params.get('agg') || null,
    mode: params.get('mode') || 'normalized',
  };
}

export function writeState(state) {
  const params = new URLSearchParams();
  if (state.indicators?.length) params.set('indicators', state.indicators.join(','));
  if (state.dateFrom) params.set('from', state.dateFrom);
  if (state.dateTo) params.set('to', state.dateTo);
  if (state.agg) params.set('agg', state.agg);
  if (state.mode && state.mode !== 'normalized') params.set('mode', state.mode);

  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}
