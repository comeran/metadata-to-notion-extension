# Chrome Web Store Release Checklist

## 1. Version and package

- Update `manifest.json` version (must increase every submission).
- Build zip from project root (zip root must contain `manifest.json` directly).

```bash
zip -r metadata-to-notion-v0.2.1.zip manifest.json src assets PRIVACY.md README.md README.zh-CN.md RELEASE_CHECKLIST.md docs
```

## 2. Store listing assets

- Extension name and short description
- Detailed description
- Screenshots (recommended 1280x800 or 640x400)
- 128x128 store icon (replace placeholder under `assets/icons/icon128.png`)
- Privacy policy URL (host `PRIVACY.md` content on a public URL)

## 3. Permission disclosure suggestions

- `storage`: store syncable configuration, local token, and schema cache
- `activeTab`: read metadata from the active supported page and capture the visible tab for Douban cover fallback
- host permissions for supported sites and Notion API only

## 4. Pre-submit self-test

- Import flow works for movie/book/tv/game
- Options page can load schema and keep mappings after reload
- Popup preview can edit fields and import successfully
- Douban/TMDB/IGN unsupported pages show clear errors

## 5. Common review notes

- Explain why Notion token is required and where it is stored
- Explain no external backend is used
- Keep permissions minimal and aligned with features
