import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const html=await fs.readFile(new URL('../mynecraft.html',import.meta.url),'utf8');
const Three=await import(new URL('../vendor/three.module.js',import.meta.url));
class Element{
  constructor(){this.style={};this.children=[];this.dataset={};this.events={};this.classList={add(){},remove(){}};this.textContent='';}
  appendChild(e){this.children.push(e);}append(...es){this.children.push(...es);}
  addEventListener(k,f){(this.events[k]??=[]).push(f);}setAttribute(k,v){this[k]=v;}focus(){}
  getContext(){return new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>o[k]??(()=>{})});}
}
class Renderer{constructor(){this.domElement=new Element();this.shadowMap={};}setPixelRatio(){}setSize(){}render(){}}
const elements={},document={body:new Element(),createElement:()=>new Element(),getElementById:id=>elements[id]??=new Element(),addEventListener(){},exitPointerLock(){}};
let saved=JSON.stringify({edits:{},player:{x:47.5,y:6.7,z:35.5,sel:8},dayTime:.12});
const context=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,TextureLoader:class{load(){return new Three.Texture();}}},document,window:{},navigator:{maxTouchPoints:0},innerWidth:1280,innerHeight:800,devicePixelRatio:1,
  performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},setInterval(){},requestAnimationFrame(){},console,URLSearchParams,addEventListener(){},
  localStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem(){saved=null;}},location:{reload(){}},confirm:()=>true});
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("import * as THREE from 'three';",'')+`
globalThis.api={WORLD,WORLD_FLOOR,deepVoids,getBlock,setBlock,buildMeshes,updateBlockMeshes,faceSlots,groundSurface,readAreaLabels,player,tick,startGame,waterLiftAt};`;
vm.runInContext(source,context);
const a=context.api;
assert.equal(a.WORLD_FLOOR,-40);
const stored=a.WORLD.size;
assert(a.getBlock(80,-20,80),'deep rock exists');
assert.equal(a.WORLD.size,stored,'reading deep rock does not materialize full underground layers');
assert(!a.WORLD.has('80,-20,80'));
assert.equal(a.getBlock(80,-41,80),undefined,'rock stops at the protected floor');

// A hole through only the old floor must expose the virtual block under it,
// both during play and after all meshes are rebuilt from saved excavation data.
a.setBlock(80,-8,80,null);a.updateBlockMeshes(80,-8,80);
assert(a.deepVoids.has('80,-8,80'));
assert(a.faceSlots.has('80,-9,80,2'));
a.setBlock(81,-9,80,null);a.updateBlockMeshes(81,-9,80);
assert(a.faceSlots.has('81,-8,80,3'),'the old floor underside is no longer hidden');
a.buildMeshes();
assert(a.faceSlots.has('80,-9,80,2'),'old-floor opening survives remeshing');
assert(a.faceSlots.has('81,-8,80,3'),'mine ceiling survives remeshing');
a.setBlock(80,-8,80,'stone');a.updateBlockMeshes(80,-8,80);
assert(!a.faceSlots.has('80,-9,80,2'),'filling a hole removes the now-buried face');
a.setBlock(79,-20,79,'water');a.setBlock(77,-20,77,'glass');

// A full-depth shaft remains bounded and supports players, signs and water lifts.
for(let x=84;x<=86;x++)for(let z=84;z<=86;z++)for(let y=-39;y<=32;y++)a.setBlock(x,y,z,null);
a.buildMeshes();
assert(a.faceSlots.has('79,-21,79,2'),'virtual stone behind deep water is visible after reload');
assert(a.faceSlots.has('77,-21,77,2'),'virtual stone behind deep glass is visible after reload');
assert.equal(a.groundSurface(85,85),-39);
assert(a.faceSlots.has('85,-40,85,2'),'the new protected floor is visible');
assert(!a.faceSlots.has('85,-40,85,3'),'the unreachable floor underside is not rendered');
assert.equal(a.readAreaLabels([{text:'Deep mine',x:85,y:-38,z:85}])[0].y,-38);
assert.throws(()=>a.readAreaLabels([{text:'Below world',x:85,y:-40,z:85}]),/area signs/);
a.player.pos.set(85.5,-37.3,85.5);a.player.vel.set(0,0,0);a.startGame();a.tick(50);
assert(a.player.pos.y<-25,'a valid deep mine no longer triggers the old rescue height');
a.player.pos.y=-49;a.tick(100);assert(a.player.pos.y>0,'falling beneath the new floor still rescues the player');
a.setBlock(85,-38,85,'glow');for(let y=-37;y<=-30;y++)a.setBlock(85,y,85,'water');
assert(a.waterLiftAt(85,-30,85),'water elevators can reach deep underground');

// The existing landing-page picker can directly launch the new mode.
const landing=await fs.readFile(new URL('../../index.html',import.meta.url),'utf8');
assert.match(landing,/name="mode" value="hardcore"/);
const modes=['creative','survival','hardcore'].map(value=>({value,checked:false,addEventListener(event,fn){this.change=fn;}}));
const play={setAttribute(name,value){this[name]=value;}};
vm.runInNewContext(landing.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:()=>play,querySelectorAll:()=>modes}});
modes[2].checked=true;modes[2].change();
assert.equal(play.href,'game/mynecraft.html?mode=hardcore');
assert.equal(play['aria-label'],'Play Embrace the Challenge: Hardcore mode');
console.log('Deep terrain, remeshing, mine safety, water lift and direct Hardcore entry checks passed.');
