
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
-- authenticated must retain EXECUTE on has_role because RLS policies call it
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
