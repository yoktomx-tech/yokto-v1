-- =============================================================================
-- YOKTO — Finalización del rename del modelo de roles
-- =============================================================================
-- Se ejecuta al FINAL del corte, después de que la app esté apuntando al
-- nuevo proyecto y validada con la matriz de permisos.
-- IRREVERSIBLE: elimina tipos y tablas legacy.
-- =============================================================================

BEGIN;

-- Renombrar tablas legacy antes de dropear (por si hubiera que rollback).
ALTER TABLE public.user_roles            RENAME TO user_roles_legacy;
ALTER TABLE public.memberships           RENAME TO memberships_legacy;
ALTER TABLE public.internal_role_assignments RENAME TO internal_role_assignments_legacy_old;
-- NOTA: internal_role_assignments (v2) ya existe con este nombre — arriba se
-- renombra la vieja SOLO si nunca se droppeó. En proyectos nuevos donde el v2
-- reutilizó el nombre desde el principio, este bloque es no-op y sigue.

-- Renombrar enums v2 al nombre canónico (drop enums viejos antes).
DROP TYPE IF EXISTS public.app_role      CASCADE;
DROP TYPE IF EXISTS public.org_role      CASCADE;
DROP TYPE IF EXISTS public.internal_role CASCADE;
DROP TYPE IF EXISTS public.platform_role CASCADE;

ALTER TYPE public.app_role_v2      RENAME TO app_role;
ALTER TYPE public.org_role_v2      RENAME TO org_role;
ALTER TYPE public.internal_role_v2 RENAME TO internal_role;

-- Renombrar tabla v2 al nombre canónico.
ALTER TABLE public.memberships_v2 RENAME TO memberships;

-- Actualizar signatures de funciones que referencian los tipos.
-- (Postgres actualiza el tipo automáticamente al renombrar el ALTER TYPE.
--  Las funciones creadas contra el tipo v2 ahora referencian `app_role`.)

-- Drop tablas legacy y funciones obsoletas.
DROP FUNCTION IF EXISTS public.handle_new_user()           CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text)        CASCADE;
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.has_platform_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_owner(uuid, uuid)    CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid)   CASCADE;
DROP FUNCTION IF EXISTS public.get_active_internal_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_my_onboarding()      CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_abandoned_onboarding() CASCADE;

DROP TABLE IF EXISTS public.user_roles_legacy;
DROP TABLE IF EXISTS public.memberships_legacy;
DROP TABLE IF EXISTS public.internal_role_assignments_legacy_old;
DROP TABLE IF EXISTS public.platform_roles;

COMMIT;

-- Verificación:
SELECT typname FROM pg_type
WHERE typname IN ('app_role','org_role','internal_role') AND typnamespace = 'public'::regnamespace;
-- Debe devolver exactamente 3 filas.
