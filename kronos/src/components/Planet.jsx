// for me to make a planet controller 
// steps to follow

// >> make texture using useLoader 
// >> make planet object with fields like radius,speed etc 
// >> put texture in MeshBasicMaterial 
// >> put geometry find sphereGeometry...put args
// >> useRef for meshRef


import { useFrame, useLoader } from "@react-three/fiber";
import React, { useRef } from "react";
import { TextureLoader } from "three";

const Planet = ({
    name,
    radius,
    distance,
    speed
}) => {

    const texture = useLoader(
        TextureLoader,
        `/textures/${name.toLowerCase()}.jpg`
    );

    const meshRef = useRef();

    useFrame((state, delta) => {

        const elapsed = state.clock.getElapsedTime();

        
        meshRef.current.rotation.y += delta * 0.8;

        
        const angle = elapsed * speed;

        meshRef.current.position.x =
            distance * Math.cos(angle);

        meshRef.current.position.z =
            distance * Math.sin(angle);

    });

    return(
        <mesh ref={meshRef}>
            <sphereGeometry args={[radius, 32, 32]}/>
            <meshStandardMaterial map={texture}/>
        </mesh>
    );
}

export default Planet;