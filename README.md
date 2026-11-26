# Iowa Bowling Coaches Association website

Static replacement for the public Iowa Bowling Coaches Association WordPress site. GitHub and Cloudflare Pages publish the static pages without a CMS. A single Pages Function handles the history contribution form.

## Build and validate

```powershell
npm run build
npm run validate
```

Cloudflare Pages settings:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20 or newer

## Updating content

The current WordPress snapshot is stored in `src/data/wordpress-content.json`. The build creates the public HTML pages and preserves the original files under `wp-content/uploads/` so existing PDF links continue to work.

To refresh the snapshot while WordPress remains online:

```powershell
npm run import:wordpress
npm run build
npm run validate
```

Review all imported changes before committing them. Once WordPress is retired, future content can be updated directly in the checked-in data or moved to a simpler Markdown content structure.

## History contributions

Before publishing the contribution form, create a dedicated Cloudflare D1 database named `iowa-bowling-history-inbox`, run `history-inbox.sql` in its Console, and bind it to the **Production** environment of the Pages project as `HISTORY_INBOX`. Deploy after adding the binding. The handler only accepts posts from the public site and does not expose a public read endpoint. Do not bind the production inbox to preview deployments.

To review submissions, open **Cloudflare → Storage & databases → D1 → iowa-bowling-history-inbox → Console** and run:

```sql
SELECT id, datetime(received_at, 'unixepoch') AS received_utc, name, email, message, link
FROM history_submissions ORDER BY id DESC LIMIT 50;
```

Replies are not sent automatically. Review materials before publishing any contribution, and keep optional reply addresses out of the public archive.

## Deployment safety

Building or deploying a preview does not change the live domain. Follow `MIGRATION_PLAN.md` before changing nameservers or custom-domain records. Preserve the existing DreamHost MX and SPF records during DNS migration.
