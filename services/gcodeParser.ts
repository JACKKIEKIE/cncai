import * as THREE from 'three';

/**
 * Parses simple G-code to extract a path for visualization.
 * Handles G0, G1, G2, G3 (approximated as lines for simplicity in this demo),
 * and absolute coordinates (G90).
 */
export const parseGCodeToPath = (gcode: string): THREE.CurvePath<THREE.Vector3> => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    let current = new THREE.Vector3(0, 0, 50); // Start at safe Z
    
    // Simple state
    let isAbs = true; // G90 default

    const lines = gcode.split('\n');

    lines.forEach(line => {
        // Remove comments
        const l = line.split(';')[0].trim().toUpperCase();
        if (l.length === 0) return;

        // Mode Check
        if (l.includes('G90')) isAbs = true;
        if (l.includes('G91')) isAbs = false; // Not fully supported logic below, assuming G90 mostly

        // Motion Commands
        // We look for G0, G1, X, Y, Z keys
        // If line has X/Y/Z but no G code, assume modal (previous) G code, default to G1 if not tracked.
        // For robustness in this simple parser, we treat any line with coordinates as a move.
        
        const hasCoords = l.includes('X') || l.includes('Y') || l.includes('Z');
        
        if (hasCoords || l.includes('G0') || l.includes('G1') || l.includes('G2') || l.includes('G3')) {
            const nextPos = current.clone();
            
            const xMatch = l.match(/X([-\d.]+)/);
            const yMatch = l.match(/Y([-\d.]+)/);
            const zMatch = l.match(/Z([-\d.]+)/);

            if (xMatch) nextPos.x = parseFloat(xMatch[1]);
            if (yMatch) nextPos.y = parseFloat(yMatch[1]);
            if (zMatch) nextPos.z = parseFloat(zMatch[1]);

            // Add Line
            // Avoid zero-length segments which might cause THREE warnings
            if (nextPos.distanceTo(current) > 0.001) {
                path.add(new THREE.LineCurve3(current.clone(), nextPos.clone()));
                current.copy(nextPos);
            }
        }
    });

    return path;
};
