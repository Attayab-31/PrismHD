import * as THREE from 'three';
const beforeUrl = '/images/sample-before.jpg';
const afterUrl = '/images/sample-after.png';

export type StoryScene = {
  setProgress: (progress: number) => void;
  setFlightProgress: (progress: number) => void;
  getBeeAnchor: () => { x: number; y: number; width: number; height: number };
  resize: () => void;
  dispose: () => void;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (a: number, b: number, value: number) => {
  const x = clamp01((value - a) / (b - a));
  return x * x * (3 - 2 * x);
};

export function createStoryScene(canvas: HTMLCanvasElement): StoryScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  camera.position.set(0.38, 0.02, 8.1);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
  keyLight.position.set(-3.5, 4.2, 5.5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xf1bd50, 0.9);
  fillLight.position.set(5, 0.8, 3.2);
  scene.add(fillLight);
  const rimLight = new THREE.PointLight(0xd58a24, 10, 20, 2);
  rimLight.position.set(2.7, 2.5, -1.4);
  scene.add(rimLight);

  const stage = new THREE.Group();
  stage.position.set(1.05, -0.08, 0);
  scene.add(stage);

  // A suspended field of image fragments gives the scroll reveal a tangible, physical moment.
  const fragmentGroup = new THREE.Group();
  stage.add(fragmentGroup);
  const fragmentGeometry = new THREE.BoxGeometry(0.14, 0.14, 0.12);
  const fragmentMaterials = [0xd58a24, 0xf6f0e5, 0x879174].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.18, transparent: true, opacity: 0 }));
  const fragments: { mesh: THREE.Mesh; x: number; y: number; z: number; phase: number }[] = [];
  for (let i = 0; i < 84; i += 1) {
    const angle = i * 2.399;
    const radius = 1.35 + (i % 13) * 0.095;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.68;
    const z = ((i % 7) - 3) * 0.13;
    const mesh = new THREE.Mesh(fragmentGeometry, fragmentMaterials[i % fragmentMaterials.length]);
    mesh.position.set(x * 1.8, y * 1.8, z - 0.7);
    mesh.rotation.set(angle * 0.2, angle * 0.12, angle);
    fragmentGroup.add(mesh);
    fragments.push({ mesh, x, y, z, phase: i * 0.31 });
  }

  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf8f1e3, roughness: 0.36, metalness: 0.08 });
  const honeyMetal = new THREE.MeshStandardMaterial({ color: 0xc47a1d, roughness: 0.3, metalness: 0.18 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x59604e, roughness: 0.38, metalness: 0.58 });

  const backplate = new THREE.Mesh(new THREE.BoxGeometry(4.68, 3.02, 0.18), ceramic);
  backplate.position.set(0, 0, -0.12);
  stage.add(backplate);

  // A subtle recessed rear surface adds depth without decorating the image itself.
  const rearPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 2.84),
    new THREE.MeshBasicMaterial({ color: 0xe7decc }),
  );
  rearPanel.position.set(0, 0, -0.022);
  stage.add(rearPanel);

  const textureLoader = new THREE.TextureLoader();
  const beforeTexture = textureLoader.load(beforeUrl);
  const afterTexture = textureLoader.load(afterUrl);
  const beePatchTexture = textureLoader.load('/images/bee-background-patch.png');
  for (const texture of [beforeTexture, afterTexture, beePatchTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  const imageGeometry = new THREE.PlaneGeometry(4.42, 2.76);
  const beforeMaterial = new THREE.MeshBasicMaterial({ map: beforeTexture, transparent: true, toneMapped: false });
  const afterMaterial = new THREE.MeshBasicMaterial({ map: afterTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const beePatchMaterial = new THREE.MeshBasicMaterial({ map: beePatchTexture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const beforeImage = new THREE.Mesh(imageGeometry, beforeMaterial);
  beforeImage.position.z = 0.012;
  const afterImage = new THREE.Mesh(imageGeometry, afterMaterial);
  afterImage.position.z = 0.018;
  const beePatchImage = new THREE.Mesh(imageGeometry, beePatchMaterial);
  beePatchImage.position.z = 0.024;
  stage.add(beforeImage, afterImage, beePatchImage);

  // Minimal precision rails: four slim rails, with small honey-brass end pieces.
  const addRail = (w: number, h: number, x: number, y: number, z: number, material: THREE.Material) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.055), material);
    rail.position.set(x, y, z);
    stage.add(rail);
  };
  addRail(4.78, 0.035, 0, 1.49, 0.065, darkMetal);
  addRail(4.78, 0.035, 0, -1.49, 0.065, darkMetal);
  addRail(0.035, 3.02, -2.37, 0, 0.065, darkMetal);
  addRail(0.035, 3.02, 2.37, 0, 0.065, darkMetal);
  addRail(0.18, 0.055, -2.34, 1.49, 0.095, honeyMetal);
  addRail(0.18, 0.055, 2.34, -1.49, 0.095, honeyMetal);

  // Small resolution tiles float just beyond the right edge, then settle as the image resolves.
  const tileGroup = new THREE.Group();
  stage.add(tileGroup);
  const tileGeometry = new THREE.BoxGeometry(0.115, 0.115, 0.075);
  const tileMeshes: THREE.Mesh[] = [];
  const tileMaterials: THREE.MeshStandardMaterial[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: (row + col) % 4 === 0 ? 0xc47a1d : (row + col) % 3 === 0 ? 0x9ca18e : 0xf8f1e3,
        roughness: 0.43,
        metalness: 0.1,
        transparent: true,
        opacity: 0.68,
      });
      const tile = new THREE.Mesh(tileGeometry, material);
      const x = 2.64 + col * 0.155;
      const y = 0.8 - row * 0.38;
      tile.position.set(x, y, 0.02 + ((row + col) % 3) * 0.035);
      tile.rotation.set((row % 2) * 0.07, (col % 2) * 0.08, ((row + col) % 3 - 1) * 0.035);
      tileGroup.add(tile);
      tileMeshes.push(tile);
      tileMaterials.push(material);
    }
  }

  // Fine architectural rings in the rear plane create dimensionality, not a decorative particle field.
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc47a1d, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.64, 2.655, 96), ringMaterial);
  ring.position.set(0, 0, -0.28);
  stage.add(ring);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let progress = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let currentPointerX = 0;
  let currentPointerY = 0;
  let inView = true;
  let disposed = false;

  const setProgress = (value: number) => {
    progress = clamp01(value);
    const compact = window.innerWidth < 900;
    const reveal = smoothstep(0.32, 0.78, progress);
    const assembly = smoothstep(0.12, 0.53, progress) * (1 - smoothstep(0.7, 0.96, progress));
    beforeMaterial.opacity = 1 - reveal;
    afterMaterial.opacity = reveal;
    stage.rotation.y = -0.105 + reveal * 0.085;
    stage.rotation.x = 0.018 + reveal * -0.018;
    stage.position.y = (compact ? -1.55 : -0.08) + Math.sin(progress * Math.PI) * 0.08;
    stage.position.x = (compact ? 0 : 1.05) - reveal * (compact ? 0 : 0.18);
    const scale = compact ? Math.min(0.86, Math.max(0.62, window.innerWidth / 820)) : 1;
    const zoom = 1 + reveal * 0.075;
    stage.scale.setScalar(scale * zoom);
    camera.position.z = (compact ? 8.8 : 8.1) - reveal * 0.28;
    tileMeshes.forEach((tile, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      tile.position.x = 2.64 + col * 0.155 - reveal * 0.34;
      tile.position.y = 0.8 - row * 0.38 + reveal * (0.8 - row * 0.38) * 0.08;
      tile.position.z = 0.02 + ((row + col) % 3) * 0.035 + reveal * 0.08;
      tile.rotation.z = ((row + col) % 3 - 1) * 0.035 * (1 - reveal);
      tileMaterials[index].opacity = 0.68 * (1 - reveal * 0.94);
    });
    ringMaterial.opacity = 0.18 * (1 - reveal * 0.65);
    fragments.forEach(({ mesh, x, y, z, phase }) => {
      const drift = assembly * 0.13;
      mesh.position.set(x * (1 + assembly * 0.8) + Math.sin(progress * 9 + phase) * drift,
        y * (1 + assembly * 0.8) + Math.cos(progress * 8 + phase) * drift,
        z - 0.72 + assembly * Math.sin(progress * 12 + phase) * 0.38);
      const settle = 1 - smoothstep(0.45, 0.86, progress);
      mesh.scale.setScalar((0.45 + assembly * 0.8) * settle);
      mesh.rotation.set(phase * 0.2 + progress * 1.2, phase * 0.15 - progress * 0.8, phase + progress * 1.6);
    });
    fragmentMaterials.forEach((material) => { material.opacity = assembly * 0.8; });
  };

  const setFlightProgress = (value: number) => {
    beePatchMaterial.opacity = clamp01(value);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (reducedMotion || window.innerWidth < 900) return;
    const rect = canvas.getBoundingClientRect();
    targetPointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.12;
    targetPointerY = ((event.clientY - rect.top) / rect.height - 0.5) * -0.08;
  };
  canvas.addEventListener('pointermove', onPointerMove, { passive: true });

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    camera.aspect = width / height;
    camera.fov = width < 900 ? 43 : 40;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 900 ? 1.2 : 1.65));
    renderer.setSize(width, height, false);
    setProgress(progress);
  };
  window.addEventListener('resize', resize, { passive: true });

  const render = () => {
    if (disposed || !inView) return;
    currentPointerX += (targetPointerX - currentPointerX) * 0.045;
    currentPointerY += (targetPointerY - currentPointerY) * 0.045;
    camera.position.x = 0.38 + currentPointerX;
    camera.position.y = 0.02 + currentPointerY;
    camera.lookAt(window.innerWidth < 900 ? 0 : 0.46, 0, 0);
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(render);

  const observer = new IntersectionObserver((entries) => {
    inView = entries[0]?.isIntersecting ?? true;
    renderer.setAnimationLoop(inView ? render : null);
    if (inView) render();
  }, { threshold: 0 });
  observer.observe(canvas);

  resize();
  setProgress(0);
  render();

  return {
    setProgress,
    setFlightProgress,
    getBeeAnchor: () => {
      const rect = canvas.getBoundingClientRect();
      camera.lookAt(window.innerWidth < 900 ? 0 : 0.46, 0, 0);
      camera.updateMatrixWorld(true);
      stage.updateMatrixWorld(true);
      const project = (x: number, y: number) => {
        const point = stage.localToWorld(new THREE.Vector3(x, y, 0.04)).project(camera);
        return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
      };
      const topLeft = project(-2.21, 1.38);
      const topRight = project(2.21, 1.38);
      const bottomLeft = project(-2.21, -1.38);
      const bottomRight = project(2.21, -1.38);
      const width = (Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y)
        + Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)) / 2;
      const height = (Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y)
        + Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)) / 2;
      // Exact center of the bee in sample-after.png (bx=145, by=40, w=520, h=420 on 740x492 canvas)
      const center = project((0.5473 - 0.5) * 4.42, (0.5 - 0.5081) * 2.76);
      return { ...center, width: width * (520 / 740), height: height * (420 / 492) };
    },
    resize,
    dispose: () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onPointerMove);
      renderer.setAnimationLoop(null);
      imageGeometry.dispose();
      beforeTexture.dispose();
      afterTexture.dispose();
      beePatchTexture.dispose();
      beforeMaterial.dispose();
      afterMaterial.dispose();
      beePatchMaterial.dispose();
      ceramic.dispose();
      honeyMetal.dispose();
      darkMetal.dispose();
      tileGeometry.dispose();
      fragmentGeometry.dispose();
      fragmentMaterials.forEach((material) => material.dispose());
      tileMaterials.forEach((material) => material.dispose());
      ringMaterial.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else if (material !== beforeMaterial && material !== afterMaterial) material.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
