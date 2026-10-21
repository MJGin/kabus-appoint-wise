DROP POLICY IF EXISTS "staff photos public read" ON storage.objects;
CREATE POLICY "signed in reads staff photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'staff-photos');