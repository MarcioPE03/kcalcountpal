CREATE TABLE public.favoritos_entrenamientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
  calorias_quemadas numeric NOT NULL CHECK (calorias_quemadas >= 1 AND calorias_quemadas <= 5000),
  duracion_min integer NULL CHECK (duracion_min IS NULL OR duracion_min > 0),
  clave text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX favoritos_entrenamientos_user_clave ON public.favoritos_entrenamientos (user_id, clave);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favoritos_entrenamientos TO authenticated;
GRANT ALL ON public.favoritos_entrenamientos TO service_role;
ALTER TABLE public.favoritos_entrenamientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_ent_select" ON public.favoritos_entrenamientos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "fav_ent_insert" ON public.favoritos_entrenamientos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fav_ent_update" ON public.favoritos_entrenamientos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fav_ent_delete" ON public.favoritos_entrenamientos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.fav_ent_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER fav_ent_touch BEFORE UPDATE ON public.favoritos_entrenamientos FOR EACH ROW EXECUTE FUNCTION public.fav_ent_touch();