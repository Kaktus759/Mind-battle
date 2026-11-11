(() => {
  const $ = id => document.getElementById(id);
  const socket = io('/fighting');
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  let me = -1, state = null, code = null, announced = '';
  const input = {left:false,right:false,block:false};
  const fighterPics = ['dylan','tolyan'].map(n => {const img=new Image();img.src='/fighters/'+n+'-cutout.png';return img;});
  const keymap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowDown:'block',KeyS:'block'};
  const animState=[{clock:0,action:'idle',duration:0,hitSerial:0},{clock:0,action:'idle',duration:0,hitSerial:0}];
  let lastPacket=performance.now(),lastFrame=performance.now(),shake=0;
  const particles=[];
  function sendInput(){socket.emit('input',input);}
  function setHeld(k,pressed){if(input[k]!==pressed){input[k]=pressed;sendInput();}}
  function attack(type){if(state?.phase==='playing')socket.emit('attack',type);}
  $('create').onclick=()=>socket.emit('create',{name:$('name').value});
  $('join').onclick=()=>socket.emit('join',{name:$('name').value,code:$('codeInput').value});
  $('ready').onclick=()=>socket.emit('ready');
  $('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);$('copyCode').textContent='Скопировано';setTimeout(()=>$('copyCode').textContent='Скопировать код',1500);}catch{window.prompt('Скопируй код:',code);}};
  socket.on('connect',()=>{$('connection').textContent='🟢 В сети';});
  socket.on('disconnect',()=>{$('connection').textContent='🔴 Нет соединения';for(const k of Object.keys(input))setHeld(k,false);});
  socket.on('errorMessage',msg=>{$('error').textContent=msg;});
  socket.on('notice',msg=>{announced=msg;});
  socket.on('joined',data=>{code=data.code;me=data.index;$('roomCode').textContent=code;$('lobby').classList.add('hidden');$('game').classList.remove('hidden');$('error').textContent='';});
  function sparks(x,y,index,blocked){
    const color=blocked?'#66e5ff':index===0?'#e9b1ff':'#ffcb54';
    for(let i=0;i<17;i++){
      const a=Math.random()*Math.PI*2,v=1.8+Math.random()*7;
      particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2,life:14+Math.random()*17,max:31,color,r:1.5+Math.random()*3});
    }
    shake=blocked?3:8;
  }
  socket.on('state',data=>{
    const previous=state;state=data;lastPacket=performance.now();
    for(const p of data.players){
      const a=animState[p.index];
      if(p.hitSerial!==a.hitSerial){
        if(previous && data.phase!=='waiting')sparks(p.x,235,p.index,p.action==='block');
        a.hitSerial=p.hitSerial;
      }
      a.action=p.action;a.duration=p.actionDuration||0;a.clock=p.actionElapsed||0;
    }
    updateUI();
  });
  function updateUI(){
    if(!state)return;
    for(let i=0;i<2;i++){
      const p=state.players.find(p=>p.index===i);
      $('n'+i).textContent=(i===0?'ДИЛАН':'ТОЛЯН')+(p?(i===me?' · ТЫ':''):' · ОЖИДАНИЕ');
      $('hp'+i).style.width=(p?.hp??100)+'%';
    }
    $('timer').textContent=state.seconds;
    const overlay=$('overlay'),title=$('headline'),details=$('details'),ready=$('ready');
    const self=state.players.find(p=>p.index===me);
    overlay.classList.toggle('hidden',state.phase==='playing');ready.classList.add('hidden');
    if(state.phase==='waiting'){
      title.textContent='ОЖИДАНИЕ СОПЕРНИКА';details.textContent=announced||'Пригласи друга, отправив ему код комнаты '+code;
      if(state.players.length===2){title.textContent='БОЙ ПОЧТИ НАЧАЛСЯ';details.textContent=self?.ready?'Ждём готовности соперника':'Оба игрока должны нажать «Готов к бою»';if(!self?.ready)ready.classList.remove('hidden');}
    }else if(state.phase==='finished'){
      title.textContent=state.winner===-1?'НИЧЬЯ!':state.winner===me?'ПОБЕДА!':'ПОРАЖЕНИЕ';
      details.textContent=self?.ready?'Ожидаем соперника…':'Реванш? Нажми кнопку ниже.';
      if(!self?.ready)ready.classList.remove('hidden');
    }
    ready.textContent=state.phase==='finished'?'РЕВАНШ':'ГОТОВ К БОЮ';
  }
  for(const el of document.querySelectorAll('[data-hold]')){
    const k=el.dataset.hold;
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('pressed');setHeld(k,true);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{el.classList.remove('pressed');setHeld(k,false);});
  }
  for(const el of document.querySelectorAll('[data-attack]'))el.addEventListener('pointerdown',e=>{e.preventDefault();attack(el.dataset.attack);});
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT')return;
    if(keymap[e.code]){e.preventDefault();setHeld(keymap[e.code],true);}
    else if(!e.repeat&&e.code==='KeyJ')attack('punch');else if(!e.repeat&&e.code==='KeyK')attack('kick');
  });
  document.addEventListener('keyup',e=>{if(keymap[e.code]){e.preventDefault();setHeld(keymap[e.code],false);}});
  window.addEventListener('blur',()=>{for(const k of Object.keys(input))setHeld(k,false);});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const pulse=(v,a,b,c,d)=>v<a||v>d?0:v<b?ease((v-a)/(b-a)):v<c?1:1-ease((v-c)/(d-c));
  function capsule(ax,ay,bx,by,width,c1,c2){
    const g=ctx.createLinearGradient(ax-width,ay,bx+width,by);g.addColorStop(0,c1);g.addColorStop(.55,c2);g.addColorStop(1,c1);
    ctx.lineCap='round';ctx.strokeStyle='#090b19';ctx.lineWidth=width+5;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    ctx.strokeStyle=g;ctx.lineWidth=width;ctx.stroke();
  }
  function glove(x,y,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ctx.fillStyle='#121525';ctx.strokeStyle='#d2d0ea';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,15,11,-.12,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#8c85a7';ctx.fillRect(-8,-8,8,3);ctx.restore();
  }
  function boot(x,y,angle=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#090c17';ctx.strokeStyle='#a2a8c3';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-5,-11);ctx.lineTo(21,-9);ctx.quadraticCurveTo(38,-3,36,5);ctx.lineTo(-12,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function drawFighter(p,t){
    const a=animState[p.index];
    const ms=a.clock+Math.min(45,t-lastPacket),kind=p.action;
    const v=a.duration?clamp(ms/a.duration,0,1):0;
    const punch=kind==='punch'?pulse(v,.04,.29,.48,.95):0;
    const kick=kind==='kick'?pulse(v,.06,.36,.60,.95):0;
    const hurt=kind==='hurt'?Math.sin(Math.PI*clamp(v,0,1)):0;
    const knocked=kind==='ko'||(state?.phase==='finished'&&p.hp<=0);
    const walking=kind==='walk';const walk=walking?Math.sin(t/105):0;
    const breathe=Math.sin(t/420)*1.7;
    const image=fighterPics[p.index],height=p.index===0?302:320;
    const width=image.naturalWidth?image.naturalWidth/image.naturalHeight*height:138;
    const dir=p.facing;
    ctx.save();ctx.translate(p.x,430);
    ctx.fillStyle='#02051399';ctx.beginPath();ctx.ellipse(0,8,53+6*(punch+kick),10,0,0,Math.PI*2);ctx.fill();
    // Rendering in local facing coordinates: the opposite side is mirrored.
    ctx.scale(dir,1);
    ctx.translate(-hurt*15+punch*13+kick*12,walking?Math.abs(walk)*-5:breathe);
    if(knocked){ctx.translate(-32,10);ctx.rotate(-1.28);}
    else ctx.rotate(-hurt*.17+punch*.055-kick*.09);
    if(image.complete&&image.naturalWidth){
      ctx.shadowColor=p.index===0?'#9155ff':'#3df4ac';ctx.shadowBlur=12;
      ctx.drawImage(image,-width/2,-height,width,height);ctx.shadowBlur=0;
    }else{ctx.fillStyle=p.index===0?'#6350a5':'#378d71';ctx.fillRect(-45,-height,90,height);}
    // An articulated foreground arm with shoulder, elbow and fist is drawn over the photo.
    // Unlike the older effect, it physically extends and retracts on each attack.
    if(punch>0.01){
      const reach=punch*93,elbowX=24+reach*.43,elbowY=-185-15*punch,fistX=30+reach,fistY=-199+17*punch;
      capsule(12,-216,elbowX,elbowY,27,'#111528','#323448');
      capsule(elbowX,elbowY,fistX,fistY,23,'#8d5d4e','#d1a18b');
      glove(fistX,fistY,1.18);
      ctx.save();ctx.globalAlpha=punch*.7;ctx.lineWidth=5;ctx.strokeStyle='#ffd977';ctx.shadowColor='#ffe35e';ctx.shadowBlur=20;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(fistX-11,-214+i*14);ctx.lineTo(fistX+30,-214+i*14);ctx.stroke();}
      ctx.restore();
    }
    // Articulated kick with thigh, knee, extended shin and shoe.
    if(kick>0.01){
      const kneeX=9+kick*43,kneeY=-112-kick*22,footX=10+kick*131,footY=-20-kick*117;
      capsule(7,-123,kneeX,kneeY,43,'#080b19','#27293c');
      capsule(kneeX,kneeY,footX,footY,37,'#101321','#242638');boot(footX,footY,-.22*kick);
      ctx.save();ctx.globalAlpha=kick*.75;ctx.strokeStyle='#8affd2';ctx.lineWidth=7;ctx.shadowColor='#4dfec6';ctx.shadowBlur=24;
      ctx.beginPath();ctx.arc(footX-15,footY+5,25,-1.3,1.1);ctx.stroke();ctx.restore();
    }
    if(kind==='block'){
      capsule(15,-218,38,-183,28,'#111324','#303a51');capsule(38,-183,9,-252,22,'#ab7c68','#ddad93');glove(9,-252,1.05);
      ctx.save();ctx.strokeStyle='#56dfff';ctx.lineWidth=6;ctx.shadowColor='#56dfff';ctx.shadowBlur=25;ctx.globalAlpha=.7+.2*Math.sin(t/130);
      ctx.beginPath();ctx.arc(19,-175,64,-1.3,1.3);ctx.stroke();ctx.restore();
    }
    if(hurt){ctx.globalAlpha=.4*hurt;ctx.fillStyle='#ff5566';ctx.fillRect(-width/2,-height,width,height);}
    ctx.restore();
  }
  function renderParticles(){
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.22;p.life--;
      ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=14;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore();if(p.life<=0)particles.splice(i,1);
    }
  }
  function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function frame(t){
    const dt=Math.min(50,t-lastFrame);lastFrame=t;
    // Keep animations flowing between 30 Hz server updates.
    for(const a of animState)a.clock+=dt;
    ctx.clearRect(0,0,960,540);
    ctx.save();if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.81;if(shake<.3)shake=0;}
    const bg=ctx.createLinearGradient(0,0,0,540);bg.addColorStop(0,'#111832');bg.addColorStop(.75,'#453262');bg.addColorStop(1,'#181833');ctx.fillStyle=bg;ctx.fillRect(0,0,960,540);
    ctx.fillStyle='#b54c8540';ctx.beginPath();ctx.arc(480,190,145,0,Math.PI*2);ctx.fill();
    for(let i=0;i<11;i++){let x=i*105-55;roundRect(x,228,74,200,10,i%2?'#2b2d57':'#222645');}
    ctx.fillStyle='#f9b439';ctx.font='900 65px system-ui';ctx.textAlign='center';ctx.fillText('MIND BATTLE',480,110);ctx.font='700 17px system-ui';ctx.fillStyle='#fff9';ctx.fillText('ДИЛАН VS ТОЛЯН  ·  ONLINE ARENA',480,139);
    ctx.fillStyle='#2b2842';ctx.fillRect(0,430,960,110);ctx.fillStyle='#ffc43a';ctx.fillRect(0,428,960,5);ctx.strokeStyle='#ffc43a26';ctx.lineWidth=2;
    for(let x=0;x<960;x+=80){ctx.beginPath();ctx.moveTo(x,430);ctx.lineTo(x-60,540);ctx.stroke();}
    for(const p of state?.players||[])drawFighter(p,t);
    renderParticles();ctx.restore();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
