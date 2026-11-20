create table public.portfolio_visitor_counts (
  site text primary key check (site in ('studio', 'portfolio')),
  count bigint not null default 0 check (count >= 0)
);

alter table public.portfolio_visitor_counts enable row level security;
revoke all on public.portfolio_visitor_counts from anon, authenticated;
grant select, insert, update on public.portfolio_visitor_counts to service_role;

create function public.portfolio_record_visit(site_key text)
returns bigint language sql set search_path = '' as $$
  insert into public.portfolio_visitor_counts (site, count)
  values (site_key, 1)
  on conflict (site) do update set count = public.portfolio_visitor_counts.count + 1
  returning count;
$$;

revoke all on function public.portfolio_record_visit(text) from public, anon, authenticated;
grant execute on function public.portfolio_record_visit(text) to service_role;
