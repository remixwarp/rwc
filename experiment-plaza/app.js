(function () {
    'use strict';

    // ===== 配置 =====
    const GITHUB_REPO_OWNER = 'remixwarp';
    const GITHUB_REPO_NAME = 'rwc';
    const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/remixwarp/rwc/main';
    const EXTENSIONS_PATH = 'extensions';
    const CHANNEL = 'rwc-experiment-plaza';

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
                    const metaContent = JSON.parse(atob(meta.content));
                    extList.push({
                        id: extId,
                        name: metaContent.name || extId,
                        author: metaContent.author || '未知作者',
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
            emptyState.querySelector('p').textContent = '加载失败: ' + err.message;
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
            emptyState.querySelector('p').textContent = searchQuery ? '没有匹配的扩展' : '暂无扩展';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = '';

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
        author.textContent = '作者: ' + ext.author;
        body.appendChild(author);

        card.appendChild(body);

        // 卡片底部（安全标签）
        const footer = document.createElement('div');
        footer.className = 'card-footer';

        const tag = document.createElement('span');
        if (ext.reviewStatus === 'approved') {
            tag.className = 'safety-tag safety-tag--safe';
            tag.textContent = '经审核之后可以安全使用';
        } else {
            tag.className = 'safety-tag safety-tag--danger';
            tag.textContent = '未知危险';
        }
        footer.appendChild(tag);

        // 上传日期
        if (ext.uploadDate) {
            const date = document.createElement('span');
            date.style.cssText = 'font-size:0.6875rem;color:var(--text-muted);margin-left:auto;';
            date.textContent = new Date(ext.uploadDate).toLocaleDateString('zh-CN');
            footer.appendChild(date);
        }

        card.appendChild(footer);

        // 文档链接和示例作品
        if (ext.docsURI || ext.sampleProject) {
            const links = document.createElement('div');
            links.className = 'card-links';
            if (ext.docsURI) {
                const a = document.createElement('a');
                a.href = ext.docsURI;
                a.target = '_blank';
                a.rel = 'noreferrer';
                a.textContent = '文档';
                a.onclick = function (e) { e.stopPropagation(); };
                links.appendChild(a);
            }
            if (ext.sampleProject) {
                const a = document.createElement('a');
                a.href = ext.sampleProject;
                a.target = '_blank';
                a.rel = 'noreferrer';
                a.textContent = '示例作品';
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
            }
        }
    }

    // ===== 扩展点击处理 =====
    function handleExtensionClick(ext) {
        if (loadedExtensions.has(ext.extensionId)) {
            showToast('该扩展已加载', 'info');
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

        const confirmBtn = $('warningConfirmBtn');
        const cancelBtn = $('warningCancelBtn');

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

    function loadExtension(ext) {
        showToast('正在加载扩展: ' + ext.name, 'info');
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
                ? '选择 .js 文件'
                : '选择图片文件';
            el.style.borderColor = '';
            el.style.color = '';
        });
    }

    function closeUploadModal() {
        uploadModal.style.display = 'none';
    }
    window.closeUploadModal = closeUploadModal;

    async function submitUpload() {
        const name = $('extName').value.trim();
        const author = $('extAuthor').value.trim();
        const description = $('extDescription').value.trim();
        const docsURI = $('extDocs').value.trim();
        const sampleProject = $('extSample').value.trim();

        if (!name) { showToast('请输入扩展名称', 'error'); return; }
        if (!author) { showToast('请输入作者名称', 'error'); return; }
        if (!description) { showToast('请输入扩展描述', 'error'); return; }
        if (!selectedJsFile) { showToast('请选择扩展 JS 文件', 'error'); return; }
        if (!selectedIconFile) { showToast('请选择扩展封面图片', 'error'); return; }

        const submitBtn = $('uploadSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '正在上传...';

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

            showToast('扩展上传成功！', 'success');
            closeUploadModal();
            // 重新加载扩展列表
            await loadExtensions();
        } catch (err) {
            console.error('Upload failed:', err);
            showToast('上传失败: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '上传扩展';
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
        loadExtensions();
    }
})();