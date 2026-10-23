-- Corre una sola vez, al crear la base (docker-entrypoint-initdb.d). Pone POSTGRES_PASSWORD a los roles con los
-- que se conectan los servicios. Igual que docker/volumes/db/roles.sql del repo de Supabase, pero solo con los
-- roles que existen (sin webhooks.sql no hay supabase_functions_admin).
\set pgpass `echo "$POSTGRES_PASSWORD"`

select format('alter user %I with password %L', r, :'pgpass')
from unnest(array['authenticator', 'pgbouncer', 'supabase_auth_admin', 'supabase_functions_admin',
                  'supabase_storage_admin']) as r
where exists (select 1 from pg_roles where rolname = r)
\gexec
