import { useFrame, useLoader } from "@react-three/fiber";
import React, { useRef } from "react";
import { TextureLoader } from "three";

const Planet = ({
  name,
  radius,
  distance,
  speed,
  elapsed,
  isPaused,
  onSelect,
}) => {
  const texture = useLoader(
    TextureLoader,
    `/textures/${name.toLowerCase()}.jpg`
  );

  const meshRef = useRef();

  useFrame((state, delta) => {
    if (isPaused) return;

    meshRef.current.rotation.y += delta * 0.8;

    const angle = elapsed * speed;
    meshRef.current.position.x = Math.cos(angle) * distance;
    meshRef.current.position.z = Math.sin(angle) * distance;
  });

  return (
    <mesh
      onClick={() => onSelect(name)}
      ref={meshRef}
      position={[distance, 0, 0]}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

export default Planet;
