import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import Sun from "./components/Sun";
import Planet from "./components/Planet";
import BlackHole from "./components/BlackHole";
import StarCreditManager from "./components/StarCreditManager";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function App(){
  const [creditsInFlight, setCreditsInFlight] = useState(0);

  
  const planets = [
    { name: "Mercury", radius: 0.25, distance: 39, speed: 0.82 },
    { name: "Venus", radius: 0.45, distance: 72, speed: 0.32 },
    { name: "Earth", radius: 0.5, distance: 100, speed: 0.20 },
    { name: "Jupiter", radius: 1.2, distance: 520, speed: 0.017 },
    { name: "Mars", radius: 0.35, distance: 152, speed: 0.11 },
    { name: "Saturn", radius: 1.0, distance: 954, speed: 0.0067 },
    { name: "Uranus", radius: 0.7, distance: 1919, speed: 0.0024 },
    { name: "Neptune", radius: 0.7, distance: 3007, speed: 0.0012 },
  ];

  return(
    <>
      <Canvas camera={{ position: [0, 500, 1500], fov: 45 }}>

      <ambientLight intensity={3}/>
      <directionalLight position={[5, 5, 5]} intensity={1.5} />

      <Sun/>

      {planets.map((planet) => (
        <Planet key={planet.name} {...planet} />
      ))}

      <Stars radius={4000} depth={1000} count={6000} factor={4} saturation={0.4} fade speed={0.3} />

      <BlackHole position={[0, 0, 500]} />

      <OrbitControls
        enablePan
        enableRotate
        enableZoom
        panSpeed={2.5}
        rotateSpeed={1.0}
        zoomSpeed={1.0}
        minDistance={50}
        maxDistance={5000}
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
    </>
  )
}

export default App;