CREATE TABLE public.favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clave text NOT NULL,
  nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
  categoria text NOT NULL DEFAULT 'Otros',
  ingredientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  calorias numeric NOT NULL DEFAULT 0 CHECK (calorias >= 0),
  proteinas_g numeric NOT NULL DEFAULT 0 CHECK (proteinas_g >= 0),
  carbohidratos_g numeric NOT NULL DEFAULT 0 CHECK (carbohidratos_g >= 0),
  grasas_g numeric NOT NULL DEFAULT 0 CHECK (grasas_g >= 0),
  grasas_saturadas_g numeric NOT NULL DEFAULT 0 CHECK (grasas_saturadas_g >= 0),
  fibra_g numeric NOT NULL DEFAULT 0 CHECK (fibra_g >= 0),
  azucares_g numeric NOT NULL DEFAULT 0 CHECK (azucares_g >= 0),
  sodio_mg numeric NOT NULL DEFAULT 0 CHECK (sodio_mg >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, clave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favoritos TO authenticated;
GRANT ALL ON public.favoritos TO service_role;
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own favoritos select" ON public.favoritos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own favoritos insert" ON public.favoritos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favoritos update" ON public.favoritos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own favoritos delete" ON public.favoritos FOR DELETE TO authenticated USING (auth.uid() = user_id);