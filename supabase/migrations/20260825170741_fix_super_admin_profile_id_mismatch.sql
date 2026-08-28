
-- Reconciles profiles.id with the real auth.users.id for the church's Super
-- Admin (พณ.ท่านหม่อมราชวงศ์สุริยงค์ บาลเพ็ชร). The profile row was created at
-- id 83fe6d50-adb1-4dc2-bb09-8d1a56da0559 with no matching auth.users row; the
-- real, confirmed auth account for the same email lives at
-- f0fc6cdd-07ad-4d76-8fe6-80427525d340. profiles.id is a primary key, so the
-- row is recreated under the correct id rather than UPDATEd in place, then the
-- dependent user_roles row is repointed and the old profile row dropped.
-- Verified beforehand: zero references to the old id outside user_roles.

begin;

insert into profiles (id, church_id, email, full_name, display_name, avatar_url, is_active, created_at, updated_at)
select 'f0fc6cdd-07ad-4d76-8fe6-80427525d340', church_id, email, full_name, display_name, avatar_url, is_active, created_at, now()
from profiles
where id = '83fe6d50-adb1-4dc2-bb09-8d1a56da0559';

update user_roles
   set user_id = 'f0fc6cdd-07ad-4d76-8fe6-80427525d340'
 where user_id = '83fe6d50-adb1-4dc2-bb09-8d1a56da0559';

update user_roles
   set granted_by = 'f0fc6cdd-07ad-4d76-8fe6-80427525d340'
 where granted_by = '83fe6d50-adb1-4dc2-bb09-8d1a56da0559';

delete from profiles where id = '83fe6d50-adb1-4dc2-bb09-8d1a56da0559';

commit;
