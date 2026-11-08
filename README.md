# Iowa Bowling Coaches Association website

Static replacement for the public Iowa Bowling Coaches Association WordPress site. The source is designed for GitHub and Cloudflare Pages and uses no runtime framework, database, or CMS.

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

## Deployment safety

Building or deploying a preview does not change the live domain. Follow `MIGRATION_PLAN.md` before changing nameservers or custom-domain records. Preserve the existing DreamHost MX and SPF records during DNS migration.
