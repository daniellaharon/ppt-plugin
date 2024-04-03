import * as THREE from './three/build/three.module.js'

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _vc = new THREE.Vector3();

/* A class for generating the vertex normals of an object.                    */
/* From addons/vertexNormalHelper.js                                          */
/* Modified a bit though.                                                     */
class VertexNormals extends THREE.LineSegments {

	constructor( object, size = 1, color = 0xff0000 ) {

		const geometry = new THREE.BufferGeometry();

		const nNormals = object.geometry.attributes.normal.count;
		const positions = new THREE.Float32BufferAttribute( nNormals * 2 * 3, 3 );

		geometry.setAttribute( 'position', positions );

		super( geometry, new THREE.LineBasicMaterial( { color, toneMapped: false } ) );

		this.object = object;
		this.size = size;
		this.type = 'VertexNormalsHelper';
		this.matrixAutoUpdate = false;
		this.update();
	}

	update() {
		const position = this.geometry.attributes.position;
		const objGeometry = this.object.geometry;
		if (objGeometry) {
			const objPos = objGeometry.attributes.position;
			const objNorm = objGeometry.attributes.normal;

			let idx = 0;
			// for simplicity, ignore index and drawcalls, and render every normal
			for ( let j = 0, jl = objPos.count; j < jl; j ++ ) {
				_v1.fromBufferAttribute( objPos, j );
				_v2.fromBufferAttribute( objNorm, j );
				_v2.normalize().multiplyScalar( this.size ).add( _v1 );
				position.setXYZ( idx, _v1.x, _v1.y, _v1.z );
				idx = idx + 1;
				position.setXYZ( idx, _v2.x, _v2.y, _v2.z );
				idx = idx + 1;
			}
		}
		position.needsUpdate = true;
	}
	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}


class SurfaceNormals extends THREE.LineSegments {

	constructor( object, size = 1, color = 0xff0000 ) {

		const geometry = new THREE.BufferGeometry();

        /* Number of faces is number of vertices / 3 (ASSUMING TRIANGULAR)    */
		const nFaces = object.geometry.attributes.position.count / 3;
		const positions = new THREE.Float32BufferAttribute( nFaces * 2 * 3, 3 );

		geometry.setAttribute( 'position', positions );

		super( geometry, new THREE.LineBasicMaterial( { color, toneMapped: false } ) );

		this.object = object;
		this.size = size;
		this.type = 'SurfaceNormalsHelper';
		this.matrixAutoUpdate = false;
		this.update();
	}

	update() {
		const position = this.geometry.attributes.position;
		const objGeometry = this.object.geometry;
		if (objGeometry) {
			const objPos = objGeometry.attributes.position;
            const Index = objGeometry.inedx;
			let idx = 0;

            if (!Index) {
                for ( let j = 0, jl = objPos.count; j < jl; j += 3 ) {
                    _v1.fromBufferAttribute( objPos, j + 0 );
                    _v2.fromBufferAttribute( objPos, j + 1 );
                    _v3.fromBufferAttribute( objPos, j + 2 );
                    
                    _v4.subVectors(_v3, _v2);
                    _v5.subVectors(_v1, _v2);
                    _v6.crossVectors(_v4, _v5);

                    _vc.addVectors(_v1, _v2);
                    _vc.add(_v3);
                    _vc.multiplyScalar(1 / 3.0);

                    _v6.normalize().multiplyScalar( this.size ).add( _vc );

                    position.setXYZ( idx, _vc.x, _vc.y, _vc.z );
                    idx = idx + 1;
                    position.setXYZ( idx, _v6.x, _v6.y, _v6.z );
                    idx = idx + 1;
                }
            } else {
                for ( let j = 0, jl = Index.count; j < jl; j += 3 ) {
                    const I1 = Index.getX(i + 0);
                    const I2 = Index.getX(i + 1);
                    const I3 = Index.getX(i + 2);

                    _v1.fromBufferAttribute( objPos, I1 );
                    _v2.fromBufferAttribute( objPos, I2 );
                    _v3.fromBufferAttribute( objPos, I3 );
                    
                    _v4.subVectors(_v3, _v2);
                    _v5.subVectors(_v1, _v2);
                    _v6.crossVectors(_v4, _v5);

                    _vc.addVectors(_v1, _v2);
                    _vc.add(_v3);
                    _vc.multiplyScalar(1 / 3.0);

                    _v6.normalize().multiplyScalar( this.size ).add( _vc );

                    position.setXYZ( idx, _vc.x, _vc.y, _vc.z );
                    idx = idx + 1;
                    position.setXYZ( idx, _v6.x, _v6.y, _v6.z );
                    idx = idx + 1;
                }


            }
		}
		position.needsUpdate = true;
	}

	dispose() {
		this.geometry.dispose();
		this.material.dispose();
	}
}

/* Traverse the object and count the number of faces and vertices.            */
function countFacesAndVertices(Obj)
{
    let Ret = {Faces: 0, Vertices: 0};

    Obj.traverse((Child) => {
        if (Child.geometry) {
            let Index = Child.geometry.getIndex();
            let NumVerts;
            
            if (!Index)
                NumVerts = Child.geometry.getAttribute('position').count;
            else
                NumVerts = Index.count;

            Ret.Vertices += NumVerts;
            Ret.Faces += NumVerts / 3;
        }
    });
    
    return Ret;
}

export {
    VertexNormals,
    SurfaceNormals,
    countFacesAndVertices,
}
