-- prevent_profile_role_escalation() was added by hand in the dashboard (it is in
-- no earlier migration). It refused every role change unless is_admin(), and
-- is_admin() looks up auth.uid(), which is null for the server's service key. So
-- approve-dealer's profile update ("customer" -> "dealer") failed for every new
-- dealer after the application had already been marked approved.
--
-- Same rule as protect_profile_privileged_columns(): a signed-in user who is not
-- an admin may not change a role; the server (no auth.uid()) and admins may.
-- Customers still cannot promote themselves.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can alter user roles.';
  END IF;
  RETURN NEW;
END;
$function$;

-- Recorded here because both triggers existed only in the live database.
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_escalation();
