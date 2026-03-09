# Metadata to Notion (Browser Extension)

中文说明请见: [README.zh-CN.md](./README.zh-CN.md)

A Manifest V3 browser extension to import metadata from:
- Douban movie / book pages
- TMDB TV pages
- IGN game pages

into Notion databases with configurable field mapping.

## Load extension

1. Open Chrome/Edge extension page.
2. Enable developer mode.
3. Load unpacked extension from this project folder.
4. Open extension options page and configure:
   - Notion Integration Token
   - Database IDs for each content type (`movie`, `book`, `tv`, `game`)
   - Scan panel shows the exact scanned URL and normalized fields (prefilled from popup `去配置此类型`)
   - Click `读取 Notion 字段` for each type to fetch schema
   - Manually map source fields to Notion properties per type (source fields are different by type)
   - Use field `启用` switches to disable any source field you don't want to import

5. Recommended first-run flow:
   - Open a real detail page (Douban/TMDB/IGN), open popup.
   - If not configured, click `去配置此类型`; options page opens with scanned metadata prefilled.
   - Complete Notion field mapping and save.

6. In popup, review import preview fields and uncheck any field before import.

## Storage and security

- Syncable configuration (`databaseId`, field mapping, enabled state, import options) is stored in `chrome.storage.sync`.
- Notion token, schema cache, and temporary scan state are stored in `chrome.storage.local`.

## Package for release

1. Bump extension version in `manifest.json`.
2. Build release zip from repository root:

```bash
zip -r metadata-to-notion-v0.2.1.zip manifest.json src assets PRIVACY.md README.md README.zh-CN.md RELEASE_CHECKLIST.md docs
```

3. Upload zip to Chrome Web Store dashboard.
4. Provide store listing assets and privacy policy URL.

See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for the full checklist.

## Notes

- For Douban cover images, the extension tries to upload image binaries to Notion file storage before writing `files` property.
- If image upload fails, import continues and leaves cover field empty.
- Complex Notion types (`relation`, `people`, `rollup`, `formula`) are intentionally skipped in this MVP.
- Replace placeholder icons under `assets/icons/` before production release.

## Type-specific source fields

- Movie: `title, originalTitle, year, rating, genres, summary, cover, source, sourceUrl, creators, duration, releaseDate, country, tags`
- Book: `title, originalTitle, rating, summary, cover, source, sourceUrl, creators, publisher, publishDate, isbn, pageCount, tags`
- TV: `title, originalTitle, year, rating, genres, summary, cover, source, sourceUrl, creators, firstAirDate, seasonCount, episodeCount, status, tags`
- Game: `title, rating, genres, summary, cover, source, sourceUrl, developers, publishers, platforms, releaseDate, tags`
