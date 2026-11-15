import * as THREE from 'three';

// Profil du fût de la botte (rayon, hauteur) — évasé en haut, étroit à la cheville
const PROFILE = [
  [0.52, 0.9], [0.50, 1.9], [0.52, 2.8], [0.62, 4.0], [0.82, 5.4],
  [1.02, 6.8], [1.12, 8.0], [1.12, 9.0], [1.08, 9.75],
];
const Z_SCALE = 0.88;

function radiusAt(y) {
  if (y <= PROFILE[0][1]) return PROFILE[0][0];
  for (let i = 1; i < PROFILE.length; i++) {
    const [r0, y0] = PROFILE[i - 1];
    const [r1, y1] = PROFILE[i];
    if (y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return PROFILE[PROFILE.length - 1][0];
}

function makeMaterials() {
  const black = new THREE.MeshPhysicalMaterial({
    name: 'noir_chrome', color: 0x0a0a0c, metalness: 1, roughness: 0.2,
    clearcoat: 1, clearcoatRoughness: 0.12,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    name: 'chrome_sombre', color: 0x3a3b40, metalness: 1, roughness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const dark = new THREE.MeshStandardMaterial({
    name: 'interieur', color: 0x020203, metalness: 0.5, roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.MeshBasicMaterial({ name: 'reacteur_lueur', color: 0x8fdcff });
  const plumeOuter = new THREE.MeshBasicMaterial({
    name: 'flamme_ext', color: 0x2f9bff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const plumeInner = new THREE.MeshBasicMaterial({
    name: 'flamme_int', color: 0xd8f3ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  return { black, chrome, dark, glow, plumeOuter, plumeInner };
}

function makePlume(mats, radius, length, thrusters, base) {
  const g = new THREE.Group();
  g.name = 'flamme';
  const make = (r, h, mat) => {
    const prof = [[0.001, 0], [r * 0.92, 0], [r, -0.1 * h], [r * 0.8, -0.32 * h], [r * 0.42, -0.66 * h], [0.001, -h]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat);
    m.userData.plume = true;
    return m;
  };
  const outer = make(radius, length, mats.plumeOuter);
  const inner = make(radius * 0.5, length * 0.7, mats.plumeInner);
  g.add(outer, inner);
  thrusters.push({ group: g, phase: Math.random() * 10, base });
  return g;
}

// Réacteur de mollet : capsule verticale, tuyère évasée vers le bas, flamme vers le bas
function makeCalfPod(mats, thrusters) {
  const pod = new THREE.Group();
  pod.name = 'reacteur_mollet';

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 2.5, 10, 32), mats.black);
  pod.add(body);

  // Bagues de renfort
  for (const y of [1.05, 0.35, -0.35]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.028, 16, 40), mats.chrome);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    pod.add(ring);
  }

  // Fente lumineuse sur la face extérieure
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.5, 0.03), mats.glow);
  slit.position.set(0, 0.25, 0.2);
  pod.add(slit);

  // Tuyère en cloche (ouverte vers le bas)
  const bell = [[0.17, 0.0], [0.19, -0.12], [0.24, -0.3], [0.31, -0.46], [0.37, -0.6]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const nozzle = new THREE.Mesh(new THREE.LatheGeometry(bell, 48), mats.chrome);
  nozzle.material = nozzle.material.clone();
  nozzle.material.side = THREE.DoubleSide;
  nozzle.position.y = -1.42;
  pod.add(nozzle);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 16, 48), mats.chrome);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -2.02;
  pod.add(lip);

  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), mats.glow);
  disc.rotation.x = Math.PI / 2; // face vers le bas
  disc.position.y = -1.95;
  disc.name = 'disque_reacteur';
  pod.add(disc);

  const plume = makePlume(mats, 0.34, 1.5, thrusters, 1);
  plume.position.y = -2.0;
  pod.add(plume);
  return pod;
}

function makeSolePort(mats, radius, x, z, thrusters) {
  const g = new THREE.Group();
  g.name = 'reacteur_semelle';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.18, 20, 48), mats.chrome);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.95, 40), mats.dark);
  hole.rotation.x = Math.PI / 2;
  hole.position.y = -0.01;
  g.add(hole);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.62, 40), mats.glow);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = -0.03;
  disc.name = 'disque_semelle';
  g.add(disc);
  const plume = makePlume(mats, radius * 1.0, radius * 3.4, thrusters, 1);
  plume.position.y = -0.04;
  g.add(plume);
  g.position.set(x, 0.02, z);
  return g;
}

function makeBoot(mats, thrusters) {
  const boot = new THREE.Group();
  boot.name = 'botte';

  // Fût (lathe lissé) — z aplati pour un mollet légèrement elliptique
  const pts = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(80);
  const shaft = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), mats.black);
  shaft.scale.z = Z_SCALE;
  shaft.name = 'fut';
  boot.add(shaft);

  // Intérieur sombre + lèvre du col
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.4, 80, 1, true), mats.dark);
  inner.position.y = 8.6;
  inner.scale.z = Z_SCALE;
  boot.add(inner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.09, 0.075, 24, 96), mats.chrome);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 9.78;
  rim.scale.y = Z_SCALE; // après rotation, l'axe local y correspond à z monde
  boot.add(rim);

  // Anneaux de plaques sur le bas du mollet
  for (const y of [2.35, 3.05]) {
    const r = radiusAt(y) + 0.015;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 16, 80), mats.chrome);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    ring.scale.y = Z_SCALE;
    boot.add(ring);
  }

  // Cheville, pied, semelle
  const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.8, 56, 40), mats.black);
  ankle.scale.set(1.0, 0.7, 1.25);
  ankle.position.set(0, 1.1, 0.3);
  boot.add(ankle);

  const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), mats.black);
  foot.scale.set(0.88, 0.62, 2.0);
  foot.position.set(0, 0.64, 0.9);
  foot.name = 'pied';
  boot.add(foot);

  const sole = new THREE.Mesh(new THREE.SphereGeometry(1, 72, 24), mats.chrome);
  sole.scale.set(0.93, 0.2, 2.06);
  sole.position.set(0, 0.2, 0.9);
  sole.name = 'semelle';
  boot.add(sole);

  // Trois réacteurs de semelle (déjà présents sur l'image)
  boot.add(makeSolePort(mats, 0.34, 0, -0.45, thrusters));
  boot.add(makeSolePort(mats, 0.22, -0.46, 1.55, thrusters));
  boot.add(makeSolePort(mats, 0.22, 0.46, 1.55, thrusters));

  // Deux réacteurs de mollet, arrière gauche et arrière droit, flamme vers le bas
  const yPod = 5.0;
  const R = radiusAt(yPod) + 0.07;
  for (const a of [-0.72, 0.72]) {
    const n = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    const outer = new THREE.Group();
    outer.position.set(n.x * R, yPod, n.z * R * Z_SCALE);
    outer.rotation.y = Math.atan2(n.x, n.z); // +z local = direction extérieure
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.15; // suit l'évasement du fût
    tilt.add(makeCalfPod(mats, thrusters));
    outer.add(tilt);
    boot.add(outer);
  }
  return boot;
}

export function buildBoots() {
  const mats = makeMaterials();
  const thrusters = [];
  const root = new THREE.Group();
  root.name = 'BottesReacteurs';
  const left = makeBoot(mats, thrusters);
  left.position.x = -2.1;
  left.name = 'botte_gauche';
  const right = makeBoot(mats, thrusters);
  right.position.x = 2.1;
  right.name = 'botte_droite';
  root.add(left, right);

  return {
    root,
    thrusters,
    update(t, on) {
      for (const th of thrusters) {
        const f = 0.9 + 0.1 * Math.sin(t * 38 + th.phase) + 0.05 * Math.sin(t * 61 + th.phase * 2);
        th.group.visible = on;
        th.group.scale.set(f, 0.85 + 0.3 * f, f);
      }
    },
  };
}
