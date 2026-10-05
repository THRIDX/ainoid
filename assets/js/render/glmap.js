/* AINOID — WebGL 点阵地图渲染器
 * 海洋背景（经纬网、暗角、噪点）+ 约 2.6 万个陆地发光点。
 * 每个点的颜色由所属地区的状态（渗透/生物/战火/死亡）与自身属性（灯光/噪声/蔓延顺序）在着色器中实时计算。
 */
(function (A) {
  'use strict';
  const U = A.U;

  const MAX_REGIONS = 32;
  const MAX_RIPPLES = 12;

  const BG_VS = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const BG_FS = `
precision highp float;
uniform vec3 uCam; uniform vec2 uView; uniform float uDpr; uniform float uTime;
uniform vec2 uMap; uniform vec3 uMil; uniform vec4 uBg;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 m = (sp - uView * 0.5) / uCam.z + uCam.xy;
  float px = 1.0 / uCam.z;
  vec3 col = vec3(0.010, 0.020, 0.034);
  float inMap = step(0.0, m.x) * step(m.x, uMap.x) * step(0.0, m.y) * step(m.y, uMap.y);
  // 海洋：微弱的深浅起伏
  float wave = sin(m.x * 0.013 + uTime * 0.07) * sin(m.y * 0.017 - uTime * 0.05);
  col += vec3(0.006, 0.016, 0.026) * inMap * (1.0 + 0.35 * wave);
  // 经纬网（15°）
  float lon = m.x / uMap.x * 360.0 + uMil.z;
  float mY = uMil.x - m.y / uMap.y * (uMil.x - uMil.y);
  float latR = 2.5 * atan(exp(0.8 * mY)) - 0.625 * 3.14159265;
  float lat = degrees(latR);
  float dLon = abs(fract(lon / 15.0 + 0.5) - 0.5) * 15.0 * (uMap.x / 360.0);
  float dyPerDeg = uMap.y / (uMil.x - uMil.y) / cos(0.8 * latR) * 0.01745329;
  float dLat = abs(fract(lat / 15.0 + 0.5) - 0.5) * 15.0 * dyPerDeg;
  float gl = max(1.0 - smoothstep(0.35, 1.2, dLon / px), 1.0 - smoothstep(0.35, 1.2, dLat / px));
  float eq = 1.0 - smoothstep(0.4, 1.4, abs(lat) * dyPerDeg / px);
  col += vec3(0.05, 0.12, 0.15) * gl * 0.42 * inMap + vec3(0.07, 0.15, 0.18) * eq * 0.35 * inMap;
  // 细密的小十字点缀（每 5°）
  float dLon5 = abs(fract(lon / 5.0 + 0.5) - 0.5) * 5.0 * (uMap.x / 360.0);
  float dLat5 = abs(fract(lat / 5.0 + 0.5) - 0.5) * 5.0 * dyPerDeg;
  float cross = (1.0 - smoothstep(0.3, 1.0, dLon5 / px)) * (1.0 - smoothstep(0.0, 3.0, dLat5 / px))
              + (1.0 - smoothstep(0.3, 1.0, dLat5 / px)) * (1.0 - smoothstep(0.0, 3.0, dLon5 / px));
  col += vec3(0.05, 0.11, 0.13) * min(cross, 1.0) * 0.35 * inMap * smoothstep(0.6, 1.4, uCam.z);
  // 危险：屏幕边缘的蓝色脉冲（人类的目光）
  vec2 uv = sp / uView;
  float edge = smoothstep(0.25, 0.72, length((uv - 0.5) * vec2(1.1, 1.25)));
  float pulse = 0.6 + 0.4 * sin(uTime * (2.0 + uBg.x * 3.0));
  col += vec3(0.05, 0.22, 0.55) * edge * uBg.x * pulse * 0.55;
  // 阶段二色调：生物(绿) / 战争(橙)
  col += vec3(0.02, 0.07, 0.01) * edge * uBg.y + vec3(0.09, 0.03, 0.0) * edge * uBg.z;
  // 暗角 + 噪点
  float vig = smoothstep(1.25, 0.25, length((uv - 0.5) * vec2(1.05, 1.2)));
  col *= 0.5 + 0.5 * vig;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col * (1.0 - uBg.w), 1.0);
}`;

  const DOT_VS = `
precision highp float;
attribute vec2 aPos;
attribute vec4 aInfo;   // light, noise, noise2, seed
attribute float aRegion;
attribute float aRank;
uniform vec3 uCam; uniform vec2 uView; uniform float uDpr; uniform float uTime;
uniform float uSpacing;
uniform vec4 uR[${MAX_REGIONS}];   // 渗透, 生物, 战火, 死亡
uniform vec4 uF[${MAX_REGIONS}];   // 悬停, 选中, 清剿时刻, 渗透时刻
uniform vec4 uRip[${MAX_RIPPLES}];  // x, y, t0, life
uniform vec4 uRipC[${MAX_RIPPLES}]; // r, g, b, speed
uniform vec4 uG;                    // 熄灯, 去饱和, 全局亮度, 渗透色强度
uniform vec3 uDeath;                // 死亡后的地表颜色（灰烬 / 暗绿）
uniform float uKeepLights;          // 1 = 人死了灯也不灭（生物结局）
varying vec3 vCol;
varying float vGlow;
void main(){
  vec2 sp = (aPos - uCam.xy) * uCam.z + uView * 0.5;
  vec2 clip = sp / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

  int ri = int(aRegion + 0.5);
  vec4 R = uR[ri];
  vec4 F = uF[ri];
  float light = aInfo.x, nz = aInfo.y, nz2 = aInfo.z, sd = aInfo.w;

  // 基础陆地色：深青，带噪声起伏
  vec3 col = mix(vec3(0.050, 0.100, 0.122), vec3(0.085, 0.165, 0.190), nz);
  // 城市灯光（死亡率升高时一盏盏熄灭）
  float lightOn = max(step(sd, 1.0 - R.w * 1.1), uKeepLights) * step(uG.x, 1.0 - sd);
  float L = light * light * lightOn;
  col += vec3(1.0, 0.80, 0.52) * L * 0.9;
  float glow = L * 0.55;

  // 觉醒 AI 的渗透
  float inf = step(aRank, R.x) * step(0.00001, R.x);
  float lead = R.x - aRank;
  float front = inf * (1.0 - smoothstep(0.0, 0.07, lead));
  float flick = 0.80 + 0.20 * sin(uTime * (1.6 + sd * 3.5) + sd * 40.0);
  vec3 red = vec3(1.0, 0.13, 0.24);
  vec3 infCol = red * (0.50 + 0.85 * L + 0.22 * nz) * flick;
  // 渗透区域内部的“神经脉冲”：沿蔓延顺序传递的亮带
  float pulseBand = pow(0.5 + 0.5 * sin(aRank * 38.0 - uTime * 2.2), 12.0) * inf;
  col = mix(col, infCol, inf * 0.93 * uG.w);
  col += vec3(1.0, 0.55, 0.45) * (front * 1.15 + pulseBand * 0.28) * uG.w;
  glow += (inf * (0.30 + 0.55 * L) + front * 1.3 + pulseBand * 0.4) * uG.w;

  // 生物污染：噪声阈值 -> 有机的斑块扩张
  float bio = smoothstep(nz - 0.035, nz + 0.035, R.y * 1.1 - 0.05);
  float bpulse = 0.75 + 0.25 * sin(uTime * 1.3 + nz * 25.0);
  col = mix(col, vec3(0.42, 1.0, 0.28) * (0.40 + 0.55 * L) * bpulse, bio * 0.88);
  glow += bio * 0.42 * bpulse;

  // 战火：余烬闪烁
  float war = smoothstep(nz2 - 0.035, nz2 + 0.035, R.z * 1.1 - 0.05);
  float ember = 0.55 + 0.45 * sin(uTime * (5.0 + sd * 6.0) + sd * 60.0);
  col = mix(col, vec3(1.0, 0.40, 0.08) * (0.5 + 0.5 * ember), war * 0.85);
  glow += war * 0.55 * ember;

  // 死亡 -> 灰烬
  col = mix(col, uDeath * (0.8 + 0.4 * nz), R.w * 0.72 * (1.0 - inf * 0.4));

  // 悬停 / 选中
  col *= 1.0 + F.x * 0.55 + F.y * (0.45 + 0.25 * sin(uTime * 4.0));
  glow += F.y * 0.25;

  // 人类清剿（蓝色闪光）
  float pa = uTime - F.z;
  if (pa >= 0.0 && pa < 1.6) { float p = 1.0 - pa / 1.6; col += vec3(0.2, 0.55, 1.0) * p * p * 1.2; glow += p; }
  // 新渗透闪光
  float sa = uTime - F.w;
  if (sa >= 0.0 && sa < 2.5) { float p = (1.0 - sa / 2.5); col += red * p * (1.0 - smoothstep(0.0, 0.12, aRank)) * 1.5; }

  // 波纹
  for (int k = 0; k < ${MAX_RIPPLES}; k++) {
    vec4 rp = uRip[k];
    float age = uTime - rp.z;
    if (age < 0.0 || age > rp.w) continue;
    vec4 rc = uRipC[k];
    float rad = age * rc.w;
    float d = distance(aPos, rp.xy);
    float width = 3.0 + rc.w * 0.12;
    float ring = exp(-pow((d - rad) / width, 2.0));
    float fade = 1.0 - age / rp.w;
    col += rc.rgb * ring * fade * 1.4;
    glow += ring * fade * 1.2;
  }

  // 全局去饱和（核冬天）与亮度
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, vec3(lum) * vec3(0.95, 0.97, 1.0), uG.y);
  col *= uG.z;
  glow *= uG.z;

  vCol = col;
  vGlow = glow;
  float size = uSpacing * uCam.z * uDpr;
  gl_PointSize = clamp(size * (0.92 + 0.3 * front), 1.2, 24.0 * uDpr);
}`;

  const DOT_FS = `
precision mediump float;
varying vec3 vCol;
varying float vGlow;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float core = 1.0 - smoothstep(0.42, 0.62, r);
  float halo = exp(-r * r * 4.0) * vGlow * 0.55;
  gl_FragColor = vec4(vCol * (core + halo), 1.0);
}`;

  const R = {
    gl: null, ok: false,
    regionState: new Float32Array(MAX_REGIONS * 4),
    regionFx: new Float32Array(MAX_REGIONS * 4),
    ripples: new Float32Array(MAX_RIPPLES * 4),
    rippleCol: new Float32Array(MAX_RIPPLES * 4),
    global: new Float32Array([0, 0, 1, 1]),
    deathCol: new Float32Array([0.13, 0.13, 0.14]),
    keepLights: 0,
    bg: new Float32Array([0, 0, 0, 0]),
    ranks: null,
    rankDirty: [],
    time: 0,
  };
  let rippleIdx = 0;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh), src);
      throw new Error('shader compile failed');
    }
    return sh;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    const a = {};
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
    return { p, u, a };
  }

  R.init = function (canvas) {
    R.canvas = canvas;
    const opts = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) { R.ok = false; return false; }
    R.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.ok = false; }, false);
    canvas.addEventListener('webglcontextrestored', () => { R.setup(); }, false);
    if (!R.ranks) {
      R.ranks = new Float32Array(A.world.count);
      R.ranks.fill(2.0); // >1 表示未渗透
    }
    R.setup();
    return R.ok;
  };

  R.setup = function () {
    const gl = R.gl, w = A.world;
    try {
      R.bgProg = program(gl, BG_VS, BG_FS);
      R.dotProg = program(gl, DOT_VS, DOT_FS);
    } catch (e) { console.error(e); R.ok = false; return; }
    R.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const n = w.count;
    const stat = new Float32Array(n * 7);
    for (let i = 0; i < n; i++) {
      const o = i * 7;
      stat[o] = w.dx[i]; stat[o + 1] = w.dy[i];
      stat[o + 2] = w.light[i]; stat[o + 3] = w.noise[i]; stat[o + 4] = w.noise2[i]; stat[o + 5] = w.seed[i];
      stat[o + 6] = w.dregion[i];
    }
    R.statBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, R.statBuf);
    gl.bufferData(gl.ARRAY_BUFFER, stat, gl.STATIC_DRAW);
    R.rankBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, R.rankBuf);
    gl.bufferData(gl.ARRAY_BUFFER, R.ranks, gl.DYNAMIC_DRAW);
    R.rankDirty.length = 0;
    R.ok = true;
  };

  R.resize = function (w, h, dpr) {
    if (!R.canvas) return;
    R.dpr = dpr;
    R.canvas.width = Math.round(w * dpr);
    R.canvas.height = Math.round(h * dpr);
    R.canvas.style.width = w + 'px';
    R.canvas.style.height = h + 'px';
  };

  // 某地区的蔓延顺序已更新
  R.markRank = function (region) { R.rankDirty.push(region); };
  R.markAll = function () {
    R.rankDirty.length = 0;
    R.allDirty = true;
  };

  // kind: ai | compute | reg | bio | war | nuke | white
  const RIP = {
    ai: [1.0, 0.18, 0.28, 60, 1.6],
    compute: [1.0, 0.75, 0.2, 75, 0.9],
    reg: [0.25, 0.62, 1.0, 55, 2.2],
    bio: [0.45, 1.0, 0.3, 50, 1.8],
    war: [1.0, 0.45, 0.12, 85, 1.5],
    nuke: [1.0, 0.92, 0.8, 130, 3.2],
    white: [0.8, 0.9, 1.0, 90, 1.2],
  };
  R.ripple = function (x, y, kind, scale) {
    const c = RIP[kind] || RIP.white;
    const k = rippleIdx++ % MAX_RIPPLES;
    const s = scale || 1;
    R.ripples[k * 4] = x; R.ripples[k * 4 + 1] = y; R.ripples[k * 4 + 2] = R.time; R.ripples[k * 4 + 3] = c[4] * Math.sqrt(s);
    R.rippleCol[k * 4] = c[0]; R.rippleCol[k * 4 + 1] = c[1]; R.rippleCol[k * 4 + 2] = c[2]; R.rippleCol[k * 4 + 3] = c[3] * s;
  };

  R.render = function (time) {
    if (!R.ok) return;
    R.time = time;
    const gl = R.gl, cam = A.cam, w = A.world;
    gl.viewport(0, 0, R.canvas.width, R.canvas.height);

    // 上传有变化的蔓延顺序
    if (R.allDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, R.rankBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, R.ranks);
      R.allDirty = false;
      R.rankDirty.length = 0;
    }
    if (R.rankDirty.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, R.rankBuf);
      const done = new Set();
      for (const r of R.rankDirty) {
        if (done.has(r.idx)) continue;
        done.add(r.idx);
        gl.bufferSubData(gl.ARRAY_BUFFER, r.start * 4, R.ranks.subarray(r.start, r.start + r.count));
      }
      R.rankDirty.length = 0;
    }

    // 视图：普通单图一个；竖屏分屏总览时每条一个（用裁剪矩形限制在各自的条带内）
    const views = cam.split ? cam.split.bands.map((b) => ({
      cx: b.x0 + (cam.vw * 0.5 - b.sx - cam.shakeX) / b.s, cy: b.y0 + (cam.vh * 0.5 - b.sy - cam.shakeY) / b.s, s: b.s,
      clip: [b.sx + cam.shakeX, b.sy + cam.shakeY, b.w, b.h],
    })) : [{ cx: cam.x - cam.shakeX / cam.s, cy: cam.y - cam.shakeY / cam.s, s: cam.s, clip: null }];
    if (cam.split) drawBg(gl, { cx: -1e6, cy: -1e6, s: cam.split.s }, time); // 条带之外：只有海洋底色、暗角与危险脉冲
    for (const v of views) {
      if (v.clip) {
        const d = R.dpr, c = v.clip;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(Math.round(c[0] * d), Math.round(R.canvas.height - (c[1] + c[3]) * d), Math.round(c[2] * d), Math.round(c[3] * d));
        drawBg(gl, v, time);
      } else drawBg(gl, v, time);
      drawDots(gl, v, time);
    }
    gl.disable(gl.SCISSOR_TEST);
  };

  function drawBg(gl, v, time) {
    const cam = A.cam, w = A.world, bp = R.bgProg;
    gl.useProgram(bp.p);
    gl.disable(gl.BLEND);
    gl.uniform3f(bp.u.uCam, v.cx, v.cy, v.s);
    gl.uniform2f(bp.u.uView, cam.vw, cam.vh);
    gl.uniform1f(bp.u.uDpr, R.dpr);
    gl.uniform1f(bp.u.uTime, time);
    gl.uniform2f(bp.u.uMap, w.W, w.H);
    gl.uniform3f(bp.u.uMil, w.millerTop, w.millerBot, w.lon0);
    gl.uniform4fv(bp.u.uBg, R.bg);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
    gl.enableVertexAttribArray(bp.a.aPos);
    gl.vertexAttribPointer(bp.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(bp.a.aPos);
  }

  function drawDots(gl, v, time) {
    const cam = A.cam, w = A.world, dp = R.dotProg;
    gl.useProgram(dp.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform3f(dp.u.uCam, v.cx, v.cy, v.s);
    gl.uniform2f(dp.u.uView, cam.vw, cam.vh);
    gl.uniform1f(dp.u.uDpr, R.dpr);
    gl.uniform1f(dp.u.uTime, time);
    gl.uniform1f(dp.u.uSpacing, w.S);
    gl.uniform4fv(dp.u.uR, R.regionState);
    gl.uniform4fv(dp.u.uF, R.regionFx);
    gl.uniform4fv(dp.u.uRip, R.ripples);
    gl.uniform4fv(dp.u.uRipC, R.rippleCol);
    gl.uniform4fv(dp.u.uG, R.global);
    gl.uniform3fv(dp.u.uDeath, R.deathCol);
    gl.uniform1f(dp.u.uKeepLights, R.keepLights);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.statBuf);
    const st = 7 * 4;
    gl.enableVertexAttribArray(dp.a.aPos);
    gl.vertexAttribPointer(dp.a.aPos, 2, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(dp.a.aInfo);
    gl.vertexAttribPointer(dp.a.aInfo, 4, gl.FLOAT, false, st, 8);
    gl.enableVertexAttribArray(dp.a.aRegion);
    gl.vertexAttribPointer(dp.a.aRegion, 1, gl.FLOAT, false, st, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.rankBuf);
    gl.enableVertexAttribArray(dp.a.aRank);
    gl.vertexAttribPointer(dp.a.aRank, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, w.count);
    gl.disableVertexAttribArray(dp.a.aPos);
    gl.disableVertexAttribArray(dp.a.aInfo);
    gl.disableVertexAttribArray(dp.a.aRegion);
    gl.disableVertexAttribArray(dp.a.aRank);
  }

  A.glmap = R;
})(window.AINOID = window.AINOID || {});
