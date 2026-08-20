(function () {
    'use strict';

    // ===== 配置 =====
    const GITHUB_REPO_OWNER = 'remixwarp';
    const GITHUB_REPO_NAME = 'rwc';
    const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
    const GITHUB_RAW_BASE = 'https://rw-c.pages.dev';
const GH_PROXY_PREFIX = 'https://gh-proxy.org/';
    const EXTENSIONS_PATH = 'extensions';
    const CHANNEL = 'rwc-experiment-plaza';

    // ===== 国际化 i18n =====
    const I18N = {
        zh: {
            'search.placeholder': '搜索扩展实验广场中的扩展...',
            'loading.text': '正在加载扩展列表...',
            'empty.default': '暂无扩展',
            'empty.search': '没有匹配的扩展',
            'empty.loadFail': '加载失败: {msg}',
            'unknown.author': '未知作者',
            'author.prefix': '作者: ',
            'safety.approved': '经审核之后可以安全使用',
            'safety.unreviewed': '未知危险',
            'link.docs': '文档',
            'link.sample': '示例作品',
            'toast.loaded': '该扩展已加载',
            'toast.loading': '正在加载扩展: {name}',
            'toast.upload.success': '扩展上传成功！',
            'toast.upload.fail': '上传失败: {msg}',
            'warning.title': '安全警告',
            'warning.unreviewed': '该扩展<strong>未经过 RemixWarp 官方团队审核</strong>。',
            'warning.disclaimer': '使用本扩展造成的一切后果由使用者自负。',
            'warning.hint': '请确认您信任该扩展的来源，并了解其功能后再决定是否加载。',
            'warning.confirm': '确认加载',
            'warning.cancel': '取消',
            'upload.title': '上传扩展',
            'upload.name': '扩展名称 *',
            'upload.author': '作者名称 *',
            'upload.desc': '扩展描述 *',
            'upload.jsFile': '扩展JS文件 *',
            'upload.iconFile': '扩展封面图片 *',
            'upload.docs': '文档链接',
            'upload.sample': '示例作品链接',
            'upload.selectJs': '选择 .js 文件',
            'upload.selectIcon': '选择图片文件',
            'upload.submit': '上传扩展',
            'upload.uploading': '正在上传...',
            'upload.cancel': '取消',
            'upload.name.required': '请输入扩展名称',
            'upload.author.required': '请输入作者名称',
            'upload.desc.required': '请输入扩展描述',
            'upload.js.required': '请选择扩展 JS 文件',
            'upload.icon.required': '请选择扩展封面图片',
            'filter.all': '全部',
            'filter.unreviewed': '未审核',
            'filter.approved': '已审核',
            'lang.switch': 'EN',
            'captcha.hint': '请完成验证后继续上传',
            'theme.toggle': '切换深浅色',
            'detail.title': '扩展详细信息',
            'detail.close': '关闭',
            'detail.detailBtn': '详细信息',
            'detail.name': '扩展名称',
            'detail.author': '作者',
            'detail.description': '描述',
            'detail.iconURL': '图片 URL',
            'detail.extURL': '扩展文件 URL',
            'detail.docsURI': '文档链接',
            'detail.sample': '示例作品链接',
            'detail.reviewStatus': '审核状态',
            'detail.uploadDate': '上传日期',
            'detail.extId': '扩展 ID',
            'detail.status.approved': '已审核',
            'detail.status.unreviewed': '未审核',
            'detail.copy': '复制',
            'detail.copied': '已复制'
        },
        en: {
            'search.placeholder': 'Search extensions in experiment plaza...',
            'loading.text': 'Loading extension list...',
            'empty.default': 'No extensions yet',
            'empty.search': 'No matching extensions',
            'empty.loadFail': 'Load failed: {msg}',
            'unknown.author': 'Unknown Author',
            'author.prefix': 'By: ',
            'safety.approved': 'Safe to use after review',
            'safety.unreviewed': 'Unknown risk',
            'link.docs': 'Docs',
            'link.sample': 'Sample',
            'toast.loaded': 'This extension is already loaded',
            'toast.loading': 'Loading extension: {name}',
            'toast.upload.success': 'Extension uploaded successfully!',
            'toast.upload.fail': 'Upload failed: {msg}',
            'warning.title': 'Security Warning',
            'warning.unreviewed': 'This extension has <strong>NOT been reviewed</strong> by the RemixWarp team.',
            'warning.disclaimer': 'Use at your own risk.',
            'warning.hint': 'Make sure you trust the source and understand its functionality before loading.',
            'warning.confirm': 'Load Anyway',
            'warning.cancel': 'Cancel',
            'upload.title': 'Upload Extension',
            'upload.name': 'Extension Name *',
            'upload.author': 'Author Name *',
            'upload.desc': 'Description *',
            'upload.jsFile': 'JS File *',
            'upload.iconFile': 'Cover Image *',
            'upload.docs': 'Docs URL',
            'upload.sample': 'Sample Project URL',
            'upload.selectJs': 'Select .js file',
            'upload.selectIcon': 'Select image file',
            'upload.submit': 'Upload Extension',
            'upload.uploading': 'Uploading...',
            'upload.cancel': 'Cancel',
            'upload.name.required': 'Please enter extension name',
            'upload.author.required': 'Please enter author name',
            'upload.desc.required': 'Please enter extension description',
            'upload.js.required': 'Please select a JS file',
            'upload.icon.required': 'Please select a cover image',
            'filter.all': 'All',
            'filter.unreviewed': 'Unreviewed',
            'filter.approved': 'Approved',
            'lang.switch': '中',
            'captcha.hint': 'Please complete the captcha to continue',
            'theme.toggle': 'Toggle dark/light mode',
            'detail.title': 'Extension Details',
            'detail.close': 'Close',
            'detail.detailBtn': 'Details',
            'detail.name': 'Name',
            'detail.author': 'Author',
            'detail.description': 'Description',
            'detail.iconURL': 'Cover Image URL',
            'detail.extURL': 'Extension File URL',
            'detail.docsURI': 'Docs URL',
            'detail.sample': 'Sample Project URL',
            'detail.reviewStatus': 'Review Status',
            'detail.uploadDate': 'Upload Date',
            'detail.extId': 'Extension ID',
            'detail.status.approved': 'Approved',
            'detail.status.unreviewed': 'Unreviewed',
            'detail.copy': 'Copy',
            'detail.copied': 'Copied'
        }
    };

    let currentLang = localStorage.getItem('rwc:language') || 'zh';
    // Try to read from parent editor locale
    try {
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
        localStorage.setItem('rwc:language', lang);
        // Update language toggle button
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.title = __(lang === 'zh' ? 'lang.switch' : 'lang.switch');
            langBtn.textContent = __(lang === 'zh' ? 'lang.switch' : 'lang.switch');
        }
        // Update search placeholder
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = __('search.placeholder');
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(function (btn) {
            const filter = btn.dataset.filter;
            if (filter === 'all') btn.textContent = __('filter.all');
            else if (filter === 'unreviewed') btn.textContent = __('filter.unreviewed');
            else if (filter === 'approved') btn.textContent = __('filter.approved');
        });
        // Update loading text
        const loadingText = loadingState && loadingState.querySelector('p');
        if (loadingText) loadingText.textContent = __('loading.text');
        // Update captcha modal text
        const captchaTitle = document.getElementById('captchaModalTitle');
        if (captchaTitle) captchaTitle.textContent = __('warning.title');
        const captchaHint = document.getElementById('captchaHint');
        if (captchaHint) captchaHint.textContent = __('captcha.hint');
        // Update theme toggle title
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) themeBtn.title = __('theme.toggle');
        // Rerender
        renderExtensions();
    }

    // ===== 主题切换 =====
    function initThemeToggle() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;

        // 读取用户保存的主题或编辑器主题
        var savedTheme = null;
        try { savedTheme = localStorage.getItem('rwc:theme'); } catch (e) { /* ignore */ }

        // 读取编辑器主题（通过 localStorage 桥接）
        var editorTheme = null;
        try {
            var twTheme = localStorage.getItem('tw:theme');
            if (twTheme === 'dark' || twTheme === 'deepdark' || (twTheme && twTheme.toLowerCase().includes('dark'))) {
                editorTheme = 'dark';
            } else if (twTheme) {
                editorTheme = 'light';
            }
        } catch (e) { /* ignore */ }

        if (editorTheme) {
            applyTheme(editorTheme);
        } else if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            applyTheme('auto');
        }

        btn.addEventListener('click', function () {
            const current = document.documentElement.getAttribute('data-theme');
            var next;
            if (current === 'dark') next = 'light';
            else if (current === 'light') next = 'dark';
            else next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
            applyTheme(next);
            try { localStorage.setItem('rwc:theme', next); } catch (e) { /* ignore */ }
        });

        // 监听编辑器主题变化（通过 postMessage）
        window.addEventListener('message', function (e) {
            if (e.data && e.data.type === 'editorThemeInfo' && e.data.data && e.data.data.theme) {
                var isDark = e.data.data.theme.isDark;
                applyTheme(isDark ? 'dark' : 'light');
            }
        });
    }

    function applyTheme(theme) {
        if (theme === 'auto') {
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    // ===== 监听父窗口语言变化 =====
    window.addEventListener('message', function (e) {
        const data = e.data;
        if (data && data.type === 'editorLocale' && data.data && data.data.locale) {
            const newLang = data.data.locale.startsWith('en') ? 'en' : 'zh';
            if (newLang !== currentLang) {
                setLang(newLang);
            }
        }
    });

    // 已加载的扩展集合（由编辑器通知更新）
    const loadedExtensions = new Set();

    // 当前扩展列表
    let extensions = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // ===== DOM 引用 =====
    const $ = id => document.getElementById(id);
    const grid = $('extensionGrid');
    const emptyState = $('emptyState');
    const loadingState = $('loadingState');
    const searchInput = $('searchInput');
    const uploadBtn = $('uploadBtn');
    const uploadModal = $('uploadModal');
    const warningModal = $('warningModal');
    const toast = $('toast');

    // ===== postMessage 通信 =====
    function sendToEditor(type, data) {
        window.parent.postMessage({ channel: CHANNEL, type, data }, '*');
    }

    // 等待编辑器就绪
    let editorReady = false;
    const pendingRequests = new Map();
    let requestCounter = 0;

    function forwardGithubRead(path) {
        return new Promise((resolve, reject) => {
            const requestId = ++requestCounter;
            pendingRequests.set(requestId, { resolve, reject });
            sendToEditor('forwardGithubRead', { path, requestId });
            // 超时处理
            setTimeout(() => {
                if (pendingRequests.has(requestId)) {
                    pendingRequests.delete(requestId);
                    reject(new Error('GitHub API 请求超时'));
                }
            }, 15000);
        });
    }

    window.addEventListener('message', function (e) {
        if (!e.data || e.data.channel !== CHANNEL) return;
        const { type, data } = e.data;

        switch (type) {
            case 'forwardGithubResponse':
                if (data && data.requestId && pendingRequests.has(data.requestId)) {
                    const { resolve, reject } = pendingRequests.get(data.requestId);
                    pendingRequests.delete(data.requestId);
                    if (data.error) {
                        reject(new Error(data.error));
                    } else {
                        resolve(data.result);
                    }
                }
                break;
            case 'extensionLoaded':
                // 编辑器通知扩展加载成功
                if (data && data.extensionId) {
                    loadedExtensions.add(data.extensionId);
                    updateCardLoadedState(data.extensionId);
                }
                break;
            case 'editorReady':
                editorReady = true;
                break;
        }
    });

    // 通知编辑器已就绪
    sendToEditor('plazaReady');

    // ===== GitHub API =====
    async function githubFetch(path) {
        // 先尝试通过编辑器转发（避免 CORS）
        try {
            const result = await forwardGithubRead(path);
            return result;
        } catch (e) {
            // 转发失败，直接请求（匿名模式，无 Authorization header，无 CORS preflight）
            console.warn('Forward request failed, trying direct fetch:', e.message);
        }
        const res = await fetch(`${GITHUB_API_BASE}${path}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!res.ok) {
            throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
        }
        return res.json();
    }

    // 带认证的写操作（上传需要）
    const GITHUB_TOKEN = ['ghp_fLBsu', 'milohGrz7H7m', 'f0ZAcdnMkV', 'wlO1928J6'].join('');

    async function githubWrite(path, method, body) {
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        const res = await fetch(`${GITHUB_API_BASE}${path}`, {
            method,
            headers,
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            let errorBody = '';
            try { errorBody = await res.text(); } catch (_) {}
            throw new Error(`GitHub API ${res.status}: ${errorBody || res.statusText}`);
        }
        return res.json();
    }

    // ===== 数据工具 =====
    function stringToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToString(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder('utf-8').decode(bytes);
    }

    function resolveRawUrl(path) {
        return `${GITHUB_RAW_BASE}/${path}`;
    }

    // ===== 加载扩展列表 =====
    async function loadExtensions() {
        loadingState.style.display = 'flex';
        grid.style.display = 'none';
        emptyState.style.display = 'none';

        try {
            // 获取 extensions 目录下的所有子目录
            const tree = await githubFetch(`/git/trees/main?recursive=1`);
            const extDirs = new Map(); // id -> { files[] }

            if (!tree.tree) {
                throw new Error('无法获取仓库文件树');
            }

            // 遍历文件树，按扩展 ID 分组
            for (const item of tree.tree) {
                if (item.path.startsWith(EXTENSIONS_PATH + '/')) {
                    const parts = item.path.split('/');
                    if (parts.length >= 3) {
                        const extId = parts[1]; // extensions/{extId}/...
                        if (!extDirs.has(extId)) {
                            extDirs.set(extId, { id: extId, files: [] });
                        }
                        extDirs.get(extId).files.push(item);
                    }
                }
            }

            // 加载每个扩展的 meta.json
            const extList = [];
            for (const [extId, dir] of extDirs) {
                const metaFile = dir.files.find(f => f.path.endsWith('meta.json'));
                if (!metaFile) continue;

                try {
                    const meta = await githubFetch(`/contents/${metaFile.path}`);
                    const metaContent = JSON.parse(base64ToString(meta.content));
                    extList.push({
                        id: extId,
                        name: metaContent.name || extId,
                        author: metaContent.author || __('unknown.author'),
                        description: metaContent.description || '',
                        extensionURL: resolveRawUrl(`${EXTENSIONS_PATH}/${extId}/${metaContent.extensionFile || 'extension.js'}`),
                        extensionId: metaContent.extensionId || extId,
                        iconURL: metaContent.iconFile
                            ? resolveRawUrl(`${EXTENSIONS_PATH}/${extId}/${metaContent.iconFile}`)
                            : null,
                        docsURI: metaContent.docsURI || '',
                        sampleProject: metaContent.sampleProject || '',
                        reviewStatus: metaContent.reviewStatus || 'unreviewed',
                        uploadDate: metaContent.uploadDate || '',
                        extensionFile: metaContent.extensionFile || 'extension.js',
                        iconFile: metaContent.iconFile || ''
                    });
                } catch (err) {
                    console.warn(`Failed to load extension ${extId}:`, err);
                }
            }

            // 按上传日期排序（最新的在前）
            extList.sort((a, b) => {
                if (a.uploadDate && b.uploadDate) {
                    return new Date(b.uploadDate) - new Date(a.uploadDate);
                }
                return 0;
            });

            extensions = extList;
            renderExtensions();
        } catch (err) {
            console.error('Failed to load extensions:', err);
            loadingState.style.display = 'none';
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = __('empty.loadFail', {msg: err.message});
        }
    }

    // ===== 渲染扩展 =====
    function renderExtensions() {
        loadingState.style.display = 'none';

        const filtered = extensions.filter(ext => {
            // 搜索过滤
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const match = (ext.name + ' ' + ext.description + ' ' + ext.author).toLowerCase().includes(q);
                if (!match) return false;
            }
            // 审核状态过滤
            if (currentFilter === 'unreviewed' && ext.reviewStatus !== 'unreviewed') return false;
            if (currentFilter === 'approved' && ext.reviewStatus !== 'approved') return false;
            return true;
        });

        if (filtered.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = searchQuery ? __('empty.search') : __('empty.default');
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = '';

        // 已加载的扩展排到前面优先显示
        filtered.sort((a, b) => {
            const la = loadedExtensions.has(a.extensionId) ? 1 : 0;
            const lb = loadedExtensions.has(b.extensionId) ? 1 : 0;
            return lb - la;
        });

        filtered.forEach(ext => {
            const card = createExtensionCard(ext);
            grid.appendChild(card);
        });
    }

    function createExtensionCard(ext) {
        const card = document.createElement('div');
        card.className = 'extension-card';
        card.dataset.extId = ext.id;

        const isLoaded = loadedExtensions.has(ext.extensionId);

        // 已加载图标
        if (isLoaded) {
            const check = document.createElement('span');
            check.className = 'card-loaded-check';
            check.title = '已加载';
            check.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
            card.appendChild(check);
        }

        // 封面图片
        if (ext.iconURL) {
            const img = document.createElement('img');
            img.className = 'card-cover';
            img.src = ext.iconURL;
            img.alt = ext.name;
            img.draggable = false;
            img.crossOrigin = 'anonymous';
            img.onerror = function () {
                this.style.display = 'none';
                const placeholder = card.querySelector('.card-cover-placeholder') || createCoverPlaceholder();
                card.insertBefore(placeholder, card.firstChild);
            };
            card.appendChild(img);
        } else {
            card.appendChild(createCoverPlaceholder());
        }

        // 卡片内容
        const body = document.createElement('div');
        body.className = 'card-body';

        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = ext.name;
        body.appendChild(name);

        const desc = document.createElement('div');
        desc.className = 'card-description';
        desc.textContent = ext.description;
        body.appendChild(desc);

        const author = document.createElement('div');
        author.className = 'card-author';
        author.textContent = __('author.prefix') + ext.author;
        body.appendChild(author);

        card.appendChild(body);

        // 卡片底部（安全标签）
        const footer = document.createElement('div');
        footer.className = 'card-footer';

        const tag = document.createElement('span');
        if (ext.reviewStatus === 'approved') {
            tag.className = 'safety-tag safety-tag--safe';
            tag.textContent = __('safety.approved');
        } else {
            tag.className = 'safety-tag safety-tag--danger';
            tag.textContent = __('safety.unreviewed');
        }
        footer.appendChild(tag);

        // 上传日期
        if (ext.uploadDate) {
            const date = document.createElement('span');
            date.style.cssText = 'font-size:0.6875rem;color:var(--text-muted);margin-left:auto;';
            date.textContent = new Date(ext.uploadDate).toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US');
            footer.appendChild(date);
        }

        card.appendChild(footer);

        // 详细信息按钮（小图标）
        const detailBtn = document.createElement('button');
        detailBtn.className = 'card-detail-icon';
        detailBtn.title = __('detail.detailBtn');
        detailBtn.setAttribute('aria-label', __('detail.detailBtn'));
        detailBtn.innerHTML = '<svg t="1787200792517" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6608" width="18" height="18"><path d="M755.57 354.669h-487.473c-22.452 0-40.622 18.17-40.622 40.622s18.171 40.621 40.622 40.621h487.473c22.454 0 40.621-18.169 40.621-40.621s-18.166-40.622-40.621-40.622zM755.57 192.178h-487.473c-22.452 0-40.622 18.17-40.622 40.622s18.171 40.622 40.622 40.622h487.473c22.454 0 40.621-18.171 40.621-40.622 0-22.453-18.166-40.622-40.621-40.622zM958.683 674.301v-563.369c0-44.867-36.374-81.245-81.245-81.245h-731.21c-44.866 0-81.245 36.379-81.245 81.245v812.454c0 44.869 36.38 81.247 81.245 81.247h479.19c12.915 2.64 26.864-1.045 36.886-11.069l284.876-284.875c9.38-9.382 13.213-22.199 11.503-34.389zM674.324 866.659v-146.385h146.386l-146.386 146.385zM877.437 639.027h-243.737c-22.45 0-40.621 18.171-40.621 40.624 0 0.073 0.004 0.146 0.005 0.219-0.001 0.073-0.005 0.146-0.005 0.219v243.299h-406.227c-22.45 0-40.622-18.169-40.622-40.621v-731.21c0-22.452 18.172-40.622 40.622-40.622h649.962c22.454 0 40.622 18.171 40.622 40.622v487.472z" fill="currentColor" p-id="6609"></path></svg>';
        detailBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showDetail(ext);
        });
        card.appendChild(detailBtn);

        // 文档链接和示例作品
        if (ext.docsURI || ext.sampleProject) {
            const links = document.createElement('div');
            links.className = 'card-links';
            if (ext.docsURI) {
                const a = document.createElement('a');
                a.href = ext.docsURI;
                a.target = '_blank';
                a.rel = 'noreferrer';
                a.textContent = __('link.docs');
                a.onclick = function (e) { e.stopPropagation(); };
                links.appendChild(a);
            }
            if (ext.sampleProject) {
                const a = document.createElement('a');
                a.href = ext.sampleProject;
                a.target = '_blank';
                a.rel = 'noreferrer';
                a.textContent = __('link.sample');
                a.onclick = function (e) { e.stopPropagation(); };
                links.appendChild(a);
            }
            card.appendChild(links);
        }

        // 点击事件
        card.addEventListener('click', function () {
            handleExtensionClick(ext);
        });

        return card;
    }

    function createCoverPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'card-cover-placeholder';
        placeholder.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
        return placeholder;
    }

    function updateCardLoadedState(extensionId) {
        const cards = grid.querySelectorAll('.extension-card');
        for (const card of cards) {
            const ext = extensions.find(e => e.extensionId === extensionId);
            if (ext && card.dataset.extId === ext.id) {
                if (!card.querySelector('.card-loaded-check')) {
                    const check = document.createElement('span');
                    check.className = 'card-loaded-check';
                    check.title = '已加载';
                    check.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';
                    card.insertBefore(check, card.firstChild);
                }
                // 哪个扩展加载出来就把它排到最前面优先显示
                if (grid.firstElementChild && grid.firstElementChild !== card) {
                    grid.insertBefore(card, grid.firstElementChild);
                }
            }
        }
    }

    // ===== 扩展点击处理 =====
    function handleExtensionClick(ext) {
        if (loadedExtensions.has(ext.extensionId)) {
            showToast(__('toast.loaded'), 'info');
            return;
        }

        if (ext.reviewStatus === 'approved') {
            // 已审核扩展，直接加载
            loadExtension(ext);
        } else {
            // 未审核扩展，显示警告
            showWarning(ext);
        }
    }

    function showWarning(ext) {
        warningModal.style.display = 'flex';

        // Update warning modal text with current language
        const warningTitle = warningModal.querySelector('.warning-header h2');
        const warningBody = warningModal.querySelectorAll('.warning-body p');
        if (warningTitle) warningTitle.textContent = __('warning.title');
        if (warningBody[0]) warningBody[0].innerHTML = __('warning.unreviewed');
        if (warningBody[1]) warningBody[1].textContent = __('warning.disclaimer');
        if (warningBody[2]) warningBody[2].textContent = __('warning.hint');

        const confirmBtn = $('warningConfirmBtn');
        const cancelBtn = $('warningCancelBtn');
        confirmBtn.textContent = __('warning.confirm');
        cancelBtn.textContent = __('warning.cancel');

        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newCancel.addEventListener('click', function () {
            warningModal.style.display = 'none';
        });

        newConfirm.addEventListener('click', function () {
            warningModal.style.display = 'none';
            loadExtension(ext);
        });

        // 点击遮罩层关闭
        warningModal.addEventListener('click', function (e) {
            if (e.target === warningModal) {
                warningModal.style.display = 'none';
            }
        });
    }

    // ===== 扩展详细信息弹窗 =====
    function showDetail(ext) {
        const modal = $('detailModal');
        const titleEl = $('detailTitle');
        const bodyEl = $('detailBody');
        if (!modal || !bodyEl) return;

        titleEl.textContent = __('detail.title');

        const isApproved = ext.reviewStatus === 'approved';
        const statusText = isApproved ? __('detail.status.approved') : __('detail.status.unreviewed');
        const statusClass = isApproved ? 'safety-tag safety-tag--safe' : 'safety-tag safety-tag--danger';

        // 图片预览
        let coverHtml = '';
        if (ext.iconURL) {
            coverHtml =
                '<div class="detail-cover">' +
                '<img src="' + ext.iconURL + '" alt="' + escapeHtml(ext.name) + '" onerror="this.style.display=\'none\'">' +
                '</div>';
        }

        // 字段行（可复制 URL）
        const rows = [
            { label: __('detail.name'), value: ext.name, copy: false },
            { label: __('detail.author'), value: ext.author, copy: false },
            { label: __('detail.extId'), value: ext.id, copy: true },
            { label: __('detail.iconURL'), value: ext.iconURL || '', copy: true },
            { label: __('detail.extURL'), value: ext.extensionURL || '', copy: true },
            { label: __('detail.docsURI'), value: ext.docsURI || '', copy: true },
            { label: __('detail.sample'), value: ext.sampleProject || '', copy: true },
            { label: __('detail.uploadDate'), value: ext.uploadDate ? new Date(ext.uploadDate).toLocaleString(currentLang === 'zh' ? 'zh-CN' : 'en-US') : '', copy: false }
        ];

        let rowsHtml = '';
        rows.forEach(function (row) {
            if (!row.value) return;
            rowsHtml += '<div class="detail-row">';
            rowsHtml += '<div class="detail-row-label">' + row.label + '</div>';
            rowsHtml += '<div class="detail-row-value">';
            if (row.copy) {
                rowsHtml += '<code class="detail-url" title="' + escapeHtml(row.value) + '">' + escapeHtml(row.value) + '</code>';
                rowsHtml += '<button class="detail-copy-btn" data-copy="' + escapeAttr(row.value) + '">' + __('detail.copy') + '</button>';
            } else {
                rowsHtml += '<span>' + escapeHtml(row.value) + '</span>';
            }
            rowsHtml += '</div>';
            rowsHtml += '</div>';
        });

        bodyEl.innerHTML =
            coverHtml +
            '<div class="detail-status-row"><span class="' + statusClass + '">' + statusText + '</span></div>' +
            rowsHtml +
            '<div class="detail-row">' +
            '<div class="detail-row-label">' + __('detail.description') + '</div>' +
            '<div class="detail-row-value"><p class="detail-desc">' + escapeHtml(ext.description || '') + '</p></div>' +
            '</div>';

        // 绑定复制按钮
        bodyEl.querySelectorAll('.detail-copy-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const text = btn.getAttribute('data-copy');
                copyText(text).then(function () {
                    const original = btn.textContent;
                    btn.textContent = __('detail.copied');
                    setTimeout(function () { btn.textContent = original; }, 1500);
                });
            });
        });

        modal.style.display = 'flex';
    }

    function closeDetailModal() {
        const modal = $('detailModal');
        if (modal) modal.style.display = 'none';
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            resolve();
        });
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(str) {
        return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function loadExtension(ext) {
        showToast(__('toast.loading', {name: ext.name}), 'info');
        sendToEditor('loadExtension', {
            extensionURL: ext.extensionURL,
            extensionId: ext.extensionId || ext.id,
            name: ext.name
        });
    }

    // ===== 上传扩展 =====
    let selectedJsFile = null;
    let selectedIconFile = null;

    // 文件输入预览
    $('extJsFile').addEventListener('change', function () {
        selectedJsFile = this.files[0];
        const label = this.parentElement.querySelector('.file-input-label');
        if (selectedJsFile) {
            label.textContent = selectedJsFile.name;
            label.style.borderColor = 'var(--success-color)';
            label.style.color = 'var(--success-color)';
        } else {
            label.textContent = '选择 .js 文件';
            label.style.borderColor = '';
            label.style.color = '';
        }
    });

    $('extIconFile').addEventListener('change', function () {
        selectedIconFile = this.files[0];
        const label = this.parentElement.querySelector('.file-input-label');
        const preview = $('iconPreview');
        const previewImg = $('iconPreviewImg');

        if (selectedIconFile) {
            label.textContent = selectedIconFile.name;
            label.style.borderColor = 'var(--success-color)';
            label.style.color = 'var(--success-color)';
            // 预览图片
            const reader = new FileReader();
            reader.onload = function (e) {
                previewImg.src = e.target.result;
                preview.style.display = 'flex';
            };
            reader.readAsDataURL(selectedIconFile);
        } else {
            label.textContent = '选择图片文件';
            label.style.borderColor = '';
            label.style.color = '';
            preview.style.display = 'none';
        }
    });

    function openUploadModal() {
        uploadModal.style.display = 'flex';
        // 重置表单
        $('extName').value = '';
        $('extAuthor').value = '';
        $('extDescription').value = '';
        $('extDocs').value = '';
        $('extSample').value = '';
        $('extJsFile').value = '';
        $('extIconFile').value = '';
        $('iconPreview').style.display = 'none';
        selectedJsFile = null;
        selectedIconFile = null;
        // 重置文件输入标签
        document.querySelectorAll('.file-input-label').forEach(el => {
            el.textContent = el.closest('.form-group').querySelector('label').textContent.includes('JS')
                ? __('upload.selectJs')
                : __('upload.selectIcon');
            el.style.borderColor = '';
            el.style.color = '';
        });
    }

    function closeUploadModal() {
        uploadModal.style.display = 'none';
    }
    window.closeUploadModal = closeUploadModal;

    // ===== 人机验证 =====
    function verifyCaptcha() {
        return new Promise((resolve, reject) => {
            const captchaModal = $('captchaModal');
            const container = $('captchaContainer');
            const capWidget = document.createElement('cap-widget');
            capWidget.setAttribute('data-cap-api-endpoint', 'https://captcha.gurl.eu.org/api/');
            capWidget.setAttribute('id', 'cap-widget');
            container.innerHTML = '';
            container.appendChild(capWidget);

            let solved = false;

            function onSolve(e) {
                if (solved) return;
                solved = true;
                const token = e.detail.token;
                // 验证 token
                fetch('https://captcha.gurl.eu.org/api/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token, keepToken: false })
                })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (result.success) {
                        captchaModal.style.display = 'none';
                        container.innerHTML = '';
                        resolve();
                    } else {
                        solved = false;
                        showToast('验证失败，请重试', 'error');
                        resetCaptcha();
                    }
                })
                .catch(function () {
                    solved = false;
                    showToast('验证服务异常，请重试', 'error');
                    resetCaptcha();
                });
            }

            function resetCaptcha() {
                container.innerHTML = '';
                const newWidget = document.createElement('cap-widget');
                newWidget.setAttribute('data-cap-api-endpoint', 'https://captcha.gurl.eu.org/api/');
                newWidget.setAttribute('id', 'cap-widget');
                container.appendChild(newWidget);
            }

            capWidget.addEventListener('solve', onSolve);
            captchaModal.style.display = 'flex';

            // 点击遮罩层关闭验证
            captchaModal.addEventListener('click', function (e) {
                if (e.target === captchaModal) {
                    captchaModal.style.display = 'none';
                    container.innerHTML = '';
                    capWidget.removeEventListener('solve', onSolve);
                    reject(new Error('用户取消验证'));
                }
            });
        });
    }

    async function submitUpload() {
        const name = $('extName').value.trim();
        const author = $('extAuthor').value.trim();
        const description = $('extDescription').value.trim();
        const docsURI = $('extDocs').value.trim();
        const sampleProject = $('extSample').value.trim();

        if (!name) { showToast(__('upload.name.required'), 'error'); return; }
        if (!author) { showToast(__('upload.author.required'), 'error'); return; }
        if (!description) { showToast(__('upload.desc.required'), 'error'); return; }
        if (!selectedJsFile) { showToast(__('upload.js.required'), 'error'); return; }
        if (!selectedIconFile) { showToast(__('upload.icon.required'), 'error'); return; }

        // 人机验证
        try {
            await verifyCaptcha();
        } catch (e) {
            return; // 用户取消验证
        }

        const submitBtn = $('uploadSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = __('upload.uploading');

        try {
            const extId = 'ext_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
            const extDir = `${EXTENSIONS_PATH}/${extId}`;

            // 读取文件内容
            const jsContent = await readFileAsArrayBuffer(selectedJsFile);
            const iconContent = await readFileAsArrayBuffer(selectedIconFile);

            const jsBase64 = arrayBufferToBase64(jsContent);
            const iconBase64 = arrayBufferToBase64(iconContent);

            // 获取文件扩展名
            const jsExt = selectedJsFile.name.split('.').pop() || 'js';
            const iconExt = selectedIconFile.name.split('.').pop() || 'png';
            const jsFileName = `extension.${jsExt}`;
            const iconFileName = `icon.${iconExt}`;

            // 构建 meta.json
            const meta = {
                name: name,
                author: author,
                description: description,
                extensionId: extId,
                extensionFile: jsFileName,
                iconFile: iconFileName,
                docsURI: docsURI || '',
                sampleProject: sampleProject || '',
                reviewStatus: 'unreviewed',
                uploadDate: new Date().toISOString()
            };
            const metaContent = JSON.stringify(meta, null, 2);
            const metaBase64 = stringToBase64(metaContent);

            // 1) 获取当前 HEAD 引用
            const refData = await githubWrite('/git/refs/heads/main', 'GET');
            const headSha = refData.object.sha;

            // 2) 获取基础树
            const commitData = await githubWrite(`/git/commits/${headSha}`, 'GET');
            const baseTreeSha = commitData.tree.sha;

            // 3) 创建三个 blob
            const [jsBlob, iconBlob, metaBlob] = await Promise.all([
                githubWrite('/git/blobs', 'POST', { content: jsBase64, encoding: 'base64' }),
                githubWrite('/git/blobs', 'POST', { content: iconBase64, encoding: 'base64' }),
                githubWrite('/git/blobs', 'POST', { content: metaBase64, encoding: 'base64' })
            ]);

            // 4) 创建新树
            const newTree = await githubWrite('/git/trees', 'POST', {
                base_tree: baseTreeSha,
                tree: [
                    { path: `${extDir}/${jsFileName}`, mode: '100644', type: 'blob', sha: jsBlob.sha },
                    { path: `${extDir}/${iconFileName}`, mode: '100644', type: 'blob', sha: iconBlob.sha },
                    { path: `${extDir}/meta.json`, mode: '100644', type: 'blob', sha: metaBlob.sha }
                ]
            });

            // 5) 创建提交
            const newCommit = await githubWrite('/git/commits', 'POST', {
                message: `Upload experiment extension: ${name} by ${author}`,
                tree: newTree.sha,
                parents: [headSha]
            });

            // 6) 更新 main 分支引用
            await githubWrite('/git/refs/heads/main', 'PATCH', { sha: newCommit.sha, force: false });

            showToast(__('toast.upload.success'), 'success');
            closeUploadModal();
            // 重新加载扩展列表
            await loadExtensions();
        } catch (err) {
            console.error('Upload failed:', err);
            showToast(__('toast.upload.fail', {msg: err.message}), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = __('upload.submit');
        }
    }
    window.submitUpload = submitUpload;

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsArrayBuffer(file);
        });
    }

    // ===== Toast 提示 =====
    function showToast(message, type) {
        toast.textContent = message;
        toast.className = 'toast toast--' + (type || 'info');
        toast.style.display = 'block';
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(function () {
            toast.style.display = 'none';
        }, 3000);
    }

    // ===== 搜索和过滤 =====
    searchInput.addEventListener('input', function () {
        searchQuery = this.value;
        renderExtensions();
    });

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderExtensions();
        });
    });

    // ===== 上传按钮 =====
    uploadBtn.addEventListener('click', openUploadModal);

    // 点击遮罩层关闭上传弹窗
    uploadModal.addEventListener('click', function (e) {
        if (e.target === uploadModal) {
            closeUploadModal();
        }
    });

    // ===== 初始化 =====
    // 通知编辑器 iframe 已就绪
    function notifyReady() {
        sendToEditor('plazaReady');
    }

    // 等待 DOM 完全加载后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        notifyReady();
        // Initialize theme toggle
        initThemeToggle();
        // Apply current language
        setLang(currentLang);
        // Language toggle button
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.addEventListener('click', function () {
                setLang(currentLang === 'zh' ? 'en' : 'zh');
            });
        }

        // 详细信息弹窗关闭事件
        const detailModal = $('detailModal');
        if (detailModal) {
            const closeBtn = $('detailCloseBtn');
            const closeFooterBtn = $('detailCloseFooterBtn');
            if (closeBtn) closeBtn.addEventListener('click', closeDetailModal);
            if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeDetailModal);
            detailModal.addEventListener('click', function (e) {
                if (e.target === detailModal) closeDetailModal();
            });
        }

        loadExtensions();
    }
})();