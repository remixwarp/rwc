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
            case 'capturedMaterial':
                // 编辑器捕获了素材，发送到素材广场
                if (listeners.onCapturedMaterial) {
                    listeners.onCapturedMaterial(data.data);
                }
                break;
            case 'editorLocale':
                // 编辑器语言变化
                if (listeners.onLocaleChange) {
                    listeners.onLocaleChange(data.data && data.data.locale);
                }
                break;
        }
    });

    window.MaterialPlazaBridge = {
        notifyReady: notifyReady,
        requestCapture: requestCapture,
        cancelCapture: cancelCapture,
        requestApplyMaterial: requestApplyMaterial,
        notifyUploadComplete: notifyUploadComplete,
        forwardGithubRead: forwardGithubRead,
        onCapturedMaterial: function (callback) {
            listeners.onCapturedMaterial = callback;
        },
        onLocaleChange: function (callback) {
            listeners.onLocaleChange = callback;
        }
    };
})();