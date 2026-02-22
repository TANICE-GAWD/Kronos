import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

const BlackHole = () => {
  const mountRef = useRef(null);
  const requestRef = useRef();
  const sceneRef = useRef({
    materials: {},
    clock: new THREE.Clock(),
    params: {
        diskEchoActive: false,
        diskEchoStartTime: 0,
        diskEchoIntensity: 0,
        currentTheme: 'inferno'
    }
  });

  // Configuration Constants
  const BH_CONFIG = {
    EVENT_HORIZON: 1.0,
    DISK_INNER: 1.15,
    DISK_OUTER: 5.5,
    LENSING: 1.07,
    PHOTON_SPHERE: 1.5,
    ECHO_DURATION: 2.8
  };

  const themes = {
    inferno: {
      diskHot: 0xffffff, diskMid: 0xffaa33, diskEdge: 0xcc331a, diskDeep: 0x661a00,
      lensing: 0xffcc66, glow: 0xff8833, photonSphere: 0xffbb44,
      primaryWave: 0xffaa33, secondaryWave: 0xff5500, tertiaryWave: 0xffdd22
    },
    ruby: {
      diskHot: 0xFFE4E1, diskMid: 0xE0115F, diskEdge: 0x8B0000, diskDeep: 0x550000,
      lensing: 0xFF6347, glow: 0xFF4500, photonSphere: 0xFF7F50,
      primaryWave: 0xFF4500, secondaryWave: 0xE0115F, tertiaryWave: 0xFF6347
    },
    plasma: {
      diskHot: 0xffffff, diskMid: 0x66ff66, diskEdge: 0x00cc4d, diskDeep: 0x006626,
      lensing: 0x99ff99, glow: 0x66ff99, photonSphere: 0x88ffaa,
      primaryWave: 0x66ff99, secondaryWave: 0x22ffaa, tertiaryWave: 0xaaffcc
    },
    void: {
      diskHot: 0xffffff, diskMid: 0x87cefa, diskEdge: 0x1e90ff, diskDeep: 0x00008b,
      lensing: 0xb0e0e6, glow: 0xadd8e6, photonSphere: 0x99ccff,
      primaryWave: 0xadd8e6, secondaryWave: 0x1e90ff, tertiaryWave: 0xb0e0e6
    }
  };

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // --- RENDERER SETUP ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000004, 0.085);
    
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.set(0, 5, 8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2.5;
    controls.maxDistance = 100;

    // --- POST PROCESSING ---
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.7, 0.7, 0.75);
    composer.addPass(bloomPass);

    // --- SHADERS & MATERIALS ---
    const theme = themes.inferno;

    const starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDiskEchoActive: { value: 0 }, uDiskEchoIntensity: { value: 0 } },
      vertexShader: `
        attribute float size; attribute float alpha;
        varying vec3 vColor; varying float vAlpha;
        uniform float uDiskEchoActive; uniform float uDiskEchoIntensity;
        void main() {
            vColor = color; vAlpha = alpha;
            vec3 pos = position;
            if (uDiskEchoActive > 0.0) {
                float d = length(position);
                pos *= (1.0 + uDiskEchoIntensity * 0.025 * smoothstep(50.0, 300.0, d));
            }
            vec4 mvp = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (350.0 / -mvp.z) * (1.0 + uDiskEchoIntensity * 0.35);
            gl_Position = projectionMatrix * mvp;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uDiskEchoIntensity;
        varying vec3 vColor; varying float vAlpha;
        void main() {
            float r = length(gl_PointCoord - vec2(0.5));
            if (r > 0.5) discard;
            float twinkle = sin(uTime * (vAlpha * 1.5 + 0.5) + vAlpha * 10.0) * 0.15 + 0.9;
            gl_FragColor = vec4(vColor * twinkle, vAlpha);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true
    });

    const diskMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorHot: { value: new THREE.Color(theme.diskHot) },
        uColorMid: { value: new THREE.Color(theme.diskMid) },
        uColorEdge: { value: new THREE.Color(theme.diskEdge) },
        uColorDeep: { value: new THREE.Color(theme.diskDeep) },
        uCameraPosition: { value: camera.position },
        uRippleActive: { value: 0.0 },
        uRippleStartTime: { value: 0.0 },
        uRippleDuration: { value: 2.8 },
        uPrimaryWaveColor: { value: new THREE.Color(theme.primaryWave) },
        uSecondaryWaveColor: { value: new THREE.Color(theme.secondaryWave) },
        uTertiaryWaveColor: { value: new THREE.Color(theme.tertiaryWave) },
        uRippleMaxRadius: { value: BH_CONFIG.DISK_OUTER },
        uRippleThickness: { value: BH_CONFIG.DISK_OUTER * 0.12 },
        uRippleIntensity: { value: 0.0 },
        uRippleDistortionStrength: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vPosition; varying float vRadius;
        uniform float uRippleDistortionStrength; uniform float uTime;
        void main() {
            vUv = uv; vPosition = position; vRadius = length(position.xy);
            vec3 pos = position;
            if (uRippleDistortionStrength > 0.0) {
                float angle = atan(position.y, position.x);
                pos.z += sin(angle * 10.0 + uTime * 7.0 + vRadius * 2.0) * 0.08 * uRippleDistortionStrength;
            }
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColorHot; uniform vec3 uColorMid; uniform vec3 uColorEdge; uniform vec3 uColorDeep;
        uniform vec3 uCameraPosition; uniform float uRippleActive; uniform float uRippleStartTime; uniform float uRippleIntensity;
        uniform vec3 uPrimaryWaveColor; varying vec3 vPosition; varying float vRadius;
        
        float rand(vec2 n){return fract(sin(dot(n,vec2(12.9898,4.1414)))*43758.5453);}
        float noise(vec2 p){
            vec2 ip=floor(p); vec2 u=fract(p); u=u*u*(3.0-2.0*u);
            return mix(mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
        }

        void main(){
            float dist = vRadius;
            float norm = clamp((dist - ${BH_CONFIG.DISK_INNER}) / (${BH_CONFIG.DISK_OUTER} - ${BH_CONFIG.DISK_INNER}), 0.0, 1.0);
            float angle = atan(vPosition.y, vPosition.x);
            
            // Simplified Accretion Disk Pattern
            float n = noise(vec2(dist * 2.0, angle * 5.0 - uTime * 0.5));
            vec3 color = mix(uColorHot, uColorMid, norm);
            color = mix(color, uColorDeep, smoothstep(0.6, 1.0, norm));
            
            float bloom = (n + 0.5) * (1.0 - norm) * 2.0;
            float ripple = uRippleIntensity * 5.0 * smoothstep(0.1, 0.0, abs(dist - (uRippleIntensity * 5.0)));
            
            gl_FragColor = vec4(color * (bloom + ripple), 1.0 - norm);
        }`,
      transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });

    // --- MESH GENERATION ---
    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 20000;
    const posArr = new Float32Array(starCount * 3);
    const colArr = new Float32Array(starCount * 3);
    for(let i=0; i<starCount; i++) {
        const r = Math.random() * 1000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        posArr[i*3] = r * Math.sin(phi) * Math.cos(theta);
        posArr[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        posArr[i*3+2] = r * Math.cos(phi);
        colArr[i*3] = colArr[i*3+1] = colArr[i*3+2] = 1.0;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(starCount).fill(1.5), 1));
    starGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(starCount).map(() => Math.random()), 1));
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Event Horizon
    const bh = new THREE.Mesh(new THREE.SphereGeometry(BH_CONFIG.EVENT_HORIZON, 64, 32), new THREE.MeshBasicMaterial({color: 0x000000}));
    scene.add(bh);

    // Disk
    const disk = new THREE.Mesh(new THREE.RingGeometry(BH_CONFIG.DISK_INNER, BH_CONFIG.DISK_OUTER, 128, 64), diskMat);
    disk.rotation.x = Math.PI / 2.6;
    scene.add(disk);

    // Reference materials for the update loop
    sceneRef.current.materials = { starMat, diskMat, bloomPass };

    // --- ANIMATION LOOP ---
    const animate = () => {
      const { params, materials, clock } = sceneRef.current;
      const elapsedTime = clock.getElapsedTime();
      
      // Update Uniforms
      materials.starMat.uniforms.uTime.value = elapsedTime;
      materials.diskMat.uniforms.uTime.value = elapsedTime;
      materials.diskMat.uniforms.uCameraPosition.value.copy(camera.position);

      if (params.diskEchoActive) {
        const timeSince = elapsedTime - params.diskEchoStartTime;
        const normTime = timeSince / BH_CONFIG.ECHO_DURATION;
        
        if (normTime >= 1.0) {
            params.diskEchoActive = false;
            materials.diskMat.uniforms.uRippleIntensity.value = 0;
            materials.bloomPass.strength = 0.7;
        } else {
            const intensity = Math.pow(1.0 - normTime, 1.8);
            params.diskEchoIntensity = intensity;
            materials.diskMat.uniforms.uRippleIntensity.value = intensity;
            materials.diskMat.uniforms.uRippleDistortionStrength.value = Math.sin(normTime * Math.PI) * intensity;
            materials.starMat.uniforms.uDiskEchoActive.value = 1.0;
            materials.starMat.uniforms.uDiskEchoIntensity.value = intensity;
        }
      }

      controls.update();
      composer.render();
      requestRef.current = requestAnimationFrame(animate);
    };

    animate();

    // --- RESIZE HANDLER ---
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
      renderer.dispose();
    };
  }, []);

  // --- ACTIONS ---
  const triggerEcho = () => {
    const { params, clock, materials } = sceneRef.current;
    params.diskEchoActive = true;
    params.diskEchoStartTime = clock.getElapsedTime();
    materials.diskMat.uniforms.uRippleActive.value = 1.0;
    materials.diskMat.uniforms.uRippleStartTime.value = params.diskEchoStartTime;
    materials.bloomPass.strength = 1.5;
  };

  const changeTheme = (name) => {
    const { materials } = sceneRef.current;
    const t = themes[name];
    materials.diskMat.uniforms.uColorHot.value.set(t.diskHot);
    materials.diskMat.uniforms.uColorMid.value.set(t.diskMid);
    materials.diskMat.uniforms.uColorEdge.value.set(t.diskEdge);
    materials.diskMat.uniforms.uColorDeep.value.set(t.diskDeep);
    sceneRef.current.params.currentTheme = name;
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* UI Overlay */}
      <div className="ui-panel" style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 10 }}>
        <button onClick={triggerEcho} className="theme-button">Trigger Disk Echo</button>
      </div>

      <div className="ui-panel" style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 10, display: 'flex', gap: '10px' }}>
        {Object.keys(themes).map(t => (
          <button 
            key={t} 
            onClick={() => changeTheme(t)}
            className={`theme-button ${sceneRef.current.params.currentTheme === t ? 'active' : ''}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BlackHole;