import { supabaseRequest } from './_supabase.js';

const portfolioOrigins = new Set([
  'https://interportfolio.vercel.app',
  'https://vedant-portfolio-seven-orcin.vercel.app',
]);
const studioOrigin = 'https://my-portfolio-jade-rho-86.vercel.app';

export default async function handler(req, res) {
  const site = req.query?.site;
  if (site !== 'studio' && site !== 'portfolio') return res.status(400).end();

  const origin = req.headers.origin;
  const isPortfolio = site === 'portfolio' && portfolioOrigins.has(origin);
  const isStudio = site === 'studio' && (
    origin === studioOrigin || origin === `https://${req.headers.host}` || origin === `http://${req.headers.host}`
  );
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  if (isPortfolio) res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }
  if (req.method === 'POST' && !isPortfolio && !isStudio) return res.status(403).end();

  try {
    const { data } = req.method === 'POST'
      ? await supabaseRequest('rpc/portfolio_record_visit', {
        method: 'POST', body: JSON.stringify({ site_key: site }),
      })
      : await supabaseRequest(`portfolio_visitor_counts?site=eq.${site}&select=count`);
    return res.status(200).json({ count: req.method === 'POST' ? data : data[0]?.count ?? 0 });
  } catch {
    return res.status(503).end();
  }
}
