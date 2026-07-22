import * as THREE from "three";

export const ISSUE2_STUDIO_CANDIDATES=Object.freeze(["studio-d1","studio-d2","studio-d2a","studio-d2b","studio-d2c1","studio-d2c2","studio-d2c3","studio-d3"]);

export const ISSUE2_STUDIO_CONFIGURATIONS=Object.freeze({
 "studio-d1":Object.freeze({rectLights:false,expectedRectLights:0,shadowCarrier:false,placementStrategy:"environment-only",zoomStableFog:false,studioProfile:"base"}),
 "studio-d2":Object.freeze({rectLights:true,expectedRectLights:2,shadowCarrier:false,placementStrategy:"world-fixed-current",zoomStableFog:false,studioProfile:"base"}),
 "studio-d2a":Object.freeze({rectLights:true,expectedRectLights:2,shadowCarrier:false,placementStrategy:"world-fixed",zoomStableFog:true,studioProfile:"base"}),
 "studio-d2b":Object.freeze({rectLights:true,expectedRectLights:2,shadowCarrier:false,placementStrategy:"camera-orientation-fixed-radius",zoomStableFog:true,studioProfile:"base"}),
 "studio-d2c1":Object.freeze({rectLights:true,expectedRectLights:2,shadowCarrier:false,placementStrategy:"world-fixed",zoomStableFog:true,studioProfile:"d2c1-midtone-environment"}),
 "studio-d2c2":Object.freeze({rectLights:true,expectedRectLights:2,shadowCarrier:false,placementStrategy:"world-fixed",zoomStableFog:true,studioProfile:"d2c2-balanced-key-fill"}),
 "studio-d2c3":Object.freeze({rectLights:true,expectedRectLights:3,shadowCarrier:false,placementStrategy:"world-fixed",zoomStableFog:true,studioProfile:"d2c3-lower-bounce"}),
 "studio-d3":Object.freeze({rectLights:true,expectedRectLights:2,shadowCarrier:true,placementStrategy:"world-fixed-current",zoomStableFog:false,studioProfile:"base"}),
});

export const ISSUE2_STUDIO_LAYOUT=Object.freeze({
 environment:{
  background:"#080808",
  ambientSurface:{kind:"room-and-floor",color:"#181818",roomColor:"#181818",floorColor:"#181818",floorRadiance:.7,roomRadius:70,floorSize:[96,96],floorPosition:[0,0,-24]},
  panels:[
   {name:"studioEnvKeyPanel",role:"key-reflection",color:"#ffffff",radiance:4.8,size:[34,22],position:[16,-30,20]},
   {name:"studioEnvFillPanel",role:"fill-reflection",color:"#ffffff",radiance:2.75,size:[32,26],position:[-20,28,10]},
   {name:"studioEnvStripPanel",role:"rim-reflection",color:"#ffffff",radiance:2.1,size:[8,32],position:[-28,-3,-12]},
  ],
  flags:[
   {name:"studioEnvFrontFlag",role:"front-edge-negative-fill",color:"#000000",size:[7,30],position:[-23,-25,3]},
   {name:"studioEnvBackFlag",role:"back-edge-negative-fill",color:"#000000",size:[8,28],position:[24,22,-4]},
  ],
 },
 rectLights:[
  {name:"studioRectKey",role:"front-key",color:"#ffffff",intensity:1.0,size:[30,20],position:[15,-28,18]},
  {name:"studioRectFill",role:"back-fill",color:"#ffffff",intensity:.35,size:[28,22],position:[-18,27,11]},
 ],
 shadowCarrier:{name:"studioShadowCarrier",role:"contact-shadow",color:"#ffffff",intensity:.15,position:[14,-28,21],mapSize:{desktop:2048,mobile:1024},bias:-.00018,normalBias:.018},
});

const D2C_MIDTONE_ENVIRONMENT=Object.freeze({
 background:ISSUE2_STUDIO_LAYOUT.environment.background,
 ambientSurface:Object.freeze({kind:"room-and-floor",color:"#202020",roomColor:"#202020",floorColor:"#202020",floorRadiance:.7,roomRadius:70,floorSize:[96,96],floorPosition:[0,0,-24]}),
 panels:ISSUE2_STUDIO_LAYOUT.environment.panels,
 flags:Object.freeze([
  Object.freeze({name:"studioEnvFrontFlag",role:"front-edge-negative-fill",color:"#080808",size:[7,30],position:[-23,-25,3]}),
  Object.freeze({name:"studioEnvBackFlag",role:"back-edge-negative-fill",color:"#080808",size:[8,28],position:[24,22,-4]}),
 ]),
});

const D2C_BALANCED_RECT_LIGHTS=Object.freeze([
 Object.freeze({name:"studioRectKey",role:"front-key",color:"#ffffff",intensity:.85,size:[30,20],position:[15,-28,18]}),
 Object.freeze({name:"studioRectFill",role:"back-fill",color:"#ffffff",intensity:.455,size:[32.2,25.3],position:[-18,27,11]}),
]);

const D2C_LOWER_BOUNCE=Object.freeze({name:"studioRectLowerBounce",role:"lower-front-bounce",color:"#ffffff",intensity:.085,size:[38,24],position:[0,-22,-26]});

export const ISSUE2_STUDIO_PROFILES=Object.freeze({
 base:Object.freeze({environment:ISSUE2_STUDIO_LAYOUT.environment,rectLights:ISSUE2_STUDIO_LAYOUT.rectLights}),
 "d2c1-midtone-environment":Object.freeze({environment:D2C_MIDTONE_ENVIRONMENT,rectLights:ISSUE2_STUDIO_LAYOUT.rectLights}),
 "d2c2-balanced-key-fill":Object.freeze({environment:D2C_MIDTONE_ENVIRONMENT,rectLights:D2C_BALANCED_RECT_LIGHTS}),
 "d2c3-lower-bounce":Object.freeze({environment:D2C_MIDTONE_ENVIRONMENT,rectLights:Object.freeze([...D2C_BALANCED_RECT_LIGHTS,D2C_LOWER_BOUNCE])}),
});

function makeBasicMaterial(color,radiance=1){
 const material=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false});
 if(radiance!==1)material.color.multiplyScalar(radiance);
 return material;
}

function addPanel(scene,definition){
 const geometry=new THREE.PlaneGeometry(...definition.size);
 const material=makeBasicMaterial(definition.color,definition.radiance??1);
 const panel=new THREE.Mesh(geometry,material);
 panel.name=definition.name;
 panel.position.fromArray(definition.position);
 panel.lookAt(0,0,0);
 scene.add(panel);
 return panel;
}

function createStudioEnvironmentScene(environmentLayout){
 const studioScene=new THREE.Scene();
 studioScene.name="issue2StudioEnvironment";
 studioScene.background=new THREE.Color(environmentLayout.background);
 const ambient=environmentLayout.ambientSurface;
 const room=new THREE.Mesh(
  new THREE.SphereGeometry(ambient.roomRadius,32,16),
  new THREE.MeshBasicMaterial({color:ambient.roomColor??ambient.color,side:THREE.BackSide,toneMapped:false}),
 );
 room.name="studioAmbientRoom";
 studioScene.add(room);
 const floor=new THREE.Mesh(
  new THREE.PlaneGeometry(...ambient.floorSize),
  makeBasicMaterial(ambient.floorColor??ambient.color,ambient.floorRadiance??.7),
 );
 floor.name="studioAmbientFloor";
 floor.position.fromArray(ambient.floorPosition);
 studioScene.add(floor);
 const panels=[
  ...environmentLayout.panels.map(definition=>addPanel(studioScene,definition)),
  ...environmentLayout.flags.map(definition=>addPanel(studioScene,definition)),
 ];
 return {scene:studioScene,resources:[room,floor,...panels]};
}

function disposeStudioEnvironment(environment){
 for(const object of environment.resources){
  object.geometry?.dispose();
  if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());
  else object.material?.dispose();
 }
}

function addRectLight(scene,aim,definition){
 const light=new THREE.RectAreaLight(definition.color,definition.intensity,...definition.size);
 light.name=definition.name;
 light.userData.issue2StudioRole=definition.role;
 light.position.fromArray(definition.position);
 light.lookAt(aim);
 scene.add(light);
 return light;
}

function cameraBasis(camera,aim){
 camera.updateMatrixWorld(true);
 const quaternion=camera.getWorldQuaternion(new THREE.Quaternion());
 const cameraPosition=camera.getWorldPosition(new THREE.Vector3());
 const view=cameraPosition.sub(aim);
 if(view.lengthSq()<=1e-12)view.set(0,0,1).applyQuaternion(quaternion);
 view.normalize();
 const quaternionRight=new THREE.Vector3(1,0,0).applyQuaternion(quaternion);
 const quaternionUp=new THREE.Vector3(0,1,0).applyQuaternion(quaternion);
 const right=quaternionRight.addScaledVector(view,-quaternionRight.dot(view));
 if(right.lengthSq()<=1e-12)right.copy(quaternionUp).cross(view);
 right.normalize();
 const up=quaternionUp
  .addScaledVector(view,-quaternionUp.dot(view))
  .addScaledVector(right,-quaternionUp.dot(right));
 if(up.lengthSq()<=1e-12)up.copy(view).cross(right);
 up.normalize();
 return {quaternion,view,right,up};
}

function configureOrientationFollowingLights(lights,camera,aim){
 const basis=cameraBasis(camera,aim);
 const fixedOffsets=lights.map(light=>{
  const offset=light.getWorldPosition(new THREE.Vector3()).sub(aim);
  return {
   name:light.name,
   depth:offset.dot(basis.view),
   side:offset.dot(basis.right),
   height:offset.dot(basis.up),
   radius:offset.length(),
  };
 });
 return {fixedOffsets,lastQuaternion:basis.quaternion.clone(),lastView:basis.view.clone(),lastRight:basis.right.clone(),lastUp:basis.up.clone(),updateCount:0};
}

function updateOrientationFollowingLights(lights,state,camera,aim){
 const basis=cameraBasis(camera,aim);
 // D2b follows camera orientation, not camera zoom or pan.  The camera can
 // target a point slightly offset from the model centre, so recomputing from
 // cameraPosition - modelCentre on a pure zoom would otherwise introduce a
 // small light orbit even though the camera quaternion did not change.
 if(state.lastQuaternion.angleTo(basis.quaternion)<=1e-7)return false;
 lights.forEach((light,index)=>{
  const fixed=state.fixedOffsets[index];
  light.position.copy(aim)
   .addScaledVector(basis.view,fixed.depth)
   .addScaledVector(basis.right,fixed.side)
   .addScaledVector(basis.up,fixed.height);
  light.lookAt(aim);
  light.updateMatrixWorld(true);
 });
 state.lastQuaternion.copy(basis.quaternion);
 state.lastView.copy(basis.view);
 state.lastRight.copy(basis.right);
 state.lastUp.copy(basis.up);
 state.updateCount++;
 return true;
}

function describeLight(light,aim){
 const worldPosition=light.getWorldPosition(new THREE.Vector3());
 return {
  name:light.name,
  role:light.userData.issue2StudioRole??null,
  type:light.type,
  color:`#${light.color.getHexString()}`,
  intensity:light.intensity,
  position:worldPosition.toArray(),
  quaternion:light.getWorldQuaternion(new THREE.Quaternion()).toArray(),
  target:light.target?.getWorldPosition(new THREE.Vector3()).toArray()??null,
  size:light.isRectAreaLight?[light.width,light.height]:null,
  castShadow:light.castShadow,
  parent:light.parent?.name||light.parent?.type||null,
  cameraAttached:Boolean(light.parent?.isCamera),
  distanceToModel:aim?worldPosition.distanceTo(aim):null,
 };
}

export async function createIssue2StudioRig({candidate,renderer,scene,camera,lightingAim,legacyLights,onStage=()=>{}}){
 if(!ISSUE2_STUDIO_CANDIDATES.includes(candidate))return null;
 const configuration=ISSUE2_STUDIO_CONFIGURATIONS[candidate];
 const studioProfile=ISSUE2_STUDIO_PROFILES[configuration.studioProfile];
 const stage=(name,details={})=>onStage({name,at:performance.now(),...details});
 const initializationStarted=performance.now();
 const memoryBefore={...renderer.info.memory};
 const previousEnvironment=scene.environment;
 const legacy=legacyLights.map(light=>({
  light,
  name:light.name,
  type:light.type,
  color:`#${light.color.getHexString()}`,
  intensity:light.intensity,
  castShadow:light.castShadow,
  parent:light.parent?.name||light.parent?.type||null,
 }));
 for(const state of legacy){state.light.intensity=0;state.light.castShadow=false}
 stage("legacy-lights-disabled",{count:legacy.length});

 const environmentScene=createStudioEnvironmentScene(studioProfile.environment);
 const pmremGenerator=new THREE.PMREMGenerator(renderer);
 pmremGenerator.compileCubemapShader();
 const environmentTarget=pmremGenerator.fromScene(environmentScene.scene,.04,.1,100);
 stage("pmrem-ready",{textureCountDelta:renderer.info.memory.textures-memoryBefore.textures});
 scene.environment=environmentTarget.texture;
 stage("environment-applied",{applied:scene.environment===environmentTarget.texture});
 pmremGenerator.dispose();
 disposeStudioEnvironment(environmentScene);

 const rectLights=[];
 if(configuration.rectLights){
  const {RectAreaLightUniformsLib}=await import("three/addons/lights/RectAreaLightUniformsLib.js");
  RectAreaLightUniformsLib.init();
  stage("rect-area-uniforms-ready");
  for(const definition of studioProfile.rectLights){rectLights.push(addRectLight(scene,lightingAim.position,definition))}
  stage("rect-lights-built",{count:rectLights.length});
 }

 const orientationFollowing=configuration.placementStrategy==="camera-orientation-fixed-radius"
  ?configureOrientationFollowingLights(rectLights,camera,lightingAim.getWorldPosition(new THREE.Vector3()))
  :null;

 let shadowCarrier=null;
 if(configuration.shadowCarrier){
  const definition=ISSUE2_STUDIO_LAYOUT.shadowCarrier;
  shadowCarrier=new THREE.DirectionalLight(definition.color,definition.intensity);
  shadowCarrier.name=definition.name;
  shadowCarrier.userData.issue2StudioRole=definition.role;
  shadowCarrier.position.fromArray(definition.position);
  shadowCarrier.target=lightingAim;
  shadowCarrier.castShadow=true;
  shadowCarrier.shadow.bias=definition.bias;
  shadowCarrier.shadow.normalBias=definition.normalBias;
  scene.add(shadowCarrier);
  stage("shadow-carrier-built",{count:1});
 }

 const rig={
  candidate,
  configuration,
  studioProfile:configuration.studioProfile,
  environmentTarget,
  lightingAim,
  environmentLayout:studioProfile.environment,
  rectLights,
  rectAreaUniformsInitialized:configuration.rectLights,
  shadowCarrier,
  orientationFollowing,
  shadowIntensitySupported:Boolean(shadowCarrier&&"intensity" in shadowCarrier.shadow),
  legacy,
 };
 rig.initialization={durationMs:performance.now()-initializationStarted,memoryBefore,memoryAfter:{...renderer.info.memory},generationCount:1};
 rig.updateCameraOrientation=(activeCamera=camera)=>{
  if(!orientationFollowing)return false;
  return updateOrientationFollowingLights(rectLights,orientationFollowing,activeCamera,lightingAim.getWorldPosition(new THREE.Vector3()));
 };
 stage("candidate-ready",{candidate,rectLightCount:rectLights.length,shadowCarrier:Boolean(shadowCarrier)});
 rig.dispose=()=>{
  if(scene.environment===environmentTarget.texture)scene.environment=previousEnvironment;
  for(const light of [...rectLights,...(shadowCarrier?[shadowCarrier]:[])])light.removeFromParent();
  environmentTarget.dispose();
  for(const state of legacy){state.light.intensity=state.intensity;state.light.castShadow=state.castShadow}
 };
 return rig;
}

export function describeIssue2StudioRig(rig){
 if(!rig)return {enabled:false,candidate:null};
 return {
  enabled:true,
  candidate:rig.candidate,
  placementStrategy:rig.configuration.placementStrategy,
  studioProfile:rig.studioProfile,
  expectedRectLights:rig.configuration.expectedRectLights,
  cameraDistanceInvariant:true,
  zoomStableFog:rig.configuration.zoomStableFog,
  neutralLightColor:"#ffffff",
  environmentMapBackgroundIndependent:true,
  environment:{
   applied:Boolean(rig.environmentTarget?.texture),
   source:"PMREMGenerator.fromScene",
   sigma:.04,
   near:.1,
   far:100,
   ...rig.environmentLayout,
  },
  initialization:rig.initialization,
  rectAreaUniformsInitialized:rig.rectAreaUniformsInitialized,
  rectLights:rig.rectLights.map(light=>describeLight(light,rig.lightingAim.getWorldPosition(new THREE.Vector3()))),
  directLightBalance:(()=>{const key=rig.rectLights.find(light=>light.name==="studioRectKey"),fill=rig.rectLights.find(light=>light.name==="studioRectFill"),lower=rig.rectLights.find(light=>light.name==="studioRectLowerBounce");return key&&fill?{keyIntensity:key.intensity,fillIntensity:fill.intensity,keyToFillRatio:key.intensity/fill.intensity,keyArea:key.width*key.height,fillArea:fill.width*fill.height,lowerBounceIntensity:lower?.intensity??0,lowerBounceToKeyRatio:lower?lower.intensity/key.intensity:0}:null})(),
  orientationFollowing:rig.orientationFollowing?{
   fixedOffsets:rig.orientationFollowing.fixedOffsets.map(offset=>({...offset})),
   fixedRadii:rig.orientationFollowing.fixedOffsets.map(offset=>offset.radius),
   updateCount:rig.orientationFollowing.updateCount,
   lastCameraQuaternion:rig.orientationFollowing.lastQuaternion.toArray(),
   lastViewDirection:rig.orientationFollowing.lastView.toArray(),
   lastRightDirection:rig.orientationFollowing.lastRight.toArray(),
   lastUpDirection:rig.orientationFollowing.lastUp.toArray(),
  }:null,
  shadowCarrier:rig.shadowCarrier?{
   ...describeLight(rig.shadowCarrier,rig.lightingAim.getWorldPosition(new THREE.Vector3())),
   mapSize:rig.shadowCarrier.shadow.mapSize.toArray(),
   bias:rig.shadowCarrier.shadow.bias,
   normalBias:rig.shadowCarrier.shadow.normalBias,
   filter:"PCFSoftShadowMap fixed kernel (Three.js r160; radius is not used as a tuning control)",
   shadowIntensitySupported:rig.shadowIntensitySupported,
   effectiveShadowStrengthControl:rig.shadowIntensitySupported?"shadow.intensity":"carrier-light-intensity",
  }:null,
  pointLightActive:false,
  legacyLights:rig.legacy.map(state=>({
   name:state.name,
   type:state.type,
   color:state.color,
   originalIntensity:state.intensity,
   currentIntensity:state.light.intensity,
   originalCastShadow:state.castShadow,
   currentCastShadow:state.light.castShadow,
   parent:state.parent,
  })),
 };
}
