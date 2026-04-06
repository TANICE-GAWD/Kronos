import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";


import starsTexture from "/textures/textures2/8k_stars.jpg";
import milkyWayTexture from "/textures/textures2/8k_stars_milky_way.jpg";

const statusColors = {
  active: 0xffd700,
  stalled: 0x9400d3,
  destroyed: 0xff4500,
};

const trailColors = {
  active: 0xffd700,
  stalled: 0x9400d3,
  destroyed: 0xff4500,
};

function createTrailLine(status = "active") {
  
  const curve = new THREE.LineCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 1)
  );

  const geometry = new THREE.TubeGeometry(curve, 8, 2, 8, false);

  
  const colors = [];
  const colorObj = new THREE.Color(trailColors[status] || trailColors.active);
  const positionAttribute = geometry.getAttribute("position");

  for (let i = 0; i < positionAttribute.count; i++) {
    const alpha = i / positionAttribute.count;
    
    colors.push(colorObj.r * alpha, colorObj.g * alpha, colorObj.b * alpha);
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: trailColors[status] || trailColors.active,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.8,
    roughness: 0.3,
    metalness: 0.9,
    wireframe: false,
    vertexColors: true,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;

  mesh.userData = {
    status,
    material: mat,
    baseGeometry: geometry,
    basePositions: geometry.getAttribute("position").array,
  };

  return mesh;
}

function createPacketMesh(status = "active") {
  const group = new THREE.Group();

  const geo = new THREE.IcosahedronGeometry(5, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: statusColors[status] || statusColors.active,
    emissive: 0x222222,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 1,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const glow = new THREE.PointLight(0xffffff, 1.3, 8, 2);
  glow.position.set(0, 0, 0);

  group.add(mesh);
  group.add(glow);

  group.userData = {
    geometry: geo,
    material: mat,
    light: glow,
    status,
    creationTime: performance.now(),
    removed: false,
  };

  return group;
}

function updateStatusVisuals(group, status, trailLine) {
  if (!group?.userData) return;
  const { material, light } = group.userData;

  group.userData.status = status;

  if (status === "active") {
    material.color.setHex(statusColors.active);
    material.emissive.setHex(0x444400);
    light.color.setHex(0xffd700);
    light.intensity = 1.3;
    if (trailLine?.material) {
      trailLine.material.emissive.setHex(trailColors.active);
    }
  } else if (status === "stalled") {
    material.color.setHex(statusColors.stalled);
    material.emissive.setHex(0x280020);
    light.color.setHex(0x8b0000);
    light.intensity = 0.9;
    if (trailLine?.material) {
      trailLine.material.emissive.setHex(trailColors.stalled);
    }
  } else if (status === "destroyed") {
    material.color.setHex(statusColors.destroyed);
    material.emissive.setHex(0xffa500);
    light.color.setHex(0xff4500);
    light.intensity = 2.4;
    if (trailLine?.material) {
      trailLine.material.emissive.setHex(trailColors.destroyed);
    }
  }
}

function disposeGroup(group) {
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function processPacketData(data, packetMap, targetMap, scene, sendCount) {
  if (typeof data !== "object" || data === null) {
    console.log("[processPacketData] invalid data type");
    return;
  }

  const incomingIds = new Set(Object.keys(data));
  console.log("[processPacketData] processing", incomingIds.size, "packets");

  
  for (const id of incomingIds) {
    const packet = data[id];
    console.log(`[processPacketData] packet ${id}:`, packet);
    if (!packet || !packet.current_pos) {
      console.warn(`[processPacketData] packet ${id} missing current_pos`, packet);
      continue;
    }

    const target = new THREE.Vector3(
      packet.current_pos.x,
      packet.current_pos.y,
      packet.current_pos.z
    );

    const status = packet.status || "active";
    console.log(`[processPacketData] creating/updating packet ${id}, status=${status}, pos:`, target);

    if (packetMap.current.has(id)) {
      const entry = packetMap.current.get(id);
      entry.target = target;

      if (entry.status !== status) {
        entry.status = status;
        updateStatusVisuals(entry.group, status, entry.trailLine);
      }

      if (status === "destroyed" && !entry.removalScheduled) {
        entry.removalScheduled = true;
        setTimeout(() => {
          if (packetMap.current.has(id)) {
            const toRemove = packetMap.current.get(id);
            scene.remove(toRemove.group);
            disposeGroup(toRemove.group);
            if (toRemove.trailLine) {
              scene.remove(toRemove.trailLine);
              if (toRemove.trailLine.geometry) toRemove.trailLine.geometry.dispose();
              if (toRemove.trailLine.material) toRemove.trailLine.material.dispose();
            }
            packetMap.current.delete(id);
            targetMap.current.delete(id);
            sendCount(packetMap.current.size);
          }
        }, 420);
      }
    } else {
      console.log(`[processPacketData] new packet ${id}, creating mesh`);
      const group = createPacketMesh(status);
      group.position.copy(target);
      scene.add(group);

      const trailLine = createTrailLine(status);
      scene.add(trailLine);

      packetMap.current.set(id, {
        group,
        target,
        status,
        removalScheduled: status === "destroyed",
        trailLine,
        positionHistory: [target.clone()],
        frameCounter: 0,
      });

      targetMap.current.set(id, target);

      if (status === "destroyed") {
        setTimeout(() => {
          if (packetMap.current.has(id)) {
            const toRemove = packetMap.current.get(id);
            scene.remove(toRemove.group);
            disposeGroup(toRemove.group);
            if (toRemove.trailLine) {
              scene.remove(toRemove.trailLine);
              if (toRemove.trailLine.geometry) toRemove.trailLine.geometry.dispose();
              if (toRemove.trailLine.material) toRemove.trailLine.material.dispose();
            }
            packetMap.current.delete(id);
            targetMap.current.delete(id);
            sendCount(packetMap.current.size);
          }
        }, 420);
      }
    }
  }

  
  for (const [existingId, existingEntry] of packetMap.current.entries()) {
    if (!incomingIds.has(existingId) && existingEntry.status !== "destroyed") {
      console.log(`[processPacketData] removing missing packet ${existingId}`);
      updateStatusVisuals(existingEntry.group, "destroyed", existingEntry.trailLine);
      existingEntry.status = "destroyed";
      if (!existingEntry.removalScheduled) {
        existingEntry.removalScheduled = true;
        setTimeout(() => {
          if (packetMap.current.has(existingId)) {
            const toRemove = packetMap.current.get(existingId);
            scene.remove(toRemove.group);
            disposeGroup(toRemove.group);
            if (toRemove.trailLine) {
              scene.remove(toRemove.trailLine);
              if (toRemove.trailLine.geometry) toRemove.trailLine.geometry.dispose();
              if (toRemove.trailLine.material) toRemove.trailLine.material.dispose();
            }
            packetMap.current.delete(existingId);
            targetMap.current.delete(existingId);
            sendCount(packetMap.current.size);
          }
        }, 420);
      }
    }
  }

  console.log(`[processPacketData] total packets in map: ${packetMap.current.size}`);
  sendCount(packetMap.current.size);
}

function createMultipleFloatingEyes(scene) {
  const eyesArray = [];
  const totalEyes = 50;
  const orbitingEyes = 5;
  const staticEyes = totalEyes - orbitingEyes;
  
  // Fibonacci sphere for uniform distribution
  function getFibonacciSpherePoint(i, n) {
    const phi = Math.acos(1 - (2 * i) / n);
    const theta = Math.sqrt(n * Math.PI) * phi;
    return { phi, theta };
  }

  // Create orbiting eyes (5 of them)
  for (let i = 0; i < orbitingEyes; i++) {
    const eye = createSingleEye(scene, true, i);
    eyesArray.push(eye);
  }

  // Create static eyes (45 of them) distributed uniformly
  for (let i = 0; i < staticEyes; i++) {
    const eye = createSingleEye(scene, false, i);
    eyesArray.push(eye);
  }

  return eyesArray;
}

function createSingleEye(scene, isOrbiting = false, index = 0) {
  const eyeGroup = new THREE.Group();

  // White of the eye - elongated sphere
  const eyeWhiteGeometry = new THREE.SphereGeometry(600, 32, 32, 0, Math.PI * 2);
  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.5,
  });
  const eyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
  eyeWhite.scale.set(2, 1.2, 1);
  eyeGroup.add(eyeWhite);

  // Pupil - black sphere
  const pupilGeometry = new THREE.SphereGeometry(300, 32, 32);
  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x330000,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.8,
  });
  const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  pupil.position.z = 380;
  eyeGroup.add(pupil);

  // Red glow spot (iris-like effect)
  const glowGeometry = new THREE.SphereGeometry(200, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.6,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.z = 410;
  eyeGroup.add(glow);

  // Eyelid - semi-transparent black overlay
  const eyelidGeometry = new THREE.SphereGeometry(620, 32, 32, 0, Math.PI * 2);
  const eyelidMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    emissive: 0x000000,
  });
  const eyelid = new THREE.Mesh(eyelidGeometry, eyelidMaterial);
  eyelid.scale.set(2, 1.2, 1);
  eyelid.position.z = 10;
  eyeGroup.add(eyelid);

  // Point light for spotlight effect
  const spotlight = new THREE.PointLight(0xff0000, 1.5, 3000);
  spotlight.position.set(0, 0, 800);
  eyeGroup.add(spotlight);

  // Calculate position based on Fibonacci sphere distribution
  if (isOrbiting) {
    // Orbiting eyes get positioned on a specific orbit
    const orbitPhase = (index / 5) * Math.PI * 2;
    eyeGroup.position.set(
      Math.cos(orbitPhase) * 16000,
      Math.sin(orbitPhase) * 8000,
      Math.sin(orbitPhase * 1.5) * 12000
    );
  } else {
    // Static eyes - uniformly distributed on Fibonacci sphere
    // Golden angle in radians (prevents clustering)
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    
    // Get position on unit sphere using Fibonacci sphere algorithm
    const theta = Math.acos(1 - (2 * (index + 5)) / 50); // +5 to skip orbiting eyes
    const phi = ((index + 5) % 50) * goldenAngle;
    
    // Radius at the midpoint between star sphere (5000) and text cube (25000)
    const radius = 15000;
    
    // Convert spherical to Cartesian coordinates
    const x = Math.cos(phi) * Math.sin(theta) * radius;
    const y = Math.sin(phi) * Math.sin(theta) * radius;
    const z = Math.cos(theta) * radius;
    
    eyeGroup.position.set(x, y, z);
  }

  scene.add(eyeGroup);

  return {
    group: eyeGroup,
    pupil,
    eyelid,
    glow,
    spotlight,
    time: 0,
    isOrbiting,
    index,
  };
}

function createFloatingEye(scene) {
  const eyeGroup = new THREE.Group();

  // White of the eye - elongated sphere
  const eyeWhiteGeometry = new THREE.SphereGeometry(800, 32, 32, 0, Math.PI * 2);
  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.5,
  });
  const eyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
  eyeWhite.scale.set(2, 1.2, 1);
  eyeGroup.add(eyeWhite);

  // Pupil - black sphere
  const pupilGeometry = new THREE.SphereGeometry(400, 32, 32);
  const pupilMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x330000,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.8,
  });
  const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
  pupil.position.z = 450;
  pupilGeometry.userData = { originalPosition: pupil.position.clone() };
  eyeGroup.add(pupil);

  // Red glow spot (iris-like effect)
  const glowGeometry = new THREE.SphereGeometry(250, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.6,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.z = 500;
  eyeGroup.add(glow);

  // Eyelid - semi-transparent black overlay
  const eyelidGeometry = new THREE.SphereGeometry(820, 32, 32, 0, Math.PI * 2);
  const eyelidMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    emissive: 0x000000,
  });
  const eyelid = new THREE.Mesh(eyelidGeometry, eyelidMaterial);
  eyelid.scale.set(2, 1.2, 1);
  eyelid.position.z = 10;
  eyeGroup.add(eyelid);

  // Point light for spotlight effect
  const spotlight = new THREE.PointLight(0xff0000, 2, 5000);
  spotlight.position.set(0, 0, 1000);
  eyeGroup.add(spotlight);

  scene.add(eyeGroup);

  return {
    group: eyeGroup,
    pupil,
    eyelid,
    glow,
    spotlight,
    time: 0,
  };
}

function createStarBackground(scene) {
  const textureLoader = new THREE.TextureLoader();
  
  
  const starsGeometry = new THREE.SphereGeometry(5000, 64, 64);
  const starsTexture_loaded = textureLoader.load(starsTexture);
  starsTexture_loaded.encoding = THREE.sRGBEncoding;
  const starsMaterial = new THREE.MeshBasicMaterial({
    map: starsTexture_loaded,
    side: THREE.BackSide,
  });
  const starsMesh = new THREE.Mesh(starsGeometry, starsMaterial);
  scene.add(starsMesh);

  
  const milkyWayGeometry = new THREE.SphereGeometry(4950, 64, 64);
  const milkyWayTexture_loaded = textureLoader.load(milkyWayTexture);
  milkyWayTexture_loaded.encoding = THREE.sRGBEncoding;
  const milkyWayMaterial = new THREE.MeshBasicMaterial({
    map: milkyWayTexture_loaded,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.8,
  });
  const milkyWayMesh = new THREE.Mesh(milkyWayGeometry, milkyWayMaterial);
  scene.add(milkyWayMesh);

  
  const ambientLight = new THREE.AmbientLight(0x4488ff, 0.6);
  scene.add(ambientLight);

  
  const warningPlanes = [];
  const canvas = document.createElement("canvas");
  canvas.width = 8192;
  canvas.height = 8192;
  const ctx = canvas.getContext("2d");
  
  
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  
  ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
  ctx.font = "bold 120px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  
  const text = "YOU ARE NOT SUPPOSED TO BE HERE>>>>RUNNNN";
  const textWidth = ctx.measureText(text).width;
  const lineHeight = 150;
  
  
  for (let y = 0; y < canvas.height; y += lineHeight) {
    for (let x = 0; x < canvas.width; x += textWidth + 50) {
      ctx.fillText(text, x, y);
    }
  }
  
  const warningTexture = new THREE.CanvasTexture(canvas);
  warningTexture.wrapS = THREE.RepeatWrapping;
  warningTexture.wrapT = THREE.RepeatWrapping;
  warningTexture.magFilter = THREE.LinearFilter;
  warningTexture.minFilter = THREE.LinearFilter;
  
  
  const planePositions = [
    { pos: [0, 0, -25000], rot: [0, 0, 0], scale: [1, 1, 1] },           
    { pos: [0, 0, 25000], rot: [0, Math.PI, 0], scale: [-1, 1, 1] },     
    { pos: [-25000, 0, 0], rot: [0, Math.PI / 2, 0], scale: [-1, 1, 1] }, 
    { pos: [25000, 0, 0], rot: [0, -Math.PI / 2, 0], scale: [1, 1, 1] }, 
    { pos: [0, 25000, 0], rot: [Math.PI / 2, 0, 0], scale: [1, -1, 1] }, 
    { pos: [0, -25000, 0], rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 1] } 
  ];
  
  planePositions.forEach(({ pos, rot, scale }) => {
    const planeGeometry = new THREE.PlaneGeometry(50000, 50000);
    const planeMaterial = new THREE.MeshBasicMaterial({
      map: warningTexture.clone(),
      transparent: true,
      side: THREE.FrontSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.set(...pos);
    plane.rotation.set(...rot);
    plane.scale.set(...scale);
    scene.add(plane);
    warningPlanes.push(plane);
  });

  
  return { starsMesh, milkyWayMesh, starsMaterial, milkyWayMaterial, warningPlanes, warningTexture };
}

export default function StarCreditManager({ setTotalCredits }) {
  const { scene } = useThree();
  const packetMap = useRef(new Map());
  const targetMap = useRef(new Map());
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(10);
  const isConnectingRef = useRef(false);
  const starBackgroundRef = useRef(null);
  const floatingEyesRef = useRef([]);

  const sendCount = (mapValue) => {
    if (typeof setTotalCredits === "function") {
      setTotalCredits(mapValue);
    }
  };

  const attemptConnection = () => {
    if (isConnectingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;

    try {
      const ws = new WebSocket("ws://localhost:8080/ws");
      wsRef.current = ws;

      ws.onopen = () => {
        console.info("[StarCreditManager] ws connected");
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
      };

      ws.onerror = (err) => {
        console.error("[StarCreditManager] ws error", err);
        isConnectingRef.current = false;
      };

      ws.onclose = () => {
        console.info("[StarCreditManager] ws closed, will retry");
        isConnectingRef.current = false;
        scheduleReconnect();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data || "{}");
          console.log("[StarCreditManager] received data:", data);
          console.log("[StarCreditManager] data keys:", Object.keys(data));
          processPacketData(data, packetMap, targetMap, scene, sendCount);
        } catch (err) {
          console.warn("[StarCreditManager] failed parse websocket", err);
        }
      };
    } catch (err) {
      console.error("[StarCreditManager] connection error:", err);
      isConnectingRef.current = false;
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
      console.warn("[StarCreditManager] max reconnect attempts reached");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current += 1;

    console.log(
      `[StarCreditManager] scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`
    );
    reconnectTimeoutRef.current = setTimeout(() => {
      attemptConnection();
    }, delay);
  };

  useEffect(() => {
    starBackgroundRef.current = createStarBackground(scene);
    floatingEyesRef.current = createMultipleFloatingEyes(scene);
    attemptConnection();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Cleanup floating eyes
      if (floatingEyesRef.current && floatingEyesRef.current.length > 0) {
        floatingEyesRef.current.forEach((eye) => {
          if (eye.group) {
            scene.remove(eye.group);
            eye.group.traverse((child) => {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
          }
        });
      }
      
      if (starBackgroundRef.current) {
        const { starsMesh, milkyWayMesh, starsMaterial, milkyWayMaterial, warningPlanes, warningTexture } = starBackgroundRef.current;
        scene.remove(starsMesh);
        scene.remove(milkyWayMesh);
        if (starsMesh.geometry) starsMesh.geometry.dispose();
        if (milkyWayMesh.geometry) milkyWayMesh.geometry.dispose();
        if (starsMaterial) starsMaterial.dispose();
        if (milkyWayMaterial) milkyWayMaterial.dispose();
        
        
        if (warningPlanes) {
          warningPlanes.forEach((plane) => {
            scene.remove(plane);
            if (plane.geometry) plane.geometry.dispose();
            if (plane.material) plane.material.dispose();
          });
        }
        if (warningTexture) warningTexture.dispose();
      }
      
      packetMap.current.forEach((entry) => {
        scene.remove(entry.group);
        disposeGroup(entry.group);
        if (entry.trailLine) {
          scene.remove(entry.trailLine);
          if (entry.trailLine.geometry) entry.trailLine.geometry.dispose();
          if (entry.trailLine.material) entry.trailLine.material.dispose();
        }
      });
      packetMap.current.clear();
      targetMap.current.clear();
      sendCount(0);
    };
  }, [scene]);

  useFrame(({ camera }) => {
    for (const [id, entry] of packetMap.current.entries()) {
      if (!entry.group || !entry.target) continue;

      entry.group.position.lerp(entry.target, 0.1);

      
      entry.frameCounter++;
      if (entry.frameCounter >= 2) {
        entry.frameCounter = 0;
        entry.positionHistory.push(entry.group.position.clone());
        
        if (entry.positionHistory.length > 20) {
          entry.positionHistory.shift();
        }
      }

      
      if (entry.trailLine && entry.positionHistory.length > 2) {
        
        if (entry.trailLine.geometry) {
          entry.trailLine.geometry.dispose();
        }

        
        const points = entry.positionHistory.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const curve = new THREE.CatmullRomCurve3(points);

        
        const newGeometry = new THREE.TubeGeometry(curve, 12, 2.5, 8, false);

        
        const colors = [];
        const colorObj = new THREE.Color(trailColors[entry.status] || trailColors.active);
        const positionAttribute = newGeometry.getAttribute("position");

        for (let i = 0; i < positionAttribute.count; i++) {
          const alpha = i / positionAttribute.count;
          colors.push(colorObj.r * alpha, colorObj.g * alpha, colorObj.b * alpha);
        }

        newGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
        entry.trailLine.geometry = newGeometry;
      }

      if (entry.status === "destroyed") {
        entry.group.scale.lerp(new THREE.Vector3(2, 2, 2), 0.08);
        entry.group.rotation.x += 0.1;
        entry.group.rotation.y += 0.08;
      }
      if (entry.status === "stalled") {
        entry.group.scale.lerp(new THREE.Vector3(1.4, 1.4, 1.4), 0.03);
      }
      if (entry.status === "active") {
        entry.group.scale.lerp(new THREE.Vector3(1, 1, 1), 0.03);
      }
    }

    // Animate floating eyes
    if (floatingEyesRef.current && floatingEyesRef.current.length > 0) {
      floatingEyesRef.current.forEach((eye) => {
        eye.time += 0.004;

        if (eye.isOrbiting) {
          // Orbiting eyes - continuous motion around the sphere
          const orbitPhase = (eye.index / 5) * Math.PI * 2;
          const orbitTime = eye.time * 0.3;
          const orbitRadius = 16000;
          
          eye.group.position.x = Math.cos(orbitPhase + orbitTime) * orbitRadius;
          eye.group.position.y = Math.sin(orbitPhase + orbitTime) * orbitRadius * 0.5;
          eye.group.position.z = Math.sin(orbitPhase * 1.5 + orbitTime) * orbitRadius * 0.75;
        }

        // Look around with pupil - smooth sinusoidal motion (all eyes do this)
        const pupilOffsetX = Math.sin(eye.time * 0.7) * 120;
        const pupilOffsetY = Math.cos(eye.time * 0.5) * 80;
        eye.pupil.position.x = pupilOffsetX;
        eye.pupil.position.y = pupilOffsetY;

        // Glow follows pupil
        eye.glow.position.x = pupilOffsetX * 0.8;
        eye.glow.position.y = pupilOffsetY * 0.8;

        // Blink animation - periodic opacity change
        const blink = Math.pow(Math.sin(eye.time * 2.5 + Math.PI), 4);
        eye.eyelid.material.opacity = blink * 0.9;

        // Pulse glow intensity
        eye.spotlight.intensity = 1.5 + Math.sin(eye.time + eye.index) * 0.4;
        eye.glow.material.opacity = 0.4 + Math.sin(eye.time * 1.5 + eye.index) * 0.2;

        // Face direction based on type
        if (eye.isOrbiting) {
          // Orbiting eyes look at the center (origin)
          eye.group.lookAt(0, 0, 0);
        } else {
          // Static eyes follow the camera
          eye.group.lookAt(camera.position);
        }
      });
    }
    
    if (starBackgroundRef.current?.milkyWayMesh) {
      starBackgroundRef.current.milkyWayMesh.rotation.z += 0.00005;
      starBackgroundRef.current.milkyWayMesh.rotation.y += 0.000025;
    }
  });

  return null;
}
