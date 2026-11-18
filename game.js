// รองรับเบราว์เซอร์เก่าที่ไม่มี ctx.roundRect
if(window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    r=Math.min(Array.isArray(r)?r[0]:(r||0),w/2,h/2);
    this.moveTo(x+r,y); this.arcTo(x+w,y,x+w,y+h,r); this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r); this.arcTo(x,y,x+w,y,r); this.closePath();
  };
}

// แสดงข้อผิดพลาดบนหน้าจอ (ช่วยตรวจเมื่อเกมไม่ทำงาน)
function showErr(err){
  running=false;
  let box=document.getElementById("err-box");
  if(!box){
    box=document.createElement("pre");
    box.id="err-box";
    box.style.cssText="position:fixed;left:8px;right:8px;top:8px;z-index:99;margin:0;padding:10px;background:#300;color:#ffb0b0;font:13px monospace;white-space:pre-wrap;border-radius:8px";
    document.body.appendChild(box);
  }
  box.textContent="ERROR: "+(err&&err.stack?err.stack:err);
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);

const W = 900, H = 420, groundY = 344;

let running = false;
let score = 0;
let lives = 3;
let speed = 5;
let obstacles = [];
let particles = [];
let lastTime = 0;
let spawnTimer = 0;

let dashReady = true;
let dashTime = 0;
let dashCooldown = 0;
let dashUses = 0;
let superTime = 0;   // เวลาพุ่งอมตะ (เฟรม)
let graceTime = 0;   // เวลาอมตะหลังพุ่งจบ (เฟรม)
const DASH_SUPER_USES = 8;   // กดแดชครบกี่ครั้งถึงจะพุ่งอมตะ
const SUPER_MIN = 5, SUPER_MAX = 7;  // พุ่งนาน 5-7 วินาที (สุ่ม)
const SUPER_MULT = 1.8;      // คูณความเร็วตอนพุ่ง
const GRACE_SECONDS = 3;     // อมตะต่ออีก 3 วินาทีหลังพุ่งจบ
const DODGE_REFUND = 30;     // ลดคูลดาวน์ 0.5 วินาที (30 เฟรม) ต่อสิ่งกีดขวางที่แดชผ่าน
let hitCooldown = 0;
let sceneIndex = 0;
let playerName = "Runner";

const player = {
  x: 120, y: groundY - 58,
  w: 44, h: 58,
  vy: 0, jumping: false, anim: 0
};

// ===== ตั้งค่าความยาก =====
const STAGE_LEN = 650;        // ระยะ/คะแนนต่อ 1 ด่าน (10 ด่าน = ด่านสุดท้ายเริ่มที่ 5850)
const MAX_SPEED_SCORE = 9999; // ความเร็วเพิ่มเรื่อยๆ จนตันที่ระยะนี้
const START_SPEED = 6.5, MAX_SPEED = 18.5;
let dist = 0, prevScene = 0, sceneT = 1, banner = 0;

// 10 ด่าน: นรก -> ... -> กาแล็กซี่ | ob = [สูง, ยาว, ลอยฟ้า, หิน, หนามพื้น]
const scenes = [
  {name:"HELL GATE",sky:"#2b0a10",far:"#5e1622",ground:"#3b1118",line:"#ff3b2f",accent:"#ff8a3c",style:"tri",stars:0,ob:["🔱","⛓️","🦇","💀","🔥"]},
  {name:"VOLCANO",sky:"#331316",far:"#7a2c20",ground:"#4a2a26",line:"#ff6a3d",accent:"#ffc15e",style:"tri",stars:0,ob:["🌋","🧱","☄️","🪨","♨️"]},
  {name:"HAUNTED GRAVEYARD",sky:"#1a1730",far:"#353058",ground:"#2a2740",line:"#9d8cff",accent:"#b8f5c0",style:"blk",stars:1,ob:["🪦","⚰️","👻","🎃","🦴"]},
  {name:"SUNSET DESERT",sky:"#3d2945",far:"#8b5260",ground:"#9b684b",line:"#ffd18a",accent:"#ffb86b",style:"tri",stars:0,ob:["🌵","🐪","🦅","🪨","🦂"]},
  {name:"EMERALD FOREST",sky:"#182d3a",far:"#254b50",ground:"#315a4d",line:"#86d69b",accent:"#b8ef8a",style:"tri",stars:0,ob:["🌲","🪵","🦉","🍄","🌿"]},
  {name:"FROZEN PEAK",sky:"#1b344d",far:"#54738b",ground:"#7b9eae",line:"#d7f7ff",accent:"#a5e8ff",style:"tri",stars:0,ob:["⛄","🧊","🌨️","🏔️","🔹"]},
  {name:"STORM SKY",sky:"#26334f",far:"#4d5f86",ground:"#3a4668",line:"#cfe0ff",accent:"#ffe66b",style:"blk",stars:0,ob:["🗼","☁️","🛩️","🌪️","⚡"]},
  {name:"NEON CITY",sky:"#171d42",far:"#343b70",ground:"#292e52",line:"#66e8ef",accent:"#ff70c8",style:"blk",stars:1,ob:["🏢","🚧","🚁","🚗","🔌"]},
  {name:"CYBERSPACE",sky:"#07161c",far:"#0f3a3f",ground:"#0a2428",line:"#3dffb0",accent:"#ff3df2",style:"blk",stars:1,ob:["🖥️","🔒","👾","💾","⚠️"]},
  {name:"GALAXY",sky:"#0a0720",far:"#2a1b5c",ground:"#17113a",line:"#b58cff",accent:"#ffd9f5",style:"tri",stars:1,ob:["🛰️","🪐","🛸","🌑","🌟"]}
];
const OB_IDX = {tall:0,long:1,air:2,rock:3,spikes:4};
const hx = c => [1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const mix = (a,b,t) => { const A=hx(a),B=hx(b);
  return "#"+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,"0")).join(""); };

// ระบบคะแนนและอันดับ
function getBoard(){
  try{
    return JSON.parse(localStorage.getItem("pixelRushBoard") || "[]");
  }catch{
    return [];
  }
}

function saveScore(name, points){
  let board = getBoard();

  board.push({
    name,
    score: points,
    date: new Date().toLocaleDateString("th-TH")
  });

  board.sort((a,b) => b.score - a.score);
  board = board.slice(0,10);

  localStorage.setItem("pixelRushBoard",JSON.stringify(board));
  return board;
}

function boardHTML(list){
  if(!list.length){
    return "<li>ยังไม่มีคะแนน ลองเป็นคนแรกสิ!</li>";
  }

  return list.map(v =>
    `<li>${escapeHTML(v.name)} — <strong>${v.score}</strong></li>`
  ).join("");
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function showStart(){
  $("start-leaderboard").innerHTML =
    boardHTML(getBoard().slice(0,5));

  $("start-panel").classList.remove("hidden");
  $("result-panel").classList.add("hidden");
}

function updateHUD(){
  $("score").textContent =
    String(Math.floor(score)).padStart(5,"0");

  $("lives").textContent =
    Array.from({length:3},(_,i)=>i<lives?"♥":"♡").join(" ");

  const prog = `${dashUses}/${DASH_SUPER_USES}`;
  $("dash-status").textContent =
    superTime>0 ? `⚡ SUPER RUSH ${(superTime/60).toFixed(1)}s` :
    graceTime>0 ? `🛡 SHIELD ${(graceTime/60).toFixed(1)}s` :
    dashReady   ? `DASH: READY (${prog})${dashUses===DASH_SUPER_USES-1?" ⚡ SUPER!":""}` :
                  `DASH: ${(dashCooldown/60).toFixed(1)}s (${prog})`;
}

// เริ่มเกม
function startGame(){
  playerName =
    $("player-name").value.trim().slice(0,16) || "Runner";

  score = 0;
  lives = 3;
  speed = START_SPEED;
  dist = 0; prevScene = 0; sceneT = 1; banner = 0;
  obstacles = [];
  particles = [];
  spawnTimer = 65;

  dashReady = true;
  dashTime = 0;
  dashCooldown = 0;
  dashUses = 0;
  superTime = 0; graceTime = 0;
  hitCooldown = 0;
  sceneIndex = 0;

  player.y = groundY - player.h;
  player.vy = 0;
  player.jumping = false;
  player.anim = 0;

  running = true;

  $("start-panel").classList.add("hidden");
  $("result-panel").classList.add("hidden");

  updateHUD();
  lastTime = performance.now();

  requestAnimationFrame(loop);
}

// กระโดด
function jump(){
  if(!running || player.jumping) return;

  player.vy = -13.2;
  player.jumping = true;
}

// Dash: ใช้บ่อย คูลดาวน์จะเพิ่มขึ้น
// พุ่งอมตะ (กดแดชครบ 8 ครั้ง): พุ่งเร็ว 5-7 วินาที แล้วอมตะต่ออีก 3 วินาที
function startSuperDash(){
  superTime = (SUPER_MIN + Math.random()*(SUPER_MAX-SUPER_MIN)) * 60;
  graceTime = 0;
  dashTime = 0;
  dashReady = false;
  dashCooldown = 0;
  dashUses = 0; // รีเซ็ตตัวนับและคูลดาวน์ที่สะสมไว้

  for(let i=0;i<30;i++){
    particles.push({
      x:player.x+10, y:player.y+Math.random()*player.h,
      vx:-Math.random()*9-3, life:26
    });
  }
}

function dash(){
  if(!running || !dashReady || superTime>0 || graceTime>0) return;

  dashUses++;
  if(dashUses>=DASH_SUPER_USES){ startSuperDash(); return; }

  dashReady = false;
  dashTime = 18;

  // เริ่ม 2.5 วินาที เพิ่มครั้งละ 0.7 วินาที สูงสุด 8 วินาที
  const cooldownSeconds =
    Math.min(2.5 + (dashUses-1)*0.7, 8);

  dashCooldown = cooldownSeconds * 60;

  for(let i=0;i<12;i++){
    particles.push({
      x:player.x+10,
      y:player.y+25,
      vx:-Math.random()*5-2,
      life:18
    });
  }
}

// ปุ่มควบคุม
function keyDown(e){
  if(["Space","ArrowUp","ShiftLeft","ShiftRight","KeyX"].includes(e.code)){
    e.preventDefault();
  }

  if(e.repeat) return;

  if(e.code==="Space" || e.code==="ArrowUp") jump();

  if(["ShiftLeft","ShiftRight","KeyX"].includes(e.code)){
    dash();
  }
}

document.addEventListener("keydown",keyDown);

// ควบคุมด้วยการแตะหน้าจอ
canvas.addEventListener("pointerdown",e=>{
  if(!running) return;

  const r = canvas.getBoundingClientRect();
  const x = (e.clientX-r.left)/r.width*W;

  if(x>W*.58) dash();
  else jump();
});

$("start-btn").addEventListener("click",()=>{ try{ startGame(); }catch(err){ showErr(err); } });
$("again-btn").addEventListener("click",showStart);

// สุ่มสิ่งกีดขวาง (หน้าตาเปลี่ยนตามด่าน)
function mk(type,x){
  const d={
    tall:{y:groundY-78,w:34,h:78},
    long:{y:groundY-30,w:88+Math.random()*35,h:30},
    air:{w:28,h:20+Math.random()*3},
    rock:{y:groundY-29,w:34,h:29},
    spikes:{y:groundY-25,w:58,h:25}
  }[type];
  if(type==="air"){
    // ระดับต่ำ (62,82) ต้องกระโดดข้าม / ระดับสูง ต้องวิ่งลอดใต้ — ต้องอ่านความสูงให้ทัน
    d.y=groundY-[62,82,108,140,170,198][Math.floor(Math.random()*6)];
    d.by=d.y; d.amp=8+Math.random()*8; d.ph=Math.random()*6.28;
    d.vx=1.1+sceneIndex*.025+Math.random()*.15; // บินเร็วกว่าพื้น
  }
  return {type,x,stage:sceneIndex,...d};
}

function spawnObstacle(){
  const r=Math.random();
  const type = r<.22?"tall" : r<.47?"long" : r<.68?"air" : r<.84?"rock" : "spikes";
  const o=mk(type,W+10);
  obstacles.push(o);

  // ด่าน 4 ขึ้นไป: มีโอกาสโผล่เป็นคู่ (เฉพาะชิ้นเล็ก กระโดดข้ามทีเดียวได้)
  if(sceneIndex>=3 && ["tall","rock","spikes"].includes(type) && Math.random()<.18+.02*sceneIndex){
    const t2=["rock","spikes","tall"][Math.floor(Math.random()*3)];
    obstacles.push(mk(t2,o.x+o.w+100+Math.random()*35));
  }
}

function hitbox(p,o){
  return p.x<o.x+o.w &&
    p.x+p.w>o.x &&
    p.y<o.y+o.h &&
    p.y+p.h>o.y;
}

// เสียชีวิตเมื่อชน
function takeHit(){
  if(hitCooldown>0 || dashTime>0 || superTime>0 || graceTime>0) return;

  lives--;
  hitCooldown=100;
  player.vy=-5;
  player.jumping=true;

  for(let i=0;i<14;i++){
    particles.push({
      x:player.x+20,
      y:player.y+25,
      vx:(Math.random()-.5)*7,
      life:22
    });
  }

  if(lives<=0) endGame();

  updateHUD();
}

// จบเกมและแสดงอันดับ
function endGame(){
  running=false;

  const board=saveScore(playerName,Math.floor(score));

  const rank=board.findIndex(v=>
    v.name===playerName &&
    v.score===Math.floor(score)
  )+1;

  $("result-title").textContent="จบเกมแล้ว!";
  $("result-score").textContent=
    `${playerName} ได้ ${Math.floor(score)} คะแนน`;

  $("result-rank").textContent=
    rank ? `อันดับของคุณ: #${rank}` : "คะแนนถูกบันทึกแล้ว";

  $("result-leaderboard").innerHTML=boardHTML(board);

  $("result-panel").classList.remove("hidden");
}

// วาด Silver Wolf: สไตล์กึ่ง Pixel 2D
function drawFallbackCharacter(){
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  const phase = player.anim;
  const run = player.jumping ? 0 : Math.sin(phase * 2.4);
  const bob = player.jumping ? 0 : Math.abs(Math.sin(phase * 2.4)) * 2;
  const legSwing = player.jumping ? 0.25 : run;
  const armSwing = player.jumping ? -0.45 : -run * 0.75;

  if(hitCooldown>0 && Math.floor(hitCooldown/7)%2===0) return;

  ctx.save();
  ctx.translate(x + player.w/2, y + bob);

  // เงาใต้เท้า
  ctx.globalAlpha = player.jumping ? .18 : .28;
  ctx.fillStyle = "#07101d";
  ctx.beginPath();
  ctx.ellipse(0, player.h+5, player.jumping ? 12 : 21, 4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // แสงและเส้นความเร็วตอนแดช
  if(dashTime>0){
    const glow = ctx.createLinearGradient(-42,0,-4,0);
    glow.addColorStop(0,"#ff70c800");
    glow.addColorStop(1,"#72e9ffbb");
    ctx.fillStyle = glow;
    ctx.fillRect(-48,13,42,27);
    ctx.fillStyle = "#a9f5ff";
    ctx.fillRect(-34,8,18,3);
    ctx.fillRect(-43,36,24,2);
  }

  // ผมด้านหลังสีฟ้าอมม่วง
  ctx.fillStyle = "#5267a8";
  ctx.beginPath();
  ctx.moveTo(-11,8); ctx.lineTo(-17,18); ctx.lineTo(-15,35);
  ctx.lineTo(-7,28); ctx.lineTo(0,17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#8c83d8";
  ctx.fillRect(-15,17,5,13);
  ctx.fillRect(-12,29,5,6);

  // หางผมด้านข้าง
  ctx.fillStyle = "#d58bdc";
  ctx.beginPath();
  ctx.moveTo(9,8); ctx.lineTo(18,14); ctx.lineTo(17,31);
  ctx.lineTo(11,26); ctx.lineTo(8,17); ctx.closePath(); ctx.fill();

  // ขาและรองเท้า: แกว่งสวนกัน
  const leftLegX = -7 + legSwing*7;
  const rightLegX = 4 - legSwing*7;
  const legY = player.jumping ? 39 : 40;
  ctx.strokeStyle = "#d8e2f7";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4,legY); ctx.lineTo(leftLegX,50 + (player.jumping? -3:Math.max(0,legSwing)*3));
  ctx.moveTo(5,legY); ctx.lineTo(rightLegX,50 + (player.jumping? 1:Math.max(0,-legSwing)*3));
  ctx.stroke();

  // ถุงเท้าและรองเท้าสนีกเกอร์
  ctx.fillStyle = "#e8edff";
  ctx.fillRect(leftLegX-3,47,6,5);
  ctx.fillRect(rightLegX-3,47,6,5);
  ctx.fillStyle = "#ff75c8";
  ctx.fillRect(leftLegX-7,51,13,5);
  ctx.fillRect(rightLegX-2,51,13,5);
  ctx.fillStyle = "#7ee8ff";
  ctx.fillRect(leftLegX-5,52,6,2);
  ctx.fillRect(rightLegX,52,6,2);

  // แขนแกว่งตามจังหวะวิ่ง
  ctx.strokeStyle = "#f0c8c5";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-8,23);
  ctx.lineTo(-12 + armSwing*8,34 + Math.abs(armSwing)*3);
  ctx.moveTo(9,22);
  ctx.lineTo(13 - armSwing*8,33 + Math.abs(armSwing)*3);
  ctx.stroke();

  // เสื้อแจ็กเก็ตสีดำอมม่วง
  const jacket = ctx.createLinearGradient(-10,14,12,42);
  jacket.addColorStop(0,"#42496c");
  jacket.addColorStop(.55,"#252b48");
  jacket.addColorStop(1,"#171d34");
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(-10,17); ctx.lineTo(-5,14); ctx.lineTo(6,14);
  ctx.lineTo(11,19); ctx.lineTo(9,41); ctx.lineTo(-9,41);
  ctx.closePath(); ctx.fill();

  // เสื้อด้านในและขอบแจ็กเก็ต
  ctx.fillStyle = "#dce8ff";
  ctx.fillRect(-2,19,5,17);
  ctx.fillStyle = "#73e7ff";
  ctx.fillRect(-9,20,3,15);
  ctx.fillRect(7,21,3,12);
  ctx.fillStyle = "#f178c9";
  ctx.fillRect(-8,37,16,3);
  ctx.fillStyle = "#b5c7ff";
  ctx.fillRect(-5,24,2,5);
  ctx.fillRect(4,24,2,5);

  // คอและใบหน้า
  ctx.fillStyle = "#f1c8c0";
  ctx.fillRect(-4,11,9,7);
  ctx.fillStyle = "#ffd8d0";
  ctx.beginPath();
  ctx.roundRect(-10,-8,21,23,5);
  ctx.fill();

  // หูฟัง/อุปกรณ์ข้างศีรษะ
  ctx.fillStyle = "#73e8ff";
  ctx.fillRect(-12,-1,4,10);
  ctx.fillStyle = "#ff79cf";
  ctx.fillRect(9,0,4,8);

  // ผมหน้าม้าสีเงินอมม่วงและฟ้า
  ctx.fillStyle = "#a6a8e8";
  ctx.beginPath();
  ctx.moveTo(-11,1); ctx.lineTo(-9,-9); ctx.lineTo(-2,-13);
  ctx.lineTo(8,-10); ctx.lineTo(13,-2); ctx.lineTo(8,4);
  ctx.lineTo(4,-2); ctx.lineTo(0,6); ctx.lineTo(-3,0);
  ctx.lineTo(-8,7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#78dff0";
  ctx.fillRect(-9,-5,5,5);
  ctx.fillRect(-5,-10,4,5);
  ctx.fillStyle = "#d8a4e8";
  ctx.fillRect(3,-9,5,4);

  // ดวงตา
  ctx.fillStyle = "#39406e";
  ctx.fillRect(-6,2,3,3);
  ctx.fillRect(4,2,3,3);
  ctx.fillStyle = "#75e8ff";
  ctx.fillRect(-5,2,1,2);
  ctx.fillRect(5,2,1,2);

  // รายละเอียดเล็ก ๆ บนแก้ม
  ctx.fillStyle = "#ed91c8";
  ctx.fillRect(-8,8,3,2);
  ctx.fillRect(7,8,3,2);

  ctx.restore();
}


// Silver Wolf sprite animation (6 transparent frames)
const runnerFrames = Array.from({length:6}, (_,i) => {
  const img = new Image();
  img.src = `assets/silver-wolf-run-${i}.png`;
  return img;
});

function drawPixelCharacter(){
  if(hitCooldown>0 && Math.floor(hitCooldown/7)%2===0) return;
  const frameIndex = Math.floor(player.anim * 0.9) % runnerFrames.length;
  const sprite = runnerFrames[frameIndex];
  if(!sprite || !sprite.complete || !sprite.naturalWidth){
    drawFallbackCharacter();
    return;
  }

  // Sprite is slightly angled toward the camera while still facing right.
  const drawW = 70;
  const drawH = 94;
  const drawX = player.x - 13;
  const drawY = player.y + player.h - drawH + 7;

  ctx.save();
  if(player.jumping){
    ctx.translate(drawX + drawW/2, drawY + drawH/2);
    ctx.rotate(-0.07);
    ctx.drawImage(sprite, -drawW/2, -drawH/2, drawW, drawH);
  }else{
    const bob = Math.abs(Math.sin(player.anim*2.4))*1.5;
    ctx.drawImage(sprite, drawX, drawY-bob, drawW, drawH);
  }

  // Cyan/purple dash trail
  if(dashTime>0){
    ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=.48;
    ctx.fillStyle='#72e9ff';
    ctx.fillRect(player.x-28,player.y+20,25,3);
    ctx.fillStyle='#d77cff';
    ctx.fillRect(player.x-23,player.y+31,19,2);
  }
  ctx.restore();
}

// วาดสิ่งกีดขวางตามธีมด่าน
function drawObstacle(o){
  const s=scenes[o.stage], e=s.ob[OB_IDX[o.type]];
  const size={tall:40,long:31,air:26,rock:32,spikes:29}[o.type];
  const cols=Math.max(1,Math.round(o.w/size)), rows=Math.max(1,Math.round(o.h/size));
  const cw=o.w/cols, ch=o.h/rows;
  ctx.save();
  ctx.font=`${size}px sans-serif`;
  ctx.textAlign="center"; ctx.textBaseline="bottom";
  ctx.shadowColor=s.accent; ctx.shadowBlur=o.type==="air"?3:10;
  if(o.type==="air"){ // เส้นลากความเร็ว + กะพริบเล็กน้อย ทำให้เล็งยากขึ้น
    ctx.fillStyle=s.accent+"55";
    ctx.fillRect(o.x+o.w+2,o.y+5,22,2); ctx.fillRect(o.x+o.w+8,o.y+12,14,2);
    ctx.globalAlpha=.8+.2*Math.sin(o.ph*3+o.x*.05);
  }
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    ctx.fillText(e,o.x+cw*(c+.5),o.y+ch*(r+1)+3);
  }
  ctx.restore();
}

// ฉากหลังแต่ละด่าน (วนลูปต่อเนื่อง ไม่มีรอยต่อ: ทุกอย่างคำนวณจากระยะทางที่วิ่ง dist)
const rnd = j => { const x=Math.sin(j*127.1+311.7)*43758.5453; return x-Math.floor(x); };
function lay(k,P,cb){ // วางของซ้ำๆ เลื่อนตามพารัลแลกซ์ ไม่มีวันหมด
  const o=dist*k, j0=Math.floor(o/P);
  for(let j=j0-2;j<j0+Math.ceil(W/P)+3;j++) cb(j*P-o,j,rnd(j));
}
const C=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();};
const R=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
const T=(a,b,c,d,e,f,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.lineTo(e,f);ctx.fill();};
function glow(x,y,r,c,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c+a);g.addColorStop(1,c+"00");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
function line(pts,col,w){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}

const themes = [
// 0 HELL GATE: พระจันทร์เลือด ยอดแหลม ปราสาทปีศาจ ทะเลลาวา ประกายไฟลอย
s=>{
  glow(735,95,130,s.accent,"66"); C(735,95,42,"#ff3b2f");
  lay(.08,75,(x,j,r)=>T(x-30,groundY,x+20,groundY-70-r*100,x+85,groundY,s.far));
  lay(.16,300,(x,j,r)=>{ if(r<.4) return; const h=110+r*70;
    R(x,groundY-h,30,h,"#1a050a"); T(x-6,groundY-h,x+15,groundY-h-45,x+36,groundY-h,"#1a050a");
    R(x+13,groundY-h+16,5,9,s.accent); R(x+13,groundY-h+44,5,9,s.accent); });
  const g=ctx.createLinearGradient(0,groundY-60,0,groundY); g.addColorStop(0,s.line+"00"); g.addColorStop(1,s.line+"99");
  ctx.fillStyle=g; ctx.fillRect(0,groundY-60,W,60);
  for(let i=0;i<28;i++){ const sp=.4+(i%3)*.25, x=((i*79-dist*.25*sp)%W+W)%W+Math.sin(dist*.02+i)*8;
    R(x,groundY-((dist*sp+i*53)%groundY),3,3,i%2?s.accent:s.line); }
},
// 1 VOLCANO: ภูเขาไฟพ่นลาวา ควัน เถ้าถ่าน
s=>{
  lay(.15,140,(x,j,r)=>T(x-40,groundY,x+30,groundY-40-r*40,x+100,groundY,"#2c1215"));
  lay(.07,480,(x,j,r)=>{ const h=150+r*70, w=190;
    ctx.fillStyle=s.far; ctx.beginPath(); ctx.moveTo(x-w,groundY); ctx.lineTo(x-34,groundY-h); ctx.lineTo(x+34,groundY-h); ctx.lineTo(x+w,groundY); ctx.fill();
    glow(x,groundY-h,80,s.accent,"aa"); R(x-26,groundY-h-3,52,7,s.accent);
    line([[x-8,groundY-h+4],[x-30,groundY-h*.4]],s.accent,3); line([[x+10,groundY-h+4],[x+40,groundY-h*.3]],s.accent,3);
    for(let k=0;k<5;k++){ const t=(dist*.4+k*40)%200; C(x+Math.sin(k+t*.03)*14,groundY-h-t,10+t*.12,"#3a1f2255"); } });
  for(let i=0;i<35;i++){ const sp=.5+(i%3)*.3; R(((i*97-dist*.15)%W+W)%W,(dist*sp+i*37)%groundY,2,2,"#ffc15e99"); }
},
// 2 HAUNTED GRAVEYARD: พระจันทร์เต็มดวง ต้นไม้แห้ง ป้ายหลุมศพ หมอก ค้างคาว
s=>{
  glow(700,90,130,s.accent,"44"); C(700,90,38,"#e7ffe9"); C(688,82,6,"#c9e8d0"); C(712,100,8,"#c9e8d0");
  lay(.1,330,(x,j,r)=>{ if(r<.3) return;
    line([[x,groundY],[x+4,groundY-120]],s.far,8);
    line([[x+3,groundY-70],[x-35,groundY-120]],s.far,4); line([[x+4,groundY-95],[x+40,groundY-140]],s.far,4); line([[x+4,groundY-120],[x-10,groundY-160]],s.far,4); });
  lay(.2,110,(x,j,r)=>{ if(r<.35) return; const h=34+r*26;
    ctx.fillStyle=s.far; ctx.beginPath(); ctx.arc(x+14,groundY-h+14,14,Math.PI,0); ctx.lineTo(x+28,groundY); ctx.lineTo(x,groundY); ctx.fill();
    R(x+12,groundY-h+8,4,14,"#0d0b1c"); R(x+8,groundY-h+12,12,3,"#0d0b1c"); });
  for(let k=0;k<3;k++){ ctx.fillStyle="#b8f5c012"; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.ellipse(((i*230-dist*.08*(k+1))%(W+200)+W+200)%(W+200)-100,groundY-14-k*20,150,12,0,0,7); ctx.fill(); } }
  for(let i=0;i<4;i++){ const x=((i*300-dist*.5)%W+W)%W, y=70+i*28+Math.sin(dist*.05+i)*10; T(x-8,y-4+Math.sin(dist*.2+i)*3,x,y+1,x+8,y-4+Math.sin(dist*.2+i)*3,"#0d0b1c"); }
},
// 3 SUNSET DESERT: พระอาทิตย์ตกดิน พีระมิด เนินทราย กระบองเพชร
s=>{
  glow(620,185,210,s.accent,"55"); C(620,185,62,s.accent);
  lay(.05,560,(x,j,r)=>{ const h=100+r*30; T(x,groundY,x+130,groundY-h,x+260,groundY,s.far); T(x+130,groundY,x+130,groundY-h,x+260,groundY,"#00000026"); });
  ctx.fillStyle=mix(s.far,s.ground,.5); ctx.beginPath(); ctx.moveTo(0,groundY);
  for(let x=0;x<=W;x+=10){ const u=(x+dist*.12); ctx.lineTo(x,groundY-28-22*Math.sin(u*.011)-12*Math.sin(u*.027)); }
  ctx.lineTo(W,groundY); ctx.fill();
  lay(.22,200,(x,j,r)=>{ if(r<.4) return; const h=50+r*40, c="#3a2229";
    R(x,groundY-h,10,h,c); R(x-14,groundY-h*.6,14,6,c); R(x-14,groundY-h*.6-16,6,20,c); R(x+10,groundY-h*.45,14,6,c); R(x+18,groundY-h*.45-16,6,20,c); });
},
// 4 EMERALD FOREST: ป่าสน 2 ชั้น แสงลอดใบไม้ หิ่งห้อย
s=>{
  glow(700,80,140,s.accent,"33"); C(700,80,30,"#e9ffd0");
  const pine=(x,h,w,c)=>{ R(x-3,groundY-12,6,12,c); for(let k=0;k<3;k++){ const b=groundY-12-k*h*.28, ww=w*(1-k*.22); T(x-ww,b,x,b-h*.45,x+ww,b,c); } };
  lay(.08,55,(x,j,r)=>pine(x,90+r*50,28,s.far));
  ctx.fillStyle="#d8ffb010"; for(let k=0;k<3;k++){ const x=80+k*300; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+60,0); ctx.lineTo(x+160,groundY); ctx.lineTo(x+60,groundY); ctx.fill(); }
  lay(.2,95,(x,j,r)=>pine(x,120+r*60,38,mix(s.far,"#0b1a14",.55)));
  for(let i=0;i<18;i++){ if(Math.sin(dist*.05+i*2)>-.2) C(((i*113-dist*.12)%W+W)%W,groundY-40-((i*47)%150)+Math.sin(dist*.03+i)*12,2.5,s.accent); }
},
// 5 FROZEN PEAK: ภูเขาน้ำแข็งยอดหิมะ แสงเหนือ ผลึกน้ำแข็ง หิมะตก
s=>{
  const bands=[s.accent+"30","#7dffb630","#c28bff30"];
  for(let b=0;b<3;b++){ ctx.fillStyle=bands[b]; ctx.beginPath();
    for(let x=0;x<=W;x+=20) ctx.lineTo(x,40+b*26+22*Math.sin(x*.01+dist*.004+b*2));
    for(let x=W;x>=0;x-=20) ctx.lineTo(x,90+b*26+22*Math.sin(x*.01+dist*.004+b*2));
    ctx.fill(); }
  C(150,90,22,"#f4fdff");
  lay(.06,360,(x,j,r)=>{ const h=130+r*80; T(x-60,groundY,x+120,groundY-h,x+300,groundY,s.far); T(x+66,groundY-h*.7,x+120,groundY-h,x+174,groundY-h*.7,"#eafcff"); });
  lay(.18,130,(x,j,r)=>T(x,groundY,x+14,groundY-40-r*50,x+28,groundY,s.line+"99"));
  for(let i=0;i<60;i++){ const sp=.4+(i%4)*.2; R(((i*71-dist*.15*sp)%W+W)%W,(dist*sp*.8+i*29)%groundY,2.5,2.5,"#ffffffcc"); }
},
// 6 STORM SKY: เมฆดำ ฟ้าแลบ ฝนตก
s=>{
  const dk=mix(s.far,"#10172a",.5);
  lay(.1,210,(x,j,r)=>{ const y=40+r*90; for(let k=0;k<4;k++) C(x+k*34,y+(k%2)*10,32+(k%3)*8,s.far); R(x-10,y+10,150,26,s.far); });
  lay(.18,260,(x,j,r)=>{ const y=110+r*70; for(let k=0;k<4;k++) C(x+k*40,y+(k%2)*12,38+(k%3)*8,dk); R(x-10,y+12,170,30,dk); });
  const ph=dist%900;
  if(ph<45){ R(0,0,W,groundY,"#ffffff1c"); const bx=150+rnd(Math.floor(dist/900))*600;
    line([[bx,70],[bx-18,150],[bx+8,170],[bx-30,groundY]],"#fff7b0",3); }
  for(let i=0;i<70;i++){ const x=((i*37-dist*.5)%W+W)%W, y=(dist*3+i*61)%groundY; line([[x,y],[x-4,y+14]],"#cfe0ff55",1); }
},
// 7 NEON CITY: ตึกระฟ้า หน้าต่างไฟ ป้ายนีออน
s=>{
  glow(735,95,120,s.accent,"55"); C(735,95,34,s.accent);
  lay(.08,82,(x,j,r)=>{ const h=100+r*130, w=62; R(x,groundY-h,w,h,s.far);
    for(let yy=groundY-h+10;yy<groundY-8;yy+=16) for(let xx=x+7;xx<x+w-8;xx+=14)
      if(rnd(j*31+yy)>.55) R(xx,yy,6,8,rnd(j*7+yy)>.5?s.line:s.accent+"cc");
    if(r>.7){ R(x+w/2-1,groundY-h-22,2,22,s.far); R(x+w/2-3,groundY-h-26,6,5,Math.sin(dist*.05+j)>0?"#ff4060":"#40000a"); } });
  lay(.22,140,(x,j,r)=>{ const h=60+r*60, w=100, c=j%2?s.accent:s.line;
    R(x,groundY-h,w,h,"#0f1330"); glow(x+w/2,groundY-h+15,46,c,"66"); R(x+10,groundY-h+10,w-20,8,c); R(x+22,groundY-h+26,w-44,5,c+"aa"); });
},
// 8 CYBERSPACE: ดวงอาทิตย์ซินธ์เวฟ เส้นกริด ลูกบาศก์ลวด สายฝนข้อมูล
s=>{
  C(735,115,56,s.accent+"cc"); for(let k=0;k<5;k++) R(675,118+k*11,120,3+k,s.sky);
  ctx.strokeStyle=s.line+"33"; ctx.lineWidth=1;
  lay(.4,60,x=>{ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,groundY); ctx.stroke(); });
  for(let y=20;y<groundY;y+=40){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  lay(.14,260,(x,j,r)=>{ const y=50+r*140, z=24+r*26;
    ctx.strokeStyle=s.accent; ctx.lineWidth=2; ctx.strokeRect(x,y,z,z); ctx.strokeRect(x+8,y-8,z,z);
    ctx.beginPath(); [[0,0],[z,0],[0,z],[z,z]].forEach(p=>{ctx.moveTo(x+p[0],y+p[1]);ctx.lineTo(x+p[0]+8,y+p[1]-8);}); ctx.stroke(); });
  lay(.3,34,(x,j,r)=>{ const y0=((dist*(.6+r*1.2)+r*900)%(groundY+120))-60;
    for(let k=0;k<7;k++) R(x,y0-k*10,5,7,s.line+["ff","dd","bb","99","77","55","33"][k]); });
},
// 9 GALAXY: เนบิวลา ดาวเคราะห์มีวงแหวน ดาวตก
s=>{
  lay(.03,600,(x,j,r)=>glow(x+200,90+r*160,260,[s.line,s.accent,"#4aa8ff"][((j%3)+3)%3],"33"));
  lay(.07,430,(x,j,r)=>{ const y=60+r*190, rad=22+r*40;
    glow(x,y,rad*2,"#ffffff","15"); C(x,y,rad,mix(s.line,"#2a1b5c",.4+r*.4)); C(x-rad*.3,y-rad*.3,rad*.55,"#ffffff18");
    if(r>.5){ ctx.strokeStyle=s.accent+"aa"; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(x,y,rad*1.7,rad*.4,-.3,0,7); ctx.stroke(); } });
  const ph=dist%700; if(ph<60){ const px=W-ph*14, py=40+ph*3; line([[px,py],[px+70,py-21]],"#ffffffcc",2); }
}
];

// ฉากหลัง: ไล่สีและเปลี่ยนธีมแบบค่อยๆ เลื่อน
function drawBackground(){
  const a=scenes[prevScene], b=scenes[sceneIndex];
  const t=sceneT*sceneT*(3-2*sceneT);
  const sky=mix(a.sky,b.sky,t), ground=mix(a.ground,b.ground,t), lineC=mix(a.line,b.line,t);

  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  const sa=a.stars+(b.stars-a.stars)*t;
  if(sa>0){
    ctx.fillStyle="#fff";
    for(let i=0;i<45;i++){
      ctx.globalAlpha=sa*(.35+.35*Math.sin(dist*.02+i));
      ctx.fillRect(((i*97-dist*.04*(1+i%3))%W+W)%W,(i*53)%230,2,2);
    }
    ctx.globalAlpha=1;
  }

  if(prevScene!==sceneIndex && sceneT<1){
    ctx.save(); ctx.globalAlpha=1-t; themes[prevScene](a); ctx.restore();
    ctx.save(); ctx.globalAlpha=t;   themes[sceneIndex](b); ctx.restore();
  }else themes[sceneIndex](b);

  ctx.fillStyle=ground; ctx.fillRect(0,groundY,W,H-groundY);
  ctx.fillStyle=lineC;  ctx.fillRect(0,groundY,W,3);
  ctx.fillStyle="#ffffff25";
  for(let x=0;x<W+38;x+=38) ctx.fillRect(x-(dist%38),groundY+17,17,3);

  ctx.fillStyle="#ffffff9a"; ctx.font="bold 13px monospace";
  ctx.fillText(b.name,18,25);
}

// เอฟเฟกต์ตอนพุ่งอมตะ: ออร่า + เส้นความเร็ว
function drawRushFX(){
  if(superTime<=0) return;
  const s=scenes[sceneIndex];
  glow(player.x+22,player.y+32,95,s.accent,"88");
  ctx.fillStyle=s.accent+"77";
  for(let i=0;i<16;i++) ctx.fillRect(Math.random()*W,Math.random()*groundY,60+Math.random()*140,2);
}

// วนลูปเกม
function loop(now){
  try{ loopInner(now); }catch(err){ showErr(err); }
}

function loopInner(now){
  if(!running) return;

  const dt=Math.max(0,Math.min((now-lastTime)/16.67,2)); // กัน dt ติดลบในเฟรมแรก
  lastTime=now;

  // สถานะพุ่งอมตะ -> อมตะต่ออีก 3 วินาที -> กลับมาแดชได้
  if(superTime>0){
    superTime-=dt;
    if(superTime<=0){ superTime=0; graceTime=GRACE_SECONDS*60; }
  }else if(graceTime>0){
    graceTime-=dt;
    if(graceTime<=0){ graceTime=0; dashReady=true; }
  }
  const rushMul = superTime>0 ? SUPER_MULT : 1;

  // เพิ่มคะแนนและความเร็ว
  // คะแนนเพิ่มตามความเร็ว ยิ่งวิ่งเร็ว คะแนนยิ่งไหลเร็ว
  score += .12 * (speed * rushMul / 5) * dt;
  speed = START_SPEED + (MAX_SPEED-START_SPEED)*Math.min(score/MAX_SPEED_SCORE,1);

  // เปลี่ยนฉากทุก 450 คะแนน
  const nextScene=Math.max(0,Math.min(
    Math.floor(score/STAGE_LEN)||0,
    scenes.length-1
  ));

  if(sceneT<1) sceneT=Math.min(1,sceneT+dt/150); // เลื่อนฉาก ~2.5 วินาที
  if(banner>0) banner-=dt;

  if(nextScene!==sceneIndex){
    prevScene=sceneIndex;
    sceneIndex=nextScene;
    sceneT=0;

    for(let i=0;i<18;i++){
      particles.push({
        x:Math.random()*W,
        y:Math.random()*H/2,
        vx:(Math.random()-.5)*2,
        life:35
      });
    }
  }

  // คูลดาวน์ Dash
  if(dashCooldown>0){
    dashCooldown-=dt;

    if(dashCooldown<=0){
      dashCooldown=0;
      dashReady=true;
    }
  }

  if(dashTime>0) dashTime-=dt;
  if(hitCooldown>0) hitCooldown-=dt;

  // การกระโดดและแรงโน้มถ่วง
  player.vy+=.62*dt;
  player.y+=player.vy*dt;

  if(player.y>=groundY-player.h){
    player.y=groundY-player.h;
    player.vy=0;
    player.jumping=false;
  }

  player.anim+=.22*dt;

  // สร้างสิ่งกีดขวาง
  spawnTimer-=dt*rushMul;

  if(spawnTimer<=0){
    spawnObstacle();
    const dif=Math.min(score/MAX_SPEED_SCORE,1);
    spawnTimer=(95-55*dif)+Math.random()*(38-10*dif);
  }

  // เคลื่อนที่สิ่งกีดขวาง
  const mv=(speed+(dashTime>0?2.5:0))*rushMul;
  dist+=mv*dt;
  obstacles.forEach(o=>{
    o.x-=mv*(o.vx||1)*dt;
    if(o.type==="air") o.y=o.by+Math.sin(o.ph+=.11*dt)*o.amp; // ลอยขึ้นลง
  });

  obstacles=obstacles.filter(o=>o.x+o.w>0);

  // ตรวจสอบการชน
  const p={
    x:player.x+7,
    y:player.y+5,
    w:player.w-14,
    h:player.h-7
  };

  for(const o of obstacles){
    if(!hitbox(p,o)) continue;
    // แดชธรรมดาผ่านสิ่งกีดขวาง: ลดคูลดาวน์ 0.5 วินาทีต่อชิ้น (นับครั้งเดียวต่อชิ้น)
    if(dashTime>0 && superTime<=0 && !o.dodged){
      o.dodged=true;
      if(dashCooldown>0){
        dashCooldown=Math.max(0,dashCooldown-DODGE_REFUND);
        if(dashCooldown<=0) dashReady=true;
      }
      for(let i=0;i<6;i++) particles.push({x:o.x+o.w/2,y:o.y+o.h/2,vx:(Math.random()-.5)*6,life:16});
    }
    takeHit();
  }

  // เอฟเฟกต์
  particles.forEach(p=>{
    p.x+=p.vx*dt;
    p.y+=.15*dt;
    p.life-=dt;
  });

  particles=particles.filter(p=>p.life>0);

  // วาดทุกอย่าง
  drawBackground();
  obstacles.forEach(drawObstacle);
  if(graceTime>0) ctx.globalAlpha=.5+.3*Math.sin(graceTime*.4); // กะพริบตอนอมตะต่อ
  drawPixelCharacter();
  ctx.globalAlpha=1;
  drawRushFX();

  particles.forEach(p=>{
    ctx.fillStyle = scenes[sceneIndex].accent;
    ctx.fillRect(p.x,p.y,4,4);
  });

  updateHUD();

  requestAnimationFrame(loop);
}

// เริ่มต้นหน้าเกม
drawBackground();
drawPixelCharacter();
showStart();
updateHUD();