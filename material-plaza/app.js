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
            'upload.desc': '素材描述 *',
            'upload.desc.ph': '输入素材描述',
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
            'remove': '移除'
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
            'upload.desc': 'Description *',
            'upload.desc.ph': 'Enter description',
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
            'remove': 'Remove'
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
        const descLabel = document.querySelector('#uploadModal .form-group:nth-child(2) label');
        if (descLabel) descLabel.textContent = __('upload.desc');
        const descInput = document.getElementById('descInput');
        if (descInput) descInput.placeholder = __('upload.desc.ph');
        const fileLabel = document.querySelector('#uploadModal .form-group:nth-child(3) label');
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
    async function githubFetch(path, options) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers.Authorization = 'Bearer ' + GITHUB_TOKEN;
        options.headers.Accept = 'application/vnd.github.v3+json';
        const url = GITHUB_API_BASE + path;
        const res = await fetch(url, options);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || ('HTTP ' + res.status));
        }
        return res;
    }

    // 获取文件内容 (base64 encoded)
    async function getFileContent(path) {
        try {
            const res = await githubFetch('/contents/' + path);
            const data = await res.json();
            return {
                content: atob(data.content.replace(/\n/g, '')),
                sha: data.sha
            };
        } catch (e) {
            if (e.message.includes('404') || e.message.includes('Not Found')) {
                return null;
            }
            throw e;
        }
    }

    // 创建或更新文件
    async function putFile(path, content, message) {
        const existing = await getFileContent(path);
        const body = {
            message: message,
            content: btoa(unescape(encodeURIComponent(content)))
        };
        if (existing && existing.sha) {
            body.sha = existing.sha;
        }
        const res = await githubFetch('/contents/' + path, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        return res.json();
    }

    // 删除文件
    async function deleteFile(path, message) {
        const existing = await getFileContent(path);
        if (!existing) return;
        await githubFetch('/contents/' + path, {
            method: 'DELETE',
            body: JSON.stringify({
                message: message,
                sha: existing.sha
            })
        });
    }

    // ===== 素材操作 =====
    // 从 index.json 加载素材列表
    async function loadMaterials() {
        try {
            const index = await getFileContent(MATERIALS_PATH + '/index.json');
            if (index) {
                materials = JSON.parse(index.content);
            } else {
                materials = [];
            }
            renderMaterials();
        } catch (err) {
            console.error('Failed to load materials:', err);
            showToast(__('toast.load.fail', {msg: err.message}), 'error');
            materials = [];
            renderMaterials();
        }
    }

    // 获取单个素材的完整数据（含 body）
    async function getMaterialBody(id) {
        const file = await getFileContent(MATERIALS_PATH + '/' + id + '.json');
        if (!file) return null;
        return JSON.parse(file.content);
    }

    // 上传素材到 GitHub
    async function uploadMaterial(materialData) {
        const id = generateId();
        const now = new Date().toISOString();
        const material = {
            id: id,
            name: materialData.name,
            author: materialData.author,
            description: materialData.description,
            type: materialData.type,
            mime: materialData.mime,
            body: materialData.body,
            bodyMD5: materialData.bodyMD5,
            uploadDate: now
        };

        // 上传素材文件
        await putFile(
            MATERIALS_PATH + '/' + id + '.json',
            JSON.stringify(material),
            'Upload material: ' + materialData.name
        );

        // 更新 index.json
        const indexEntry = {
            id: id,
            name: materialData.name,
            author: materialData.author,
            description: materialData.description,
            type: materialData.type,
            mime: materialData.mime,
            uploadDate: now
        };
        materials.unshift(indexEntry);
        await putFile(
            MATERIALS_PATH + '/index.json',
            JSON.stringify(materials, null, 2),
            'Update material index: ' + materialData.name
        );

        return id;
    }

    // 删除素材
    async function deleteMaterial(id) {
        const material = materials.find(function (m) { return m.id === id; });
        if (!material) return;
        await deleteFile(
            MATERIALS_PATH + '/' + id + '.json',
            'Delete material: ' + material.name
        );
        materials = materials.filter(function (m) { return m.id !== id; });
        await putFile(
            MATERIALS_PATH + '/index.json',
            JSON.stringify(materials, null, 2),
            'Update material index after delete: ' + material.name
        );
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
                return (m.name && m.name.toLowerCase().includes(q)) ||
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

        card.innerHTML =
            '<div class="material-card-thumb">' +
                '<div class="material-card-type-badge ' + material.type + '" style="background:' + (typeColors[material.type] || '#999') + '">' +
                    (typeLabels[material.type] || material.type) +
                '</div>' +
                '<div class="material-card-thumb-placeholder" style="font-size:32px;color:#ccc">' +
                    getTypeIcon(material.type) +
                '</div>' +
            '</div>' +
            '<div class="material-card-body">' +
                '<div class="material-card-name" title="' + escapeHtml(material.name || '') + '">' +
                    escapeHtml(material.name || '') +
                '</div>' +
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
        document.getElementById('authorInput').value = '';
        document.getElementById('descInput').value = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('filePreview').style.display = 'none';
        document.getElementById('fileUploadPlaceholder').style.display = 'flex';
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
        var ext = file.name.split('.').pop().toLowerCase();

        // 判断是否为二进制文件
        var isBinary = (ext === 'sprite3' || ext === 'png' || ext === 'wav' || ext === 'mp3');

        if (isBinary) {
            // 二进制文件：读取为 ArrayBuffer 再转 base64
            var reader = new FileReader();
            reader.onload = function (e) {
                var body = arrayBufferToBase64(e.target.result);
                showFilePreview(name, type, body, mime);
            };
            reader.readAsArrayBuffer(file);
        } else {
            // 文本文件 (SVG)
            var reader = new FileReader();
            reader.onload = function (e) {
                var body = e.target.result;
                showFilePreview(name, type, body, mime);
            };
            reader.readAsText(file);
        }
    }

    function showFilePreview(name, type, body, mime) {
        selectedFileData = {
            name: name,
            type: type,
            mime: mime,
            body: body,
            bodyMD5: ''
        };

        document.getElementById('fileUploadPlaceholder').style.display = 'none';
        document.getElementById('filePreview').style.display = 'flex';
        document.getElementById('filePreviewName').textContent = name;
        document.getElementById('filePreviewType').textContent = getFileTypeLabel(type);
        document.getElementById('filePreviewThumb').innerHTML = '';
        document.getElementById('filePreviewThumb').textContent = getTypeIcon(type);
        document.getElementById('filePreviewThumb').style.fontSize = '24px';
        checkUploadForm();
    }

    // 检查上传表单是否可提交
    function checkUploadForm() {
        var author = document.getElementById('authorInput').value.trim();
        var desc = document.getElementById('descInput').value.trim();
        document.getElementById('uploadSubmitBtn').disabled = !(author && desc && selectedFileData);
    }

    // 执行上传
    async function handleUpload() {
        var author = document.getElementById('authorInput').value.trim();
        var desc = document.getElementById('descInput').value.trim();
        if (!author || !desc || !selectedFileData) {
            showToast(__('upload.author') + ' / ' + __('upload.desc') + ' ' + __('file.select.error'), 'error');
            return;
        }

        var submitBtn = document.getElementById('uploadSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = __('upload.uploading');

        try {
            await uploadMaterial({
                name: selectedFileData.name || 'untitled',
                author: author,
                description: desc,
                type: selectedFileData.type,
                mime: selectedFileData.mime || 'application/octet-stream',
                body: selectedFileData.body,
                bodyMD5: selectedFileData.bodyMD5 || ''
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

    // ===== 事件绑定 =====
    function init() {
        // 通知编辑器就绪
        if (window.MaterialPlazaBridge) {
            window.MaterialPlazaBridge.notifyReady();
        }

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

        // 添加按钮
        document.getElementById('addBtn').addEventListener('click', openUploadModal);

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

        // 表单输入变化
        document.getElementById('authorInput').addEventListener('input', checkUploadForm);
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