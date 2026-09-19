// By Turboratch
(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('图片渲染扩展必须以非沙箱模式运行（加载时勾选“不使用沙盒运行扩展”）');
  }

  const vm = Scratch.vm;
  const Cast = Scratch.Cast;

  function dataUrlToText(dataUrl) {
    const comma = String(dataUrl).indexOf(',');
    if (comma === -1) throw new Error('无效的 data URL');
    const meta = String(dataUrl).slice(0, comma);
    const payload = String(dataUrl).slice(comma + 1);
    if (/;base64$/i.test(meta)) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    return decodeURIComponent(payload);
  }

  function textToImageDataUrl(text) {
    let t = String(text).replace(/^\uFEFF/, '').replace(/\s+/g, '');
    if (!t) throw new Error('数据为空');
    if (/^data:image\//i.test(t)) return t;
    if (/^data:/i.test(t)) throw new Error('不是图片数据（应为 PNG 的 base64 文本）');
    if (!/^[A-Za-z0-9+/=]+$/.test(t)) {
      throw new Error('无法识别的图片数据：请在 .txt 中放入 PNG 图片的 base64 文本');
    }
    return 'data:image/png;base64,' + t;
  }

  function resolveImageDataUrl(raw) {
    const s = String(raw).trim();
    if (!s) throw new Error('数据为空');
    if (/^data:image\//i.test(s)) return s;
    if (/^data:text\//i.test(s) || /^data:application\//i.test(s) || /^data:octet/i.test(s)) {
      return textToImageDataUrl(dataUrlToText(s));
    }
    return textToImageDataUrl(s);
  }

  function clampCrop(crop, width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const num = (v) => {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) ? n : 0;
    };
    const left = Math.min(Math.max(num(crop.left), 0), w - 1);
    const right = Math.min(Math.max(num(crop.right), 0), w - 1 - left);
    const top = Math.min(Math.max(num(crop.top), 0), h - 1);
    const bottom = Math.min(Math.max(num(crop.bottom), 0), h - 1 - top);
    return {
      left: left,
      right: right,
      top: top,
      bottom: bottom,
      cropW: w - left - right,
      cropH: h - top - bottom,
    };
  }

  const MAX_DIMENSION = 4096;

  const SHAPE_ITEMS = [
    { text: '矩形', value: 'rect' },
    { text: '平行四边形', value: 'parallelogram' },
    { text: '圆形', value: 'circle' },
    { text: '圆角矩形', value: 'rounded' },
    { text: '菱形', value: 'diamond' },
    { text: '五角星', value: 'star' },
    { text: '六边形', value: 'hexagon' },
    { text: '三角形', value: 'triangle' },
  ];

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片解码失败（不是有效的图片数据）'));
      img.src = dataUrl;
    });
  }

  class PngDisplay {
    constructor() {
      this._rawDataUrl = null;
      this._image = null;
      this._origW = 0;
      this._origH = 0;
      this._crop = { left: 0, right: 0, top: 0, bottom: 0 };
      this._cropW = 0;
      this._cropH = 0;
      this._skinId = null;
      this._drawableId = null;
      this._x = 0;
      this._y = 0;
      this._scale = 100;
      this._direction = 90;
      this._skinW = 0;
      this._skinH = 0;
      this._visible = false;
      this._error = '';
      this._shape = 'rect';
      this._blur = 0;
      this._picker = null;
      this._pickerChain = Promise.resolve();
      this._pickerGeneration = 0;
      const self = this;
      if (vm && vm.runtime && typeof vm.runtime.on === 'function') {
        vm.runtime.on('PROJECT_STOP_ALL', function () {
          self._pickerGeneration++;
          if (self._picker) {
            self._picker.finish('');
            self._picker = null;
          }
        });
      }
    }

    getInfo() {
      return {
        id: 'pngdisplay',
        name: '图片渲染',
        color1: '#FFB3C1',
        color2: '#FF9FB2',
        color3: '#C2456C',
        blocks: [
          {
            opcode: 'importImage',
            blockType: Scratch.BlockType.REPORTER,
            text: '导入图片文件',
            disableMonitor: true,
          },
          {
            opcode: 'showDataImage',
            blockType: Scratch.BlockType.COMMAND,
            text: '用数据 [DATA] 显示图片',
            arguments: {
              DATA: { type: Scratch.ArgumentType.STRING, defaultValue: '' },
            },
          },
          {
            opcode: 'showImage',
            blockType: Scratch.BlockType.COMMAND,
            text: '显示图片',
          },
          {
            opcode: 'hideImage',
            blockType: Scratch.BlockType.COMMAND,
            text: '隐藏图片',
          },
          '---',
          {
            opcode: 'setPosition',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片移动到 x: [X] y: [Y]',
            arguments: {
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: 'setScale',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片缩放为 [S] %',
            arguments: {
              S: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
            },
          },
          {
            opcode: 'setWidth',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片宽度设为 [W] 像素（高度等比）',
            arguments: {
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
            },
          },
          {
            opcode: 'setHeight',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片高度设为 [H] 像素（宽度等比）',
            arguments: {
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
            },
          },
          {
            opcode: 'setDirection',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片旋转为 [R] 度',
            arguments: {
              R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: 'setBlur',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片模糊度设为 [B]',
            arguments: {
              B: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          '---',
          {
            opcode: 'cropImage',
            blockType: Scratch.BlockType.COMMAND,
            text: '裁剪图片 左 [L] 右 [R] 上 [T] 下 [B] 像素',
            arguments: {
              L: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              R: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              T: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              B: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
            },
          },
          {
            opcode: 'resetCrop',
            blockType: Scratch.BlockType.COMMAND,
            text: '重置裁剪',
          },
          {
            opcode: 'setShape',
            blockType: Scratch.BlockType.COMMAND,
            text: '将图片形状设为 [SHAPE]',
            arguments: {
              SHAPE: { type: Scratch.ArgumentType.STRING, menu: 'SHAPE_MENU' },
            },
          },
          {
            opcode: 'fitToStage',
            blockType: Scratch.BlockType.COMMAND,
            text: '适配舞台',
          },
          {
            opcode: 'coverStage',
            blockType: Scratch.BlockType.COMMAND,
            text: '铺满舞台',
          },
          '---',
          {
            opcode: 'getWidth',
            blockType: Scratch.BlockType.REPORTER,
            text: '图片宽度（像素）',
          },
          {
            opcode: 'getHeight',
            blockType: Scratch.BlockType.REPORTER,
            text: '图片高度（像素）',
          },
          {
            opcode: 'getScreenWidth',
            blockType: Scratch.BlockType.REPORTER,
            text: '图片屏幕宽度',
          },
          {
            opcode: 'getScreenHeight',
            blockType: Scratch.BlockType.REPORTER,
            text: '图片屏幕高度',
          },
          {
            opcode: 'isLoaded',
            blockType: Scratch.BlockType.BOOLEAN,
            text: '图片是否已加载？',
          },
          {
            opcode: 'getError',
            blockType: Scratch.BlockType.REPORTER,
            text: '图片错误信息',
            disableMonitor: true,
          },
        ],
        menus: {
          SHAPE_MENU: {
            acceptReporters: true,
            items: SHAPE_ITEMS,
          },
        },
      };
    }

    _getRenderer() {
      if (!vm || !vm.renderer) throw new Error('无法访问渲染器（请确认以非沙箱模式运行）');
      return vm.renderer;
    }

    _ensureRendererState() {
      const r = this._getRenderer();
      if (this._drawableId !== null && r._allDrawables && !r._allDrawables[this._drawableId]) {
        this._drawableId = null;
        this._skinId = null;
        this._visible = false;
      }
      if (this._skinId !== null && r._allSkins && !r._allSkins[this._skinId]) {
        this._skinId = null;
      }
      return r;
    }

    _ensureDrawable() {
      const r = this._ensureRendererState();
      if (this._drawableId === null) {
        this._drawableId = r.createDrawable('sprite');
        r.setDrawableOrder(this._drawableId, 0, 'sprite');
        r.updateDrawableVisible(this._drawableId, false);
        if (typeof r.markDrawableAsNoninteractive === 'function') {
          r.markDrawableAsNoninteractive(this._drawableId);
        }
      }
      return this._drawableId;
    }

    _setError(msg) {
      this._error = msg || '';
    }

    async _ensureImage(raw) {
      const changed = raw !== this._rawDataUrl;
      this._rawDataUrl = raw;
      if (!changed && this._image) return;
      const imageDataUrl = resolveImageDataUrl(raw);
      const img = await loadImage(imageDataUrl);
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('图片尺寸为 0');
      this._image = img;
      this._origW = img.naturalWidth;
      this._origH = img.naturalHeight;
      this._crop = { left: 0, right: 0, top: 0, bottom: 0 };
      this._cropW = this._origW;
      this._cropH = this._origH;
      this._shape = 'rect';
      this._blur = 0;
      await this._applySkin();
      this._fitToStage();
    }

    _traceShape(ctx, w, h) {
      const m = Math.min(w, h);
      if (this._shape === 'circle') {
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else if (this._shape === 'rounded') {
        const r = Math.min(m * 0.12, w / 2, h / 2);
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.arcTo(w, 0, w, r, r);
        ctx.lineTo(w, h - r);
        ctx.arcTo(w, h, w - r, h, r);
        ctx.lineTo(r, h);
        ctx.arcTo(0, h, 0, h - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
      } else if (this._shape === 'parallelogram') {
        const s = Math.min((h * 53.21094) / 177, w - 1);
        ctx.moveTo(s, 0);
        ctx.lineTo(w, 0);
        ctx.lineTo(w - s, h);
        ctx.lineTo(0, h);
      } else if (this._shape === 'diamond') {
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w, h / 2);
        ctx.lineTo(w / 2, h);
        ctx.lineTo(0, h / 2);
      } else if (this._shape === 'star') {
        const outer = m / 2;
        const inner = outer * 0.38;
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? outer : inner;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const x = w / 2 + Math.cos(a) * rad;
          const y = h / 2 + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else if (this._shape === 'hexagon') {
        const rad = m / 2;
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 3;
          const x = w / 2 + Math.cos(a) * rad;
          const y = h / 2 + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else if (this._shape === 'triangle') {
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
      }
      ctx.closePath();
    }

    async _applySkin() {
      const r = this._ensureRendererState();
      const w = Math.max(1, Math.floor(this._cropW));
      const h = Math.max(1, Math.floor(this._cropH));
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        throw new Error('图片尺寸过大（单边超过 ' + MAX_DIMENSION + ' 像素）');
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (this._blur > 0) {
        ctx.filter = 'blur(' + this._blur + 'px)';
      }
      if (this._shape !== 'rect') {
        ctx.save();
        this._traceShape(ctx, w, h);
        ctx.clip();
      }
      ctx.drawImage(this._image, this._crop.left, this._crop.top, w, h, 0, 0, w, h);
      if (this._shape !== 'rect') {
        ctx.restore();
      }
      if (this._skinId === null) {
        this._skinId = r.createBitmapSkin(canvas, 1, [w / 2, h / 2]);
      } else {
        r.updateBitmapSkin(this._skinId, canvas, 1, [w / 2, h / 2]);
      }
      const drawableId = this._ensureDrawable();
      r.updateDrawableSkinId(drawableId, this._skinId);
      if (typeof r.getSkinSize === 'function') {
        const sz = r.getSkinSize(this._skinId);
        if (sz && sz[0] > 0 && sz[1] > 0) {
          this._skinW = sz[0];
          this._skinH = sz[1];
        }
      }
      if (!this._skinW) {
        this._skinW = w;
        this._skinH = h;
      }
      if (r._allSkins && r._allSkins[this._skinId] && typeof r.skinWasAltered === 'function') {
        r.skinWasAltered(r._allSkins[this._skinId]);
      }
      r.dirty = true;
    }

    _syncDrawable() {
      const r = this._getRenderer();
      const drawableId = this._ensureDrawable();
      r.updateDrawableSkinId(drawableId, this._skinId);
      r.updateDrawablePosition(drawableId, [this._x, this._y]);
      r.updateDrawableDirection(drawableId, this._direction);
      r.updateDrawableScale(drawableId, [this._scale, this._scale]);
      r.updateDrawableVisible(drawableId, this._visible);
      r.dirty = true;
    }

    _fitToStage() {
      if (!this._image) {
        this._setError('请先导入图片文件');
        return;
      }
      const stageW = 480;
      const stageH = 360;
      const skinW = this._skinW || this._cropW || 1;
      const skinH = this._skinH || this._cropH || 1;
      this._scale = Math.min(stageW / skinW, stageH / skinH) * 100;
      this._x = 0;
      this._y = 0;
      this._direction = 90;
      if (this._drawableId !== null) {
        this._syncDrawable();
      }
    }

    _coverStage() {
      if (!this._image) {
        this._setError('请先导入图片文件');
        return;
      }
      const stageW = 480;
      const stageH = 360;
      const skinW = this._skinW || this._cropW || 1;
      const skinH = this._skinH || this._cropH || 1;
      this._scale = Math.max(stageW / skinW, stageH / skinH) * 100;
      this._x = 0;
      this._y = 0;
      this._direction = 90;
      if (this._drawableId !== null) {
        this._syncDrawable();
      }
    }

    _showFilePicker(accept) {
      const self = this;
      const gen = this._pickerGeneration;
      const result = this._pickerChain.then(function () {
        if (self._pickerGeneration !== gen) return '';
        return self._openPicker(accept);
      });
      this._pickerChain = result.then(
        function () {},
        function () {}
      );
      return result;
    }

    _openPicker(accept) {
      if (this._picker) {
        this._picker.finish('');
        this._picker = null;
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          this._picker = null;
          resolve(value);
        };
        const outer = document.createElement('div');
        outer.style.cssText =
          'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;' +
          'display:flex;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,0.45);' +
          'font-family:"PingFang SC","Microsoft YaHei",sans-serif;';
        const modal = document.createElement('div');
        modal.style.cssText =
          'background:#fff;border-radius:16px;padding:28px 36px;text-align:center;cursor:pointer;' +
          'box-shadow:0 8px 40px rgba(0,0,0,0.3);max-width:82vw;';
        modal.innerHTML =
          '<div style="font-size:18px;font-weight:600;color:#333;margin-bottom:10px;">点击选择图片文件</div>' +
          '<div style="font-size:13px;color:#888;margin-bottom:6px;">支持 .txt（内容为 PNG 的 base64 文本）以及 .png / .jpg / .jpeg / .gif / .webp / .bmp</div>' +
          '<div style="font-size:13px;color:#C2456C;">也可以直接把文件拖拽到此处</div>';
        const cancel = document.createElement('div');
        cancel.textContent = '取消';
        cancel.style.cssText = 'margin-top:16px;font-size:14px;color:#999;cursor:pointer;';
        cancel.addEventListener('click', (e) => {
          e.stopPropagation();
          finish('');
        });
        modal.appendChild(cancel);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.style.display = 'none';
        outer.appendChild(modal);
        outer.appendChild(input);
        document.body.appendChild(outer);

        const onKey = (e) => {
          if (e.key === 'Escape') finish('');
        };
        document.addEventListener('keydown', onKey, true);

        const cleanup = () => {
          document.removeEventListener('keydown', onKey, true);
          try {
            document.body.removeChild(outer);
          } catch (e) {
          }
        };

        const readFile = (file) => {
          const reader = new FileReader();
          reader.onload = () => finish(reader.result);
          reader.onerror = () => {
            this._setError('读取文件失败');
            finish('');
          };
          reader.readAsDataURL(file);
        };

        modal.addEventListener('click', () => input.click());
        outer.addEventListener('dragover', (e) => e.preventDefault());
        outer.addEventListener('drop', (e) => {
          e.preventDefault();
          const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (file) readFile(file);
        });
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (file) readFile(file);
        });
        outer.addEventListener('click', (e) => {
          if (e.target === outer) finish('');
        });
        this._picker = { finish: finish };
      });
    }

    async importImage() {
      const dataUrl = await this._showFilePicker('.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp');
      if (dataUrl === '') {
        this._setError('已取消选择文件');
        return '';
      }
      try {
        await this._ensureImage(dataUrl);
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
      return dataUrl;
    }

    async showDataImage(args) {
      const data = Cast.toString(args.DATA);
      try {
        await this._ensureImage(data);
        this._visible = true;
        this._syncDrawable();
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    showImage() {
      try {
        if (!this._image) {
          if (!this._rawDataUrl) {
            this._setError('请先导入图片文件');
            return;
          }
          return this.showDataImage({ DATA: this._rawDataUrl });
        }
        this._visible = true;
        this._syncDrawable();
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    hideImage() {
      try {
        this._visible = false;
        if (this._drawableId !== null) {
          const r = this._ensureRendererState();
          if (this._drawableId !== null) {
            r.updateDrawableVisible(this._drawableId, false);
          }
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    setPosition(args) {
      try {
        this._x = Cast.toNumber(args.X);
        this._y = Cast.toNumber(args.Y);
        if (this._drawableId !== null) {
          const r = this._ensureRendererState();
          if (this._drawableId !== null) {
            r.updateDrawablePosition(this._drawableId, [this._x, this._y]);
          }
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    setScale(args) {
      try {
        this._scale = Math.max(0, Cast.toNumber(args.S));
        if (this._drawableId !== null) {
          const r = this._ensureRendererState();
          if (this._drawableId !== null) {
            r.updateDrawableScale(this._drawableId, [this._scale, this._scale]);
          }
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    setWidth(args) {
      try {
        const w = Math.max(0, Cast.toNumber(args.W));
        this._scale = this._cropW > 0 ? (w / this._cropW) * 100 : this._scale;
        if (this._drawableId !== null) {
          const r = this._ensureRendererState();
          if (this._drawableId !== null) {
            r.updateDrawableScale(this._drawableId, [this._scale, this._scale]);
          }
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    setHeight(args) {
      try {
        const h = Math.max(0, Cast.toNumber(args.H));
        this._scale = this._cropH > 0 ? (h / this._cropH) * 100 : this._scale;
        if (this._drawableId !== null) {
          const r = this._ensureRendererState();
          if (this._drawableId !== null) {
            r.updateDrawableScale(this._drawableId, [this._scale, this._scale]);
          }
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    setDirection(args) {
      try {
        this._direction = Cast.toNumber(args.R);
        if (this._drawableId !== null) {
          const r = this._ensureRendererState();
          if (this._drawableId !== null) {
            r.updateDrawableDirection(this._drawableId, this._direction);
          }
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    async setBlur(args) {
      try {
        this._blur = Math.max(0, Cast.toNumber(args.B));
        if (this._image) {
          await this._applySkin();
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    async cropImage(args) {
      try {
        if (!this._image) {
          this._setError('请先导入图片');
          return;
        }
        const c = clampCrop(
          { left: args.L, right: args.R, top: args.T, bottom: args.B },
          this._origW,
          this._origH
        );
        this._crop = { left: c.left, right: c.right, top: c.top, bottom: c.bottom };
        this._cropW = c.cropW;
        this._cropH = c.cropH;
        await this._applySkin();
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    async resetCrop() {
      try {
        if (!this._image) {
          this._setError('请先导入图片');
          return;
        }
        this._crop = { left: 0, right: 0, top: 0, bottom: 0 };
        this._cropW = this._origW;
        this._cropH = this._origH;
        await this._applySkin();
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    async setShape(args) {
      try {
        const shape = Cast.toString(args.SHAPE);
        const names = SHAPE_ITEMS.map(function (i) {
          return i.value;
        });
        this._shape = names.indexOf(shape) !== -1 ? shape : 'rect';
        if (this._image) {
          await this._applySkin();
        }
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    getShape() {
      return this._shape;
    }

    fitToStage() {
      try {
        this._fitToStage();
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    coverStage() {
      try {
        this._coverStage();
        this._setError('');
      } catch (e) {
        this._setError(e && e.message ? e.message : String(e));
      }
    }

    getWidth() {
      return this._cropW;
    }

    getHeight() {
      return this._cropH;
    }

    getScreenWidth() {
      return (this._cropW * this._scale) / 100;
    }

    getScreenHeight() {
      return (this._cropH * this._scale) / 100;
    }

    isLoaded() {
      return !!this._image;
    }

    getError() {
      return this._error;
    }
  }

  Scratch.extensions.register(new PngDisplay());

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      dataUrlToText: dataUrlToText,
      textToImageDataUrl: textToImageDataUrl,
      resolveImageDataUrl: resolveImageDataUrl,
      clampCrop: clampCrop,
      PngDisplay: PngDisplay,
    };
  }
})(Scratch);
