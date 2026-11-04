<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Pure nutrition/date/format logic lives in `src/lib/nutri.ts` (tested in `nutri.test.ts`); keep it free of browser/server deps so rules stay testable.
- Dates are local-day strings computed in America/Argentina/Buenos_Aires (the app's audience), never UTC `toISOString()` of "now".
- AI calls run only in `src/lib/ai.functions.ts` server functions; the model id lives in the single constant in `src/lib/ai-model.ts`.
- Food photos are never stored: compressed in the browser, sent only to the analysis server function, then discarded (`comidas.foto_path` is deprecated).
- Signed-in pages live under `src/routes/_authenticated/`; `/` is the Hoy screen there (no top-level index route).
- Weight history lives only in the `pesos` table (one row per user/day); never write `profiles.peso_kg` (deprecated) so there is a single source of truth.
- Barcode products come from Open Food Facts via a server function; parsing/coherence rules live in pure `src/lib/off.ts` (tested in `off.test.ts`).
- Day balance (remaining, ring progress, burned-kcal validation) lives in pure `balanceDia`/`validarQuemadas` in `nutri.ts`; UI never recomputes it.
- Favorites are independent value copies in `favoritos` keyed by `claveComida` (unique per user); never reference `comidas` rows. "Mis comidas" rules (dedup, scaling, bulk rows) live in pure `src/lib/mis-comidas.ts` (tested in `mis-comidas.test.ts`).
