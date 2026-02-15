import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

import * as three from "three";


const scene = new three.Scene()
const camera = new three.PerspectiveCamera(75, window.innerWidth/window.innerHeight , 0.1 , 1000)

const renderer = new three.WebGLRenderer();

renderer.setSize( window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)



const geometry = new three.BoxGeometry(1,1,1,1)
const material = new three.MeshBasicMaterial({ color : 0x00ff00 });

const cube = new three.Mesh(geometry, material)
scene.add(cube)

camera.position.z = 3;


function animate(){
  cube.rotation.x += 0.1
  cube.rotation.y += 0.1
  renderer.render(scene,camera)

}

renderer.setAnimationLoop(animate);

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )
