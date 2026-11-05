alter table public.listings
  drop constraint if exists listings_title_check;

alter table public.listings
  add constraint listings_title_length_check
  check (char_length(title) between 3 and 100);