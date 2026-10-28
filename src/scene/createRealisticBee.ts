import * as THREE from 'three';

export interface RealisticBee {
  mesh: THREE.Group;
  setWingFlap: (timeSec: number, frequency: number, amplitude: number) => void;
  setFoldedWings: (isFolded: boolean, twitch?: number) => void;
  setBreathing: (timeSec: number) => void;
  setLegPose: (tuckToPlantProgress: number) => void; // 0 = tucked in flight, 1 = planted on glass
  setFootAdjustment: (footIndex: number, amount: number) => void;
  getFootWorldPositions: () => THREE.Vector3[];
  dispose: () => void;
}

export function createRealisticBee(): RealisticBee {
  const root = new THREE.Group();
  root.name = 'RealisticHoneyBee';

  // Master materials
  const chitinMaterial = new THREE.MeshStandardMaterial({
    color: 0x18120b,
    roughness: 0.28,
    metalness: 0.18,
  });

  const eyeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0805,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ior: 1.6,
  });

  const thoraxFurMaterial = new THREE.MeshStandardMaterial({
    color: 0xd28620,
    roughness: 0.85,
    metalness: 0.02,
  });

  const abdomenGoldMaterial = new THREE.MeshStandardMaterial({
    color: 0xe59926,
    roughness: 0.42,
    metalness: 0.1,
  });

  const abdomenDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a130c,
    roughness: 0.32,
    metalness: 0.15,
  });

  const ventralBellyMaterial = new THREE.MeshStandardMaterial({
    color: 0xb46c18,
    roughness: 0.48,
    metalness: 0.12,
  });

  const legChitinMaterial = new THREE.MeshStandardMaterial({
    color: 0x22170c,
    roughness: 0.35,
    metalness: 0.2,
  });

  const clawMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d0905,
    roughness: 0.2,
    metalness: 0.3,
  });

  // Texture loader for authentic wing membrane
  const textureLoader = new THREE.TextureLoader();
  const wingTex = textureLoader.load('/images/bee-wings.png');
  wingTex.colorSpace = THREE.SRGBColorSpace;

  const wingMaterial = new THREE.MeshPhysicalMaterial({
    map: wingTex,
    transparent: true,
    opacity: 0.92,
    roughness: 0.12,
    metalness: 0.05,
    transmission: 0.85,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // =========================================================================
  // 1. THORAX (Golden-amber furry volumetric core)
  // =========================================================================
  const thoraxGroup = new THREE.Group();
  thoraxGroup.position.set(0, 0, 0);

  const thoraxGeom = new THREE.SphereGeometry(0.72, 28, 22);
  const thoraxMesh = new THREE.Mesh(thoraxGeom, thoraxFurMaterial);
  thoraxMesh.scale.set(1.15, 0.98, 0.95);
  thoraxGroup.add(thoraxMesh);

  // Dorsal scutum plate (darker chitin crest on top of thorax)
  const scutumGeom = new THREE.SphereGeometry(0.55, 20, 16);
  const scutumMesh = new THREE.Mesh(scutumGeom, chitinMaterial);
  scutumMesh.scale.set(1.1, 0.45, 0.85);
  scutumMesh.position.set(0.02, 0.42, 0);
  thoraxGroup.add(scutumMesh);

  // Golden collar fluff ring
  const collarGeom = new THREE.TorusGeometry(0.48, 0.12, 12, 24);
  const collarMesh = new THREE.Mesh(collarGeom, thoraxFurMaterial);
  collarMesh.rotation.y = Math.PI / 2;
  collarMesh.position.set(0.72, 0.05, 0);
  thoraxGroup.add(collarMesh);

  root.add(thoraxGroup);

  // =========================================================================
  // 2. HEAD & FACIAL ANATOMY
  // =========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0.92, 0.08, 0);

  // Cranium
  const headGeom = new THREE.SphereGeometry(0.44, 24, 20);
  const headMesh = new THREE.Mesh(headGeom, chitinMaterial);
  headMesh.scale.set(0.88, 1.12, 0.92);
  headGroup.add(headMesh);

  // Compound Eyes (large, glossy, lateral)
  const eyeGeom = new THREE.SphereGeometry(0.25, 20, 18);
  const leftEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  leftEye.scale.set(0.9, 1.45, 0.82);
  leftEye.position.set(0.08, 0.04, 0.32);
  leftEye.rotation.set(-0.25, 0.2, 0.15);
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeom, eyeMaterial);
  rightEye.scale.set(0.9, 1.45, 0.82);
  rightEye.position.set(0.08, 0.04, -0.32);
  rightEye.rotation.set(0.25, -0.2, 0.15);
  headGroup.add(rightEye);

  // Antennae
  const leftAntenna = new THREE.Group();
  leftAntenna.position.set(0.35, 0.15, 0.14);
  const antGeom1 = new THREE.CylinderGeometry(0.022, 0.028, 0.26, 8);
  const antBase = new THREE.Mesh(antGeom1, chitinMaterial);
  antBase.rotation.z = -Math.PI / 3;
  antBase.position.set(0.1, 0.06, 0);
  const antGeom2 = new THREE.CylinderGeometry(0.016, 0.022, 0.36, 8);
  const antTip = new THREE.Mesh(antGeom2, chitinMaterial);
  antTip.position.set(0.28, 0.16, 0.04);
  antTip.rotation.z = -Math.PI / 6;
  leftAntenna.add(antBase, antTip);
  headGroup.add(leftAntenna);

  const rightAntenna = new THREE.Group();
  rightAntenna.position.set(0.35, 0.15, -0.14);
  const rightAntBase = new THREE.Mesh(antGeom1, chitinMaterial);
  rightAntBase.rotation.z = -Math.PI / 3;
  rightAntBase.position.set(0.1, 0.06, 0);
  const rightAntTip = new THREE.Mesh(antGeom2, chitinMaterial);
  rightAntTip.position.set(0.28, 0.16, -0.04);
  rightAntTip.rotation.z = -Math.PI / 6;
  rightAntenna.add(rightAntBase, rightAntTip);
  headGroup.add(rightAntenna);

  // Mouthparts / Proboscis
  const probGeom = new THREE.ConeGeometry(0.08, 0.42, 10);
  const probMesh = new THREE.Mesh(probGeom, chitinMaterial);
  probMesh.rotation.z = Math.PI / 2 + 0.35;
  probMesh.position.set(0.18, -0.38, 0);
  headGroup.add(probMesh);

  root.add(headGroup);

  // =========================================================================
  // 3. ABDOMEN (GASTER) — 6 DISTINCT SEGMENTS WITH SCULPTED VENTRAL BELLY
  // =========================================================================
  const abdomenGroup = new THREE.Group();
  abdomenGroup.position.set(-0.62, -0.06, 0);

  const abdomenSegments: THREE.Mesh[] = [];
  const ventralSternites: THREE.Mesh[] = [];

  const segmentSpecs = [
    { len: 0.28, r1: 0.62, r2: 0.68, mat: abdomenGoldMaterial, x: 0.0, tilt: 0.02 },
    { len: 0.32, r1: 0.68, r2: 0.72, mat: abdomenGoldMaterial, x: -0.26, tilt: -0.02 },
    { len: 0.30, r1: 0.70, r2: 0.68, mat: abdomenDarkMaterial, x: -0.54, tilt: -0.06 },
    { len: 0.28, r1: 0.66, r2: 0.58, mat: abdomenGoldMaterial, x: -0.80, tilt: -0.10 },
    { len: 0.26, r1: 0.56, r2: 0.42, mat: abdomenDarkMaterial, x: -1.04, tilt: -0.15 },
    { len: 0.32, r1: 0.40, r2: 0.10, mat: chitinMaterial, x: -1.26, tilt: -0.22 },
  ];

  segmentSpecs.forEach((spec, idx) => {
    // Dorsal & lateral tergite shell
    const segGeom = new THREE.CylinderGeometry(spec.r2, spec.r1, spec.len, 24);
    const segMesh = new THREE.Mesh(segGeom, spec.mat);
    segMesh.rotation.z = Math.PI / 2 + spec.tilt;
    segMesh.position.set(spec.x, spec.tilt * 0.4, 0);
    segMesh.scale.set(1.0, 0.94, 0.88);
    abdomenGroup.add(segMesh);
    abdomenSegments.push(segMesh);

    // Sculpted Ventral Sternite (Curved underbelly plate facing downward/forward)
    const sterniteGeom = new THREE.SphereGeometry(spec.r1 * 0.92, 16, 12, 0, Math.PI);
    const sterniteMesh = new THREE.Mesh(sterniteGeom, ventralBellyMaterial);
    sterniteMesh.rotation.x = Math.PI; // Face downward
    sterniteMesh.rotation.z = Math.PI / 2 + spec.tilt;
    sterniteMesh.position.set(spec.x, -spec.r1 * 0.25, 0);
    sterniteMesh.scale.set(spec.len * 1.5, 0.42, 0.82);
    abdomenGroup.add(sterniteMesh);
    ventralSternites.push(sterniteMesh);
  });

  // Stinger tip
  const stingerGeom = new THREE.ConeGeometry(0.04, 0.22, 8);
  const stingerMesh = new THREE.Mesh(stingerGeom, chitinMaterial);
  stingerMesh.rotation.z = Math.PI / 2 - 0.2;
  stingerMesh.position.set(-1.58, -0.22, 0);
  abdomenGroup.add(stingerMesh);

  root.add(abdomenGroup);

  // =========================================================================
  // 4. ARTICULATED 3D LEGS (6 LIMBS) WITH GROUND CONTACT PIVOTS
  // =========================================================================
  interface LegRig {
    group: THREE.Group;
    femur: THREE.Group;
    tibia: THREE.Group;
    tarsus: THREE.Group;
    clawTip: THREE.Object3D;
    baseTuckAngles: { fx: number; fy: number; fz: number; tx: number; tz: number };
    basePlantAngles: { fx: number; fy: number; fz: number; tx: number; tz: number };
  }

  const legs: LegRig[] = [];

  const createLeg = (
    coxaPos: THREE.Vector3,
    isRightSide: boolean,
    legType: 'front' | 'middle' | 'hind'
  ): LegRig => {
    const legGroup = new THREE.Group();
    legGroup.position.copy(coxaPos);

    const sideMult = isRightSide ? -1 : 1;
    const lenMult = legType === 'hind' ? 1.35 : legType === 'middle' ? 1.15 : 0.95;

    // Femur
    const femurGroup = new THREE.Group();
    const femurGeom = new THREE.CapsuleGeometry(0.052, 0.42 * lenMult, 6, 10);
    const femurMesh = new THREE.Mesh(femurGeom, legChitinMaterial);
    femurMesh.position.set(0, -0.22 * lenMult, 0);
    femurGroup.add(femurMesh);

    // Tibia (Knee joint)
    const tibiaGroup = new THREE.Group();
    tibiaGroup.position.set(0, -0.42 * lenMult, 0);

    // Hind tibia has the broad flattened pollen basket (corbicula)
    let tibiaMesh: THREE.Mesh;
    if (legType === 'hind') {
      const corbiculaGeom = new THREE.BoxGeometry(0.12, 0.52 * lenMult, 0.05);
      tibiaMesh = new THREE.Mesh(corbiculaGeom, chitinMaterial);
    } else {
      const tibiaGeom = new THREE.CapsuleGeometry(0.042, 0.48 * lenMult, 6, 10);
      tibiaMesh = new THREE.Mesh(tibiaGeom, legChitinMaterial);
    }
    tibiaMesh.position.set(0, -0.26 * lenMult, 0);
    tibiaGroup.add(tibiaMesh);

    // Tarsus (Ankle joint + 5-segment foot ending in claws)
    const tarsusGroup = new THREE.Group();
    tarsusGroup.position.set(0, -0.52 * lenMult, 0);

    const tarsusGeom = new THREE.CapsuleGeometry(0.028, 0.38 * lenMult, 6, 10);
    const tarsusMesh = new THREE.Mesh(tarsusGeom, legChitinMaterial);
    tarsusMesh.position.set(0, -0.19 * lenMult, 0);
    tarsusGroup.add(tarsusMesh);

    // Pretarsal Claws & Arolium Pad
    const clawGeom = new THREE.ConeGeometry(0.024, 0.09, 6);
    const claw1 = new THREE.Mesh(clawGeom, clawMaterial);
    claw1.rotation.set(0.4, 0, 0.2);
    claw1.position.set(0.02, -0.38 * lenMult, 0.02);
    const claw2 = new THREE.Mesh(clawGeom, clawMaterial);
    claw2.rotation.set(-0.4, 0, -0.2);
    claw2.position.set(-0.02, -0.38 * lenMult, -0.02);
    tarsusGroup.add(claw1, claw2);

    const clawTip = new THREE.Object3D();
    clawTip.position.set(0, -0.42 * lenMult, 0);
    tarsusGroup.add(clawTip);

    tibiaGroup.add(tarsusGroup);
    femurGroup.add(tibiaGroup);
    legGroup.add(femurGroup);
    root.add(legGroup);

    // Dynamic angles for flight tuck vs screen glass plant
    let baseTuckAngles: LegRig['baseTuckAngles'];
    let basePlantAngles: LegRig['basePlantAngles'];

    if (legType === 'front') {
      baseTuckAngles = { fx: 0.4 * sideMult, fy: 0.2, fz: -0.6, tx: -0.8 * sideMult, tz: 0.8 };
      basePlantAngles = { fx: 0.85 * sideMult, fy: 0.15, fz: -0.25, tx: -0.55 * sideMult, tz: 0.45 };
    } else if (legType === 'middle') {
      baseTuckAngles = { fx: 0.2 * sideMult, fy: 0.0, fz: -0.8, tx: -0.6 * sideMult, tz: 0.9 };
      basePlantAngles = { fx: 0.95 * sideMult, fy: 0.0, fz: -0.15, tx: -0.75 * sideMult, tz: 0.35 };
    } else {
      // Hind
      baseTuckAngles = { fx: -0.2 * sideMult, fy: -0.2, fz: -1.0, tx: -0.4 * sideMult, tz: 1.1 };
      basePlantAngles = { fx: 0.78 * sideMult, fy: -0.25, fz: -0.3, tx: -0.65 * sideMult, tz: 0.5 };
    }

    return {
      group: legGroup,
      femur: femurGroup,
      tibia: tibiaGroup,
      tarsus: tarsusGroup,
      clawTip,
      baseTuckAngles,
      basePlantAngles,
    };
  };

  // Attach 6 legs to underside of thorax (3 left, 3 right)
  legs.push(createLeg(new THREE.Vector3(0.42, -0.36, 0.38), false, 'front'));
  legs.push(createLeg(new THREE.Vector3(0.42, -0.36, -0.38), true, 'front'));
  legs.push(createLeg(new THREE.Vector3(0.04, -0.42, 0.42), false, 'middle'));
  legs.push(createLeg(new THREE.Vector3(0.04, -0.42, -0.42), true, 'middle'));
  legs.push(createLeg(new THREE.Vector3(-0.35, -0.38, 0.44), false, 'hind'));
  legs.push(createLeg(new THREE.Vector3(-0.35, -0.38, -0.44), true, 'hind'));

  // =========================================================================
  // 5. TRANSLUCENT CELLULAR VEINED WINGS (4 WINGS)
  // =========================================================================
  const wingHingeLeft = new THREE.Group();
  wingHingeLeft.position.set(0.12, 0.52, 0.28);

  const forewingLeftGeom = new THREE.PlaneGeometry(1.65, 0.72, 8, 4);
  const forewingLeft = new THREE.Mesh(forewingLeftGeom, wingMaterial);
  forewingLeft.position.set(-0.78, 0.05, 0);
  forewingLeft.rotation.z = Math.PI - 0.15;
  wingHingeLeft.add(forewingLeft);
  root.add(wingHingeLeft);

  const wingHingeRight = new THREE.Group();
  wingHingeRight.position.set(0.12, 0.52, -0.28);

  const forewingRight = new THREE.Mesh(forewingLeftGeom, wingMaterial);
  forewingRight.position.set(-0.78, 0.05, 0);
  forewingRight.rotation.z = Math.PI - 0.15;
  forewingRight.rotation.x = Math.PI; // Invert for symmetry
  wingHingeRight.add(forewingRight);
  root.add(wingHingeRight);

  // =========================================================================
  // 6. ANIMATION CONTROLLERS
  // =========================================================================

  const setWingFlap = (timeSec: number, frequency: number, amplitude: number) => {
    const phase = (timeSec * frequency * Math.PI * 2) % (Math.PI * 2);
    const flap = Math.sin(phase) * amplitude * (Math.PI / 180);
    const twist = Math.cos(phase) * (amplitude * 0.28) * (Math.PI / 180);

    wingHingeLeft.rotation.x = flap;
    wingHingeLeft.rotation.y = twist;
    wingHingeLeft.rotation.z = -0.15;

    wingHingeRight.rotation.x = -flap;
    wingHingeRight.rotation.y = -twist;
    wingHingeRight.rotation.z = -0.15;
  };

  const setFoldedWings = (isFolded: boolean, twitch = 0) => {
    if (isFolded) {
      // Folds neatly back over the dorsal abdomen
      wingHingeLeft.rotation.set(-0.18 + twitch * 0.05, -0.35, -0.05);
      wingHingeRight.rotation.set(0.18 - twitch * 0.05, 0.35, -0.05);
    }
  };

  const setBreathing = (timeSec: number) => {
    // 3.5 Hz natural respiratory expansion of abdomen segments
    const breath = 1.0 + Math.sin(timeSec * 3.5 * Math.PI * 2) * 0.024;
    abdomenSegments.forEach((seg, i) => {
      seg.scale.y = 0.94 * (1.0 + Math.sin(timeSec * 3.5 * Math.PI * 2 + i * 0.3) * 0.028);
      seg.scale.z = 0.88 * (1.0 + Math.sin(timeSec * 3.5 * Math.PI * 2 + i * 0.3) * 0.028);
    });
    ventralSternites.forEach((stern, i) => {
      stern.scale.y = 0.42 * (1.0 + Math.sin(timeSec * 3.5 * Math.PI * 2 + i * 0.3) * 0.038);
    });
  };

  const setLegPose = (progress: number) => {
    // 0 = tucked in flight, 1 = planted on glass
    const p = Math.max(0, Math.min(1, progress));
    legs.forEach((leg) => {
      const { baseTuckAngles: t, basePlantAngles: pl } = leg;
      leg.femur.rotation.x = t.fx + (pl.fx - t.fx) * p;
      leg.femur.rotation.y = t.fy + (pl.fy - t.fy) * p;
      leg.femur.rotation.z = t.fz + (pl.fz - t.fz) * p;
      leg.tibia.rotation.x = t.tx + (pl.tx - t.tx) * p;
      leg.tibia.rotation.z = t.tz + (pl.tz - t.tz) * p;
    });
  };

  const setFootAdjustment = (footIndex: number, amount: number) => {
    if (legs[footIndex]) {
      legs[footIndex].tarsus.rotation.x += amount;
    }
  };

  const getFootWorldPositions = (): THREE.Vector3[] => {
    root.updateMatrixWorld(true);
    return legs.map((leg) => {
      const pos = new THREE.Vector3();
      leg.clawTip.getWorldPosition(pos);
      return pos;
    });
  };

  // Initial state: flight pose
  setLegPose(0);

  return {
    mesh: root,
    setWingFlap,
    setFoldedWings,
    setBreathing,
    setLegPose,
    setFootAdjustment,
    getFootWorldPositions,
    dispose: () => {
      chitinMaterial.dispose();
      eyeMaterial.dispose();
      thoraxFurMaterial.dispose();
      abdomenGoldMaterial.dispose();
      abdomenDarkMaterial.dispose();
      ventralBellyMaterial.dispose();
      legChitinMaterial.dispose();
      clawMaterial.dispose();
      wingMaterial.dispose();
      wingTex.dispose();
      thoraxGeom.dispose();
      scutumGeom.dispose();
      collarGeom.dispose();
      headGeom.dispose();
      eyeGeom.dispose();
      probGeom.dispose();
      stingerGeom.dispose();
      forewingLeftGeom.dispose();
    },
  };
}
