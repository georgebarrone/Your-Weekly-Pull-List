import {createClient} from '@libsql/client';
import {mkdirSync} from 'node:fs';
import {idFor, normalizeSeriesUrl, laDate} from './core.js';

const remoteUrl = process.env.TURSO_DATABASE_URL;
if (!remoteUrl) mkdirSync('data',{recursive:true});
export const db = createClient({url:remoteUrl || 'file:./data/pull-list.db',
  ...(remoteUrl ? {authToken:process.env.TURSO_AUTH_TOKEN} : {})});

export async function initDb() {
  if (process.env.NODE_ENV === 'production' && !remoteUrl) throw new Error('Production requires TURSO_DATABASE_URL');
  await db.batch([
    `CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY,title TEXT NOT NULL,publisher TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL DEFAULT 'ongoing',series_url TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS catalog (id TEXT PRIMARY KEY,series_url TEXT NOT NULL,series_title TEXT NOT NULL,issue_number TEXT NOT NULL,release_date TEXT NOT NULL,issue_url TEXT NOT NULL,publisher TEXT NOT NULL DEFAULT '',cover_url TEXT,authorized_pdf_url TEXT,date_source TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS catalog_release_idx ON catalog(release_date)`,
    `CREATE INDEX IF NOT EXISTS catalog_series_idx ON catalog(series_url)`,
    `CREATE TABLE IF NOT EXISTS deliveries (issue_id TEXT PRIMARY KEY,subscription_id TEXT NOT NULL,issue_number TEXT NOT NULL,release_date TEXT NOT NULL,delivered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,mode TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS digest_runs (week_start TEXT PRIMARY KEY,sent_at TEXT NOT NULL,issue_count INTEGER NOT NULL)`,
  ],'write');
}
export async function subscriptions() { return (await db.execute('SELECT * FROM subscriptions ORDER BY title COLLATE NOCASE')).rows; }
export async function createSubscription(meta) {
  const url = normalizeSeriesUrl(meta.url);
  if (!url) throw new Error('Invalid BatCave series URL');
  const item = {id:idFor(url),title:meta.title,publisher:meta.publisher || '',kind:meta.kind==='limited'?'limited':'ongoing',series_url:url};
  await db.execute({sql:'INSERT OR IGNORE INTO subscriptions(id,title,publisher,kind,series_url) VALUES(?,?,?,?,?)',args:Object.values(item)});
  return item;
}
export async function removeSubscription(id) {return (await db.execute({sql:'DELETE FROM subscriptions WHERE id=?',args:[id]})).rowsAffected;}
export async function upsertCatalog(items) {
  // Chunk to keep Turso requests manageable.
  for (let i=0;i<items.length;i+=40) {
    await db.batch(items.slice(i,i+40).map(e=>({sql:`INSERT INTO catalog(id,series_url,series_title,issue_number,release_date,issue_url,publisher,cover_url,date_source) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cover_url=excluded.cover_url`,args:[e.id,e.series_url,e.series_title,e.issue_number,e.release_date,e.issue_url,e.publisher,e.cover_url,e.date_source]})),'write');
  }
}
export async function catalog(search = '') {
  const query = search.trim();
  if (!query) return (await db.execute('SELECT * FROM catalog ORDER BY release_date DESC,series_title LIMIT 120')).rows;
  return (await db.execute({sql:'SELECT * FROM catalog WHERE lower(series_title) LIKE ? ESCAPE \'\\\' ORDER BY release_date DESC,series_title LIMIT 120',args:[`%${query.toLowerCase().replace(/[\\%_]/g,'\\$&')}%`]})).rows;
}
export async function pendingIssues(start,end) {
  return (await db.execute({sql:`SELECT c.*,s.id AS subscription_id, s.title AS subscribed_title FROM catalog c JOIN subscriptions s ON c.series_url=s.series_url LEFT JOIN deliveries d ON d.issue_id=c.id WHERE c.release_date BETWEEN ? AND ? AND d.issue_id IS NULL ORDER BY c.publisher,c.series_title`,args:[start,end]})).rows;
}
export async function recentForSeries(seriesUrl) {
  return (await db.execute({sql:'SELECT c.*,s.id AS subscription_id,s.title AS subscribed_title FROM catalog c JOIN subscriptions s ON s.series_url=c.series_url LEFT JOIN deliveries d ON d.issue_id=c.id WHERE c.series_url=? AND c.release_date<=? AND d.issue_id IS NULL ORDER BY release_date DESC LIMIT 1',args:[seriesUrl,laDate()]})).rows[0] || null;
}
export async function deliveryHistory() {
  return (await db.execute(`SELECT d.*,c.series_title,c.issue_url,c.publisher FROM deliveries d LEFT JOIN catalog c ON c.id=d.issue_id ORDER BY d.delivered_at DESC LIMIT 100`)).rows;
}
export async function markDelivered(items,mode) {
  if (!items.length) return;
  await db.batch(items.map(i=>({sql:'INSERT OR IGNORE INTO deliveries(issue_id,subscription_id,issue_number,release_date,mode) VALUES(?,?,?,?,?)',args:[i.id,i.subscription_id,i.issue_number,i.release_date,mode]})),'write');
}
export async function hasRun(weekStart) {return !!(await db.execute({sql:'SELECT week_start FROM digest_runs WHERE week_start=?',args:[weekStart]})).rows[0];}
export async function markRun(weekStart,count) {await db.execute({sql:'INSERT OR IGNORE INTO digest_runs(week_start,sent_at,issue_count) VALUES(?,CURRENT_TIMESTAMP,?)',args:[weekStart,count]});}
