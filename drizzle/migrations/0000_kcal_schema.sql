CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  peso_kg numeric,
  altura_cm numeric,
  edad int,
  sexo text,
  nivel_actividad text,
  objetivo text,
  onboarding_completo boolean NOT NULL DEFAULT false,
  limite_analisis_diario int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- prevent users from raising their own AI limit
CREATE OR REPLACE FUNCTION public.protect_limite() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.limite_analisis_diario := OLD.limite_analisis_diario;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_limite BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_limite();

CREATE TABLE public.metas_diarias (
  user_id uuid PRIMARY KEY,
  calorias int NOT NULL DEFAULT 2000,
  proteinas_g numeric NOT NULL DEFAULT 120,
  carbohidratos_g numeric NOT NULL DEFAULT 220,
  grasas_g numeric NOT NULL DEFAULT 65,
  grasas_saturadas_g numeric,
  fibra_g numeric,
  azucares_g numeric,
  sodio_mg numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.metas_diarias TO authenticated;
GRANT ALL ON public.metas_diarias TO service_role;
ALTER TABLE public.metas_diarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own metas select" ON public.metas_diarias FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own metas insert" ON public.metas_diarias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own metas update" ON public.metas_diarias FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.comidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha date NOT NULL,
  momento text NOT NULL CHECK (momento IN ('desayuno','almuerzo','merienda','cena','snack')),
  nombre text NOT NULL,
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('foto','texto','manual','copia')),
  descripcion text,
  foto_path text,
  confianza text CHECK (confianza IN ('baja','media','alta')),
  kcal_min numeric,
  kcal_max numeric,
  ingredientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  calorias numeric NOT NULL DEFAULT 0,
  proteinas_g numeric NOT NULL DEFAULT 0,
  carbohidratos_g numeric NOT NULL DEFAULT 0,
  grasas_g numeric NOT NULL DEFAULT 0,
  grasas_saturadas_g numeric NOT NULL DEFAULT 0,
  fibra_g numeric NOT NULL DEFAULT 0,
  azucares_g numeric NOT NULL DEFAULT 0,
  sodio_mg numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comidas_user_fecha ON public.comidas(user_id, fecha);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comidas TO authenticated;
GRANT ALL ON public.comidas TO service_role;
ALTER TABLE public.comidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own comidas select" ON public.comidas FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own comidas insert" ON public.comidas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own comidas update" ON public.comidas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own comidas delete" ON public.comidas FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.analisis_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fecha_local date NOT NULL,
  estado text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analisis_user_fecha ON public.analisis_ia(user_id, fecha_local);
GRANT SELECT, INSERT ON public.analisis_ia TO authenticated;
GRANT ALL ON public.analisis_ia TO service_role;
ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own analisis select" ON public.analisis_ia FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own analisis insert" ON public.analisis_ia FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.metas_diarias (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
