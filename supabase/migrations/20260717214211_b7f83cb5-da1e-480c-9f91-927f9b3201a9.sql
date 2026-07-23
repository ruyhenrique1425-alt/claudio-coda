INSERT INTO public.user_roles (user_id, role)
SELECT id, 'gestor'::app_role FROM auth.users
WHERE email ILIKE 'ruyh@%'
ON CONFLICT (user_id, role) DO NOTHING;