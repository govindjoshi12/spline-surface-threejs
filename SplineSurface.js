import * as THREE from 'three'
import Srand from 'seeded-rand'

class SplineSurface {

    constructor(numSideCps, singlePatchLen, maxHeight, center, seed, segments) {

        numSideCps = Math.max(numSideCps, 4); // Minimum 4 control points
        singlePatchLen = Math.max(singlePatchLen, 1.0); // Minimum 1.0f singlePatchLen length
        maxHeight = Math.max(maxHeight, 1.0); // Min height 1.0f
        segments = Math.max(segments, 1); // At least one segment
        
        this.numSideCps = numSideCps;
        this.sideLength = singlePatchLen * (numSideCps - 1);
        
        this.halfSideLen = this.sideLength / 2.0;
        this.interval = this.sideLength / numSideCps;
        const topLeft = new THREE.Vector3(-1 * this.halfSideLen, 0, this.halfSideLen);
        
        // Control points form a square around the provided origin
        const srand = new Srand(seed);
        const RAND_MAX = Number.MAX_SAFE_INTEGER;
        this.cps = [];
        for(let i = 0; i < this.numSideCps; i++) {
            let row = [];
            let zSub = this.interval * i;
            for(let j = 0; j < this.numSideCps; j++) {
                let xAdd = this.interval * j;
                let rand = srand.intInRange(0, RAND_MAX);
                let y = (rand / RAND_MAX) * maxHeight;
    
                let vec = new THREE.Vector3(topLeft.x + xAdd, y, topLeft.z - zSub);
                vec.add(center);
                
                row.push(vec);
            }
            this.cps.push(row);
        }

        // B-spline matrix
        this.B = new THREE.Matrix4();
        // set takes input in row major order
        this.B.set(
            1, -3, 3, -1,
            4, 0, -6, 3,
            1, 3, 3, -3,
            0, 0, 0, 1
        );
        this.B.multiplyScalar(1.0 / 6.0);
        this.BT = this.B.clone().transpose();

        this.posBuf = [];
        this.norBuf = [];
        let totalQuadrants = Math.pow(numSideCps - 3, 2);
        for(let i = 0; i < totalQuadrants; i++) {
            this.createSurfaceTriangles(i, segments);
        }

        console.log(this.posBuf);
        this.typedPosBuf = new Float32Array(this.posBuf);
        this.typedNorBuf = new Float32Array(this.norBuf);
    }

    getPosBuf() {
        return this.typedPosBuf;
    }

    getNorBuf() {
        return this.typedNorBuf;
    }

    computeVecElem(uVec, vVec, Gi) {
        let vec = uVec.clone();
        
        vec.applyMatrix4(this.B);
        vec.applyMatrix4(Gi);
        vec.applyMatrix4(this.BT);
        let res = vec.dot(vVec);

        return res;
    }

    computePoint(u, v, Gx, Gy, Gz) {
        const uVec = new THREE.Vector4(1, u, u*u, u*u*u);
        const vVec = new THREE.Vector4(1, v, v*v, v*v*v);

        const x = this.computeVecElem(uVec, vVec, Gx);
        const y = this.computeVecElem(uVec, vVec, Gy);
        const z = this.computeVecElem(uVec, vVec, Gz);

        return new THREE.Vector3(x, y, z);
    }

    computeNormal(u, v, Gx, Gy, Gz) {
        const uVec = new THREE.Vector4(1, u, u*u, u*u*u);
        const vVec = new THREE.Vector4(1, v, v*v, v*v*v);
        const uPrime = new THREE.Vector4(0, 1, 2*u, 3*u*u);
        const vPrime = new THREE.Vector4(0, 1, 2*v, 3*v*v);

        const ux = this.computeVecElem(uPrime, vVec, Gx);
        const uy = this.computeVecElem(uPrime, vVec, Gy);
        const uz = this.computeVecElem(uPrime, vVec, Gz);
        let dU = new THREE.Vector3(ux, uy, uz);

        const vx = this.computeVecElem(uVec, vPrime, Gx);
        const vy = this.computeVecElem(uVec, vPrime, Gy);
        const vz = this.computeVecElem(uVec, vPrime, Gz);
        let dV = new THREE.Vector3(vx, vy, vz);

        let result = dU.clone();
        result.cross(dV);
        return result;
    }

    computeAndPushPointAndNormal(u, v, Gx, Gy, Gz) {
        let p = this.computePoint(u, v, Gx, Gy, Gz);
        this.posBuf.push(p.x);
        this.posBuf.push(p.y);
        this.posBuf.push(p.z);

        let n = this.computeNormal(u, v, Gx, Gy, Gz);
        this.norBuf.push(n.x);
        this.norBuf.push(n.y);
        this.norBuf.push(n.z);
    }

    createSurfaceTriangles(quadrant, segments) {
        let firstPointRow = Math.floor(quadrant / (this.numSideCps - 3));
        let firstPointCol = quadrant % (this.numSideCps - 3);

        let Gx = new THREE.Matrix4();
        let Gy = new THREE.Matrix4();
        let Gz = new THREE.Matrix4();

        let GxArr = [];
        let GyArr = [];
        let GzArr = [];

        let p;
        for(let i = firstPointRow; i < firstPointRow + 4; i++) {
            for(let j = firstPointCol; j < firstPointCol + 4; j++) {
                p = this.cps[i][j];
                GxArr.push(p.x);
                GyArr.push(p.y);
                GzArr.push(p.z);
            }
        }

        Gx.set(...GxArr);
        Gy.set(...GyArr);
        Gz.set(...GzArr);

        let delta = 1.0 / segments;
        for(let u = 0; u <= 1 - delta; u += delta) {
            for(let v = 0; v <= 1 - delta; v += delta) {
                let uRight = u + delta;
                let vTop = v + delta;

                // 2 triangles: square
                this.computeAndPushPointAndNormal(u, v, Gx, Gy, Gz);
                this.computeAndPushPointAndNormal(uRight, v, Gx, Gy, Gz);
                this.computeAndPushPointAndNormal(u, vTop, Gx, Gy, Gz);
                

                this.computeAndPushPointAndNormal(uRight, v, Gx, Gy, Gz);
                this.computeAndPushPointAndNormal(uRight, vTop, Gx, Gy, Gz);
                this.computeAndPushPointAndNormal(u, vTop, Gx, Gy, Gz);
            }
        }
    }
}

export default SplineSurface;