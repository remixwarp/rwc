# 扩展实验广场 - 审核人员操作指南

## 概述

扩展实验广场（Experiment Plaza）允许用户上传和分享社区扩展。所有上传的扩展默认带有 **"未知危险"** 红色标签，表示该扩展未经 RemixWarp 官方团队审核。

审核人员通过修改 RWC 仓库中对应扩展的 `meta.json` 文件，将 `reviewStatus` 字段从 `"unreviewed"` 改为 `"approved"`，即可将标签更换为 **"经审核之后可以安全使用"** 绿色标签。

## 审核流程

### 1. 定位扩展文件

扩展数据存储在 RWC 仓库的 `extensions/` 目录下，每个扩展对应一个子目录，结构如下：

```
extensions/
  ext_xxxxx/          ← 扩展 ID（随机生成）
    extension.js      ← 扩展 JS 文件
    icon.png          ← 扩展封面图片
    meta.json         ← 扩展元数据（审核人员需要修改的文件）
```

### 2. 查看扩展元数据

打开 `extensions/ext_xxxxx/meta.json`，内容类似：

```json
{
  "name": "扩展名称",
  "author": "作者名称",
  "description": "扩展描述",
  "extensionId": "ext_xxxxx",
  "extensionFile": "extension.js",
  "iconFile": "icon.png",
  "docsURI": "https://...",
  "sampleProject": "https://...",
  "reviewStatus": "unreviewed",
  "uploadDate": "2026-08-17T12:00:00.000Z"
}
```

### 3. 审核检查清单

在批准扩展之前，请检查以下内容：

- [ ] **扩展名称**：是否清晰、无歧义，不包含恶意或误导性内容
- [ ] **作者信息**：是否真实可查，联系方式是否有效
- [ ] **扩展描述**：是否准确描述了扩展的功能，不包含虚假或夸大宣传
- [ ] **JS 文件**：代码是否安全，无恶意行为（如窃取数据、破坏编辑器功能等）
- [ ] **封面图片**：内容是否合规，不包含敏感或不当内容
- [ ] **文档链接**：链接是否有效，文档内容是否完整
- [ ] **示例作品**：链接是否有效，示例是否能正常展示扩展功能

### 4. 更换标签（将"未知危险"改为"经审核之后可以安全使用"）

通过 GitHub 网页端或 Git 命令行修改 `meta.json` 文件：

#### 通过 GitHub 网页端操作

1. 打开 [RWC 仓库](https://github.com/remixwarp/rwc)
2. 导航到 `extensions/ext_xxxxx/meta.json`
3. 点击右上角的 ✏️（编辑）按钮
4. 将 `"reviewStatus": "unreviewed"` 修改为 `"reviewStatus": "approved"`
5. 在页面底部填写提交信息，例如：
   ```
   Review extension: 扩展名称
   ```
6. 点击 **"Commit changes"** 提交修改

#### 通过 Git 命令行操作

```bash
# 克隆仓库
git clone https://github.com/remixwarp/rwc.git
cd rwc

# 修改 meta.json 文件
# 将 reviewStatus 从 "unreviewed" 改为 "approved"

# 提交并推送
git add extensions/ext_xxxxx/meta.json
git commit -m "Review extension: 扩展名称"
git push
```

### 5. 验证标签变更

修改提交后，扩展实验广场页面会自动刷新并显示更新后的标签：

- 审核通过前：红色 **"未知危险"** 标签
- 审核通过后：绿色 **"经审核之后可以安全使用"** 标签

## 注意事项

1. **审核标准**：请确保扩展代码安全、功能合理、内容合规，不包含恶意代码、隐私窃取、破坏编辑器等功能
2. **标签不可逆**：请谨慎审核，确认无误后再修改 `reviewStatus`
3. **审核记录**：建议在提交信息中注明审核人，便于追溯
4. **问题处理**：如发现违规扩展，请将 `reviewStatus` 保持为 `"unreviewed"` 并通知 RemixWarp 团队处理
5. **批量审核**：如需批量审核多个扩展，可逐个修改每个扩展的 `meta.json` 文件

## 扩展的元数据字段说明

| 字段 | 说明 | 审核时可修改 |
|------|------|-------------|
| `name` | 扩展名称 | 否（请联系作者修正） |
| `author` | 作者名称 | 否（请联系作者修正） |
| `description` | 扩展描述 | 否（请联系作者修正） |
| `extensionId` | 扩展唯一标识 | 否 |
| `extensionFile` | JS 文件名 | 否 |
| `iconFile` | 封面图片文件名 | 否 |
| `docsURI` | 文档链接 | 否 |
| `sampleProject` | 示例作品链接 | 否 |
| `reviewStatus` | 审核状态（`unreviewed` / `approved`） | **是** |
| `uploadDate` | 上传时间 | 否 |

## 遇到问题？

如有疑问，请联系 RemixWarp 团队。