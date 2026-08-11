# rwc - 配置广场

配置广场的 GitHub 仓库，用于存储和分享 RemixWarp 编辑器配置。

## 仓库结构

```
remixwarp/rwc/
├── configs/
│   ├── c_172xxx_abcd/
│   │   ├── meta.json          # 配置元数据
│   │   └── 配置名称.rwc       # 配置压缩包
│   ├── c_172yyy_efgh/
│   │   ├── meta.json
│   │   └── 配置名称.rwc
│   └── ...
├── index.html                  # 配置广场主页面
├── styles.css                  # 样式
├── app.js                      # 核心逻辑
└── editor-bridge.js            # 编辑器通信
```

## meta.json 格式

```json
{
    "name": "配置名称",
    "author": "作者昵称",
    "description": "配置描述",
    "theme": {
        "gui": "light",
        "accent": {
            "name": "Pale Blue",
            "color": "#4f46e5"
        }
    },
    "isDark": false,
    "uploadDate": "2026-08-11T12:00:00.000Z",
    "id": "c_172xxx_abcd"
}
```

## .rwc 文件格式

`.rwc` 文件是 ZIP 压缩包，包含：
- `settings.json` - 完整的编辑器设置（插件设置、localStorage、书签等）
- `version.json` - 版本信息

## 部署

配置广场网站部署在 https://rw-c.pages.dev/
