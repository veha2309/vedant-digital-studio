import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
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
    const address = req.headers['x-vercel-forwarded-for'];
    const ipVersion = typeof address === 'string' ? isIP(address) : 0;
    const secret = process.env.VISITOR_HASH_SECRET || process.env.ADMIN_SESSION_SECRET;
    if (req.method === 'POST' && ipVersion && secret) {
      const ip = ipVersion === 6 ? new URL(`http://[${address}]`).hostname : address;
      const visitorHash = createHmac('sha256', secret)
        .update(`portfolio-visitor:v1:${site}:${ip}`).digest('hex');
      const { data } = await supabaseRequest('rpc/portfolio_record_traffic', {
        method: 'POST', body: JSON.stringify({ site_key: site, visitor_hash: visitorHash }),
      });
      return res.status(200).json(data[0]);
    }
    const { data } = await supabaseRequest(`portfolio_visitor_counts?site=eq.${site}&select=count,unique_visitors`);
    return res.status(200).json({ visitors: data[0]?.unique_visitors ?? 0, visits: data[0]?.count ?? 0 });
  } catch {
    return res.status(503).end();
  }
}
