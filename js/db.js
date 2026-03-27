import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm';

let db = null;
let conn = null;
let people = [];

export async function initDB() {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  conn = await db.connect();

  const base = new URL('.', window.location.href).href;

  // Load people config
  const peopleResp = await fetch(base + 'data/people.json');
  people = await peopleResp.json();

  // Load shared tables only
  const sharedCsvFiles = [
    ['indicator_aliases', 'data/indicator_aliases.csv'],
    ['unit_conversions', 'data/unit_conversions.csv'],
    ['indicator_categories', 'data/indicator_categories.csv'],
  ];

  for (const [name, path] of sharedCsvFiles) {
    const resp = await fetch(base + path);
    const text = await resp.text();
    await db.registerFileText(`${name}.csv`, text);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ${name} AS
      SELECT * FROM read_csv('${name}.csv', header=true, auto_detect=true, ignore_errors=true, all_varchar=true);
    `);
  }

  return conn;
}

export async function loadPersonData(personId) {
  const base = new URL('.', window.location.href).href;
  const personCsvFiles = [
    ['analysis', `data/${personId}_analysis.csv`],
    ['treatments', `data/${personId}_treatments.csv`],
  ];

  for (const [name, path] of personCsvFiles) {
    await conn.query(`DROP TABLE IF EXISTS ${name}`);
    const resp = await fetch(base + path);
    const text = await resp.text();
    await db.registerFileText(`${name}.csv`, text);
    await conn.query(`
      CREATE TABLE ${name} AS
      SELECT * FROM read_csv('${name}.csv', header=true, auto_detect=true, ignore_errors=true, all_varchar=true);
    `);
  }
}

export function getPeople() {
  return people;
}

export function getConnection() {
  return conn;
}
