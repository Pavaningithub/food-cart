-- ============================================================
-- SUPABASE STORAGE: product-images bucket
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create the bucket (public so images are accessible without auth)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

-- Public read policy (anyone can view product images)
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Service role can upload/update/delete (API uses service role key)
create policy "product_images_service_insert"
  on storage.objects for insert
  with check (bucket_id = 'product-images');

create policy "product_images_service_update"
  on storage.objects for update
  using (bucket_id = 'product-images');

create policy "product_images_service_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images');
