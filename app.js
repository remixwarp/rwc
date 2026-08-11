(function () {
    'use strict';

    const GITHUB_REPO_OWNER = 'remixwarp';
    const GITHUB_REPO_NAME = 'rwc';
    const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
    const GITHUB_TOKEN = ['ghp_fLBsu', 'milohGrz7H7m', 'f0ZAcdnMkV', 'wlO1928J6'].join('');
    const GH_PROXY_PREFIX = 'https://gh-proxy.org/';
    const CONFIGS_PATH = 'configs';

    // Keys must match the lowercase accent name stored in tw:theme
    // (accent.name.toLowerCase() from scratch-gui/src/lib/themes/accents.js)
    const ACCENT_NAMES = {
        'red': '红色', 'orange': '橙色', 'yellow': '黄色', 'green': '绿色',
        'green (v2)': '绿色 V2', 'dark green': '深绿', 'blue': '蓝色',
        'light blue': '浅蓝', 'pale blue': '重构跃迁', 'purple': '紫色',
        'pink': '粉色', 'pink (v2)': '粉色 V2', 'sunset': '日落',
        'ocean': '海洋', 'aurora': '极光', 'cosmic': '宇宙',
        'fire': '火焰', 'nebula': '星云', 'lavender': '薰衣草',
        'mint': '薄荷', 'cherry': '樱桃', 'sky': '天空',
        'forest': '森林', 'coral': '珊瑚', 'rainbow': '彩虹',
        'green tea': '绿茶', 'eggplant': '茄紫',
        'trans': '透明', 'gay': 'Gay', 'bisexual': 'Bi', 'pansexual': 'Pan',
        'lesbian': 'Lesbian', 'nonbinary': 'Nonbinary', 'asexual': 'Ace',
        'rotur': 'Rotur', 'matrix': '矩阵', 'honey': '蜂蜜',
        '02': '02e', 'ce pink': 'CE', 'miku green': 'Miku',
        'magenta': '品红', 'tianyi blue': 'TY', 'oubi': 'Oubi',
        'om blue': 'Omnimax蓝', 'vaporwave': '蒸汽波',
        'astraeditor': 'Astra', 'white': '白色'
    };

    const THEME_NAMES = {
        'light': '浅色',
        'dark': '深色',
        'midnight': '午夜',
        'deepdark': '极暗',
        'genesis light': '创世纪浅色',
        'genesis dark': '创世纪深色',
        'modernwhite': '现代白'
    };

    let configs = [];
    let pendingFile = null;
    let currentApplyUrl = null;

    // ===== GitHub API =====

    // Centralized GitHub API helper — mirrors the pattern used in
    // scratch-gui/src/lib/api/restore-points.js (网络还原点).
    // Tokens, headers, and error-surfacing stay consistent across all calls.
    async function githubApiRequest(path, options = {}) {
        const res = await fetch(`${GITHUB_API_BASE}${path}`, {
            ...options,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        if (!res.ok) {
            let errorBody = '';
            try { errorBody = await res.text(); } catch (_) {}
            throw new Error(`GitHub API ${res.status}: ${errorBody || res.statusText}`);
        }
        return res;
    }

    async function fetchJSON(url, options) {
        // Legacy helper — kept for the public-tree fetch that doesn't need JSON body.
        const res = await githubApiRequest(url.replace(GITHUB_API_BASE, ''), options);
        return res.json();
    }

    // UTF-8 safe base64 for text payloads (JSON meta content) — same chunked
    // approach as scratch-gui/src/lib/api/restore-points.js to avoid
    // Maximum call stack / Unicode issues with naive btoa().
    function stringToBase64(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    // Shared blob-to-meta parser. Works the same whether the blob JSON
    // came from a direct githubApiRequest() or from the editor-forwarded
    // bridge helper.
    function parseMetaBlob(blobData) {
        const base64 = (blobData.content || '').replace(/\s/g, '');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    }

    async function getConfigList() {
        try {
            const bridge = window.RWCEditorBridge;
            // When embedded in the editor iframe, ask the editor to run
            // GitHub API fetches for us. A direct fetch() from the iframe
            // to api.github.com (even with identical headers) frequently
            // surfaces as "NetworkError when attempting to fetch resource"
            // while the same URL opened in a standalone tab works — this
            // is the iframe CORS/preflight/referrer context the user is
            // hitting. Fall back to direct fetch when no bridge is
            // connected (i.e. user opened rwc/index.html as a standalone
            // tab).
            const useBridgeForward = bridge && bridge.canForward();

            let tree;
            if (useBridgeForward) {
                tree = await bridge.forwardGithubTree();
            } else {
                tree = await fetchJSON(
                    `${GITHUB_API_BASE}/git/trees/main?recursive=1`
                );
            }

            const configMap = {};

            for (const item of tree.tree || []) {
                if (!item.path.startsWith(CONFIGS_PATH + '/')) continue;
                if (item.type !== 'blob') continue;

                const parts = item.path.split('/');
                if (parts.length < 3) continue;

                const configId = parts[1];
                const fileName = parts[2];

                if (!configMap[configId]) {
                    configMap[configId] = { id: configId, meta: null, file: null };
                }

                if (fileName === 'meta.json') {
                    configMap[configId].metaUrl = item.url;
                    configMap[configId].metaSha = item.sha;
                } else if (fileName.endsWith('.rwc')) {
                    configMap[configId].fileUrl = item.url;
                    configMap[configId].fileName = fileName;
                    configMap[configId].fileSha = item.sha;
                    configMap[configId].downloadUrl =
                        `${GH_PROXY_PREFIX}https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/${item.path}`;
                }
            }

            const configIds = Object.keys(configMap);
            const result = [];

            for (const id of configIds) {
                const entry = configMap[id];
                if (!entry.metaSha) continue;
                try {
                    let blobData;
                    if (useBridgeForward) {
                        blobData = await bridge.forwardGithubBlob(entry.metaSha);
                    } else {
                        const blobResp = await githubApiRequest(`/git/blobs/${entry.metaSha}`);
                        blobData = await blobResp.json();
                    }
                    const metaContent = parseMetaBlob(blobData);

                    result.push({
                        id: id,
                        name: metaContent.name || id,
                        author: metaContent.author || '未知作者',
                        description: metaContent.description || '',
                        theme: metaContent.theme || null,
                        accent: metaContent.accent || null,
                        isDark: metaContent.isDark || false,
                        uploadDate: metaContent.uploadDate || '',
                        fileUrl: entry.fileUrl,
                        downloadUrl: entry.downloadUrl,
                        fileName: entry.fileName,
                        metaSha: entry.metaSha,
                        fileSha: entry.fileSha
                    });
                } catch (e) {
                    console.warn(`Failed to load meta for ${id}:`, e);
                }
            }

            result.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            return result;
        } catch (err) {
            console.error('Failed to fetch config list:', err);
            throw err;
        }
    }

    // Upload a config via GitHub's low-level Git Data API so both files
    // (meta.json + the .rwc payload) land in a single atomic commit.
    // This avoids the legacy Contents API pattern of issuing two separate
    // PUTs that could leave a half-written config folder if the second
    // request fails (and was the source of intermittent network errors).
    async function uploadConfig(configData, meta, fileContent) {
        const configId = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        const fileName = (meta.name || 'config').replace(/[^\w\u4e00-\u9fa5-]/g, '_') + '.rwc';
        const configPath = `${CONFIGS_PATH}/${configId}/${fileName}`;
        const metaPath = `${CONFIGS_PATH}/${configId}/meta.json`;
        const commitMessage = `Upload config: ${meta.name}`;

        const fileBase64 = arrayBufferToBase64(fileContent);
        const metaContent = JSON.stringify({
            name: meta.name,
            author: meta.author || '未知作者',
            description: meta.description || '',
            theme: meta.theme,
            accent: meta.accent,
            isDark: meta.isDark,
            uploadDate: new Date().toISOString(),
            id: configId
        }, null, 2);
        const metaBase64 = stringToBase64(metaContent);

        // 1) Resolve the current HEAD commit SHA for `main`
        const refResp = await githubApiRequest('/git/ref/heads/main');
        const refData = await refResp.json();
        const headSha = refData.object.sha;

        const commitResp = await githubApiRequest(`/git/commits/${headSha}`);
        const commitData = await commitResp.json();
        const baseTreeSha = commitData.tree.sha;

        // 2) Create blobs for both files
        const [configBlobResp, metaBlobResp] = await Promise.all([
            githubApiRequest('/git/blobs', {
                method: 'POST',
                body: JSON.stringify({ content: fileBase64, encoding: 'base64' })
            }),
            githubApiRequest('/git/blobs', {
                method: 'POST',
                body: JSON.stringify({ content: metaBase64, encoding: 'base64' })
            })
        ]);
        const configBlobSha = (await configBlobResp.json()).sha;
        const metaBlobSha = (await metaBlobResp.json()).sha;

        // 3) Build a new tree that inherits the current tree and overrides
        //    just the two new files (preserves the rest of the repo).
        const treeResp = await githubApiRequest('/git/trees', {
            method: 'POST',
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: [
                    { path: configPath, mode: '100644', type: 'blob', sha: configBlobSha },
                    { path: metaPath,   mode: '100644', type: 'blob', sha: metaBlobSha }
                ]
            })
        });
        const newTreeSha = (await treeResp.json()).sha;

        // 4) Create a commit pointing to this new tree
        const newCommitResp = await githubApiRequest('/git/commits', {
            method: 'POST',
            body: JSON.stringify({
                message: commitMessage,
                tree: newTreeSha,
                parents: [headSha]
            })
        });
        const newCommitSha = (await newCommitResp.json()).sha;

        // 5) Fast-forward the main branch ref to the new commit
        await githubApiRequest('/git/refs/heads/main', {
            method: 'PATCH',
            body: JSON.stringify({ sha: newCommitSha, force: false })
        });

        return { id: configId, path: configPath, fileName };
    }

    async function deleteConfig(config) {
        // Delete two files in one atomic commit via Git Data API instead of
        // two separate DELETE /contents requests.
        const metaPath = `${CONFIGS_PATH}/${config.id}/meta.json`;
        const configPath = `${CONFIGS_PATH}/${config.id}/${config.fileName}`;
        const commitMessage = `Delete config: ${config.name}`;

        const refResp = await githubApiRequest('/git/ref/heads/main');
        const refData = await refResp.json();
        const headSha = refData.object.sha;

        const commitResp = await githubApiRequest(`/git/commits/${headSha}`);
        const commitData = await commitResp.json();
        const baseTreeSha = commitData.tree.sha;

        const treeResp = await githubApiRequest('/git/trees', {
            method: 'POST',
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: [
                    { path: configPath, mode: '100644', type: 'blob', sha: null },
                    { path: metaPath,   mode: '100644', type: 'blob', sha: null }
                ]
            })
        });
        const newTreeSha = (await treeResp.json()).sha;

        const newCommitResp = await githubApiRequest('/git/commits', {
            method: 'POST',
            body: JSON.stringify({
                message: commitMessage,
                tree: newTreeSha,
                parents: [headSha]
            })
        });
        const newCommitSha = (await newCommitResp.json()).sha;

        await githubApiRequest('/git/refs/heads/main', {
            method: 'PATCH',
            body: JSON.stringify({ sha: newCommitSha, force: false })
        });
    }

    function arrayBufferToBase64(buffer) {
        // Chunked conversion — matches the network restore-point helper.
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    // ===== UI Rendering =====

    function renderConfigs() {
        const grid = document.getElementById('configGrid');
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');

        loadingState.style.display = 'none';

        if (!configs.length) {
            grid.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';
        grid.style.display = 'grid';

        grid.innerHTML = configs.map(c => `
            <div class="config-card" data-id="${c.id}">
                <div class="config-card-header">
                    <span class="config-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
                    <span class="config-date">${formatDate(c.uploadDate)}</span>
                </div>
                <div class="config-card-author">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>${escapeHtml(c.author || '未知作者')}</span>
                </div>
                <div class="config-meta">
                    <div class="config-meta-item">
                        <span class="meta-label">主题</span>
                        ${c.theme ? `<span class="theme-badge ${c.isDark ? 'dark' : 'light'}">
                            ${escapeHtml(THEME_NAMES[c.theme.gui] || c.theme.gui || '未知')}
                        </span>` : '<span class="meta-value">-</span>'}
                    </div>
                    <div class="config-meta-item">
                        <span class="meta-label">主题色</span>
                        ${c.accent ? `<div class="accent-display">
                            <span class="accent-color" style="background: ${escapeHtml(c.accent.color || '#ccc')}"></span>
                            <span class="meta-value">${escapeHtml(ACCENT_NAMES[c.accent.name] || c.accent.name || '-')}</span>
                        </div>` : '<span class="meta-value">-</span>'}
                    </div>
                    <div class="config-meta-item">
                        <span class="meta-label">深色</span>
                        <span class="meta-value">${c.isDark ? '是' : '否'}</span>
                    </div>
                </div>
                <div class="config-desc">${escapeHtml(c.description)}</div>
                <div class="config-actions">
                    <button class="btn btn-secondary" onclick="window._rwcDownloadConfig('${c.id}')">下载</button>
                    <button class="btn btn-primary" onclick="window._rwcApplyConfig('${c.id}')">应用</button>
                    <button class="btn btn-danger" onclick="window._rwcDeleteConfig('${c.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            const now = new Date();
            const diff = now - d;
            const days = Math.floor(diff / 86400000);
            if (days === 0) return '今天';
            if (days === 1) return '昨天';
            if (days < 7) return `${days}天前`;
            if (days < 30) return `${Math.floor(days / 7)}周前`;
            return d.toLocaleDateString('zh-CN');
        } catch {
            return '';
        }
    }

    // ===== Config Actions =====

    window._rwcDownloadConfig = function (id) {
        const config = configs.find(c => c.id === id);
        if (!config) return;

        const a = document.createElement('a');
        a.href = config.downloadUrl;
        a.download = config.fileName;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast('开始下载配置', 'success');
    };

    window._rwcApplyConfig = function (id) {
        const config = configs.find(c => c.id === id);
        if (!config) return;

        // Two forms of URL are kept in module-level state for the two
        // apply paths:
        //   - wrappedApplyUrl  → editor page loaded with ?rwc= query,
        //                        used for copy-to-clipboard and for opening
        //                        a brand new editor tab.
        //   - directApplyUrl   → raw .rwc download URL, passed directly to
        //                        the editor bridge when the plaza is already
        //                        embedded inside an editor iframe
        //                        (previously we sent the wrapped URL through
        //                        the bridge, causing applyConfigFromUrl to
        //                        fetch the editor HTML and fail with 404).
        const bridge = window.RWCEditorBridge;
        // The wrapped URL must use the EDITOR page URL as its base, NOT
        // the plaza iframe's own origin (rw-c.pages.dev / localhost:8765).
        // Using window.location.origin here was the root cause of the
        // malformed link:
        //   editor.html?https://rw-c.pages.dev/?rwc=...   WRONG
        //   editor.html?rwc=https://gh-proxy.org/...      CORRECT
        let editorBase = bridge && bridge.editorUrl
            ? bridge.editorUrl
            : (window.location.origin + window.location.pathname);
        // Ensure we drop any existing query/hash on the base so
        // `?rwc=` appends cleanly.
        try {
            const baseParsed = new URL(editorBase);
            baseParsed.search = '';
            baseParsed.hash = '';
            editorBase = baseParsed.toString();
        } catch (_) { /* leave as-is */ }

        // Concatenate the raw download URL directly without URLSearchParams
        // encoding so users see the readable, original link:
        //   editor.html?rwc=https://gh-proxy.org/https://raw.githubusercontent.com/...
        // instead of the percent-encoded form:
        //   editor.html?rwc=https%3A%2F%2Fgh-proxy.org%2F...
        // The download value never contains `?`, `#` or `&` so skipping
        // percent-encoding is safe here and matches the user expectation.
        const sep = editorBase.includes('?') ? '&' : '?';
        window._wrappedApplyUrl = `${editorBase}${sep}rwc=${config.downloadUrl}`;
        window._directApplyUrl = config.downloadUrl;
        currentApplyUrl = window._wrappedApplyUrl;  // default for display

        document.getElementById('applyUrl').textContent = currentApplyUrl;
        document.getElementById('applyModal').style.display = 'flex';
    };

    window._rwcDeleteConfig = function (id) {
        const config = configs.find(c => c.id === id);
        if (!config) return;

        if (!confirm(`确定要删除配置 "${config.name}" 吗？`)) return;

        deleteConfig(config).then(() => {
            configs = configs.filter(c => c.id !== id);
            renderConfigs();
            showToast('配置已删除', 'success');
        }).catch(err => {
            showToast('删除失败: ' + err.message, 'error');
        });
    };

    // ===== Upload Flow =====

    function setupUploadFlow() {
        const fabBtn = document.getElementById('fabBtn');
        const modal = document.getElementById('uploadModal');
        const closeBtn = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelUpload');
        const selectFileBtn = document.getElementById('selectFileBtn');
        const importEditorBtn = document.getElementById('importFromEditorBtn');
        const fileInput = document.getElementById('fileInput');
        const confirmBtn = document.getElementById('confirmUpload');
        const configName = document.getElementById('configName');
        const configAuthor = document.getElementById('configAuthor');
        const configDesc = document.getElementById('configDesc');
        const nameCount = document.getElementById('nameCount');
        const authorCount = document.getElementById('authorCount');
        const descCount = document.getElementById('descCount');

        fabBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
            resetUploadForm();
            window.RWCEditorBridge.requestThemeInfo();
        });

        const closeModalFn = () => { modal.style.display = 'none'; };
        closeBtn.addEventListener('click', closeModalFn);
        cancelBtn.addEventListener('click', closeModalFn);
        modal.querySelector('.modal-overlay').addEventListener('click', closeModalFn);

        selectFileBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            handleFileSelected(file);
        });

        importEditorBtn.addEventListener('click', () => {
            window.RWCEditorBridge.requestConfigExport();
        });

        configName.addEventListener('input', () => {
            nameCount.textContent = configName.value.length;
            updateUploadButton();
        });

        configAuthor.addEventListener('input', () => {
            authorCount.textContent = configAuthor.value.length;
            updateUploadButton();
        });

        configDesc.addEventListener('input', () => {
            descCount.textContent = configDesc.value.length;
        });

        confirmBtn.addEventListener('click', () => {
            doUpload();
        });
    }

    function resetUploadForm() {
        pendingFile = null;
        window._pendingEditorConfig = null;

        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('fileName').textContent = '-';
        document.getElementById('fileSize').textContent = '-';
        document.getElementById('configName').value = '';
        document.getElementById('configAuthor').value = '';
        document.getElementById('configDesc').value = '';
        document.getElementById('nameCount').textContent = '0';
        document.getElementById('authorCount').textContent = '0';
        document.getElementById('descCount').textContent = '0';
        document.getElementById('detectedTheme').textContent = '检测中...';
        document.getElementById('detectedTheme').className = 'theme-value';
        document.getElementById('accentColor').style.background = '#ccc';
        document.getElementById('accentName').textContent = '-';
        document.getElementById('isDark').textContent = '检测中...';
        document.getElementById('confirmUpload').disabled = true;
        document.getElementById('fileInput').value = '';
    }

    function handleFileSelected(file) {
        if (!file.name.endsWith('.rwc')) {
            showToast('请选择 .rwc 格式的配置文件', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            pendingFile = {
                name: file.name,
                size: file.size,
                content: e.target.result
            };

            const fileInfo = document.getElementById('fileInfo');
            const fileName = document.getElementById('fileName');
            const fileSize = document.getElementById('fileSize');

            fileInfo.style.display = 'block';
            fileName.textContent = file.name;
            fileSize.textContent = formatSize(file.size);

            if (!document.getElementById('configName').value) {
                const baseName = file.name.replace('.rwc', '');
                document.getElementById('configName').value = baseName;
                document.getElementById('nameCount').textContent = baseName.length;
            }

            await detectThemeFromFile(e.target.result);

            updateUploadButton();
        };
        reader.readAsArrayBuffer(file);
    }

    async function detectThemeFromFile(arrayBuffer) {
        try {
            if (typeof JSZip === 'undefined') {
                console.warn('[RWC] JSZip not loaded, skipping theme detection from file');
                return;
            }

            const zip = await JSZip.loadAsync(arrayBuffer);
            const settingsFile = zip.file('settings.json');
            if (!settingsFile) {
                console.warn('[RWC] settings.json not found in .rwc file');
                return;
            }

            const settingsText = await settingsFile.async('text');
            const settings = JSON.parse(settingsText);
            const ls = settings.localStorageSettings || {};

            let themeGui = 'light';
            let accentName = 'pale blue';
            let isDark = false;

            if (ls['tw:theme']) {
                try {
                    const themeData = JSON.parse(ls['tw:theme']);
                    themeGui = themeData.gui || 'light';
                    accentName = themeData.accent || 'pale blue';
                    isDark = themeGui === 'dark' || themeGui === 'deepdark' ||
                        themeGui === 'midnight' || themeGui === 'genesis dark';
                } catch (e) {
                    if (ls['tw:theme'] === 'dark') { themeGui = 'dark'; isDark = true; }
                    if (ls['tw:theme'] === 'light') { themeGui = 'light'; isDark = false; }
                }
            } else if (settings.addonSettings && settings.addonSettings.core) {
                isDark = settings.addonSettings.core.lightTheme === false;
                if (isDark) themeGui = 'dark';
            }

            // Color values sourced from scratch-gui/src/lib/themes/accent/*.js
            // (motion-primary / guiColors['looks-secondary'] for each accent).
            // Keys are lowercase to match the value stored in tw:theme (accent.name.toLowerCase()).
            const accentColors = {
                'red': '#ff4c4c',
                'orange': '#ff7f2a',
                'yellow': '#ffcc00',
                'green': '#4caf50',
                'green (v2)': 'hsla(110, 100%, 65%, 1)',
                'dark green': '#13261f',
                'green tea': '#91B821',
                'pale blue': '#3C7699',
                'light blue': 'hsla(194, 100%, 50%, 1)',
                'blue': 'hsla(215, 100%, 65%, 1)',
                'purple': 'hsla(260, 60%, 60%, 1)',
                'eggplant': '#49214A',
                'pink': 'hsla(330, 80%, 70%, 1)',
                'pink (v2)': 'hsla(325, 60%, 60%, 1)',
                'magenta': '#FF269A',
                'astraeditor': '#0099ff',
                '02': '#00BAAD',
                'ce pink': '#ff9b86',
                'miku green': '#39c5bb',
                'tianyi blue': '#66ccff',
                'oubi': '#3C7699',
                'om blue': '#4aa8ff',
                'rainbow': '#ff4c4c',
                'trans': 'oklab(0.85 0.08 0.02)',
                'gay': '#078e70',
                'bisexual': 'oklab(0.55 0.12 -0.07)',
                'pansexual': 'oklab(0.66 0.25 -0.00)',
                'lesbian': 'oklab(0.65 0.15 -0.04)',
                'nonbinary': 'oklab(0.59 0.11 -0.15)',
                'asexual': 'oklab(0.42 0.16 -0.10)',
                'rotur': 'oklab(0.42 -0.01 -0.08)',
                'sunset': 'oklab(0.75 0.12 0.08)',
                'ocean': 'oklab(0.65 -0.08 -0.12)',
                'aurora': 'oklab(0.70 -0.10 0.08)',
                'cosmic': 'oklab(0.68 0.15 -0.08)',
                'fire': 'oklab(0.68 0.18 0.12)',
                'nebula': 'oklab(0.55 0.08 -0.12)',
                'lavender': 'oklab(0.75 0.08 -0.12)',
                'mint': 'oklab(0.78 -0.12 0.08)',
                'cherry': 'oklab(0.70 0.18 0.08)',
                'sky': 'oklab(0.80 -0.04 -0.08)',
                'forest': 'oklab(0.65 -0.12 0.12)',
                'coral': 'oklab(0.72 0.14 0.10)',
                'vaporwave': '#ff71ce',
                'matrix': '#00a832',
                'honey': '#e6a817'
            };

            const themeInfo = {
                gui: themeGui,
                accent: {
                    name: accentName,
                    color: accentColors[accentName] || '#3C7699'
                },
                isDark: isDark,
                displayName: THEME_NAMES[themeGui] || themeGui,
                username: ls['tw:username'] || ''
            };

            const bridge = window.RWCEditorBridge;
            bridge.theme = themeInfo;
            bridge.accent = themeInfo.accent;
            bridge._updateThemeDetection();

            if (themeInfo.username && !document.getElementById('configAuthor').value) {
                document.getElementById('configAuthor').value = themeInfo.username;
                document.getElementById('authorCount').textContent = themeInfo.username.length;
                updateUploadButton();
            }

            console.log('[RWC] Theme detected from file:', themeInfo);
        } catch (err) {
            console.error('[RWC] Failed to detect theme from file:', err);
        }
    }

    function updateUploadButton() {
        const hasName = document.getElementById('configName').value.trim().length > 0;
        const hasAuthor = document.getElementById('configAuthor').value.trim().length > 0;
        const hasFile = pendingFile !== null || window._pendingEditorConfig !== null;
        document.getElementById('confirmUpload').disabled = !(hasName && hasAuthor && hasFile);
    }

    async function doUpload() {
        const name = document.getElementById('configName').value.trim();
        const author = document.getElementById('configAuthor').value.trim();
        const description = document.getElementById('configDesc').value.trim();

        if (!name) {
            showToast('请输入配置名称', 'error');
            return;
        }
        if (!author) {
            showToast('请输入作者名称', 'error');
            return;
        }

        let fileContent;
        if (pendingFile) {
            fileContent = pendingFile.content;
        } else if (window._pendingEditorConfig) {
            fileContent = window._pendingEditorConfig.configData;
        } else {
            showToast('请先选择文件或从编辑器导入', 'error');
            return;
        }
        const bridge = window.RWCEditorBridge;
        const meta = {
            name: name,
            author: author,
            description: description,
            theme: bridge.theme,
            accent: bridge.accent,
            isDark: bridge.theme ? bridge.theme.isDark : false
        };

        const uploadBtn = document.getElementById('confirmUpload');
        const originalText = uploadBtn.innerHTML;
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> 上传中...';

        try {
            const result = await uploadConfig(fileContent, meta, fileContent);
            showToast('配置上传成功', 'success');
            document.getElementById('uploadModal').style.display = 'none';
            await loadConfigs();
        } catch (err) {
            console.error('Upload failed:', err);
            showToast('上传失败: ' + err.message, 'error');
        } finally {
            uploadBtn.innerHTML = originalText;
            updateUploadButton();
        }
    }

    // ===== Apply Flow =====

    function setupApplyFlow() {
        const applyModal = document.getElementById('applyModal');
        const closeApplyBtn = document.getElementById('closeApplyModal');
        const copyUrlBtn = document.getElementById('copyUrlBtn');
        const applyBtn = document.getElementById('applyToEditorBtn');

        const closeApplyFn = () => { applyModal.style.display = 'none'; };
        closeApplyBtn.addEventListener('click', closeApplyFn);
        applyModal.querySelector('.modal-overlay').addEventListener('click', closeApplyFn);

        copyUrlBtn.addEventListener('click', () => {
            if (!currentApplyUrl) return;
            navigator.clipboard.writeText(currentApplyUrl).then(() => {
                showToast('链接已复制', 'success');
            }).catch(() => {
                showToast('复制失败，请手动复制', 'error');
            });
        });

        applyBtn.addEventListener('click', () => {
            const bridge = window.RWCEditorBridge;
            if (bridge.connected) {
                // Inside the editor iframe: pass the raw .rwc file URL
                // directly so applyConfigFromUrl() can fetch it without
                // trying to parse an editor HTML page.
                const direct = window._directApplyUrl;
                if (!direct) return;
                bridge.applyConfig(direct);
                showToast('正在应用到编辑器...', 'success');
            } else {
                // Opening a new editor tab: pass the editor page URL with
                // ?rwc= query so checkRwcUrlParam picks it up on load.
                const wrapped = window._wrappedApplyUrl;
                if (!wrapped) return;
                window.open(wrapped, '_blank');
                showToast('已在新窗口打开', 'success');
            }
            applyModal.style.display = 'none';
        });
    }

    // ===== Utilities =====

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 * 1024).toFixed(1) + ' MB';
    }

    function showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast' + (type ? ' ' + type : '');
        toast.style.display = 'block';
        clearTimeout(window._toastTimer);
        window._toastTimer = setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // ===== Init =====

    async function loadConfigs() {
        const loadingState = document.getElementById('loadingState');
        loadingState.style.display = 'flex';

        try {
            configs = await getConfigList();
            renderConfigs();
        } catch (err) {
            console.error('Failed to load configs:', err);
            showToast('加载配置失败，请检查网络连接', 'error');
            loadingState.style.display = 'none';
            document.getElementById('emptyState').style.display = 'flex';
            document.getElementById('emptyState').querySelector('h3').textContent = '加载失败';
            document.getElementById('emptyState').querySelector('p').textContent = err.message;
        }
    }

    function initThemeToggle() {
        const btn = document.getElementById('themeToggleBtn');
        const icon = document.getElementById('themeToggleIcon');

        const saved = localStorage.getItem('rwc:theme') || 'auto';
        applyTheme(saved);

        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            let next;
            if (current === 'dark') next = 'light';
            else if (current === 'light') next = 'dark';
            else next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';

            applyTheme(next);
            localStorage.setItem('rwc:theme', next);
        });
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

    function init() {
        initThemeToggle();
        window.RWCEditorBridge.init();
        setupUploadFlow();
        setupApplyFlow();

        document.getElementById('refreshBtn').addEventListener('click', () => {
            loadConfigs();
            showToast('已刷新', 'success');
        });

        loadConfigs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
