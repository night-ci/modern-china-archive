# 中国近现代史史料图谱

线上地址：https://night-ci.github.io/modern-china-archive/  
仓库地址：https://github.com/night-ci/modern-china-archive

## 项目简介

本站汇集国家机构公开的中国近现代史编年资料，时间范围为 1840—2021 年。内容按时间、地点和来源组织，提供编年检索、地图定位、原文摘录与原文链接。

## 内容规模

- **1012 条党史大事记**：据《中国共产党一百年大事记（1921年7月—2021年6月）》整理。
- **733 条国史编年**：据《中华人民共和国大事记（1949年10月—2019年9月）》整理。
- **23 条前编**：补 1841—1918 年的关键事件。
- **10 条详解页面**：保留在编年条目中，通过“详解”进入；首页不再单列。
- 党史、国史去重后，**编年共 1251 条**。
- 地图可定位 **786 条**，邻近地点合并显示。
- **13 个来源、7 家机构**，每条内容标注来源与原文链接。

## 页面与功能

- `/`：首页、统计、地图入口、红色专题、来源机构。
- `/timeline.html`：全量编年，支持关键词、时期和年份检索。
- `/chronology.html`：党史大事记，1012 条。
- `/prc-chronology.html`：国史编年，733 条。
- `/map.html`：全量地点地图，按时期筛选，点击地点查看条目。
- `/red-topics.html`：红色专题入口。
- `/long-march.html`：长征路线图全屏专题。
- `/data-sources.html`：数据来源说明，先列机构，再进入机构查看引用文章。
- `/sources.html`：具体来源条目与引用信息。
- 支持引用复制、数据下载、sitemap、robots 和移动端适配。

## 目录结构

- `content/events/*.json`：详解事件、元数据与逐条引文。
- `content/chronology.json`：1012 条党史大事记。
- `content/chronology-prc.json`：733 条国史编年。
- `content/pre1921.json`：23 条前编。
- `content/places.json`：地图地点与坐标。
- `content/sources.json`：来源标题、机构、日期、URL 与引用信息。
- `content/institutions.json`：来源机构与域名白名单。
- `content/raw/`：大事记原文快照。
- `static/long-march/`：长征路线图专题静态文件。
- `assets/`：样式、地图、检索与页面脚本。
- `scripts/build-chronology.mjs`：从大事记原文生成党史大事记。
- `scripts/validate.mjs`：校验来源、域名、引文、事件和大事记字段。
- `docs/roadmap.md`：内容扩充计划与进度。
- `docs/source-whitelist.md`：来源白名单。

## 本地开发

无需安装第三方依赖，使用 Node.js 内置模块。

```powershell
npm run build
npm run serve
# http://localhost:5173
```

重新生成党史大事记：

```powershell
node scripts/build-chronology.mjs
```

## 部署

推送到 `main` 后，GitHub Actions 自动构建 `dist/` 并部署到 GitHub Pages。工作流见 `.github/workflows/pages.yml`。

当前线上版本：

https://night-ci.github.io/modern-china-archive/

## 来源与边界

资料来源限于国家机构、国家馆藏、国家媒体和国家科研机构，具体名单见 `docs/source-whitelist.md`。原文版权归原机构所有；政府文件可保存快照，媒体与图书不整篇镜像。

这不是“所有历史”。两部大事记只收全国性重点事件；地方史、专题史、人物、文献和图片仍在补充，进度见 `docs/roadmap.md`。
