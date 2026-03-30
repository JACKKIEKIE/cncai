import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

import { buildSimulationProgram, createStockPreviewMesh } from '../lib/simulationProgram';
import { requestCloudSimulation } from '../services/cloudSimulationService';
import { CNCOutput, MachineOperationType, SimulationMode, ToolType } from '../types';

interface SimulationPanelProps {
  data: CNCOutput | null;
  customPath?: THREE.CurvePath<THREE.Vector3> | null;
}

const HMISimulator: React.FC<{ data: CNCOutput | null }> = ({ data }) => {
  const screenData = useMemo(() => {
    const fallback = {
      header: '手动模式',
      fields: [] as Array<{ label: string; value: string; unit?: string }>,
      softKeys: ['机床', '参数', '程序', '程序管理', '诊断', '启动', '', '']
    };

    if (!data) {
      return fallback;
    }

    if (data.isScreen && data.gcode) {
      const code = data.gcode;
      const title = code.match(/HD\s*=\s*"([^"]+)"/)?.[1] || 'Run MyScreen';
      const fields = Array.from(code.matchAll(/DEF\s+(\w+)\s*=\s*\{([^}]+)\}/g)).map((match) => {
        const rawProps = match[2];
        const getText = (key: string) => rawProps.match(new RegExp(`${key}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] || '';
        const getNumber = (key: string) => rawProps.match(new RegExp(`${key}\\s*=\\s*([\\d\\.]+)`, 'i'))?.[1] || '';

        return {
          label: getText('LT') || match[1],
          value: getText('VAL') || getNumber('VAL') || '0',
          unit: getText('ST')
        };
      });

      return {
        header: title,
        fields,
        softKeys: fallback.softKeys
      };
    }

    const lastOperation = data.operations[data.operations.length - 1];
    if (!lastOperation) {
      return fallback;
    }

    return {
      header: `Auto Run - ${lastOperation.type}`,
      fields: [
        { label: 'Tool', value: lastOperation.tool_type, unit: `D${lastOperation.tool_diameter}` },
        { label: 'Feed', value: String(lastOperation.feed_rate), unit: 'mm/min' },
        { label: 'Spindle', value: String(lastOperation.spindle_speed), unit: 'rpm' },
        { label: 'X', value: lastOperation.x.toFixed(3), unit: 'mm' },
        { label: 'Y', value: lastOperation.y.toFixed(3), unit: 'mm' },
        { label: 'Z', value: lastOperation.z_start.toFixed(3), unit: 'mm' },
        { label: 'Ops', value: String(data.operations.length), unit: 'steps' }
      ],
      softKeys: ['Program', 'Search', 'Single', 'Sim', 'Adjust', 'Reset', '', 'Exit']
    };
  }, [data]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border-[12px] border-[#30343b] bg-[#d1d7df] shadow-inner">
      <div className="flex h-9 items-center justify-between border-b border-orange-700 bg-gradient-to-r from-orange-400 to-orange-500 px-4 text-white">
        <span className="text-xs font-bold tracking-[0.18em]">LINGUA HMI</span>
        <span className="text-sm font-semibold">{screenData.header}</span>
        <span className="rounded bg-black/20 px-2 py-0.5 text-[10px]">CH1</span>
      </div>

      <div className="flex h-[calc(100%-36px)] min-h-0">
        <div className="flex min-h-0 flex-1 flex-col border-r border-slate-400 bg-[#eef2f6]">
          <div className="flex h-7 items-center gap-3 border-b border-white bg-[#e2e8f0] px-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1">
              <i className="fa-solid fa-circle-check text-green-600" />
              READY
            </span>
            <span className="ml-auto">G54</span>
          </div>

          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
            {screenData.fields.length > 0 ? (
              screenData.fields.map((field) => (
                <div key={`${field.label}-${field.value}`} className="grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-2">
                  <div className="truncate text-right text-[11px] font-medium text-slate-700">{field.label}</div>
                  <div className="truncate rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-900 shadow-inner">
                    {field.value}
                  </div>
                  <div className="truncate text-[10px] text-slate-500">{field.unit || ''}</div>
                </div>
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                <i className="fa-regular fa-window-maximize text-5xl" />
                <span className="text-sm">暂无参数画面</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-[84px] flex-col gap-[2px] bg-[#c7cdd6] p-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <button
              key={index}
              type="button"
              className="flex-1 rounded border border-slate-400 bg-gradient-to-b from-[#f4f6f8] to-[#d7dce3] px-1 text-[10px] font-semibold text-slate-700 shadow-sm"
            >
              {screenData.softKeys[index] || ''}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

function buildToolMesh(toolType: ToolType, toolDiameter: number) {
  const group = new THREE.Group();
  const cutterRadius = Math.max(toolDiameter / 2, 1);
  const cutterLength = 20;
  const holderMaterial = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.3 });
  const cutterMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.85 });

  const holder = new THREE.Mesh(new THREE.CylinderGeometry(8, 11, 16, 24), holderMaterial);
  holder.rotation.x = Math.PI / 2;
  holder.position.z = cutterLength + 8;
  group.add(holder);

  if (toolType === ToolType.BALL_MILL) {
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(cutterRadius, cutterRadius, cutterLength - cutterRadius, 24), cutterMaterial);
    shank.rotation.x = Math.PI / 2;
    shank.position.z = cutterRadius + (cutterLength - cutterRadius) / 2;
    group.add(shank);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(cutterRadius, 24, 16), cutterMaterial);
    ball.position.z = cutterRadius;
    group.add(ball);
  } else if (toolType === ToolType.DRILL) {
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(cutterRadius, cutterRadius, cutterLength - cutterRadius * 2, 24), cutterMaterial);
    shank.rotation.x = Math.PI / 2;
    shank.position.z = cutterRadius * 2 + (cutterLength - cutterRadius * 2) / 2;
    group.add(shank);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(cutterRadius, cutterRadius * 2, 24), cutterMaterial);
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = cutterRadius;
    group.add(tip);
  } else {
    const cutter = new THREE.Mesh(new THREE.CylinderGeometry(cutterRadius, cutterRadius, cutterLength, 24), cutterMaterial);
    cutter.rotation.x = Math.PI / 2;
    cutter.position.z = cutterLength / 2;
    group.add(cutter);
  }

  return group;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({ data, customPath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationRef = useRef<number | null>(null);
  const toolRef = useRef<THREE.Group | null>(null);
  const pathLineRef = useRef<THREE.Line | null>(null);
  const stockMeshRef = useRef<THREE.Mesh | null>(null);
  const stockSnapshotsRef = useRef<THREE.Mesh[]>([]);
  const completionFractionsRef = useRef<number[]>([]);
  const toolSpecsRef = useRef<Array<{ type: ToolType; diameter: number }>>([]);
  const activeSnapshotIndexRef = useRef(0);
  const activeToolIndexRef = useRef(0);

  const [viewMode, setViewMode] = useState<'3d' | 'hmi'>('3d');
  const [simMode, setSimMode] = useState<SimulationMode>('LOCAL');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');

  const animationStateRef = useRef({
    curve: null as THREE.CurvePath<THREE.Vector3> | null,
    progress: 0,
    speed: 0.005,
    playing: true
  });

  function disposeMaterial(material: THREE.Material | THREE.Material[]) {
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
      return;
    }
    material.dispose();
  }

  function disposeMesh(mesh: THREE.Mesh) {
    mesh.geometry.dispose();
    disposeMaterial(mesh.material);
  }

  function disposeTool(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        disposeMaterial(child.material);
      }
    });
  }

  function setActiveSnapshot(index: number) {
    stockSnapshotsRef.current.forEach((mesh, meshIndex) => {
      mesh.visible = meshIndex === index;
    });
    activeSnapshotIndexRef.current = index;
    stockMeshRef.current = stockSnapshotsRef.current[index] || null;
  }

  function setToolForIndex(index: number, point?: THREE.Vector3 | null) {
    const nextSpec = toolSpecsRef.current[index];
    if (!sceneRef.current || !nextSpec) {
      return;
    }

    if (toolRef.current) {
      sceneRef.current.remove(toolRef.current);
      disposeTool(toolRef.current);
      toolRef.current = null;
    }

    const tool = buildToolMesh(nextSpec.type, nextSpec.diameter);
    if (point) {
      tool.position.copy(point);
    }
    sceneRef.current.add(tool);
    toolRef.current = tool;
    activeToolIndexRef.current = index;
  }

  useEffect(() => {
    if (data?.isScreen) {
      setViewMode('hmi');
    }
  }, [data?.isScreen]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fbff);
    scene.fog = new THREE.Fog(0xf8fbff, 120, 400);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 2000);
    camera.position.set(110, -130, 90);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, -10);
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.05);
    directionalLight.position.set(80, -60, 140);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    const grid = new THREE.GridHelper(240, 24, 0x94a3b8, 0xcbd5e1);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -40;
    scene.add(grid);

    const axes = new THREE.AxesHelper(26);
    axes.position.set(-65, -65, -5);
    scene.add(axes);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !cameraRef.current || !rendererRef.current) {
        return;
      }

      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) {
        return;
      }

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    });
    resizeObserver.observe(container);

    const tick = () => {
      animationRef.current = window.requestAnimationFrame(tick);
      controls.update();

      const animation = animationStateRef.current;
      if (toolRef.current && animation.curve && animation.playing) {
        animation.progress = Math.min(animation.progress + animation.speed, 1);
        const point = animation.curve.getPoint(animation.progress);
        if (point) {
          toolRef.current.position.copy(point);
          toolRef.current.rotation.z += 0.18;
        }

        let nextSnapshotIndex = 0;
        while (
          nextSnapshotIndex < completionFractionsRef.current.length &&
          animation.progress >= completionFractionsRef.current[nextSnapshotIndex] - 1e-4
        ) {
          nextSnapshotIndex += 1;
        }

        if (nextSnapshotIndex !== activeSnapshotIndexRef.current) {
          setActiveSnapshot(nextSnapshotIndex);
        }

        const nextToolIndex = Math.min(nextSnapshotIndex, Math.max(toolSpecsRef.current.length - 1, 0));
        if (toolSpecsRef.current.length > 0 && nextToolIndex !== activeToolIndexRef.current) {
          setToolForIndex(nextToolIndex, point);
        }

        if (animation.progress >= 1) {
          if (stockSnapshotsRef.current.length > 0) {
            setActiveSnapshot(stockSnapshotsRef.current.length - 1);
          }
          animation.playing = false;
          setIsPlaying(false);
        }
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      resizeObserver.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stockSnapshotsRef.current.forEach((mesh) => disposeMesh(mesh));
      stockSnapshotsRef.current = [];
      if (toolRef.current) {
        disposeTool(toolRef.current);
      }
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) {
      return;
    }

    const scene = sceneRef.current;

    stockSnapshotsRef.current.forEach((mesh) => {
      scene.remove(mesh);
      disposeMesh(mesh);
    });
    stockSnapshotsRef.current = [];
    stockMeshRef.current = null;

    if (pathLineRef.current) {
      scene.remove(pathLineRef.current);
      pathLineRef.current.geometry.dispose();
      disposeMaterial(pathLineRef.current.material);
      pathLineRef.current = null;
    }

    if (toolRef.current) {
      scene.remove(toolRef.current);
      disposeTool(toolRef.current);
      toolRef.current = null;
    }

    animationStateRef.current = {
      curve: null,
      progress: 0,
      speed: 0.005,
      playing: true
    };
    completionFractionsRef.current = [];
    toolSpecsRef.current = [];
    activeSnapshotIndexRef.current = 0;
    activeToolIndexRef.current = 0;
    setIsPlaying(true);

    if (!data) {
      return;
    }

    const hasMachiningOperations = data.operations.some(
      (operation) => operation.type !== MachineOperationType.GENERAL_CHAT && operation.type !== MachineOperationType.RUN_MYSCREEN
    );

    if (!hasMachiningOperations && (!customPath || customPath.curves.length === 0)) {
      return;
    }

    let active = true;

    const renderSimulation = async () => {
      if (simMode === 'CLOUD') {
        setIsCloudLoading(true);
        setCloudStatus('Connecting to cloud simulation...');
        await new Promise((resolve) => setTimeout(resolve, 500));
        setCloudStatus('Uploading geometry...');
        await new Promise((resolve) => setTimeout(resolve, 500));
        const result = await requestCloudSimulation(data);
        if (!active) {
          return;
        }
        setCloudStatus(`Running on ${result.provider}...`);
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (!active) {
          return;
        }
        setCloudStatus('Downloading simulation result...');
      }

      try {
        if (hasMachiningOperations) {
          const program = buildSimulationProgram(data);
          if (program) {
            stockSnapshotsRef.current = program.snapshotMeshes;
            stockSnapshotsRef.current.forEach((mesh, index) => {
              mesh.visible = index === 0;
              scene.add(mesh);
            });
            stockMeshRef.current = stockSnapshotsRef.current[0] || null;
            completionFractionsRef.current = program.completionFractions;
            toolSpecsRef.current = program.toolSpecs;

            const curve = customPath && customPath.curves.length > 0 ? customPath : program.motionCurve;
            animationStateRef.current.curve = curve;
            animationStateRef.current.progress = 0;
            animationStateRef.current.playing = true;

            if (curve.curves.length > 0) {
              const points = curve.getPoints(Math.max(240, curve.curves.length * 14));
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const material = new THREE.LineBasicMaterial({ color: 0x0284c7 });
              const line = new THREE.Line(geometry, material);
              scene.add(line);
              pathLineRef.current = line;

              const startPoint = curve.getPoint(0);
              if (startPoint && toolSpecsRef.current.length > 0) {
                setToolForIndex(0, startPoint);
              }
            }
          }
        } else {
          const previewMesh = createStockPreviewMesh(data);
          previewMesh.visible = true;
          scene.add(previewMesh);
          stockSnapshotsRef.current = [previewMesh];
          stockMeshRef.current = previewMesh;

          if (customPath && customPath.curves.length > 0) {
            animationStateRef.current.curve = customPath;
            animationStateRef.current.progress = 0;
            animationStateRef.current.playing = true;

            const points = customPath.getPoints(Math.max(240, customPath.curves.length * 14));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: 0x0284c7 });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            pathLineRef.current = line;
          }
        }
      } catch (error) {
        console.error('Simulation fallback triggered:', error);

        const previewMesh = createStockPreviewMesh(data);
        previewMesh.visible = true;
        scene.add(previewMesh);
        stockSnapshotsRef.current = [previewMesh];
        stockMeshRef.current = previewMesh;

        if (customPath && customPath.curves.length > 0) {
          animationStateRef.current.curve = customPath;
          animationStateRef.current.progress = 0;
          animationStateRef.current.playing = true;

          const points = customPath.getPoints(Math.max(240, customPath.curves.length * 14));
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({ color: 0x0284c7 });
          const line = new THREE.Line(geometry, material);
          scene.add(line);
          pathLineRef.current = line;
        }
      }

      if (cameraRef.current && controlsRef.current) {
        const maxDim = Math.max(data.stock.length || 0, data.stock.width || 0, data.stock.height || 0, data.stock.diameter || 0, 80);
        cameraRef.current.position.set(maxDim * 1.2, -maxDim * 1.25, maxDim * 0.95);
        controlsRef.current.target.set(0, 0, -data.stock.height / 2);
      }

      setIsCloudLoading(false);
    };

    void renderSimulation();

    return () => {
      active = false;
      setIsCloudLoading(false);
    };
  }, [data, customPath, simMode]);

  function handleRestart() {
    if (!animationStateRef.current.curve) {
      return;
    }

    animationStateRef.current.progress = 0;
    animationStateRef.current.playing = true;
    if (stockSnapshotsRef.current.length > 0) {
      setActiveSnapshot(0);
    }
    if (toolSpecsRef.current.length > 0) {
      setToolForIndex(0, animationStateRef.current.curve.getPoint(0));
    }
    setIsPlaying(true);
  }

  function handleTogglePlay() {
    if (!animationStateRef.current.curve) {
      return;
    }

    animationStateRef.current.playing = !animationStateRef.current.playing;
    setIsPlaying(animationStateRef.current.playing);
  }

  function handleExportSTL() {
    if (!stockMeshRef.current) {
      return;
    }

    const exporter = new STLExporter();
    const result = exporter.parse(stockMeshRef.current, { binary: true });
    const binaryPart =
      result instanceof DataView
        ? (result.buffer as ArrayBuffer).slice(result.byteOffset, result.byteOffset + result.byteLength)
        : result;
    const blob = new Blob([binaryPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'linguacnc-stock-preview.stl';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="glass-panel relative h-full w-full overflow-hidden rounded-[2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.93))] shadow-[0_16px_36px_-20px_rgba(31,38,135,0.1)] backdrop-blur-[48px] transition-all duration-300">
      {isCloudLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(255,255,255,0.94))] text-slate-700 backdrop-blur-[48px] animate-fade-in">
          <div className="relative mb-6">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500 shadow-sm" />
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fa-solid fa-cloud text-2xl text-blue-500 drop-shadow-sm" />
            </div>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-slate-800">{cloudStatus}</h3>
          <p className="mt-2 rounded-full border border-white/85 bg-white/88 px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
            云端预览演示中
          </p>
        </div>
      )}

      {/*
      {viewMode === '3d' && data && (
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-col gap-2 sm:left-6 sm:right-auto sm:top-6 sm:gap-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-3 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px] sm:gap-4 sm:px-4">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-800">
              <i className="fa-solid fa-cubes text-blue-500" />
              3D 仿真
            </h3>
            {customPath && (
              <span className="rounded-md border border-yellow-200/50 bg-yellow-100/80 px-2 py-0.5 text-[10px] font-bold text-yellow-700 shadow-sm">
                路径已编辑
              </span>
            )}
            <div className="h-4 w-px bg-slate-300/50" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!data}
                title={isPlaying ? '暂停' : '继续'}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent shadow-sm transition-all ${
                  !data
                    ? 'opacity-20'
                    : isPlaying
                      ? 'bg-orange-50/80 text-orange-600 hover:border-orange-200/50 hover:bg-orange-100'
                      : 'bg-green-50/80 text-green-600 hover:border-green-200/50 hover:bg-green-100'
                }`}
              >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`} />
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={!data}
                title="重新播放"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent bg-blue-50/80 text-blue-600 shadow-sm transition-all hover:border-blue-200/50 hover:bg-blue-100 ${
                  !data ? 'opacity-20' : ''
                }`}
              >
                <i className="fa-solid fa-rotate-left text-xs" />
              </button>
            </div>
            <div className="h-4 w-px bg-slate-300/50" />
            <button
              type="button"
              onClick={handleExportSTL}
              title="导出毛坯模型 (STL)"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent bg-slate-50/80 text-slate-600 shadow-sm transition-all hover:border-blue-200/50 hover:bg-blue-50 hover:text-blue-600"
            >
              <i className="fa-solid fa-download text-xs" />
            </button>
          </div>

          <div className="pointer-events-auto flex w-full gap-1 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-1.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px] sm:w-auto">
            <button
              type="button"
              onClick={() => setSimMode('LOCAL')}
              className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                simMode === 'LOCAL' ? 'border border-slate-200 bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-laptop mr-2" />
              本地
            </button>
            <button
              type="button"
              onClick={() => setSimMode('CLOUD')}
              className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                simMode === 'CLOUD'
                  ? 'border border-blue-400/50 bg-[#0a84ff] text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-cloud mr-2" />
              云端
              <span className="ml-2 rounded-md border border-white/10 bg-white/20 px-1.5 py-0.5 text-[9px]">BETA</span>
            </button>
          </div>
        </div>
      )}
      */}

      {viewMode === '3d' && data && (
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-col gap-2 sm:left-6 sm:right-auto sm:top-6 sm:gap-3">
          <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-2.5 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px] sm:hidden">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!data}
                title={isPlaying ? '暂停' : '继续'}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent shadow-sm transition-all ${
                  !data ? 'opacity-20' : isPlaying ? 'bg-orange-50/80 text-orange-600' : 'bg-green-50/80 text-green-600'
                }`}
              >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`} />
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={!data}
                title="重新播放"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent bg-blue-50/80 text-blue-600 shadow-sm transition-all ${
                  !data ? 'opacity-20' : ''
                }`}
              >
                <i className="fa-solid fa-rotate-left text-xs" />
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100/85 p-1">
              <button
                type="button"
                onClick={() => setSimMode('LOCAL')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  simMode === 'LOCAL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                本地
              </button>
              <button
                type="button"
                onClick={() => setSimMode('CLOUD')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  simMode === 'CLOUD' ? 'bg-[#0a84ff] text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                云端
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportSTL}
              title="导出 STL"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent bg-slate-50/80 text-slate-600 shadow-sm transition-all"
            >
              <i className="fa-solid fa-download text-xs" />
            </button>
          </div>

          <div className="pointer-events-auto hidden flex-wrap items-center gap-3 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] px-3 py-2 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px] sm:flex sm:gap-4 sm:px-4">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-800">
              <i className="fa-solid fa-cubes text-blue-500" />
              3D 仿真
            </h3>
            {customPath && (
              <span className="rounded-md border border-yellow-200/50 bg-yellow-100/80 px-2 py-0.5 text-[10px] font-bold text-yellow-700 shadow-sm">
                路径已编辑
              </span>
            )}
            <div className="h-4 w-px bg-slate-300/50" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!data}
                title={isPlaying ? '暂停' : '继续'}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent shadow-sm transition-all ${
                  !data
                    ? 'opacity-20'
                    : isPlaying
                      ? 'bg-orange-50/80 text-orange-600 hover:border-orange-200/50 hover:bg-orange-100'
                      : 'bg-green-50/80 text-green-600 hover:border-green-200/50 hover:bg-green-100'
                }`}
              >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs`} />
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={!data}
                title="重新播放"
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-transparent bg-blue-50/80 text-blue-600 shadow-sm transition-all hover:border-blue-200/50 hover:bg-blue-100 ${
                  !data ? 'opacity-20' : ''
                }`}
              >
                <i className="fa-solid fa-rotate-left text-xs" />
              </button>
            </div>
            <div className="h-4 w-px bg-slate-300/50" />
            <button
              type="button"
              onClick={handleExportSTL}
              title="导出毛坯模型 (STL)"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent bg-slate-50/80 text-slate-600 shadow-sm transition-all hover:border-blue-200/50 hover:bg-blue-50 hover:text-blue-600"
            >
              <i className="fa-solid fa-download text-xs" />
            </button>
          </div>

          <div className="pointer-events-auto hidden w-full gap-1 rounded-2xl border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-1.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px] sm:flex sm:w-auto">
            <button
              type="button"
              onClick={() => setSimMode('LOCAL')}
              className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                simMode === 'LOCAL' ? 'border border-slate-200 bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-laptop mr-2" />
              本地
            </button>
            <button
              type="button"
              onClick={() => setSimMode('CLOUD')}
              className={`flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                simMode === 'CLOUD'
                  ? 'border border-blue-400/50 bg-[#0a84ff] text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-800'
              }`}
            >
              <i className="fa-solid fa-cloud mr-2" />
              云端
              <span className="ml-2 rounded-md border border-white/10 bg-white/20 px-1.5 py-0.5 text-[9px]">BETA</span>
            </button>
          </div>
        </div>
      )}

      {data && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:translate-x-0">
          <div className="flex gap-1 rounded-[1.2rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-1 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[44px] sm:rounded-2xl sm:p-1.5">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 rounded-[0.95rem] px-3 py-1.5 text-[11px] font-bold transition-all sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-xs ${
                viewMode === '3d' ? 'border border-blue-400/50 bg-[#0a84ff] text-white shadow-md shadow-blue-500/20' : 'text-slate-700 hover:bg-slate-100/90'
              }`}
            >
              <i className="fa-solid fa-cube" />
              3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hmi')}
              className={`flex items-center gap-1.5 rounded-[0.95rem] px-3 py-1.5 text-[11px] font-bold transition-all sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-xs ${
                viewMode === 'hmi' ? 'border border-orange-400/50 bg-[#ff9f0a] text-white shadow-md shadow-orange-500/20' : 'text-slate-700 hover:bg-slate-100/90'
              }`}
            >
              <i className="fa-solid fa-desktop" />
              HMI
            </button>
          </div>
        </div>
      )}

      <div className="relative h-full w-full overflow-hidden">
        <div
          ref={containerRef}
          className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${viewMode === '3d' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        />

        <div className={`absolute inset-0 flex items-center justify-center px-4 pb-20 pt-20 transition-opacity duration-300 lg:px-12 ${viewMode === 'hmi' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className="h-full max-h-[600px] w-full max-w-4xl shadow-2xl">
            <HMISimulator data={data} />
          </div>
        </div>

        {!data && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.92))] px-4 text-center text-slate-500 backdrop-blur-[40px]">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/85 bg-white/96 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[24px]">
              <i className="fa-solid fa-cube text-5xl opacity-50 drop-shadow-sm" />
            </div>
            <span className="rounded-full border border-white/85 bg-white/95 px-4 py-1.5 text-sm font-semibold tracking-wide text-slate-600 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.12)] backdrop-blur-[24px]">
              等待生成加工数据
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationPanel;
