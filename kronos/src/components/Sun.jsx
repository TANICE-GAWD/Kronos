// for me to make a Sun controller 
// steps to follow

// >> make texture using useLoader 
// >> make planet object with fields like radius,speed etc 
// >> put texture in MeshBasicMaterial 
// >> put geometry find sphereGeometry...put args
// >> useRef for meshRef
import * as three from "three"
import {useLoader, useFrame} from '@react-three/fiber'
import { TextureLoader } from 'three'
import { useRef } from "react";



const Sun = () => {

    const meshRef = useRef()
    const SunTexture = useLoader(
        TextureLoader, 
            "/textures/sun.jpg"
    )

    useFrame(() => {
        meshRef.current.rotation.y +=0.04
    })


    return(
        <mesh ref={meshRef}>
        <sphereGeometry args = {[1.4,32,32]}/>
        <meshStandardMaterial  map={SunTexture}/>


        </mesh>
    )
};

export default Sun;


