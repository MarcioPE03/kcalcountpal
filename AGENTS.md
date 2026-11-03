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
- Dates are local-day strings computed on the client (device time zone), never UTC `toISOString()` of "now".
- AI calls run only in `src/lib/ai.functions.ts` server functions; the model id lives in the single constant in `src/lib/ai-model.ts`.
- Photos are uploaded to storage only when a meal is saved, never before analysis; deleting a meal removes its photo unless another copied meal references it.
- Signed-in pages live under `src/routes/_authenticated/`; `/` is the Hoy screen there (no top-level index route).
