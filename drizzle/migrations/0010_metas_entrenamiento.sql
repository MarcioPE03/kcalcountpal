ALTER TABLE public.profiles ADD COLUMN modo_entrenamiento text NOT NULL DEFAULT 'sumar_quemadas';
UPDATE public.profiles SET modo_entrenamiento = CASE WHEN sumar_quemadas THEN 'sumar_quemadas' ELSE 'fija' END;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_modo_entrenamiento_chk CHECK (modo_entrenamiento IN ('fija','sumar_quemadas','por_tipo_dia'));
ALTER TABLE public.profiles ADD COLUMN umbral_entreno_kcal integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_umbral_entreno_chk CHECK (umbral_entreno_kcal BETWEEN 0 AND 2000);
COMMENT ON COLUMN public.profiles.sumar_quemadas IS 'DEPRECATED: replaced by modo_entrenamiento';

ALTER TABLE public.metas_diarias
  ADD COLUMN calorias_entreno integer,
  ADD COLUMN proteinas_g_entreno numeric,
  ADD COLUMN carbohidratos_g_entreno numeric,
  ADD COLUMN grasas_g_entreno numeric,
  ADD COLUMN pct_proteinas_entreno numeric(4,1),
  ADD COLUMN pct_carbohidratos_entreno numeric(4,1),
  ADD COLUMN pct_grasas_entreno numeric(4,1);
ALTER TABLE public.metas_diarias
  ADD CONSTRAINT metas_kcal_entreno_chk CHECK (calorias_entreno BETWEEN 800 AND 6000),
  ADD CONSTRAINT metas_pct_p_entreno_chk CHECK (pct_proteinas_entreno BETWEEN 5.0 AND 70.0),
  ADD CONSTRAINT metas_pct_c_entreno_chk CHECK (pct_carbohidratos_entreno BETWEEN 5.0 AND 70.0),
  ADD CONSTRAINT metas_pct_g_entreno_chk CHECK (pct_grasas_entreno BETWEEN 5.0 AND 70.0),
  ADD CONSTRAINT metas_gramos_entreno_chk CHECK (proteinas_g_entreno >= 0 AND carbohidratos_g_entreno >= 0 AND grasas_g_entreno >= 0),
  ADD CONSTRAINT metas_entreno_completo_chk CHECK (
    (calorias_entreno IS NULL AND proteinas_g_entreno IS NULL AND carbohidratos_g_entreno IS NULL AND grasas_g_entreno IS NULL
      AND pct_proteinas_entreno IS NULL AND pct_carbohidratos_entreno IS NULL AND pct_grasas_entreno IS NULL)
    OR (calorias_entreno IS NOT NULL AND proteinas_g_entreno IS NOT NULL AND carbohidratos_g_entreno IS NOT NULL AND grasas_g_entreno IS NOT NULL
      AND pct_proteinas_entreno IS NOT NULL AND pct_carbohidratos_entreno IS NOT NULL AND pct_grasas_entreno IS NOT NULL
      AND pct_proteinas_entreno + pct_carbohidratos_entreno + pct_grasas_entreno = 100.0));