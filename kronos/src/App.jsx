import { useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import Sun from "./components/Sun";
import Planet from "./components/Planet";
import BlackHole from "./components/BlackHole";
import OrbitLine from "./components/OrbitLine";
import StarCreditManager from "./components/StarCreditManager";
import FollowPlanetTab from "./components/FollowPlanetTab";
import PlanetFollowCamera from "./components/PlanetFollowCamera";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function App(){
  const [creditsInFlight, setCreditsInFlight] = useState(0);
  const [followedPlanet, setFollowedPlanet] = useState(null);
  const planetPositionsRef = useRef({});

  

  const planets = [
    { name: "BlackHole", radius: 100, distance: 4000, speed: 0 },
    { name: "Mercury", radius: 2.5, distance: 39, speed: 0.82 },
    { name: "Venus", radius: 4.5, distance: 72, speed: 0.32 },
    { name: "Earth", radius: 5, distance: 100, speed: 0.20 },
    { name: "Jupiter", radius: 12, distance: 520, speed: 0.017 },
    { name: "Mars", radius: 3.5, distance: 152, speed: 0.11 },
    { name: "Saturn", radius: 10, distance: 954, speed: 0.0067 },
    { name: "Uranus", radius: 7, distance: 1919, speed: 0.0024 },
    { name: "Neptune", radius: 7, distance: 3007, speed: 0.0012 },
  ];

  const handleCanvasCreated = ({ camera }) => {
    camera.far = 100000;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
  };

  const handlePlanetPositionUpdate = (planetName, position, radius = 50) => {
    planetPositionsRef.current[planetName] = {
      x: position.x,
      y: position.y,
      z: position.z,
      radius: radius,
    };
  };

  return(
    <>
      <Canvas camera={{ position: [0, 500, 1500], fov: 45 }} onCreated={handleCanvasCreated}>

      <ambientLight intensity={3}/>
      <directionalLight position={[5, 5, 5]} intensity={1.5} />

      <Sun/>

        {planets.filter(p => p.name !== "BlackHole").map((planet) => (
        <OrbitLine key={`orbit-${planet.name}`} distance={planet.distance} />
      ))}

      {planets.filter(p => p.name !== "BlackHole").map((planet) => (
        <Planet 
          key={planet.name} 
          {...planet} 
          onPositionUpdate={handlePlanetPositionUpdate}
        />
      ))}

      <Stars radius={8000} depth={6000} count={6000} factor={4} saturation={0.4} fade speed={0.3} />

      <BlackHole position={[4000, 0, 0]} onPositionUpdate={(name, pos) => handlePlanetPositionUpdate(name, pos, 550)} />

      <PlanetFollowCamera 
        followedPlanet={followedPlanet} 
        planetPositionsRef={planetPositionsRef} 
      />

      <OrbitControls
        enabled={!followedPlanet}
        enablePan={!followedPlanet}
        enableRotate={!followedPlanet}
        enableZoom={!followedPlanet}
        panSpeed={2.5}
        rotateSpeed={1.0}
        zoomSpeed={1.0}
        minDistance={50}
        maxDistance={40000}
        autoRotateSpeed={0.4}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />

      <StarCreditManager setTotalCredits={setCreditsInFlight} />

      </Canvas>

      <div className="hud">
        <div className="hud-box">
          <strong>Credits in Flight:</strong> {creditsInFlight}
        </div>
      </div>

      <FollowPlanetTab 
        planets={planets}
        onPlanetSelect={setFollowedPlanet}
        followedPlanet={followedPlanet}
      />
    </>
  )
}

export default App;