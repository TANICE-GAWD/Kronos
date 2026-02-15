import { useFrame, useLoader } from "@react-three/fiber";
import React, { useRef } from "react";
import { TextureLoader } from "three";

const SaturnGroup = ({ onSelect, elapsed, isPaused }) => {
  const saturnTexture = useLoader(TextureLoader, "/textures/saturn.jpg");
  const ringTexture = useLoader(TextureLoader, "/textures/saturn_ring.png");

  const groupRef = useRef();

  useFrame((state, delta) => {
    if (isPaused) return;

    const angle = elapsed * 0.3; // Adjust speed as needed
    groupRef.current.position.x = Math.cos(angle) * 16; // Distance from the sun
    groupRef.current.position.z = Math.sin(angle) * 16;
    groupRef.current.rotation.y += delta * 0.8; // Saturn's own rotation
  });

  return (
    <group ref={groupRef}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect("Saturn");
        }}
      >
        <sphereGeometry args={[1.0, 32, 32]} />
        <meshStandardMaterial map={saturnTexture} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 2.0, 64]} />
        <meshStandardMaterial map={ringTexture} side={2} transparent={true} />
      </mesh>
    </group>
  );
};

export default SaturnGroup;
