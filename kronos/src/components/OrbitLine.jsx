import React, { useMemo } from "react";
import * as THREE from "three";

const OrbitLine = ({ distance, color = 0x888888, opacity = 0.6 }) => {
  const geometry = useMemo(() => {
    const points = [];
    const segments = 256;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = distance * Math.cos(angle);
      const z = distance * Math.sin(angle);
      points.push(new THREE.Vector3(x, 0, z));
    }
    
    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setFromPoints(points);
    return bufferGeometry;
  }, [distance]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
    </line>
  );
};

export default OrbitLine;
