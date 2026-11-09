/* 3D world renderer (Three.js). Plugs into the existing Renderer: the world is drawn in 3D on #gl3d,
   the old canvas is left transparent and only draws the HUD on top. Menus, modes, online play: unchanged. */
import * as THREE from 'three';
const F1 = window.F1, Renderer = window.Renderer, glc = document.getElementById('gl3d');
if (Renderer && glc) init();

function init() {
  const gl = new THREE.WebGLRenderer({ canvas: glc, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, 0.3, 9000);
  const size = () => { gl.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', size); size();
  const C = (h) => new THREE.Color(h), wrap = F1.wrapAngle, rnd = F1.rng(77);

  // ------------------------------------------------------------ atmosphere per circuit
  const DAY = { top: 0x2d6cc4, hor: 0xcfe3f5, sun: 0xfff0d6, si: 3.2, dir: [0.5, 0.65, 0.3], hs: 0xcfe2ff, hg: 0x55663a, hi: 0.9, cov: 0.55, cc: 0xffffff, ex: 1.0 };
  const ATM = {
    monza: DAY,
    silverstone: Object.assign({}, DAY, { top: 0x6f7f95, hor: 0xc4ccd4, sun: 0xdfe6ee, si: 1.5, hi: 1.35, cov: 0.1, cc: 0xd8dde3 }),
    abudhabi: Object.assign({}, DAY, { top: 0x14204a, hor: 0xf29a62, sun: 0xff9a55, si: 1.8, dir: [0.9, 0.16, 0.3], hs: 0x6b7fb0, hg: 0x3a3340, hi: 0.75, cov: 0.7, cc: 0xf0a070, lamps: true, ex: 1.15 }),
    spa: Object.assign({}, DAY, { top: 0x4b6a8a, hor: 0xb8c5cc, sun: 0xe8eef4, si: 1.8, hi: 1.2, cov: 0.2, cc: 0xc0c8d0 }),
    interlagos: Object.assign({}, DAY, { top: 0x2e5fb0, hor: 0xffd9a0, sun: 0xffc27a, si: 2.6, dir: [0.8, 0.28, 0.4], hs: 0xffd6a8, hg: 0x4a5530, cov: 0.5, cc: 0xffe0c0 })
  };
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1), sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 500 });
  scene.add(hemi, sun, sun.target);
  const skyU = { top: { value: C(0) }, hor: { value: C(0) }, sd: { value: new THREE.Vector3(0, 1, 0) }, t: { value: 0 }, cov: { value: 0.5 }, cc: { value: C(0xffffff) } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,hor,sd,cc;uniform float t,cov;varying vec3 v;' +
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}' +
      'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}' +
      'void main(){vec3 d=normalize(v);float y=max(d.y,0.);vec3 c=mix(hor,top,pow(y,.45));float sg=max(dot(d,sd),0.);c+=vec3(1.,.85,.6)*(pow(sg,900.)*3.+pow(sg,12.)*.25);' +
      'if(d.y>.01){vec2 uv=d.xz/(d.y+.2)*1.4+vec2(t*.004,t*.002);float q=smoothstep(1.-cov,1.-cov+.35,fbm(uv));c=mix(c,mix(cc,hor,.25)*(.8+.2*sg),q*smoothstep(0.,.2,d.y));}' +
      'gl_FragColor=vec4(c,1.);}'
  }));
  scene.add(sky); scene.fog = new THREE.Fog(0xffffff, 500, 5200);

  // ------------------------------------------------------------ textures + materials
  function tex(w, h, draw, ru, rv) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(ru || 1, rv || 1); return t;
  }
  const speck = (g, w, h, n, cols, sz) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(Math.random() * w, Math.random() * h, sz * (0.5 + Math.random()), sz * (0.5 + Math.random())); } };
  const blot = (g, w, h, n, hue, sat, lig, a, r) => { for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, q = g.createRadialGradient(x, y, 0, x, y, r); const l = lig + (Math.random() - 0.5) * 12; q.addColorStop(0, 'hsla(' + (hue + (Math.random() - 0.5) * 14) + ',' + sat + '%,' + l + '%,' + a + ')'); q.addColorStop(1, 'hsla(' + hue + ',' + sat + '%,' + l + '%,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); } };
  const TX = {
    asph: tex(512, 512, (g, w, h) => { g.fillStyle = '#3c3c42'; g.fillRect(0, 0, w, h); blot(g, w, h, 40, 240, 4, 24, 0.35, 90); speck(g, w, h, 14000, ['#2a2a2f', '#47474e', '#34343a', '#56565d', '#25252a'], 1.6); speck(g, w, h, 500, ['#8a8a90', '#6e6e75'], 1.4); }),
    grass: tex(512, 512, (g, w, h) => { g.fillStyle = '#3c6a2f'; g.fillRect(0, 0, w, h); blot(g, w, h, 90, 100, 45, 30, 0.35, 60); blot(g, w, h, 40, 75, 40, 34, 0.25, 70); speck(g, w, h, 9000, ['#2f5a25', '#4a7d38', '#335f29', '#58893f'], 1.8); }),
    mown: tex(512, 512, (g, w, h) => { g.fillStyle = '#4f8a3e'; g.fillRect(0, 0, w, h); blot(g, w, h, 60, 95, 40, 38, 0.3, 50); speck(g, w, h, 7000, ['#437a35', '#5c984a', '#4a8439'], 1.8); for (let y = 0; y < h; y += 64) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, y, w, 32); } }),
    gravel: tex(256, 256, (g, w, h) => { g.fillStyle = '#c4ae82'; g.fillRect(0, 0, w, h); speck(g, w, h, 9000, ['#a8946c', '#d8c698', '#b39c73', '#e2d3aa', '#9a8660'], 1.6); }),
    kerb: tex(8, 32, (g, w, h) => { g.fillStyle = '#d31a1a'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#f2f2f2'; g.fillRect(0, h / 2, w, h / 2); }),
    wall: tex(1024, 64, (g, w, h) => {
      g.fillStyle = '#c9ccd0'; g.fillRect(0, 0, w, h); const adv = [['APEX', '#0a4fa3'], ['VELOCITY', '#c01818'], ['NOVA', '#f0b400'], ['TURBO', '#118a4a'], ['ZENITH', '#222'], ['GRIPX', '#7a1fa2'], ['ORBIT', '#e8601a'], ['FUELIX', '#0b7a8a']];
      adv.forEach((a, i) => { g.fillStyle = a[1]; g.fillRect(i * 128 + 3, 8, 122, 40); g.fillStyle = '#fff'; g.font = 'italic 900 26px sans-serif'; g.textAlign = 'center'; g.fillText(a[0], i * 128 + 64, 38); });
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 54, w, 10); speck(g, w, h, 1500, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.12)'], 2);
    }),
    conc: tex(128, 128, (g, w, h) => { g.fillStyle = '#9ea2a8'; g.fillRect(0, 0, w, h); speck(g, w, h, 2500, ['#8c9096', '#b0b4ba', '#a4a8ae'], 1.5); }),
    fence: tex(64, 64, (g, w, h) => { g.strokeStyle = 'rgba(210,215,220,0.85)'; g.lineWidth = 2; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }),
    crowd: tex(256, 256, (g, w, h) => { g.fillStyle = '#4a4d55'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { g.fillStyle = 'hsl(' + ((Math.random() * 360) | 0) + ',55%,' + (30 + Math.random() * 40) + '%)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }),
    chq: tex(16, 2, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x, y, 1, 1); } }),
    soft: tex(64, 64, (g) => { const q = g.createRadialGradient(32, 32, 0, 32, 32, 32); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); })
  };
  TX.chq.magFilter = THREE.NearestFilter; TX.fence.colorSpace = THREE.SRGBColorSpace;
  const D2 = THREE.DoubleSide, std = (o) => new THREE.MeshStandardMaterial(Object.assign({ side: D2 }, o));
  const MAT = {
    asph: std({ map: TX.asph, roughness: 0.88 }), grass: std({ map: TX.grass, roughness: 1, side: THREE.FrontSide }), mown: std({ map: TX.mown, roughness: 1 }), gravel: std({ map: TX.gravel, roughness: 1 }),
    kerb: std({ map: TX.kerb, roughness: 0.6 }), line: std({ color: 0xf0f0f0, roughness: 0.6 }), rubber: std({ color: 0x050506, roughness: 0.9, transparent: true, opacity: 0.3, depthWrite: false }),
    wall: std({ map: TX.wall, roughness: 0.7 }), conc: std({ map: TX.conc, roughness: 0.9 }), fence: std({ map: TX.fence, transparent: true, alphaTest: 0.2, roughness: 0.5, metalness: 0.5 }),
    crowd: std({ map: TX.crowd, roughness: 1 }), pit: std({ color: 0x5a5e66, roughness: 0.85 }), apron: std({ color: 0x777b82, roughness: 0.9 }), steel: std({ color: 0x59606a, metalness: 0.6, roughness: 0.4 }), dark: std({ color: 0x15161a, roughness: 0.6 })
  };

  // ------------------------------------------------------------ geometry helpers
  const FR = THREE.FrontSide;
  function scaleUV(geo, a, b) { const u = geo.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * a, u.getY(i) * b); return geo; }
  function mk(pos, uv, idx, mat, shadow, parent) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = !!shadow; m.frustumCulled = false; parent.add(m); return m;
  }
  // flat strip along the track between lateral offsets dFn(k) = [d0, d1] (d0 < d1); null = no strip here
  function band(T, dFn, y, mat, ut, vt, parent) {
    const pos = [], uv = [], idx = [], n = T.n; let v = 0;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n, a = dFn(k), b = dFn(j); if (!a || !b) continue;
      [[k, a, k * T.ds], [j, b, (k + 1) * T.ds]].forEach((q) => { const i = q[0]; pos.push(T.x[i] + T.nx[i] * q[1][0], y, T.y[i] + T.ny[i] * q[1][0], T.x[i] + T.nx[i] * q[1][1], y, T.y[i] + T.ny[i] * q[1][1]); uv.push(q[1][0] / ut, q[2] / vt, q[1][1] / ut, q[2] / vt); });
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
    }
    return v ? mk(pos, uv, idx, mat, false, parent) : null;
  }
  // vertical wall at lateral offset dFn(k) from y0 to y1
  function vstrip(T, dFn, y0, y1, mat, ut, vr, parent, shadow) {
    const pos = [], uv = [], idx = [], n = T.n; let v = 0;
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n, a = dFn(k), b = dFn(j); if (a === null || b === null) continue;
      [[k, a, k * T.ds], [j, b, (k + 1) * T.ds]].forEach((q) => { const i = q[0]; pos.push(T.x[i] + T.nx[i] * q[1], y0, T.y[i] + T.ny[i] * q[1], T.x[i] + T.nx[i] * q[1], y1, T.y[i] + T.ny[i] * q[1]); uv.push(q[2] / ut, 0, q[2] / ut, vr); });
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); v += 4;
    }
    return v ? mk(pos, uv, idx, mat, shadow, parent) : null;
  }
  const place = (T, o, s, d) => { const p = F1.trackPoint(T, s, d); o.position.set(p.x, 0, p.y); o.rotation.y = -p.h; return p; };

  // ------------------------------------------------------------ world (one circuit)
  let world = null;
  function applyAtm(A) {
    hemi.color.set(A.hs); hemi.groundColor.set(A.hg); hemi.intensity = A.hi; sun.color.set(A.sun); sun.intensity = A.si;
    skyU.top.value.set(A.top); skyU.hor.value.set(A.hor); skyU.cov.value = A.cov; skyU.cc.value.set(A.cc); skyU.sd.value.set(...A.dir).normalize();
    scene.fog.color.set(A.hor); gl.toneMappingExposure = A.ex;
  }
  function buildWorld(T) {
    if (world) { scene.remove(world.g); world.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const A = ATM[T.id] || DAY; applyAtm(A); const g = new THREE.Group(); scene.add(g); world = { id: T.id, g, A, bulbs: [], sunDir: skyU.sd.value.clone() };
    const n = T.n, hw = T.hw, B = T.bounds, side2 = [-1, 1], WA = (k, s) => F1.wallAt(T, k, s);
    // ground
    TX.grass.repeat.set(14000 / 20, 14000 / 20);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), MAT.grass); ground.rotation.x = -Math.PI / 2; ground.position.set((B.minX + B.maxX) / 2, -0.12, (B.minY + B.maxY) / 2); ground.receiveShadow = true; g.add(ground);
    // run-off (mown grass), gravel, asphalt, rubber line, edge lines, kerbs
    side2.forEach((s) => band(T, (k) => { const w = WA(k, s) - 0.3; return s > 0 ? [hw - 0.3, w] : [-w, -hw + 0.3]; }, 0.0, MAT.mown, 20, 20, g));
    side2.forEach((s) => { const bit = s < 0 ? 1 : 2; band(T, (k) => { if (!(T.gravel[k] & bit)) return null; const w = WA(k, s) - 1.2; return s > 0 ? [hw - 0.25, w] : [-w, -(hw - 0.25)]; }, 0.02, MAT.gravel, 6, 6, g); });
    band(T, () => [-hw, hw], 0.04, MAT.asph, 12, 12, g);
    band(T, (k) => { const o = T.rlOff ? T.rlOff[k] : 0; const c = Math.max(-hw + 2.2, Math.min(hw - 2.2, o || 0)); return [c - 1.6, c + 1.6]; }, 0.05, MAT.rubber, 4, 4, g);
    band(T, () => [hw - 0.6, hw - 0.3], 0.055, MAT.line, 1, 1, g); band(T, () => [-hw + 0.3, -hw + 0.6], 0.055, MAT.line, 1, 1, g);
    side2.forEach((s) => band(T, (k) => (T.kerb[k] ? (s > 0 ? [hw - 0.2, hw + T.kerbW] : [-hw - T.kerbW, -hw + 0.2]) : null), 0.07, MAT.kerb, 2, 4, g));
    // barriers: concrete wall with advertising, solid top and back, catch fence; sits exactly where the physics wall is
    const posts = [];
    side2.forEach((s) => {
      const wd = (k) => s * WA(k, s), wo = (k) => s * (WA(k, s) + 0.7);
      vstrip(T, wd, 0, 1.15, MAT.wall, 16, 1, g, true); vstrip(T, wo, 0, 1.15, MAT.conc, 6, 1, g);
      band(T, (k) => { const a = WA(k, s), b = a + 0.7; return s > 0 ? [a, b] : [-b, -a]; }, 1.15, MAT.conc, 4, 4, g);
      if (!(T.pit && s === T.pit.side)) {
        vstrip(T, wd, 1.15, 4.6, MAT.fence, 4, 3.5 / 4, g);
        for (let k = 0; k < n; k += 5) { const d = wd(k); posts.push([T.x[k] + T.nx[k] * d, T.y[k] + T.ny[k] * d]); }
      }
    });
    const pg = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 6), MAT.steel, posts.length), mt = new THREE.Matrix4();
    posts.forEach((p, i) => { mt.makeTranslation(p[0], 2.3 + 0.0, p[1]); pg.setMatrixAt(i, mt); }); g.add(pg);
    // start line, grid slots, DRS lines
    const chq = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw - 1.2, 1.4), new THREE.MeshBasicMaterial({ map: TX.chq })); chq.rotation.x = -Math.PI / 2; chq.rotation.z = Math.PI / 2; chq.position.y = 0.09;
    const cg = new THREE.Group(); cg.add(chq); place(T, cg, 0, 0); g.add(cg);
    const bar = new THREE.PlaneGeometry(0.22, 2.7).rotateX(-Math.PI / 2), bm = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let k = 0; k < 22; k++) { const m = new THREE.Mesh(bar, bm); const sd = (k % 2 === 0 ? 1 : -1) * T.poleSide, p = F1.trackPoint(T, T.length - 7 - 8 * k + 2.9, sd * 2.6); m.position.set(p.x, 0.09, p.y); m.rotation.y = -p.h; g.add(m); }
    T.drs.forEach((z) => { [[z.start, 0.5], [z.detect, 0.25]].forEach((q) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(q[1], 2 * hw - 1).rotateX(-Math.PI / 2), bm); const p = F1.trackPoint(T, q[0], 0); m.position.set(p.x, 0.09, p.y); m.rotation.y = -p.h; g.add(m); }); });
    // start gantry with lights
    const gt = new THREE.Group(); [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 10, 10), MAT.steel); p.position.set(0, 5, s * (hw + 1.6)); p.castShadow = true; gt.add(p); });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 2 * hw + 4), MAT.steel); beam.position.y = 10; beam.castShadow = true; gt.add(beam);
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshBasicMaterial({ color: 0x300000 })); b.position.set(-0.8, 10, -4 + i * 2); gt.add(b); world.bulbs.push(b); }
    place(T, gt, 6, 0); g.add(gt);
    // pit lane, pit wall, garages
    const P = T.pit;
    if (P) {
      const ok = (k) => T.pitOff[k] === T.pitOff[k]; const sd = P.side;
      band(T, (k) => { if (!ok(k)) return null; const a = sd * (T.pitOff[k] - P.half), b = sd * (T.pitOff[k] + P.half + T.pitWork[k]); return a < b ? [a, b] : [b, a]; }, 0.045, MAT.pit, 8, 8, g);
      band(T, (k) => { if (!ok(k)) return null; const a = sd * (P.wallOff + 0.3), b = sd * (P.garFront + 0.2); return a < b ? [a, b] : [b, a]; }, 0.03, MAT.apron, 8, 8, g);
      band(T, (k) => { if (!ok(k)) return null; const a = sd * (P.garFront), b = sd * (P.garBack + 28); return a < b ? [a, b] : [b, a]; }, 0.025, MAT.apron, 8, 8, g);
      vstrip(T, (k) => (T.pitWall[k] ? sd * P.wallOff : null), 0, 1.1, MAT.conc, 6, 1, g, true);
      vstrip(T, (k) => (T.pitWall[k] ? sd * (P.wallOff + 0.5) : null), 0, 1.1, MAT.conc, 6, 1, g);
      band(T, (k) => (T.pitWall[k] ? (sd > 0 ? [P.wallOff, P.wallOff + 0.5] : [-P.wallOff - 0.5, -P.wallOff]) : null), 1.1, MAT.conc, 4, 4, g);
      const gar = P.garages.length, depth = P.garBack - P.garFront;
      F1.TEAMS.forEach((team, k) => {
        const q = P.garages[gar - 1 - k]; if (!q) return; let s0 = q.s0, s1 = q.s1; if (s1 < s0) s1 += T.length; const len = s1 - s0, grp = new THREE.Group(), col = C(team.ui || team.primary);
        const body = new THREE.Mesh(new THREE.BoxGeometry(len, 5.2, depth), MAT.conc); body.position.y = 2.6; body.castShadow = body.receiveShadow = true; grp.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 0.4, depth + 0.4), std({ color: col, roughness: 0.5 })); roof.position.y = 5.4; grp.add(roof);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 0.3), std({ color: col, roughness: 0.4 })); fr.position.set(0, 4.5, -sd * (depth / 2 + 0.1)); grp.add(fr);
        const door = new THREE.Mesh(new THREE.BoxGeometry(len - 5, 3.3, 0.3), MAT.dark); door.position.set(0, 1.65, -sd * (depth / 2 + 0.05)); grp.add(door);
        const p = F1.trackPoint(T, (s0 + s1) / 2, sd * (P.garFront + depth / 2)); grp.position.set(p.x, 0, p.y); grp.rotation.y = -p.h; g.add(grp);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(6, 1.9, 1.4), std({ color: col, roughness: 0.5 })); const sp = F1.trackPoint(T, q.mid, sd * (P.wallOff + 1.0)); stand.position.set(sp.x, 1.5, sp.y); stand.rotation.y = -sp.h; g.add(stand);
      });
    }
    // grandstands: opposite the pits on the main straight, plus on the outside of the tightest corners
    const stands = [], standSide = P ? -P.side : -T.poleSide;
    function addStand(s, sd, len) {
      const wd = WA(F1.idxAt(T, s), sd), grp = new THREE.Group(), tiers = 7;
      for (let i = 0; i < tiers; i++) { const h = 1.6 + i * 1.5, b = new THREE.Mesh(scaleUV(new THREE.BoxGeometry(len, h, 2.4), len / 8, h / 3), MAT.crowd); b.position.set(0, h / 2, sd * (i * 2.4 + 1.2)); b.castShadow = b.receiveShadow = true; grp.add(b); }
      const top = 1.6 + tiers * 1.5 + 3.2, roof = new THREE.Mesh(new THREE.BoxGeometry(len + 4, 0.35, tiers * 2.4 + 3), std({ color: 0x24324d, roughness: 0.5 })); roof.position.set(0, top, sd * (tiers * 1.2 + 0.6)); roof.castShadow = true; grp.add(roof);
      [-1, 1].forEach((e) => [0.1, 0.9].forEach((f) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, top, 6), MAT.steel); c.position.set(e * (len / 2), top / 2, sd * (f * tiers * 2.4)); grp.add(c); }));
      const p = place(T, grp, s, sd * (wd + 8)); g.add(grp); stands.push([p.x, p.y]);
    }
    for (let s = -330; s < 220; s += 110) addStand(s, standSide, 100);
    const peaks = []; for (let k = 0; k < n; k += 4) { const c = Math.abs(T.curv[k]); if (c > 1 / 160 && c >= Math.abs(T.curv[(k - 8 + n) % n]) && c >= Math.abs(T.curv[(k + 8) % n])) peaks.push([k * T.ds, c, T.curv[k]]); }
    peaks.sort((a, b) => b[1] - a[1]); const used = [];
    peaks.forEach((p) => { if (used.length >= 6 || p[0] > T.length - 380 && p[0] < T.length || p[0] < 280) return; if (used.some((u) => Math.abs(u - p[0]) < 350)) return; used.push(p[0]); addStand(p[0], p[2] > 0 ? -1 : 1, 70); });
    // trees (conifers + broadleaf), kept clear of the track, stands and the start straight
    const cell = 60, grid = new Map(); for (let i = 0; i < n; i += 2) { const key = Math.floor(T.x[i] / cell) + ',' + Math.floor(T.y[i] / cell); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i); }
    const near = (x, y) => { const cx = Math.floor(x / cell), cy = Math.floor(y / cell); let best = 1e18, bi = 0; for (let a = cx - 2; a <= cx + 2; a++) for (let b = cy - 2; b <= cy + 2; b++) { const l = grid.get(a + ',' + b); if (!l) continue; for (let q = 0; q < l.length; q++) { const i = l[q], d = (T.x[i] - x) * (T.x[i] - x) + (T.y[i] - y) * (T.y[i] - y); if (d < best) { best = d; bi = i; } } } return [Math.sqrt(best), bi]; };
    const con = [], brd = [], sp = 10, pad = 220;
    for (let x = B.minX - pad; x < B.maxX + pad; x += sp) for (let y = B.minY - pad; y < B.maxY + pad; y += sp) {
      const tx = x + (rnd() - 0.5) * sp * 0.95, ty = y + (rnd() - 0.5) * sp * 0.95, nt = near(tx, ty);
      if (nt[0] > 230 || nt[0] < T.wall[nt[1]] + 9 || rnd() < 0.22) continue;
      if (nt[0] < T.maxWall + 44 && (nt[1] * T.ds > T.length - 420 || nt[1] * T.ds < 300)) continue;
      if (P && nt[0] < P.garBack + 60 && Math.abs(nt[1] * T.ds - (P.gA + P.gB) / 2) < 260) continue;
      if (stands.some((q) => (q[0] - tx) * (q[0] - tx) + (q[1] - ty) * (q[1] - ty) < 1400)) continue;
      (rnd() < 0.55 ? con : brd).push([tx, ty, 0.8 + rnd() * 1.1]);
    }
    const inst = (geo, mat, list, f) => { const m = new THREE.InstancedMesh(geo, mat, list.length), mm = new THREE.Matrix4(), q = new THREE.Quaternion(); list.forEach((t, i) => { const sc = t[2]; mm.compose(new THREE.Vector3(t[0], f.y * sc, t[1]), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t[0] * 7.3), new THREE.Vector3(sc * (f.sx || 1), sc * (f.sy || 1), sc * (f.sx || 1))); m.setMatrixAt(i, mm); m.setColorAt(i, C(f.c).offsetHSL((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.09)); }); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; g.add(m); return m; };
    const lam = (c) => new THREE.MeshLambertMaterial({ color: 0xffffff }), trunk = new THREE.MeshLambertMaterial({ color: 0xffffff });
    inst(new THREE.CylinderGeometry(0.3, 0.45, 3.5, 6), trunk, con, { y: 1.7, c: 0x4a3322 }); inst(new THREE.ConeGeometry(3.4, 8, 8), lam(), con, { y: 6.2, c: 0x1c4a26 }); inst(new THREE.ConeGeometry(2.4, 6, 8), lam(), con, { y: 10.4, c: 0x235a2d });
    inst(new THREE.CylinderGeometry(0.35, 0.55, 4.5, 6), trunk, brd, { y: 2.2, c: 0x5a4430 }); inst(new THREE.IcosahedronGeometry(4.2, 1), lam(), brd, { y: 7.6, c: 0x3f7a2c, sy: 0.85 }); inst(new THREE.IcosahedronGeometry(3, 1), lam(), brd.filter((_, i) => i % 2 === 0).map((t) => [t[0] + 1.5, t[1] + 1, t[2] * 0.8]), { y: 9.6, c: 0x4e8b34 });
    // distant hills
    const cx = (B.minX + B.maxX) / 2, cy = (B.minY + B.maxY) / 2, R = Math.max(B.maxX - B.minX, B.maxY - B.minY) / 2 + 1500;
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2 + rnd() * 0.1, r = R + rnd() * 1800, h = 120 + rnd() * 380, w = 500 + rnd() * 900; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: C(0x35553a).lerp(C(A.hor), 0.35 + rnd() * 0.25) })); m.scale.set(w, h, w * 0.8); m.position.set(cx + Math.cos(a) * r, -20, cy + Math.sin(a) * r); g.add(m); }
    // floodlights (dusk / night circuits)
    if (A.lamps) { const lp = [], hd = []; for (let k = 0; k < n; k += 14) side2.forEach((s) => { const d = s * (WA(k, s) + 2.2); lp.push([T.x[k] + T.nx[k] * d, T.y[k] + T.ny[k] * d, s, T.hd[k]]); }); const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 16, 6), MAT.steel, lp.length), heads = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.3, 1.0), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), lp.length); lp.forEach((p, i) => { mt.makeTranslation(p[0], 8, p[1]); poles.setMatrixAt(i, mt); mt.makeTranslation(p[0] - p[2] * 0 , 16.1, p[1]); heads.setMatrixAt(i, mt); }); g.add(poles, heads); }
  }

  // ------------------------------------------------------------ car model
  const tyreG = [new THREE.CylinderGeometry(0.36, 0.36, 0.4, 28), new THREE.CylinderGeometry(0.4, 0.4, 0.52, 28)];
  const ell = new THREE.SphereGeometry(1, 24, 14), cmp = [0xd3151b, 0xf4c400, 0xf2f2f2];
  const nose = new THREE.LatheGeometry([[0.0, 0], [0.07, 0.15], [0.14, 0.55], [0.22, 1.1], [0.29, 1.6], [0.31, 2.0]].map((p) => new THREE.Vector2(p[0], p[1])), 20).rotateZ(-Math.PI / 2).scale(1, 0.62, 1);
  function numTex(num) { return tex(128, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '900 54px sans-serif'; g.textAlign = 'center'; g.fillText(String(num), w / 2, 52); }); }
  function makeCar(c) {
    const team = c.team || F1.TEAMS[0], d = F1.driver(c.code), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const phys = (col) => new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 });
    const pm = phys(team.primary), sm = phys(team.secondary), am = phys(team.accent), cb = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.45, metalness: 0.5 }), tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }), alloy = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.3 });
    const add = (geo, mat, x, y, z, par, sc) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sc) m.scale.set(...sc); m.castShadow = true; (par || body).add(m); return m; };
    const box = (w, h, dd) => new THREE.BoxGeometry(w, h, dd);
    add(ell, pm, 0.1, 0.5, 0, 0, [1.5, 0.27, 0.34]); add(nose, pm, 0.85, 0.4, 0);
    [-1, 1].forEach((s) => {
      add(ell, pm, -0.3, 0.4, s * 0.64, 0, [1.25, 0.3, 0.36]); add(ell, cb, 0.85, 0.44, s * 0.62, 0, [0.12, 0.2, 0.3]);
      add(box(0.7, 0.3, 0.04), sm, 2.62, 0.27, s * 0.98); add(box(0.7, 0.04, 0.04), sm, 2.3, 0.1, s * 0.98);
      add(box(0.9, 0.55, 0.04), sm, -2.62, 0.98, s * 0.58); add(box(0.2, 0.1, 0.1), cb, 0.78, 0.74, s * 0.52); add(ell, am, 0.78, 0.74, s * 0.56, 0, [0.07, 0.05, 0.1]);
      [-1, 1].forEach((i) => add(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 5).rotateX(Math.PI / 2), cb, 1.7 + (i < 0 ? -3.45 : 0), 0.28 + (s > 0 ? 0 : 0) , s * 0.55));
      add(new THREE.TorusGeometry(0.34, 0.022, 6, 16, Math.PI), cb, 0.3, 0.72, s * 0.2);
    });
    add(ell, pm, -1.35, 0.62, 0, 0, [1.15, 0.3, 0.2]); add(ell, cb, -0.4, 1.0, 0, 0, [0.3, 0.2, 0.17]); add(ell, cb, -2.0, 0.42, 0, 0, [0.7, 0.2, 0.2]);
    add(box(3.7, 0.05, 1.85), cb, -0.1, 0.12, 0); add(box(0.8, 0.05, 1.2), cb, -2.4, 0.2, 0).rotation.z = -0.25;
    add(box(0.6, 0.04, 2.0), sm, 2.7, 0.1, 0); add(box(0.4, 0.04, 1.9), pm, 2.5, 0.19, 0); add(box(0.3, 0.12, 0.05), cb, 2.4, 0.2, 0);
    [-1, 1].forEach((s) => add(box(0.8, 0.32, 0.04), am, 2.62, 0.26, s * 1.0));
    add(box(0.55, 0.05, 1.15), sm, -2.72, 0.9, 0); add(box(0.5, 0.04, 1.0), sm, -2.4, 0.3, 0); add(box(0.1, 0.65, 0.1), cb, -2.45, 0.6, 0);
    const flap = new THREE.Group(); flap.position.set(-2.5, 1.12, 0); body.add(flap); add(box(0.42, 0.045, 1.15), sm, -0.2, 0, 0, flap);
    add(new THREE.SphereGeometry(0.16, 14, 10), am, 0.12, 0.84, 0); add(ell, cb, 0.26, 0.85, 0, 0, [0.07, 0.07, 0.15]);
    const nt = numTex(d ? d.number : ''); const np = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: nt, transparent: true })); np.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); np.position.set(1.5, 0.52, 0); np.rotation.order = 'YXZ'; np.rotation.set(-Math.PI / 2, -Math.PI / 2, 0); body.add(np);
    const wheels = [], fronts = [], cmpC = cmp[(Math.random() * 3) | 0];
    [[1.7, 0], [-1.75, 1]].forEach((q) => [-1, 1].forEach((s) => {
      const piv = new THREE.Group(); piv.position.set(q[0], q[1] ? 0.4 : 0.36, s * (q[1] ? 0.96 : 0.92)); root.add(piv);
      const w = add(tyreG[q[1]], tyre, 0, 0, 0, piv); w.rotation.x = Math.PI / 2; wheels.push(w); const hw2 = q[1] ? 0.26 : 0.2;
      add(new THREE.CylinderGeometry(0.22, 0.22, hw2 * 2 + 0.01, 20), alloy, 0, 0, 0, w); add(new THREE.TorusGeometry(0.3, 0.012, 6, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: cmpC }), 0, s * (hw2 + 0.005), 0, w);
      if (!q[1]) fronts.push(piv);
    }));
    if (c.label) { const cv = document.createElement('canvas'); cv.width = 160; cv.height = 52; const g = cv.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 160, 52); g.fillStyle = team.ui || '#fff'; g.fillRect(0, 0, 9, 52); g.fillStyle = '#fff'; g.font = '800 30px sans-serif'; g.textAlign = 'center'; g.fillText(c.label, 86, 38); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, transparent: true })); sp.scale.set(6.4, 2.1, 1); sp.position.y = 3.3; root.add(sp); root.userData.label = sp; }
    if (c.ghost || c.replay) root.traverse((o) => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = c.replay ? 0.38 : 0.42; o.castShadow = false; } });
    root.userData.k = { body, wheels, fronts, flap, flapA: 0, roll: 0, pitch: 0, sp: 0, hide: [] }; scene.add(root); return root;
  }

  // ------------------------------------------------------------ particles (sparks + tyre smoke)
  function Pool(max, size, map, add, grav, op) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    this.pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, depthWrite: false, opacity: op, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true }));
    this.pts.frustumCulled = false; this.p = []; this.max = max; this.grav = grav; scene.add(this.pts);
  }
  Pool.prototype.emit = function (x, y, z, vx, vy, vz, life, r, g, b) { if (this.p.length < this.max) this.p.push({ x, y, z, vx, vy, vz, l: life, L: life, r, g, b }); };
  Pool.prototype.step = function (dt) {
    const pa = this.pts.geometry.attributes.position, ca = this.pts.geometry.attributes.color; let n = 0;
    this.p = this.p.filter((q) => (q.l -= dt) > 0);
    this.p.forEach((q) => { q.vy -= this.grav * dt; q.x += q.vx * dt; q.y = Math.max(0.05, q.y + q.vy * dt); q.z += q.vz * dt; const f = q.l / q.L; pa.setXYZ(n, q.x, q.y, q.z); ca.setXYZ(n, q.r * f, q.g * f, q.b * f); n++; });
    for (let i = n; i < this.max; i++) pa.setXYZ(i, 0, -999, 0); pa.needsUpdate = ca.needsUpdate = true;
  };
  const sparks = new Pool(500, 0.3, TX.soft, true, 12, 1), smoke = new Pool(300, 3.5, TX.soft, false, -0.4, 0.4);

  // ------------------------------------------------------------ per-frame drawing
  const cars = new Map(); let camYaw = 0, camReady = false, camMode = 0, now = 0, shake = 0;
     addEventListener('keydown', (e) => { if ((e.code === 'KeyV' || e.code === 'KeyC') && !e.repeat) camMode = (camMode + 1) % 2; });
  const v3 = new THREE.Vector3(), look = new THREE.Vector3(), DIST = { close: 0.72, normal: 1, far: 1.7 };

  function draw3D(frame, dt, f) {
    const T = frame.track; if (!world || world.id !== T.id) buildWorld(T);
    now += dt; skyU.t.value = now; const used = new Set(); let me = null, any = null;
    frame.cars.forEach((c) => {
      const key = c.id + '|' + (c.team ? c.team.id : '') + (c.ghost ? 'g' : '') + (c.replay ? 'r' : '') + (c.label || ''); let m = cars.get(key); if (!m) { m = makeCar(c); cars.set(key, m); }
      used.add(key); m.visible = true; m.position.set(c.x, 0, c.y); m.rotation.y = -c.a; const K = m.userData.k, sp = Math.hypot(c.vx || 0, c.vy || 0);
      K.fronts.forEach((w) => (w.rotation.y = -(c.delta || 0))); K.wheels.forEach((w) => (w.rotation.y += (sp / 0.38) * dt));
      K.flapA += ((c.drsOpen ? 0.6 : 0) - K.flapA) * Math.min(1, dt * 12); K.flap.rotation.z = -K.flapA;
      const acc = dt > 0 ? (sp - K.sp) / dt : 0; K.sp = sp; K.roll += (Math.max(-0.05, Math.min(0.05, -(c.delta || 0) * sp * 0.0009)) - K.roll) * Math.min(1, dt * 6); K.pitch += (Math.max(-0.035, Math.min(0.03, -acc * 0.0007)) - K.pitch) * Math.min(1, dt * 6); K.body.rotation.set(K.roll, 0, K.pitch);
      if (m.userData.label) m.userData.label.visible = !!frame.labels && !c.me;
      if (c.me) me = { c, m, K }; if (!any) any = { c, m, K };
      if (dt > 0 && !c.ghost && !c.replay && (c.lock || ((c.surf || 0) >= 2 && sp > 15))) { const grass = (c.surf || 0) >= 2, col = grass ? [0.45, 0.4, 0.3] : [0.75, 0.75, 0.75]; for (let i = 0; i < 2; i++) smoke.emit(c.x - Math.cos(c.a) * 1.8 + (Math.random() - 0.5), 0.3, c.y - Math.sin(c.a) * 1.8 + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 0.6 + Math.random(), (Math.random() - 0.5) * 2, 1.1, col[0], col[1], col[2]); }
    });
    cars.forEach((m, k) => { if (!used.has(k)) m.visible = false; });
    const fv = f.focus || (any && any.c), fm = me || any;
    if (fv) {
      const sp = Math.hypot(fv.vx || 0, fv.vy || 0), kmh = sp * 3.6; if (!camReady) { camYaw = fv.a; camReady = true; } camYaw += wrap(fv.a - camYaw) * (1 - Math.exp(-5 * (dt || 0.016)));
      const dm = DIST[f.distance] || 1, sh = (kmh / 340) * 0.045 + shake; shake *= 0.9; let fov = 60;
      if (!me) { const ang = now * 0.25, d = 16 * dm; cam.position.set(fv.x - Math.cos(camYaw) * d + Math.sin(camYaw) * Math.sin(ang) * 10, 5 + 2 * Math.sin(ang * 0.7), fv.y - Math.sin(camYaw) * d - Math.cos(camYaw) * Math.sin(ang) * 10); look.set(fv.x + Math.cos(camYaw) * 4, 1, fv.y + Math.sin(camYaw) * 4); fov = 52; }
      else if (camMode === 1) { cam.position.set(fv.x + Math.cos(fv.a) * 0.15, 1.12, fv.y + Math.sin(fv.a) * 0.15); look.set(fv.x + Math.cos(fv.a) * 30, 0.9, fv.y + Math.sin(fv.a) * 30); fov = 80 + kmh * 0.06; }
      else if (!f.rotate) { cam.position.set(fv.x - Math.cos(camYaw) * 24 * dm, 13 * dm, fv.y - Math.sin(camYaw) * 24 * dm); look.set(fv.x, 0.5, fv.y); fov = 48; }
      else { const d = (8.5 + kmh * 0.008) * dm; cam.position.set(fv.x - Math.cos(camYaw) * d, (2.9 + kmh * 0.003) * (0.8 + dm * 0.2), fv.y - Math.sin(camYaw) * d); look.set(fv.x + Math.cos(camYaw) * 7, 1.3, fv.y + Math.sin(camYaw) * 7); fov = 62 + kmh * 0.11; }
      cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh; cam.lookAt(look);
      if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, (dt || 0.016) * 4); cam.updateProjectionMatrix(); }
      if (fm) fm.K.hide.forEach((o) => (o.visible = !(me && camMode === 1)));
      sun.position.set(fv.x + world.sunDir.x * 220, world.sunDir.y * 220 + 10, fv.y + world.sunDir.z * 220); sun.target.position.set(fv.x, 0, fv.y); sun.target.updateMatrixWorld();
    }
    sky.position.copy(cam.position);
    world.bulbs.forEach((b, i) => b.material.color.set(i < (frame.lights || 0) ? 0xff1a1a : 0x300000));
    sparks.step(dt); smoke.step(dt); gl.render(scene, cam);
  }

  // ------------------------------------------------------------ plug into the existing Renderer
  const P = Renderer.prototype, uCam = P.updateCamera, uReset = P.resetEffects;
  P.updateCamera = function (focus, dt, rotate, distance) { uCam.call(this, focus, dt, rotate, distance); this.f3 = { focus, rotate, distance }; };
  P.resetEffects = function () { uReset.call(this); camReady = false; sparks.p.length = 0; smoke.p.length = 0; };
  P.sparks = function (x, y, power) { const n = Math.min(40, 6 + power / 400); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 4 + Math.random() * 12; sparks.emit(x, 0.5, y, Math.cos(a) * v, 2 + Math.random() * 6, Math.sin(a) * v, 0.5 + Math.random() * 0.6, 1, 0.7 + Math.random() * 0.2, 0.25); } shake = Math.min(0.25, shake + power / 40000); };
  P.drawWorld = function (frame, dt) {
    this.prep(frame.track); draw3D(frame, dt, this.f3 || {});
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  };
}
