ALTER TABLE public.metas_diarias
  ADD COLUMN pct_proteinas numeric(4,1) CHECK (pct_proteinas BETWEEN 5.0 AND 70.0),
  ADD COLUMN pct_carbohidratos numeric(4,1) CHECK (pct_carbohidratos BETWEEN 5.0 AND 70.0),
  ADD COLUMN pct_grasas numeric(4,1) CHECK (pct_grasas BETWEEN 5.0 AND 70.0);
ALTER TABLE public.metas_diarias ADD CONSTRAINT metas_pct_coherentes CHECK (
  (pct_proteinas IS NULL AND pct_carbohidratos IS NULL AND pct_grasas IS NULL)
  OR (pct_proteinas IS NOT NULL AND pct_carbohidratos IS NOT NULL AND pct_grasas IS NOT NULL
      AND pct_proteinas + pct_carbohidratos + pct_grasas = 100.0)
);