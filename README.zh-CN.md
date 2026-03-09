# Metadata to Notion（浏览器插件）

一个基于 Manifest V3 的浏览器插件，可将以下站点的详情页元数据导入 Notion 数据库：
- 豆瓣电影 / 豆瓣读书
- TMDB 电视剧
- IGN 游戏

支持按内容类型分别配置数据库与字段映射。

## 使用方式

1. 打开 Chrome / Edge 扩展管理页。
2. 开启开发者模式。
3. 选择“加载已解压的扩展程序”，加载本项目目录。
4. 打开插件设置页，完成配置：
   - Notion Integration Token
   - 各内容类型数据库 ID（`movie` / `book` / `tv` / `game`）
   - 点击 `读取 Notion 字段` 获取数据库 Schema
   - 为每个抓取字段配置映射目标
   - 可通过字段 `启用` 开关关闭不想写入的字段

5. 推荐首次流程：
   - 在真实详情页（豆瓣/TMDB/IGN）打开插件弹窗
   - 若提示未配置，点击 `去配置此类型`
   - 在设置页完成映射并保存

6. 返回弹窗预览，可按需取消字段并导入。

## 存储与安全

- 可同步配置（数据库 ID、字段映射、启用状态、导入选项）保存在 `chrome.storage.sync`。
- Notion Token、数据库字段缓存和临时扫描状态保存在 `chrome.storage.local`。

## 上架打包

1. 修改 `manifest.json` 版本号（每次提交必须递增）。
2. 在项目根目录打包：

```bash
zip -r metadata-to-notion-v0.2.1.zip manifest.json src assets PRIVACY.md README.md README.zh-CN.md RELEASE_CHECKLIST.md docs
```

3. 上传到 Chrome Web Store 开发者后台。
4. 补充商店素材与隐私政策 URL。

完整步骤见 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)。

## 说明

- 豆瓣封面会尽量上传为 Notion 文件；失败时会降级处理。
- `relation / people / rollup / formula` 等复杂类型暂未支持自动写入。
- 发布前请替换 `assets/icons/` 下的正式图标资源。

## 各类型抓取字段

- 电影：`title, originalTitle, year, rating, genres, summary, cover, source, sourceUrl, creators, duration, releaseDate, country, tags`
- 书籍：`title, originalTitle, rating, summary, cover, source, sourceUrl, creators, publisher, publishDate, isbn, pageCount, tags`
- 电视剧：`title, originalTitle, year, rating, genres, summary, cover, source, sourceUrl, creators, firstAirDate, latestEpisodeCode, seasonCount, episodeCount, status, country, tags`
- 游戏：`title, rating, ignRating, genres, summary, cover, source, sourceUrl, developers, publishers, platforms, publishDate, mainStoryHours, storySidesHours, everythingHours, allStylesHours, releaseDate, tags`
