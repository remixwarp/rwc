(function () {
    'use strict';

    const CHANNEL_NAME = 'rwc-config-plaza';

    const EditorBridge = {
        connected: false,
        theme: null,
        accent: null,

        init() {
            window.addEventListener('message', (e) => this._onMessage(e));
            this._announceReady();
            console.log('[RWC] Editor bridge initialized');
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

            const { type, data } = e.data;
            switch (type) {
                case 'editorConnected':
                    this.connected = true;
                    this._updateStatusUI();
                    console.log('[RWC] Editor connected');
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
