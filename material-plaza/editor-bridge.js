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

    // 监听编辑器消息
    const listeners = {};
    window.addEventListener('message', function (e) {
        const data = e.data;
        if (!data || data.channel !== CHANNEL) return;

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
        onCapturedMaterial: function (callback) {
            listeners.onCapturedMaterial = callback;
        },
        onLocaleChange: function (callback) {
            listeners.onLocaleChange = callback;
        }
    };
})();