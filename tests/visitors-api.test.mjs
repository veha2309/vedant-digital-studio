import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/visitors.js';

test('visitor endpoint reads and increments distinct totals only from supported origins', async t => {
  const totals = { studio: 4, portfolio: 8 };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/rpc/portfolio_record_visit')) {
      const { site_key } = JSON.parse(options.body);
      return Response.json(++totals[site_key]);
    }
    const site = new URL(url).searchParams.get('site').slice(3);
    return Response.json([{ count: totals[site] }]);
  });
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://storage.example';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  t.after(() => {
    for (const [name, value] of [['SUPABASE_URL', previousUrl], ['SUPABASE_SECRET_KEY', previousKey]]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  async function call(site, method, origin) {
    const result = { headers: {} };
    const res = {
      setHeader(name, value) { result.headers[name] = value; },
      status(code) { result.status = code; return this; },
      json(body) { result.body = body; },
      end() {},
    };
    await handler({ method, query: { site }, headers: { origin, host: 'my-portfolio-jade-rho-86.vercel.app' } }, res);
    return result;
  }

  assert.equal((await call('portfolio', 'POST', 'https://other.example')).status, 403);
  const portfolio = await call('portfolio', 'POST', 'https://interportfolio.vercel.app');
  assert.equal(portfolio.headers['Access-Control-Allow-Origin'], 'https://interportfolio.vercel.app');
  assert.deepEqual(portfolio.body, { count: 9 });
  assert.deepEqual((await call('studio', 'GET')).body, { count: 4 });
  assert.deepEqual((await call('studio', 'POST', 'https://my-portfolio-jade-rho-86.vercel.app')).body, { count: 5 });
  assert.equal((await call('unknown', 'GET')).status, 400);
});
