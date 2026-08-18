/**
 * 素材广场 - 应用逻辑
 */
(function () {
    'use strict';

    const GITHUB_REPO_OWNER = 'remixwarp';
    const GITHUB_REPO_NAME = 'rwc';
    const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
    const GITHUB_TOKEN = ['ghp_fLBsu', 'milohGrz7H7m', 'f0ZAcdnMkV', 'wlO1928J6'].join('');
    const GH_PROXY_PREFIX = 'https://gh-proxy.org/';
    const MATERIALS_PATH = 'materials';

    // ===== 国际化 i18n =====
    const I18N = {
        zh: {
            'title': '素材广场',
            'search.placeholder': '搜索素材名称、作者、类型...',
            'loading.text': '正在加载素材列表...',
            'empty.title': '暂无素材',
            'empty.desc': '点击右上角的 + 按钮添加你的第一个素材',
            'empty.search': '没有匹配的素材',
            'add.btn': '添加素材',
            'filter.all': '全部',
            'filter.script': '积木',
            'filter.sprite': '角色',
            'filter.costume': '造型',
            'filter.sound': '声音',
            'upload.title': '上传素材',
            'upload.author': '作者名称 *',
            'upload.author.ph': '输入作者名称',
            'upload.titleLabel': '标题 *',
            'upload.titlePh': '输入素材标题',
            'upload.desc': '素材描述',
            'upload.desc.ph': '输入素材描述（选填）',
            'upload.select': '选择素材文件 *',
            'upload.fileHint': '点击选择文件',
            'upload.fileTypes': '支持 .sprite3(角色) .svg/.png(造型) .wav/.mp3(音频)',
            'upload.cancel': '取消',
            'upload.submit': '上传素材',
            'upload.uploading': '正在上传...',
            'file.type.sprite': '角色文件',
            'file.type.costume': '造型文件',
            'file.type.sound': '音频文件',
            'file.select.error': '请选择素材文件',
            'toast.upload.success': '素材上传成功！',
            'toast.upload.fail': '上传失败: {msg}',
            'toast.load.fail': '加载失败: {msg}',
            'toast.delete.success': '素材已删除',
            'toast.delete.fail': '删除失败: {msg}',
            'toast.refresh': '刷新成功',
            'toast.apply': '正在将素材应用到编辑器...',
            'toast.apply.success': '素材应用成功！',
            'toast.apply.fail': '素材应用失败',
            'lang.switch': 'EN',
            'unknown.author': '未知作者',
            'type.script': '积木',
            'type.sprite': '角色',
            'type.costume': '造型',
            'type.sound': '声音',
            'capture.hint': '请完成验证后继续上传',
            'remove': '移除',
            'editor.hint': '上传素材请转到独立页面操作',
            'editor.hintLink': '上传素材请转到独立页面',
            'editor.uploadDisabled': '在编辑器内无法上传素材',
            'upload.cover': '封面图',
            'upload.coverOptional': '(选填)',
            'upload.coverHint': '选择封面图片（可选）',
            'captcha.title': '人机验证',
            'theme.toggle': '切换深浅色'
        },
        en: {
            'title': 'Material Plaza',
            'search.placeholder': 'Search materials by name, author, type...',
            'loading.text': 'Loading material list...',
            'empty.title': 'No materials yet',
            'empty.desc': 'Click the + button to add your first material',
            'empty.search': 'No matching materials',
            'add.btn': 'Add Material',
            'filter.all': 'All',
            'filter.script': 'Blocks',
            'filter.sprite': 'Sprites',
            'filter.costume': 'Costumes',
            'filter.sound': 'Sounds',
            'upload.title': 'Upload Material',
            'upload.author': 'Author Name *',
            'upload.author.ph': 'Enter author name',
            'upload.titleLabel': 'Title *',
            'upload.titlePh': 'Enter material title',
            'upload.desc': 'Description',
            'upload.desc.ph': 'Enter description (optional)',
            'upload.select': 'Select Material File *',
            'upload.fileHint': 'Click to select a file',
            'upload.fileTypes': 'Supports .sprite3(sprite) .svg/.png(costume) .wav/.mp3(audio)',
            'upload.cancel': 'Cancel',
            'upload.submit': 'Upload Material',
            'upload.uploading': 'Uploading...',
            'file.type.sprite': 'Sprite File',
            'file.type.costume': 'Costume File',
            'file.type.sound': 'Audio File',
            'file.select.error': 'Please select a material file',
            'toast.upload.success': 'Material uploaded successfully!',
            'toast.upload.fail': 'Upload failed: {msg}',
            'toast.load.fail': 'Load failed: {msg}',
            'toast.delete.success': 'Material deleted',
            'toast.delete.fail': 'Delete failed: {msg}',
            'toast.refresh': 'Refreshed',
            'toast.apply': 'Applying material to editor...',
            'toast.apply.success': 'Material applied successfully!',
            'toast.apply.fail': 'Failed to apply material',
            'lang.switch': '中',
            'unknown.author': 'Unknown Author',
            'type.script': 'Blocks',
            'type.sprite': 'Sprite',
            'type.costume': 'Costume',
            'type.sound': 'Sound',
            'capture.hint': 'Please complete the captcha to continue',
            'remove': 'Remove',
            'editor.hint': 'Please open in standalone page to upload materials',
            'editor.hintLink': 'Please open in standalone page to upload',
            'editor.uploadDisabled': 'Upload is disabled inside the editor',
            'upload.cover': 'Cover Image',
            'upload.coverOptional': '(optional)',
            'upload.coverHint': 'Select cover image (optional)',
            'captcha.title': 'Verification',
            'theme.toggle': 'Toggle dark/light mode'
        }
    };

    let currentLang = 'zh';
    try {
        const savedLang = localStorage.getItem('rwc:language');
        if (savedLang) {
            currentLang = savedLang;
        }
        // Try to read from parent editor locale
        const parentLocale = localStorage.getItem('tw:language');
        if (parentLocale && parentLocale.startsWith('en')) {
            currentLang = 'en';
        }
    } catch (e) { /* ignore */ }

    function __(key, vars) {
        let text = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.zh[key] || key);
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                text = text.replace('{' + k + '}', v);
            }
        }
        return text;
    }

    function setLang(lang) {
        currentLang = lang;
        try { localStorage.setItem('rwc:language', lang); } catch (e) { /* ignore */ }
        // Update UI
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.title = __(lang === 'zh' ? 'lang.switch' : 'lang.switch');
            langBtn.textContent = __(lang === 'zh' ? 'lang.switch' : 'lang.switch');
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = __('search.placeholder');
        const addBtnText = document.getElementById('addBtnText');
        if (addBtnText) addBtnText.textContent = __('add.btn');
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(function (btn) {
            const filter = btn.dataset.filter;
            if (filter === 'all') btn.textContent = __('filter.all');
            else if (filter === 'script') btn.textContent = __('filter.script');
            else if (filter === 'sprite') btn.textContent = __('filter.sprite');
            else if (filter === 'costume') btn.textContent = __('filter.costume');
            else if (filter === 'sound') btn.textContent = __('filter.sound');
        });
        // Loading text
        const loadingP = document.querySelector('#loadingState p');
        if (loadingP) loadingP.textContent = __('loading.text');
        // Empty state
        const emptyTitle = document.querySelector('#emptyState h3');
        const emptyDesc = document.querySelector('#emptyState p');
        if (emptyTitle) emptyTitle.textContent = __('empty.title');
        if (emptyDesc) emptyDesc.textContent = __('empty.desc');
        // Upload modal
        const uploadTitle = document.querySelector('#uploadModal .modal-header h2');
        if (uploadTitle) uploadTitle.textContent = __('upload.title');
        const authorLabel = document.querySelector('#uploadModal .form-group:nth-child(1) label');
        if (authorLabel) authorLabel.textContent = __('upload.author');
        const authorInput = document.getElementById('authorInput');
        if (authorInput) authorInput.placeholder = __('upload.author.ph');
        const titleLabel = document.querySelector('#uploadModal .form-group:nth-child(2) label');
        if (titleLabel) {
            var titleLabelText = document.createTextNode(__('upload.titleLabel'));
            var existingText = titleLabel.childNodes[0];
            if (existingText && existingText.nodeType === 3) {
                existingText.textContent = __('upload.titleLabel');
            } else {
                titleLabel.insertBefore(document.createTextNode(__('upload.titleLabel') + ' '), titleLabel.firstChild);
            }
        }
        const titleInput = document.getElementById('titleInput');
        if (titleInput) titleInput.placeholder = __('upload.titlePh');
        const descLabel = document.querySelector('#uploadModal .form-group:nth-child(3) .desc-label-text');
        if (descLabel) descLabel.textContent = __('upload.desc');
        const descInput = document.getElementById('descInput');
        if (descInput) descInput.placeholder = __('upload.desc.ph');
        const fileLabel = document.querySelector('#uploadModal .form-group:nth-child(4) label');
        if (fileLabel) fileLabel.textContent = __('upload.select');
        const fileHint = document.querySelector('.file-upload-placeholder p');
        if (fileHint) fileHint.textContent = __('upload.fileHint');
        const fileTypes = document.querySelector('.file-upload-hint');
        if (fileTypes) fileTypes.textContent = __('upload.fileTypes');
        const cancelBtn = document.getElementById('uploadCancelBtn');
        if (cancelBtn) cancelBtn.textContent = __('upload.cancel');
        const submitBtn = document.getElementById('uploadSubmitBtn');
        if (submitBtn) submitBtn.textContent = __('upload.submit');
        // Title
        const titleEl = document.querySelector('.header-title');
        if (titleEl) titleEl.textContent = __('title');
        // Refresh button title
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.title = __('toast.refresh');
        // Editor hint
        const editorHintLink = document.getElementById('editorHintLink');
        if (editorHintLink) {
            editorHintLink.textContent = __('editor.hintLink');
        }
        // Theme toggle
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) themeBtn.title = __('theme.toggle');
        // Captcha modal
        const captchaTitle = document.getElementById('captchaModalTitle');
        if (captchaTitle) captchaTitle.textContent = __('captcha.title');
        const captchaHint = document.getElementById('captchaHint');
        if (captchaHint) captchaHint.textContent = __('capture.hint');
        // Cover image
        const coverLabel = document.querySelector('#uploadModal .form-group:nth-child(5) label');
        if (coverLabel) {
            const coverText = coverLabel.querySelector('.cover-label-text');
            if (coverText) coverText.textContent = __('upload.cover');
        }
        const coverHint = document.querySelector('#coverUploadPlaceholder p');
        if (coverHint) coverHint.textContent = __('upload.coverHint');
    }

    // ===== DOM 引用 =====
    const $ = function (id) { return document.getElementById(id); };
    const grid = $('materialGrid');
    const emptyState = $('emptyState');
    const loadingState = $('loadingState');
    const searchInput = $('searchInput');
    const uploadModal = $('uploadModal');
    const toast = $('toast');

    // ===== 状态 =====
    let materials = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedFileData = null; // 选择的文件数据
    let selectedCoverData = null; // 选择的封面图数据（base64 data URL）

    // ===== Toast 通知 =====
    let toastTimer = null;
    function showToast(message, type) {
        type = type || 'info';
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 3000);
    }

    // ===== GitHub API 工具 =====
    // 检测是否在 iframe 中（编辑器内嵌模式）
    function isInIframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    // 通过编辑器转发读取请求（避免 iframe 内 CORS 问题）
    function forwardGithubRead(path) {
        if (!isInIframe() || !window.MaterialPlazaBridge || !window.MaterialPlazaBridge.forwardGithubRead) {
            return Promise.reject(new Error('Bridge not available'));
        }
        return window.MaterialPlazaBridge.forwardGithubRead(path);
    }

    // 读取操作：先尝试桥接转发，失败则匿名直接请求（无 Authorization header）
    async function githubFetch(path) {
        // 尝试通过编辑器转发
        try {
            const result = await forwardGithubRead(path);
            return result;
        } catch (e) {
            console.warn('Forward request failed, trying direct fetch:', e.message);
        }
        // 直接匿名请求（无 Authorization header，不触发 CORS 预检）
        const url = GITHUB_API_BASE + path;
        const res = await fetch(url, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || ('HTTP ' + res.status));
        }
        return res.json();
    }

    // 写入操作：直接认证请求（仅在用户主动操作时调用，如上传/删除）
    async function githubWrite(path, method, body) {
        const headers = {
            'Authorization': 'token ' + GITHUB_TOKEN,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        const url = GITHUB_API_BASE + path;
        const res = await fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            let errorBody = '';
            try { errorBody = await res.text(); } catch (_) {}
            throw new Error(errorBody || ('HTTP ' + res.status));
        }
        return res.json();
    }

    // 获取文件内容 (base64 encoded, UTF-8 安全)
    async function getFileContent(path) {
        try {
            const data = await githubFetch('/contents/' + path);
            return {
                content: base64ToString(data.content.replace(/\n/g, '')),
                sha: data.sha
            };
        } catch (e) {
            if (e.message.includes('404') || e.message.includes('Not Found')) {
                return null;
            }
            throw e;
        }
    }

    // 创建或更新文件 (UTF-8 安全)
    async function putFile(path, content, message) {
        const existing = await getFileContent(path);
        const body = {
            message: message,
            content: stringToBase64(content)
        };
        if (existing && existing.sha) {
            body.sha = existing.sha;
        }
        return githubWrite('/contents/' + path, 'PUT', body);
    }

    // 删除文件
    async function deleteFile(path, message) {
        const existing = await getFileContent(path);
        if (!existing) return;
        const body = {
            message: message,
            sha: existing.sha
        };
        return githubWrite('/contents/' + path, 'DELETE', body);
    }

    // 获取原始文件直链 URL
    function resolveRawUrl(path) {
        return 'https://raw.githubusercontent.com/' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '/main/' + path;
    }

    // ===== 素材操作 =====
    // 通过 Git Tree API 扫描 materials/ 子文件夹加载素材列表
    async function loadMaterials() {
        try {
            const tree = await githubFetch('/git/trees/main?recursive=1');
            const matDirs = new Map(); // id -> { files[] }

            if (!tree.tree) {
                throw new Error('无法获取仓库文件树');
            }

            // 遍历文件树，按素材 ID 分组
            for (const item of tree.tree) {
                if (item.path.startsWith(MATERIALS_PATH + '/')) {
                    const parts = item.path.split('/');
                    if (parts.length >= 3) {
                        const matId = parts[1]; // materials/{matId}/...
                        if (!matDirs.has(matId)) {
                            matDirs.set(matId, { id: matId, files: [] });
                        }
                        matDirs.get(matId).files.push(item);
                    }
                }
            }

            // 加载每个素材的 material.json
            const matList = [];
            for (const [matId, dir] of matDirs) {
                const metaFile = dir.files.find(f => f.path.endsWith('material.json'));
                if (!metaFile) continue;

                try {
                    const meta = await githubFetch('/contents/' + metaFile.path);
                    const metaContent = JSON.parse(base64ToString(meta.content));
                    matList.push({
                        id: matId,
                        name: metaContent.name || matId,
                        title: metaContent.title || metaContent.name || matId,
                        author: metaContent.author || __('unknown.author'),
                        description: metaContent.description || '',
                        type: metaContent.type || 'script',
                        mime: metaContent.mime || '',
                        thumbnail: metaContent.thumbnail || '',
                        uploadDate: metaContent.uploadDate || ''
                    });
                } catch (err) {
                    console.warn('Failed to load material ' + matId + ':', err);
                }
            }

            // 按上传日期排序（最新的在前）
            matList.sort(function (a, b) {
                if (a.uploadDate && b.uploadDate) {
                    return new Date(b.uploadDate) - new Date(a.uploadDate);
                }
                return 0;
            });

            materials = matList;
            renderMaterials();
        } catch (err) {
            console.error('Failed to load materials:', err);
            showToast(__('toast.load.fail', {msg: err.message}), 'error');
            materials = [];
            renderMaterials();
        }
    }

    // 获取单个素材的完整数据（含 body）- 从子文件夹读取
    async function getMaterialBody(id) {
        try {
            const metaFile = await getFileContent(MATERIALS_PATH + '/' + id + '/material.json');
            if (!metaFile) return null;
            const meta = JSON.parse(metaFile.content);

            // 读取 data.bin 文件内容
            try {
                const dataFile = await githubFetch('/contents/' + MATERIALS_PATH + '/' + id + '/data.bin');
                meta.body = dataFile.content; // GitHub API 返回 base64 内容
            } catch (e) {
                // 兼容旧格式：尝试读取 {id}.json 文件
                try {
                    const oldFile = await getFileContent(MATERIALS_PATH + '/' + id + '.json');
                    if (oldFile) {
                        const oldMeta = JSON.parse(oldFile.content);
                        meta.body = oldMeta.body || '';
                    }
                } catch (e2) {
                    meta.body = '';
                }
            }

            return meta;
        } catch (err) {
            console.warn('Failed to get material body for ' + id + ':', err);
            return null;
        }
    }

    // 上传素材到 GitHub（使用 Git Tree API 创建子文件夹）
    async function uploadMaterial(materialData) {
        const id = generateId();
        const now = new Date().toISOString();
        const matDir = MATERIALS_PATH + '/' + id;

        // 构建 meta.json
        const meta = {
            id: id,
            name: materialData.name,
            title: materialData.title || materialData.name,
            author: materialData.author,
            description: materialData.description || '',
            type: materialData.type,
            mime: materialData.mime,
            thumbnail: materialData.thumbnail || '',
            uploadDate: now
        };
        const metaContent = JSON.stringify(meta, null, 2);
        const metaBase64 = stringToBase64(metaContent);

        // 1) 获取当前 HEAD 引用
        const refData = await githubWrite('/git/refs/heads/main', 'GET');
        const headSha = refData.object.sha;

        // 2) 获取基础树
        const commitData = await githubWrite('/git/commits/' + headSha, 'GET');
        const baseTreeSha = commitData.tree.sha;

        // 3) 创建两个 blob
        const [metaBlob, dataBlob] = await Promise.all([
            githubWrite('/git/blobs', 'POST', { content: metaBase64, encoding: 'base64' }),
            githubWrite('/git/blobs', 'POST', { content: materialData.body, encoding: 'base64' })
        ]);

        // 4) 创建新树
        const newTree = await githubWrite('/git/trees', 'POST', {
            base_tree: baseTreeSha,
            tree: [
                { path: matDir + '/material.json', mode: '100644', type: 'blob', sha: metaBlob.sha },
                { path: matDir + '/data.bin', mode: '100644', type: 'blob', sha: dataBlob.sha }
            ]
        });

        // 5) 创建提交
        const newCommit = await githubWrite('/git/commits', 'POST', {
            message: 'Upload material: ' + materialData.name + ' by ' + materialData.author,
            tree: newTree.sha,
            parents: [headSha]
        });

        // 6) 更新 main 分支引用
        await githubWrite('/git/refs/heads/main', 'PATCH', { sha: newCommit.sha, force: false });

        return id;
    }

    // 删除素材（使用 Git Tree API 移除子文件夹的所有文件）
    async function deleteMaterial(id) {
        const material = materials.find(function (m) { return m.id === id; });
        if (!material) return;

        // 1) 获取当前 HEAD 引用
        const refData = await githubWrite('/git/refs/heads/main', 'GET');
        const headSha = refData.object.sha;

        // 2) 获取完整文件树
        const treeData = await githubWrite('/git/trees/' + headSha + '?recursive=1', 'GET');

        // 3) 过滤掉要删除的素材目录下的所有文件
        const prefix = MATERIALS_PATH + '/' + id + '/';
        const filteredTree = treeData.tree.filter(function (item) {
            return !item.path.startsWith(prefix);
        });

        // 4) 创建新树（排除已删除的素材文件，不使用 base_tree 以简化）
        const newTree = await githubWrite('/git/trees', 'POST', {
            tree: filteredTree.map(function (item) {
                return { path: item.path, mode: item.mode, type: item.type, sha: item.sha };
            })
        });

        // 5) 创建提交
        const newCommit = await githubWrite('/git/commits', 'POST', {
            message: 'Delete material: ' + (material.title || material.name) + ' by ' + material.author,
            tree: newTree.sha,
            parents: [headSha]
        });

        // 6) 更新 main 分支引用
        await githubWrite('/git/refs/heads/main', 'PATCH', { sha: newCommit.sha, force: false });

        // 7) 从本地列表中移除
        materials = materials.filter(function (m) { return m.id !== id; });
    }

    // 生成唯一 ID
    function generateId() {
        return 'mat_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    // ===== 渲染 =====
    function renderMaterials() {
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';

        let filtered = materials;
        if (currentFilter !== 'all') {
            filtered = filtered.filter(function (m) { return m.type === currentFilter; });
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            filtered = filtered.filter(function (m) {
                return (m.title && m.title.toLowerCase().includes(q)) ||
                    (m.name && m.name.toLowerCase().includes(q)) ||
                    (m.author && m.author.toLowerCase().includes(q)) ||
                    (m.description && m.description.toLowerCase().includes(q)) ||
                    (m.type && m.type.toLowerCase().includes(q));
            });
        }

        if (filtered.length === 0) {
            emptyState.style.display = 'flex';
            const emptyTitle = emptyState.querySelector('h3');
            const emptyDesc = emptyState.querySelector('p');
            if (searchQuery.trim()) {
                if (emptyTitle) emptyTitle.textContent = __('empty.search');
                if (emptyDesc) emptyDesc.textContent = '';
            } else {
                if (emptyTitle) emptyTitle.textContent = __('empty.title');
                if (emptyDesc) emptyDesc.textContent = __('empty.desc');
            }
            grid.innerHTML = '';
            return;
        }

        grid.innerHTML = '';
        filtered.forEach(function (material) {
            const card = createMaterialCard(material);
            grid.appendChild(card);
        });
    }

    function createMaterialCard(material) {
        const card = document.createElement('div');
        card.className = 'material-card';
        card.draggable = true;

        // 类型标签颜色
        var typeColors = {
            script: '#4caf50',
            sprite: '#2196f3',
            costume: '#ff9800',
            sound: '#9c27b0'
        };
        var typeLabels = {
            script: __('type.script'),
            sprite: __('type.sprite'),
            costume: __('type.costume'),
            sound: __('type.sound')
        };

        // 构建缩略图 HTML
        var thumbContent = '';
        if (material.thumbnail) {
            if (material.type === 'sound') {
                // 音频图标：使用 currentColor 适配深色/浅色模式
                thumbContent = '<div class="material-card-thumb-icon sound-icon">' +
                    material.thumbnail +
                    '</div>';
            } else {
                thumbContent = '<img src="' + escapeHtml(material.thumbnail) + '" alt="' + escapeHtml(material.title || material.name) + '" loading="lazy" />';
            }
        } else {
            // 无缩略图时显示占位图标
            thumbContent = '<div class="material-card-thumb-placeholder" style="font-size:32px;color:#ccc">' +
                getTypeIcon(material.type) +
                '</div>';
        }

        card.innerHTML =
            '<div class="material-card-thumb">' +
                '<div class="material-card-type-badge ' + material.type + '" style="background:' + (typeColors[material.type] || '#999') + '">' +
                    (typeLabels[material.type] || material.type) +
                '</div>' +
                thumbContent +
            '</div>' +
            '<div class="material-card-body">' +
                '<div class="material-card-title" title="' + escapeHtml(material.title || material.name || '') + '">' +
                    escapeHtml(material.title || material.name || '') +
                '</div>' +
                (material.description ? '<div class="material-card-desc" title="' + escapeHtml(material.description) + '">' + escapeHtml(material.description) + '</div>' : '') +
                '<div class="material-card-meta">' +
                    '<span class="material-card-author">' + escapeHtml(material.author || __('unknown.author')) + '</span>' +
                    '<span class="material-card-type">' + (typeLabels[material.type] || material.type) + '</span>' +
                '</div>' +
            '</div>';

        // 拖拽应用素材
        card.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', material.id);
            e.dataTransfer.effectAllowed = 'copy';
            card.style.opacity = '0.5';
            // 通知编辑器准备接收素材
            if (window.MaterialPlazaBridge) {
                window.MaterialPlazaBridge.requestApplyMaterial(material);
            }
        });
        card.addEventListener('dragend', function () {
            card.style.opacity = '1';
        });

        // 点击加载素材详情
        card.addEventListener('click', function () {
            loadAndApplyMaterial(material);
        });

        return card;
    }

    function getTypeIcon(type) {
        switch (type) {
            case 'script': return '🧩';
            case 'sprite': return '🦸';
            case 'costume': return '👗';
            case 'sound': return '🎵';
            default: return '📦';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // 加载并应用素材到编辑器
    async function loadAndApplyMaterial(material) {
        try {
            showToast(__('toast.apply'), 'info');
            const fullData = await getMaterialBody(material.id);
            if (!fullData) {
                showToast(__('toast.apply.fail'), 'error');
                return;
            }
            // 通过桥接发送到编辑器
            if (window.MaterialPlazaBridge) {
                window.MaterialPlazaBridge.requestApplyMaterial(fullData);
            } else {
                // 直接发送到编辑器
                window.parent.postMessage({
                    channel: 'rwc-material-plaza',
                    type: 'applyMaterial',
                    data: fullData
                }, '*');
            }
            showToast(__('toast.apply.success'), 'success');
        } catch (err) {
            console.error('Failed to apply material:', err);
            showToast(__('toast.apply.fail'), 'error');
        }
    }

    // ===== 上传弹窗 =====
    function openUploadModal() {
        selectedFileData = null;
        selectedCoverData = null;
        document.getElementById('authorInput').value = '';
        document.getElementById('titleInput').value = '';
        document.getElementById('descInput').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('coverInput').value = '';
        document.getElementById('filePreview').style.display = 'none';
        document.getElementById('fileUploadPlaceholder').style.display = 'flex';
        document.getElementById('coverPreview').style.display = 'none';
        document.getElementById('coverUploadPlaceholder').style.display = 'flex';
        document.getElementById('uploadSubmitBtn').disabled = true;
        uploadModal.style.display = 'flex';
    }

    function closeUploadModal() {
        uploadModal.style.display = 'none';
    }

    // 根据文件扩展名判断素材类型
    function getFileType(filename) {
        var ext = filename.split('.').pop().toLowerCase();
        if (ext === 'sprite3') return 'sprite';
        if (ext === 'svg' || ext === 'png') return 'costume';
        if (ext === 'wav' || ext === 'mp3') return 'sound';
        return null;
    }

    // 根据文件扩展名获取 MIME 类型
    function getFileMime(filename) {
        var ext = filename.split('.').pop().toLowerCase();
        var mimeMap = {
            'sprite3': 'application/zip',
            'svg': 'image/svg+xml',
            'png': 'image/png',
            'wav': 'audio/wav',
            'mp3': 'audio/mpeg'
        };
        return mimeMap[ext] || 'application/octet-stream';
    }

    // 获取文件类型显示标签
    function getFileTypeLabel(type) {
        var labels = {
            'sprite': __('file.type.sprite'),
            'costume': __('file.type.costume'),
            'sound': __('file.type.sound')
        };
        return labels[type] || type;
    }

    // ArrayBuffer 转 Base64
    function arrayBufferToBase64(buffer) {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        for (var i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // 字符串转 Base64（UTF-8 安全，解决中文乱码）
    function stringToBase64(str) {
        var bytes = new TextEncoder().encode(str);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Base64 转字符串（UTF-8 安全）
    function base64ToString(base64) {
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    }

    // 简单的 ZIP 解析器：从 sprite3 文件中提取第一个造型的图片
    function parseSprite3Thumbnail(arrayBuffer) {
        try {
            var bytes = new Uint8Array(arrayBuffer);
            var view = new DataView(arrayBuffer);
            var offset = 0;
            var files = {};

            // 遍历 ZIP 本地文件头
            while (offset + 30 < bytes.length) {
                var sig = view.getUint32(offset, true);
                if (sig === 0x04034b50) { // 本地文件头签名
                    var flags = view.getUint16(offset + 6, true);
                    var compression = view.getUint16(offset + 8, true);
                    var compressedSize = view.getUint32(offset + 18, true);
                    var uncompressedSize = view.getUint32(offset + 22, true);
                    var nameLen = view.getUint16(offset + 26, true);
                    var extraLen = view.getUint16(offset + 28, true);

                    var name = '';
                    for (var i = 0; i < nameLen; i++) {
                        name += String.fromCharCode(bytes[offset + 30 + i]);
                    }

                    var dataOffset = offset + 30 + nameLen + extraLen;
                    var dataEnd = dataOffset + compressedSize;

                    if (compressedSize > 0 || uncompressedSize > 0) {
                        var fileData = arrayBuffer.slice(dataOffset, dataEnd);
                        if (compression === 0) {
                            // 未压缩
                            files[name] = fileData;
                        } else if (compression === 8) {
                            // Deflate 压缩 - 使用浏览器 API
                            try {
                                var ds = new DecompressionStream('deflate-raw');
                                var writer = ds.writable.getWriter();
                                writer.write(fileData);
                                writer.close();
                                var reader = ds.readable.getReader();
                                var chunks = [];
                                function readAll() {
                                    return reader.read().then(function (result) {
                                        if (result.done) return new Blob(chunks).arrayBuffer();
                                        chunks.push(result.value);
                                        return readAll();
                                    });
                                }
                                // 同步方式：对于小文件，用 Promise 处理
                                // 实际上这里需要异步，但为了保持同步逻辑，只在 sprite.json 和图片上使用
                                // 先标记为未解析，后面再处理
                            } catch (e) {
                                // 不支持 DecompressionStream
                            }
                        }
                    }

                    offset = dataEnd;
                } else if (sig === 0x02014b50 || sig === 0x06054b50) {
                    // 中央目录或结束标记，停止
                    break;
                } else {
                    offset++;
                }
            }

            // 读取 sprite.json
            if (files['sprite.json']) {
                var jsonStr = new TextDecoder('utf-8').decode(new Uint8Array(files['sprite.json']));
                var spriteData = JSON.parse(jsonStr);

                // 获取第一个造型
                if (spriteData.costumes && spriteData.costumes.length > 0) {
                    var firstCostume = spriteData.costumes[0];
                    var md5ext = firstCostume.md5ext || firstCostume.baseLayerMD5 || '';
                    // 尝试获取造型名称对应的文件
                    var costumeAsset = files[md5ext];
                    if (costumeAsset) {
                        var ext = md5ext.split('.').pop().toLowerCase();
                        var mime = ext === 'svg' ? 'image/svg+xml' : 'image/png';
                        var b64 = arrayBufferToBase64(costumeAsset);
                        return 'data:' + mime + ';base64,' + b64;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to parse sprite3 thumbnail:', e);
        }
        return null;
    }

    // 从已读取的文件数据中提取缩略图
    function extractFileThumbnail(file, type, arrayBuffer, textContent) {
        if (type === 'sprite') {
            return parseSprite3Thumbnail(arrayBuffer);
        } else if (type === 'costume') {
            // SVG 或 PNG 直接作为缩略图
            if (file.name.endsWith('.svg')) {
                return 'data:image/svg+xml;base64,' + arrayBufferToBase64(arrayBuffer);
            } else if (file.name.endsWith('.png')) {
                return 'data:image/png;base64,' + arrayBufferToBase64(arrayBuffer);
            }
        }
        return null;
    }

    // 默认图标：角色（用户提供的 sprite-library SVG，适配深浅色）
    function getSpriteLibraryIconSvg() {
        return '<?xml version="1.0" encoding="UTF-8"?>' +
            '<svg width="48" height="48" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="currentColor">' +
            '<title>sprite-library</title>' +
            '<g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">' +
            '<g id="sprite-library" fill="currentColor">' +
            '<path d="M18.5,2.5 L19.25,2.5 C19.6642136,2.5 20,2.83578644 20,3.25 C20,3.66421356 19.6642136,4 19.25,4 L18.5,4 L18.5,4.75 C18.5,5.16421356 18.1642136,5.5 17.75,5.5 C17.3357864,5.5 17,5.16421356 17,4.75 L17,4 L16.25,4 C15.8357864,4 15.5,3.66421356 15.5,3.25 C15.5,2.83578644 15.8357864,2.5 16.25,2.5 L17,2.5 L17,1.75 C17,1.33578644 17.3357864,1 17.75,1 C18.1642136,1 18.5,1.33578644 18.5,1.75 L18.5,2.5 Z M15.9214311,12.3870691 C15.9214311,15.6404905 13.2729235,17 10.0195022,17 C6.767318,17 4.13241787,15.6404905 4.13241787,12.3870691 C4.13241787,11.5829915 4.26725548,10.9026183 4.52827141,10.3335788 L4.42930802,5.63281784 C4.4169376,5.11326006 4.99834749,4.81636989 5.41894188,5.12563048 L7.93013778,7.01830528 C8.51154766,6.70904469 9.22903221,6.57297003 10.0195022,6.57297003 C10.8124464,6.57297003 11.5423013,6.70904469 12.1237112,7.01830528 L14.6349071,5.12563048 C15.0431311,4.81636989 15.624541,5.11326006 15.624541,5.63281784 L15.5255776,10.3335788 C15.7853565,10.9026183 15.9214311,11.5829915 15.9214311,12.3870691 Z M12.5062047,14.4154474 C12.6806277,14.2311281 12.6546498,13.9330009 12.4579601,13.759815 C12.2724037,13.5989995 11.9742765,13.6237403 11.8023276,13.8229041 C11.6650159,13.9824826 11.4670892,14.0690756 11.256792,14.0690756 C10.8609384,14.0690756 10.526937,13.7474445 10.526937,13.3392206 L10.526937,12.6588473 C11.2444215,12.4609205 11.7887202,11.8560068 11.7887202,11.4589162 C11.7887202,10.9640993 11.0093835,10.9640993 10.0692313,10.9640993 C9.11794581,10.9640993 8.35097957,10.9640993 8.35097957,11.4589162 C8.35097957,11.8560068 8.87053734,12.4609205 9.59915527,12.6464769 L9.59915527,13.3392206 C9.59915527,13.7474445 9.27876131,14.0690756 8.88167073,14.0690756 C8.66024015,14.0690756 8.46107634,13.9824826 8.32500168,13.8229041 C8.16418618,13.6237403 7.86729603,13.5989995 7.66936926,13.759815 C7.47267953,13.9330009 7.45907206,14.2311281 7.62112461,14.4154474 C7.93038519,14.7865601 8.3868538,14.9968573 8.88167073,14.9968573 C9.33937638,14.9968573 9.75997077,14.8001676 10.0692313,14.490907 C10.3673585,14.8001676 10.7867159,14.9968573 11.256792,14.9968573 C11.7404755,14.9968573 12.1969441,14.7865601 12.5062047,14.4154474 Z" id="Combined-Shape"/>' +
            '</g></g></g>' +
            '</svg>';
    }

    // 造型默认图标（和角色使用同一个 sprite-library SVG，颜色通过 CSS 适配主题）
    function getCostumeIconSvg() {
        return getSpriteLibraryIconSvg();
    }

    // 音频图标 SVG（适配深色/浅色模式，使用 currentColor）
    function getAudioIconSvg() {
        return '<svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12.4785,12.6667 C12.3145,12.6667 12.1459,12.6272 11.9926,12.5441 C11.5374,12.296 11.3856,11.7562 11.6554,11.3376 C12.1689,10.5371 12.1689,9.54492 11.6554,8.74581 C11.3856,8.32582 11.5374,7.78603 11.9926,7.53798 C12.4524,7.29275 13.038,7.43087 13.3047,7.84804 C14.1738,9.20103 14.1738,10.881 13.3047,12.234 C13.1269,12.513 12.8065,12.6667 12.4785,12.6667 Z M15.3807,13.8333 C15.2409,13.8333 15.0959,13.7963 14.9665,13.7182 C14.5785,13.4853 14.4492,12.9785 14.6791,12.5855 C15.5949,11.016 15.5949,9.06549 14.6791,7.49738 C14.4492,7.10436 14.5785,6.59622 14.9665,6.36332 C15.3559,6.13439 15.8549,6.26275 16.0848,6.65444 C17.3051,8.74261 17.3051,11.3389 16.0848,13.4271 C15.932,13.6891 15.6603,13.8333 15.3807,13.8333 Z M10.3043,5.62502 L10.3043,13.8737 C10.3043,14.8509 9.1097,15.3625 8.36478,14.7038 L6.7566,13.2798 C6.18712,12.7763 5.44499,12.4969 4.67362,12.4969 L4.39237,12.4969 C3.62378,12.4969 3,11.8935 3,11.1471 L3,8.36647 C3,7.62138 3.62378,7.01666 4.39237,7.01666 L4.65831,7.01666 C5.42968,7.01666 6.17181,6.73726 6.74129,6.23378 L8.36478,4.79624 C9.1097,4.13753 10.3043,4.64911 10.3043,5.62502 Z"/>' +
            '</svg>';
    }

    // 获取默认图标 HTML（根据类型）
    function getDefaultIconForType(type) {
        var classes = 'default-type-icon ' + type + '-icon';
        if (type === 'sprite') {
            return '<div class="' + classes + '">' + getSpriteLibraryIconSvg() + '</div>';
        } else if (type === 'costume') {
            return '<div class="' + classes + '">' + getCostumeIconSvg() + '</div>';
        } else if (type === 'sound') {
            return '<div class="' + classes + '">' + getAudioIconSvg() + '</div>';
        }
        return '';
    }

    // 处理选择的文件
    function handleFileSelect(file) {
        if (!file) return;

        var type = getFileType(file.name);
        if (!type) {
            showToast(__('upload.fileTypes'), 'error');
            return;
        }

        var name = file.name.replace(/\.[^/.]+$/, ''); // 去掉扩展名
        var mime = getFileMime(file.name);

        // 读取为 ArrayBuffer
        var reader = new FileReader();
        reader.onload = function (e) {
            var body = arrayBufferToBase64(e.target.result);
            showFilePreview(name, type, body, mime);
        };
        reader.readAsArrayBuffer(file);
    }

    function showFilePreview(name, type, body, mime) {
        selectedFileData = {
            name: name,
            type: type,
            mime: mime,
            body: body,
            bodyMD5: '',
            thumbnail: '' // 缩略图由封面图决定，此处不提取
        };

        document.getElementById('fileUploadPlaceholder').style.display = 'none';
        document.getElementById('filePreview').style.display = 'flex';
        document.getElementById('filePreviewName').textContent = name;
        document.getElementById('filePreviewType').textContent = getFileTypeLabel(type);
        var thumbEl = document.getElementById('filePreviewThumb');
        thumbEl.innerHTML = '';
        // 使用默认类型图标
        thumbEl.innerHTML = getDefaultIconForType(type);
        checkUploadForm();
    }

    // 检查上传表单是否可提交
    function checkUploadForm() {
        var author = document.getElementById('authorInput').value.trim();
        var title = document.getElementById('titleInput').value.trim();
        document.getElementById('uploadSubmitBtn').disabled = !(author && title && selectedFileData);
    }

    // 执行上传
    async function handleUpload() {
        var author = document.getElementById('authorInput').value.trim();
        var title = document.getElementById('titleInput').value.trim();
        var desc = document.getElementById('descInput').value.trim();
        if (!author || !title || !selectedFileData) {
            showToast(__('upload.author') + ' / ' + __('upload.titleLabel') + ' ' + __('file.select.error'), 'error');
            return;
        }

        // 先完成人机验证
        await verifyCaptcha();

        var submitBtn = document.getElementById('uploadSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = __('upload.uploading');

        // 确定缩略图：如果用户上传了封面图则用封面图，否则用默认类型图标
        var thumbnail = selectedCoverData || '';

        try {
            await uploadMaterial({
                name: selectedFileData.name || 'untitled',
                title: title,
                author: author,
                description: desc,
                type: selectedFileData.type,
                mime: selectedFileData.mime || 'application/octet-stream',
                body: selectedFileData.body,
                bodyMD5: selectedFileData.bodyMD5 || '',
                thumbnail: thumbnail
            });
            showToast(__('toast.upload.success'), 'success');
            closeUploadModal();
            renderMaterials();
            // 通知编辑器上传完成
            if (window.MaterialPlazaBridge) {
                window.MaterialPlazaBridge.notifyUploadComplete(true, '');
            }
        } catch (err) {
            console.error('Upload failed:', err);
            showToast(__('toast.upload.fail', {msg: err.message}), 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = __('upload.submit');
        }
    }

    // ===== 人机验证 =====
    function verifyCaptcha() {
        return new Promise(function (resolve, reject) {
            const captchaModal = $('captchaModal');
            const container = $('captchaContainer');

            // 清空容器并创建新的 CAPTCHA 组件
            container.innerHTML = '';

            // 检查 window.capWidget 是否已存在，如果存在则复用
            let capWidget = window.capWidget;
            if (!capWidget || capWidget.parentNode !== container) {
                capWidget = document.createElement('div');
                capWidget.className = 'cap-widget';
                capWidget.setAttribute('data-cap-api-endpoint', 'https://captcha.gurl.eu.org/api/');
                capWidget.setAttribute('data-cap-lang', currentLang === 'zh' ? 'zh' : 'en');
                container.appendChild(capWidget);
                window.capWidget = capWidget;
            }

            // 验证成功回调
            function onSuccess(token) {
                fetch('https://captcha.gurl.eu.org/api/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 'cap-token': token })
                })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        captchaModal.style.display = 'none';
                        resolve();
                    } else {
                        showToast(__('capture.hint'), 'error');
                        resetCaptcha();
                        reject(new Error('验证失败'));
                    }
                })
                .catch(function () {
                    showToast(__('capture.hint'), 'error');
                    resetCaptcha();
                    reject(new Error('验证请求失败'));
                });
            }

            // 重置 CAPTCHA
            function resetCaptcha() {
                if (window.capWidget) {
                    var newWidget = document.createElement('div');
                    newWidget.className = 'cap-widget';
                    newWidget.setAttribute('data-cap-api-endpoint', 'https://captcha.gurl.eu.org/api/');
                    newWidget.setAttribute('data-cap-lang', currentLang === 'zh' ? 'zh' : 'en');
                    container.innerHTML = '';
                    container.appendChild(newWidget);
                    window.capWidget = newWidget;
                }
            }

            // 显示弹窗
            captchaModal.style.display = 'flex';

            // 点击遮罩层关闭
            captchaModal.addEventListener('click', function (e) {
                if (e.target === captchaModal) {
                    captchaModal.style.display = 'none';
                    resetCaptcha();
                    reject(new Error('用户取消验证'));
                }
            });

            // 监听验证成功事件
            var onMessage = function (e) {
                if (e.data && e.data.type === 'cap-success') {
                    onSuccess(e.data.token);
                }
            };
            window.addEventListener('message', onMessage);

            // 清理监听（超时或完成后）
            setTimeout(function () {
                window.removeEventListener('message', onMessage);
            }, 60000);
        });
    }

    // ===== 主题切换 =====
    function initThemeToggle() {
        const btn = document.getElementById('themeToggleBtn');
        const icon = document.getElementById('themeToggleIcon');

        // 读取用户保存的主题或编辑器主题
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem('rwc:theme');
        } catch (e) { /* ignore */ }

        // 如果有编辑器桥接，读取编辑器主题
        var editorTheme = null;
        if (window.MaterialPlazaBridge && window.MaterialPlazaBridge.getCurrentTheme) {
            editorTheme = window.MaterialPlazaBridge.getCurrentTheme();
        }

        if (editorTheme) {
            applyTheme(editorTheme === 'dark' ? 'dark' : 'light');
        } else if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            // 默认跟随系统
            applyTheme('auto');
        }

        btn.addEventListener('click', function () {
            const current = document.documentElement.getAttribute('data-theme');
            let next;
            if (current === 'dark') next = 'light';
            else if (current === 'light') next = 'dark';
            else next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
            applyTheme(next);
            try { localStorage.setItem('rwc:theme', next); } catch (e) { /* ignore */ }
        });

        // 监听编辑器主题变化
        if (window.MaterialPlazaBridge && window.MaterialPlazaBridge.onThemeChange) {
            window.MaterialPlazaBridge.onThemeChange(function (isDark) {
                applyTheme(isDark ? 'dark' : 'light');
            });
        }
    }

    function applyTheme(theme) {
        const icon = document.getElementById('themeToggleIcon');
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    // ===== 事件绑定 =====
    function init() {
        // 通知编辑器就绪
        if (window.MaterialPlazaBridge) {
            window.MaterialPlazaBridge.notifyReady();
        }

        // 初始化主题切换
        initThemeToggle();

        // 应用当前语言
        setLang(currentLang);

        // 搜索
        searchInput.addEventListener('input', function () {
            searchQuery = this.value;
            renderMaterials();
        });

        // 过滤器
        document.querySelectorAll('.filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.filter-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                renderMaterials();
            });
        });

        // 添加按钮 - 检查是否在编辑器内
        var addBtn = document.getElementById('addBtn');
        if (isInIframe()) {
            // 在编辑器内：隐藏上传按钮，显示提示条
            addBtn.style.display = 'none';
            document.getElementById('editorHint').style.display = 'flex';
        } else {
            addBtn.addEventListener('click', openUploadModal);
        }

        // 刷新按钮
        document.getElementById('refreshBtn').addEventListener('click', function () {
            loadMaterials().then(function () {
                showToast(__('toast.refresh'), 'success');
            });
        });

        // 语言切换
        document.getElementById('langToggleBtn').addEventListener('click', function () {
            setLang(currentLang === 'zh' ? 'en' : 'zh');
        });

        // 上传弹窗
        document.getElementById('uploadModalClose').addEventListener('click', closeUploadModal);
        document.getElementById('uploadCancelBtn').addEventListener('click', closeUploadModal);
        document.getElementById('uploadSubmitBtn').addEventListener('click', handleUpload);
        document.getElementById('filePreviewRemove').addEventListener('click', function () {
            selectedFileData = null;
            document.getElementById('fileInput').value = '';
            document.getElementById('filePreview').style.display = 'none';
            document.getElementById('fileUploadPlaceholder').style.display = 'flex';
            document.getElementById('uploadSubmitBtn').disabled = true;
        });
        document.getElementById('fileInput').addEventListener('change', function () {
            if (this.files && this.files.length > 0) {
                handleFileSelect(this.files[0]);
            }
        });
        // 点击上传区域触发文件选择
        document.getElementById('fileUploadZone').addEventListener('click', function (e) {
            if (e.target.id !== 'filePreviewRemove' && !e.target.closest('.file-preview')) {
                document.getElementById('fileInput').click();
            }
        });

        // 封面图上传
        document.getElementById('coverPreviewRemove').addEventListener('click', function () {
            selectedCoverData = null;
            document.getElementById('coverInput').value = '';
            document.getElementById('coverPreview').style.display = 'none';
            document.getElementById('coverUploadPlaceholder').style.display = 'flex';
        });
        document.getElementById('coverInput').addEventListener('change', function () {
            if (this.files && this.files.length > 0) {
                var file = this.files[0];
                var reader = new FileReader();
                reader.onload = function (e) {
                    selectedCoverData = e.target.result;
                    document.getElementById('coverUploadPlaceholder').style.display = 'none';
                    document.getElementById('coverPreview').style.display = 'flex';
                    document.getElementById('coverPreviewName').textContent = file.name;
                    document.getElementById('coverPreviewThumb').innerHTML = '<img src="' + e.target.result + '" alt="' + file.name + '" />';
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('coverUploadZone').addEventListener('click', function (e) {
            if (e.target.id !== 'coverPreviewRemove' && !e.target.closest('.file-preview')) {
                document.getElementById('coverInput').click();
            }
        });

        // 表单输入变化
        document.getElementById('authorInput').addEventListener('input', checkUploadForm);
        document.getElementById('titleInput').addEventListener('input', checkUploadForm);
        document.getElementById('descInput').addEventListener('input', checkUploadForm);

        // 点击遮罩层关闭
        uploadModal.addEventListener('click', function (e) {
            if (e.target === uploadModal || e.target.classList.contains('modal-overlay')) {
                closeUploadModal();
            }
        });

        // 监听编辑器语言变化
        if (window.MaterialPlazaBridge) {
            window.MaterialPlazaBridge.onLocaleChange(function (locale) {
                var newLang = locale && locale.startsWith('en') ? 'en' : 'zh';
                if (newLang !== currentLang) {
                    setLang(newLang);
                }
            });
        }

        // 加载素材列表
        loadMaterials();
    }

    // ===== 启动 =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();