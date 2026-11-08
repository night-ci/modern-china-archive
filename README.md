# 中国近现代史史料图谱

我收集国家机构公开的历史资料，按时间和地点整理中国近现代史（1840—2021）。每条事件有叙述、元数据、原文摘录和来源链接。叙述只写来源里的事实，不加入我的判断和评价。

线上地址：https://night-ci.github.io/modern-china-archive/

## 当前状态

- M0 样稿：10 条跨时期史料，覆盖 1840—1978。
- 每条都有来源范围内的叙述、原文摘录与原文链接；叙述与原文明确区分。
- 每条至少一个中央国家机构、国家馆藏或国家媒体来源。
- 已实现：编年、地图、事件页、来源页、机构页、编纂说明、引用复制、站内检索。
- 下一阶段：100 条内部测试 → 1000 条以上公开。

## 本地开发

无需安装依赖，使用 Node.js 内置模块。

```powershell
npm run build
npm run serve
# http://localhost:5173
```

`build.mjs` 生成 `dist/`；`scripts/validate.mjs` 校验来源机构、域名、引文与事件字段。

## 内容结构

- `content/events/*.json`：事件、元数据、逐条引文。
- `content/sources.json`：来源标题、机构、日期、URL、引用信息。
- `content/institutions.json`：机构与域名白名单。
- `docs/editorial-policy.md`：编纂说明。
- `docs/source-whitelist.md`：来源白名单。

新增事件时：

1. 在 `content/sources.json` 登记来源，确保机构已在 `institutions.json` 中且 URL 属于该机构域名。
2. 在 `content/events/` 新增 JSON，包含 `overview`（叙述）与 `overview_sources`，引文使用 `source_id` 指向来源。
3. 叙述中的事实性陈述必须能在来源中找到依据；关键数字、日期、地名、人物与原文一致；叙述只作描述，不写作者判断、意义总结或价值评价。
4. 运行 `npm run build`，校验通过后提交。

## 地图

地图使用天地图 WMTS 底图，Key 在 `assets/map.js` 中。浏览器端 Key 需要在天地图控制台配置域名白名单：

- `night-ci.github.io`（线上）
- `localhost`、`127.0.0.1`（本地预览）

未加入白名单时，底图瓦片会返回 403，页面其余部分不受影响。

## 部署

推送到 `main` 后，GitHub Actions 自动构建 `dist/` 并部署到 GitHub Pages。工作流见 `.github/workflows/pages.yml`。

## 版权

原文版权归原机构所有。我只摘录并给出链接；政府文件可保存快照，媒体与图书不整篇镜像。
