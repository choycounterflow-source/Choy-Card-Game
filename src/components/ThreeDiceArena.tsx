import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronUp,
  Dices,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { BET_TIERS, type UserProfile } from '../types';
import {
  playChipClink,
  playDiceRoll,
  playWinFanfare,
  playCardDrop,
} from '../lib/audio';
import { AudioControlButton } from './AudioControlButton';

interface ThreeDiceArenaProps {
  user: UserProfile | null;
  onExit: () => void;
  onWalletUpdated?: (profile: UserProfile) => void;
}

interface ColorFaceDef {
  id: string;
  label: string;
  hex: number;
  cssHex: string;
  textDark: boolean;
  // Local Euler rotation that places this face pointing straight +Y (upward)
  topEuler: [number, number, number];
}

const COLOR_FACES: ColorFaceDef[] = [
  { id: 'red', label: 'RED', hex: 0xdc2626, cssHex: '#dc2626', textDark: false, topEuler: [0, 0, 0] },
  { id: 'blue', label: 'BLUE', hex: 0x2563eb, cssHex: '#2563eb', textDark: false, topEuler: [Math.PI, 0, 0] },
  { id: 'yellow', label: 'YELLOW', hex: 0xfacc15, cssHex: '#facc15', textDark: true, topEuler: [0, 0, Math.PI / 2] },
  { id: 'white', label: 'WHITE', hex: 0xf8fafc, cssHex: '#f8fafc', textDark: true, topEuler: [0, 0, -Math.PI / 2] },
  { id: 'pink', label: 'PINK', hex: 0xec4899, cssHex: '#ec4899', textDark: false, topEuler: [-Math.PI / 2, 0, 0] },
  { id: 'green', label: 'GREEN', hex: 0x16a34a, cssHex: '#16a34a', textDark: false, topEuler: [Math.PI / 2, 0, 0] },
];

type CameraPreset = 'table' | 'closeup' | 'overhead';

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  table: { pos: [0, 5.4, 6.9], target: [0, 0.25, 0.2] },
  closeup: { pos: [0, 2.9, 3.6], target: [0, 0.4, 0.2] },
  overhead: { pos: [0, 8.6, 1.4], target: [0, 0.15, 0.15] },
};

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _scratchPos = new THREE.Vector3();
const _scratchScale = new THREE.Vector3(1, 1, 1);
const _scratchQuat = new THREE.Quaternion();
const _scratchMat4 = new THREE.Matrix4();
const _scratchEuler = new THREE.Euler();
const _scratchTargetPos = new THREE.Vector3();
const _scratchTargetLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function createFeltTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 290);
  grad.addColorStop(0, '#0f6a4b');
  grad.addColorStop(0.7, '#094a34');
  grad.addColorStop(1, '#052b1e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Fine woven baize texture grain
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle inlaid gold VIP ring watermark
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 256, 206, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 192, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createTileTexture(face: ColorFaceDef, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = face.cssHex;
  ctx.fillRect(0, 0, 256, 256);

  // Gold inner frame
  ctx.strokeStyle = face.textDark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 10;
  ctx.strokeRect(16, 16, 224, 224);

  // Subtle emblem circle
  ctx.fillStyle = face.textDark ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.arc(128, 128, 72, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = face.textDark ? '#0f172a' : '#ffffff';
  ctx.font = '800 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(face.label, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createPlayingCardTexture(rank: string, suit: string, isRed: boolean, maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fffef9';
  ctx.fillRect(0, 0, 256, 360);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 344);

  ctx.fillStyle = isRed ? '#dc2626' : '#0f172a';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(rank, 24, 58);
  ctx.font = '42px sans-serif';
  ctx.fillText(suit, 26, 102);

  ctx.font = '120px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit, 128, 190);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildCompositeDie(maxAniso: number, disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; texs: THREE.Texture[] }): THREE.Group {
  // Composite 7-part procedural die: beveled metallic core + 6 raised inlaid face plates
  const group = new THREE.Group();
  const coreGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.85,
  });
  disposables.geos.push(coreGeo);
  disposables.mats.push(coreMat);
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  const plateGeo = new THREE.BoxGeometry(0.52, 0.04, 0.52);
  disposables.geos.push(plateGeo);

  const placements: Array<{ pos: [number, number, number]; rot: [number, number, number]; face: ColorFaceDef }> = [
    { pos: [0, 0.31, 0], rot: [0, 0, 0], face: COLOR_FACES[0] }, // +Y red
    { pos: [0, -0.31, 0], rot: [Math.PI, 0, 0], face: COLOR_FACES[1] }, // -Y blue
    { pos: [0.31, 0, 0], rot: [0, 0, -Math.PI / 2], face: COLOR_FACES[2] }, // +X yellow
    { pos: [-0.31, 0, 0], rot: [0, 0, Math.PI / 2], face: COLOR_FACES[3] }, // -X white
    { pos: [0, 0, 0.31], rot: [Math.PI / 2, 0, 0], face: COLOR_FACES[4] }, // +Z pink
    { pos: [0, 0, -0.31], rot: [-Math.PI / 2, 0, 0], face: COLOR_FACES[5] }, // -Z green
  ];

  for (const p of placements) {
    const tex = createTileTexture(p.face, maxAniso);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
    });
    disposables.texs.push(tex);
    disposables.mats.push(mat);

    const plate = new THREE.Mesh(plateGeo, mat);
    plate.position.set(p.pos[0], p.pos[1], p.pos[2]);
    plate.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
    plate.castShadow = true;
    group.add(plate);
  }

  return group;
}

export const ThreeDiceArena: React.FC<ThreeDiceArenaProps> = ({ user, onExit, onWalletUpdated }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<'title' | 'playing'>('title');
  const [dockExpanded, setDockExpanded] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('table');
  const [betUnit, setBetUnit] = useState<number>(5);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [rolling, setRolling] = useState(false);
  const [rolledColors, setRolledColors] = useState<string[]>(['red', 'yellow', 'green']);
  const [roundBanner, setRoundBanner] = useState<{ title: string; detail: string; won: boolean } | null>(null);
  const [liveWallet, setLiveWallet] = useState<number>(user ? user.wallet_balance : 0);
  const [roundCountdown, setRoundCountdown] = useState<number>(30);

  // Sync refs so the isolated WebGL render loop never restarts on React state updates
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const betsRef = useRef(bets);
  betsRef.current = bets;
  const betUnitRef = useRef(betUnit);
  betUnitRef.current = betUnit;
  const rollingRef = useRef(rolling);
  rollingRef.current = rolling;
  const userRef = useRef(user);
  userRef.current = user;

  const sceneActionsRef = useRef<{
    triggerRoll: (targetFaceIndices: [number, number, number]) => void;
    setCameraGoal: (preset: CameraPreset) => void;
    rebuildChipInstances: (nextBets: Record<string, number>) => void;
  } | null>(null);

  useEffect(() => {
    setLiveWallet(user ? user.wallet_balance : 0);
  }, [user?.wallet_balance, user]);

  const stakeColor = (colorId: string) => {
    if (rollingRef.current || !userRef.current) return;
    const currentStake = Object.values(betsRef.current).reduce((a, b) => a + b, 0);
    if (currentStake + betUnitRef.current > liveWallet) {
      setRoundBanner({
        won: false,
        title: 'Insufficient Wallet Balance',
        detail: `Available wallet: ₱${liveWallet.toFixed(2)}. Cash in to add more chips.`,
      });
      return;
    }
    playChipClink();
    setRoundBanner(null);
    setBets((prev) => {
      const next = { ...prev, [colorId]: (prev[colorId] || 0) + betUnitRef.current };
      sceneActionsRef.current?.rebuildChipInstances(next);
      return next;
    });
  };

  const clearBets = () => {
    if (rollingRef.current) return;
    setBets({});
    setRoundBanner(null);
    sceneActionsRef.current?.rebuildChipInstances({});
  };

  const rollDiceRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (phase !== 'playing') {
      setRoundCountdown(30);
      return;
    }
    const id = window.setInterval(() => {
      if (rollingRef.current) return;
      setRoundCountdown((prev) => {
        if (prev <= 1) {
          const staked = Object.values(betsRef.current).reduce((a, b) => a + b, 0);
          if (staked > 0) {
            window.setTimeout(() => rollDiceRef.current(), 0);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const rollDice = () => {
    const currentBets = betsRef.current;
    const totalStake = Object.values(currentBets).reduce((a, b) => a + b, 0);
    if (totalStake <= 0 || rollingRef.current) return;

    setRoundCountdown(30);
    playDiceRoll();
    setRolling(true);
    setRoundBanner(null);

    const targets: [number, number, number] = [
      Math.floor(Math.random() * 6),
      Math.floor(Math.random() * 6),
      Math.floor(Math.random() * 6),
    ];

    sceneActionsRef.current?.triggerRoll(targets);

    window.setTimeout(async () => {
      const winners = targets.map((idx) => COLOR_FACES[idx].id);
      setRolledColors(winners);
      setRolling(false);

      let grossReturn = 0;
      for (const [cid, amt] of Object.entries(currentBets)) {
        const hits = winners.filter((w) => w === cid).length;
        if (hits > 0) grossReturn += amt + amt * hits;
      }

      const netDelta = grossReturn - totalStake;
      const won = netDelta > 0;
      if (won) playWinFanfare();
      else playCardDrop();

      setLiveWallet((w) => Math.max(0, Number((w + netDelta).toFixed(2))));
      setRoundBanner({
        won,
        title: won ? `3D Dice Hit! +₱${netDelta.toFixed(2)}` : 'Dice Settled — Try Again',
        detail: `Rolled: ${winners.map((c) => c.toUpperCase()).join(' · ')} | Total Stake ₱${totalStake}`,
      });

      // Persist directly to live SQLite wallet
      if (user) {
        try {
          const res = await fetch('/api/table/settle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              tableId: `tbl-colorgame-b${betUnitRef.current}`,
              gameKey: 'colorgame',
              betAmount: betUnitRef.current,
              stakeTotal: totalStake,
              netDelta,
              won,
              summary: `3D VIP Dice (${winners.join(', ')})`,
              botWinnerId: null,
            }),
          });
          const data = await res.json();
          if (res.ok && data.profile && onWalletUpdated) {
            setLiveWallet(data.profile.wallet_balance);
            onWalletUpdated(data.profile);
          }
        } catch {
          // Keep responsive UI
        }
      }
    }, 1550);
  };

  rollDiceRef.current = rollDice;

  // Keyboard shortcuts (Enter/Space to start or roll, 1-6 stake colors, H toggle dock, Esc exit)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        onExit();
        return;
      }
      if (phaseRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (userRef.current) setPhase('playing');
          else onExit();
        }
        return;
      }
      if (e.code === 'KeyH') {
        setDockExpanded((v) => !v);
      } else if (e.code === 'Space') {
        e.preventDefault();
        rollDiceRef.current();
      } else if (e.key >= '1' && e.key <= '6') {
        const idx = Number(e.key) - 1;
        if (COLOR_FACES[idx]) stakeColor(COLOR_FACES[idx].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  // Isolated Three.js scene lifecycle (mounts once, zero React re-initialization)
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const disposables: { geos: THREE.BufferGeometry[]; mats: THREE.Material[]; texs: THREE.Texture[] } = {
      geos: [],
      mats: [],
      texs: [],
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x031812);
    scene.fog = new THREE.FogExp2(0x031812, 0.042);

    const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.1, 80);
    camera.position.set(0, 5.4, 6.9);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Studio RoomEnvironment reflection map on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Warm/cool 3-point lighting rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x052e16, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(5.5, 9.5, 4.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xfbbf24, 2.4, 18, 2);
    rimLight.position.set(-4.5, 4.0, -4.5);
    scene.add(rimLight);

    // OrbitControls with damped camera
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.2;
    controls.maxDistance = 12.5;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.target.set(0, 0.25, 0.2);

    let cameraTransitionActive = false;
    controls.addEventListener('start', () => {
      cameraTransitionActive = false;
    });

    // Floor & Soft Contact Shadow Grounding
    const floorGeo = new THREE.CircleGeometry(22, 48);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x041d16, roughness: 0.88, metalness: 0.08 });
    disposables.geos.push(floorGeo);
    disposables.mats.push(floorMat);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -2.25;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(7.2, 7.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    disposables.texs.push(shadowTex);
    disposables.geos.push(shadowGeo);
    disposables.mats.push(shadowMat);
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -2.23;
    scene.add(contactShadow);

    // ==================== COMPOSITE VIP OCTAGONAL TABLE (8+ PARTS) ====================
    const tableGroup = new THREE.Group();
    scene.add(tableGroup);

    // Part 1: Fluted Walnut Pedestal (LatheGeometry)
    const lathePoints = [
      new THREE.Vector2(1.45, -2.25),
      new THREE.Vector2(1.38, -2.0),
      new THREE.Vector2(0.82, -1.75),
      new THREE.Vector2(0.62, -1.1),
      new THREE.Vector2(0.75, -0.45),
      new THREE.Vector2(1.4, -0.2),
    ];
    const pedestalGeo = new THREE.LatheGeometry(lathePoints, 24);
    const mahoganyMat = new THREE.MeshStandardMaterial({
      color: 0x3b1d12,
      roughness: 0.38,
      metalness: 0.12,
    });
    const brassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9a13b,
      roughness: 0.18,
      metalness: 0.92,
      clearcoat: 0.6,
    });
    disposables.geos.push(pedestalGeo);
    disposables.mats.push(mahoganyMat, brassMat);

    const pedestal = new THREE.Mesh(pedestalGeo, mahoganyMat);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    tableGroup.add(pedestal);

    // Part 2: Brass Foot Ring
    const footRingGeo = new THREE.TorusGeometry(1.42, 0.07, 14, 48);
    disposables.geos.push(footRingGeo);
    const footRing = new THREE.Mesh(footRingGeo, brassMat);
    footRing.rotation.x = Math.PI / 2;
    footRing.position.y = -2.18;
    tableGroup.add(footRing);

    // Part 3: Octagonal Beveled Mahogany Outer Rail (ExtrudeGeometry)
    const octShape = new THREE.Shape();
    const outerR = 3.95;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * outerR;
      const y = Math.sin(a) * outerR;
      if (i === 0) octShape.moveTo(x, y);
      else octShape.lineTo(x, y);
    }
    octShape.closePath();

    const railGeo = new THREE.ExtrudeGeometry(octShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 3,
    });
    railGeo.rotateX(-Math.PI / 2);
    disposables.geos.push(railGeo);
    const railMesh = new THREE.Mesh(railGeo, mahoganyMat);
    railMesh.position.y = -0.34;
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    tableGroup.add(railMesh);

    // Part 4: Brushed Brass Rim Inlay Ring
    const trimGeo = new THREE.TorusGeometry(3.52, 0.055, 12, 8);
    disposables.geos.push(trimGeo);
    const trimRing = new THREE.Mesh(trimGeo, brassMat);
    trimRing.rotation.x = Math.PI / 2;
    trimRing.rotation.z = Math.PI / 8;
    trimRing.position.y = 0.09;
    tableGroup.add(trimRing);

    // Part 5: Emerald Baize Felt Playing Surface (Procedural CanvasTexture)
    const feltTex = createFeltTexture(maxAniso);
    const feltGeo = new THREE.CylinderGeometry(3.46, 3.46, 0.12, 8);
    const feltMat = new THREE.MeshStandardMaterial({
      map: feltTex,
      roughness: 0.88,
      metalness: 0.04,
    });
    disposables.texs.push(feltTex);
    disposables.geos.push(feltGeo);
    disposables.mats.push(feltMat);
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.rotation.y = Math.PI / 8;
    feltMesh.position.y = 0.02;
    feltMesh.receiveShadow = true;
    tableGroup.add(feltMesh);

    // Part 6: 6 Raycastable 3D Color Betting Tiles on Front Half of Table
    const tileMeshes: THREE.Mesh[] = [];
    const tilePositions: Record<string, [number, number]> = {};
    const tileGeo = new THREE.BoxGeometry(1.12, 0.06, 0.94);
    const tileRimGeo = new THREE.BoxGeometry(1.2, 0.04, 1.02);
    disposables.geos.push(tileGeo, tileRimGeo);

    COLOR_FACES.forEach((face, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = (col - 1) * 1.38;
      const z = 0.55 + row * 1.18;
      tilePositions[face.id] = [x, z];

      const rim = new THREE.Mesh(tileRimGeo, brassMat);
      rim.position.set(x, 0.1, z);
      rim.receiveShadow = true;
      tableGroup.add(rim);

      const tex = createTileTexture(face, maxAniso);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.42,
        metalness: 0.08,
        emissive: new THREE.Color(0x000000),
      });
      disposables.texs.push(tex);
      disposables.mats.push(mat);

      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(x, 0.12, z);
      tile.receiveShadow = true;
      tile.userData = { colorId: face.id, baseY: 0.12 };
      tile.layers.enable(1);
      tableGroup.add(tile);
      tileMeshes.push(tile);
    });

    // ==================== COMPOSITE DEALER CARD SHOE & FANNED CARDS (5+ PARTS) ====================
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(-2.0, 0.1, -1.4);
    shoeGroup.rotation.y = 0.42;
    tableGroup.add(shoeGroup);

    const shoeBodyGeo = new THREE.BoxGeometry(0.95, 0.52, 1.35);
    const shoeRollerGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.86, 16);
    const shoeDeckGeo = new THREE.BoxGeometry(0.76, 0.34, 1.08);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55, metalness: 0.02 });
    disposables.geos.push(shoeBodyGeo, shoeRollerGeo, shoeDeckGeo);
    disposables.mats.push(deckMat);

    const shoeBody = new THREE.Mesh(shoeBodyGeo, mahoganyMat);
    shoeBody.position.y = 0.26;
    shoeBody.castShadow = true;
    shoeGroup.add(shoeBody);

    const shoeRoller = new THREE.Mesh(shoeRollerGeo, brassMat);
    shoeRoller.rotation.z = Math.PI / 2;
    shoeRoller.position.set(0, 0.26, 0.68);
    shoeGroup.add(shoeRoller);

    const shoeDeck = new THREE.Mesh(shoeDeckGeo, deckMat);
    shoeDeck.position.set(0, 0.32, 0.08);
    shoeGroup.add(shoeDeck);

    // 3 Fanned 3D Playing Cards on the dealer rim
    const cardGeo = new THREE.BoxGeometry(0.68, 0.02, 0.96);
    disposables.geos.push(cardGeo);
    const fannedCards = [
      { rank: 'A', suit: '♠', red: false, x: 1.55, z: -1.45, rotY: -0.35 },
      { rank: 'K', suit: '♥', red: true, x: 1.92, z: -1.32, rotY: -0.15 },
      { rank: 'Q', suit: '♦', red: true, x: 2.26, z: -1.12, rotY: 0.08 },
    ];
    fannedCards.forEach((fc, idx) => {
      const tex = createPlayingCardTexture(fc.rank, fc.suit, fc.red, maxAniso);
      const cardMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.05 });
      disposables.texs.push(tex);
      disposables.mats.push(cardMat);
      const mesh = new THREE.Mesh(cardGeo, cardMat);
      mesh.position.set(fc.x, 0.1 + idx * 0.022, fc.z);
      mesh.rotation.y = fc.rotY;
      mesh.castShadow = true;
      tableGroup.add(mesh);
    });

    // ==================== INSTANCED 3D CASINO CHIP STACKS (InstancedMesh) ====================
    const MAX_CHIPS = 120;
    const chipGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.045, 20);
    const chipMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.45 });
    disposables.geos.push(chipGeo);
    disposables.mats.push(chipMat);
    const chipInstanced = new THREE.InstancedMesh(chipGeo, chipMat, MAX_CHIPS);
    chipInstanced.count = 0;
    chipInstanced.castShadow = !isSoftwareGl;
    chipInstanced.frustumCulled = false;
    tableGroup.add(chipInstanced);

    const chipColors = [
      new THREE.Color(0xfbbf24),
      new THREE.Color(0xef4444),
      new THREE.Color(0x38bdf8),
      new THREE.Color(0x10b981),
    ];

    const rebuildChipInstances = (nextBets: Record<string, number>) => {
      let instanceIdx = 0;
      for (const face of COLOR_FACES) {
        const amt = nextBets[face.id] || 0;
        if (amt <= 0) continue;
        const [tx, tz] = tilePositions[face.id];
        const stackCount = Math.min(14, Math.max(1, Math.ceil(amt / Math.max(1, betUnitRef.current))));
        for (let s = 0; s < stackCount && instanceIdx < MAX_CHIPS; s++) {
          _scratchPos.set(tx + (s % 2 === 0 ? 0.01 : -0.01), 0.175 + s * 0.047, tz);
          _scratchQuat.identity();
          _scratchMat4.compose(_scratchPos, _scratchQuat, _scratchScale);
          chipInstanced.setMatrixAt(instanceIdx, _scratchMat4);
          chipInstanced.setColorAt(instanceIdx, chipColors[s % chipColors.length]);
          instanceIdx++;
        }
      }
      chipInstanced.count = instanceIdx;
      chipInstanced.instanceMatrix.needsUpdate = true;
      if (chipInstanced.instanceColor) chipInstanced.instanceColor.needsUpdate = true;
      chipInstanced.computeBoundingSphere();
    };

    // ==================== 3 COMPOSITE BEVELED 3D COLOR DICE WITH PHYSICS ====================
    interface DiePhysics {
      mesh: THREE.Group;
      velY: number;
      angVel: THREE.Vector3;
      targetQuat: THREE.Quaternion;
      restX: number;
      restZ: number;
      rollingTime: number;
      isRolling: boolean;
    }

    const diceList: DiePhysics[] = [-0.95, 0, 0.95].map((xPos, idx) => {
      const dieMesh = buildCompositeDie(maxAniso, disposables);
      dieMesh.position.set(xPos, 0.42, -1.05);
      const startEuler = COLOR_FACES[idx * 2].topEuler;
      dieMesh.rotation.set(startEuler[0], startEuler[1], startEuler[2]);
      tableGroup.add(dieMesh);
      return {
        mesh: dieMesh,
        velY: 0,
        angVel: new THREE.Vector3(),
        targetQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(startEuler[0], startEuler[1], startEuler[2])),
        restX: xPos,
        restZ: -1.05,
        rollingTime: 0,
        isRolling: false,
      };
    });

    sceneActionsRef.current = {
      triggerRoll: (targetFaceIndices) => {
        diceList.forEach((d, i) => {
          const face = COLOR_FACES[targetFaceIndices[i]];
          d.isRolling = true;
          d.rollingTime = 0;
          d.mesh.position.set(d.restX, 1.9 + i * 0.25, d.restZ);
          d.velY = 3.2 + Math.random() * 1.2;
          d.angVel.set(
            8 + Math.random() * 6,
            6 + Math.random() * 5,
            7 + Math.random() * 6
          );
          _scratchEuler.set(face.topEuler[0], face.topEuler[1] + (Math.random() - 0.5) * 0.25, face.topEuler[2]);
          d.targetQuat.setFromEuler(_scratchEuler);
        });
      },
      setCameraGoal: (preset) => {
        const cfg = CAMERA_PRESETS[preset];
        _scratchTargetPos.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        _scratchTargetLook.set(cfg.target[0], cfg.target[1], cfg.target[2]);
        cameraTransitionActive = true;
      },
      rebuildChipInstances,
    };

    // ==================== HIGH-PERFORMANCE RAYCASTING ON LAYER 1 ====================
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let hoveredTile: THREE.Mesh | null = null;
    let lastHoverTime = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;

      if (phaseRef.current !== 'playing') return;
      updatePointer(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(tileMeshes, false);

      if (hoveredTile) {
        (hoveredTile.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
        hoveredTile.position.y = hoveredTile.userData.baseY;
        hoveredTile = null;
        renderer.domElement.style.cursor = 'grab';
      }

      if (hits.length > 0) {
        hoveredTile = hits[0].object as THREE.Mesh;
        (hoveredTile.material as THREE.MeshStandardMaterial).emissive.setHex(0x332200);
        hoveredTile.position.y = hoveredTile.userData.baseY + 0.03;
        renderer.domElement.style.cursor = 'pointer';
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      updatePointer(ev);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(tileMeshes, false);
      if (hits.length > 0) {
        const colorId = String(hits[0].object.userData.colorId || '');
        if (colorId) stakeColor(colorId);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // ==================== 60FPS PHYSICS & CAMERA LOOP (WITH SOFTWARE WEBGL PACING) ====================
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Gentle atmospheric orbit on Title Screen
      if (phaseRef.current === 'title') {
        const angle = now * 0.00022;
        camera.position.set(Math.sin(angle) * 7.4, 4.9, Math.cos(angle) * 7.4);
        camera.lookAt(0, 0.25, 0);
      } else {
        if (cameraTransitionActive) {
          const alpha = 1 - Math.exp(-6.5 * dt);
          camera.position.lerp(_scratchTargetPos, alpha);
          controls.target.lerp(_scratchTargetLook, alpha);
          if (camera.position.distanceTo(_scratchTargetPos) < 0.04) {
            cameraTransitionActive = false;
          }
        }
        controls.update();
      }

      // Dice physics bounce & settle
      for (const d of diceList) {
        if (!d.isRolling) continue;
        d.rollingTime += dt;

        if (d.rollingTime < 1.15) {
          d.velY -= 16.5 * dt;
          d.mesh.position.y += d.velY * dt;
          if (d.mesh.position.y < 0.42) {
            d.mesh.position.y = 0.42;
            d.velY = Math.abs(d.velY) * 0.46;
            d.angVel.multiplyScalar(0.76);
          }
          d.mesh.rotation.x += d.angVel.x * dt;
          d.mesh.rotation.y += d.angVel.y * dt;
          d.mesh.rotation.z += d.angVel.z * dt;
        } else {
          // Smoothly settle to winning color face
          const settleAlpha = 1 - Math.exp(-11 * dt);
          d.mesh.position.y = THREE.MathUtils.lerp(d.mesh.position.y, 0.42, settleAlpha);
          d.mesh.quaternion.slerp(d.targetQuat, settleAlpha);
          if (d.rollingTime > 1.55) {
            d.mesh.position.y = 0.42;
            d.mesh.quaternion.copy(d.targetQuat);
            d.isRolling = false;
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      envRT.dispose();
      disposables.geos.forEach((g) => g.dispose());
      disposables.mats.forEach((m) => m.dispose());
      disposables.texs.forEach((t) => t.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const totalStake = Object.values(bets).reduce((a, b) => a + b, 0);

  const handleSelectCamera = (preset: CameraPreset) => {
    setCameraPreset(preset);
    sceneActionsRef.current?.setCameraGoal(preset);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#031812] overflow-hidden select-none">
      {/* Isolated Full-Bleed WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* ==================== GAME SHELL TITLE SCREEN OVER LIVE 3D WORLD ==================== */}
      {phase === 'title' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-between py-12 px-4 pointer-events-none bg-gradient-to-b from-[#031812]/80 via-transparent to-[#031812]/90">
          <div className="text-center space-y-3 pointer-events-auto">
            {/* Bespoke Inline SVG Title Lockup */}
            <svg
              viewBox="0 0 460 110"
              className="w-[310px] sm:w-[440px] mx-auto drop-shadow-2xl"
              role="img"
              aria-label="Choy Card Game 3D VIP Dice Arena"
            >
              <defs>
                <linearGradient id="goldTitleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
              </defs>
              <rect x="6" y="8" width="448" height="94" rx="18" fill="#04241c" fillOpacity="0.88" stroke="#f59e0b" strokeWidth="2.5" />
              <text x="230" y="54" textAnchor="middle" fill="url(#goldTitleGrad)" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="30" letterSpacing="1.5">
                CHOY CARD GAME 3D
              </text>
              <text x="230" y="82" textAnchor="middle" fill="#a7f3d0" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="14" letterSpacing="4">
                VIP COLOR DICE · THREE.JS PBR TABLE
              </text>
            </svg>
          </div>

          <div className="flex flex-col items-center gap-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setPhase('playing');
                    sceneActionsRef.current?.setCameraGoal('table');
                  }}
                  className="rounded-2xl bg-amber-400 px-9 py-3.5 font-display text-base font-extrabold text-emerald-950 hover:bg-amber-300 shadow-2xl transition-transform active:scale-95 cursor-pointer"
                >
                  Enter 3D Table
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-2xl bg-amber-400 px-9 py-3.5 font-display text-base font-extrabold text-emerald-950 hover:bg-amber-300 shadow-2xl transition-transform active:scale-95 cursor-pointer"
                >
                  Sign In to Play 3D Table
                </button>
              )}
              <button
                type="button"
                onClick={onExit}
                className="rounded-2xl border border-emerald-600 bg-[#04241c] px-5 py-3.5 text-sm font-bold text-emerald-100 hover:border-amber-400 cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
            <p className="text-xs font-medium text-emerald-200 tracking-wide bg-[#031812]/90 border border-emerald-800/80 px-4 py-1.5 rounded-lg">
              Click 3D Color Tiles or 1–6 to Stake · Space Roll 3 Dice · Drag to Orbit · H Controls · Esc Exit
            </p>
          </div>
        </div>
      )}

      {/* ==================== MINIMAL TOP-LEFT HUD (PLAYING MODE, ZERO BLUR OVER WEBGL) ==================== */}
      {phase === 'playing' && user && (
        <>
          <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between gap-3 pointer-events-none">
            <div className="pointer-events-auto rounded-2xl border border-amber-400/40 bg-[#031812]/92 px-4 py-2.5 flex items-center gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  {user.full_name} · VIP {user.vip_level}
                </span>
                <strong className="font-mono-num text-base font-extrabold text-white">
                  ₱{liveWallet.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="h-7 w-px bg-emerald-800" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">Roll Timer</span>
                <strong
                  className={`font-mono-num text-base font-extrabold ${
                    roundCountdown <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                  }`}
                >
                  00:{String(roundCountdown).padStart(2, '0')}
                </strong>
              </div>
              <div className="h-7 w-px bg-emerald-800" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">Table Stake</span>
                <strong className="font-mono-num text-base font-extrabold text-amber-300">
                  ₱{totalStake.toLocaleString('en-PH')}
                </strong>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 pl-2">
                {rolledColors.map((c, idx) => {
                  const def = COLOR_FACES.find((f) => f.id === c) || COLOR_FACES[0];
                  return (
                    <span
                      key={idx}
                      className="h-5 w-5 rounded border border-white/60 inline-block"
                      style={{ backgroundColor: def.cssHex }}
                      title={def.label}
                    />
                  );
                })}
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              <AudioControlButton variant="compact" align="right" />
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" />
                Exit 3D
              </button>
            </div>
          </div>

          {/* Round Result Toast Banner (Non-Occluding Top Center) */}
          {roundBanner && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div
                className={`rounded-2xl border px-5 py-2.5 text-center shadow-2xl ${
                  roundBanner.won
                    ? 'border-amber-400 bg-[#052920]/95 text-amber-200'
                    : 'border-emerald-700 bg-[#031812]/95 text-emerald-100'
                }`}
              >
                <strong className="font-display text-sm font-extrabold block text-white">
                  {roundBanner.title}
                </strong>
                <span className="text-[11px] font-mono-num">{roundBanner.detail}</span>
              </div>
            </div>
          )}

          {/* ==================== COLLAPSIBLE UNIFIED BOTTOM CONTROL DOCK ==================== */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(920px,95vw)] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setDockExpanded((v) => !v)}
              className="mb-1.5 inline-flex items-center gap-1.5 rounded-xl border border-emerald-700 bg-[#031812]/94 px-3.5 py-1 text-[11px] font-bold text-emerald-200 hover:border-amber-400 cursor-pointer"
            >
              {dockExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              {dockExpanded ? 'Hide Controls (H)' : 'Show Controls (H)'}
            </button>

            {dockExpanded && (
              <div className="w-full rounded-2xl border border-amber-400/35 bg-[#031812]/94 px-3.5 py-3 shadow-2xl space-y-2.5">
                {/* Row 1: Quick Color Stake Buttons (Syncs with 3D Raycasted Tiles) */}
                <div className="grid grid-cols-6 gap-1.5">
                  {COLOR_FACES.map((face) => {
                    const staked = bets[face.id] || 0;
                    return (
                      <button
                        key={face.id}
                        type="button"
                        disabled={rolling}
                        onClick={() => stakeColor(face.id)}
                        className="rounded-xl border border-white/25 py-1.5 px-1 text-center transition-transform active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: face.cssHex,
                          color: face.textDark ? '#0f172a' : '#ffffff',
                        }}
                      >
                        <span className="font-display text-[11px] font-extrabold block leading-tight">
                          {face.label}
                        </span>
                        <span className="font-mono-num text-[10px] font-bold block">
                          {staked > 0 ? `₱${staked}` : `+₱${betUnit}`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Row 2: Chip Denomination | Camera Presets | Clear & Roll 3 Dice */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-800/80">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-300 mr-1">Chip:</span>
                    {BET_TIERS.map((t) => (
                      <button
                        key={t.bet}
                        type="button"
                        onClick={() => setBetUnit(t.bet)}
                        className={`rounded-lg px-2.5 py-1 font-mono-num text-xs font-bold cursor-pointer ${
                          betUnit === t.bet
                            ? 'bg-amber-400 text-emerald-950'
                            : 'border border-emerald-800 bg-[#052920] text-emerald-200 hover:border-amber-400'
                        }`}
                      >
                        ₱{t.bet}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    {(['table', 'closeup', 'overhead'] as CameraPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSelectCamera(preset)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize cursor-pointer ${
                          cameraPreset === preset
                            ? 'bg-emerald-400 text-emerald-950'
                            : 'border border-emerald-800 bg-[#052920] text-emerald-200 hover:border-emerald-500'
                        }`}
                      >
                        {preset === 'closeup' ? 'Close-Up' : preset}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={rolling || totalStake === 0}
                      onClick={clearBets}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-700 bg-[#052920] px-3 py-1.5 text-xs font-bold text-emerald-200 hover:border-amber-400 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Clear
                    </button>
                    <button
                      type="button"
                      disabled={rolling || totalStake === 0}
                      onClick={rollDice}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                    >
                      <Dices className="h-4 w-4" />
                      {rolling ? 'Rolling 3D Dice...' : 'Roll 3 Dice'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
