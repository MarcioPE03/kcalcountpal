ALTER TABLE public.comidas DROP CONSTRAINT IF EXISTS comidas_origen_check;
ALTER TABLE public.comidas ADD CONSTRAINT comidas_origen_check CHECK (origen IN ('foto','texto','manual','copia','codigo'));
COMMENT ON COLUMN public.comidas.foto_path IS 'DEPRECATED: photos are no longer stored; analysis-only';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS limite_categorias_diario integer NOT NULL DEFAULT 100;
CREATE OR REPLACE FUNCTION public.protect_limite()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.limite_analisis_diario := OLD.limite_analisis_diario;
    NEW.limite_categorias_diario := OLD.limite_categorias_diario;
  END IF;
  RETURN NEW;
END $function$;
ALTER TABLE public.analisis_ia DROP CONSTRAINT IF EXISTS analisis_ia_estado_check;