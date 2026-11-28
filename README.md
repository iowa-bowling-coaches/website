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

Before publishing the contribution form:

1. Create a dedicated Cloudflare D1 database named `iowa-bowling-history-inbox`, run `history-inbox.sql` in its Console, and bind it to the **Production** environment of the Pages project as `HISTORY_INBOX`. Do not bind the production inbox to preview deployments.
2. Verify the owner's destination address in Cloudflare Email Service and configure an outbound-only sending subdomain, such as `notify.iowabowlingcoaches.org`. Leave the existing domain's incoming mail and SPF records in place.
3. Configure the Pages variables `HISTORY_MAIL_ACCOUNT` (Cloudflare account ID) and `HISTORY_MAIL_FROM` (sender on the outbound subdomain). Store `HISTORY_MAIL_TO` (the verified inbox) and `HISTORY_MAIL_TOKEN` (account-scoped Email Sending API token) as encrypted server-side secrets. Do not put them in source or client code.
4. For a prelaunch smoke test, configure the Preview environment with a separate D1 database initialized with the same schema, the same mail settings, and a randomly generated `HISTORY_TEST_KEY` secret of at least 32 characters. After deploying the `history-contributions` branch preview, open `/api/history-submissions` on its branch alias and use the protected synthetic test form. Verify the stored preview row and actual Gmail delivery before publishing. Ordinary visitor submissions on preview hosts are rejected. The test key is not needed in production.

The endpoint has no public read access. It stores each contribution before attempting delivery. If email delivery cannot be confirmed, the contribution remains in D1 and the function logs only its submission ID.

To review submissions, open **Cloudflare → Storage & databases → D1 → iowa-bowling-history-inbox → Console** and run:

```sql
SELECT id, datetime(received_at, 'unixepoch') AS received_utc, name, email, message, link
FROM history_submissions ORDER BY id DESC LIMIT 50;
```

Replies are not sent automatically. Review materials before publishing any contribution, and keep optional reply addresses out of the public archive.

## Deployment safety

Building or deploying a preview does not change the live domain. Follow `MIGRATION_PLAN.md` before changing nameservers or custom-domain records. Preserve the existing DreamHost MX and SPF records during DNS migration.
