// TEMPORARY one-off: empties and deletes the old photo bucket. Removed after running once.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DUENO = "__OWNER__";
const BUCKET = "fotos-comidas";

export const limpiarFotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (context.userId !== DUENO) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bucket } = await supabaseAdmin.storage.getBucket(BUCKET);
    let borrados = 0;
    if (bucket) {
      // Collect every file path (one folder per user).
      const paths: string[] = [];
      const { data: carpetas, error: e1 } = await supabaseAdmin.storage.from(BUCKET).list("", { limit: 1000 });
      if (e1) return { ok: false, paso: "listar", error: e1.message };
      for (const c of carpetas ?? []) {
        if (c.id) { paths.push(c.name); continue; }
        const { data: files, error } = await supabaseAdmin.storage.from(BUCKET).list(c.name, { limit: 1000 });
        if (error) return { ok: false, paso: "listar", error: error.message };
        for (const f of files ?? []) paths.push(`${c.name}/${f.name}`);
      }
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) return { ok: false, paso: "borrar", error: error.message };
        borrados += Math.min(100, paths.length - i);
      }
      const { error: e3 } = await supabaseAdmin.storage.deleteBucket(BUCKET);
      if (e3) return { ok: false, paso: "bucket", error: e3.message, borrados };
    }
    const { error: e4 } = await supabaseAdmin.from("comidas").update({ foto_path: null }).not("foto_path", "is", null);
    if (e4) return { ok: false, paso: "foto_path", error: e4.message, borrados };
    return { ok: true, borrados, bucketExistia: !!bucket };
  });
