(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('「WebGL 液体玻璃」扩展必须以 unsandboxed 模式加载。');
  }

  const vm = Scratch.vm;
  const runtime = vm.runtime;

  const OVERLAY_CANVAS_ID = 'webgl-liquid-glass-overlay-canvas';

  // ================================================================
  //  V5 性能优化清单（针对 Intel HD Graphics 5300/615 等弱 GPU）
  //  1. 顶点/片元着色器 precision 改 mediump（Intel GPU 上 highp 是软件模拟，慢 3-5 倍）
  //  2. WebGL 上下文 antialias: false（SDF smoothstep 已提供边缘 AA，MSAA 纯浪费）
  //  3. 移除每帧 gl.getError()（强制 GPU 管线全同步，Intel 上 3-8ms 停顿）
  //  4. texSubImage2D 复用纹理（避免每帧 texImage2D 重新分配显存）
  //  5. 条件化 generateMipmap（仅当有玻璃开启模糊时才生成，无模糊时跳过）
  //  6. 移除 warmup 双重渲染（warmup 期间画两遍 → 改为一遍）
  //  7. 自适应分辨率缩放（监控帧时间，弱 GPU 上自动降到 0.5x 渲染，CSS 拉伸回满屏）
  // ================================================================

  // [优化1] 顶点着色器 mediump 即可（坐标范围 < 500，远在 mediump 1024 安全范围内）
  const VERTEX_SHADER_SOURCE = `#version 300 es
precision mediump float;
layout(location = 0) in vec2 aPosition;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform vec2 uHalfStage;
uniform float uRotation;

out vec2 v_localPos;

void main() {
  v_localPos = aPosition;
  // 绕玻璃中心旋转四边形（v_localPos 保持未旋转，片元着色器 SDF 在玻璃自身坐标系计算，
  // 故形状/圆角随玻璃一起旋转，无需改动片元着色器）
  float c = cos(uRotation);
  float s = sin(uRotation);
  vec2 local = aPosition * uHalfSize;
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 worldPos = uCenter + rotated;
  vec2 clip = worldPos / uHalfStage;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

  // [优化1] 片元着色器 mediump（gl_FragCoord 在 ES 3.0 中默认 highp，不受 precision 声明影响）
  // 圆角：G2 / 四分之一 走「圆角扩展」的圆角矩形 SDF（四角圆弧，单半径 rr=min(R,短边/2)）；
  //       三分之一 / G3 走原超椭圆(squircle) SDF，指数由 uCornerExponent 控制（uCornerExponentInv=1/exponent）。
  const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_localPos;

out vec4 fragColor;

uniform sampler2D uStageTexture;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uHalfStage;
uniform vec2 uHalfSize;
uniform float uRefraction;
uniform float uDiameter;
uniform float uOpacity;
uniform float uCornerRadius;
uniform float uCornerExponent;
uniform float uCornerExponentInv;
uniform float uRoundedBox;
uniform float uBlur;
uniform vec4 uTint;
uniform float uHighlight;
uniform float uDispersion;

void main() {
    vec2 halfPx = uHalfSize / 1.0625;
    vec2 p = v_localPos * 2.0 * uHalfSize;

    // —— 圆角逻辑 ——
    // G2 / 四分之一：采用「圆角扩展」的圆角矩形 SDF（四角圆弧，单半径，rr = min(R, 短边/2)），
    //   边界 sd=0、内部 sd<0、外部 sd>0，归一化为「中心=0、边界=1」的 rho。
    // 三分之一 / G3：保留原超椭圆(squircle) SDF，指数由 uCornerExponent 控制（原实现）。
    // 两种路径都产出「中心=0、边界=1」的 rho，供折射/高光/遮罩共用，零回归。
    // 剪罩 AA 由 fwidth(rho) 自动按像素变化率取 ~1px 过渡带，各方向/长宽比恒定，无发虚。
    float rho;
    if (uRoundedBox > 0.5) {
      float rr = min(uCornerRadius, min(halfPx.x, halfPx.y));
      vec2 q = abs(p) - halfPx + vec2(rr);
      float sd = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rr;
      rho = sd / max(min(halfPx.x, halfPx.y), 1e-3) + 1.0;
    } else {
      vec2 nrm = abs(p) / max(halfPx, vec2(1e-3));
      float linft = max(nrm.x, nrm.y);
      float superell = pow(pow(nrm.x, uCornerExponent) + pow(nrm.y, uCornerExponent), uCornerExponentInv);
      float roundness = clamp(uCornerRadius / max(min(halfPx.x, halfPx.y), 1e-3), 0.0, 1.0);
      rho = mix(linft, superell, roundness);
    }
    float dist = 0.5 * rho;

    vec2 center = uCenter / (2.0 * uHalfStage) + 0.5;   // 透镜中心（屏幕 UV）
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    vec2 tex = screenUV - center;

    float dis2x = min(dist * 2.0, 0.99);
    float sq = sqrt(max(1.0 - dis2x * dis2x, 1e-4));
    float num = uRefraction / sq - uRefraction;

    float blurLod = clamp(uBlur, 0.0, 1.0) * 6.0;

    // —— 色散（RGB 折射偏移分离）——
    // num 在中心为 0（三通道重合=无色散），随边缘折射差异增大而增强，物理正确。
    // 红通道折射更强、蓝通道更弱，形成彩色镶边；uDispersion=0 时完全无色散。
    // 标度 /50：100→disp=2.0（极强），20→0.4，0→无色散。
    float disp = uDispersion / 50.0;
    float numR = num * (1.0 + disp);
    float numB = num * (1.0 - disp);
    float r = textureLod(uStageTexture, tex * (1.0 - numR) + center, blurLod).r;
    float g = textureLod(uStageTexture, tex * (1.0 - num)  + center, blurLod).g;
    float b = textureLod(uStageTexture, tex * (1.0 - numB) + center, blurLod).b;
    vec3 col = vec3(r, g, b);

    vec2 glassHalfUV = (uHalfSize / 1.0625) / (2.0 * uHalfStage);
    vec2 rebUV = center + tex * (1.0 + num);
    rebUV = clamp(rebUV, center - glassHalfUV, center + glassHalfUV);
    vec3 reb = textureLod(uStageTexture, rebUV, blurLod).rgb;

    num = abs(num);
    // —— 高光强度 uHighlight ——
    // 两处边缘提亮项统一乘 uHighlight：=1 为原始效果，=0 无高光，>1 加强（上限由积木 clamp 到 3）。
    col *= clamp(1.03125 - num * 0.25, 0.625, 1.0) + clamp(num * 0.125 - 0.0625, 0.0, 0.25) * uHighlight;

    if (uTint.a > 0.0) {
        float t = dot(col, uTint.rgb) / max(uTint.r + uTint.g + uTint.b, 0.001);
        t = sqrt(t);
        col += (uTint.rgb * t - col) * uTint.a;
    }

    col = mix(col + clamp(num * 0.25 - 0.0625, 0.0, 0.5) * 0.5 * uHighlight,
              reb, clamp(dist * (1.0 + num) - 0.5625, 0.0, 1.0) * 0.75);

    float aa = fwidth(rho) + 1e-4;
    float shapeMask = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, rho);

    // —— 不透明输出 ——
    // 形状内部 alpha 恒为 1（仅最外轮廓由 shapeMask 做 1px 抗锯齿），
    // 折射/处理后的画面(col)直接不透明地覆盖背景，不再与背景按比例混合 -> 彻底去掉半透明。
    // 不再用 col*body 压暗边缘、也不再用 glassA 衰减 alpha，故边缘那一圈折射画面同样保持不透明、不发黑。
    // uOpacity 仍保留：默认 1.0（全不透明），需要时可下调回半透明。
    fragColor = vec4(col, shapeMask * uOpacity);
}
`;

  function toSafeNumber(value) {
    if (Scratch.Cast && typeof Scratch.Cast.toNumber === 'function') {
      return Scratch.Cast.toNumber(value);
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  // 把 Scratch 颜色积木返回的颜色（hex 字符串，如 "#ff8800" / "#f80" / "#ff8800ff"）转为 0~1 归一化 RGB。
  // 非法值回退为 [0,0,0]（黑色），由着色器 uTint.a 决定是否生效（a=0 不染色）。
  function hexToRgbNormalized(hex) {
    if (typeof hex !== 'string') return [0, 0, 0];
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length === 8) {
      // 末尾 alpha 舍弃，透明度由积木的 ALPHA 参数单独控制
      h = h.substring(0, 6);
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
    const r = parseInt(h.substring(0, 2), 16) / 255;
    const g = parseInt(h.substring(2, 4), 16) / 255;
    const b = parseInt(h.substring(4, 6), 16) / 255;
    return [r, g, b];
  }

  // =========================================================================
  // 柔和弹簧（SwiftUI spring(duration:bounce:) 解析解，bounce=0 临界阻尼）
  // 用于液体玻璃的「柔和弹簧」动画模式，与物理弹簧(v+=d/s;v*=0.8)并列。
  // =========================================================================
  class GlassSpring {
    constructor(duration) {
      this.duration = Math.max(0.05, duration);
      this.omega0 = (2 * Math.PI) / this.duration;
      this.zeta = 1; // bounce=0 => 临界阻尼
      this._settleTime = null;
    }
    valueAtTime(t) {
      if (t <= 0) return 0;
      const w = this.omega0, e = Math.exp(-w * t);
      return 1 - e * (1 + w * t);
    }
    settleTime() {
      if (this._settleTime !== null) return this._settleTime;
      const maxT = this.duration * 10, step = maxT / 2000;
      let settle = this.duration;
      for (let t = maxT; t > 0; t -= step) {
        if (Math.abs(this.valueAtTime(t) - 1) >= 0.001) { settle = t + step; break; }
      }
      this._settleTime = Math.min(Math.max(settle, this.duration), maxT);
      return this._settleTime;
    }
  }

  function createGlassState(id) {
    return {
      id: id,
      x: 0,
      y: 0,
      direction: 90,
      width: 100,
      height: 100,
      refraction: 0.25,
      targetRefraction: 0.25,
      opacity: 1.0,
      cornerRadius: 300,
      cornerStyle: 'G3',
      tint: [0, 0, 0, 0],
      blur: 0,
      highlight: 100,
      dispersion: 5,
      velocityX: 0,
      velocityY: 0,
      prevX: 0,
      prevY: 0,
      springX: 0,
      springY: 0,
      springVX: 0,
      springVY: 0,
      followMouse: false,
      followVX: 0,
      followVY: 0,
      followLastTime: 0,

      // ================= 统一动画状态 =================
      // 每个属性独立：mode='physics'|'spring', 控制使用哪种算法。
      // 物理模式：v += d/speed; v *= 0.8（原有丝滑动画，可打断、惯性延续）
      // 弹簧模式：SwiftUI 临界阻尼解析解，按时间参数化推进
      //
      // 位置动画（x / y 联动）
      animMove: false,
      animMoveMode: 'physics',
      animMoveTX: 0,
      animMoveTY: 0,
      animMoveVX: 0,
      animMoveVY: 0,
      animMoveSpeed: 12,
      animMoveDuration: 0.5,
      animMoveElapsed: 0,
      animMoveSpring: null,
      animMoveTotalTime: 0,
      animMoveFromX: 0,
      animMoveFromY: 0,
      animMoveResolve: null,
      // 长度动画（g.width）—— 与宽度动画完全独立
      animW: false,
      animWMode: 'physics',
      animWT: 100,
      animWV: 0,
      animWSpeed: 12,
      animWDuration: 0.5,
      animWElapsed: 0,
      animWSpring: null,
      animWTotalTime: 0,
      animWFrom: 0,
      animWResolve: null,
      // 宽度动画（g.height）—— 与长度动画完全独立
      animH: false,
      animHMode: 'physics',
      animHT: 100,
      animHV: 0,
      animHSpeed: 12,
      animHDuration: 0.5,
      animHElapsed: 0,
      animHSpring: null,
      animHTotalTime: 0,
      animHFrom: 0,
      animHResolve: null,
      // 「大小」动画：同时缩放长和宽，保持宽高比
      animScale: false,
      animScaleMode: 'physics',
      animScaleT: 100,
      animScaleV: 0,
      animScaleSpeed: 12,
      animScaleDuration: 0.5,
      animScaleElapsed: 0,
      animScaleSpring: null,
      animScaleTotalTime: 0,
      animScaleFrom: 0,
      animScaleRatio: 1,
      animScaleResolve: null,

      // ================= Apple 物理特性（内置鼠标跟随 + 速度变形）=================
      // 开启后每帧自动：玻璃自身移动时 1) 长度随速度拉伸 2) 宽度反向收缩(面积守恒)
      // 不绑定鼠标，玻璃被任何方式移动（动画/手动设坐标）都会触发变形，停下即回弹。
      // 变形叠加在「基础长宽」之上：静止时显示为 baseWidth×baseHeight（用户可改，不再强制50）。
      applePhysics: false,
      physPrevX: 0,          // 上一帧玻璃x（用于计算自身速度）
      physPrevY: 0,          // 上一帧玻璃y
      baseWidth: 100,        // 基础长度（静止时的显示长度，由设长宽/动画驱动）
      baseHeight: 100,       // 基础宽度（静止时的显示宽度）
      physStretch: 0,        // 当前平滑拉伸量（向目标速度/2 渐变）
      physDuration: 0.3      // 拉伸/收缩的平滑时长（秒），越大越柔和
    };
  }

  class WebGLLiquidGlass {
    constructor(runtimeRef) {
      this.runtime = runtimeRef;

      this.glasses = [];

      this.canvas = null;
      this.gl = null;
      this.program = null;
      this.vao = null;
      this.vertexBuffer = null;
      this.stageTexture = null;
      this._stage2D = null;
      this._stage2DCtx = null;
      this.uniformLocations = {};

      this.rafHandle = null;

      this.startTime = 0;
      this.lastFrameTime = 0;

      this._warmupFrames = 0;
      this._lastCanvasW = 0;
      this._lastCanvasH = 0;
      this._textureUploadOk = false;
      // 覆盖层相对父容器的对齐缓存（避免每帧触发 reflow）
      this._lastOverlayRect = null;
      this._originalRendererDraw = null;
      this._wrappedRendererDraw = null;
      this._isDrawingFrame = false;
      // 标记「本帧舞台已由钩子渲染过」：true 时 _drawFrame 跳过强制刷新，避免重复开销；
      // 独立循环路径下为 false，_drawFrame 会先刷新一次舞台再抓图，杜绝抓到上一帧。
      this._stageRenderedThisFrame = false;

      // [优化4] 纹理尺寸追踪（用于 texSubImage2D 复用判断）
      this._texW = 0;
      this._texH = 0;

      // [优化5] mipmap 状态追踪（避免重复设置纹理过滤参数）
      this._mipmapEnabled = false;

      // [优化7] 自适应分辨率缩放
      this._renderScale = 1.0;
      this._frameTimes = [];
      this._scaleCheckCounter = 0;

      this._onContextLost = this._onContextLost.bind(this);
      this._onContextRestored = this._onContextRestored.bind(this);
      this._boundDrawFrame = this._drawFrame.bind(this);
      this._boundOnResize = this._onWindowResize.bind(this);

      this._followRAF = null;

      // ── 渲染帧率控制（30~60）──
      // 突破 Scratch 默认 30fps：额外跑一条独立 RAF 渲染循环，配合节流器把实际渲染
      // 频率稳定到 _targetFPS。hook 的 draw 与独立循环共用同一个节流器 _throttledDraw：
      //  - 目标 30fps：Scratch draw(30) 已够，独立循环的多余触发被节流跳过；
      //  - 目标 60fps：Scratch draw 只贡献 30，独立循环补足到 60。
      // 二者合并后总渲染频率被限制在 _targetFPS 附近，既不超频也不重复渲染。
      this._targetFPS = 60;
      this._minFrameInterval = 1000 / 60;
      this._lastRenderTime = 0;
      this._renderLoopRAF = null;
      this._boundThrottledDraw = this._throttledDraw.bind(this);
      this._boundRenderLoop = this._renderLoop.bind(this);

      this._hookRendererDraw();
      this._ensureCanvas();

      window.addEventListener('resize', this._boundOnResize, false);
    }

    _onWindowResize() {
      if (!this.gl || !this.canvas || this.glasses.length === 0) return;
      this._lastCanvasW = 0;
      this._lastCanvasH = 0;
      this._texW = 0;
      this._texH = 0;
      this._warmupFrames = Math.max(this._warmupFrames, 2);
      this._textureUploadOk = false;
      this._syncOverlayStyle();

      let attempts = 0;
      const self = this;
      const scheduleForceDraw = () => {
        if (attempts >= 3) return;
        attempts++;
        requestAnimationFrame(() => {
          const renderer = self.runtime && self.runtime.renderer;
          if (renderer && typeof renderer.draw === 'function') {
            renderer.draw();
          } else {
            self._boundDrawFrame();
          }
          scheduleForceDraw();
        });
      };
      scheduleForceDraw();
    }

    _hookRendererDraw() {
      const renderer = this.runtime && this.runtime.renderer;
      if (!renderer || typeof renderer.draw !== 'function') return;
      if (renderer.draw === this._wrappedRendererDraw) return;

      if (!this._originalRendererDraw || renderer.draw !== this._originalRendererDraw) {
        this._originalRendererDraw = renderer.draw;
      }

      const self = this;
      this._wrappedRendererDraw = function () {
        if (self.glasses.length > 0 && self.gl && this.dirty !== undefined) {
          this.dirty = true;
        }
        const result = self._originalRendererDraw.apply(this, arguments);
        if (self.glasses.length > 0 && self.gl) {
          try {
            // 标记舞台已渲染，_drawFrame 据此跳过重复刷新（仅独立循环路径才需要刷新）
            self._stageRenderedThisFrame = true;
            self._boundThrottledDraw();
            self._stageRenderedThisFrame = false;
          } catch (err) {
            console.error('[WebGL 液体玻璃] 绘制失败:', err);
          }
        }
        return result;
      };
      renderer.draw = this._wrappedRendererDraw;
    }

    _unhookRendererDraw() {
      const renderer = this.runtime && this.runtime.renderer;
      if (renderer && this._originalRendererDraw) {
        renderer.draw = this._originalRendererDraw;
        this._originalRendererDraw = null;
        this._wrappedRendererDraw = null;
      }
    }

    getInfo() {
      return {
        id: 'webglLiquidGlass',
        name: 'WebGL 液体玻璃',
        color1: '#4FC3F7',
        color2: '#0288D1',
        color3: '#01579B',
        blocks: [
          {
            opcode: 'createGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '创建编号为 [ID] 的液体玻璃',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'deleteGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '删除液体玻璃 [ID]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'deleteAllGlasses',
            blockType: Scratch.BlockType.COMMAND,
            text: '删除全部液体玻璃'
          },
          '---',
          {
            opcode: 'setX',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] X 坐标设为 [X]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'setY',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] Y 坐标设为 [Y]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
            Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
          }
        },
        {
          opcode: 'setDirection',
          blockType: Scratch.BlockType.COMMAND,
          text: '把液体玻璃 [ID] 面向 [DIRECTION]',
          arguments: {
            ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
            DIRECTION: { type: Scratch.ArgumentType.NUMBER, defaultValue: 90 }
          }
        },
        {
          opcode: 'setDirectionToMouse',
          blockType: Scratch.BlockType.COMMAND,
          text: '把液体玻璃 [ID] 面向鼠标指针',
          arguments: {
            ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
          }
        },
        '---',
        {
          opcode: 'animProp',
            blockType: Scratch.BlockType.COMMAND,
            text: '把液体玻璃 [ID] 的 [ANIM] 按照 [PROP] 方式移动到 [V]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              ANIM: { type: Scratch.ArgumentType.STRING, menu: 'animTypeMenu' },
              PROP: { type: Scratch.ArgumentType.STRING, menu: 'glassPropMenu' },
              V: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          {
            opcode: 'animMoveTo',
            blockType: Scratch.BlockType.COMMAND,
            text: '把液体玻璃 [ID] 的 [ANIM] 按照 [PROP] 方式移动到 x [X] y [Y]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              ANIM: { type: Scratch.ArgumentType.STRING, menu: 'animTypeMenu' },
              PROP: { type: Scratch.ArgumentType.STRING, menu: 'glassPropMenu' },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          '---',
          {
            opcode: 'setApplePhysics',
            blockType: Scratch.BlockType.COMMAND,
            text: '液体玻璃 [ID] 的 [MODE] 物理特性 平滑时长 [DURATION] 秒',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              MODE: { type: Scratch.ArgumentType.STRING, menu: 'physicsModeMenu' },
              DURATION: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.3 }
            }
          },
          '---',
          {
            opcode: 'setWidth',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 长设为 [WIDTH]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              WIDTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          {
            opcode: 'setHeight',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 宽设为 [HEIGHT]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              HEIGHT: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          '---',
          {
            opcode: 'setRefraction',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 折射强度设为 [REFRACTION]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              REFRACTION: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.25 }
            }
          },
          {
            opcode: 'setOpacity',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 透明度设为 [OPACITY]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              OPACITY: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'setCornerRadius',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 的 [STYLE] 圆角半径设置为 [RADIUS]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              STYLE: { type: Scratch.ArgumentType.STRING, menu: 'cornerStyleMenu', defaultValue: 'G3' },
              RADIUS: { type: Scratch.ArgumentType.NUMBER, defaultValue: 20 }
            }
          },
          {
            opcode: 'setEdgeThickness',
            blockType: Scratch.BlockType.COMMAND,
            text: '把液体玻璃 [ID] 的折射边缘厚度设置为 [THICKNESS]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              THICKNESS: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0.18 }
            }
          },
          {
            opcode: 'setBlur',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 的模糊设为 [BLUR]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              BLUR: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'setHighlight',
            blockType: Scratch.BlockType.COMMAND,
            text: '将液体玻璃 [ID] 的高光强度设为 [STRENGTH]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              STRENGTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 100 }
            }
          },
          {
            opcode: 'setDispersion',
            blockType: Scratch.BlockType.COMMAND,
            text: '设置液体玻璃 [ID] 的色散为 [DISPERSION]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              DISPERSION: { type: Scratch.ArgumentType.NUMBER, defaultValue: 5 }
            }
          },
          {
            opcode: 'dyeGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '把液体玻璃 [ID] 染色为 [COLOR] 透明度 [ALPHA]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              COLOR: { type: Scratch.ArgumentType.COLOR, defaultValue: '#ff8800' },
              ALPHA: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 }
            }
          },
          {
            opcode: 'clearDye',
            blockType: Scratch.BlockType.COMMAND,
            text: '清除液体玻璃 [ID] 的染色',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          '---',
          {
            opcode: 'setFPS',
            blockType: Scratch.BlockType.COMMAND,
            text: '将渲染帧率设为 [FPS]',
            arguments: {
              FPS: { type: Scratch.ArgumentType.NUMBER, defaultValue: 60 }
            }
          },
          '---',
          {
            opcode: 'renderAllGlasses',
            blockType: Scratch.BlockType.COMMAND,
            text: '渲染全部液体玻璃'
          },
          '---',
          {
            opcode: 'getGlassInfoJSON',
            blockType: Scratch.BlockType.REPORTER,
            text: '液体玻璃 [ID]（值）的信息（json输出）',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'getGlassCount',
            blockType: Scratch.BlockType.REPORTER,
            text: '液体玻璃数'
          }
        ],
        menus: {
          cornerStyleMenu: {
            items: ['G2', 'G3', '三分之一', '四分之一']
          },
          followList: {
            items: ['开启', '关闭']
          },
          animTypeMenu: {
            items: ['柔和弹簧', '物理弹簧']
          },
          glassPropMenu: {
            items: ['大小', 'x', 'y', '长', '宽']
          },
          physicsModeMenu: {
            items: ['开启', '关闭']
          }
        }
      };
    }

    _findGlass(id) {
      const numId = Math.round(toSafeNumber(id));
      return this.glasses.find(g => g.id === numId) || null;
    }

    _ensureCanvas() {
      if (this.canvas) return;

      const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
      if (!stageCanvas || !stageCanvas.parentElement) {
        setTimeout(() => this._ensureCanvas(), 100);
        return;
      }

      const container = stageCanvas.parentElement;
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      const existing = container.querySelector('#' + OVERLAY_CANVAS_ID);
      if (existing) existing.remove();

      const canvas = document.createElement('canvas');
      canvas.id = OVERLAY_CANVAS_ID;
      canvas.style.position = 'absolute';
      canvas.style.margin = '0';
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '1';
      // 注：尺寸/位置不写死 100%，改由 _syncOverlayStyle 对齐到舞台画布，
      // 否则覆盖层会被父容器拉伸（创建时舞台上下拉伸、删除后恢复的 bug）

      container.appendChild(canvas);
      this.canvas = canvas;
      this._syncOverlayStyle();

      canvas.addEventListener('webglcontextlost', this._onContextLost, false);
      canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);

      // [优化2] antialias: false —— SDF smoothstep 已提供边缘 AA，MSAA 纯浪费填充率
      //         （Intel GPU 上 MSAA 4x 约降低 40% 填充性能）
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false
      });

      if (!gl) {
        console.error('[WebGL 液体玻璃] 当前环境不支持 WebGL2，扩展无法渲染。');
        return;
      }

      this.gl = gl;

      try {
        this._initGL();
      } catch (error) {
        console.error('[WebGL 液体玻璃] 初始化失败:', error);
      }

      this._hookRendererDraw();
    }

    _onContextLost(event) {
      event.preventDefault();
      // 注意：不要在此隐藏覆盖层（display:none），反复显隐会触发 WebGL 上下文
      // 丢失/恢复死循环，导致不间断黑闪；上下文丢失期间画布随舞台一起不可见，无影响。
    }

    _onContextRestored() {
      try {
        this._initGL();
      } catch (error) {
        console.error('[WebGL 液体玻璃] 重新初始化失败:', error);
        return;
      }
      this._warmupFrames = 2;
      this._textureUploadOk = false;
      this._texW = 0;
      this._texH = 0;
      this._mipmapEnabled = false;
      // 上下文恢复后立刻用当前帧舞台重新绘制一次（显示由 _drawFrame 按可见性自行管理）
      this._requestRedraw();
    }

    _compileShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('着色器编译失败: ' + info);
      }
      return shader;
    }

    _initGL() {
      const gl = this.gl;
      if (!gl) return;

      const vertexShader = this._compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
      const fragmentShader = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        throw new Error('着色器程序链接失败: ' + info);
      }

      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      this.program = program;

      this.uniformLocations = {
        uCenter: gl.getUniformLocation(program, 'uCenter'),
        uHalfSize: gl.getUniformLocation(program, 'uHalfSize'),
        uHalfStage: gl.getUniformLocation(program, 'uHalfStage'),
        uRotation: gl.getUniformLocation(program, 'uRotation'),
        uStageTexture: gl.getUniformLocation(program, 'uStageTexture'),
        uResolution: gl.getUniformLocation(program, 'uResolution'),
        uRefraction: gl.getUniformLocation(program, 'uRefraction'),
        uDiameter: gl.getUniformLocation(program, 'uDiameter'),
        uOpacity: gl.getUniformLocation(program, 'uOpacity'),
        uCornerRadius: gl.getUniformLocation(program, 'uCornerRadius'),
        uCornerExponent: gl.getUniformLocation(program, 'uCornerExponent'),
        uCornerExponentInv: gl.getUniformLocation(program, 'uCornerExponentInv'),
        uRoundedBox: gl.getUniformLocation(program, 'uRoundedBox'),
        uBlur: gl.getUniformLocation(program, 'uBlur'),
        uTint: gl.getUniformLocation(program, 'uTint'),
        uHighlight: gl.getUniformLocation(program, 'uHighlight'),
        uDispersion: gl.getUniformLocation(program, 'uDispersion')
      };

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -0.5, -0.5,
           0.5, -0.5,
          -0.5,  0.5,
           0.5,  0.5
        ]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      this.vao = vao;
      this.vertexBuffer = vertexBuffer;

      this.stageTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.stageTexture);
      // [优化5] 默认 LINEAR（无 mipmap），仅当有玻璃开启模糊时切换为 LINEAR_MIPMAP_LINEAR
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);

      this._mipmapEnabled = false;
    }

    _getStageSize() {
      const w = this.runtime.stageWidth || 480;
      const h = this.runtime.stageHeight || 360;
      return [w, h];
    }

    // [优化7] 自适应分辨率：canvas 内部分辨率 = 舞台分辨率 * _renderScale
    //         CSS 宽高由 _syncOverlayStyle 对齐到舞台画布（不再写死 100%），
    //         弱 GPU 上 _renderScale 降到 0.5，填充率降为 1/4，渲染像素数降为 1/4。
    _syncCanvasResolution() {
      const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
      if (!stageCanvas || !this.canvas) return false;
      const targetW = Math.max(1, Math.round(stageCanvas.width * this._renderScale));
      const targetH = Math.max(1, Math.round(stageCanvas.height * this._renderScale));
      if (targetW <= 0 || targetH <= 0) return false;

      let changed = false;
      if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.canvas.width = targetW;
        this.canvas.height = targetH;
        changed = true;
      }
      return changed;
    }

    // 让覆盖画布精确对齐到舞台画布本身的显示区域（而不是 100% 撑满父容器）。
    // 舞台画布在编辑器中常以「信箱式」居中显示（父容器比 4:3 更高/更宽、上下留黑边），
    // 若覆盖层 100% 撑满父容器，背景 pass 重画的舞台纹理就会被拉伸，
    // 表现为创建玻璃后舞台上下拉伸、删除后恢复。对齐到舞台画布即可消除拉伸。
    _syncOverlayStyle() {
      const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
      const canvas = this.canvas;
      if (!stageCanvas || !canvas || !canvas.parentElement) return;

      const container = canvas.parentElement;
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }

      const left = stageCanvas.offsetLeft;
      const top = stageCanvas.offsetTop;
      const width = stageCanvas.offsetWidth;
      const height = stageCanvas.offsetHeight;
      const key = left + ',' + top + ',' + width + ',' + height;
      if (this._lastOverlayRect === key) return;
      this._lastOverlayRect = key;

      canvas.style.left = left + 'px';
      canvas.style.top = top + 'px';
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }

    _drawFrame() {
      if (this._isDrawingFrame) return;
      this._isDrawingFrame = true;
      const frameStartTime = performance.now();
      try {
        const gl = this.gl;
        if (!gl || !this.program) return;
        if (gl.isContextLost()) return;
        if (this.glasses.length === 0) return;

        const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
        if (!stageCanvas || stageCanvas.width <= 0 || stageCanvas.height <= 0) {
          // 舞台不可见（最小化/隐藏/尺寸为 0）：把覆盖层清为透明并跳过玻璃绘制，
          // 避免绘制缓冲被丢弃后露出黑色。覆盖层始终保持 display:block，避免反复显隐触发 WebGL 上下文丢失/恢复死循环。
          gl.viewport(0, 0, this.canvas.width || 1, this.canvas.height || 1);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          return;
        }
        // 若上一版曾把覆盖层置为 display:none（残留），这里仅在确实为 none 时恢复为 block，
        // 并强制用当前帧纹理重传。该分支不会逐帧触发，不会造成显隐抖动。
        if (this.canvas && this.canvas.style.display === 'none') {
          this.canvas.style.display = 'block';
          this._texW = 0;
          this._texH = 0;
          this._warmupFrames = Math.max(this._warmupFrames, 2);
          this._textureUploadOk = false;
        }

        // 确保覆盖层始终精确对齐舞台画布（处理布局变化/滚动/缩放）
        this._syncOverlayStyle();

        const sizeChanged = this._syncCanvasResolution();
        if (sizeChanged || this.canvas.width !== this._lastCanvasW || this.canvas.height !== this._lastCanvasH) {
          this._warmupFrames = Math.max(this._warmupFrames, 2);
          this._textureUploadOk = false;
          this._lastCanvasW = this.canvas.width;
          this._lastCanvasH = this.canvas.height;
        }

        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;
        gl.viewport(0, 0, canvasW, canvasH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const now = performance.now();
        if (this.startTime === 0) {
          this.startTime = now;
          this.lastFrameTime = now;
        }
        const dt = Math.min((now - this.lastFrameTime) / 1000, 0.032);
        const [stageW, stageH] = this._getStageSize();

        const interpSpeed = 30.0;
        for (const g of this.glasses) {
          g.refraction += (g.targetRefraction - g.refraction) * Math.min(1.0, interpSpeed * dt);
          if (Math.abs(g.targetRefraction - g.refraction) < 0.001) {
            g.refraction = g.targetRefraction;
          }
        }

        // ── 可打断丝滑动画：由主循环统一推进（位置 / 长度 / 宽度）──
        this._stepAnimations(dt);

        this.lastFrameTime = now;

        // ── 抓图前确保舞台是当前帧 ──
        // 钩子路径已在调用前渲染过舞台（_stageRenderedThisFrame=true），直接抓图即可；
        // 独立循环路径未渲染，这里强制刷新一次：既不强制 dirty（静止场景 original 会跳过、
        // 画布仍保持上一帧=同一内容，不会抖），内容变动时(dirty)则真正重渲染到当前帧，
        // 从而消除「着色器采样到上一帧纹理 → 角色在当前/上一帧间来回跳」的抖动。
        if (!this._stageRenderedThisFrame) {
          const renderer = this.runtime && this.runtime.renderer;
          if (renderer && this._originalRendererDraw) {
            try { this._originalRendererDraw.apply(renderer, []); } catch (e) {}
          }
        }

        // ── 上传舞台画面到纹理 ──
        // 关键修复：绝不直接把 Scratch 的 WebGL 舞台画布 gl.texImage2D 进另一个 WebGL 上下文。
        // 源上下文默认 preserveDrawingBuffer:false，其绘制缓冲在浏览器合成后即被清空，
        // 跨上下文直接读取在多数帧拿到的是空/黑缓冲 → 玻璃持续黑闪（创建起就黑）。
        // 改为先 2D 画布 drawImage(stageCanvas) 在调用瞬间对舞台做可靠快照（不受源
        // preserveDrawingBuffer 影响），再从 2D 画布上传纹理。快照失败则保留上一帧纹理，
        // 绝不拿黑纹理去渲染。
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.stageStatus || this.stageTexture);

        const sw = stageCanvas.width;
        const sh = stageCanvas.height;

        if (!this._stage2D) {
          this._stage2D = document.createElement('canvas');
          this._stage2DCtx = this._stage2D.getContext('2d');
        }
        if (this._stage2D.width !== sw || this._stage2D.height !== sh) {
          this._stage2D.width = sw;
          this._stage2D.height = sh;
        }

        let captured = false;
        try {
          this._stage2DCtx.drawImage(stageCanvas, 0, 0);
          captured = true;
        } catch (e) {
          captured = false;
        }

        if (!captured && !this._textureUploadOk) {
          // 从未成功上传过纹理：本帧无有效舞台画面，跳过玻璃绘制（覆盖层已在前面 clear 为透明）
          return;
        }

        if (captured) {
          // [优化4] texSubImage2D 复用纹理：尺寸不变时跳过重新分配，仅更新像素数据
          if (this._texW === sw && this._texH === sh) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this._stage2D);
          } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._stage2D);
            this._texW = sw;
            this._texH = sh;
          }
          this._textureUploadOk = true;
        }

        // [优化5] 条件化 mipmap：仅当至少一个玻璃开启了模糊（blur > 0）时才生成 mipmap。
        //         无模糊时 textureLod LOD=0 等价于普通 texture() 采样，不需要 mipmap。
        //         generateMipmap 对 480x360 纹理在 Intel GPU 上约 3-15ms，跳过它是最大收益。
        const anyBlur = this.glasses.some(g => g.blur > 0);
        if (anyBlur) {
          if (!this._mipmapEnabled) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            this._mipmapEnabled = true;
          }
          gl.generateMipmap(gl.TEXTURE_2D);
        } else {
          if (this._mipmapEnabled) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            this._mipmapEnabled = false;
          }
        }

        // [warmup] 尺寸刚变化（最小化/最大化/缩放/上下文恢复）的最初几帧，
        // 舞台画布可能正被 Scratch 重设为黑、抓到的纹理会是黑的。
        // 此时跳过玻璃绘制（覆盖层已在前面 clear 为透明），等舞台重新渲染好再画，杜绝黑闪。
        if (this._warmupFrames > 0) {
          this._warmupFrames--;
          return;
        }

        // 2) 玻璃透镜：只绘制玻璃本身，覆盖层玻璃区域以外保持透明，
        //    让 Scratch 实时舞台（含被拖动的角色）直接透出显示，
        //    避免“整屏重绘抓取到的舞台副本”带来的 1 帧延迟/抖动。
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.uniform1i(this.uniformLocations.uStageTexture, 0);
        gl.uniform2f(this.uniformLocations.uResolution, canvasW, canvasH);
        gl.uniform2f(this.uniformLocations.uHalfStage, stageW / 2, stageH / 2);

        for (const g of this.glasses) {
          const halfW = (g.width / 2.0) * 1.0625;
          const halfH = (g.height / 2.0) * 1.0625;
          const diameter = Math.min(g.width, g.height);

          gl.uniform2f(this.uniformLocations.uCenter, g.x, g.y);
          gl.uniform2f(this.uniformLocations.uHalfSize, halfW, halfH);
          // Scratch 方向约定：90=右(不旋转)、0=上、-90/270=左、180=下。
          // 换算为数学角（从 +X 轴逆时针）：θ = (90 - direction) 度
          gl.uniform1f(this.uniformLocations.uRotation, (90 - (g.direction || 90)) * Math.PI / 180);
          gl.uniform1f(this.uniformLocations.uDiameter, diameter);
          gl.uniform1f(this.uniformLocations.uRefraction, g.refraction);
          gl.uniform1f(this.uniformLocations.uOpacity, g.opacity);
          gl.uniform1f(this.uniformLocations.uCornerRadius, g.cornerRadius);
          const rounded = (g.cornerStyle === 'G2' || g.cornerStyle === '四分之一');
          gl.uniform1f(this.uniformLocations.uRoundedBox, rounded ? 1.0 : 0.0);
          if (!rounded) {
            const exp = (g.cornerStyle === '三分之一') ? 3.0 : 4.0;
            gl.uniform1f(this.uniformLocations.uCornerExponent, exp);
            gl.uniform1f(this.uniformLocations.uCornerExponentInv, 1.0 / exp);
          }
          gl.uniform1f(this.uniformLocations.uBlur, Math.min(100, Math.max(0, g.blur)) / 100.0);
          gl.uniform4f(this.uniformLocations.uTint, g.tint[0], g.tint[1], g.tint[2], g.tint[3]);
          gl.uniform1f(this.uniformLocations.uHighlight, g.highlight / 100.0);
          gl.uniform1f(this.uniformLocations.uDispersion, g.dispersion);

          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        gl.bindVertexArray(null);

        // [优化7] 自适应分辨率：监控渲染帧时间，弱 GPU 上自动降分辨率
        this._adaptResolution(frameStartTime);
      } finally {
        this._isDrawingFrame = false;
      }
    }

    // [优化7] 自适应分辨率缩放
    //   原理：每 30 帧统计平均渲染耗时，如果 > 22ms（约 45fps）则降低 _renderScale，
    //         如果 < 14ms（约 70fps）且当前低于 1.0 则尝试提升。
    //   范围：0.5 ~ 1.0，步进 0.1（降）/ 0.05（升，保守恢复）
    //   效果：A1534 上通常稳定在 0.6~0.8，渲染像素数降为 36%~64%，CSS 拉伸无明显画质损失
    //         （液体玻璃本身有折射/模糊效果，分辨率降低几乎不可见）
    _adaptResolution(frameStartTime) {
      const frameTime = performance.now() - frameStartTime;
      this._frameTimes.push(frameTime);
      if (this._frameTimes.length > 30) this._frameTimes.shift();

      this._scaleCheckCounter++;
      if (this._scaleCheckCounter < 30) return;
      this._scaleCheckCounter = 0;

      const avg = this._frameTimes.reduce(function (a, b) { return a + b; }, 0) / this._frameTimes.length;

      if (avg > 22 && this._renderScale > 0.5) {
        // 降分辨率：帧时间过高，降低渲染缩放比
        this._renderScale = Math.max(0.5, Math.round((this._renderScale - 0.1) * 10) / 10);
        this._lastCanvasW = 0;
        this._lastCanvasH = 0;
        this._frameTimes = [];
      } else if (avg < 14 && this._renderScale < 1.0) {
        // 升分辨率：帧时间充裕，尝试恢复分辨率（保守步进 0.05）
        this._renderScale = Math.min(1.0, Math.round((this._renderScale + 0.05) * 100) / 100);
        this._lastCanvasW = 0;
        this._lastCanvasH = 0;
        this._frameTimes = [];
      }
    }

    // 节流器：hook 的 draw 与独立渲染循环都经过这里，把实际渲染频率限制到 _targetFPS。
    // -1ms 容差：避免 RAF 抖动导致某一帧刚好差零点几毫秒被误跳、掉到半速帧率。
    _throttledDraw() {
      const now = performance.now();
      if (now - this._lastRenderTime < this._minFrameInterval - 1.0) return;
      this._lastRenderTime = now;
      this._drawFrame();
    }

    // 独立 RAF 渲染循环：在 Scratch draw 之外补足帧，使玻璃能达到 30~60 目标帧率。
    _renderLoop() {
      if (this.glasses.length === 0) {
        this._renderLoopRAF = null;
        return;
      }
      this._boundThrottledDraw();
      this._renderLoopRAF = requestAnimationFrame(this._boundRenderLoop);
    }

    _stopLoop() {
      if (this._renderLoopRAF !== null) {
        cancelAnimationFrame(this._renderLoopRAF);
        this._renderLoopRAF = null;
      }
    }

    _startLoop() {
      if (this._renderLoopRAF !== null) return;
      if (this.glasses.length === 0) return;
      this._renderLoopRAF = requestAnimationFrame(this._boundRenderLoop);
    }

    createGlass(args) {
      const id = Math.round(toSafeNumber(args.ID));
      const existingIdx = this.glasses.findIndex(g => g.id === id);
      if (existingIdx !== -1) {
        this.glasses.splice(existingIdx, 1);
      }
      const glass = createGlassState(id);
      this.glasses.push(glass);

      if (!this.gl) {
        this._ensureCanvas();
      }
      this._hookRendererDraw();
      if (this.startTime === 0) {
        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;
      }
      this._warmupFrames = Math.max(this._warmupFrames, 2);
      this._textureUploadOk = false;

      requestAnimationFrame(() => {
        const renderer = this.runtime && this.runtime.renderer;
        if (renderer && typeof renderer.draw === 'function') {
          renderer.draw();
        } else if (this.gl && this.glasses.length > 0) {
          this._boundDrawFrame();
        }
      });

      this._startLoop();
    }

    // 删除玻璃前先解阻塞其所有挂起的动画 Promise，避免等待中的脚本永久卡死
    _resolveAllAnims(g) {
      this._resolveAnim(g, 'animMoveResolve');
      this._resolveAnim(g, 'animWResolve');
      this._resolveAnim(g, 'animHResolve');
      this._resolveAnim(g, 'animScaleResolve');
    }

    deleteGlass(args) {
      const id = Math.round(toSafeNumber(args.ID));
      const idx = this.glasses.findIndex(g => g.id === id);
      if (idx !== -1) {
        this._resolveAllAnims(this.glasses[idx]);
        this.glasses.splice(idx, 1);
      }
      this._onGlassesChanged();
    }

    deleteAllGlasses() {
      for (const g of this.glasses) {
        this._resolveAllAnims(g);
      }
      this.glasses = [];
      this._onGlassesChanged();
    }

    _onGlassesChanged() {
      const gl = this.gl;
      if (gl && this.canvas) {
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      if (this.glasses.length === 0) {
        this._unhookRendererDraw();
        this._stopLoop();
        this._warmupFrames = 0;
        this._textureUploadOk = false;
      }
    }

    setX(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        // 即时设定坐标：立即停止正在进行的位置动画，避免与动画循环相互覆盖
        g.animMove = false;
        g.animMoveVX = 0;
        g.animMoveVY = 0;
        this._resolveAnim(g, 'animMoveResolve');
        g.x = toSafeNumber(args.X);
      }
    }

    setY(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        g.animMove = false;
        g.animMoveVX = 0;
        g.animMoveVY = 0;
        this._resolveAnim(g, 'animMoveResolve');
        g.y = toSafeNumber(args.Y);
      }
    }

    // 设置玻璃朝向（Scratch 方向：90=右、0=上、-90=左、180=下）。
    // 玻璃整体绕自身中心旋转，形状/圆角/折射随之一同旋转。
    setDirection(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        let dir = toSafeNumber(args.DIRECTION);
        // 归一化到 -180~180，与 Scratch 方向显示习惯一致
        dir = ((dir + 180) % 360 + 360) % 360 - 180;
        g.direction = dir;
      }
    }

    // 让玻璃朝向鼠标指针（与 Scratch「面向鼠标指针」方向规则一致）。
    // 玻璃转轴 = 自身中心；鼠标位置用舞台坐标（Scratch 坐标系）计算。
    setDirectionToMouse(args) {
      const g = this._findGlass(args.ID);
      if (!g) return;
      const mouse = this.runtime.ioDevices && this.runtime.ioDevices.mouse;
      if (!mouse) return;
      const dx = mouse.getScratchX() - g.x;
      const dy = mouse.getScratchY() - g.y;
      // 鼠标正好压在玻璃中心时保持原方向，避免 atan2(0,0) 方向跳变
      if (dx * dx + dy * dy < 1e-9) return;
      let dir = 90 - Math.atan2(dy, dx) * 180 / Math.PI;
      // 归一化到 -180~180
      g.direction = ((dir + 180) % 360 + 360) % 360 - 180;
    }

    _requestRedraw() {
      const renderer = this.runtime && this.runtime.renderer;
      if (renderer && typeof renderer.draw === 'function') {
        renderer.draw();
      } else if (this.gl && this.glasses.length > 0) {
        this._boundDrawFrame();
      }
    }

    // 立即结束某条动画的等待（Promise），供打断/完成时调用。
    // 打断时会先调这个把上一个脚本解阻塞，但不会清零对应速度，
    // 从而让新目标从当前速度平滑改向（惯性延续，无跳变）。
    _resolveAnim(g, key) {
      const r = g[key];
      if (r) {
        g[key] = null;
        r();
      }
    }

    // 由主渲染循环每帧调用，统一推进所有玻璃的动画。
    // 支持两种算法：物理弹簧(v+=d/s;v*=0.8) 和 柔和弹簧(SwiftUI 临界阻尼解析解)。
    // 每条动画独立（独立的目标值、速度/时间、开关），互不干扰、可同时运行。
    _stepAnimations(dt) {
      const f = Math.min(2.0, Math.max(0.0001, dt * 60));
      const damp = Math.pow(0.8, f);

      for (const g of this.glasses) {
        // —— 位置动画（x / y）——
        if (g.animMove) {
          if (g.animMoveMode === 'spring') {
            g.animMoveElapsed += dt;
            const p = g.animMoveSpring.valueAtTime(g.animMoveElapsed / g.animMoveDuration);
            g.x = g.animMoveFromX + (g.animMoveTX - g.animMoveFromX) * p;
            g.y = g.animMoveFromY + (g.animMoveTY - g.animMoveFromY) * p;
            if (g.animMoveElapsed >= g.animMoveTotalTime) {
              g.x = g.animMoveTX; g.y = g.animMoveTY;
              g.animMove = false; this._resolveAnim(g, 'animMoveResolve');
            }
          } else {
            const dx = g.animMoveTX - g.x;
            const dy = g.animMoveTY - g.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const spd = Math.sqrt(g.animMoveVX * g.animMoveVX + g.animMoveVY * g.animMoveVY);
            if (dist < 0.1 && spd < 0.1) {
              g.x = g.animMoveTX; g.y = g.animMoveTY;
              g.animMoveVX = 0; g.animMoveVY = 0;
              g.animMove = false; this._resolveAnim(g, 'animMoveResolve');
            } else {
              g.animMoveVX += (dx / g.animMoveSpeed) * f;
              g.animMoveVY += (dy / g.animMoveSpeed) * f;
              g.animMoveVX *= damp; g.animMoveVY *= damp;
              g.x += g.animMoveVX; g.y += g.animMoveVY;
            }
          }
        }

        // —— 长度动画（g.width / 物理特性开启时为 baseWidth）——
        if (g.animW) {
          if (g.animWMode === 'spring') {
            g.animWElapsed += dt;
            const p = g.animWSpring.valueAtTime(g.animWElapsed / g.animWDuration);
            let v = g.animWFrom + (g.animWT - g.animWFrom) * p;
            v = Math.min(500, Math.max(1, v));
            if (g.animWElapsed >= g.animWTotalTime) { v = g.animWT; g.animW = false; this._resolveAnim(g, 'animWResolve'); }
            if (g.applePhysics) g.baseWidth = v; else g.width = v;
          } else {
            const d = g.animWT - (g.applePhysics ? g.baseWidth : g.width);
            if (Math.abs(d) < 0.05 && Math.abs(g.animWV) < 0.05) {
              const v = g.animWT; g.animWV = 0; g.animW = false; this._resolveAnim(g, 'animWResolve');
              if (g.applePhysics) g.baseWidth = v; else g.width = v;
            } else {
              g.animWV += (d / g.animWSpeed) * f; g.animWV *= damp;
              const v = Math.min(500, Math.max(1, (g.applePhysics ? g.baseWidth : g.width) + g.animWV));
              if (g.applePhysics) g.baseWidth = v; else g.width = v;
            }
          }
        }

        // —— 宽度动画（g.height / 物理特性开启时为 baseHeight）——
        if (g.animH) {
          if (g.animHMode === 'spring') {
            g.animHElapsed += dt;
            const p = g.animHSpring.valueAtTime(g.animHElapsed / g.animHDuration);
            let v = g.animHFrom + (g.animHT - g.animHFrom) * p;
            v = Math.min(500, Math.max(1, v));
            if (g.animHElapsed >= g.animHTotalTime) { v = g.animHT; g.animH = false; this._resolveAnim(g, 'animHResolve'); }
            if (g.applePhysics) g.baseHeight = v; else g.height = v;
          } else {
            const d = g.animHT - (g.applePhysics ? g.baseHeight : g.height);
            if (Math.abs(d) < 0.05 && Math.abs(g.animHV) < 0.05) {
              const v = g.animHT; g.animHV = 0; g.animH = false; this._resolveAnim(g, 'animHResolve');
              if (g.applePhysics) g.baseHeight = v; else g.height = v;
            } else {
              g.animHV += (d / g.animHSpeed) * f; g.animHV *= damp;
              const v = Math.min(500, Math.max(1, (g.applePhysics ? g.baseHeight : g.height) + g.animHV));
              if (g.applePhysics) g.baseHeight = v; else g.height = v;
            }
          }
        }

        // —— 大小动画（同时缩放长和宽，保持宽高比）——
        if (g.animScale) {
          if (g.animScaleMode === 'spring') {
            g.animScaleElapsed += dt;
            const p = g.animScaleSpring.valueAtTime(g.animScaleElapsed / g.animScaleDuration);
            const val = g.animScaleFrom + (g.animScaleT - g.animScaleFrom) * p;
            const w = Math.min(500, Math.max(1, val * g.animScaleRatio));
            const h = Math.min(500, Math.max(1, val));
            if (g.animScaleElapsed >= g.animScaleTotalTime) {
              const final = g.animScaleT;
              if (g.applePhysics) { g.baseWidth = final * g.animScaleRatio; g.baseHeight = final; }
              else { g.width = final * g.animScaleRatio; g.height = final; }
              g.animScale = false; this._resolveAnim(g, 'animScaleResolve');
            } else if (g.applePhysics) { g.baseWidth = w; g.baseHeight = h; }
            else { g.width = w; g.height = h; }
          } else {
            const d = g.animScaleT - ((g.width + g.height) / 2);
            if (Math.abs(d) < 0.05 && Math.abs(g.animScaleV) < 0.05) {
              const final = g.animScaleT;
              if (g.applePhysics) { g.baseWidth = final * g.animScaleRatio; g.baseHeight = final; }
              else { g.width = final * g.animScaleRatio; g.height = final; }
              g.animScaleV = 0; g.animScale = false; this._resolveAnim(g, 'animScaleResolve');
            } else {
              g.animScaleV += (d / g.animScaleSpeed) * f; g.animScaleV *= damp;
              const newVal = ((g.width + g.height) / 2) + g.animScaleV;
              const w = Math.min(500, Math.max(1, newVal * g.animScaleRatio));
              const h = Math.min(500, Math.max(1, newVal));
              if (g.applePhysics) { g.baseWidth = w; g.baseHeight = h; }
              else { g.width = w; g.height = h; }
            }
          }
        }

        // —— Apple 物理特性（速度变形）——
        // Apple 物理特性：长度/宽度随玻璃「自身移动速度」变形，不绑定鼠标。
        // 变形叠加在 baseWidth×baseHeight 之上：静止时显示基础尺寸，移动时拉伸、停下回弹。
        // 拉伸量用 physDuration 做指数平滑，避免瞬变（Apple 的渐入手感）。
        if (g.applePhysics) {
          // 玻璃自身速度（本帧位移）
          const vx = g.x - g.physPrevX;
          const vy = g.y - g.physPrevY;
          const speed = Math.sqrt(vx * vx + vy * vy);

          // 目标拉伸量 = 速度/2，向目标平滑过渡
          const targetStretch = speed / 2;
          const k = 1 - Math.exp(-dt / Math.max(0.01, g.physDuration));
          g.physStretch += (targetStretch - g.physStretch) * k;

          // 显示长度 = 基础长度 + 拉伸；显示宽度按面积守恒收窄
          const w = g.baseWidth + g.physStretch;
          g.width = Math.min(500, Math.max(1, w));
          const area = g.baseWidth * g.baseHeight;
          g.height = Math.min(500, Math.max(1, area / w));

          // 记录本帧位置供下帧算速度
          g.physPrevX = g.x;
          g.physPrevY = g.y;
        }
      }
    }

    // ---- 统一动画：把液体玻璃的 [属性] 按 [动画方式] 变到目标值 ----
    // 属性：大小(同时缩放长宽) / x / y / 长(width) / 宽(height)
    // 动画：柔和弹簧(SwiftUI 临界阻尼) / 物理弹簧(v+=d/s;v*=0.8)
    animProp(args) {
      const g = this._findGlass(args.ID);
      if (!g) return Promise.resolve();

      const animType = String(args.ANIM || '物理弹簧');
      const mode = (animType === '柔和弹簧') ? 'spring' : 'physics';
      const prop = String(args.PROP || '大小');
      const targetVal = Math.min(500, Math.max(1, toSafeNumber(args.V)));

      if (prop === '大小') {
        // 大小：同时缩放长和宽，保持当前宽高比
        this._resolveAnim(g, 'animScaleResolve');
        g.animScale = true;
        g.animScaleMode = mode;
        g.animScaleT = targetVal;
        g.animScaleFrom = (g.width + g.height) / 2;
        g.animScaleRatio = g.height > 0.001 ? g.width / g.height : 1;

        if (mode === 'spring') {
          const duration = 0.5;
          const sp = new GlassSpring(duration);
          g.animScaleSpring = sp;
          g.animScaleDuration = duration;
          g.animScaleTotalTime = duration * sp.settleTime();
          g.animScaleElapsed = 0;
        } else {
          g.animScaleV = 0;
          g.animScaleSpeed = 12;
        }
        this._startLoop();
        return new Promise(resolve => { g.animScaleResolve = resolve; });
      }

      if (prop === 'x' || prop === 'y') {
        // x 或 y：复用位置动画
        this._resolveAnim(g, 'animMoveResolve');
        g.animMove = true;
        g.animMoveMode = mode;
        if (prop === 'x') { g.animMoveTX = targetVal; g.animMoveTY = g.y; }
        else { g.animMoveTX = g.x; g.animMoveTY = targetVal; }

        if (mode === 'spring') {
          const duration = 0.5;
          const sp = new GlassSpring(duration);
          g.animMoveSpring = sp;
          g.animMoveDuration = duration;
          g.animMoveTotalTime = duration * sp.settleTime();
          g.animMoveElapsed = 0;
          g.animMoveFromX = g.x;
          g.animMoveFromY = g.y;
        } else {
          g.animMoveSpeed = 12;
        }
        this._startLoop();
        return new Promise(resolve => { g.animMoveResolve = resolve; });
      }

      if (prop === '长') {
        this._resolveAnim(g, 'animWResolve');
        g.animW = true; g.animWMode = mode; g.animWT = targetVal;
        if (mode === 'spring') {
          const d = 0.5, sp = new GlassSpring(d);
          g.animWSpring = sp; g.animWDuration = d; g.animWTotalTime = d * sp.settleTime(); g.animWElapsed = 0; g.animWFrom = g.width;
        } else { g.animWV = 0; g.animWSpeed = 12; }
        this._startLoop();
        return new Promise(resolve => { g.animWResolve = resolve; });
      }

      if (prop === '宽') {
        this._resolveAnim(g, 'animHResolve');
        g.animH = true; g.animHMode = mode; g.animHT = targetVal;
        if (mode === 'spring') {
          const d = 0.5, sp = new GlassSpring(d);
          g.animHSpring = sp; g.animHDuration = d; g.animHTotalTime = d * sp.settleTime(); g.animHElapsed = 0; g.animHFrom = g.height;
        } else { g.animHV = 0; g.animHSpeed = 12; }
        this._startLoop();
        return new Promise(resolve => { g.animHResolve = resolve; });
      }

      return Promise.resolve();
    }

    // ---- 统一动画：移动到指定 x,y（属性决定哪些坐标参与动画）----
    animMoveTo(args) {
      const g = this._findGlass(args.ID);
      if (!g) return Promise.resolve();

      const animType = String(args.ANIM || '物理弹簧');
      const mode = (animType === '柔和弹簧') ? 'spring' : 'physics';
      const prop = String(args.PROP || 'x');
      const targetX = toSafeNumber(args.X);
      const targetY = toSafeNumber(args.Y);

      // 不管选了什么属性，移动到 x/y 都是位置动画
      this._resolveAnim(g, 'animMoveResolve');
      g.animMove = true;
      g.animMoveMode = mode;
      g.animMoveTX = targetX;
      g.animMoveTY = targetY;

      if (mode === 'spring') {
        const duration = 0.5;
        const sp = new GlassSpring(duration);
        g.animMoveSpring = sp;
        g.animMoveDuration = duration;
        g.animMoveTotalTime = duration * sp.settleTime();
        g.animMoveElapsed = 0;
        g.animMoveFromX = g.x;
        g.animMoveFromY = g.y;
      } else {
        g.animMoveSpeed = 12;
      }
      this._startLoop();
      return new Promise(resolve => { g.animMoveResolve = resolve; });
    }

    // Apple 物理特性开关：开启后玻璃随自身移动速度拉伸变形（不绑定鼠标）
    setApplePhysics(args) {
      const g = this._findGlass(args.ID);
      if (!g) return;

      const mode = String(args.MODE || '关闭');
      if (mode === '开启') {
        g.applePhysics = true;
        // 以当前显示尺寸作为静止基础尺寸，避免开启瞬间跳变/缩小
        g.baseWidth = g.width;
        g.baseHeight = g.height;
        // 初始化为玻璃当前位置，避免首帧速度跳变
        g.physPrevX = g.x;
        g.physPrevY = g.y;
        g.physStretch = 0;
        g.physDuration = Math.max(0.05, toSafeNumber(args.DURATION));
      } else {
        g.applePhysics = false;
      }
      this._startLoop();
    }

    smoothFollow(args) {
      const g = this._findGlass(args.ID);
      if (!g) return;

      const mode = String(args.LIST1 || '关闭');

      if (mode === '开启') {
        g.followMouse = true;
        g.followVX = 0;
        g.followVY = 0;
        g.followLastTime = 0;
        this._startFollowLoop();
      } else {
        g.followMouse = false;
        g.followVX = 0;
        g.followVY = 0;
      }
      this._requestRedraw();
    }

    _startFollowLoop() {
      if (this._followRAF !== null) return;
      const self = this;
      const loop = (now) => {
        const anyFollowing = self.glasses.some(g => g.followMouse);
        if (!anyFollowing) {
          self._followRAF = null;
          return;
        }
        let needsRedraw = false;
        const mouse = self.runtime.ioDevices && self.runtime.ioDevices.mouse;
        for (const g of self.glasses) {
          if (!g.followMouse || !mouse) continue;
          if (g.followLastTime === 0) g.followLastTime = now;
          const dt = Math.min((now - g.followLastTime) / 1000, 0.032);
          g.followLastTime = now;
          if (dt <= 0) continue;

          const num = Math.min(dt * 12, 1);
          const dnum = Math.min(dt * 3, 1);
          const mouseX = mouse.getScratchX();
          const mouseY = mouse.getScratchY();

          g.followVX += (mouseX - g.x - g.followVX) * dnum;
          g.followVY += (mouseY - g.y - g.followVY) * dnum;
          g.x += g.followVX * num;
          g.y += g.followVY * num;
          needsRedraw = true;
        }
        if (needsRedraw) self._requestRedraw();
        self._followRAF = requestAnimationFrame(loop);
      };
      this._followRAF = requestAnimationFrame(loop);
    }

    setWidth(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        // 即时设定长度：停止正在进行的长度动画和大小动画（与宽度动画互不影响）
        g.animW = false; g.animWV = 0;
        g.animScale = false; g.animScaleV = 0;
        this._resolveAnim(g, 'animWResolve');
        this._resolveAnim(g, 'animScaleResolve');
        const v = Math.min(500, Math.max(1, toSafeNumber(args.WIDTH)));
        // 物理特性开启时改基础长度（静止尺寸），否则直接改显示长度
        if (g.applePhysics) g.baseWidth = v; else g.width = v;
      }
    }

    setHeight(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        // 即时设定宽度：停止正在进行的宽度动画和大小动画（与长度动画互不影响）
        g.animH = false; g.animHV = 0;
        g.animScale = false; g.animScaleV = 0;
        this._resolveAnim(g, 'animHResolve');
        this._resolveAnim(g, 'animScaleResolve');
        const v = Math.min(500, Math.max(1, toSafeNumber(args.HEIGHT)));
        // 物理特性开启时改基础宽度（静止尺寸），否则直接改显示宽度
        if (g.applePhysics) g.baseHeight = v; else g.height = v;
      }
    }

    setRefraction(args) {
      const g = this._findGlass(args.ID);
      if (g) g.targetRefraction = Math.max(0, toSafeNumber(args.REFRACTION));
    }

    setOpacity(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        const val = toSafeNumber(args.OPACITY);
        g.opacity = Math.min(1, Math.max(0, val));
      }
    }

    // 圆角：G2 / 四分之一 -> 圆角扩展的「圆角矩形」(四角圆弧，半径 rr=min(R,短边/2))；
    //       三分之一 / G3 -> 原超椭圆(squircle)，指数 3 / 4。
    // R 范围 0~300（像素），与玻璃长宽同单位；半径 0 = 方角。
    setCornerRadius(args) {
      const g = this._findGlass(args.ID);
      if (!g) return;
      const style = String(args.STYLE || 'G3');
      if (['G2', 'G3', '三分之一', '四分之一'].includes(style)) {
        g.cornerStyle = style;
      }
      g.cornerRadius = Math.min(300, Math.max(0, toSafeNumber(args.RADIUS)));
    }

    setEdgeThickness(args) {
      const g = this._findGlass(args.ID);
      if (g) g.edgeThickness = Math.max(0, toSafeNumber(args.THICKNESS));
    }

    setBlur(args) {
      const g = this._findGlass(args.ID);
      if (g) g.blur = Math.min(100, Math.max(0, toSafeNumber(args.BLUR)));
    }

    // 高光强度：1~100 刻度（存原始百分比值），100=原本满高光，1=几乎无高光。
    // 上传着色器时除以 100 归一化为 0.01~1.0 系数。
    setHighlight(args) {
      const g = this._findGlass(args.ID);
      if (g) g.highlight = Math.min(100, Math.max(1, toSafeNumber(args.STRENGTH)));
    }

    // 色散：0~10 刻度（存原始值），0=无色散，10=极强彩色镶边。
    // 上传着色器时除以 50 归一化为 0.0~0.2 系数（见片元着色器 uDispersion/50.0）。
    setDispersion(args) {
      const g = this._findGlass(args.ID);
      if (g) g.dispersion = Math.min(10, Math.max(0, toSafeNumber(args.DISPERSION)));
    }

    // 染色：把玻璃画面按所选颜色做亮度加权混合（复用着色器 uTint 路径）。
    // ALPHA 为 0~100 的透明度刻度，除以 100 归一化为 uTint.a（0=不染色，1=完全染色）。
    // 颜色来自 Scratch 颜色积木（hex），经 hexToRgbNormalized 转为 0~1 归一化 RGB。
    dyeGlass(args) {
      const g = this._findGlass(args.ID);
      if (g) {
        const rgb = hexToRgbNormalized(args.COLOR);
        const alpha = Math.min(100, Math.max(0, toSafeNumber(args.ALPHA))) / 100.0;
        g.tint = [rgb[0], rgb[1], rgb[2], alpha];
      }
    }

    // 清除染色：把 tint 重置为全 0（uTint.a=0 -> 着色器跳过染色分支，恢复原始折射画面）。
    clearDye(args) {
      const g = this._findGlass(args.ID);
      if (g) g.tint = [0, 0, 0, 0];
    }

    // 设置渲染帧率（30~60）。全局生效（整套渲染共用一个帧率），不针对单个玻璃。
    setFPS(args) {
      let fps = Math.round(toSafeNumber(args.FPS));
      fps = Math.min(60, Math.max(30, fps));
      this._targetFPS = fps;
      this._minFrameInterval = 1000 / fps;
      // 确保独立渲染循环在有玻璃时处于运行状态（例如提高帧率后立即补足帧）
      this._startLoop();
    }

    renderAllGlasses() {
      if (this.gl && this.glasses.length > 0) {
        this._boundDrawFrame();
      }
    }

    getGlassInfoJSON(args) {
      const g = this._findGlass(args.ID);
      if (!g) {
        return JSON.stringify({ error: '未找到编号为 ' + Math.round(toSafeNumber(args.ID)) + ' 的液体玻璃' });
      }
      const c = g.tint;
      const info = {
        x: g.x,
        y: g.y,
        方向: g.direction,
        长: g.width,
        宽: g.height,
        圆角类型: g.cornerStyle,
        圆角大小: g.cornerRadius,
        模糊度: g.blur,
        高光: g.highlight,
        色散: g.dispersion,
        折射: g.refraction,
        透明: g.opacity,
        厚度: (typeof g.edgeThickness === 'number' ? g.edgeThickness : 0),
        颜色: {
          r: Math.round(c[0] * 255),
          g: Math.round(c[1] * 255),
          b: Math.round(c[2] * 255)
        },
        染色透明度: Math.round(c[3] * 100),
        染色中: c[3] > 0
      };
      return JSON.stringify(info);
    }

    getGlassCount() {
      return this.glasses.length;
    }
  }

  Scratch.extensions.register(new WebGLLiquidGlass(runtime));
})(Scratch);
