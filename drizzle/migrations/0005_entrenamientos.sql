CREATE TABLE public.entrenamientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  nombre text NOT NULL,
  calorias_quemadas numeric NOT NULL CHECK (calorias_quemadas >= 1 AND calorias_quemadas <= 5000),
  duracion_min integer CHECK (duracion_min IS NULL OR duracion_min > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entrenamientos TO authenticated;
GRANT ALL ON public.entrenamientos TO service_role;
ALTER TABLE public.entrenamientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entrenamientos select" ON public.entrenamientos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entrenamientos insert" ON public.entrenamientos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entrenamientos update" ON public.entrenamientos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entrenamientos delete" ON public.entrenamientos FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX entrenamientos_user_fecha_idx ON public.entrenamientos (user_id, fecha);
ALTER TABLE public.profiles ADD COLUMN sumar_quemadas boolean NOT NULL DEFAULT true;