function text(selector) {
  const el = document.querySelector(selector);
  return el ? el.textContent.trim() : "";
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function collectRawSignals() {
  const ogTitle = attr("meta[property='og:title']", "content");
  const ogDescription = attr("meta[property='og:description']", "content");
  const ogImage = attr("meta[property='og:image']", "content");
  const canonical = attr("link[rel='canonical']", "href");
  const metaDescription = attr("meta[name='description']", "content");

  const jsonLd = Array.from(document.querySelectorAll("script[type='application/ld+json']"))
    .map((script) => safeJsonParse(script.textContent || ""))
    .filter(Boolean)
    .slice(0, 3);

  return {
    pageTitle: document.title || "",
    canonical: absoluteUrl(canonical || location.href),
    metaDescription,
    ogTitle,
    ogDescription,
    ogImage: absoluteUrl(ogImage),
    jsonLd
  };
}

function attr(selector, name) {
  const el = document.querySelector(selector);
  const value = el ? el.getAttribute(name) : "";
  return value ? value.trim() : "";
}

function absoluteUrl(url) {
  if (!url) return "";
  try {
    return new URL(url, location.href).toString();
  } catch {
    return url;
  }
}

function parseMinutes(textValue) {
  const text = String(textValue || "").trim();
  if (!text) return "";
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return "";
  const value = Number(m[1]);
  return Number.isFinite(value) ? Math.round(value) : "";
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function parseNumber(textValue) {
  const text = String(textValue || "").trim();
  if (!text) return "";
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m) return "";
  const n = Number(m[1]);
  return Number.isFinite(n) ? String(n) : "";
}

function parseDateText(textValue) {
  const text = String(textValue || "").trim();
  if (!text) return "";
  const natural = text.match(/[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}/);
  if (natural) return natural[0];
  const m = text.match(/\d{4}([-/]\d{1,2})?([-/]\d{1,2})?/);
  if (m) return m[0];
  return text;
}

function getRawSignals() {
  return collectRawSignals();
}

function flattenJsonLdEntry(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.flatMap(flattenJsonLdEntry);
  if (entry["@graph"] && Array.isArray(entry["@graph"])) {
    return entry["@graph"].flatMap(flattenJsonLdEntry);
  }
  return [entry];
}

function getJsonLdCandidates() {
  const raw = getRawSignals();
  const list = raw.jsonLd || [];
  return list.flatMap(flattenJsonLdEntry);
}

function extractFromJsonLd() {
  const candidates = getJsonLdCandidates();
  let rating = "";
  let publishDate = "";
  let platforms = [];
  let developers = [];
  let publishers = [];

  for (const item of candidates) {
    const agg = item.aggregateRating || {};
    if (!rating && agg.ratingValue) rating = String(agg.ratingValue);
    if (!publishDate && item.datePublished) publishDate = String(item.datePublished);

    const gp = item.gamePlatform || item.platform || item.platforms;
    if (gp) {
      if (Array.isArray(gp)) {
        platforms = platforms.concat(
          gp.map((v) => (typeof v === "string" ? v : v?.name || "")).filter(Boolean)
        );
      } else if (typeof gp === "string") {
        platforms.push(gp);
      } else if (typeof gp === "object" && gp.name) {
        platforms.push(gp.name);
      }
    }

    const dev = item.developer || item.author || item.creator;
    if (dev) {
      const list = Array.isArray(dev) ? dev : [dev];
      developers = developers.concat(
        list.map((v) => (typeof v === "string" ? v : v?.name || "")).filter(Boolean)
      );
    }

    const pub = item.publisher;
    if (pub) {
      const list = Array.isArray(pub) ? pub : [pub];
      publishers = publishers.concat(
        list.map((v) => (typeof v === "string" ? v : v?.name || "")).filter(Boolean)
      );
    }
  }

  return {
    rating: parseNumber(rating),
    publishDate: parseDateText(publishDate),
    platforms: Array.from(new Set(platforms.map((v) => String(v).trim()).filter(Boolean))),
    developers: Array.from(new Set(developers.map((v) => String(v).trim()).filter(Boolean))),
    publishers: Array.from(new Set(publishers.map((v) => String(v).trim()).filter(Boolean)))
  };
}

function collectScriptText() {
  return Array.from(document.scripts)
    .map((s) => s.textContent || "")
    .join("\n");
}

function extractByRegex(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return String(m[1]).trim();
  }
  return "";
}

function extractHoursFromText(text, labelPatterns) {
  for (const lp of labelPatterns) {
    // Case A: label before number, e.g. "Main Story 29 hrs"
    const reA = new RegExp(`${lp}[^\\d]{0,30}(\\d+(?:\\.\\d+)?)`, "i");
    const mA = text.match(reA);
    if (mA && mA[1]) return String(mA[1]);
    // Case B: number before label, e.g. "29 hrs MAIN STORY" (can contain line breaks)
    const reB = new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*(?:h|hr|hrs|hour|hours)?(?:\\s|\\n|\\r|\\t){0,40}${lp}`,
      "i"
    );
    const mB = text.match(reB);
    if (mB && mB[1]) return String(mB[1]);
    // Case C: compact block style with explicit hrs token near both parts.
    const reC = new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*(?:h|hr|hrs|hour|hours)[\\s\\S]{0,40}${lp}`,
      "i"
    );
    const mC = text.match(reC);
    if (mC && mC[1]) return String(mC[1]);
  }
  return "";
}

function extractHoursByLineContext(text, labelPatterns) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";

  const labelRegexes = labelPatterns.map((p) => new RegExp(p, "i"));
  const numRe = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)?/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!labelRegexes.some((re) => re.test(line))) continue;

    const same = line.match(numRe);
    if (same && same[1]) return same[1];

    for (let back = 1; back <= 3; back += 1) {
      const prev = lines[i - back];
      if (!prev) continue;
      const m = prev.match(numRe);
      if (m && m[1]) return m[1];
    }
  }

  return "";
}

function extractHltbHoursFromDom() {
  const result = {
    mainStoryHours: "",
    storySidesHours: "",
    everythingHours: "",
    allStylesHours: ""
  };

  const sections = Array.from(document.querySelectorAll("section, div")).filter((el) => {
    const t = (el.textContent || "").toLowerCase();
    return t.includes("howlongtobeat") || t.includes("main story") || t.includes("story + sides") || t.includes("everything");
  });

  const combinedText = sections.map((el) => el.innerText || "").join("\n");
  result.mainStoryHours = firstNonEmpty(
    extractHoursByLineContext(combinedText, ["Main\\s*Story", "Main_Story"]),
    extractHoursFromText(combinedText, ["Main\\s*Story", "Main_Story"])
  );
  result.storySidesHours = firstNonEmpty(
    extractHoursByLineContext(combinedText, ["Story\\s*\\+\\s*Sides", "Story\\s*&\\s*Sides", "Story_Sides"]),
    extractHoursFromText(combinedText, ["Story\\s*\\+\\s*Sides", "Story\\s*&\\s*Sides", "Story_Sides"])
  );
  result.everythingHours = firstNonEmpty(
    extractHoursByLineContext(combinedText, ["Everything", "Completionist"]),
    extractHoursFromText(combinedText, ["Everything", "Completionist"])
  );
  result.allStylesHours = firstNonEmpty(
    extractHoursByLineContext(combinedText, ["All\\s*Styles", "All_Styles"]),
    extractHoursFromText(combinedText, ["All\\s*Styles", "All_Styles"])
  );

  return result;
}

function extractIgnGameDetails() {
  const scriptText = collectScriptText();
  const bodyText = document.body?.innerText || "";
  const jsonLd = extractFromJsonLd();

  const ignRating = firstNonEmpty(
    parseNumber(text("[data-cy='review-score']")),
    parseNumber(text("[class*='reviewScore']")),
    parseNumber(
      extractByRegex(scriptText, [
        /"score"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
        /"rating"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
        /"reviewScore"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i
      ])
    ),
    jsonLd.rating
  );

  const publishDate = firstNonEmpty(
    parseDateText(text("[data-cy='release-date']")),
    parseDateText(text("[data-cy='publish-date']")),
    parseDateText(extractByRegex(bodyText, [/Initial Release[^\\n:]*[:\\s]+([^\\n]+)/i])),
    parseDateText(
      extractByRegex(scriptText, [
        /"releaseDate"\s*:\s*"([^"]+)"/i,
        /"publishDate"\s*:\s*"([^"]+)"/i,
        /"datePublished"\s*:\s*"([^"]+)"/i
      ])
    ),
    jsonLd.publishDate,
    parseDateText(extractByRegex(bodyText, [/Publish Date[^\n:]*[:\s]+([^\n]+)/i]))
  );

  const releaseLineEntity = extractByRegex(bodyText, [/([^\n•]{2,120})\s*•\s*Initial Release/i]);

  const domPlatforms = Array.from(
    document.querySelectorAll("[data-cy='release-platforms'] a, a[href*='/platform/'], [data-cy='platforms'] a")
  )
    .map((el) => {
      const t = (el.textContent || "").trim();
      const aria = (el.getAttribute("aria-label") || "").trim();
      const title = (el.getAttribute("title") || "").trim();
      return t || aria || title;
    })
    .filter(Boolean);
  // Avoid broad body-text parsing here: it frequently captures author/editor names.
  const platforms = Array.from(new Set([...domPlatforms, ...jsonLd.platforms]));

  const hltbDom = extractHltbHoursFromDom();

  const mainStoryHours = firstNonEmpty(
    hltbDom.mainStoryHours,
    extractHoursFromText(bodyText, ["Main\\s*Story", "Main_Story"]),
    extractByRegex(scriptText, [/"mainStory"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i, /"main_story"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i])
  );
  const storySidesHours = firstNonEmpty(
    hltbDom.storySidesHours,
    extractHoursFromText(bodyText, ["Story\\s*\\+\\s*Sides", "Story\\s*&\\s*Sides", "Story_Sides"]),
    extractByRegex(scriptText, [/"mainExtra"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i, /"storySides"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i])
  );
  const everythingHours = firstNonEmpty(
    hltbDom.everythingHours,
    extractHoursFromText(bodyText, ["Everything", "Completionist"]),
    extractByRegex(scriptText, [/"completionist"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i, /"everything"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i])
  );
  const allStylesHours = firstNonEmpty(
    hltbDom.allStylesHours,
    extractHoursFromText(bodyText, ["All\\s*Styles", "All_Styles"]),
    extractByRegex(scriptText, [/"allStyles"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i, /"all_styles"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i])
  );

  return {
    ignRating,
    publishDate,
    platforms,
    developers: Array.from(new Set([...(jsonLd.developers || []), releaseLineEntity].filter(Boolean))),
    publishers: Array.from(new Set([...(jsonLd.publishers || []), releaseLineEntity].filter(Boolean))),
    mainStoryHours: parseNumber(mainStoryHours),
    storySidesHours: parseNumber(storySidesHours),
    everythingHours: parseNumber(everythingHours),
    allStylesHours: parseNumber(allStylesHours)
  };
}

function findDoubanInfoValue(labelText) {
  const infoEl = document.querySelector("#info");
  if (!infoEl) return "";

  // Prefer structured parsing from "span.pl" labels, which is more stable than line splitting.
  const labelNodes = Array.from(infoEl.querySelectorAll("span.pl"));
  const labelNode = labelNodes.find((node) => (node.textContent || "").replace(/[:：\s]/g, "").startsWith(labelText));
  if (labelNode) {
    let text = "";
    let sibling = labelNode.nextSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === "BR") break;
      text += sibling.textContent || "";
      sibling = sibling.nextSibling;
    }
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }

  // Fallback to text matching for pages with non-standard markup.
  const textContent = (infoEl.textContent || "").replace(/\u00a0/g, " ");
  const pattern = new RegExp(`${labelText}\\s*[:：]\\s*([^\\n]+)`);
  const match = textContent.match(pattern);
  return match ? match[1].trim() : "";
}

function findDoubanInfoAnchors(labelText) {
  const infoEl = document.querySelector("#info");
  if (!infoEl) return [];
  const labelNodes = Array.from(infoEl.querySelectorAll("span.pl"));
  const labelNode = labelNodes.find((node) => (node.textContent || "").replace(/[:：\s]/g, "").startsWith(labelText));
  if (!labelNode) return [];

  const items = [];
  let sibling = labelNode.nextSibling;
  while (sibling) {
    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === "BR") break;
    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === "A") {
      const text = (sibling.textContent || "").trim();
      if (text) items.push(text);
    }
    sibling = sibling.nextSibling;
  }
  return items;
}

function findTmdbFactValue(label) {
  const nodes = Array.from(document.querySelectorAll(".facts p"));
  for (const node of nodes) {
    const raw = (node.textContent || "").trim();
    if (!raw) continue;
    if (raw.toLowerCase().startsWith(label.toLowerCase())) {
      return raw
        .replace(new RegExp(`^${label}\\s*`, "i"), "")
        .replace(/^:/, "")
        .trim();
    }
  }
  return "";
}

function parseFirstNumber(textValue) {
  const m = String(textValue || "").match(/(\d+)/);
  return m ? m[1] : "";
}

function findTmdbFactValueAny(labels) {
  const nodes = Array.from(document.querySelectorAll(".facts p, .facts li, .facts .text"));
  for (const node of nodes) {
    const raw = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (!raw) continue;
    for (const label of labels) {
      const re = new RegExp(`^${label}\\s*:?\\s*`, "i");
      if (re.test(raw)) {
        return raw.replace(re, "").trim();
      }
    }
  }
  return "";
}

function parseTmdbRatingFromDom() {
  const percent = attr(".user_score_chart", "data-percent");
  if (percent) {
    const n = Number(percent);
    if (Number.isFinite(n)) return String(Math.round(n) / 10);
  }
  return firstNonEmpty(
    parseNumber(text(".user_score_chart .percent")),
    parseNumber(text(".user_score_text")),
    parseNumber(text(".rating"))
  );
}

function parseTmdbSeasonCountFromDom() {
  const seasonLinks = Array.from(document.querySelectorAll("a[href*='/season/']"));
  const seasons = seasonLinks
    .map((a) => parseFirstNumber(a.textContent || ""))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (seasons.length) return String(Math.max(...seasons));
  return "";
}

function parseTmdbEpisodeCountFromDom() {
  const counts = Array.from(document.querySelectorAll(".episode_count"))
    .map((el) => parseFirstNumber(el.textContent || ""))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (counts.length) return String(Math.max(...counts));
  return "";
}

function findTmdbLatestEpisodeCode() {
  const blocks = Array.from(document.querySelectorAll(".facts, .episode_group, .last_episode, .header")).map(
    (el) => el.textContent || ""
  );
  const text = `${blocks.join("\n")}\n${document.body?.innerText || ""}`;
  const m = text.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
  if (!m) return "";
  const season = String(Number(m[1])).padStart(2, "0");
  const episode = String(Number(m[2])).padStart(2, "0");
  return `S${season}E${episode}`;
}

function normalizeTmdbStatus(rawStatus) {
  const s = String(rawStatus || "").toLowerCase();
  if (!s) return "";
  if (s.includes("returning") || s.includes("ongoing") || s.includes("回归") || s.includes("连载")) {
    return "Returning";
  }
  if (s.includes("ended") || s.includes("cancelled") || s.includes("canceled") || s.includes("完结")) {
    return "Ended";
  }
  return rawStatus;
}

function getTmdbTvIdFromPath() {
  const m = location.pathname.match(/\/tv\/(\d+)/);
  return m ? m[1] : "";
}

function getTmdbTvSeriesJsonLd() {
  const items = getJsonLdCandidates();
  return items.find((item) => String(item?.["@type"] || "").toLowerCase() === "tvseries") || null;
}

function parseTmdbLastSeasonInfo() {
  const panel =
    document.querySelector("section.panel.season") ||
    document.querySelector("section.panel.last_season") ||
    document.querySelector(".last_season");
  if (!panel) return { latestEpisodeCode: "", seasonCount: "", lastSeasonEpisodes: "" };

  const seasonText = panel.querySelector("h2")?.textContent || "";
  const seasonNum = parseFirstNumber(seasonText);
  const h4Text = panel.querySelector("h4")?.textContent || "";
  const lastSeasonEpisodes = parseFirstNumber(h4Text);

  const dateLine = panel.querySelector(".date")?.textContent || "";
  const m = dateLine.match(/(\d+)\s*x\s*(\d+)/i);
  let latestEpisodeCode = "";
  if (m && m[1] && m[2]) {
    latestEpisodeCode = `S${String(Number(m[1])).padStart(2, "0")}E${String(Number(m[2])).padStart(2, "0")}`;
  }

  return {
    latestEpisodeCode,
    seasonCount: seasonNum,
    lastSeasonEpisodes
  };
}

function parseTmdbStatusFromFacts() {
  const ps = Array.from(document.querySelectorAll(".facts p, p"));
  for (const p of ps) {
    const label = p.querySelector("strong bdi")?.textContent?.trim() || p.querySelector("strong")?.textContent?.trim() || "";
    if (!label) continue;
    if (!/status/i.test(label)) continue;
    const raw = (p.textContent || "").replace(label, "").replace(/^[:\s]+/, "").trim();
    if (raw) return normalizeTmdbStatus(raw);
  }
  return "";
}

function parseTmdbCountryFromJsonLd(tvLd) {
  if (!tvLd) return [];
  const raw = tvLd.countryOfOrigin;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((c) => (typeof c === "string" ? c : c?.name || ""))
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function parseTmdbCountryFromFacts() {
  const val = firstNonEmpty(
    findTmdbFactValueAny(["Original Country", "Country", "国家", "地区"]),
    text(".facts .country")
  );
  if (!val) return [];
  return val
    .split(/[，,\/|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeDoubanImage(url) {
  if (!url) return "";
  try {
    const u = new URL(url, location.href);
    const host = u.hostname;
    if (host.includes("doubanio.com") || host.includes("douban.com")) {
      u.hostname = "img9.doubanio.com";
      u.pathname = u.pathname.replace(/\/([sl])_ratio_poster\/public\//, "/l_ratio_poster/public/");
      return u.toString();
    }
    return u.toString();
  } catch {
    return url;
  }
}

function parseDoubanMovie() {
  const titleRaw = text("#content h1 span[property='v:itemreviewed']") || text("#content h1 span");
  const yearRaw = text("#content h1 .year").replace(/[()]/g, "");
  const rating = text("strong[property='v:average']");
  const genres = Array.from(document.querySelectorAll("span[property='v:genre']")).map((el) => el.textContent.trim());
  const summary = text("span[property='v:summary']") || text("#link-report-intra span.all.hidden") || text("#link-report span[property='v:summary']");
  const cover = document.querySelector("#mainpic img")?.getAttribute("src") || "";
  const directors = Array.from(document.querySelectorAll("a[rel='v:directedBy']")).map((el) => el.textContent.trim());
  const duration = parseMinutes(text("span[property='v:runtime']"));
  const releaseDate = text("span[property='v:initialReleaseDate']");
  const country = findDoubanInfoValue("制片国家/地区");

  const metadata = {
    supported: true,
    source: "douban",
    type: "movie",
    id: location.pathname.split("/").filter(Boolean)[1] || "",
    title: titleRaw,
    originalTitle: "",
    year: yearRaw,
    rating,
    genres,
    summary,
    coverUrl: normalizeDoubanImage(cover),
    sourceUrl: location.href,
    creators: directors,
    duration,
    releaseDate,
    country,
    tags: genres
  };
  return {
    ...metadata,
    debug: {
      rawSignals: collectRawSignals()
    }
  };
}

function parseDoubanBook() {
  const titleRaw = text("#wrapper h1 span") || text("#content h1 span");
  const rating = text("strong[property='v:average']");
  const summary = text("#link-report .intro") || text("#link-report span.all.hidden");
  const cover = document.querySelector("#mainpic img")?.getAttribute("src") || "";
  const authorFromLabel = findDoubanInfoAnchors("作者");
  const author =
    authorFromLabel.length > 0
      ? authorFromLabel
      : findDoubanInfoValue("作者")
          .split(/[\\/／]/)
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, 6);
  const publisher = findDoubanInfoValue("出版社");
  const publishDate = findDoubanInfoValue("出版年");
  const isbn = findDoubanInfoValue("ISBN");
  const pageCount = findDoubanInfoValue("页数");

  const metadata = {
    supported: true,
    source: "douban",
    type: "book",
    id: location.pathname.split("/").filter(Boolean)[1] || "",
    title: titleRaw,
    originalTitle: "",
    year: "",
    rating,
    genres: [],
    summary,
    coverUrl: normalizeDoubanImage(cover),
    sourceUrl: location.href,
    creators: author,
    publisher,
    publishDate,
    isbn,
    pageCount,
    tags: []
  };
  return {
    ...metadata,
    debug: {
      rawSignals: collectRawSignals()
    }
  };
}

function parseTmdbTv() {
  const tvLd = getTmdbTvSeriesJsonLd();
  const titleRaw = firstNonEmpty(tvLd?.name, text("h2 a"), text("h2"), text(".title a"), attr("meta[property='og:title']", "content"));
  const yearMatch = firstNonEmpty(parseDateText(tvLd?.startDate || ""), text(".release_date"), text("span.release_date")).match(/\d{4}/);
  const rating = firstNonEmpty(parseTmdbRatingFromDom(), parseNumber(tvLd?.aggregateRating?.ratingValue || ""));
  const genres = Array.from(document.querySelectorAll("span.genres a")).map((el) => el.textContent.trim());
  const summary = text(".overview p") || text(".overview");
  const cover = document.querySelector(".poster_wrapper img")?.getAttribute("src") || tvLd?.image || "";
  const creators = Array.from(document.querySelectorAll("ol.people li p a")).map((el) => el.textContent.trim());
  const lastSeasonInfo = parseTmdbLastSeasonInfo();
  const firstAirDate = firstNonEmpty(
    parseDateText(tvLd?.startDate || ""),
    text(".facts .release"),
    text("span.release_date"),
    findTmdbFactValueAny(["First Air Date", "首播日期", "首播"])
  );
  const seasonCount = parseFirstNumber(
    firstNonEmpty(
      String(tvLd?.numberOfSeasons || ""),
      lastSeasonInfo.seasonCount,
      parseTmdbSeasonCountFromDom(),
      findTmdbFactValueAny(["Seasons", "季数"]),
      extractByRegex(document.body?.innerText || "", [/(\d+)\s*Seasons?/i, /共\s*(\d+)\s*季/i])
    )
  );
  const episodeCount = parseFirstNumber(
    firstNonEmpty(
      String(tvLd?.numberOfEpisodes || ""),
      parseTmdbEpisodeCountFromDom(),
      lastSeasonInfo.lastSeasonEpisodes,
      findTmdbFactValueAny(["Episodes", "集数"]),
      extractByRegex(document.body?.innerText || "", [/(\d+)\s*Episodes?/i, /共\s*(\d+)\s*集/i])
    )
  );
  const status = firstNonEmpty(parseTmdbStatusFromFacts(), normalizeTmdbStatus(findTmdbFactValueAny(["Status", "状态"])));
  const latestEpisodeCode = firstNonEmpty(lastSeasonInfo.latestEpisodeCode, findTmdbLatestEpisodeCode());
  const country = Array.from(new Set([...parseTmdbCountryFromJsonLd(tvLd), ...parseTmdbCountryFromFacts()]));
  const tmdbId = getTmdbTvIdFromPath();

  const metadata = {
    supported: true,
    source: "tmdb",
    type: "tv",
    id: tmdbId || location.pathname.split("/").filter(Boolean)[1] || "",
    tmdbId,
    title: titleRaw,
    originalTitle: "",
    year: yearMatch ? yearMatch[0] : "",
    rating: (rating || "").replace("%", ""),
    genres,
    summary,
    coverUrl: absoluteUrl(cover),
    sourceUrl: location.href,
    country,
    creators,
    firstAirDate,
    latestEpisodeCode,
    seasonCount,
    episodeCount,
    status,
    tags: genres
  };
  return {
    ...metadata,
    debug: {
      rawSignals: collectRawSignals()
    }
  };
}

function parseIgnGame() {
  const titleRaw = text("h1") || document.title.replace(/\s*-\s*IGN.*$/, "");
  const summary = attr("meta[name='description']", "content") || "";
  const cover = attr("meta[property='og:image']", "content") || "";
  const genres = Array.from(document.querySelectorAll("a[href*='/games/'] span, a[href*='/wiki/'] span"))
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .slice(0, 8);
  const details = extractIgnGameDetails();
  const platforms = details.platforms.slice(0, 12);
  const publishDate = details.publishDate;
  const releaseDate = publishDate || text("[data-cy='release-date']") || "";

  const metadata = {
    supported: true,
    source: "ign",
    type: "game",
    id: location.pathname.split("/").filter(Boolean).join("-"),
    title: titleRaw,
    originalTitle: "",
    year: "",
    rating: details.ignRating || "",
    ignRating: details.ignRating || "",
    genres,
    summary,
    coverUrl: absoluteUrl(cover),
    sourceUrl: location.href,
    developers: details.developers || [],
    publishers: details.publishers || [],
    platforms,
    publishDate,
    mainStoryHours: details.mainStoryHours || "",
    storySidesHours: details.storySidesHours || "",
    everythingHours: details.everythingHours || "",
    allStylesHours: details.allStylesHours || "",
    releaseDate,
    creators: [],
    tags: genres
  };
  return {
    ...metadata,
    debug: {
      rawSignals: collectRawSignals()
    }
  };
}

function parseCurrentPage() {
  const host = location.hostname;
  const path = location.pathname;

  if (host === "movie.douban.com" && path.startsWith("/subject/")) return parseDoubanMovie();
  if (host === "book.douban.com" && path.startsWith("/subject/")) return parseDoubanBook();
  if ((host === "www.themoviedb.org" || host === "themoviedb.org") && path.startsWith("/tv/")) return parseTmdbTv();
  if (host === "www.ign.com") return parseIgnGame();

  return { supported: false };
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
    reader.readAsDataURL(blob);
  });
}

async function downloadImageAsDataUrl(url) {
  const resp = await fetch(url, {
    method: "GET",
    credentials: "omit",
    referrer: location.href,
    referrerPolicy: "strict-origin-when-cross-origin"
  });
  if (!resp.ok) {
    throw new Error(`download failed: ${resp.status}`);
  }
  const blob = await resp.blob();
  return blobToDataUrl(blob);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_METADATA") {
    sendResponse(parseCurrentPage());
    return;
  }

  if (message.type === "DOWNLOAD_IMAGE_AS_DATA_URL") {
    downloadImageAsDataUrl(message.url || "")
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((error) => sendResponse({ ok: false, reason: error.message }));
    return true;
  }

  if (message.type === "GET_COVER_IMAGE_RECT") {
    const img = document.querySelector("#mainpic img");
    if (!img) {
      sendResponse({ ok: false, reason: "cover image not found" });
      return;
    }
    const rect = img.getBoundingClientRect();
    sendResponse({
      ok: true,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      devicePixelRatio: window.devicePixelRatio || 1
    });
    return;
  }
});
