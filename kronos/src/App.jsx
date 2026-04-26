import { useState, useRef, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { Send, LogOut } from "lucide-react";
import Sun from "./components/Sun";
import Planet from "./components/Planet";
import BlackHole from "./components/BlackHole";
import OrbitLine from "./components/OrbitLine";
import StarCreditManager from "./components/StarCreditManager";
import FollowPlanetTab from "./components/FollowPlanetTab";
import PlanetFollowCamera from "./components/PlanetFollowCamera";
import WalletUI from "./components/WalletUI";
import TransferModal from "./components/TransferModal";
import Notification from "./components/Notification";
import { Stars, OrbitControls } from "@react-three/drei";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import * as THREE from "three";

function MainScene() {
  const [creditsInFlight, setCreditsInFlight] = useState(0);
  const [followedPlanet, setFollowedPlanet] = useState(null);
  const planetPositionsRef = useRef({});
  const cameraRef = useRef(null);
  const navigate = useNavigate();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('homePlanet');
    navigate('/login');
  };

  

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
    cameraRef.current = camera;
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
        <button 
          className="transfer-button"
          onClick={() => setIsTransferModalOpen(true)}
          title="Send credits to another user"
        >
          <Send size={20} style={{ marginRight: '6px' }} />
          Send
        </button>
        <button 
          className="logout-button"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={20} style={{ marginRight: '6px' }} />
          Logout
        </button>
      </div>

      <FollowPlanetTab 
        planets={planets}
        onPlanetSelect={setFollowedPlanet}
        followedPlanet={followedPlanet}
      />

      <WalletUI />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onTransferComplete={(transfer) => {
          setNotification(`   Transaction Launched! Sent ${transfer.amount} CREDIT to ${transfer.recipient} on ${transfer.planet}`);
        }}
        planetPositionsRef={planetPositionsRef}
        cameraRef={cameraRef}
      />

      <Notification
        message={notification}
        type="success"
        onClose={() => setNotification(null)}
      />
    </>
  )
}


function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#0a0e27',
      color: 'white',
      fontSize: '18px'
    }}>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <MainScene />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;