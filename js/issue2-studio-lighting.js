import * as THREE from "three";

export const ISSUE2_STUDIO_CANDIDATES=Object.freeze(["studio-d1","studio-d2","studio-d3"]);

export const ISSUE2_STUDIO_LAYOUT=Object.freeze({
 environment:{
  background:"#080808",
  ambientSurface:{kind:"room-and-floor",color:"#181818",roomRadius:70,floorSize:[96,96],floorPosition:[0,0,-24]},
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

function createStudioEnvironmentScene(){
 const studioScene=new THREE.Scene();
 studioScene.name="issue2StudioEnvironment";
 studioScene.background=new THREE.Color(ISSUE2_STUDIO_LAYOUT.environment.background);
 const room=new THREE.Mesh(
  new THREE.SphereGeometry(ISSUE2_STUDIO_LAYOUT.environment.ambientSurface.roomRadius,32,16),
  new THREE.MeshBasicMaterial({color:ISSUE2_STUDIO_LAYOUT.environment.ambientSurface.color,side:THREE.BackSide,toneMapped:false}),
 );
 room.name="studioAmbientRoom";
 studioScene.add(room);
 const floor=new THREE.Mesh(
  new THREE.PlaneGeometry(...ISSUE2_STUDIO_LAYOUT.environment.ambientSurface.floorSize),
  makeBasicMaterial(ISSUE2_STUDIO_LAYOUT.environment.ambientSurface.color,.7),
 );
 floor.name="studioAmbientFloor";
 floor.position.fromArray(ISSUE2_STUDIO_LAYOUT.environment.ambientSurface.floorPosition);
 studioScene.add(floor);
 const panels=[
  ...ISSUE2_STUDIO_LAYOUT.environment.panels.map(definition=>addPanel(studioScene,definition)),
  ...ISSUE2_STUDIO_LAYOUT.environment.flags.map(definition=>addPanel(studioScene,definition)),
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

function describeLight(light){
 return {
  name:light.name,
  role:light.userData.issue2StudioRole??null,
  type:light.type,
  color:`#${light.color.getHexString()}`,
  intensity:light.intensity,
  position:light.getWorldPosition(new THREE.Vector3()).toArray(),
  target:light.target?.getWorldPosition(new THREE.Vector3()).toArray()??null,
  size:light.isRectAreaLight?[light.width,light.height]:null,
  castShadow:light.castShadow,
 };
}

export async function createIssue2StudioRig({candidate,renderer,scene,lightingAim,legacyLights}){
 if(!ISSUE2_STUDIO_CANDIDATES.includes(candidate))return null;
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

 const environmentScene=createStudioEnvironmentScene();
 const pmremGenerator=new THREE.PMREMGenerator(renderer);
 pmremGenerator.compileCubemapShader();
 const environmentTarget=pmremGenerator.fromScene(environmentScene.scene,.04,.1,100);
 scene.environment=environmentTarget.texture;
 pmremGenerator.dispose();
 disposeStudioEnvironment(environmentScene);

 const rectLights=[];
 if(candidate!=="studio-d1"){
  const {RectAreaLightUniformsLib}=await import("three/addons/lights/RectAreaLightUniformsLib.js");
  RectAreaLightUniformsLib.init();
  for(const definition of ISSUE2_STUDIO_LAYOUT.rectLights){rectLights.push(addRectLight(scene,lightingAim.position,definition))}
 }

 let shadowCarrier=null;
 if(candidate==="studio-d3"){
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
 }

 const rig={
  candidate,
  environmentTarget,
  environmentLayout:ISSUE2_STUDIO_LAYOUT.environment,
  rectLights,
  rectAreaUniformsInitialized:candidate!=="studio-d1",
  shadowCarrier,
  shadowIntensitySupported:Boolean(shadowCarrier&&"intensity" in shadowCarrier.shadow),
  legacy,
 };
 rig.initialization={durationMs:performance.now()-initializationStarted,memoryBefore,memoryAfter:{...renderer.info.memory},generationCount:1};
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
  neutralLightColor:"#ffffff",
  backgroundIndependent:true,
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
  rectLights:rig.rectLights.map(describeLight),
  shadowCarrier:rig.shadowCarrier?{
   ...describeLight(rig.shadowCarrier),
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
