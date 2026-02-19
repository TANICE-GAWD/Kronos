import { Canvas } from "@react-three/fiber";
import Sun from "./components/Sun";
import { useState } from "react";
import Planet from "./components/Planet";
import { Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import pls_jst_spin_twn_T_T from "./components/BeyBlade";

function App(){
  const [elapsed, setElapsed] = useState(0);
  const planets = [
    { name: "Mercury", radius: 0.25, distance: 3, speed: 2.0 },
    { name: "Venus", radius: 0.45, distance: 4.5, speed: 1.6 },
    { name: "earth", radius: 0.5, distance: 6, speed: 1.0 },
    { name: "Mars", radius: 0.35, distance: 8, speed: 0.8 },
    { name: "Jupiter", radius: 1.2, distance: 12, speed: 0.4 },
    { name: "Uranus", radius: 0.7, distance: 20, speed: 0.2 },
    { name: "Neptune", radius: 0.7, distance: 24, speed: 0.15 },
  ];



  return(
    <Canvas camera={{ position: [0, 10, 20], fov: 45 }}>
      <pls_jst_spin_twn_T_T setElapsed={setElapsed} />
      <ambientLight intensity={3}/>
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <Sun/>
      {planets.map((planet) => (
          <Planet
            key={planet.name}
            name={planet.name}
            radius={planet.radius}
            distance={planet.distance}
            speed={planet.speed}
            elapsed={elapsed}
          />
        ))}


        <OrbitControls
          enablePan={true}
          enableRotate={true}
          enableZoom={true}
          panSpeed={2.5}
          rotateSpeed={1.0}
          zoomSpeed={1.0}
          minDistance={2}
          maxDistance={1000}
          autoRotateSpeed={0.4}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
      
    </Canvas>
  )

}

export default App;