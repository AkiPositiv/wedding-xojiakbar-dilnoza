// WebGL-ткань: колышущийся атлас.
// Если WebGL недоступен, функция возвращает null.
window.Weave = (() => {
  "use strict";

  const VERT = `
    attribute vec2 p;
    varying vec2 vUv;
    void main() {
      vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
      gl_Position = vec4(p, 0.0, 1.0);
    }`;

  // Шёлковый атлас, за которым дует ветер: волны смещают узор и дают блик.
  const FABRIC = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uTile;

    float H(vec2 s) {
      return sin(s.x * 4.2 + uTime * 0.75 + sin(s.y * 2.1 + uTime * 0.45) * 1.7) * 0.55
           + sin(s.x * 9.5 - uTime * 1.2 + s.y * 2.8) * 0.18
           + sin(s.y * 3.4 + uTime * 0.55 + s.x * 1.6) * 0.27;
    }

    void main() {
      vec2 s = vec2(vUv.x * uRes.x / uRes.y, vUv.y);
      float e = 0.004;
      float hx = (H(s + vec2(e, 0.0)) - H(s - vec2(e, 0.0))) / (2.0 * e);
      float hy = (H(s + vec2(0.0, e)) - H(s - vec2(0.0, e))) / (2.0 * e);
      vec3 n = normalize(vec3(-hx * 0.09, -hy * 0.09, 1.0));
      vec2 px = vUv * uRes;
      vec2 tc = vec2(px.x / uTile, px.y / (uTile * 2.0)) + vec2(hx, hy) * 0.012;
      vec3 col = texture2D(uTex, tc).rgb;
      vec3 L = normalize(vec3(-0.45, -0.55, 0.7));
      float diff = max(dot(n, L), 0.0);
      float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
      col = col * (0.5 + 0.65 * diff) + vec3(1.0, 0.96, 0.88) * spec * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }`;

  function setup(canvas, frag) {
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true });
    if (!gl) return null;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return { gl, u: (name) => gl.getUniformLocation(prog, name) };
  }

  function texture(gl, unit, source, repeat) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  // Общий цикл: подгоняет размер холста, рисует кадр, умеет вставать на паузу.
  function loop(canvas, gl, { scale, onFrame, still }) {
    let raf = 0;
    let active = false;
    let alive = true;
    const t0 = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (!active) draw(performance.now());
    }
    function draw(now) {
      onFrame((now - t0) / 1000, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function frame(now) {
      if (!alive || !active) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener("resize", resize);

    return {
      setActive(on) {
        if (still) on = false;
        if (on === active) return;
        active = on;
        if (on) raf = requestAnimationFrame(frame);
        else cancelAnimationFrame(raf);
      },
      redraw: () => draw(performance.now()),
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  }

  function fabric(canvas, tile, { tileCss = 150, still = false } = {}) {
    let ctx;
    try {
      ctx = setup(canvas, FABRIC);
    } catch {
      return null;
    }
    if (!ctx) return null;
    const { gl, u } = ctx;
    texture(gl, 0, tile, true);
    gl.uniform1i(u("uTex"), 0);
    const uTime = u("uTime");
    const uRes = u("uRes");
    const uTile = u("uTile");
    const scale = 0.8; // атлас мягкий — рендерим чуть ниже разрешения экрана
    return loop(canvas, gl, {
      scale,
      still,
      onFrame(t, w) {
        gl.uniform1f(uTime, t);
        gl.uniform2f(uRes, w, canvas.height);
        gl.uniform1f(uTile, tileCss * (w / Math.max(1, canvas.clientWidth)));
      },
    });
  }

  return { fabric };
})();
