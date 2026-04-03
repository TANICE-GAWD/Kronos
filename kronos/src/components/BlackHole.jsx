import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

const BLACK_HOLE_EVENT_HORIZON_RADIUS = 1.0;
const DISK_INNER_RADIUS = BLACK_HOLE_EVENT_HORIZON_RADIUS + 0.15;
const DISK_OUTER_RADIUS = 5.5;
const PHOTON_SPHERE_RADIUS = BLACK_HOLE_EVENT_HORIZON_RADIUS * 1.5;

const themes = {
  inferno: {
    diskHot: new THREE.Color(0x000000),
    diskMid: new THREE.Color(0xffaa33),
    diskEdge: new THREE.Color(0xcc331a),
    diskDeep: new THREE.Color(0x661a00),
    lensing: new THREE.Color(0xffcc66),
    glow: new THREE.Color(0x4a5d73),
    photonSphere: new THREE.Color(0xffbb44),
    primaryWave: new THREE.Color(0xffaa33),
    secondaryWave: new THREE.Color(0xff5500),
    tertiaryWave: new THREE.Color(0xffdd22),
  },
};

const BlackHole = ({ position = [35, 0, 0], theme = "inferno" }) => {
  const groupRef = useRef();
  const diskRef = useRef();
  const photonRef = useRef();
  const lensingRef = useRef();
  const glowRef = useRef();
  const blackHoleRef = useRef();
  const { camera } = useThree();

  const currentTheme = themes[theme] || themes.inferno;

  const diskUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorHot: { value: currentTheme.diskHot.clone() },
      uColorMid: { value: currentTheme.diskMid.clone() },
      uColorEdge: { value: currentTheme.diskEdge.clone() },
      uColorDeep: { value: currentTheme.diskDeep.clone() },
      uCameraPosition: { value: new THREE.Vector3() },
      uRippleActive: { value: 0 },
      uRippleStartTime: { value: 0 },
      uRippleDuration: { value: 2.8 },
      uPrimaryWaveColor: { value: currentTheme.primaryWave.clone() },
      uSecondaryWaveColor: { value: currentTheme.secondaryWave.clone() },
      uTertiaryWaveColor: { value: currentTheme.tertiaryWave.clone() },
      uRippleMaxRadius: { value: DISK_OUTER_RADIUS },
      uRippleThickness: { value: DISK_OUTER_RADIUS * 0.12 },
      uRippleIntensity: { value: 0 },
      uRippleDistortionStrength: { value: 0 },
      uPulsar: { value: 0 },
    }),
    [currentTheme]
  );

  const photonUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: currentTheme.photonSphere.clone() },
      uDiskEchoActive: { value: 0 },
      uDiskEchoIntensity: { value: 0 },
      uPulsar: { value: 0 },
    }),
    [currentTheme]
  );

  const lensingUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLensingColor: { value: currentTheme.lensing.clone() },
      uDiskEchoActive: { value: 0 },
      uDiskEchoIntensity: { value: 0 },
      uPulsar: { value: 0 },
    }),
    [currentTheme]
  );

  const glowUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGlowColor: { value: currentTheme.glow.clone() },
      uDiskEchoActive: { value: 0 },
      uDiskEchoIntensity: { value: 0 },
      uDiskEchoColor: { value: currentTheme.primaryWave.clone() },
      uPulsar: { value: 0 },
    }),
    [currentTheme]
  );

  const diskMaterialRef = useRef();
  const photonMaterialRef = useRef();
  const lensingMaterialRef = useRef();
  const glowMaterialRef = useRef();

  const echoState = useRef({ active: false, start: 0, intensity: 0 });

  const triggerDiskEcho = () => {
    const now = performance.now() / 1000;
    echoState.current = { active: true, start: now, intensity: 1.0 };

    const diskMat = diskMaterialRef.current;
    if (diskMat) {
      diskMat.uniforms.uRippleActive.value = 1.0;
      diskMat.uniforms.uRippleStartTime.value = now;
      diskMat.uniforms.uPrimaryWaveColor.value.copy(currentTheme.primaryWave).multiplyScalar(3.0);
      diskMat.uniforms.uSecondaryWaveColor.value.copy(currentTheme.secondaryWave).multiplyScalar(2.7);
      diskMat.uniforms.uTertiaryWaveColor.value.copy(currentTheme.tertiaryWave).multiplyScalar(2.4);
    }

    const glowMat = glowMaterialRef.current;
    if (glowMat) {
      glowMat.uniforms.uDiskEchoColor.value.copy(currentTheme.primaryWave).multiplyScalar(1.8);
    }
  };

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    const diskMat = diskMaterialRef.current;
    const photonMat = photonMaterialRef.current;
    const lensingMat = lensingMaterialRef.current;
    const glowMat = glowMaterialRef.current;

    const rawPulse = Math.sin(elapsed * 2.8) * 0.65 + 0.35;
    const pulsarVal = Math.pow(Math.max(0.0, rawPulse), 2.0);

    if (diskMat) {
      diskMat.uniforms.uTime.value = elapsed;
      diskMat.uniforms.uCameraPosition.value.copy(camera.position);
      diskMat.uniforms.uPulsar.value = pulsarVal;
    }
    if (lensingMat) {
      lensingMat.uniforms.uTime.value = elapsed;
      lensingMat.uniforms.uPulsar.value = pulsarVal;
    }
    if (glowMat) {
      glowMat.uniforms.uTime.value = elapsed;
      glowMat.uniforms.uPulsar.value = pulsarVal;
    }
    if (photonMat) {
      photonMat.uniforms.uTime.value = elapsed;
      photonMat.uniforms.uPulsar.value = pulsarVal;
    }

    const group = groupRef.current;
    if (group) {
      group.rotation.y = elapsed * 0.3;
    }

    if (echoState.current.active) {
      const timeSince = elapsed - echoState.current.start;
      const norm = timeSince / 2.8;
      if (norm >= 1.0) {
        echoState.current.active = false;
        if (diskMat) {
          diskMat.uniforms.uRippleActive.value = 0;
          diskMat.uniforms.uRippleDistortionStrength.value = 0;
          diskMat.uniforms.uRippleIntensity.value = 0;
        }
        if (lensingMat) {
          lensingMat.uniforms.uDiskEchoActive.value = 0;
          lensingMat.uniforms.uDiskEchoIntensity.value = 0;
        }
        if (photonMat) {
          photonMat.uniforms.uDiskEchoActive.value = 0;
          photonMat.uniforms.uDiskEchoIntensity.value = 0;
        }
        if (glowMat) {
          glowMat.uniforms.uDiskEchoActive.value = 0;
          glowMat.uniforms.uDiskEchoIntensity.value = 0;
        }
      } else {
        const intensity = Math.max(0, 1 - norm);
        if (diskMat) {
          diskMat.uniforms.uRippleIntensity.value = intensity;
          diskMat.uniforms.uRippleDistortionStrength.value = intensity * 2.0;
        }
        if (lensingMat) {
          lensingMat.uniforms.uDiskEchoActive.value = 1;
          lensingMat.uniforms.uDiskEchoIntensity.value = intensity;
        }
        if (photonMat) {
          photonMat.uniforms.uDiskEchoActive.value = 1;
          photonMat.uniforms.uDiskEchoIntensity.value = intensity;
        }
        if (glowMat) {
          glowMat.uniforms.uDiskEchoActive.value = 1;
          glowMat.uniforms.uDiskEchoIntensity.value = intensity;
        }
      }
    }
  });

  const diskVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float uRippleDistortionStrength;
    uniform float uTime;

    void main() {
      vUv = uv;
      vPosition = position;
      vec3 adjustedPosition = position;
      if (uRippleDistortionStrength > 0.0) {
        float angle = atan(position.y, position.x);
        float distortionAmount = sin(angle * 10.0 + uTime * 7.0 + length(position.xy) * 2.0) * 0.08 * uRippleDistortionStrength;
        adjustedPosition.z += distortionAmount;
      }
      gl_Position = projectionMatrix * modelViewMatrix * vec4(adjustedPosition, 1.0);
    }
  `;

  const diskFragmentShader = `
    uniform float uTime;
    uniform vec3 uColorHot;
    uniform vec3 uColorMid;
    uniform vec3 uColorEdge;
    uniform vec3 uColorDeep;
    uniform vec3 uCameraPosition;
    uniform float uRippleActive;
    uniform float uRippleStartTime;
    uniform float uRippleDuration;
    uniform vec3 uPrimaryWaveColor;
    uniform vec3 uSecondaryWaveColor;
    uniform vec3 uTertiaryWaveColor;
    uniform float uRippleMaxRadius;
    uniform float uRippleThickness;
    uniform float uRippleIntensity;
    uniform float uPulsar;

    varying vec2 vUv;
    varying vec3 vPosition;

    float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }

    float noise(vec2 p){
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u*u*(3.0-2.0*u);
      float res = mix(mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x), mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
      return res * res;
    }

    float fbm(vec2 p, float timeOff, float freq, int octaves){
      float total = 0.0;
      float amp = 0.65;
      float persist = 0.5;
      for(int i=0;i<octaves;i++){
        float tscale = 0.6 + 0.12 * float(i);
        float n = noise(p*freq + vec2(timeOff*tscale*0.45, timeOff*tscale*0.3));
        total += amp * n;
        vec2 warp = vec2(n*0.18, -n*0.12);
        p += warp * amp * 0.5;
        freq *= 2.0;
        amp *= persist;
      }
      return total;
    }

    float vortexPattern(float dist, float angle, float time) {
      float spiralStrength = 5.8;
      float timeScale = 0.6;
      float angleOffset = dist * 0.28;
      float spiral = sin(angle*2.3 + angleOffset + dist*spiralStrength - time*timeScale);
      return smoothstep(-0.38, 0.68, spiral) * 0.32;
    }

    void main(){
      float dist = length(vPosition.xy);
      float innerEdge = ${DISK_INNER_RADIUS.toFixed(2)};
      float outerEdge = ${DISK_OUTER_RADIUS.toFixed(2)};
      float normalizedPos = clamp((dist - innerEdge) / (outerEdge - innerEdge), 0.0, 1.0);
      float angle = atan(vPosition.y, vPosition.x);
      float orbitalVelocity = 1.0 / sqrt(max(dist, 0.1));
      float dopplerFactor = 0.0;
      float beamingFactor = 1.0;

      if (length(uCameraPosition) > 0.01) {
        vec3 tangential = normalize(vec3(-vPosition.y, vPosition.x, 0.0));
        vec3 toCam = normalize(uCameraPosition - vPosition);
        dopplerFactor = dot(toCam, tangential) * orbitalVelocity * 0.3;
        beamingFactor = clamp(1.0 + dopplerFactor * 0.4, 0.5, 2.0);
      }

      float rotationSpeed = 4.8 / (pow(dist, 1.6) + 1.1);
      float rotatedAngle = angle - uTime * rotationSpeed * 0.52;
      vec2 baseCoord = vec2(dist*1.9, rotatedAngle*3.6);
      float evolvingTime = uTime * 0.17;

      float noiseFast = fbm(baseCoord, evolvingTime*1.2, 2.2, 6);
      float noiseSlow = fbm(baseCoord*0.6, evolvingTime*0.5, 1.5, 4);
      float noiseVal = noiseFast*0.7 + noiseSlow*0.4;
      float vortex = vortexPattern(dist, angle, uTime);
      float finalPattern = noiseVal*0.8 + vortex*1.1;

      float temperature = clamp(orbitalVelocity*(1.0 + finalPattern*0.3), 0.0, 2.0);
      vec3 colorInner = mix(uColorHot, uColorMid, smoothstep(0.0, 0.40, normalizedPos)*(1.0 - temperature*0.3));
      vec3 colorOuter = mix(uColorMid, uColorEdge, smoothstep(0.40, 0.80, normalizedPos));
      vec3 colorDeep = mix(uColorEdge, uColorDeep, smoothstep(0.80, 1.0, normalizedPos));
      vec3 color = mix(colorInner, colorOuter, smoothstep(0.40, 0.80, normalizedPos));
      color = mix(color, colorDeep, smoothstep(0.80, 1.0, normalizedPos));

      vec3 redshift = vec3(1.0 + dopplerFactor*0.15, 1.0, 1.0 - dopplerFactor*0.15);
      color *= redshift;

      float patternBrightness = (finalPattern + 0.5)*1.15;
      patternBrightness += pow(max(0.0, finalPattern-0.5),1.3)*0.6;
      float radialBrightness = pow(1.0 - smoothstep(0.0, 0.8, normalizedPos), 1.9)*3.0 + 0.25;
      float finalBrightness = patternBrightness * radialBrightness * beamingFactor;

      if(uRippleActive > 0.5) {
        float rippleTime = clamp((uTime - uRippleStartTime)/uRippleDuration, 0.0, 1.0);
        float rippleRadius = mix(innerEdge, uRippleMaxRadius, rippleTime);
        float rippleDist = abs(dist - rippleRadius);
        float wave = smoothstep(uRippleThickness, 0.0, rippleDist);
        float rippleContribution = wave * uRippleIntensity;
        finalBrightness += rippleContribution;
      }

      float alpha = smoothstep(0.0, 0.06, normalizedPos) * (1.0 - smoothstep(0.85, 1.0, normalizedPos));
      alpha *= 0.95;

      float pulsarBoost = 1.0 + uPulsar * 0.75;
      color *= pulsarBoost;

      
      color *= 1.2 + finalPattern * 0.8;
      color = clamp(color, 0.0, 8.0);
      float rippleAlphaBoost = 0.0;
      if (uRippleActive > 0.5) {
        rippleAlphaBoost = uRippleIntensity * 0.4;
      }

      gl_FragColor = vec4(color * finalBrightness, clamp(alpha + rippleAlphaBoost, 0.0, 1.0));
    }
  `;

  const photonVertex = `
    varying vec3 vNormal; varying vec3 vViewPos;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vViewPos = -mv.xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mv;
    }
  `;

  const photonFragment = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uDiskEchoActive;
    uniform float uDiskEchoIntensity;
    uniform float uPulsar;
    varying vec3 vNormal; varying vec3 vViewPos;
    void main(){
      vec3 viewDir = normalize(vViewPos);
      float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
      float pulse = sin(uTime*2.0) * 0.1 + 0.9;
      float alpha = fresnel * 0.3 * pulse;
      if (uDiskEchoActive > 0.5) alpha += uDiskEchoIntensity * 0.18;
      vec3 col = uColor;
      if (uDiskEchoActive > 0.5) col += uColor * uDiskEchoIntensity * 0.4;
      col *= (1.0 + uPulsar * 0.7);
      gl_FragColor = vec4(col, alpha * (0.8 + uPulsar * 0.4));
    }
  `;

  const lensingFragment = `
    uniform vec3 uLensingColor;
    uniform float uDiskEchoActive;
    uniform float uDiskEchoIntensity;
    uniform float uPulsar;
    varying vec3 vNormal; varying vec3 vViewPos;
    void main(){
      vec3 viewDir = normalize(vViewPos);
      float f = pow(1.0-abs(dot(viewDir,vNormal)), 5.2 - uDiskEchoIntensity*1.5);
      float alpha = clamp(f*0.68 + uDiskEchoIntensity*0.35, 0.0, 0.8);
      vec3 col = uLensingColor;
      if(uDiskEchoActive > 0.5) col *= 1.0 + uDiskEchoIntensity*0.6;
      col *= 1.0 + uPulsar * 0.6;
      gl_FragColor = vec4(col, alpha * (0.8 + uPulsar * 0.3));
    }
  `;

  const glowFragment = `
    uniform vec3 uGlowColor;
    uniform float uDiskEchoActive;
    uniform float uDiskEchoIntensity;
    uniform float uPulsar;
    varying vec3 vNormal; varying vec3 vViewPos;
    void main(){
      vec3 viewDir = normalize(vViewPos);
      float i = pow(0.68 - dot(vNormal, viewDir), 2.6 - uDiskEchoIntensity*1.2);
      float a = clamp(i*0.92 + uDiskEchoIntensity*0.2, 0.0, 0.9);
      vec3 col = uGlowColor;
      if (uDiskEchoActive > 0.5) col = mix(col, col * vec3(1.8, 1.2, 1.0), uDiskEchoIntensity);
      col *= 1.0 + uPulsar * 0.82;
      gl_FragColor = vec4(col, a * (0.7 + uPulsar * 0.35));
    }
  `;

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={blackHoleRef} onClick={triggerDiskEcho}>
        <sphereGeometry args={[BLACK_HOLE_EVENT_HORIZON_RADIUS, 64, 32]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>

      <mesh ref={diskRef} rotation={[Math.PI / 2.6, 0, 0]}>
        <ringGeometry args={[DISK_INNER_RADIUS, DISK_OUTER_RADIUS, 128, 64]} />
        <shaderMaterial
          ref={diskMaterialRef}
          uniforms={diskUniforms}
          vertexShader={diskVertexShader}
          fragmentShader={diskFragmentShader}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={photonRef}>
        <sphereGeometry args={[PHOTON_SPHERE_RADIUS, 64, 32]} />
        <shaderMaterial
          ref={photonMaterialRef}
          uniforms={photonUniforms}
          vertexShader={photonVertex}
          fragmentShader={photonFragment}
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={lensingRef} scale={[1.62, 1.62, 1.62]}>
        <sphereGeometry args={[BLACK_HOLE_EVENT_HORIZON_RADIUS + 0.07, 64, 32]} />
        <shaderMaterial
          ref={lensingMaterialRef}
          uniforms={lensingUniforms}
          vertexShader={photonVertex}
          fragmentShader={lensingFragment}
          transparent
          side={THREE.FrontSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh ref={glowRef} scale={[1.07 * 1.16, 1.07 * 1.16, 1.07 * 1.16]}>
        <sphereGeometry args={[BLACK_HOLE_EVENT_HORIZON_RADIUS, 64, 32]} />
        <shaderMaterial
          ref={glowMaterialRef}
          uniforms={glowUniforms}
          vertexShader={photonVertex}
          fragmentShader={glowFragment}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export default BlackHole;
