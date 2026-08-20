const OWNER = 'kbuckle10';
const REPO = 'daily-jse-market-dashboard';
const WATCHLIST_PATH = 'watchlist.json';
const UNIVERSE_URL = 'https://raw.githubusercontent.com/kbuckle10/jse-main-market-dashboard/main/data.json';

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function getUniverseTickers() {
  const res = await fetch(UNIVERSE_URL, { headers: { 'user-agent': 'daily-jse-market-dashboard' } });
  if (!res.ok) throw new Error(`Unable to load Main Market universe (${res.status})`);
  const data = await res.json();
  return new Set((data.stocks || []).map(s => String(s.ticker || '').toUpperCase()).filter(Boolean));
}

async function readWatchlist(token) {
  const ghHeaders = { 'accept': 'application/vnd.github+json', 'user-agent': 'daily-jse-market-dashboard' };
  if (token) ghHeaders.authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${WATCHLIST_PATH}?ref=main`, { headers: ghHeaders });
  if (!res.ok) throw new Error(`Unable to read watchlist (${res.status})`);
  const doc = await res.json();
  const text = Buffer.from(doc.content, 'base64').toString('utf8');
  return { data: JSON.parse(text), sha: doc.sha };
}

export default async (request) => {
  try {
    const token = process.env.GITHUB_WATCHLIST_TOKEN;
    if (request.method === 'GET') {
      const { data } = await readWatchlist(token);
      return reply(200, data);
    }

    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
    if (!token) return reply(503, { error: 'Persistent watchlist write is not configured. Add GITHUB_WATCHLIST_TOKEN in Netlify environment variables.' });

    const body = await request.json();
    const requested = Array.isArray(body?.tickers) ? body.tickers : [];
    const universe = await getUniverseTickers();
    const tickers = [...new Set(requested.map(t => String(t).trim().toUpperCase()))].filter(t => universe.has(t));
    if (!tickers.length) return reply(400, { error: 'Watchlist must contain at least one valid JSE Main Market ticker.' });

    const current = await readWatchlist(token);
    const payload = {
      updated: new Date().toISOString(),
      tickers
    };
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${WATCHLIST_PATH}`;
    const res = await fetch(api, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'daily-jse-market-dashboard'
      },
      body: JSON.stringify({
        message: `Update dashboard watchlist: ${tickers.join(', ')}`,
        content: Buffer.from(JSON.stringify(payload, null, 2) + '\n').toString('base64'),
        sha: current.sha,
        branch: 'main'
      })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub watchlist update failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return reply(200, payload);
  } catch (error) {
    return reply(500, { error: error.message || String(error) });
  }
};

export const config = { path: '/api/watchlist' };
