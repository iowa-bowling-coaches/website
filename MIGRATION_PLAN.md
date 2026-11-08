# Iowa Bowling Coaches Association — Cloudflare Migration

Status: local static replacement built and validated; no GitHub remote, Cloudflare project, DNS, registrar, email, or production changes made.

Audit date: 2026-11-08

## Recommended target

Rebuild the public WordPress site as a small static site and deploy it to Cloudflare Pages. Keep the existing DreamHost site online until the Cloudflare preview has been reviewed and approved.

Why this fits:

- The public site has a small, mostly archival content set.
- There are no public comments, accounts, checkout, or other required WordPress-only features in the current inventory.
- Cloudflare Pages can serve the HTML, CSS, image, and PDFs without a database or PHP runtime.
- A static site reduces maintenance and removes the exposed WordPress administration surface.

Future updates will initially be made through repository files. Editing controls can be added later if needed.

## Current public-site inventory

### Main content

- Home / latest updates
- Awards (current and archived awards from 2018 through 2026)
- History (season headings from 2001-02 through 2025-26, with selected historical programs and documents)
- Links
- Hall of Fame (currently says "COMING SOON!")
- Three news posts:
  - New Site — 2026-01-20
  - End of Season Awards — 2026-02-07
  - Boys end of season awards — 2026-02-23

The WordPress installation also exposes three theme/sample pages that should not be migrated as public content:

- About (Theme)
- Contact (Theme)
- Sample Page

### Media

- 48 media-library items total
- 47 PDFs
- 1 PNG article image

The PDFs include All-State, All-District, Academic All-State, state tournament programs, and a state qualifier letter. Preserve their existing filenames and old WordPress URLs through redirects so bookmarks and search-engine results continue to work.

## Current infrastructure

- Authoritative DNS: DreamHost (`ns1.dreamhost.com`, `ns2.dreamhost.com`, `ns3.dreamhost.com`)
- Website origin: `173.236.137.104`
- Apex and `www` currently point to the same origin
- Registrar: DreamHost, LLC
- Registration expiration reported by RDAP: 2027-06-08
- Registry status: client transfer prohibited (normal registrar lock)
- DNSSEC: no DS record observed
- Mail exchangers:
  - `mx1.mailchannels.net`, priority 0
  - `mx2.mailchannels.net`, priority 0
- SPF TXT record:
  - `v=spf1 mx include:netblocks.dreamhost.com include:relay.mailchannels.net -all`
- No DMARC record observed at `_dmarc.iowabowlingcoaches.org`
- No apex CAA record observed

Email is outside the website migration. Preserve both MX records and the SPF record exactly during the DNS move. Do not proxy mail-related records.

## Migration phases

### 1. Preserve the current site

- Export the WordPress database and `wp-content/uploads` from DreamHost.
- Save the WordPress REST API inventory used for the static rebuild.
- Export or manually record the complete DreamHost DNS zone, including any records not discoverable from public DNS.
- Record the current registrar settings and nameservers.

### 2. Build the replacement locally

- Use a data-driven static structure so annual awards and news posts are easy to add.
- Recreate the current public content, improving navigation and mobile readability without changing the meaning of records.
- Copy all 48 media assets locally.
- Generate stable pages for Home, Awards, History, Links, Hall of Fame, and each news post.
- Add a custom 404 page, sitemap, robots file, security headers, and canonical URLs.
- Add redirects for existing WordPress URLs, especially `/33-2/`, dated post URLs, and every `/wp-content/uploads/...` asset URL if asset paths change.

Completed 2026-11-08. The local build preserves the original `/wp-content/uploads/...` paths, so existing document bookmarks do not need redirects. Five scanned programs were rebuilt as visually verified web-optimized copies because the originals exceeded Cloudflare Pages' 25 MiB asset limit. The original DreamHost files were not changed.

### 3. Validate on a preview URL

- Deploy to an unconnected Cloudflare Pages preview.
- Compare all visible content against WordPress.
- Check every internal link and PDF.
- Test phone, tablet, and desktop layouts.
- Confirm accessibility basics: headings, focus states, contrast, link labels, and keyboard navigation.
- Confirm no private WordPress data or draft content is included.

### 4. Prepare Cloudflare DNS

- Add `iowabowlingcoaches.org` to the intended Cloudflare account.
- Review Cloudflare's automatic DNS import against the DreamHost zone export.
- Correctly recreate all non-web records before changing nameservers.
- Associate both `iowabowlingcoaches.org` and `www.iowabowlingcoaches.org` with the Pages project.
- Choose one canonical hostname and redirect the other.

### 5. Cut over

- Make the nameserver change at DreamHost only after preview approval and DNS comparison.
- Confirm Cloudflare marks the zone active.
- Verify the apex site, `www`, HTTPS certificate, redirects, PDFs, and mail DNS.
- Keep DreamHost hosting intact during the observation period.

### 6. Retire WordPress

- Monitor the Cloudflare site and email for an agreed observation period.
- Retain the WordPress/database/media backup.
- Cancel or reduce DreamHost hosting only after the new site and email behavior are confirmed.
- Domain registration can remain at DreamHost; moving DNS/hosting does not require a registrar transfer.

## Rollback

If a serious issue appears during cutover:

1. Restore the original DreamHost nameservers at the registrar.
2. Leave the DreamHost WordPress site and files unchanged so the old site becomes authoritative again.
3. Recheck the MX and SPF answers after DNS propagation.
4. Diagnose the Cloudflare configuration before attempting another cutover.

## Cloudflare constraints checked

- The Cloudflare Pages Free plan currently permits up to 20,000 files per site.
- A single Pages asset is limited to 25 MiB; any PDF above that limit must be optimized or stored in R2 instead.
- Apex custom domains require the domain to be a Cloudflare zone with Cloudflare nameservers.
- Cloudflare recommends reviewing all imported DNS records before updating nameservers.

Official references:

- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/dns/get-started/
- https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/

