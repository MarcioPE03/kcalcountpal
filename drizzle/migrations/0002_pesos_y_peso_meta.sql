CREATE TABLE public.pesos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  peso_kg numeric NOT NULL CHECK (peso_kg >= 25 AND peso_kg <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fecha)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pesos TO authenticated;
GRANT ALL ON public.pesos TO service_role;
ALTER TABLE public.pesos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pesos select" ON public.pesos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own pesos insert" ON public.pesos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pesos update" ON public.pesos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pesos delete" ON public.pesos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX pesos_user_fecha ON public.pesos (user_id, fecha);

ALTER TABLE public.profiles ADD COLUMN peso_meta_kg numeric;

INSERT INTO public.pesos (user_id, fecha, peso_kg)
SELECT id, (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, peso_kg
FROM public.profiles WHERE peso_kg BETWEEN 25 AND 300
ON CONFLICT (user_id, fecha) DO NOTHING;

COMMENT ON COLUMN public.profiles.peso_kg IS 'DEPRECATED: replaced by latest row in public.pesos';