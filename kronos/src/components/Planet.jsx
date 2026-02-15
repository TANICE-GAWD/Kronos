// for me to make a planet controller 
// steps to follow

// >> make texture using useLoader 
// >> make planet object with fields like radius,speed etc 
// >> put texture in MeshBasicMaterial 
// >> put geometry find sphereGeometry...put args
// >> useRef for meshRef


import {useFrame, useLoader} from '@react-three/fiber'
import { useRef } from 'react'
import { MeshBasicMaterial, Plane, TextureLoader, TextureUtils } from 'three'


const Planet = ({
    name,
    radius,
    distance,
    speed,
    elasped
}) => {
    const texture = useLoader(
        TextureLoader, `/texture/${name.toLowerCase()}.jpg`
    )
    const meshRef = useRef();
    useFrame((state,delta) => {
        meshRef.current.rotation.y += delta * 0.8
        const angle = elasped * speed
        meshRef.current.position.x = distance * Math.cos(angle)
        meshRef.current.position.y = distance * Math.sin(angle)

    });  

    return(
        <mesh onClick={() => onSelect(name)}
        
        ref = {meshRef}
        position={[distance,0,0]}
        >
            <sphereGeometry args = {[radius,32,32]}/>
            <meshStandardMaterial map = {texture}/>
        </mesh>
        
    )
}

export default Planet;