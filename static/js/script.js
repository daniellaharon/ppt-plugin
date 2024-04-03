import * as THREE from './three/build/three.module.js';
import { OrbitControls } from './three/build/OrbitControls.js';
import { OBJLoader } from './three/build/OBJLoader.js';
import { OBJExporter} from './three/build/OBJExporter.js';
import { FBXLoader } from './three/build/FBXLoader.js';
import { GLTFLoader } from './three/build/GLTFLoader.js';
import { GLTFExporter} from './three/build/GLTFExporter.js';
import { MTLLoader } from './three/build/MTLLoader.js';
import { STLLoader } from './three/build/STLLoader.js';
import { STLExporter} from './three/build/STLExporter.js';
import { GUI } from './three/build/dat.gui.module.js';
import { TransformControls } from './three/build/TransformControls.js'
import { SurfaceNormals, countFacesAndVertices, VertexNormals } from './meshInfo.js';

const SupportedFileTypes = ['.obj','.stl','.glb','.fbx'];
const SupportedFileTypesExports = ['.obj','.stl','.glb'];
const FileLoaders = {
        '.obj' : OBJLoadFile,
        '.glb' : GLTFLoadFile,
        '.stl' : STLLoadFile,
        '.fbx' : FBXLoadFile
    };

const FileExporters = {
        '.obj' : new OBJExporter(),
        '.glb' : new GLTFExporter(),
        '.stl' : new STLExporter(),
    };

const EnvironmentHelpers = ['Plane','Axes','Grid','Vertex Normals' 
                            ,'Surface Normals', 'PlaneHelper', 
                            'objectGroup', 'poGroup', 'StencilGroup'];

var Scene, ClippingScene, Renderer,
	Camera, PerspectiveCamera, OrthographicCamera,
    CameraControls, HighlightedObject, PickedObject, PickedGroup,
    Transform, RayCaster, ClippingWindowEnabled;

let planes, planeObjects = [], planeHelpers, object, CompositeWireFrames = [];

var CameraParams = {
    FOV: 45,
    FrustumSize: 10,
    AspectRatio: window.innerWidth / window.innerHeight,
    Near: 0.1,
    Far: 1000,
    OrthoNear: -500,
    OrthoFar: 500
};

var RendererParams = {
    antialias: true,
    precision: 'mediump'
};

const PlaneParams = {

    planeX: {
        name: 'Plane',
        constant: 0,
        negated: false,
        displayHelper: false,
        enabled: true

    },
    planeY: {
        name: 'Plane',
        constant: 0,
        negated: false,
        displayHelper: false,
        enabled: true

    },
    planeZ: {
        name: 'Plane',
        constant: 0,
        negated: false,
        displayHelper: false,
        enabled: true

    },

    customPlane: {
        name: 'Plane',
        constant: 0,
        negated: false,
        displayHelper: false,
        normalX: -1,
        normalY: 0,
        normalZ: 0,
        enabled: true
    },

    clippingPlanesGUI:{
        PlaneSize:10
    }


};

Init();
Render();

/* Set the settings for both cameras.                                         */
function OnWindowResize()
{
    CameraParams.AspectRatio = window.innerWidth / window.innerHeight;
	OrthographicCamera.left = CameraParams.FrustumSize *
                                CameraParams.AspectRatio / -2;
	OrthographicCamera.right = CameraParams.FrustumSize *
                                CameraParams.AspectRatio / 2;
	OrthographicCamera.top = CameraParams.FrustumSize / 2;
    OrthographicCamera.bottom = -CameraParams.FrustumSize / 2;
	OrthographicCamera.updateProjectionMatrix();

	PerspectiveCamera.aspect = CameraParams.AspectRatio;
	PerspectiveCamera.updateProjectionMatrix();
	Renderer.setSize(window.innerWidth, window.innerHeight);
}

function OnClick(event)
{
    /* Don't do anything if we're transforming the camera.                    */
    if (CameraControls.dragging)
        return;
    /* Deselect if there's a double click on the right button.                */
    if (event.detail == 2 && event.which == 3) {
        Transform.detach();
        PickedObject = null;
        Faces.setValue(0);
        Vertices.setValue(0);
        return;
    }


    /* Select the highlihgted object if we're not transforming.               */
    if (HighlightedObject && !Transform.dragging) {
        if (HighlightedObject.type == 'PlaneHelper' ||HighlightedObject.type == 'Group' )
            return;
        PickedObject = HighlightedObject;
        Faces.setValue(PickedObject.userData.NumFaces);
        Vertices.setValue(PickedObject.userData.NumVertices);
        /* Reset the colour right after click.                                */
        HighlightedObject.traverseVisible((Obj) => {
            if (Obj.material && Obj.userData.PrevColor)
                Obj.material.color.setHex(Obj.userData.PrevColor);
        });
        Transform.attach(PickedObject);
        console.log(PickedObject);
    }

}

function OnHover(event)
{
 	event.preventDefault();
    const Mouse = new THREE.Vector2();

    Mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	Mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
 
 	RayCaster.setFromCamera(Mouse, Camera);
    RayCaster.layers.set(0);
 	const Intersects = RayCaster.intersectObjects(Scene.children);

    /* Return previous highlighted object to its original color.              */
    if (HighlightedObject) {
        HighlightedObject.traverseVisible((Obj) => {
            if (Obj.material)
                Obj.material.color.setHex(Obj.userData.PrevColor);
        });
        HighlightedObject = null;
    }

    /* Find the closest object if any.                                        */
    let Min = Infinity;
    Intersects.forEach((Elem) => {
        const Obj = Elem.object;

        if (Obj.name == 'Plane' || Obj.name == 'Axes')
            return;
        if (Transform.getObjectById(Obj.id))
            return;

        if (Obj instanceof THREE.Mesh) {
            if (Elem.distance < Min) {
                HighlightedObject = Obj;
                Min = Elem.distance;
            }
        }
    });

    /* Ignore if no intersections.                                            */
    if (!HighlightedObject)
        return;

    /* Climb all the way to the oldest ancestor right after the scene.        */
    while (HighlightedObject.parent != Scene) {
        HighlightedObject = HighlightedObject.parent;
    }

    /* Retrieve all the previous colors.                                      */
    HighlightedObject.traverseVisible((Obj) => {
        if (Obj.material)
            Obj.userData.PrevColor = Obj.material.color.getHex();
    });

    /* If we're the picked object then ignore.                                */
    if (PickedObject == HighlightedObject)
        return;

    /* Colour red to indicate to the user.                                    */
    HighlightedObject.traverseVisible((Obj) => {
        if (Obj.material)
            Obj.material.color.offsetHSL(0, 0, -0.1);
    });


}

function OnKeydown(event)
{
    switch (event.code) {
        case 'KeyG':
            Transform.setMode('translate')
            break;
        case 'KeyR':
            Transform.setMode('rotate')
            break;
        case 'KeyS':
            Transform.setMode('scale')
            break;
        case 'Delete':
        case 'KeyX':
            if (PickedObject) {
                Transform.detach();
                Scene.remove(PickedObject);
                PickedObject = null;
                Faces.setValue(0);
                Vertices.setValue(0);
                clearClippingScene();
                clearCompositeMode();
            }
            break;
        case 'KeyI':
            let Info = document.getElementById('InfoBox');
            Info.style.display = 'block';
            break;
        case 'KeyO':
            if(PickedObject){
                PickedObject.position.set(0, 0, 0);
                PickedObject.rotation.set(0, 0, 0);
            }
            break;
    }
}

// Set up clip plane rendering
function SetupClipping(pGeometry){
    object = new THREE.Group();
    object.name = 'objectGroup';

    planeObjects = [];
    const planeGeom = new THREE.PlaneGeometry( 200,  200 );

    for ( let i = 0; i < 4; i ++ ) {

        const poGroup = new THREE.Group();
        poGroup.name = 'poGroup';
        const plane = planes[ i ];

        // plane is clipped by the other clipping planes
        const planeMat =
            new THREE.MeshStandardMaterial( {
                color: 0xE91E63,
                clippingPlanes: planes.filter( p => p !== plane ),

                stencilWrite: true,
                stencilRef: 0,
                stencilFunc: THREE.NotEqualStencilFunc,
                stencilFail: THREE.ReplaceStencilOp,
                stencilZFail: THREE.ReplaceStencilOp,
                stencilZPass: THREE.ReplaceStencilOp,

            } );
        
        const po = new THREE.Mesh( planeGeom, planeMat );
        po.onAfterRender = function ( Renderer ) {

            Renderer.clearStencil();

        };

        po.renderOrder = i + 1.1;
        planeObjects.push( po );

    }
    planeObjects[0].lookAt(planes[0].normal);
    planeObjects[1].lookAt(planes[1].normal);
    planeObjects[2].lookAt(planes[2].normal);
    planeObjects[3].lookAt(planes[3].normal);
 
}


function Init()
{
    /* Create a new renderer, enable shadow maps. */
	Renderer = new THREE.WebGLRenderer(RendererParams);
	Renderer.shadowMap.enabled = true;
	Renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    Renderer.setClearColor(0x263238);
	Renderer.setSize(window.innerWidth, window.innerHeight);
    Renderer.localClippingEnabled = false;
	document.body.appendChild(Renderer.domElement);

    /* Create the scene, set default background to grey. */
	Scene = new THREE.Scene();
    ClippingScene = new THREE.Scene();
	Scene.background = new THREE.Color(0x263238);
	ClippingScene.background = new THREE.Color(0x666666);
    ClippingWindowEnabled = false;

    /* Setup both cameras using the window's size.*/
    CameraParams.AspectRatio = window.innerWidth / window.innerHeight;
	PerspectiveCamera = new THREE.PerspectiveCamera(
        CameraParams.FOV,
        CameraParams.AspectRatio,
        CameraParams.Near, CameraParams.Far); 
	PerspectiveCamera.position.set(10, 10, 10);
	PerspectiveCamera.lookAt(0, 0, 0);
    PerspectiveCamera.layers.enable(1);

	OrthographicCamera = new THREE.OrthographicCamera(
        CameraParams.FrustumSize * CameraParams.AspectRatio / -2,
		CameraParams.FrustumSize * CameraParams.AspectRatio / 2,
		CameraParams.FrustumSize / 2, -CameraParams.FrustumSize / 2,
		CameraParams.OrthoNear,
        CameraParams.OrthoFar);
	OrthographicCamera.position.set(0, 0, 10000);
	OrthographicCamera.lookAt(0, 0, 0);
    OrthographicCamera.layers.enable(1);

	Camera = PerspectiveCamera;
    LoadStartScene();
    planes = [
        new THREE.Plane( new THREE.Vector3( - 1, 0, 0 ), 0 ),
        new THREE.Plane( new THREE.Vector3( 0, - 1, 0 ), 0 ),
        new THREE.Plane( new THREE.Vector3( 0, 0, - 1 ), 0 ),
        new THREE.Plane( new THREE.Vector3( -1 , 0 , 0 ), 0 )
    ];
    

    planeHelpers = planes.map( p => new THREE.PlaneHelper( p, 10, 0xffff00 ) );
    planeHelpers.forEach( ph => {
        ph.name = 'Plane';
        ph.visible = false;
        ph.children[0].name = 'Plane';
        Scene.add( ph );
    } );

	CameraControls = new OrbitControls(Camera, Renderer.domElement);
    Transform = new TransformControls(Camera, Renderer.domElement);
    Transform.name = 'Transform';
    Scene.add(Transform);

    Transform.addEventListener( 'dragging-changed', function ( e ) {
        CameraControls.enabled = ! e.value;
        
    } );

    window.addEventListener('keydown', OnKeydown);
	window.addEventListener('resize', OnWindowResize, false);
    window.addEventListener('mousemove', OnHover);
    window.addEventListener('mousedown', OnClick);

    /* Prevent browser from processing file. */
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    /* Handle the dropped file. */
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        ImportFiles(e.dataTransfer.files);
    });
    RayCaster = new THREE.Raycaster();

    let Info = document.getElementById('InfoBox');
    Info.addEventListener('click', () => {
        Info.style.display = 'none';
    });
}

/* Load the initial empty scene.                                              */
function LoadStartScene()
{
    /* Create a directional light with support for shadows.                   */
	var Light = new THREE.DirectionalLight(0xffffff);
    Light.name = 'Directional Light';
	Light.position.set(1.0, 1.0, 1.0); 
	Light.castShadow = true; 
    Light.shadow.mapSize.width = 4096; // default
    Light.shadow.mapSize.height = 4096; // default
    Light.shadow.camera.top = 50; // default
    Light.shadow.camera.bottom = -50; // default
    Light.shadow.camera.left = -50; // default
    Light.shadow.camera.right = 50; // default
    Light.shadow.camera.near = -5000; // default
    Light.shadow.camera.far = 5000; // default
    Scene.add(Light);

	var Ambientlight = new THREE.AmbientLight(0x888888);
    Ambientlight.name = 'Ambient Light';

    Scene.add(Light);
	Scene.add(Ambientlight);

    /* Setup the ground plane.                                                */
	var PlaneGeometry = new THREE.PlaneGeometry(70,70, 1, 1);
	var PlaneMaterial = new THREE.ShadowMaterial( 
		{ color: 0x111111,
          opacity: 0.25,
          side: THREE.DoubleSide
        });

	var Plane = new THREE.Mesh(PlaneGeometry, PlaneMaterial);
    Plane.name = 'Plane';
	Plane.position.set(0, -10, 0);
	Plane.rotation.set(DegreesToRadians(90),
                       DegreesToRadians(0),
                       DegreesToRadians(0)); 
	Plane.receiveShadow = true;
	Scene.add(Plane);

    const helper = new THREE.GridHelper( 3000, 40, 0x666666, 0x666666 );
    helper.position.y = -10;
    helper.name = 'Grid';
    Scene.add( helper );

    /* Add the axis indicator.                                                */
	var AxesHelper = new THREE.AxesHelper(1000);
    AxesHelper.name = 'Axes';
	AxesHelper.position.set(0, 0, 0);
	Scene.add(AxesHelper);
}

function Render()
{
	requestAnimationFrame(Render);

    var miniWidth = window.innerWidth - Math.floor(window.innerWidth * 0.7);
    var miniHeight = Math.floor(window.innerHeight * 0.4);

    // Left viewport
    Renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    Renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    Renderer.setScissorTest(true);
    Renderer.autoClear = false;
    Renderer.render(Scene, Camera);

    // Right viewport
    if(ClippingWindowEnabled){
        Renderer.setViewport(0, window.innerHeight-miniHeight, miniWidth, miniHeight);
        Renderer.setScissor(0, window.innerHeight-miniHeight, miniWidth, miniHeight);
        Renderer.setScissorTest(true);
        Renderer.autoClear = true;
        Renderer.render(ClippingScene, Camera);
    }
}

function ImportFiles(Files)
{
    document.body.style.cursor = "wait";
    var AsArray = new Array();
    var MTL = undefined;

    for (var i = 0; i < Files.length; i++)
        AsArray.push(Files[i]);

    AsArray.forEach((File) => {
        var Extension = '.' + File.name.split('.').pop();
        var Name = File.name.split('.')[0];

        /* Completely ignore mtl, we'll search for it if obj exists.          */
        if (Extension === '.mtl')
            return;

        /* Search for mtl with matching name.                                 */
        if (Extension === '.obj') {
            MTL = AsArray.find((F) => {
                return F.name === Name + '.mtl';
            });
        }

        if (SupportedFileTypes.includes(Extension)){
            FileLoaders[Extension](File, MTL);

        }
        else
            console.log(`Warning: File ${File.name} is not supported.`);
    });
}


function ExportScene(Type)
{
    let Exporter = FileExporters[Type];
    let ToDelete = [];

    /* We can't filter out stuff other than like this.                        */
    Scene.children.forEach((Child) => {
        if (EnvironmentHelpers.includes(Child.name)) 
            ToDelete.push(Child);
    });

    /* OOOF yeah mutate the ACTIVE scene....                                  */
    ToDelete.forEach((V) => {
        Scene.remove(V);
    })
   
    if (Type != '.glb') {
        const Data = Exporter.parse(Scene);
        download('Exported' + Type, Data);
    } else {
        Exporter.parse(Scene, (gltf) => {
            downloadJson('Exported' + Type, gltf);
        },
        (E) => {
            console.log(`Error: Encountered ${E} while exporting.`);
        });
    }

    /* Put it all back (somehow works?)                                       */
    ToDelete.forEach((V) => {
        Scene.add(V);
    });

    /* Exporting and importing back wont give the same result.                */
    /* This is because we recentre right after importing.                     */
}

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function downloadJson(filename, Obj) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(Obj)));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

/*======================================== Start Of GUI Section ======================================*/
var Controller = new function ()
{
	this.BgColor = '#263238';
	this.OrthographicCamera = false;
	this.Wireframe = false;
    this.CompositeMode = false;
    this.ClippingEnabled = false;
    this.ClippingWindow = false;
    this.AxesHelpers = true;
	this.Faces = 0;
	this.Vertices = 0;
    this.ShowSNormals = false;
    this.ShowVNormals = false;
    this.VNormalSize = 1.0;
    this.SNormalSize = 1.0;
    this.ColorSNormals = '#0000ff';
    this.ColorVNormals = '#00ff00';
    this.ExportType = '.obj';

	this.Upload = function () {
		const InputFile = document.createElement( 'input' );
		InputFile.type = 'file';
        InputFile.multiple = true;
		InputFile.addEventListener('change', () => {
            ImportFiles(InputFile.files);
		});
		InputFile.click();
		
	};

    this.Download = function() {
        ExportScene(this.ExportType);
    }

	this.Projection = "Perspective";
	this.SwitchCamera = function ()
    {
		if (Camera instanceof THREE.PerspectiveCamera) {
			OrthographicCamera.position.copy(PerspectiveCamera.position);
			OrthographicCamera.rotation.copy(PerspectiveCamera.rotation);
			OrthographicCamera.quaternion.copy(PerspectiveCamera.quaternion);
			Camera = OrthographicCamera;
			this.Projection = "Orthographic";
		} else {
			PerspectiveCamera.position.copy(OrthographicCamera.position);
			PerspectiveCamera.rotation.copy(OrthographicCamera.rotation);
			PerspectiveCamera.quaternion.copy(OrthographicCamera.quaternion);
			Camera = PerspectiveCamera;
			this.Projection = "Perspective";
		}
		Camera.updateProjectionMatrix();
		CameraControls.dispose();
		CameraControls = new OrbitControls(Camera, Renderer.domElement);
        Transform.camera = Camera;
	};
}

var gui = new GUI();

gui.add(Controller, 'Upload').name('Import');
gui.add(Controller, 'Download').name('Export');
gui.add(Controller, 'ExportType', SupportedFileTypesExports).name('Export Type');


gui.addColor(Controller, 'BgColor').onChange(function (e) {
	Scene.background = new THREE.Color(e);
});
gui.add(Controller, 'SwitchCamera');
var cameraSwitchButton = gui.add(Controller, 'Projection').listen();
cameraSwitchButton.onChange(function (value) {
	switchCamera(value);
});

let WireFrameController = gui.add(Controller, 'Wireframe').onChange(function (e) {
	SetWireframe(e)
});

let CompositeModeController = gui.add(Controller, 'CompositeMode').onChange(function(e) {
    SetCompositeMeshColor(e);
});

gui.add(Controller, 'AxesHelpers').name('Show Axes Helpers').onChange(function (e) {
	Scene.children.forEach((Child) => {
        if (Child.name == 'Axes')
            Child.visible = e;
    });
});


const modelInfo = gui.addFolder( 'Model Info' );
var Faces = modelInfo.add(Controller, 'Faces',0).name('Faces');
var Vertices = modelInfo.add(Controller, 'Vertices',0).name('Vertices');
modelInfo.add(Controller, 'ShowSNormals', false).name('Show S-Normals').onChange((e) => {
    if (PickedObject)  {
        PickedObject.traverse((Child) => {
            if (Child.name == 'Surface Normals')
                Child.visible = e;
        });
    }

});
modelInfo.add(Controller, 'SNormalSize', 0.0, 10, 0.001).name('S-Normals size').onChange((v) => {
    if (PickedObject) {
        deleteAllMatchingNames(PickedObject, 'Surface Normals');
        addNormalGeometry(PickedObject, v, Controller.ShowSNormals, 'Surface Normals');
    }
});
modelInfo.addColor(Controller, 'ColorSNormals').onChange(function (e) {
	if (PickedObject)  {
        PickedObject.traverse((Child) => {
            if (Child.name == 'Surface Normals' && Child.visible)
                Child.material.color = new THREE.Color(e);
        });
    }
});


modelInfo.add(Controller, 'ShowVNormals', false).name('Show V-Normals').onChange((e) => {
    if (PickedObject)  {
        PickedObject.traverse((Child) => {
            if (Child.name == 'Vertex Normals')
                Child.visible = e;
        });
    }
});
modelInfo.add(Controller, 'VNormalSize', 0.0, 10, 0.001).name('V-Normals size').onChange((v) => {
    if (PickedObject) {
        deleteAllMatchingNames(PickedObject, 'Vertex Normals');
        addNormalGeometry(PickedObject, v, Controller.ShowVNormals, 'Vertex Normals');
    }
});

modelInfo.addColor(Controller, 'ColorVNormals').onChange(function (e) {
	if (PickedObject)  {
        PickedObject.traverse((Child) => {
            if (Child.name == 'Vertex Normals' && Child.visible)
                Child.material.color = new THREE.Color(e);
        });
    }
});

modelInfo.open();
const clippingPlanesGUI = gui.addFolder( 'Clipping Planes' );
clippingPlanesGUI.open();
clippingPlanesGUI.add( PlaneParams.clippingPlanesGUI, 'PlaneSize' ).name('Plane Size').min( 0 ).max( 100 ).step(0.01).onChange( d => planeHelpers.forEach( 
    ph => {
        ph.size = d;
        } ));

clippingPlanesGUI.add(Controller, 'ClippingEnabled').onChange(function (e) {
    SetLocalClipping(e);
    clearClippingScene();
    if(e)
        updateClipping();
});



clippingPlanesGUI.add(Controller, 'ClippingWindow').name('New Window').onChange(function (e) {
    clearClippingScene();
    if(e)
        updateClipping();
    console.log(ClippingScene);
    ClippingWindowEnabled = e;
});

const customPlane = clippingPlanesGUI.addFolder( 'customPlane' );
customPlane.add( PlaneParams.customPlane, 'displayHelper' ).onChange( v => planeHelpers[ 3 ].visible = v );
customPlane.add( PlaneParams.customPlane, 'constant' ).min( - 1.0 ).max( 1.0 ).step(0.01).onChange( function (d) {
    planes[ 3 ].constant = d*50 ;
    console.log(planes[3]);
    console.log(planeHelpers[3]);
    updateClipping();
    });

customPlane.add( PlaneParams.customPlane, 'negated' ).onChange( () => {
    planes[ 3 ].negate();
    updateClipping();
    PlaneParams.customPlane.constant = planes[ 3 ].constant;
    } );

customPlane.add( PlaneParams.customPlane, 'normalX' ).min( - 1.0 ).max( 1.0 ).step(0.01).name('X Normal').onChange( function (d) {
    planes[ 3 ].setComponents(d, planes[ 3 ].normal.y, planes[ 3 ].normal.z, planes[3].constant);
    updateClipping();
    });

customPlane.add( PlaneParams.customPlane, 'normalY' ).min( - 1.0 ).max( 1.0 ).step(0.01).name('Y Normal').onChange( function (d) {
    planes[ 3 ].setComponents(planes[ 3 ].normal.x, d, planes[ 3 ].normal.z, planes[3].constant);
    updateClipping();
    });

customPlane.add( PlaneParams.customPlane, 'normalZ' ).min( - 1.0 ).max( 1.0 ).step(0.01).name('Z Normal').onChange( function (d) {
    planes[ 3 ].setComponents(planes[ 3 ].normal.x, planes[ 3 ].normal.y, d, planes[3].constant);
    updateClipping();
    });

customPlane.add( PlaneParams.customPlane, 'enabled' ).name('Enabled').onChange( (e) => {
    toggleClippingPlane(e, planes[3]);
    updateClipping();
});   

customPlane.open();



const planeX = clippingPlanesGUI.addFolder( 'planeX' );
planeX.add( PlaneParams.planeX, 'displayHelper' ).onChange( v => planeHelpers[ 0 ].visible = v );
planeX.add( PlaneParams.planeX, 'constant' ).min( - 1.0 ).max( 1.0 ).step(0.01).onChange( function (d) {
    planes[ 0 ].constant = d*50 ;
    updateClipping();
    });

planeX.add( PlaneParams.planeX, 'negated' ).onChange( () => {
    planes[ 0 ].negate();
    updateClipping();
} );


planeX.add( PlaneParams.planeX, 'enabled' ).name('Enabled').onChange( (e) => {
    toggleClippingPlane(e, planes[0]);
    updateClipping();
});   


planeX.open();

const planeY = clippingPlanesGUI.addFolder( 'planeY' );
planeY.add( PlaneParams.planeY, 'displayHelper' ).onChange( v => planeHelpers[ 1 ].visible = v );
planeY.add( PlaneParams.planeY, 'constant' ).min( - 1.0 ).max( 1.0 ).step(0.01).onChange( function (d) {
    planes[ 1 ].constant = d*50 ;
    updateClipping();
    });
planeY.add( PlaneParams.planeY, 'negated' ).onChange( () => {
    planes[ 1 ].negate();
    updateClipping();
});

planeY.add( PlaneParams.planeY, 'enabled' ).name('Enabled').onChange( (e) => {
    toggleClippingPlane(e, planes[1]);
    updateClipping();
});   

planeY.open();

const planeZ = clippingPlanesGUI.addFolder( 'planeZ' );
planeZ.add( PlaneParams.planeZ, 'displayHelper' ).onChange( v => planeHelpers[ 2 ].visible = v );
planeZ.add( PlaneParams.planeZ, 'constant' ).min( - 1.0 ).max( 1.0 ).step(0.01).onChange( function (d) {
    planes[ 2 ].constant = d*50 ;
    updateClipping();
    });

planeZ.add( PlaneParams.planeZ, 'negated' ).onChange( () => {
    planes[ 2 ].negate();
    updateClipping();
    PlaneParams.planeZ.constant = planes[ 2 ].constant;

});

planeZ.add( PlaneParams.planeZ, 'enabled' ).name('Enabled').onChange( (e) => {
    toggleClippingPlane(e, planes[2]);
    updateClipping();
});     

planeZ.open();



/* END GUI ================================================================== */

/* FILE LOADERS ============================================================= */
function OBJLoadFile(InputFile, MtlFile = undefined)
{
    console.log("Loading OBJ File...");
    var startTime = performance.now();
    var ObjPath = URL.createObjectURL(InputFile);
    var ObjLoader = new OBJLoader();
    var MtlPath, MtlLoader;
    
    let Load = function() {
        ObjLoader.load(ObjPath, function (Loaded) {
            var Model = Loaded.clone();
            /* Adjust the objects to make them render properly. */
            Model.traverse(function (Child) {
                if (Child instanceof THREE.Mesh) {
                    Child.material.wireframe = false;
                    Child.castShadow = true;
                    if (Child.material) {
                        Child.material.side = THREE.DoubleSide;
                        Child.material.clippingPlanes = planes;
                        Child.material.clipShadows = true;
                    
                    }
                }
            });

            var Obj = new THREE.Object3D();
            Obj.name = InputFile.name;
            Obj.add(Model);
            Obj.castShadow = true;
            Scene.add(Obj);
            Resize(Obj);
            
            let Count = countFacesAndVertices(Obj);
            Obj.userData.NumFaces = Count.Faces;
            Obj.userData.NumVertices = Count.Vertices;
            addNormalGeometry(Obj, 1, false, 'Surface Normals');
            addNormalGeometry(Obj, 1, false, 'Vertex Normals');

            var endTime = performance.now();
            console.log("Load time = " + (endTime - startTime) + " milli");
            document.body.style.cursor = "default";
            Faces.setValue(Obj.userData.NumFaces);
            Vertices.setValue(Obj.userData.NumVertices);        
        });
    }

    if (MtlFile) {
       MtlPath = URL.createObjectURL(MtlFile);
       MtlLoader = new MTLLoader();
    }

    if (MtlLoader) {
        MtlLoader.load(MtlPath, (Materials) => {
            Materials.preload();
            ObjLoader.setMaterials(Materials);
            Load();
        });
    } else
        Load();
}

function GLTFLoadFile(InputFile, Placeholder = undefined)
{
    console.log("Loading GLTF File...");
    var startTime = performance.now();
    var Path = URL.createObjectURL(InputFile);
    var Loader = new GLTFLoader();

    Loader.load(Path, function (Loaded) {
        /* Adjust the objects to make them render properly.*/
        Loaded.scene.traverse((Obj) => {
            if (Obj instanceof THREE.Mesh && Obj.material) {
                Obj.castShadow = true;
                if (Obj.material) {
                    Obj.material.clippingPlanes = planes;
                    Obj.material.clipShadows = true;
                    Obj.material.wireframe = false;
                    Obj.material.side = THREE.DoubleSide;
                }
            }
 
        let Count = countFacesAndVertices(Obj);
        Obj.userData.NumFaces = Count.Faces;
        Obj.userData.NumVertices = Count.Vertices;
        addNormalGeometry(Obj, 1, false, 'Surface Normals');
        addNormalGeometry(Obj, 1, false, 'Vertex Normals');

        Faces.setValue(Obj.userData.NumFaces);
        Vertices.setValue(Obj.userData.NumVertices);    

        });
        console.log(Loaded.scene);
        Scene.add(Loaded.scene);
        Resize(Loaded.scene);



        var endTime = performance.now();
        console.log("Load time = " + (endTime - startTime) + " milli");
        document.body.style.cursor = "default";
    });
}

function STLLoadFile(InputFile, Placeholder = undefined)
{
    console.log("Loading STL File...");
    var startTime = performance.now();
    var Path = URL.createObjectURL(InputFile);
    var Loader = new STLLoader();

    Loader.load(Path, function (Loaded) {
        const Mesh = new THREE.Mesh(Loaded, new THREE.MeshPhongMaterial());

        Mesh.castShadow = true;
        Mesh.material.side = THREE.DoubleSide;

        var Obj = new THREE.Object3D();
        Obj.name = InputFile.name;
        Obj.add(Mesh);
        Obj.castShadow = true;
        Scene.add(Obj);
        Resize(Obj);

        let Count = countFacesAndVertices(Obj);
        Obj.userData.NumFaces = Count.Faces;
        Obj.userData.NumVertices = Count.Vertices;
        addNormalGeometry(Obj, 1, false, 'Surface Normals');
        addNormalGeometry(Obj, 1, false, 'Vertex Normals');

        Faces.setValue(Obj.userData.NumFaces);
        Vertices.setValue(Obj.userData.NumVertices);    

        var endTime = performance.now();
        console.log("Load time = " + (endTime - startTime) + " milli");
        document.body.style.cursor = "default";
        Faces.setValue(0);
        Vertices.setValue(0);
    });

}

function FBXLoadFile(InputFile, Placeholder = undefined)
{
    console.log("Loading FBX File...");
    var startTime = performance.now();
    var Path = URL.createObjectURL(InputFile);
    var Loader = new FBXLoader();

    Loader.load(Path, function (Loaded) {
        /* Adjust the objects to make them render properly.*/
        Loaded.traverse((Obj) => {
            if (Obj instanceof THREE.Mesh && Obj.material) {
                Obj.castShadow = true;
                if (Obj.material) {
                    Obj.material.wireframe = false;
                    Obj.material.side = THREE.DoubleSide;
                }
            }

            let Count = countFacesAndVertices(Obj);
            Obj.userData.NumFaces = Count.Faces;
            Obj.userData.NumVertices = Count.Vertices;
            addNormalGeometry(Obj, 1, false, 'Surface Normals');
            addNormalGeometry(Obj, 1, false, 'Vertex Normals');

            Faces.setValue(Obj.userData.NumFaces);
            Vertices.setValue(Obj.userData.NumVertices);    

        });
        Scene.add(Loaded);
        Resize(Loaded);
        var endTime = performance.now();
        console.log("Load time = " + (endTime - startTime) + " milli");
        document.body.style.cursor = "default";
    });

}

/* END FILE LOADERS ========================================================= */

/* UTILITY ================================================================== */

/* Converts degrees to radians.*/
function DegreesToRadians(Deg)
{
    return Deg * (Math.PI / 180);
}

/* Traverses the scene and makes all objects wireframe.*/
function SetWireframe(Value)
{
    console.log(Scene);
	Scene.traverse(function (Child) {
        if (Transform.getObjectById(Child.id))
            return;
        if (EnvironmentHelpers.includes(Child.name))
            return;

        if (Value) {
            Child.userData.PrevMat = Child.material;
            Child.material = new THREE.MeshBasicMaterial();
            Child.material.wireframe = true;
            if(Child.userData.PrevMat)
                Child.material.color.set(Child.userData.PrevMat.color);
        } else {
            Child.material = Child.userData.PrevMat;
        }
            
	});
}

function SetCompositeMeshColor(Value){
    let toClear = true;
    let prev = Scene.children[0];
    Scene.traverse(function(Child){
        if(Transform.getObjectById(Child.id))
            return;
        if(EnvironmentHelpers.includes(Child.name))
            return;

        if(Value && Child.geometry && Child.name !== "CompositeLines"){
            const wireframeGeometry = new THREE.WireframeGeometry(Child.geometry);
            const wireframeMaterial = new THREE.LineBasicMaterial({ 
                color: 0x000000,
                linewidth: 50000 });
            const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
            wireframe.name = "CompositeLines";
            CompositeWireFrames.push(wireframe);
            Child.add(wireframe);
            console.log(Child);
            toClear = false;
        }
    
        prev = Child;
        console.log(prev);
        console.log(Child);
        
    });
    console.log(toClear);
    if(toClear){
        CompositeWireFrames.forEach((w) =>{
            w.parent.remove(w);
        });
        CompositeWireFrames = [];
    }
    console.log(Scene);

}

function SetLocalClipping(Value)
{
	Renderer.localClippingEnabled = Value;
}

/*Makes the surface/vertex normal display geometry and add it to the object tree */
function addNormalGeometry(Obj, S = 1, IsVisible = false, Name)
{
    Obj.traverse((Child) => {
        /* Don't add normals on normals */
        /* This could happen if normal size was modified.*/
        if (Child.name == 'Vertex Normals' || Child.name == 'Surface Normals')
            return;
        if (Child.geometry) {
            if (!Child.geometry.hasAttribute('normal')) {
                Child.geometry.computeVertexNormals();
            }
            if (Name == 'Vertex Normals') {
                let VNorms = new VertexNormals(Child, S, new THREE.Color(0, 255, 0));
                VNorms.name = Name;
                VNorms.visible = IsVisible;
                VNorms.layers.set(1);
                Obj.add(VNorms);
            } else if(Name == 'Surface Normals') {
                let SNorms = new SurfaceNormals(Child, S, new THREE.Color(0, 0, 255));
                SNorms.name = Name;
                SNorms.visible = IsVisible;
                SNorms.layers.set(1);
                Obj.add(SNorms);
            }
        }
    });

}

function deleteAllMatchingNames(Obj, Name)
{
    let ToDelete = [];

    Obj.traverse((Child) => {
        if (Child.name == Name)
            ToDelete.push(Child);
    });

    ToDelete.forEach((D) => {
        Obj.remove(D);
    });

}

function clearClippingScene(){
    while(ClippingScene.children.length > 0){ 
        ClippingScene.remove(ClippingScene.children[0]); 
    }
}

function clearCompositeMode(){
    /* Clear CompositeWireFrames */
    CompositeWireFrames.forEach((w) =>{
        Scene.remove(w);
    });
}

/* Normalizes the object so it fits inside a 10x10x10 cube.                   */
/* This applies the transformation to the actual geometry.                    */
/* We do this since we do computations on the geometry later.                 */
function Resize(Obj)
{
	var BBox = new THREE.Box3().setFromObject(Obj);
	const BBoxSize = BBox.getSize(new THREE.Vector3());
	const BBoxCentre = BBox.getCenter(new THREE.Vector3());
	const MaxDimension = Math.max(BBoxSize.x, BBoxSize.y, BBoxSize.z);
    const TMat = new THREE.Matrix4();
    const SMat = new THREE.Matrix4();
    const Matrix = new THREE.Matrix4();

    TMat.makeTranslation(-BBoxCentre.x, -BBoxCentre.y, -BBoxCentre.z);
    SMat.makeScale(10.0 / MaxDimension, 10.0 / MaxDimension, 10.0 / MaxDimension);
    Matrix.multiplyMatrices(SMat, TMat);

    Obj.traverse((Child) => {
        if (Child.geometry) {
            Child.geometry.applyMatrix4(Matrix);
            Child.position.set( 0, 0, 0 );
            Child.rotation.set( 0, 0, 0 );
            Child.scale.set( 1, 1, 1 );
            Child.updateMatrix();
        }
    });
}

function updateClipping(){
    clearClippingScene();
    if(PickedObject && Renderer.localClippingEnabled){
            SetupClipping(PickedObject.children[0].children[0].geometry);
            planeObjects.forEach((p) => {
                drawIntersectionPoints(p,PickedObject.children[0].children[0]);
            });
        }
    }


function toggleClippingPlane(state, plane){
    if(!PickedObject)
        return;
    if(!state)
        PickedObject.children[0].children[0].material.clippingPlanes = PickedObject.children[0].children[0].material.clippingPlanes.filter((p) => p !== plane);
    else if (!PickedObject.children[0].children[0].material.clippingPlanes.includes(plane))
        PickedObject.children[0].children[0].material.clippingPlanes.push(plane);
}

function createPlaneStencilGroup( geometry, plane, renderOrder ) {
    console.log("Entered createPlaneStencilGroup!");

    const group = new THREE.Group();
    const baseMat = new THREE.MeshBasicMaterial();
    baseMat.depthWrite = false;
    baseMat.depthTest = false;
    baseMat.colorWrite = false;
    baseMat.stencilWrite = true;
    baseMat.stencilFunc = THREE.AlwaysStencilFunc;

    // back faces
    const mat0 = baseMat.clone();
    mat0.side = THREE.BackSide;
    mat0.clippingPlanes = [ plane ];
    mat0.stencilFail = THREE.IncrementWrapStencilOp;
    mat0.stencilZFail = THREE.IncrementWrapStencilOp;
    mat0.stencilZPass = THREE.IncrementWrapStencilOp;

    const mesh0 = new THREE.Mesh( geometry, mat0 );
    mesh0.renderOrder = renderOrder;
    group.add( mesh0 );

    // front faces
    const mat1 = baseMat.clone();
    mat1.side = THREE.FrontSide;
    mat1.clippingPlanes = [ plane ];
    mat1.stencilFail = THREE.DecrementWrapStencilOp;
    mat1.stencilZFail = THREE.DecrementWrapStencilOp;
    mat1.stencilZPass = THREE.DecrementWrapStencilOp;

    const mesh1 = new THREE.Mesh( geometry, mat1 );
    mesh1.renderOrder = renderOrder;

    group.add( mesh1 );
    group.name = 'StencilGroup'
    return group;

}

function setPointOfIntersection(line, plane, positions, pointOfIntersection) {
    if(!plane.intersectsLine(line))
        return;
    plane.intersectLine(line, pointOfIntersection);
    if (pointOfIntersection && pointOfIntersection !== new THREE.Vector3()) {
        let g = pointOfIntersection.clone();
        positions.push(g.x);
        positions.push(g.y);
        positions.push(g.z);
    };
}

function drawIntersectionPoints(plane, obj) {

    let pointsOfIntersection = new THREE.BufferGeometry();

    let a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
    var planePointA = new THREE.Vector3(),
        planePointB = new THREE.Vector3(),
        planePointC = new THREE.Vector3();
    let lineAB = new THREE.Line3(),
        lineBC = new THREE.Line3(),
        lineCA = new THREE.Line3();

    let pointOfIntersection = new THREE.Vector3();

    let mathPlane = new THREE.Plane();

    const positionAttribute = plane.geometry.getAttribute('position');

    const localVertex = new THREE.Vector3();

    localVertex.fromBufferAttribute(positionAttribute, 0);
    plane.localToWorld(planePointA.copy(localVertex));
    localVertex.fromBufferAttribute(positionAttribute, 1);
    plane.localToWorld(planePointB.copy(localVertex));
    localVertex.fromBufferAttribute(positionAttribute, 2);
    plane.localToWorld(planePointC.copy(localVertex));

    mathPlane.setFromCoplanarPoints(planePointA, planePointB, planePointC);

    let positions = [];

    const objPositionAttribute = obj.geometry.getAttribute('position');
    for (let vertexIndex = 0; vertexIndex < objPositionAttribute.count; vertexIndex += 3) {

        localVertex.fromBufferAttribute(objPositionAttribute, vertexIndex);
        obj.localToWorld(a.copy(localVertex));
        localVertex.fromBufferAttribute(objPositionAttribute, vertexIndex + 1);
        obj.localToWorld(b.copy(localVertex));
        localVertex.fromBufferAttribute(objPositionAttribute, vertexIndex + 2);
        obj.localToWorld(c.copy(localVertex));

        lineAB = new THREE.Line3(a, b);
        lineBC = new THREE.Line3(b, c);
        lineCA = new THREE.Line3(c, a);

        setPointOfIntersection(lineAB, mathPlane, positions, pointOfIntersection);
        setPointOfIntersection(lineBC, mathPlane, positions, pointOfIntersection);
        setPointOfIntersection(lineCA, mathPlane, positions, pointOfIntersection);
    }

    pointsOfIntersection.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(positions), 3));

    let pointsMaterial = new THREE.PointsMaterial({
        size: 0.1114,
        color: 0xffff00,
        clippingPlanes: PickedObject.children[0].children[0].material.clippingPlanes
    });

    let points = new THREE.Points(pointsOfIntersection, pointsMaterial);
    ClippingScene.add(points);
    let amazing = new THREE.LineSegments(points.geometry, new THREE.LineBasicMaterial({
        color: 0xffffff,
        clippingPlanes: PickedObject.children[0].children[0].material.clippingPlanes
        }));
    ClippingScene.add(amazing);
    ClippingScene.add(points);

}
