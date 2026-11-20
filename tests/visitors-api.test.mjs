import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/visitors.js';

test('visitor endpoint reads and increments distinct totals only from supported origins', async t => {
  const totals = { studio: { visits: 4, hashes: new Set() }, portfolio: { visits: 8, hashes: new Set() } };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/rpc/portfolio_record_traffic')) {
      const { site_key, visitor_hash } = JSON.parse(options.body);
      assert.match(visitor_hash, /^[0-9a-f]{64}$/);
      const site = totals[site_key];
      site.hashes.add(visitor_hash);
      return Response.json([{ visitors: site.hashes.size, visits: ++site.visits }]);
    }
    const site = new URL(url).searchParams.get('site').slice(3);
    return Response.json([{ count: totals[site].visits, unique_visitors: totals[site].hashes.size }]);
  });
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  const previousHashSecret = process.env.VISITOR_HASH_SECRET;
  process.env.SUPABASE_URL = 'https://storage.example';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  process.env.VISITOR_HASH_SECRET = 'test-only-secret';
  t.after(() => {
    for (const [name, value] of [['SUPABASE_URL', previousUrl], ['SUPABASE_SECRET_KEY', previousKey], ['VISITOR_HASH_SECRET', previousHashSecret]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  async function call(site, method, origin, ip = '203.0.113.1') {
    const result = { headers: {} };
    const res = {
      setHeader(name, value) { result.headers[name] = value; },
      status(code) { result.status = code; return this; },
      json(body) { result.body = body; },
      end() {},
    };
    await handler({ method, query: { site }, headers: { origin, host: 'my-portfolio-jade-rho-86.vercel.app', 'x-vercel-forwarded-for': ip } }, res);
    return result;
  }

  assert.equal((await call('portfolio', 'POST', 'https://other.example')).status, 403);
  const portfolio = await call('portfolio', 'POST', 'https://interportfolio.vercel.app');
  assert.equal(portfolio.headers['Access-Control-Allow-Origin'], 'https://interportfolio.vercel.app');
  assert.deepEqual(portfolio.body, { visitors: 1, visits: 9 });
  assert.deepEqual((await call('portfolio', 'POST', 'https://interportfolio.vercel.app')).body, { visitors: 1, visits: 10 });
  assert.deepEqual((await call('portfolio', 'POST', 'https://interportfolio.vercel.app', '203.0.113.2')).body, { visitors: 2, visits: 11 });
  assert.deepEqual((await call('portfolio', 'POST', 'https://interportfolio.vercel.app', '')).body, { visitors: 2, visits: 11 });
  assert.deepEqual((await call('studio', 'GET')).body, { visitors: 0, visits: 4 });
  assert.deepEqual((await call('studio', 'POST', 'https://my-portfolio-jade-rho-86.vercel.app')).body, { visitors: 1, visits: 5 });
  assert.notEqual(totals.portfolio.hashes.values().next().value, totals.studio.hashes.values().next().value);
  assert.equal((await call('unknown', 'GET')).status, 400);
});
