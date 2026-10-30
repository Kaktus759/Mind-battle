const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const crypto=require('crypto');
const app=express();const server=http.createServer(app);const io=new Server(server,{pingTimeout:30000});
app.use(express.static('public'));app.get('/health',(req,res)=>res.json({ok:true}));
const rooms=new Map();
const rounds=[
 {title:'Ближе к истине',type:'number',time:40,items:[
 ['Сколько сердец у осьминога?',3,'У осьминога три сердца.'],['Сколько точек на всех гранях обычного игрального кубика?',21,'Сумма чисел от 1 до 6 — 21.'],['Сколько официальных созвездий существует?',88,'Международный астрономический союз признаёт 88 созвездий.'],['Сколько минут длился полёт Юрия Гагарина?',108,'Первый полёт человека в космос длился 108 минут.'],['Сколько метров в высоту Бурдж-Халифа?',828,'Высота здания — 828 метров.']]},
 {title:'Быстрее всех',type:'choice',time:20,items:[
 ['Какой элемент обозначают символом Fe?',['Фтор','Железо','Франций','Фосфор'],1,'Fe — железо.'],['Какую планету называют Красной?',['Венера','Юпитер','Марс','Меркурий'],2,'Марс выглядит красноватым из-за оксидов железа.'],['Какой океан самый большой?',['Атлантический','Индийский','Северный Ледовитый','Тихий'],3,'Тихий океан — крупнейший.'],['Кто написал «Преступление и наказание»?',['Толстой','Достоевский','Чехов','Гоголь'],1,'Автор — Фёдор Достоевский.'],['Сколько градусов в прямом угле?',['45','60','90','180'],2,'Прямой угол — 90 градусов.']]},
 {title:'Правда или блеф',type:'truth',time:18,items:[
 ['У осьминога голубая кровь.',true,'В крови осьминога есть медьсодержащий гемоцианин.'],['На Венере сутки короче земного года Венеры.',false,'Вращение Венеры вокруг оси занимает примерно 243 земных дня, а год — около 225.'],['Банан с ботанической точки зрения — ягода.',true,'Плод банана ботанически относится к ягодам.'],['Великая Китайская стена хорошо видна с Луны невооружённым глазом.',false,'С Луны она не видна невооружённым глазом.'],['У акул нет костного скелета.',true,'Скелет акул состоит преимущественно из хряща.']]},
 {title:'Аукцион знаний',type:'auction',time:35,items:[
 ['Какое число является атомным номером золота?',79,'Атомный номер золота — 79.'],['В каком году человек впервые ступил на Луну?',1969,'Высадка «Аполлона-11» состоялась в 1969 году.'],['Сколько клеток на шахматной доске?',64,'Восемь на восемь — 64.']]},
 {title:'Финальная битва',type:'final',time:30,items:[
 ['Сколько граней у правильного додекаэдра?',['10','12','16','20'],1,'У додекаэдра 12 граней.'],['Сколько хромосом обычно в соматической клетке человека?',['23','44','46','48'],2,'Обычно 46 хромосом.'],['Какой химический элемент имеет символ W?',['Вольфрам','Ванадий','Висмут','Водород'],0,'W — вольфрам.']]}];
const questions=rounds.flatMap((r,ri)=>r.items.map((it,qi)=>({round:ri,index:qi,type:r.type,time:r.time,title:r.title,prompt:it[0],options:(r.type==='choice'||r.type==='final')?it[1]:r.type==='truth'?['Правда','Блеф']:undefined,correct:(r.type==='choice'||r.type==='final')?it[2]:r.type==='truth'?it[1]:it[1],explanation:it[r.type==='choice'||r.type==='final'?3:r.type==='truth'?2:2]})));
function code(){let c;do{c=crypto.randomInt(100000,1000000).toString()}while(rooms.has(c));return c}
function publicState(r){return {code:r.code,phase:r.phase,host:r.host,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,connected:p.connected})),index:r.index,question:r.phase==='question'?questionView(r):null,reveal:r.phase==='reveal'?r.reveal:null,deadline:r.deadline,answered:r.answers.size}}
function questionView(r){const q=questions[r.index];return {round:q.round,title:q.title,number:q.index+1,total:rounds[q.round].items.length,type:q.type,prompt:q.prompt,options:q.options,time:q.time}}
function emit(r){io.to(r.code).emit('state',publicState(r))}
function stop(r){if(r.timer){clearTimeout(r.timer);r.timer=null}}
function findPlayer(r,token){return [...r.players.values()].find(p=>p.token===token)}
function reveal(r){if(r.phase!=='question')return;stop(r);const q=questions[r.index];const answers=[...r.answers.entries()].map(([id,a])=>({id,name:r.players.get(id)?.name||'Игрок',value:a.value,bet:a.bet||0,ms:a.ms}));let winners=[];
 if(q.type==='number'){let best=Infinity;for(const a of answers){const d=Math.abs(a.value-q.correct);if(d<best)best=d}for(const a of answers){if(Math.abs(a.value-q.correct)===best){const gain=a.value===q.correct?50:30;r.players.get(a.id).score+=gain;winners.push({id:a.id,gain})}}}
 else if(q.type==='auction'){for(const a of answers){const p=r.players.get(a.id);const gain=a.value===q.correct?a.bet:-a.bet;p.score+=gain;winners.push({id:a.id,gain})}}
 else {const good=answers.filter(a=>a.value===q.correct).sort((a,b)=>a.ms-b.ms);good.forEach((a,i)=>{const gain=q.type==='final'?60:q.type==='truth'?30:30+(i===0?10:0);r.players.get(a.id).score+=gain;winners.push({id:a.id,gain})})}
 r.reveal={correct:q.correct,explanation:q.explanation,answers:answers.map(a=>({...a,gain:winners.find(w=>w.id===a.id)?.gain||0})),round:q.title};r.phase='reveal';r.deadline=null;emit(r)}
function begin(r){stop(r);if(r.index>=questions.length){r.phase='finished';r.deadline=null;emit(r);return}r.phase='question';r.answers.clear();r.reveal=null;r.deadline=Date.now()+questions[r.index].time*1000;emit(r);r.timer=setTimeout(()=>reveal(r),questions[r.index].time*1000)}
function safeAck(ack,obj){if(typeof ack==='function')ack(obj)}
function handleJoin(socket,data,ack,creating){const name=String(data?.name||'').trim().slice(0,22);if(!name){safeAck(ack,{error:'Введите имя'});return}let r,player;const token=String(data?.token||'');if(creating){const c=code();r={code:c,host:null,players:new Map(),answers:new Map(),phase:'lobby',index:0,deadline:null,reveal:null,timer:null};rooms.set(c,r)}else{r=rooms.get(String(data?.code||''));if(!r){safeAck(ack,{error:'Комната не найдена'});return}player=token&&findPlayer(r,token);if(!player&&r.phase!=='lobby'){safeAck(ack,{error:'Игра уже началась. Новые игроки не подключаются.'});return}if(!player&&r.players.size>=10){safeAck(ack,{error:'В комнате уже 10 игроков'});return}}
 if(!player){const id=crypto.randomUUID();player={id,token:crypto.randomBytes(24).toString('hex'),name,score:0,connected:true};r.players.set(id,player);if(creating)r.host=id}
 player.connected=true;player.socket=socket.id;socket.join(r.code);socket.data.room=r.code;socket.data.player=player.id;safeAck(ack,{ok:true,code:r.code,token:player.token,id:player.id});emit(r)}
io.on('connection',socket=>{
 socket.on('create',(d,a)=>handleJoin(socket,d,a,true));socket.on('join',(d,a)=>handleJoin(socket,d,a,false));
 socket.on('resume',(d,a)=>{const r=rooms.get(String(d?.code||''));const p=r&&findPlayer(r,String(d?.token||''));if(!p){safeAck(a,{error:'Сессия не найдена'});return}p.socket=socket.id;p.connected=true;socket.join(r.code);socket.data.room=r.code;socket.data.player=p.id;safeAck(a,{ok:true,code:r.code,id:p.id});emit(r)});
 socket.on('start',(_,a)=>{const r=rooms.get(socket.data.room);if(!r||r.host!==socket.data.player||r.phase!=='lobby'){safeAck(a,{error:'Нет доступа'});return}if(r.players.size<2){safeAck(a,{error:'Нужно минимум два игрока'});return}r.index=0;for(const p of r.players.values())p.score=0;begin(r);safeAck(a,{ok:true})});
 socket.on('answer',(data,a)=>{const r=rooms.get(socket.data.room);if(!r||r.phase!=='question'||Date.now()>r.deadline){safeAck(a,{error:'Время вышло'});return}const id=socket.data.player;if(!r.players.has(id)||r.answers.has(id)){safeAck(a,{error:'Ответ уже принят или игрок не найден'});return}const q=questions[r.index];let value=data?.value,bet=0;
 if(q.type==='number'||q.type==='auction'){value=Number(value);if(!Number.isFinite(value)||value<0||!Number.isInteger(value)||value>1e12){safeAck(a,{error:'Введите целое неотрицательное число'});return}}
 else if(q.type==='truth'){if(typeof value!=='boolean'){safeAck(a,{error:'Выберите вариант'});return}}
 else if(!Number.isInteger(value)||value<0||value>=q.options.length){safeAck(a,{error:'Выберите вариант'});return}
 if(q.type==='auction'){bet=Number(data?.bet);const balance=Math.max(0,r.players.get(id).score);if(!Number.isInteger(bet)||bet<1||bet>Math.min(100,balance)){safeAck(a,{error:'Ставка должна быть от 1 до 100 и не выше баланса'});return}}
 r.answers.set(id,{value,bet,ms:Date.now()-(r.deadline-q.time*1000)});safeAck(a,{ok:true});emit(r);if(r.answers.size===r.players.size)reveal(r)});
 socket.on('next',(_,a)=>{const r=rooms.get(socket.data.room);if(!r||r.host!==socket.data.player||r.phase!=='reveal'){safeAck(a,{error:'Нет доступа'});return}r.index++;begin(r);safeAck(a,{ok:true})});
 socket.on('restart',(_,a)=>{const r=rooms.get(socket.data.room);if(!r||r.host!==socket.data.player||r.phase!=='finished'){safeAck(a,{error:'Нет доступа'});return}r.index=0;for(const p of r.players.values())p.score=0;begin(r);safeAck(a,{ok:true})});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room),p=r?.players.get(socket.data.player);if(!p||p.socket!==socket.id)return;p.connected=false;if(r.phase==='lobby'){r.players.delete(p.id);if(r.host===p.id)r.host=r.players.keys().next().value||null;if(!r.players.size){stop(r);rooms.delete(r.code);return}}emit(r)})
});
setInterval(()=>{for(const [c,r] of rooms){if(r.phase==='finished'&&!r.players.size){stop(r);rooms.delete(c)}}},600000).unref();
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('MIND BATTLE running on port '+(process.env.PORT||3000)));
