import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import { CNCOutput, MachineOperationType, OperationParams, PathSegment, StockDimensions, ToolType } from '../types';

const MIN_DEPTH = 0.05;
const CUT_PADDING = 0.12;
const SAFE_LIFT = 5;
const ARC_SEGMENT_ANGLE = Math.PI / 18;

const evaluator = new Evaluator();
evaluator.useGroups = false;
evaluator.consolidateMaterials = true;

export interface SimulationProgram {
  motionCurve: THREE.CurvePath<THREE.Vector3>;
  completionFractions: number[];
  snapshotMeshes: THREE.Mesh[];
  toolSpecs: Array<{ type: ToolType; diameter: number }>;
}

function createDisplayMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.58,
    metalness: 0.15,
    transparent: true,
    opacity: 0.94
  });
}

function createBrushMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.6,
    metalness: 0.05
  });
}

function positiveDepth(operation: OperationParams) {
  return Math.max(Math.abs(operation.z_depth), MIN_DEPTH);
}

function topAndBottomZ(operation: OperationParams) {
  const depth = positiveDepth(operation);
  return {
    top: operation.z_start + CUT_PADDING,
    bottom: operation.z_start - depth - CUT_PADDING,
    depth
  };
}

function cloneDisplayMeshFromBrush(brush: Brush | THREE.Mesh) {
  const mesh = new THREE.Mesh(brush.geometry.clone(), createDisplayMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.visible = false;
  return mesh;
}

function createCurveFromPoints(points: THREE.Vector3[]) {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start.distanceTo(end) <= 0.001) {
      continue;
    }
    curve.add(new THREE.LineCurve3(start.clone(), end.clone()));
  }
  return curve;
}

function pathLength(points: THREE.Vector3[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += points[index - 1].distanceTo(points[index]);
  }
  return length;
}

function dedupePoints(points: THREE.Vector3[]) {
  const result: THREE.Vector3[] = [];
  points.forEach((point) => {
    const last = result[result.length - 1];
    if (!last || last.distanceToSquared(point) > 1e-6) {
      result.push(point);
    }
  });
  return result;
}

function addPolylinePoints(target: THREE.Vector3[], points: THREE.Vector3[]) {
  points.forEach((point) => {
    const last = target[target.length - 1];
    if (!last || last.distanceToSquared(point) > 1e-6) {
      target.push(point.clone());
    }
  });
}

function sampleArcPoints(start: THREE.Vector2, segment: PathSegment, clockwise: boolean) {
  if (typeof segment.cx !== 'number' || typeof segment.cy !== 'number') {
    return [new THREE.Vector2(segment.x, segment.y)];
  }

  const center = new THREE.Vector2(segment.cx, segment.cy);
  const radius = center.distanceTo(start);
  if (radius <= 0.001) {
    return [new THREE.Vector2(segment.x, segment.y)];
  }

  const end = new THREE.Vector2(segment.x, segment.y);
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  let delta = endAngle - startAngle;

  if (clockwise && delta >= 0) {
    delta -= Math.PI * 2;
  } else if (!clockwise && delta <= 0) {
    delta += Math.PI * 2;
  }

  const segmentCount = Math.max(6, Math.min(48, Math.ceil(Math.abs(delta) / ARC_SEGMENT_ANGLE)));
  const points: THREE.Vector2[] = [];
  for (let index = 1; index <= segmentCount; index += 1) {
    const angle = startAngle + (delta * index) / segmentCount;
    points.push(new THREE.Vector2(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius));
  }
  return points;
}

function buildClosedPathPoints(operation: OperationParams) {
  const points: THREE.Vector2[] = [];

  if (operation.path_segments?.length) {
    const firstSegment = operation.path_segments[0];
    const start =
      operation.type === MachineOperationType.BOSS_MILLING
        ? new THREE.Vector2(firstSegment.x, firstSegment.y)
        : new THREE.Vector2(operation.x, operation.y);

    points.push(start.clone());
    let current = start.clone();
    const segments =
      operation.type === MachineOperationType.BOSS_MILLING ? operation.path_segments.slice(1) : operation.path_segments;

    segments.forEach((segment) => {
      if (segment.type === 'LINE') {
        current = new THREE.Vector2(segment.x, segment.y);
        points.push(current.clone());
      } else {
        const arcPoints = sampleArcPoints(current, segment, segment.type === 'ARC_CW');
        arcPoints.forEach((point) => points.push(point));
        current = new THREE.Vector2(segment.x, segment.y);
      }
    });
  } else if (operation.boss_shape === 'CYLINDRICAL' || (operation.diameter && !operation.length && !operation.width)) {
    const radius = Math.max((operation.diameter || operation.tool_diameter) / 2, 0.5);
    const segments = 32;
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      points.push(new THREE.Vector2(operation.x + Math.cos(angle) * radius, operation.y + Math.sin(angle) * radius));
    }
  } else if (operation.length || operation.width) {
    const halfLength = Math.max((operation.length || operation.tool_diameter) / 2, 0.5);
    const halfWidth = Math.max((operation.width || operation.tool_diameter) / 2, 0.5);
    points.push(
      new THREE.Vector2(operation.x - halfLength, operation.y - halfWidth),
      new THREE.Vector2(operation.x + halfLength, operation.y - halfWidth),
      new THREE.Vector2(operation.x + halfLength, operation.y + halfWidth),
      new THREE.Vector2(operation.x - halfLength, operation.y + halfWidth)
    );
  }

  if (points.length < 3) {
    return [];
  }

  const closedPoints = [...points];
  const first = closedPoints[0];
  const last = closedPoints[closedPoints.length - 1];
  if (first.distanceToSquared(last) > 1e-6) {
    closedPoints.push(first.clone());
  }

  return closedPoints;
}

function buildCenterlinePoints(operation: OperationParams) {
  if (operation.path_segments?.length) {
    const points: THREE.Vector2[] = [new THREE.Vector2(operation.x, operation.y)];
    let current = points[0].clone();
    operation.path_segments.forEach((segment) => {
      if (segment.type === 'LINE') {
        current = new THREE.Vector2(segment.x, segment.y);
        points.push(current.clone());
      } else {
        const arcPoints = sampleArcPoints(current, segment, segment.type === 'ARC_CW');
        arcPoints.forEach((point) => points.push(point));
        current = new THREE.Vector2(segment.x, segment.y);
      }
    });
    return points;
  }

  const halfLength = Math.max((operation.length || operation.tool_diameter) / 2, 0.5);
  const halfWidth = Math.max((operation.width || operation.tool_diameter) / 2, 0.5);
  return [
    new THREE.Vector2(operation.x - halfLength, operation.y - halfWidth),
    new THREE.Vector2(operation.x + halfLength, operation.y - halfWidth),
    new THREE.Vector2(operation.x + halfLength, operation.y + halfWidth),
    new THREE.Vector2(operation.x - halfLength, operation.y + halfWidth),
    new THREE.Vector2(operation.x - halfLength, operation.y - halfWidth)
  ];
}

function createShapeBrush(points: THREE.Vector2[], topZ: number, bottomZ: number) {
  if (points.length < 4) {
    return null;
  }

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(topZ - bottomZ, MIN_DEPTH),
    bevelEnabled: false,
    curveSegments: 24,
    steps: 1
  });
  geometry.translate(0, 0, bottomZ);

  const brush = new Brush(geometry, createBrushMaterial());
  brush.updateMatrixWorld(true);
  return brush;
}

function createBoxBrush(length: number, width: number, height: number, x: number, y: number, zCenter: number, rotationZ = 0) {
  const geometry = new THREE.BoxGeometry(Math.max(length, 0.1), Math.max(width, 0.1), Math.max(height, MIN_DEPTH));
  if (rotationZ) {
    geometry.rotateZ(rotationZ);
  }
  geometry.translate(x, y, zCenter);
  const brush = new Brush(geometry, createBrushMaterial());
  brush.updateMatrixWorld(true);
  return brush;
}

function createCylinderBrush(radius: number, height: number, x: number, y: number, zCenter: number, segments = 36) {
  const geometry = new THREE.CylinderGeometry(Math.max(radius, 0.1), Math.max(radius, 0.1), Math.max(height, MIN_DEPTH), segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(x, y, zCenter);
  const brush = new Brush(geometry, createBrushMaterial());
  brush.updateMatrixWorld(true);
  return brush;
}

function createStockGeometry(stock: StockDimensions) {
  let geometry: THREE.BufferGeometry;
  if (stock.shape === 'CYLINDRICAL') {
    const radius = Math.max(stock.diameter / 2, 5);
    geometry = new THREE.CylinderGeometry(radius, radius, Math.max(stock.height, 6), 48);
    geometry.rotateX(Math.PI / 2);
  } else {
    geometry = new THREE.BoxGeometry(
      Math.max(stock.length, 12),
      Math.max(stock.width, 12),
      Math.max(stock.height, 6)
    );
  }

  geometry.translate(0, 0, -Math.max(stock.height, 6) / 2);
  return geometry;
}

function createStockBrush(stock: StockDimensions) {
  const brush = new Brush(createStockGeometry(stock), createBrushMaterial());
  brush.updateMatrixWorld(true);
  return brush;
}

export function createStockPreviewMesh(data: CNCOutput) {
  const mesh = new THREE.Mesh(createStockGeometry(data.stock), createDisplayMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createDrillBrush(operation: OperationParams) {
  const { top, bottom, depth } = topAndBottomZ(operation);
  const radius = Math.max((operation.diameter || operation.tool_diameter) / 2, 0.5);
  const coneHeight = Math.min(radius * 2, Math.max(depth * 0.45, radius));
  const cylinderHeight = Math.max(depth + CUT_PADDING * 2 - coneHeight, MIN_DEPTH);
  const cylinderCenterZ = top - cylinderHeight / 2;
  const coneCenterZ = bottom + coneHeight / 2;

  const cylinderBrush = createCylinderBrush(radius, cylinderHeight, operation.x, operation.y, cylinderCenterZ, 36);

  const coneGeometry = new THREE.ConeGeometry(Math.max(radius, 0.1), coneHeight, 36);
  coneGeometry.rotateX(-Math.PI / 2);
  coneGeometry.translate(operation.x, operation.y, coneCenterZ);
  const coneBrush = new Brush(coneGeometry, createBrushMaterial());
  coneBrush.updateMatrixWorld(true);

  const unionBrush = evaluator.evaluate(cylinderBrush, coneBrush, ADDITION) as Brush;
  unionBrush.updateMatrixWorld(true);
  return unionBrush;
}

function createTrenchBrush(operation: OperationParams) {
  const points = buildCenterlinePoints(operation);
  if (points.length < 2) {
    return null;
  }

  const { top, bottom } = topAndBottomZ(operation);
  const height = top - bottom;
  const zCenter = (top + bottom) / 2;
  const radius = Math.max(operation.tool_diameter / 2 + CUT_PADDING * 0.5, 0.4);
  const primitives: Brush[] = [];

  points.forEach((point) => {
    primitives.push(createCylinderBrush(radius, height, point.x, point.y, zCenter, 24));
  });

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const distance = start.distanceTo(end);
    if (distance <= 0.001) {
      continue;
    }

    const center = start.clone().lerp(end, 0.5);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    primitives.push(createBoxBrush(distance, radius * 2, height, center.x, center.y, zCenter, angle));
  }

  if (primitives.length === 0) {
    return null;
  }

  let combined = primitives[0];
  for (let index = 1; index < primitives.length; index += 1) {
    combined = evaluator.evaluate(combined, primitives[index], ADDITION) as Brush;
    combined.updateMatrixWorld(true);
  }

  return combined;
}

function createPocketBrush(operation: OperationParams) {
  const { top, bottom, depth } = topAndBottomZ(operation);
  const zCenter = (top + bottom) / 2;

  if (operation.type === MachineOperationType.CIRCULAR_POCKET) {
    const radius = Math.max((operation.diameter || operation.tool_diameter) / 2, 0.5);
    return createCylinderBrush(radius, depth + CUT_PADDING * 2, operation.x, operation.y, zCenter, 48);
  }

  return createBoxBrush(
    operation.length || operation.tool_diameter,
    operation.width || operation.tool_diameter,
    depth + CUT_PADDING * 2,
    operation.x,
    operation.y,
    zCenter
  );
}

function createFaceMillBrush(operation: OperationParams, stock: StockDimensions) {
  const { top, bottom, depth } = topAndBottomZ(operation);
  const zCenter = (top + bottom) / 2;
  const length = operation.length || (stock.shape === 'CYLINDRICAL' ? stock.diameter : stock.length);
  const width = operation.width || (stock.shape === 'CYLINDRICAL' ? stock.diameter : stock.width);

  return createBoxBrush(length, width, depth + CUT_PADDING * 2, operation.x, operation.y, zCenter);
}

function createStockSliceBrush(stock: StockDimensions, topZ: number, bottomZ: number) {
  const height = Math.max(topZ - bottomZ, MIN_DEPTH);
  const zCenter = (topZ + bottomZ) / 2;

  if (stock.shape === 'CYLINDRICAL') {
    return createCylinderBrush(Math.max(stock.diameter / 2, 0.5), height, 0, 0, zCenter, 48);
  }

  return createBoxBrush(stock.length, stock.width, height, 0, 0, zCenter);
}

function createBossKeepBrush(operation: OperationParams, topZ: number, bottomZ: number) {
  const depth = Math.max(topZ - bottomZ, MIN_DEPTH);
  const zCenter = (topZ + bottomZ) / 2;

  if (operation.path_segments?.length) {
    const points = buildClosedPathPoints(operation);
    return createShapeBrush(points, topZ, bottomZ);
  }

  if (operation.boss_shape === 'CYLINDRICAL' || (operation.diameter && !operation.length && !operation.width)) {
    return createCylinderBrush(Math.max((operation.diameter || operation.tool_diameter) / 2, 0.5), depth, operation.x, operation.y, zCenter, 48);
  }

  return createBoxBrush(
    operation.length || operation.tool_diameter,
    operation.width || operation.tool_diameter,
    depth,
    operation.x,
    operation.y,
    zCenter
  );
}

function createBossRemovalBrush(operation: OperationParams, stock: StockDimensions) {
  const { top, bottom } = topAndBottomZ(operation);
  const outerSlice = createStockSliceBrush(stock, top, bottom);
  const bossKeep = createBossKeepBrush(operation, top, bottom);
  if (!bossKeep) {
    return outerSlice;
  }

  const removal = evaluator.evaluate(outerSlice, bossKeep, SUBTRACTION) as Brush;
  removal.updateMatrixWorld(true);
  return removal;
}

function createRemovalBrush(operation: OperationParams, stock: StockDimensions) {
  switch (operation.type) {
    case MachineOperationType.DRILL:
      return createDrillBrush(operation);
    case MachineOperationType.CIRCULAR_POCKET:
    case MachineOperationType.RECTANGULAR_POCKET:
      return createPocketBrush(operation);
    case MachineOperationType.FACE_MILL:
      return createFaceMillBrush(operation, stock);
    case MachineOperationType.CONTOUR:
      return createTrenchBrush(operation);
    case MachineOperationType.BOSS_MILLING:
      return createBossRemovalBrush(operation, stock);
    default:
      return null;
  }
}

function rasterPocketPoints(length: number, width: number, centerX: number, centerY: number, toolDiameter: number) {
  const halfLength = Math.max(length / 2, toolDiameter / 2);
  const halfWidth = Math.max(width / 2, toolDiameter / 2);
  const minX = centerX - Math.max(halfLength - toolDiameter / 2, 0);
  const maxX = centerX + Math.max(halfLength - toolDiameter / 2, 0);
  const minY = centerY - Math.max(halfWidth - toolDiameter / 2, 0);
  const maxY = centerY + Math.max(halfWidth - toolDiameter / 2, 0);
  const step = Math.max(toolDiameter * 0.75, 1);

  const points: THREE.Vector2[] = [];
  const rows: number[] = [];
  for (let y = minY; y <= maxY + 0.001; y += step) {
    rows.push(Math.min(y, maxY));
  }
  if (rows.length === 0) {
    rows.push(centerY);
  }
  if (rows[rows.length - 1] !== maxY) {
    rows.push(maxY);
  }

  rows.forEach((row, index) => {
    if (index % 2 === 0) {
      points.push(new THREE.Vector2(minX, row), new THREE.Vector2(maxX, row));
    } else {
      points.push(new THREE.Vector2(maxX, row), new THREE.Vector2(minX, row));
    }
  });

  return points;
}

function circlePathPoints(centerX: number, centerY: number, radius: number, segments = 28) {
  const points: THREE.Vector2[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector2(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius));
  }
  return points;
}

function buildCircularPocketPoints(operation: OperationParams) {
  const radius = Math.max((operation.diameter || operation.tool_diameter) / 2, operation.tool_diameter / 2);
  const maxCenterRadius = Math.max(radius - operation.tool_diameter / 2, 0);
  if (maxCenterRadius <= 0.2) {
    return [new THREE.Vector2(operation.x, operation.y)];
  }

  const ringStep = Math.max(operation.tool_diameter * 0.7, 1);
  const rings: number[] = [];
  for (let ring = ringStep * 0.5; ring < maxCenterRadius; ring += ringStep) {
    rings.push(Math.min(ring, maxCenterRadius));
  }
  if (rings.length === 0 || rings[rings.length - 1] !== maxCenterRadius) {
    rings.push(maxCenterRadius);
  }

  const points: THREE.Vector2[] = [new THREE.Vector2(operation.x, operation.y)];
  rings.forEach((ringRadius) => {
    const ringPoints = circlePathPoints(operation.x, operation.y, ringRadius);
    ringPoints.forEach((point) => points.push(point));
  });

  points.push(new THREE.Vector2(operation.x, operation.y));
  return points;
}

function buildOperationMotionPoints(operation: OperationParams, stock: StockDimensions) {
  const depth = positiveDepth(operation);
  const safeZ = operation.z_start + SAFE_LIFT;
  const cutZ = operation.z_start - depth;
  const center = new THREE.Vector3(operation.x, operation.y, cutZ);
  const points: THREE.Vector3[] = [
    new THREE.Vector3(operation.x, operation.y, safeZ),
    new THREE.Vector3(operation.x, operation.y, operation.z_start),
    center.clone()
  ];

  const appendBottomPath = (xyPoints: THREE.Vector2[]) => {
    xyPoints.forEach((point) => points.push(new THREE.Vector3(point.x, point.y, cutZ)));
  };

  switch (operation.type) {
    case MachineOperationType.CIRCULAR_POCKET:
      appendBottomPath(buildCircularPocketPoints(operation));
      break;
    case MachineOperationType.RECTANGULAR_POCKET:
      appendBottomPath(
        rasterPocketPoints(
          operation.length || operation.tool_diameter,
          operation.width || operation.tool_diameter,
          operation.x,
          operation.y,
          operation.tool_diameter
        )
      );
      break;
    case MachineOperationType.FACE_MILL:
      appendBottomPath(
        rasterPocketPoints(
          operation.length || (stock.shape === 'CYLINDRICAL' ? stock.diameter : stock.length),
          operation.width || (stock.shape === 'CYLINDRICAL' ? stock.diameter : stock.width),
          operation.x,
          operation.y,
          operation.tool_diameter
        )
      );
      break;
    case MachineOperationType.CONTOUR:
      appendBottomPath(buildCenterlinePoints(operation));
      break;
    case MachineOperationType.BOSS_MILLING:
      appendBottomPath(buildClosedPathPoints(operation).slice(0, -1));
      break;
    case MachineOperationType.DRILL:
    default:
      break;
  }

  const lastCutPoint = points[points.length - 1] || center;
  points.push(new THREE.Vector3(lastCutPoint.x, lastCutPoint.y, safeZ));
  return dedupePoints(points);
}

export function buildSimulationProgram(data: CNCOutput) {
  const operations = data.operations.filter(
    (operation) => operation.type !== MachineOperationType.GENERAL_CHAT && operation.type !== MachineOperationType.RUN_MYSCREEN
  );
  if (operations.length === 0) {
    return null;
  }

  const stockBrush = createStockBrush(data.stock);
  const snapshotMeshes: THREE.Mesh[] = [cloneDisplayMeshFromBrush(stockBrush)];
  snapshotMeshes[0].visible = true;

  let currentBrush = stockBrush;
  const toolSpecs = operations.map((operation) => ({
    type: operation.tool_type,
    diameter: Math.max(operation.tool_diameter, operation.diameter || 0, 1)
  }));

  operations.forEach((operation) => {
    const removalBrush = createRemovalBrush(operation, data.stock);
    if (removalBrush) {
      currentBrush = evaluator.evaluate(currentBrush, removalBrush, SUBTRACTION) as Brush;
      currentBrush.updateMatrixWorld(true);
      currentBrush.geometry.computeVertexNormals();
    }

    snapshotMeshes.push(cloneDisplayMeshFromBrush(currentBrush));
  });

  const mergedPoints: THREE.Vector3[] = [];
  const pathLengths: number[] = [];

  operations.forEach((operation) => {
    const operationPoints = buildOperationMotionPoints(operation, data.stock);
    if (operationPoints.length === 0) {
      pathLengths.push(0);
      return;
    }

    const runPoints =
      mergedPoints.length > 0 && mergedPoints[mergedPoints.length - 1].distanceToSquared(operationPoints[0]) > 1e-6
        ? [mergedPoints[mergedPoints.length - 1].clone(), ...operationPoints]
        : operationPoints;

    pathLengths.push(pathLength(runPoints));
    addPolylinePoints(mergedPoints, runPoints);
  });

  const motionCurve = createCurveFromPoints(mergedPoints);
  const totalLength = pathLengths.reduce((sum, length) => sum + length, 0);
  let cumulative = 0;
  const completionFractions = pathLengths.map((length) => {
    cumulative += length;
    return totalLength > 0 ? cumulative / totalLength : 1;
  });

  return {
    motionCurve,
    completionFractions,
    snapshotMeshes,
    toolSpecs
  };
}
