export const SOURCE_FIELDS_BY_TYPE = {
  movie: {
    title: "标题",
    originalTitle: "原始标题",
    year: "年份",
    rating: "评分",
    genres: "类型",
    summary: "简介",
    cover: "封面",
    source: "来源站点",
    sourceUrl: "来源链接",
    creators: "导演/主创",
    duration: "片长",
    releaseDate: "上映日期",
    country: "制片国家/地区",
    tags: "标签"
  },
  book: {
    title: "标题",
    originalTitle: "原始标题",
    rating: "评分",
    summary: "简介",
    cover: "封面",
    source: "来源站点",
    sourceUrl: "来源链接",
    creators: "作者",
    publisher: "出版社",
    publishDate: "出版年",
    isbn: "ISBN",
    pageCount: "页数",
    tags: "标签"
  },
  tv: {
    tmdbId: "TMDB ID",
    title: "标题",
    originalTitle: "原始标题",
    year: "年份",
    rating: "评分",
    genres: "类型",
    summary: "简介",
    cover: "封面",
    source: "来源站点",
    sourceUrl: "来源链接",
    country: "出品国家",
    creators: "主创",
    firstAirDate: "首播日期",
    latestEpisodeCode: "最新一集(SxxExx)",
    seasonCount: "季数",
    episodeCount: "集数",
    status: "状态",
    tags: "标签"
  },
  game: {
    title: "标题",
    rating: "评分",
    ignRating: "IGN评分",
    genres: "类型",
    summary: "简介",
    cover: "封面",
    source: "来源站点",
    sourceUrl: "来源链接",
    developers: "开发商",
    publishers: "发行商",
    platforms: "平台",
    publishDate: "发布日期",
    mainStoryHours: "Main Story时长",
    storySidesHours: "Story+Sides时长",
    everythingHours: "Everything时长",
    allStylesHours: "All Styles时长",
    releaseDate: "发售日期(兼容)",
    tags: "标签"
  }
};

export const SOURCE_TYPE_HINTS = {
  title: "title / rich_text",
  originalTitle: "title / rich_text",
  year: "number / rich_text / select",
  rating: "number / rich_text / select",
  genres: "multi_select / rich_text",
  summary: "rich_text",
  cover: "files",
  source: "select / rich_text",
  sourceUrl: "url / rich_text",
  creators: "multi_select / rich_text",
  tags: "multi_select / rich_text",
  duration: "number / rich_text",
  releaseDate: "date / rich_text",
  country: "multi_select / select / rich_text",
  publisher: "title / rich_text / select",
  publishDate: "date / rich_text",
  isbn: "rich_text / number",
  pageCount: "number / rich_text",
  firstAirDate: "date / rich_text",
  latestEpisodeCode: "rich_text / select",
  seasonCount: "number / rich_text",
  episodeCount: "number / rich_text",
  status: "select / rich_text",
  developers: "multi_select / select / rich_text",
  publishers: "multi_select / select / rich_text",
  platforms: "multi_select / select / rich_text"
  ,
  ignRating: "number / rich_text / select",
  publishDate: "date / rich_text",
  mainStoryHours: "number / rich_text",
  storySidesHours: "number / rich_text",
  everythingHours: "number / rich_text"
  ,
  allStylesHours: "number / rich_text"
};

export const SOURCE_FIELD_TYPE_COMPAT = {
  title: ["title", "rich_text"],
  originalTitle: ["title", "rich_text"],
  year: ["number", "rich_text", "select"],
  rating: ["number", "rich_text", "select"],
  genres: ["multi_select", "rich_text", "select"],
  summary: ["rich_text"],
  cover: ["files", "url", "rich_text"],
  source: ["select", "multi_select", "rich_text", "title"],
  sourceUrl: ["url", "rich_text"],
  creators: ["multi_select", "rich_text", "select"],
  tags: ["multi_select", "rich_text", "select"],
  duration: ["number", "rich_text"],
  releaseDate: ["date", "rich_text", "select"],
  country: ["multi_select", "select", "rich_text"],
  publisher: ["rich_text", "select", "title"],
  publishDate: ["date", "rich_text", "select"],
  isbn: ["rich_text", "number", "title"],
  pageCount: ["number", "rich_text"],
  firstAirDate: ["date", "rich_text", "select"],
  latestEpisodeCode: ["rich_text", "select", "title"],
  seasonCount: ["number", "rich_text"],
  episodeCount: ["number", "rich_text"],
  status: ["select", "rich_text", "title"],
  developers: ["multi_select", "select", "rich_text", "title"],
  publishers: ["multi_select", "select", "rich_text", "title"],
  platforms: ["multi_select", "select", "rich_text"]
  ,
  ignRating: ["number", "rich_text", "select"],
  publishDate: ["date", "rich_text", "select"],
  mainStoryHours: ["number", "rich_text"],
  storySidesHours: ["number", "rich_text"],
  everythingHours: ["number", "rich_text"]
  ,
  allStylesHours: ["number", "rich_text"]
};

export const SOURCE_FIELD_NAME_HINTS = {
  title: ["name", "title", "标题"],
  originalTitle: ["original", "原名", "原始", "英文名"],
  year: ["year", "年份", "发行", "release year"],
  rating: ["rating", "score", "评分", "分数"],
  genres: ["genre", "genres", "类型", "分类"],
  summary: ["summary", "overview", "简介", "描述", "description"],
  cover: ["cover", "poster", "image", "封面", "海报", "图片"],
  source: ["source", "来源", "平台", "站点"],
  sourceUrl: ["url", "link", "链接", "地址"],
  creators: ["creator", "author", "director", "writer", "主创", "作者", "导演", "编剧"],
  tags: ["tag", "标签", "关键词"],
  duration: ["duration", "runtime", "片长", "时长"],
  releaseDate: ["release date", "premiere", "上映", "发行", "发售", "date"],
  country: ["country", "region", "国家", "地区"],
  publisher: ["publisher", "出版社"],
  publishDate: ["publish date", "published", "出版年", "出版日期"],
  isbn: ["isbn"],
  pageCount: ["pages", "page count", "页数"],
  firstAirDate: ["first air date", "air date", "首播"],
  latestEpisodeCode: ["latest episode", "last episode", "sxxexx", "最新一集"],
  seasonCount: ["season", "seasons", "季数"],
  episodeCount: ["episode", "episodes", "集数"],
  status: ["status", "状态"],
  developers: ["developer", "developers", "开发商", "开发"],
  publishers: ["publisher", "publishers", "发行商", "发行"],
  platforms: ["platform", "platforms", "平台"]
  ,
  ignRating: ["ign rating", "rating", "review score", "score", "评分"],
  publishDate: ["publish date", "发布日期", "发售日期", "release date"],
  mainStoryHours: ["main story", "main_story", "主线时长"],
  storySidesHours: ["story and sides", "story+sides", "story_sides", "支线时长"],
  everythingHours: ["everything", "completionist", "全收集时长"]
  ,
  allStylesHours: ["all styles", "all_styles", "all style", "全风格时长"]
};

export function getSourceFieldValue(metadata, sourceField) {
  if (!metadata) return "";
  if (sourceField === "cover") return metadata.coverUrl || "";
  return metadata[sourceField];
}

export function hasMeaningfulValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function getOrderedSourceFields(type, metadata = null) {
  const sourceFields = Object.keys(SOURCE_FIELDS_BY_TYPE[type] || {});
  if (!metadata) return sourceFields;
  const present = [];
  const missing = [];
  for (const sourceField of sourceFields) {
    if (hasMeaningfulValue(getSourceFieldValue(metadata, sourceField))) present.push(sourceField);
    else missing.push(sourceField);
  }
  return [...present, ...missing];
}
