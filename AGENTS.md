<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## BuildSource LT
- Account type (buyer/supplier) lives in `user_roles`, set once via the `choose_account_type` RPC or signup metadata trigger — never on profiles, to prevent role escalation.
- Signed-in pages live under `src/routes/_authenticated/`; `/dashboard` only redirects (onboarding until role + company exist, then `/app`, `/supplier` or `/admin`).
- Area menus come from `src/lib/nav.ts`; each area has `<area>.$section.tsx` placeholders until a section gets its own route file.
- All UI text goes through `useI18n().t` with keys in `src/lib/translations.ts` (Lithuanian falls back to English).
- Full product spec is `docs/build-spec.md`; follow its section numbers.
