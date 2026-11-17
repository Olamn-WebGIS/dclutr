alter table public.listings
  drop constraint if exists listings_description_check,
  add constraint listings_description_length_check
    check (char_length(description) between 3 and 3000);
