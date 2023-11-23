import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import SplineSurface from './SplineSurface';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls(camera, renderer.domElement);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// const geometry = new THREE.BoxGeometry( 1, 1, 1 );
// const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// const cube = new THREE.Mesh( geometry, material );
// scene.add( cube );

let interval = 5.0;
let factor = 3;
let numCps = interval * factor;
let patchLen = interval / 2;
let segments = 8;
let maxHeight = 3;
let center = new THREE.Vector3(1, 0, -1);
let seed = 0;

let splineSurface = new SplineSurface(numCps, patchLen, maxHeight, center, seed, segments);
let verts = splineSurface.getPosBuf();
let normals = splineSurface.getNorBuf();

const surface = new THREE.BufferGeometry();
surface.setAttribute('position', new THREE.BufferAttribute(verts, 3));
surface.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
const material = new THREE.MeshNormalMaterial({ color: 0xff0000});
const surfaceMesh = new THREE.Mesh(surface, material);
scene.add(surfaceMesh);

camera.position.y = 3;
camera.position.z = 5;
controls.update();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();