GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private
AS $$ SELECT private.has_role(_user_id, _role) $$;