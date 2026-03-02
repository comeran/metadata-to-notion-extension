# Privacy Policy - Metadata to Notion

Last updated: 2026-03-02

Metadata to Notion is a browser extension that helps users import metadata from supported pages (Douban, TMDB, IGN) into user-selected Notion databases.

## What data is processed

- User configuration:
  - Notion integration token
  - Notion database IDs
  - Field mapping settings
- Page metadata from the active supported page:
  - Title, rating, tags, summary, release information and similar structured metadata
  - Page URL
- Optional image data used for Notion file upload (cover/poster)

## Where data is stored

- Extension configuration is stored in `chrome.storage.local` on the user's device.
- Database schema cache is stored in `chrome.storage.local` for faster mapping.

## Where data is sent

- Data is sent to Notion API (`https://api.notion.com`) only when the user requests schema loading or imports content.
- The extension does not operate a custom backend service.

## Data sharing

- No sale of personal data.
- No analytics SDK or ad network is included.
- Data is not shared with third parties except Notion API calls initiated by user actions.

## User control

- Users can edit or remove configuration in the extension settings.
- Users can remove the extension at any time to stop all processing.
- Users can revoke Notion integration token permissions in Notion.

## Contact

For support, use the repository/project contact channel where this extension is distributed.
