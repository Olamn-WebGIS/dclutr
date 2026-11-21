alter table public.listings
  drop constraint listings_condition_check;

alter table public.listings
  add constraint listings_condition_check
  check (condition in ('New', 'Like New', 'Good Condition', 'Fairly Used', 'Used'));
