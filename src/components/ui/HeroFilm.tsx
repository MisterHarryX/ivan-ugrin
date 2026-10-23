import { useEffect, useRef, useState } from 'react';

const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;

/*
 * A living photo: Ivan by the river (square shot), where the leaves stir and catch the sun,
 * the river glints, the clouds drift and soft rays follow the pointer a little.
 * The face, beard and coat are masked out, so the person always stays perfectly still.
 * Everything is computed from the one picture; no video file to download.
 */
const FRAG = `precision mediump float;
varying vec2 v;
uniform sampler2D u_tex;
uniform float u_time, u_aspect, u_img;
uniform vec2 u_mouse;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * noise(p); p *= 2.03; a *= .5; } return s; }
vec2 cover(vec2 c){
  vec2 t = c;
  // Anchored high so the round frame shows the whole face and only a little of the shoulders (matches object-position 26%).
  if (u_aspect > u_img) { t.y = .26 + (c.y - .26) * (u_img / u_aspect); }
  else { t.x = .5 + (c.x - .5) * (u_aspect / u_img); }
  return t;
}
void main(){
  vec2 uv = v;
  float t = u_time;
  vec2 tuv0 = cover(.5 + (uv - .5) / 1.03);
  // The person: head, beard and coat stay still.
  float face = 1. - smoothstep(.26, .36, length((tuv0 - vec2(.52, .45)) * vec2(1., .78)));
  float coat = smoothstep(.6, .7, tuv0.y) * smoothstep(.95, .75, abs(tuv0.x - .5) * 2.2 + .2);
  float still = clamp(max(face, coat), 0., 1.);
  float free = 1. - still;
  // Leaves: upper left and the crown above the head.
  float leaves = free * smoothstep(.62, .2, tuv0.y) * (smoothstep(.62, .18, tuv0.x) + smoothstep(.3, .05, tuv0.y));
  leaves = clamp(leaves, 0., 1.);
  // River on the right, clouds in the sky above it.
  float water = free * smoothstep(.78, .84, tuv0.x) * smoothstep(.74, .78, tuv0.y) * smoothstep(.9, .85, tuv0.y);
  float sky = free * smoothstep(.66, .78, tuv0.x) * smoothstep(.5, .4, tuv0.y);
  vec2 d = vec2(0.);
  d += (vec2(fbm(uv * 9. + vec2(t * .35, 0.)), fbm(uv * 9. + vec2(0., t * .3) + 4.)) - .5) * .012 * leaves;
  d.x += sin(uv.y * 160. + t * 2.2) * .0022 * water;
  d.x += (sin(t * .08) * .012 + (fbm(uv * 3. + t * .02) - .5) * .01) * sky;
  // A faint brushstroke shimmer across the whole canvas outside the person.
  d += (vec2(noise(uv * 70. + t * .25), noise(uv * 70. - t * .2 + 9.)) - .5) * .0016 * free;
  vec3 col = texture2D(u_tex, cover(.5 + (uv + d - .5) / 1.03)).rgb;
  // Dappled sun on the foliage.
  float dapple = smoothstep(.55, .8, fbm(uv * 6. + vec2(t * .12, -t * .08)));
  col += vec3(1., .86, .45) * dapple * leaves * .16;
  // Glints on the water.
  float glint = pow(noise(vec2(uv.x * 90. - t * 1.4, uv.y * 30.)), 14.) * water;
  col += vec3(1., .96, .8) * glint * 1.4;
  // Warm rays from the upper left, following the pointer a little.
  vec2 src = vec2(.12 + u_mouse.x * .06, -.2);
  vec2 q = uv - src;
  float ang = atan(q.x, q.y);
  float rays = pow(.5 + .5 * sin(ang * 15. + t * .1), 8.) + .6 * pow(.5 + .5 * sin(ang * 27. - t * .07 + 1.7), 11.);
  rays *= smoothstep(1.3, .2, length(q)) * (.55 + .45 * sin(t * .3));
  col += vec3(1., .86, .55) * rays * .12 * (.4 + .6 * free);
  col *= .9 + .1 * smoothstep(1., .3, length(uv - vec2(.5, .45)));
  gl_FragColor = vec4(col, 1.);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
}

/** Renders over the hero photo once ready; the plain <img> stays underneath as fallback and for search engines. */
export function HeroFilm({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  // The photo was swapped in the live editor: the film shows the old picture, so it steps aside.
  const [replaced, setReplaced] = useState(false);
  const pausedRef = useRef(false);
  const wake = useRef<() => void>(() => {});
  pausedRef.current = paused || replaced;

  useEffect(() => {
    const el = canvas.current;
    const gl = el?.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!el || !gl) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) setPaused(true);
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = u('u_time'), uAspect = u('u_aspect'), uImg = u('u_img'), uMouse = u('u_mouse');

    // `alive` stops a torn-down effect (React StrictMode mounts twice) from drawing with a stale program.
    let frame = 0, visible = true, t0 = performance.now(), offset = 0, loaded = false, alive = true;
    const mouse = { x: 0, tx: 0 };
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      el.width = Math.max(1, Math.round(r.width * dpr));
      el.height = Math.max(1, Math.round(r.height * dpr));
      gl.viewport(0, 0, el.width, el.height);
      gl.uniform1f(uAspect, r.width / Math.max(1, r.height));
    };
    const draw = (now: number) => {
      if (!alive) return;
      const t = still ? 6 : offset + (now - t0) / 1000;
      mouse.x += (mouse.tx - mouse.x) * .04;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouse.x, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frame = !still && visible && !pausedRef.current && !document.hidden ? requestAnimationFrame(draw) : 0;
      if (!frame) offset = t;
    };
    wake.current = () => { if (alive && loaded && !frame) { t0 = performance.now(); frame = requestAnimationFrame(draw); } };

    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform1f(uImg, img.naturalWidth / img.naturalHeight);
      loaded = true;
      resize();
      draw(performance.now());
      setReady(true);
      wake.current();
    };
    img.src = src;

    const ro = new ResizeObserver(() => { resize(); if (loaded && !frame) draw(performance.now()); });
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake.current(); });
    io.observe(el);
    const onVis = () => { if (!document.hidden) wake.current(); };
    document.addEventListener('visibilitychange', onVis);
    const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { alive = false; img.onload = null; cancelAnimationFrame(frame); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); };
  }, [src]);

  useEffect(() => { if (!paused && !replaced) wake.current(); }, [paused, replaced]);

  useEffect(() => {
    const img = canvas.current?.parentElement?.querySelector<HTMLImageElement>('img.hero__photo');
    if (!img) return;
    const check = () => setReplaced(img.dataset.origSrc !== undefined && img.getAttribute('src') !== img.dataset.origSrc);
    check();
    const mo = new MutationObserver(check);
    mo.observe(img, { attributes: true, attributeFilter: ['src', 'data-orig-src'] });
    return () => mo.disconnect();
  }, []);

  return <>
    <canvas ref={canvas} className="hero__film" data-ready={ready && !replaced} aria-hidden="true" />
    {ready && !replaced && <button type="button" className="hero__film-toggle" aria-pressed={paused} aria-label={paused ? 'Оживить картину' : 'Остановить анимацию картины'} onClick={() => setPaused(p => !p)}>
      {paused ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z" /></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5h2v9H5zM9 3.5h2v9H9z" /></svg>}
    </button>}
  </>;
}
