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
let hitCooldown = 0;
let sceneIndex = 0;
let playerName = "Runner";

const player = {
  x: 120, y: groundY - 54,
  w: 42, h: 54,
  vy: 0, jumping: false, anim: 0
};

// ฉากทั้งหมด 5 แบบ
const scenes = [
  {name:"EMERALD FOREST",sky:"#182d3a",far:"#254b50",ground:"#315a4d",line:"#86d69b",accent:"#b8ef8a"},
  {name:"SUNSET DESERT",sky:"#3d2945",far:"#8b5260",ground:"#9b684b",line:"#ffd18a",accent:"#ffb86b"},
  {name:"NEON CITY",sky:"#171d42",far:"#343b70",ground:"#292e52",line:"#66e8ef",accent:"#ff70c8"},
  {name:"FROZEN PEAK",sky:"#1b344d",far:"#54738b",ground:"#7b9eae",line:"#d7f7ff",accent:"#a5e8ff"},
  {name:"LAVA ZONE",sky:"#321d2c",far:"#673342",ground:"#49313a",line:"#ff805b",accent:"#ffc15e"}
];

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

  $("dash-status").textContent = dashReady
    ? "DASH: READY"
    : `DASH: ${(dashCooldown/60).toFixed(1)}s`;
}

// เริ่มเกม
function startGame(){
  playerName =
    $("player-name").value.trim().slice(0,16) || "Runner";

  score = 0;
  lives = 3;
  speed = 5;
  obstacles = [];
  particles = [];
  spawnTimer = 65;

  dashReady = true;
  dashTime = 0;
  dashCooldown = 0;
  dashUses = 0;
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
function dash(){
  if(!running || !dashReady) return;

  dashReady = false;
  dashTime = 18;
  dashUses++;

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

$("start-btn").addEventListener("click",startGame);
$("again-btn").addEventListener("click",showStart);

// สุ่มสิ่งกีดขวาง
function spawnObstacle(){
  const roll = Math.random();
  let o;

  if(roll<.22){
    // สิ่งกีดขวางสูง
    o={type:"tall",x:W+10,y:groundY-78,w:34,h:78};

  }else if(roll<.47){
    // สิ่งกีดขวางยาว
    o={type:"long",x:W+10,y:groundY-30,w:88+Math.random()*35,h:30};

  }else if(roll<.68){
    // สิ่งกีดขวางกลางอากาศ
    o={type:"air",x:W+10,y:groundY-112-Math.random()*18,w:36,h:22};

  }else if(roll<.84){
    o={type:"rock",x:W+10,y:groundY-29,w:34,h:29};

  }else{
    o={type:"spikes",x:W+10,y:groundY-25,w:58,h:25};
  }

  obstacles.push(o);
}

function hitbox(p,o){
  return p.x<o.x+o.w &&
    p.x+p.w>o.x &&
    p.y<o.y+o.h &&
    p.y+p.h>o.y;
}

// เสียชีวิตเมื่อชน
function takeHit(){
  if(hitCooldown>0 || dashTime>0) return;

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

// วาดตัวละครอนิเมะพิกเซล
function drawPixelCharacter(){
  const x=Math.round(player.x);
  const y=Math.round(player.y);
  const frame=Math.floor(player.anim)%2;

  if(hitCooldown>0 && Math.floor(hitCooldown/7)%2===0){
    return;
  }

  ctx.save();

  if(dashTime>0){
    ctx.globalAlpha=.8;
    ctx.fillStyle="#ffe08a";
    ctx.fillRect(x-27,y+17,28,23);
    ctx.globalAlpha=1;
  }

  // ผมด้านหลัง
  ctx.fillStyle="#493044";
  ctx.fillRect(x+8,y+2,27,18);
  ctx.fillRect(x+4,y+10,8,20);

  // ใบหน้า
  ctx.fillStyle="#ffd5b5";
  ctx.fillRect(x+10,y+9,24,22);
  ctx.fillRect(x+7,y+15,4,10);

  // ผมหน้าม้า
  ctx.fillStyle="#493044";
  ctx.fillRect(x+8,y+5,25,9);
  ctx.fillRect(x+13,y+11,7,6);
  ctx.fillRect(x+26,y+10,7,5);

  // ดวงตาและแก้ม
  ctx.fillStyle="#34243a";
  ctx.fillRect(x+15,y+20,3,4);
  ctx.fillRect(x+27,y+20,3,4);

  ctx.fillStyle="#f28b91";
  ctx.fillRect(x+12,y+25,4,2);
  ctx.fillRect(x+29,y+25,4,2);

  // เสื้อ
  ctx.fillStyle="#58b9dc";
  ctx.fillRect(x+8,y+32,28,14);
  ctx.fillRect(x+4,y+35,7,10);

  ctx.fillStyle="#e9f6ff";
  ctx.fillRect(x+18,y+32,5,12);

  // ผ้าพันคอ
  ctx.fillStyle="#ffca70";
  ctx.fillRect(x+9,y+30,25,4);
  ctx.fillRect(x+30,y+33,5,8);

  // ขาวิ่งสลับเฟรม
  ctx.fillStyle="#29344f";

  if(player.jumping){
    ctx.fillRect(x+10,y+45,8,8);
    ctx.fillRect(x+26,y+45,9,6);

  }else if(frame===0){
    ctx.fillRect(x+10,y+44,8,9);
    ctx.fillRect(x+25,y+44,8,6);
    ctx.fillRect(x+29,y+49,9,4);

  }else{
    ctx.fillRect(x+11,y+44,8,6);
    ctx.fillRect(x+7,y+49,9,4);
    ctx.fillRect(x+26,y+44,8,9);
  }

  // รองเท้า
  ctx.fillStyle="#f3f0ff";
  ctx.fillRect(x+6,y+51,11,3);
  ctx.fillRect(x+27,y+51,11,3);

  ctx.restore();
}

// วาดสิ่งกีดขวาง
function drawObstacle(o){
  if(o.type==="tall"){
    ctx.fillStyle="#a5d16b";
    ctx.fillRect(o.x+5,o.y,o.w-10,o.h);
    ctx.fillRect(o.x,o.y+15,o.w,o.h-15);
    ctx.fillStyle="#527e50";
    ctx.fillRect(o.x+10,o.y+8,6,10);
  }

  if(o.type==="long"){
    ctx.fillStyle="#c38b62";
    ctx.fillRect(o.x,o.y+8,o.w,o.h-8);
    ctx.fillStyle="#e5b27a";
    ctx.fillRect(o.x+8,o.y,o.w-16,10);
    ctx.fillStyle="#805a52";

    for(let x=o.x+15;x<o.x+o.w;x+=24){
      ctx.fillRect(x,o.y+13,5,7);
    }
  }

  if(o.type==="air"){
    ctx.fillStyle="#e8d9ff";
    ctx.fillRect(o.x+5,o.y+5,o.w-10,o.h-5);
    ctx.fillStyle="#a58be8";
    ctx.fillRect(o.x,o.y+10,o.w,8);
    ctx.fillStyle="#fff";
    ctx.fillRect(o.x+9,o.y+7,6,4);
  }

  if(o.type==="rock"){
    ctx.fillStyle="#8e9ab8";
    ctx.fillRect(o.x+5,o.y+8,o.w-10,o.h-8);
    ctx.fillRect(o.x+11,o.y,o.w-20,12);
  }

  if(o.type==="spikes"){
    ctx.fillStyle="#ff708b";

    for(let x=o.x;x<o.x+o.w;x+=19){
      ctx.beginPath();
      ctx.moveTo(x,o.y+o.h);
      ctx.lineTo(x+9,o.y);
      ctx.lineTo(x+18,o.y+o.h);
      ctx.fill();
    }
  }
}

// ฉากหลัง
function drawBackground(){
  const s = scenes[sceneIndex] || scenes[0];
if (!s) return;

  ctx.fillStyle=s.sky;
  ctx.fillRect(0,0,W,H);

  // ดวงอาทิตย์
  ctx.fillStyle=s.accent;
  ctx.beginPath();
  ctx.arc(735,82,30,0,Math.PI*2);
  ctx.fill();

  // ภูเขาและตึก
  ctx.fillStyle=s.far;

  for(let i=0;i<9;i++){
    let x=((i*125-(score*.22)%125)+W)%W;
    let h=65+(i%4)*22;

    ctx.fillRect(x,groundY-h,90,h);
    ctx.fillRect(x+20,groundY-h-18,45,18);
  }

  // พื้น
  ctx.fillStyle=s.ground;
  ctx.fillRect(0,groundY,W,H-groundY);

  ctx.fillStyle=s.line;
  ctx.fillRect(0,groundY,W,3);

  ctx.fillStyle="#ffffff25";

  for(let x=0;x<W;x+=38){
    ctx.fillRect((x-(score*1.4)%38),groundY+17,17,3);
  }

  ctx.fillStyle="#ffffff9a";
  ctx.font="bold 13px monospace";
  ctx.fillText(s.name,18,25);
}

// วนลูปเกม
function loop(now){
  if(!running) return;

  const dt=Math.min((now-lastTime)/16.67,2);
  lastTime=now;

  // เพิ่มคะแนนและความเร็ว
  score+=.12*dt;
  speed=Math.min(5+score/100,13);

  // เปลี่ยนฉากทุก 450 คะแนน
  const nextScene=Math.min(
    Math.floor(score/450),
    scenes.length-1
  );

  if(nextScene!==sceneIndex){
    sceneIndex=nextScene;

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
  spawnTimer-=dt;

  if(spawnTimer<=0){
    spawnObstacle();
    spawnTimer=Math.max(38,100-score*.12)+Math.random()*38;
  }

  // เคลื่อนที่สิ่งกีดขวาง
  obstacles.forEach(o=>{
    o.x-=(speed+(dashTime>0?2.5:0))*dt;
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
    if(hitbox(p,o)) takeHit();
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
  drawPixelCharacter();

  particles.forEach(p=>{
    ctx.fillStyle = (scenes[sceneIndex] || scenes[0]).accent;
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