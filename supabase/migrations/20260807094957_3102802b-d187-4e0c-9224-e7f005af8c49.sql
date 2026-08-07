CREATE OR REPLACE FUNCTION public.grant_admin_for_official_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF new.email_confirmed_at IS NOT NULL
     AND lower(new.email) = 'admin@crane5.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN new;
END;
$function$;