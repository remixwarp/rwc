(function () {
    'use strict';

    const CHANNEL_NAME = 'rwc-config-plaza';

    const EditorBridge = {
        connected: false,
        theme: null,
        accent: null,
        editorUrl: null,    // set by editorConnected payload, e.g. http://localhost:8601/editor.html
        _forwardReqCounter: 0,
        _forwardPending: new Map(), // requestId -> {resolve, reject, timeout}
        _connectResolve: null,
        _connectPromise: null,

        init() {
            // Resolved the first time `editorConnected` arrives. Use this to
            // delay GitHub API calls in iframe scenarios so they can be
            // forwarded through the editor tab (which doesn't suffer from
            // the iframe CORS/fetch issues).
            this._connectPromise = new Promise(resolve => {
                this._connectResolve = resolve;
                // Safety net: if no editor ever replies (e.g. the plaza was
                // opened as a standalone tab inside a same-origin iframe of
                // some unrelated page) we still resolve after a short wait
                // so callers don't hang forever.
                setTimeout(() => resolve(false), 5000);
            });
            window.addEventListener('message', (e) => this._onMessage(e));
            this._announceReady();
            console.log('[RWC] Editor bridge initialized');
        },

        // Promise that resolves with `true` once the editor handshake has
        // completed and forward APIs are available, or `false` on timeout.
        waitForEditorConnection() {
            return this._connectPromise;
        },

        _announceReady() {
            this._send({
                type: 'plazaReady',
                data: { timestamp: Date.now() }
            });
        },

        _onMessage(e) {
            if (!e.data || !e.data.type) return;
            if (e.data.channel !== CHANNEL_NAME) return;

            const { type, data, requestId, error } = e.data;

            // ---- Forwarded GitHub API responses ----
            if (type === 'forwardGithubTree:result' || type === 'forwardGithubBlob:result') {
                const pending = this._forwardPending.get(requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this._forwardPending.delete(requestId);
                    if (data && data.error) {
                        pending.reject(new Error(data.error));
                    } else if (error) {
                        pending.reject(new Error(error));
                    } else {
                        pending.resolve(data);
                    }
                }
                return;
            }

            switch (type) {
                case 'editorConnected':
                    this.connected = true;
                    // The editor tells us its full page URL so we can build
                    // correct apply links (editor.html?rwc=...). Fall back to
                    // document.referrer for older editor versions that don't
                    // send the field.
                    if (data && data.editorUrl) {
                        this.editorUrl = data.editorUrl;
                    } else if (document.referrer) {
                        try {
                            const ref = new URL(document.referrer);
                            this.editorUrl = ref.origin + ref.pathname;
                        } catch (_) { /* ignore */ }
                    }
                    // Unblock any caller waiting on waitForEditorConnection().
                    if (this._connectResolve) {
                        const fn = this._connectResolve;
                        this._connectResolve = null;
                        fn(true);
                    }
                    this._updateStatusUI();
                    console.log('[RWC] Editor connected', this.editorUrl ? 'at ' + this.editorUrl : '');
                    break;
                case 'editorThemeInfo':
                    this.theme = data.theme;
                    this.accent = data.accent;
                    this._updateThemeDetection();
                    break;
                case 'editorConfigExported':
                    this._handleConfigExported(data);
                    break;
                case 'editorApplyResult':
                    this._handleApplyResult(data);
                    break;
                case 'error':
                    console.error('[RWC] Editor error:', data);
                    break;
            }
        },

        _send(message) {
            message.channel = CHANNEL_NAME;
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(message, '*');
            }
        },

        // Request-response wrapper for forwarded GitHub reads. The editor
        // runs the actual fetch from a first-party tab context, which
        // avoids the iframe CORS/fetch failures that show up as
        // "NetworkError when attempting to fetch resource" inside the
        // embedded plaza window.
        _forwardRequest(type, payload, timeoutMs = 30000) {
            return new Promise((resolve, reject) => {
                const requestId = ++this._forwardReqCounter;
                const timeout = setTimeout(() => {
                    this._forwardPending.delete(requestId);
                    reject(new Error('Forward request timed out'));
                }, timeoutMs);
                this._forwardPending.set(requestId, { resolve, reject, timeout });
                this._send({ type: type, data: payload, requestId: requestId });
            });
        },

        // True when the plaza iframe is embedded in the editor and we can
        // safely ask the editor tab to proxy API calls for us.
        canForward() {
            return this.connected && window.parent && window.parent !== window;
        },

        forwardGithubTree() {
            return this._forwardRequest('forwardGithubTree', {})
                .then(r => r.tree);
        },

        forwardGithubBlob(sha) {
            return this._forwardRequest('forwardGithubBlob', { sha: sha })
                .then(r => r.blob);
        },

        requestThemeInfo() {
            this._send({
                type: 'requestThemeInfo',
                data: null
            });
        },

        requestConfigExport() {
            this._send({
                type: 'requestConfigExport',
                data: null
            });
        },

        applyConfig(url) {
            this._send({
                type: 'applyConfig',
                data: { url: url }
            });
        },

        _updateStatusUI() {
            const status = document.getElementById('editorStatus');
            if (status) {
                status.classList.toggle('connected', this.connected);
                const text = status.querySelector('.status-text');
                if (text) {
                    text.textContent = this.connected ? '已连接编辑器' : '未连接编辑器';
                }
            }

            const importBtn = document.getElementById('importFromEditorBtn');
            if (importBtn) {
                importBtn.disabled = !this.connected;
                const hint = document.getElementById('editorHint');
                if (hint) {
                    hint.textContent = this.connected ? '点击导出当前配置' : '(需要编辑器连接)';
                }
            }
        },

        _updateThemeDetection() {
            if (!this.theme) return;

            const themeEl = document.getElementById('detectedTheme');
            const isDarkEl = document.getElementById('isDark');
            const accentColorEl = document.getElementById('accentColor');
            const accentNameEl = document.getElementById('accentName');
            const authorInput = document.getElementById('configAuthor');

            if (authorInput && this.theme.username && !authorInput.value) {
                authorInput.value = this.theme.username;
                const authorCount = document.getElementById('authorCount');
                if (authorCount) {
                    authorCount.textContent = this.theme.username.length;
                }
                const authorEvt = new Event('input');
                authorInput.dispatchEvent(authorEvt);
            }

            if (themeEl) {
                const themeName = this.theme.displayName || this.theme.gui || '未知';
                themeEl.textContent = themeName;
                themeEl.className = 'theme-value theme-badge ' +
                    (this.theme.isDark ? 'dark' : 'light');
            }

            if (isDarkEl) {
                isDarkEl.textContent = this.theme.isDark ? '深色' : '浅色';
            }

            if (this.accent) {
                if (accentColorEl) {
                    accentColorEl.style.background = this.accent.color || '#ccc';
                }
                if (accentNameEl) {
                    accentNameEl.textContent = this.accent.name || '-';
                }
            }
        },

        _handleConfigExported(data) {
            if (!data || !data.configData) {
                this._showToast('编辑器配置导出失败', 'error');
                return;
            }

            window._pendingEditorConfig = data;
            this._showToast('已从编辑器获取配置，请填写信息后上传');

            const fileInfo = document.getElementById('fileInfo');
            const fileName = document.getElementById('fileName');
            const fileSize = document.getElementById('fileSize');

            if (fileInfo && fileName && fileSize) {
                fileInfo.style.display = 'flex';
                fileName.textContent = data.fileName || 'editor-config.rwc';
                fileSize.textContent = this._formatSize(data.configData.byteLength || 0);
            }

            const uploadBtn = document.getElementById('confirmUpload');
            if (uploadBtn) {
                uploadBtn.disabled = false;
            }
        },

        _handleApplyResult(data) {
            if (data.success) {
                this._showToast('配置已应用到编辑器', 'success');
            } else {
                this._showToast('应用失败: ' + (data.error || '未知错误'), 'error');
            }
        },

        _formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1024 * 1024).toFixed(1) + ' MB';
        },

        _showToast(message, type) {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.textContent = message;
            toast.className = 'toast' + (type ? ' ' + type : '');
            toast.style.display = 'block';
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    };

    window.RWCEditorBridge = EditorBridge;

})();
