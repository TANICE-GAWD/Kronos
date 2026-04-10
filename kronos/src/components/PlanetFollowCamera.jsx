import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const PlanetFollowCamera = ({ followedPlanet, planetPositionsRef }) => {
  const { camera } = useThree();
  const followedPlanetRef = useRef(null);

  // Update the ref whenever the prop changes
  useEffect(() => {
    followedPlanetRef.current = followedPlanet;
  }, [followedPlanet]);

  useFrame(() => {
    const planet = followedPlanetRef.current;
    if (!planet || !planetPositionsRef.current[planet]) {
      return;
    }

    const planetPos = planetPositionsRef.current[planet];

    // Calculate new camera position based on planet position
    const r = planetPos.radius || 10;
    const offsetX = 0;
    const offsetY = r < 100 ? 150 : r * 1.5;
    const offsetZ = r < 100 ? 200 : r * 2.5;

    const cameraX = planetPos.x + offsetX;
    const cameraY = planetPos.y + offsetY;
    const cameraZ = planetPos.z + offsetZ;

    // Smoothly move camera
    camera.position.lerp(
      new THREE.Vector3(cameraX, cameraY, cameraZ),
      0.08
    );

    // Look at the planet
    camera.lookAt(planetPos.x, planetPos.y, planetPos.z);
  });

  return null;
};

export default PlanetFollowCamera;
