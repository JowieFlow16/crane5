-- Restore the ability for signed-in users' access rules to evaluate the role check.
-- private.has_role is SECURITY DEFINER, read-only, and lives in a schema that is
-- NOT exposed through the Data API, so granting EXECUTE does not make it callable
-- over HTTP; it only lets row-level access rules evaluate correctly.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;