CREATE TABLE public.productos_propios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  codigo text NOT NULL CHECK (codigo ~ '^\d{13}$'),
  nombre text NOT NULL,
  marca text,
  calorias numeric NOT NULL CHECK (calorias >= 0),
  proteinas numeric CHECK (proteinas >= 0),
  carbohidratos numeric CHECK (carbohidratos >= 0),
  grasas numeric CHECK (grasas >= 0),
  grasas_saturadas numeric CHECK (grasas_saturadas >= 0),
  fibra numeric CHECK (fibra >= 0),
  azucares numeric CHECK (azucares >= 0),
  sodio_mg numeric CHECK (sodio_mg >= 0),
  porcion_g numeric CHECK (porcion_g > 0 AND porcion_g <= 1000),
  porcion_ml boolean NOT NULL DEFAULT false,
  categoria text NOT NULL DEFAULT 'Otros',
  origen text NOT NULL CHECK (origen IN ('etiqueta','manual','editado')),
  base text NOT NULL DEFAULT '100g' CHECK (base IN ('100g','porcion')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productos_propios_kcal_100g CHECK (base <> '100g' OR calorias <= 900),
  CONSTRAINT productos_propios_unico UNIQUE (user_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos_propios TO authenticated;
GRANT ALL ON public.productos_propios TO service_role;
ALTER TABLE public.productos_propios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.productos_propios FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.productos_propios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.productos_propios FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.productos_propios FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.productos_propios_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER productos_propios_touch BEFORE UPDATE ON public.productos_propios FOR EACH ROW EXECUTE FUNCTION public.productos_propios_touch();