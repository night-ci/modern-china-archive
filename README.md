# 中国近现代史史料图谱

中国近现代史史料图谱，1840—2021。党史大事记、国史编年、前编、详解、地图。

本地开发中。线上旧版（暂停更新）：https://night-ci.github.io/modern-china-archive/

## 当前状态

- 10 条详解：有叙述、元数据、原文摘录和来源链接，覆盖 1840—1978。
- 1012 条党史大事记：据《中国共产党一百年大事记（1921年7月—2021年6月）》整理，覆盖 1919—2021。
- 733 条国史编年：据《中华人民共和国大事记（1949年10月—2019年9月）》整理。
- 23 条前编：补 1841—1918 年的关键事件。
- 编年共 1251 条（党史、国史去重后）；地图显示 787 条有地点匹配的条目。
- 13 个来源，每条至少一个中央国家机构、国家馆藏或国家媒体来源。
- 已实现：全量编年、大事记、全量地图、事件页、数据来源说明、引用复制、站内检索。
- 下一阶段：把大事记中的重点条目逐条升级为详解，目标 1000 条以上详解。
- 这不是“所有历史”：两部大事记只收全国性重点事件；地方史、专题史、人物、文献和图片还在补。
- 红色专题：`/red-topics.html`；长征路线图：`/long-march.html`。
- 进度与批次见 `docs/roadmap.md`。

## 本地开发

无需安装依赖，使用 Node.js 内置模块。

```powershell
npm run build
npm run serve
# http://localhost:5173
```

`build.mjs` 生成 `dist/`；`scripts/validate.mjs` 校验来源机构、域名、引文、事件和大事记字段。

重新生成大事记：

```powershell
node scripts/build-chronology.mjs
```

源文件在 `content/raw/ds100-raw.html`。

## 内容结构

- `content/events/*.json`：详解事件、元数据、逐条引文。
- `static/long-march/`：长征路线图专题静态文件。
- `content/chronology.json`：1012 条大事记。
- `scripts/build-chronology.mjs`：从大事记原文生成大事记。
- `docs/roadmap.md`：内容扩充计划与进度。
- `content/sources.json`：来源标题、机构、日期、URL、引用信息。
- `content/institutions.json`：机构与域名白名单。
- `docs/source-whitelist.md`：来源白名单。

新增事件时：

1. 在 `content/sources.json` 登记来源，确保机构已在 `institutions.json` 中且 URL 属于该机构域名。
2. 在 `content/events/` 新增 JSON，包含 `overview`（叙述）与 `overview_sources`，引文使用 `source_id` 指向来源。
3. 叙述中的事实性陈述必须能在来源中找到依据；关键数字、日期、地名、人物与原文一致；叙述只作描述，不写作者判断、意义总结或价值评价。
4. 运行 `npm run build` 检查。确认后再决定是否提交。

## 地图

地图使用天地图 WMTS 底图，Key 在 `assets/map.js` 中。浏览器端 Key 需要在天地图控制台配置域名白名单：

- `night-ci.github.io`

未加入白名单时，底图瓦片会返回 403，页面其余部分不受影响。

## 部署

目前只在本地开发，不推送、不部署。确认后再恢复 GitHub Actions。工作流见 `.github/workflows/pages.yml`。

## 版权

原文版权归原机构所有；政府文件可保存快照，媒体与图书不整篇镜像。
