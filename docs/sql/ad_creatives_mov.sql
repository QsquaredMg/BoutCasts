-- Allow .mov (QuickTime) video uploads for ads. Safe to re-run.
update storage.buckets set allowed_mime_types = allowed_mime_types || array['video/quicktime','video/x-m4v']
 where id = 'ad-creatives' and not (allowed_mime_types @> array['video/quicktime']);
