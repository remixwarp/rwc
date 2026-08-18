/**
 * 素材广场 - 编辑器桥接
 * 通过 postMessage 与编辑器通信
 */
(function () {
    'use strict';
    const CHANNEL = 'rwc-material-plaza';

    // 通知编辑器素材广场已就绪
    function notifyReady() {
        window.parent.postMessage({
            channel: CHANNEL,
            type: 'plazaReady'
        }, '*');
    }

    // 请求编辑器进入捕获模式（显示浮动拖拽区）
    function requestCapture() {
        window.parent.postMessage({
            channel: CHANNEL,
            type: 'requestCapture'
        }, '*');
    }

    // 取消捕获模式
    function cancelCapture() {
        window.parent.postMessage({
            channel: CHANNEL,
            type: 'cancelCapture'
        }, '*');
    }

    // 请求编辑器应用素材（拖拽素材到编辑器）
    function requestApplyMaterial(materialData) {
        window.parent.postMessage({
            channel: CHANNEL,
            type: 'applyMaterial',
            data: materialData
        }, '*');
    }

    // 通知编辑器素材已上传
    function notifyUploadComplete(success, message) {
        window.parent.postMessage({
            channel: CHANNEL,
            type: 'uploadComplete',
            data: { success, message }
        }, '*');
    }

    // GitHub API 请求队列（用于处理异步响应）
    const ghRequests = {};
    let ghRequestId = 0;

    // 通过编辑器父窗口转发 GitHub API 读取请求
    // 直接 fetch 在 iframe 内会因 CORS 策略失败，
    // 从父窗口（编辑器主页面）发起匿名请求可以正常通过
    function forwardGithubRead(path) {
        return new Promise(function (resolve, reject) {
            var id = 'gh_' + (++ghRequestId);
            ghRequests[id] = { resolve: resolve, reject: reject };

            window.parent.postMessage({
                channel: CHANNEL,
                type: 'forwardGithubRead',
                data: {
                    requestId: id,
                    path: path
                }
            }, '*');

            // 超时处理
            setTimeout(function () {
                if (ghRequests[id]) {
                    delete ghRequests[id];
                    reject(new Error('GitHub API request timeout'));
                }
            }, 15000);
        });
    }

    // 监听编辑器消息（合并处理：素材捕获、语言变化、GitHub API 响应）
    const listeners = {};
    window.addEventListener('message', function (e) {
        const data = e.data;
        if (!data || data.channel !== CHANNEL) return;

        // 处理 GitHub API 转发响应
        if (data.type === 'forwardGithubReadResult') {
            var reqId = data.data && data.data.requestId;
            if (reqId && ghRequests[reqId]) {
                var handler = ghRequests[reqId];
                delete ghRequests[reqId];
                if (data.data.error) {
                    handler.reject(new Error(data.data.error));
                } else {
                    handler.resolve(data.data.result);
                }
            }
            return;
        }

        switch (data.type) {
            case 'editorLocale':
                // 编辑器语言变化
                if (listeners.onLocaleChange) {
                    listeners.onLocaleChange(data.data && data.data.locale);
                }
                break;
            case 'editorThemeInfo':
                // 编辑器主题信息
                if (data.data && data.data.theme) {
                    var isDark = data.data.theme.isDark;
                    window.MaterialPlazaBridge._editorTheme = isDark ? 'dark' : 'light';
                    // 触发主题变化回调
                    if (listeners.onThemeChange) {
                        listeners.onThemeChange(isDark);
                    }
                }
                break;
        }
    });

    // 获取当前编辑器主题
    function getCurrentTheme() {
        try {
            // 尝试从编辑器桥接读取
            var bridge = window.MaterialPlazaBridge;
            if (bridge && bridge._editorTheme) {
                return bridge._editorTheme;
            }
            // 回退到 localStorage
            var theme = localStorage.getItem('tw:theme');
            if (theme === 'dark' || theme === 'deepdark') return 'dark';
            // 检查 tw:theme 的具体值
            // 对于 pixel themes 等，检查是否包含 dark
            if (theme && theme.toLowerCase().includes('dark')) return 'dark';
            return 'light';
        } catch (e) {
            return 'light';
        }
    }

    // 监听编辑器主题变化
    function onThemeChange(callback) {
        // 监听 postMessage 主题变化事件
        function handler(e) {
            if (e.data && e.data.channel === CHANNEL && e.data.type === 'themeChange') {
                callback(e.data.data && e.data.data.isDark ? true : false);
            }
        }
        window.addEventListener('message', handler);
        // 同时也监听 localStorage 变化（兼容独立页面）
        try {
            var origSetItem = localStorage.setItem;
            var _origSetItem = localStorage.setItem;
            localStorage.setItem = function (key, value) {
                _origSetItem.call(localStorage, key, value);
                if (key === 'tw:theme') {
                    var isDark = value === 'dark' || value === 'deepdark' ||
                        (value && value.toLowerCase().includes('dark'));
                    callback(isDark);
                }
            };
        } catch (e) { /* ignore */ }
        return function () {
            window.removeEventListener('message', handler);
        };
    }

    window.MaterialPlazaBridge = {
        _editorTheme: null,
        notifyReady: notifyReady,
        requestApplyMaterial: requestApplyMaterial,
        notifyUploadComplete: notifyUploadComplete,
        forwardGithubRead: forwardGithubRead,
        onLocaleChange: function (callback) {
            listeners.onLocaleChange = callback;
        },
        onThemeChange: function (callback) {
            listeners.onThemeChange = callback;
        },
        getCurrentTheme: getCurrentTheme
    };
})();