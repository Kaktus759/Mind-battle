(() => {
  const $ = id => document.getElementById(id);
  const socket = io('/fighting');
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  let me = -1, state = null, code = null, announced = '';
  const input = { left:false, right:false, block:false };
  const fighterPics = ['/fighters/dylan.png','/fighters/tolyan.png'].map(url=>{const img=new Image();img.src=url;return img;});
  const keymap = { ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', ArrowDown:'block', KeyS:'block' };
  function sendInput() { socket.emit('input', input); }
  function setHeld(k, pressed) { if (input[k] !== pressed) { input[k] = pressed; sendInput(); } }
  function attack(type) { if (state?.phase === 'playing') socket.emit('attack', type); }
  $('create').onclick = () => socket.emit('create', { name:$('name').value });
  $('join').onclick = () => socket.emit('join', { name:$('name').value, code:$('codeInput').value });
  $('ready').onclick = () => socket.emit('ready');
  $('copyCode').onclick = async () => { try { await navigator.clipboard.writeText(code); $('copyCode').textContent = 'Скопировано'; setTimeout(() => $('copyCode').textContent = 'Скопировать код', 1500); } catch { window.prompt('Скопируй код:', code); } };
  socket.on('connect', () => $('connection').textContent = '🟢 В сети');
  socket.on('disconnect', () => { $('connection').textContent = '🔴 Нет соединения'; setHeld('left',false);setHeld('right',false);setHeld('block',false); });
  socket.on('errorMessage', msg => { $('error').textContent = msg; });
  socket.on('notice', msg => { announced = msg; });
  socket.on('joined', data => { code = data.code; me = data.index; $('roomCode').textContent = code; $('lobby').classList.add('hidden');$('game').classList.remove('hidden');$('error').textContent = ''; });
  socket.on('state', data => { state = data; updateUI(); });
  function updateUI() {
    if (!state) return;
    for (let i=0;i<2;i++) { const p=state.players.find(p=>p.index===i); $('n'+i).textContent = (i===0?'ДИЛАН':'ТОЛЯН')+(p ? (i===me?' · ТЫ':'') : ' · ОЖИДАНИЕ'); $('hp'+i).style.width = (p?.hp??100)+'%'; }
    $('timer').textContent = state.seconds;
    const overlay=$('overlay'), title=$('headline'), details=$('details'), ready=$('ready');
    const self=state.players.find(p=>p.index===me);
    overlay.classList.toggle('hidden', state.phase==='playing');
    ready.classList.add('hidden');
    if (state.phase==='waiting') { title.textContent='ОЖИДАНИЕ СОПЕРНИКА';details.textContent=announced||'Пригласи друга, отправив ему код комнаты '+code; if(state.players.length===2){title.textContent='БОЙ ПОЧТИ НАЧАЛСЯ'; details.textContent=self?.ready?'Ждём готовности соперника':'Оба игрока должны нажать «Готов к бою»'; if(!self?.ready)ready.classList.remove('hidden');} }
    else if (state.phase==='finished') { title.textContent = state.winner===-1 ? 'НИЧЬЯ!' : state.winner===me ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ'; details.textContent=self?.ready?'Ожидаем соперника…':'Реванш? Нажми кнопку ниже.'; if(!self?.ready)ready.classList.remove('hidden'); }
    ready.textContent=state.phase==='finished'?'РЕВАНШ':'ГОТОВ К БОЮ';
  }
  for (const el of document.querySelectorAll('[data-hold]')) {
    const k=el.dataset.hold;
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('pressed');setHeld(k,true);});
    for (const ev of ['pointerup','pointercancel','lostpointercapture']) el.addEventListener(ev,()=>{el.classList.remove('pressed');setHeld(k,false);});
  }
  for (const el of document.querySelectorAll('[data-attack]')) el.addEventListener('pointerdown',e=>{e.preventDefault();attack(el.dataset.attack);});
  document.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT')return; if(keymap[e.code]){e.preventDefault();setHeld(keymap[e.code],true);} else if(!e.repeat&&e.code==='KeyJ')attack('punch');else if(!e.repeat&&e.code==='KeyK')attack('kick'); });
  document.addEventListener('keyup',e=>{if(keymap[e.code]){e.preventDefault();setHeld(keymap[e.code],false);}});
  window.addEventListener('blur',()=>{for(const k of Object.keys(input))setHeld(k,false);});
  function roundRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawFighter(p,t){
    const img=fighterPics[p.index], x=p.x, y=430;
    ctx.save();ctx.translate(x,y);
    // Slight movements provide in-game feedback while full frame-by-frame animations are developed.
    const walking=p.action==='walk', punching=p.action==='punch', kicking=p.action==='kick';
    const bounce=walking?Math.sin(t/86)*6:Math.sin(t/580)*2;
    const lunge=(punching?19:kicking?32:0)*p.facing;
    const knocked=p.action==='hurt';
    ctx.translate(lunge,bounce);
    ctx.fillStyle='#040514a9';ctx.beginPath();ctx.ellipse(0,9,65,12,0,0,Math.PI*2);ctx.fill();
    if(punching||kicking){ctx.save();ctx.globalAlpha=.65;ctx.strokeStyle=kicking?'#8fffd1':'#ffcb56';ctx.lineWidth=kicking?15:10;ctx.shadowBlur=23;ctx.shadowColor=ctx.strokeStyle;ctx.beginPath();const dir=p.facing;ctx.arc(dir*47,-150,kicking?85:64,dir===1?-.85:Math.PI-.85,dir===1?.8:Math.PI+.8);ctx.stroke();ctx.restore();}
    if(img.complete&&img.naturalWidth){
      const h=p.index===0?303:322, w=img.width/img.height*h;
      ctx.translate(0,0);ctx.rotate(knocked?-p.facing*.12:punching?-p.facing*.06:kicking?p.facing*.08:0);
      // Source composition faces camera; mirror when facing left to show opponent orientation.
      if(p.facing<0)ctx.scale(-1,1);
      ctx.shadowColor=p.index===0?'#ac66ff':'#55efab';ctx.shadowBlur=p.action==='block'?24:11;
      ctx.drawImage(img,-w/2,-h,w,h);
      ctx.shadowBlur=0;
      if(p.action==='block'){ctx.strokeStyle='#76d9ff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(8,-175,60,-1.2,1.1);ctx.stroke()}
      if(knocked){ctx.fillStyle='#ff56564c';ctx.fillRect(-w/2,-h,w,h)}
    }else{roundRect(-34,-225,68,225,13,p.index===0?'#6548ad':'#3b9a72')}
    ctx.restore();
  }
  function frame(t){
    const w=960,h=540;
    const bg=ctx.createLinearGradient(0,0,0,540);bg.addColorStop(0,'#111832');bg.addColorStop(.75,'#453262');bg.addColorStop(1,'#181833');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#b54c8540';ctx.beginPath();ctx.arc(480,190,145,0,Math.PI*2);ctx.fill();
    for(let i=0;i<11;i++){let x=i*105-55;roundRect(x,228,74,200,10,i%2?'#2b2d57':'#222645');}
    ctx.fillStyle='#f9b439';ctx.font='900 65px system-ui';ctx.textAlign='center';ctx.fillText('MIND BATTLE',480,110);ctx.font='700 17px system-ui';ctx.fillStyle='#fff9';ctx.fillText('ДИЛАН VS ТОЛЯН  ·  ONLINE ARENA',480,139);
    ctx.fillStyle='#2b2842';ctx.fillRect(0,430,w,110);ctx.fillStyle='#ffc43a';ctx.fillRect(0,428,w,5);ctx.strokeStyle='#ffc43a26';ctx.lineWidth=2;for(let x=0;x<960;x+=80){ctx.beginPath();ctx.moveTo(x,430);ctx.lineTo(x-60,540);ctx.stroke();}
    for(const p of state?.players||[])drawFighter(p,t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
