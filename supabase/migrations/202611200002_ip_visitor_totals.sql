alter table public.portfolio_visitor_counts
  add column unique_visitors bigint not null default 0 check (unique_visitors >= 0);

create table public.portfolio_visitor_hashes (
  site text not null check (site in ('studio', 'portfolio')),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  primary key (site, ip_hash)
);

alter table public.portfolio_visitor_hashes enable row level security;
revoke all on public.portfolio_visitor_hashes from public, anon, authenticated;
grant insert, select on public.portfolio_visitor_hashes to service_role;

create function public.portfolio_record_traffic(site_key text, visitor_hash text)
returns table (visitors bigint, visits bigint) language sql set search_path = '' as $$
  with new_visitor as (
    insert into public.portfolio_visitor_hashes (site, ip_hash)
    values (site_key, visitor_hash)
    on conflict do nothing
    returning 1
  )
  insert into public.portfolio_visitor_counts as totals (site, count, unique_visitors)
  values (site_key, 1, (select count(*) from new_visitor))
  on conflict (site) do update
  set count = totals.count + 1,
      unique_visitors = totals.unique_visitors + excluded.unique_visitors
  returning totals.unique_visitors, totals.count;
$$;

revoke all on function public.portfolio_record_traffic(text, text) from public, anon, authenticated;
grant execute on function public.portfolio_record_traffic(text, text) to service_role;
