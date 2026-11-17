/**
 * Liquid Glass —— 基于 ybouane/liquidglass 的玻璃着色器
 * https://github.com/ybouane/liquidglass
 *
 * 原库的做法：把 root 下所有非玻璃子元素用 html-to-image 光栅化成一张图，
 * 玻璃面板再在 WebGL 里模拟折射。这对内容型 SPA 不可行（等于把整页变成图片）。
 *
 * 这里的做法：本站背景是一张固定全屏背景图（.bg-img），直接把它当纹理用：
 *   1. 背景原图上传成纹理，另做一张 1/4 分辨率的高斯模糊纹理；
 *   2. 按 DOM 里玻璃元素的真实位置/尺寸/圆角，逐个画一个 quad；
 *   3. 片元着色器照原库实现：圆角 SDF + 双凸透镜折射 + 色散 + 菲涅尔
 *      + 多光源高光 + 内描边 + 投影；
 *   4. canvas 压在背景与内容之间，页面文字与交互完全保留，尺寸一点不改。
 *
 * WebGL 不可用 / 背景图缺失时什么也不做，页面退回上一版 CSS 玻璃。
 */
(function () {
  'use strict';
  if (window.__liquidGlassBooted) return;
  window.__liquidGlassBooted = true;

  var SEL = 'header,.card,.post,.stat,.stat-bar,#sidebar,#modal .box,.emoji-picker,.at-list,.umenu,#toTop,footer,#app>.hint';
  var PAD = 28;
  var DPR_CAP = 2;

  var VS = [
    'attribute vec2 a_pos;',
    'uniform vec2 u_center;',
    'uniform vec2 u_size;',
    'uniform vec2 u_res;',
    'uniform float u_pad;',
    'varying vec2 v_localPx;',
    'varying vec2 v_screenPx;',
    'void main() {',
    '  vec2 quad = u_size + vec2(u_pad * 2.0);',
    '  v_localPx = a_pos * quad;',
    '  vec2 px = u_center + v_localPx;',
    '  v_screenPx = px;',
    '  vec2 ndc = (px / u_res) * 2.0 - 1.0;',
    '  ndc.y = -ndc.y;',
    '  gl_Position = vec4(ndc, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_QUAD_VS = [
    'attribute vec2 a_pos;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = a_pos + 0.5;',
    '  gl_Position = vec4(a_pos * 2.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_BLIT = [
    'precision mediump float;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_scale;',
    'uniform vec2 u_offset;',
    'varying vec2 v_uv;',
    'void main() {',
    '  gl_FragColor = texture2D(u_tex, v_uv * u_scale + u_offset);',
    '}'
  ].join('\n');

  var FS_BLUR = [
    'precision mediump float;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_dir;',
    'varying vec2 v_uv;',
    'void main() {',
    '  vec4 s = texture2D(u_tex, v_uv) * 0.227027;',
    '  s += texture2D(u_tex, v_uv + u_dir * 1.0) * 0.194594;',
    '  s += texture2D(u_tex, v_uv - u_dir * 1.0) * 0.194594;',
    '  s += texture2D(u_tex, v_uv + u_dir * 2.0) * 0.121622;',
    '  s += texture2D(u_tex, v_uv - u_dir * 2.0) * 0.121622;',
    '  s += texture2D(u_tex, v_uv + u_dir * 3.0) * 0.054054;',
    '  s += texture2D(u_tex, v_uv - u_dir * 3.0) * 0.054054;',
    '  s += texture2D(u_tex, v_uv + u_dir * 4.0) * 0.016216;',
    '  s += texture2D(u_tex, v_uv - u_dir * 4.0) * 0.016216;',
    '  gl_FragColor = s;',
    '}'
  ].join('\n');

  var FS_GLASS = [
    'precision highp float;',
    'uniform sampler2D u_bgTex;',
    'uniform sampler2D u_blurTex;',
    'uniform vec2 u_size;',
    'uniform float u_radius;',
    'uniform vec2 u_res;',
    'uniform vec2 u_off;',
    'uniform vec2 u_draw;',
    'uniform vec3 u_bgTint;',
    'uniform float u_bgDark;',
    'uniform float u_refract;',
    'uniform float u_chroma;',
    'uniform float u_edgeHL;',
    'uniform float u_spec;',
    'uniform float u_fresnel;',
    'uniform float u_distort;',
    'uniform float u_alpha;',
    'uniform float u_sat;',
    'uniform float u_tint;',
    'uniform float u_zRadius;',
    'uniform float u_brightness;',
    'uniform float u_shadowAlpha;',
    'uniform float u_shadowSpread;',
    'uniform float u_shadowOffY;',
    'uniform float u_bevelMode;',
    'uniform vec2 u_mouse;',
    'uniform float u_mouseSpec;',
    'varying vec2 v_localPx;',
    'varying vec2 v_screenPx;',
    'float rrSDF(vec2 p, vec2 b, float r) {',
    '  vec2 q = abs(p) - b + vec2(r);',
    '  return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;',
    '}',
    'float bevelHeight(float d, float zR) {',
    '  if (d <= 0.0) return 0.0;',
    '  if (d >= zR) return zR;',
    '  return sqrt(d * (2.0 * zR - d));',
    '}',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main() {',
    '  vec2 half_ = u_size * 0.5;',
    '  float r = min(u_radius, min(half_.x, half_.y));',
    '  float sdf = rrSDF(v_localPx, half_, r);',
    '  if (sdf > 0.0) {',
    '    float sdfShadow = rrSDF(v_localPx - vec2(0.0, u_shadowOffY), half_, r);',
    '    float d = max(sdfShadow - 1.0, 0.0);',
    '    float spread = max(u_shadowSpread, 1.0);',
    '    float outerShadow = exp(-d * d / (spread * spread)) * 0.65;',
    '    float contactShadow = exp(-d * 0.08 / max(spread * 0.04, 0.01)) * 0.35;',
    '    gl_FragColor = vec4(0.0, 0.0, 0.0, (outerShadow + contactShadow) * u_shadowAlpha);',
    '    return;',
    '  }',
    '  float mask = 1.0 - smoothstep(-1.5, 0.5, sdf);',
    '  float maxD = min(half_.x, half_.y);',
    '  float inside = -sdf;',
    '  float edge = smoothstep(maxD * 0.35, 0.0, inside);',
    '  float zR = u_zRadius;',
    '  float e = 2.0;',
    '  float dC = inside;',
    '  float dR = -rrSDF(v_localPx + vec2(e, 0.0), half_, r);',
    '  float dL = -rrSDF(v_localPx - vec2(e, 0.0), half_, r);',
    '  float dU = -rrSDF(v_localPx + vec2(0.0, e), half_, r);',
    '  float dD = -rrSDF(v_localPx - vec2(0.0, e), half_, r);',
    '  float hC = bevelHeight(dC, zR);',
    '  float hR = bevelHeight(dR, zR);',
    '  float hL = bevelHeight(dL, zR);',
    '  float hU = bevelHeight(dU, zR);',
    '  float hD = bevelHeight(dD, zR);',
    '  vec2 hGrad = vec2(hR - hL, hU - hD) / (2.0 * e);',
    '  vec3 N = normalize(vec3(-hGrad, 1.0));',
    '  float depth = smoothstep(0.0, zR, inside);',
    '  float ior = 1.5;',
    '  float refrPow = 1.0 - 1.0 / ior;',
    '  float thickness = hC * 2.0;',
    '  float thickNorm = thickness / max(zR * 2.0, 1.0);',
    '  vec2 refrPx;',
    '  if (u_bevelMode < 0.5) {',
    '    vec2 exitRefr = hGrad * refrPow;',
    '    vec2 entryRefr = hGrad * refrPow;',
    '    vec2 throughRefr = entryRefr * thickNorm * 0.5;',
    '    refrPx = (exitRefr + entryRefr + throughRefr) * u_refract * 30.0;',
    '    vec2 centerDir = -v_localPx / max(half_, vec2(1.0));',
    '    refrPx += centerDir * u_refract * 4.0 * depth;',
    '  } else {',
    '    refrPx = -v_localPx * u_refract * depth * 0.35;',
    '  }',
    '  vec2 ns = v_localPx * 0.08;',
    '  vec2 micro = (vec2(hash(ns), hash(ns + vec2(37.0))) - 0.5) * u_distort * 4.0 / u_res;',
    '  float caS = u_chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0;',
    '  vec2 caV = N.xy * caS / u_res;',
    '  vec2 caB = N.xy * caS / u_draw;',
    '  vec2 bgUV = (v_screenPx - u_off) / u_draw;',
    '  vec2 bgBase = bgUV + refrPx / u_draw + micro;',
    '  vec2 vUV = v_screenPx / u_res;',
    '  vec2 vBase = vUV + refrPx / u_res + micro;',
    '  vec3 sharp = vec3(',
    '    texture2D(u_bgTex, bgBase + caB).r,',
    '    texture2D(u_bgTex, bgBase).g,',
    '    texture2D(u_bgTex, bgBase - caB).b);',
    '  vec3 blur = vec3(',
    '    texture2D(u_blurTex, vBase + caV).r,',
    '    texture2D(u_blurTex, vBase).g,',
    '    texture2D(u_blurTex, vBase - caV).b);',
    '  float edgeMix = 0.30 - edge * 0.30;',
    '  vec3 col = mix(sharp, blur, edgeMix);',
    '  col = col * u_bgDark + u_bgTint;',
    '  col *= 1.0 + u_brightness;',
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(lum), col, 1.0 + u_sat);',
    '  col = mix(col, col * vec3(0.92, 0.95, 1.05), u_tint);',
    '  col *= 1.0 + 0.06 * depth;',
    '  float fres = pow(1.0 - abs(N.z), 4.0) * u_fresnel;',
    '  vec3 V = vec3(0.0, 0.0, 1.0);',
    '  vec3 L1 = normalize(vec3(0.4, 0.7, 1.0));',
    '  vec3 H1 = normalize(L1 + V);',
    '  float sp1 = pow(max(dot(N, H1), 0.0), 90.0);',
    '  vec3 L2 = normalize(vec3(-0.3, -0.5, 1.0));',
    '  vec3 H2 = normalize(L2 + V);',
    '  float sp2 = pow(max(dot(N, H2), 0.0), 50.0) * 0.3;',
    '  vec3 L3 = normalize(vec3(0.1, 0.3, 1.0));',
    '  float spB = pow(max(dot(N, L3), 0.0), 6.0) * 0.1;',
    '  vec3 L4 = normalize(vec3(0.0, 0.9, 0.4));',
    '  vec3 H4 = normalize(L4 + V);',
    '  float sp4 = pow(max(dot(N, H4), 0.0), 120.0) * 0.6;',
    '  float totalSpec = (sp1 + sp2 + spB + sp4) * u_spec;',
    '  vec3 Lm = normalize(vec3((u_mouse - v_screenPx) / 260.0, 1.0));',
    '  vec3 Hm = normalize(Lm + V);',
    '  totalSpec += pow(max(dot(N, Hm), 0.0), 70.0) * u_mouseSpec;',
    '  float borderWidth = 1.5;',
    '  float innerStroke = smoothstep(-borderWidth - 1.0, -borderWidth, sdf)',
    '                   * (1.0 - smoothstep(-1.0, 0.0, sdf));',
    '  float topBias = 0.5 + 0.5 * (-v_localPx.y / half_.y);',
    '  innerStroke *= (0.4 + 0.6 * topBias);',
    '  float rim = edge * u_edgeHL * 0.22;',
    '  float innerGlow = smoothstep(5.0, 0.0, -sdf) * u_edgeHL * 0.15;',
    '  float envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;',
    '  vec3 fin = col;',
    '  fin += vec3(totalSpec);',
    '  fin += vec3(rim + innerGlow);',
    '  fin += vec3(innerStroke * u_edgeHL * 0.55);',
    '  fin += vec3(envRefl);',
    '  fin = mix(fin, vec3(1.0), fres * 0.2);',
    '  gl_FragColor = vec4(fin, mask * u_alpha);',
    '}'
  ].join('\n');

  var CFG = {
    light: {
      refract: 2.1, chroma: 0.14, edgeHL: 0.35, spec: 0.18, fresnel: 1.0,
      distort: 0.0, sat: 0.10, tint: 0.03, zRadius: 60, brightness: 0.05,
      shadowAlpha: 0.28, shadowSpread: 16, shadowOffY: 4,
      bgDark: 0.72, bgTint: [0.0165, 0.0252, 0.0462]
    },
    dark: {
      refract: 2.1, chroma: 0.15, edgeHL: 0.38, spec: 0.20, fresnel: 1.0,
      distort: 0.0, sat: 0.10, tint: 0.05, zRadius: 60, brightness: 0.05,
      shadowAlpha: 0.42, shadowSpread: 20, shadowOffY: 4,
      bgDark: 0.45, bgTint: [0, 0, 0]
    }
  };

  var canvas = null, gl = null, img = null;
  var progs = {}, locs = {}, quadBuf = null;
  var bgTex = null, blurA = null, blurB = null;
  var cssW = 0, cssH = 0, dpr = 1;
  var drawW = 1, drawH = 1, offX = 0, offY = 0;
  var nodes = [];
  var radiusCache = new Map();
  var queued = false, started = false;
  var mouseX = -9999, mouseY = -9999, mouseAt = 0, hasMouse = false;

  function q(sel) { return document.querySelector(sel); }

  function compile(vsSrc, fsSrc) {
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.warn('[liquidglass] vs:', gl.getShaderInfoLog(vs));
      return null;
    }
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.warn('[liquidglass] fs:', gl.getShaderInfoLog(fs));
      return null;
    }
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[liquidglass] link:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function locsOf(prog, names) {
    var o = {};
    for (var i = 0; i < names.length; i++) o[names[i]] = gl.getUniformLocation(prog, names[i]);
    return o;
  }

  function drawQuad(prog) {
    var l = gl.getAttribLocation(prog, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function makeTexFromImage(image) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function makeFBO(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb, w: w, h: h };
  }

  function freeFBO(f) {
    if (!f) return;
    gl.deleteFramebuffer(f.fb);
    gl.deleteTexture(f.tex);
  }

  function coverMapping() {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;
    var scale = Math.max(cssW / iw, cssH / ih);
    drawW = iw * scale;
    drawH = ih * scale;
    offX = (cssW - drawW) / 2;
    offY = (cssH - drawH) * 0.55;   /* 与 CSS object-position:50% 55% 对齐 */
    return true;
  }

  function renderBlur() {
    if (!blurA || !bgTex) return;
    gl.disable(gl.BLEND);

    /* 背景 -> A（cover 变换） */
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fb);
    gl.viewport(0, 0, blurA.w, blurA.h);
    gl.useProgram(progs.blit);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(locs.blit.u_tex, 0);
    gl.uniform2f(locs.blit.u_scale, cssW / drawW, cssH / drawH);
    gl.uniform2f(locs.blit.u_offset, -offX / drawW, -offY / drawH);
    drawQuad(progs.blit);

    /* H/V 高斯，单轮即可（保持轻微模糊，让边缘折射看得见） */
    gl.useProgram(progs.blur);
    gl.uniform1i(locs.blur.u_tex, 0);
    for (var i = 0; i < 1; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fb);
      gl.viewport(0, 0, blurB.w, blurB.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
      gl.uniform2f(locs.blur.u_dir, 1.0 / blurA.w, 0);
      drawQuad(progs.blur);

      gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fb);
      gl.viewport(0, 0, blurA.w, blurA.h);
      gl.bindTexture(gl.TEXTURE_2D, blurB.tex);
      gl.uniform2f(locs.blur.u_dir, 0, 1.0 / blurB.h);
      drawQuad(progs.blur);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    if (!coverMapping()) return;
    var bw = Math.max(4, Math.round(cssW / 2));
    var bh = Math.max(4, Math.round(cssH / 2));
    if (!blurA || blurA.w !== bw || blurA.h !== bh) {
      freeFBO(blurA); freeFBO(blurB);
      blurA = makeFBO(bw, bh);
      blurB = makeFBO(bw, bh);
    }
    renderBlur();
  }

  function radiusPx(el, rect) {
    var w = Math.round(rect.width), h = Math.round(rect.height);
    var cached = radiusCache.get(el);
    if (cached && cached.w === w && cached.h === h) return cached.v;
    var cs = window.getComputedStyle(el);
    var keys = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'];
    var v = 0;
    for (var i = 0; i < keys.length; i++) {
      var raw = cs[keys[i]] || '0';
      var n = raw.indexOf('%') > -1
        ? (parseFloat(raw) / 100) * Math.min(w, h)
        : (parseFloat(raw) || 0);
      if (n > v) v = n;
    }
    radiusCache.set(el, { w: w, h: h, v: v });
    return v;
  }

  function draw() {
    if (!gl || !img || !blurA) return;
    var isDark = document.documentElement.dataset.theme === 'dark';
    var cfg = isDark ? CFG.dark : CFG.light;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (window.__lgDebugOn) window.__lgPanels = [];

    gl.useProgram(progs.glass);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(locs.glass.u_bgTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurA.tex);
    gl.uniform1i(locs.glass.u_blurTex, 1);

    gl.uniform2f(locs.glass.u_res, cssW, cssH);
    gl.uniform2f(locs.glass.u_off, offX, offY);
    gl.uniform2f(locs.glass.u_draw, drawW, drawH);
    gl.uniform3f(locs.glass.u_bgTint, cfg.bgTint[0], cfg.bgTint[1], cfg.bgTint[2]);
    gl.uniform1f(locs.glass.u_bgDark, cfg.bgDark);
    gl.uniform1f(locs.glass.u_refract, cfg.refract);
    gl.uniform1f(locs.glass.u_chroma, cfg.chroma);
    gl.uniform1f(locs.glass.u_edgeHL, cfg.edgeHL);
    gl.uniform1f(locs.glass.u_spec, cfg.spec);
    gl.uniform1f(locs.glass.u_fresnel, cfg.fresnel);
    gl.uniform1f(locs.glass.u_distort, cfg.distort);
    gl.uniform1f(locs.glass.u_sat, cfg.sat);
    gl.uniform1f(locs.glass.u_tint, cfg.tint);
    gl.uniform1f(locs.glass.u_zRadius, cfg.zRadius);
    gl.uniform1f(locs.glass.u_brightness, cfg.brightness);
    gl.uniform1f(locs.glass.u_alpha, 1.0);
    gl.uniform1f(locs.glass.u_shadowAlpha, cfg.shadowAlpha);
    gl.uniform1f(locs.glass.u_shadowSpread, cfg.shadowSpread);
    gl.uniform1f(locs.glass.u_shadowOffY, cfg.shadowOffY);
    gl.uniform1f(locs.glass.u_bevelMode, 0.0);
    gl.uniform2f(locs.glass.u_mouse, mouseX, mouseY);
    gl.uniform1f(locs.glass.u_mouseSpec, hasMouse ? 0.5 : 0.0);
    gl.uniform1f(locs.glass.u_pad, PAD);

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var rc = el.getBoundingClientRect();
      if (rc.width < 4 || rc.height < 4) continue;
      if (rc.right < -PAD || rc.bottom < -PAD || rc.left > cssW + PAD || rc.top > cssH + PAD) continue;
      var cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue;

      var rad = radiusPx(el, rc);
      if (window.__lgDebugOn) {
        (window.__lgPanels = window.__lgPanels || []).push({
          cls: el.className + '|' + el.tagName,
          r: [Math.round(rc.left), Math.round(rc.top), Math.round(rc.width), Math.round(rc.height)],
          rad: Math.round(rad)
        });
      }
      gl.uniform2f(locs.glass.u_center, rc.left + rc.width / 2, rc.top + rc.height / 2);
      gl.uniform2f(locs.glass.u_size, rc.width, rc.height);
      gl.uniform1f(locs.glass.u_radius, rad);
      gl.uniform1f(locs.glass.u_zRadius, Math.min(cfg.zRadius, Math.min(rc.width, rc.height) * 0.5));
      drawQuad(progs.glass);
    }
    if (window.__lgDebugOn) {
      window.__lgInfo = {
        cssW: cssW, cssH: cssH, drawW: Math.round(drawW), drawH: Math.round(drawH),
        offX: Math.round(offX), offY: Math.round(offY),
        canvas: [canvas.width, canvas.height], dpr: dpr,
        blur: blurA ? [blurA.w, blurA.h] : null,
        nat: [img.naturalWidth, img.naturalHeight],
        pads: [locs.glass.u_pad !== null, locs.glass.u_center !== null]
      };
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      if (!started) return;
      draw();
    });
  }

  function refreshNodes() {
    nodes = Array.prototype.slice.call(document.querySelectorAll(SEL));
    radiusCache.clear();
  }

  function start() {
    var bg = q('.bg-img');
    if (!bg) return;
    img = bg;

    canvas = document.createElement('canvas');
    canvas.id = 'lg-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: false, antialias: false,
      depth: false, stencil: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    }) || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return;

    if (!coverMapping()) { /* 图片还没尺寸，等 load */ }

    progs.glass = compile(VS, FS_GLASS);
    progs.blit = compile(FS_QUAD_VS, FS_BLIT);
    progs.blur = compile(FS_QUAD_VS, FS_BLUR);
    if (!progs.glass || !progs.blit || !progs.blur) return;

    locs.glass = locsOf(progs.glass, ['u_bgTex', 'u_blurTex', 'u_size', 'u_radius', 'u_res',
      'u_center', 'u_pad', 'u_off', 'u_draw', 'u_bgTint', 'u_bgDark', 'u_refract', 'u_chroma',
      'u_edgeHL', 'u_spec', 'u_fresnel', 'u_distort', 'u_sat', 'u_tint', 'u_zRadius',
      'u_brightness', 'u_alpha', 'u_shadowAlpha', 'u_shadowSpread', 'u_shadowOffY', 'u_bevelMode', 'u_mouse', 'u_mouseSpec']);
    locs.blit = locsOf(progs.blit, ['u_tex', 'u_scale', 'u_offset']);
    locs.blur = locsOf(progs.blur, ['u_tex', 'u_dir']);

    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);

    bgTex = makeTexFromImage(img);

    var mask = q('.bg-mask');
    if (mask && mask.nextSibling) mask.parentNode.insertBefore(canvas, mask.nextSibling);
    else document.body.insertBefore(canvas, document.body.firstChild);

    document.documentElement.classList.add('lg-on');
    started = true;

    resize();
    refreshNodes();
    draw();

    window.addEventListener('resize', function () { resize(); schedule(); }, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { resize(); schedule(); }, 250);
    }, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pointermove', function (e) {
      var now = Date.now();
      if (now - mouseAt < 50) return;
      mouseAt = now;
      mouseX = e.clientX; mouseY = e.clientY; hasMouse = true;
      schedule();
    }, { passive: true });

    var mo = new MutationObserver(function () {
      refreshNodes();
      schedule();
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });

    var themeObs = new MutationObserver(schedule);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.__lgBench = function (n) {
      var t0 = performance.now();
      for (var k = 0; k < (n || 10); k++) draw();
      gl.finish();
      return (performance.now() - t0) / (n || 10);
    };

    /* 兜底：内容异步渲染（路由切换）后补一次重绘 */
    var ticks = 0;
    var timer = setInterval(function () {
      ticks++;
      refreshNodes();
      schedule();
      if (ticks > 20) clearInterval(timer);
    }, 400);
  }

  function boot() {
    if (started) return;
    var bg = q('.bg-img');
    if (!bg) return;
    if (bg.complete && bg.naturalWidth > 0) start();
    else bg.addEventListener('load', start, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
