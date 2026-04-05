import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const statusColors = {
  active: 0xffd700,
  stalled: 0x9400d3,
  destroyed: 0xff4500,
};

function createPacketMesh(status = "active") {
  const group = new THREE.Group();

  const geo = new THREE.IcosahedronGeometry(0.35, 1);
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

function updateStatusVisuals(group, status) {
  if (!group?.userData) return;
  const { material, light } = group.userData;

  group.userData.status = status;

  if (status === "active") {
    material.color.setHex(statusColors.active);
    material.emissive.setHex(0x444400);
    light.color.setHex(0xffd700);
    light.intensity = 1.3;
  } else if (status === "stalled") {
    material.color.setHex(statusColors.stalled);
    material.emissive.setHex(0x280020);
    light.color.setHex(0x8b0000);
    light.intensity = 0.9;
  } else if (status === "destroyed") {
    material.color.setHex(statusColors.destroyed);
    material.emissive.setHex(0xffa500);
    light.color.setHex(0xff4500);
    light.intensity = 2.4;
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
        updateStatusVisuals(entry.group, status);
      }

      if (status === "destroyed" && !entry.removalScheduled) {
        entry.removalScheduled = true;
        setTimeout(() => {
          if (packetMap.current.has(id)) {
            const toRemove = packetMap.current.get(id);
            scene.remove(toRemove.group);
            disposeGroup(toRemove.group);
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

      packetMap.current.set(id, {
        group,
        target,
        status,
        removalScheduled: status === "destroyed",
      });

      targetMap.current.set(id, target);

      if (status === "destroyed") {
        setTimeout(() => {
          if (packetMap.current.has(id)) {
            const toRemove = packetMap.current.get(id);
            scene.remove(toRemove.group);
            disposeGroup(toRemove.group);
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
      updateStatusVisuals(existingEntry.group, "destroyed");
      existingEntry.status = "destroyed";
      if (!existingEntry.removalScheduled) {
        existingEntry.removalScheduled = true;
        setTimeout(() => {
          if (packetMap.current.has(existingId)) {
            const toRemove = packetMap.current.get(existingId);
            scene.remove(toRemove.group);
            disposeGroup(toRemove.group);
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
      const ws = new WebSocket("ws:
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
