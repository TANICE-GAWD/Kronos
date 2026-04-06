import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

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

export default function StarCreditManager({ setTotalCredits }) {
  const { scene } = useThree();
  const packetMap = useRef(new Map());
  const targetMap = useRef(new Map());
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(10);
  const isConnectingRef = useRef(false);

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
    attemptConnection();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
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

  useFrame(() => {
    for (const [id, entry] of packetMap.current.entries()) {
      if (!entry.group || !entry.target) continue;

      entry.group.position.lerp(entry.target, 0.1);

      
      entry.frameCounter++;
      if (entry.frameCounter >= 2) {
        entry.frameCounter = 0;
        entry.positionHistory.push(entry.group.position.clone());
        // Keep trail to max 20 points (~30 units at typical speeds)
        if (entry.positionHistory.length > 20) {
          entry.positionHistory.shift();
        }
      }

      // Update trail line geometry
      if (entry.trailLine && entry.positionHistory.length > 2) {
        // Dispose old geometry
        if (entry.trailLine.geometry) {
          entry.trailLine.geometry.dispose();
        }

        // Create curve from position history
        const points = entry.positionHistory.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const curve = new THREE.CatmullRomCurve3(points);

        // Create new tube geometry
        const newGeometry = new THREE.TubeGeometry(curve, 12, 2.5, 8, false);

        // Add vertex colors for gradient
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
  });

  return null;
}
