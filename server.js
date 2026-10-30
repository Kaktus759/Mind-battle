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

// Дополнительный банк: новая партия получает случайные вопросы каждого этапа.
rounds[0].items.push(
 ['Сколько рёбер у куба?',12,'У куба 12 рёбер.'],['Сколько клеток на шахматной доске?',64,'8 × 8 = 64.'],['Сколько камер в сердце человека?',4,'Два предсердия и два желудочка.'],['Сколько лет длилась Столетняя война от 1337 до 1453 года?',116,'1453 − 1337 = 116.'],['Сколько хромосом обычно в клетке тела человека?',46,'Обычно 23 пары хромосом.'],['Сколько минут в трёх сутках?',4320,'3 × 24 × 60 = 4320.'],['Сколько метров в одном километре?',1000,'В километре 1000 метров.'],['Сколько зубов у взрослой кошки?',30,'У взрослой кошки 30 постоянных зубов.'],['Сколько граней у правильного икосаэдра?',20,'У икосаэдра 20 треугольных граней.'],['Сколько полос на флаге США?',13,'Семь красных и шесть белых.']);
rounds[1].items.push(
 ['Какой газ преобладает в атмосфере Земли?',['Кислород','Азот','Углекислый газ','Водород'],1,'Азота в атмосфере около 78%.'],['Столица Канады?',['Торонто','Монреаль','Оттава','Ванкувер'],2,'Столица Канады — Оттава.'],['Какая планета ближе всего к Солнцу?',['Меркурий','Венера','Земля','Марс'],0,'Меркурий — ближайшая планета.'],['Кто написал «Евгения Онегина»?',['Лермонтов','Пушкин','Гоголь','Тургенев'],1,'Автор — Александр Пушкин.'],['Сколько сторон у шестиугольника?',['5','6','7','8'],1,'У шестиугольника шесть сторон.'],['Какой металл жидкий при обычной комнатной температуре?',['Железо','Алюминий','Ртуть','Медь'],2,'Ртуть жидкая при комнатной температуре.'],['Какая страна подарила США Статую Свободы?',['Италия','Франция','Испания','Германия'],1,'Статую Свободы подарила Франция.'],['Самая крупная планета Солнечной системы?',['Сатурн','Юпитер','Нептун','Уран'],1,'Самая крупная планета — Юпитер.'],['Как называется наука о грибах?',['Орнитология','Микология','Энтомология','Геология'],1,'Микология изучает грибы.'],['Какой инструмент измеряет атмосферное давление?',['Термометр','Барометр','Амперметр','Секундомер'],1,'Барометр измеряет давление.']);
rounds[2].items.push(
 ['У пчелы пять глаз, если считать простые глазки.',true,'Два сложных глаза и три простых.'],['У взрослого человека обычно 206 костей.',true,'В типичном скелете взрослого 206 костей.'],['Звук распространяется в вакууме.',false,'Звуку нужна материальная среда.'],['Пингвины живут в дикой природе в Арктике.',false,'Естественные популяции пингвинов живут в Южном полушарии.'],['Солнце — звезда.',true,'Солнце — звезда главной последовательности.'],['Молния может ударить в одно место дважды.',true,'Молния нередко попадает в одни и те же высокие объекты.'],['Киты — рыбы.',false,'Киты — млекопитающие.'],['Вода при нормальном атмосферном давлении кипит примерно при 100 °C.',true,'При давлении в одну атмосферу температура кипения около 100 °C.'],['У Земли два естественных спутника размером с Луну.',false,'У Земли один крупный естественный спутник — Луна.'],['Улитка — моллюск.',true,'Улитки относятся к брюхоногим моллюскам.']);
rounds[3].items.push(
 ['Сколько планет в Солнечной системе?',8,'Сейчас признают восемь планет.'],['Сколько химических элементов в периодической таблице признано IUPAC?',118,'Признано 118 элементов.'],['Сколько лет длился один век?',100,'Один век — 100 лет.'],['Сколько клавиш у стандартного современного фортепиано?',88,'У стандартного фортепиано 88 клавиш.'],['Сколько секунд в одном часе?',3600,'60 × 60 = 3600.'],['Сколько градусов в полном круге?',360,'Полный оборот — 360 градусов.']);
rounds[4].items.push(
 ['Какой элемент имеет символ Ag?',['Золото','Серебро','Аргон','Алюминий'],1,'Ag — серебро.'],['Какая планета известна кольцами?',['Марс','Сатурн','Меркурий','Венера'],1,'Сатурн известен выраженной системой колец.'],['Кто создал периодическую систему элементов?',['Ньютон','Менделеев','Эйнштейн','Дарвин'],1,'Периодическую систему создал Дмитрий Менделеев.'],['Какое животное — крупнейшее из ныне живущих?',['Африканский слон','Синий кит','Жираф','Кашалот'],1,'Крупнейшее животное — синий кит.'],['Сколько граней у тетраэдра?',['4','6','8','12'],0,'У тетраэдра четыре грани.'],['Какой океан расположен между Африкой и Австралией?',['Тихий','Атлантический','Индийский','Северный Ледовитый'],2,'Между Африкой и Австралией — Индийский океан.']);
const extraBank=require('./questions.json');
for(let i=0;i<5;i++)rounds[i].items.push(...extraBank[i]);
const counts=[5,5,5,3,3];
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=crypto.randomInt(i+1);[b[i],b[j]]=[b[j],b[i]]}return b}
function newDeck(previous=[]){return rounds.flatMap((r,ri)=>{let pool=shuffle(r.items);const old=new Set(previous.filter(q=>q.round===ri).map(q=>q.prompt));pool.sort((a,b)=>Number(old.has(a[0]))-Number(old.has(b[0])));return pool.slice(0,counts[ri]).map((it,qi)=>({round:ri,index:qi,type:r.type,time:r.time,title:r.title,prompt:it[0],options:(r.type==='choice'||r.type==='final')?it[1]:r.type==='truth'?['Правда','Блеф']:undefined,correct:(r.type==='choice'||r.type==='final')?it[2]:it[1],explanation:it[r.type==='choice'||r.type==='final'?3:2]}))})}
function code(){let c;do{c=crypto.randomInt(100000,1000000).toString()}while(rooms.has(c));return c}
function publicState(r){return {code:r.code,phase:r.phase,host:r.host,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,connected:p.connected})),index:r.index,question:r.phase==='question'?questionView(r):null,reveal:r.phase==='reveal'?r.reveal:null,deadline:r.deadline,answered:r.answers.size}}
function questionView(r){const q=r.questions[r.index];return {round:q.round,title:q.title,number:q.index+1,total:counts[q.round],type:q.type,prompt:q.prompt,options:q.options,time:q.time}}
function emit(r){io.to(r.code).emit('state',publicState(r))}
function stop(r){if(r.timer){clearTimeout(r.timer);r.timer=null}}
function findPlayer(r,token){return [...r.players.values()].find(p=>p.token===token)}
function reveal(r){if(r.phase!=='question')return;stop(r);const q=r.questions[r.index];const answers=[...r.answers.entries()].map(([id,a])=>({id,name:r.players.get(id)?.name||'Игрок',value:a.value,bet:a.bet||0,ms:a.ms}));let winners=[];
 if(q.type==='number'){let best=Infinity;for(const a of answers){const d=Math.abs(a.value-q.correct);if(d<best)best=d}for(const a of answers){if(Math.abs(a.value-q.correct)===best){const gain=a.value===q.correct?50:30;r.players.get(a.id).score+=gain;winners.push({id:a.id,gain})}}}
 else if(q.type==='auction'){for(const a of answers){const p=r.players.get(a.id);const gain=a.value===q.correct?a.bet:-a.bet;p.score+=gain;winners.push({id:a.id,gain})}}
 else {const good=answers.filter(a=>a.value===q.correct).sort((a,b)=>a.ms-b.ms);good.forEach((a,i)=>{const gain=q.type==='final'?60:q.type==='truth'?30:30+(i===0?10:0);r.players.get(a.id).score+=gain;winners.push({id:a.id,gain})})}
 r.reveal={correct:q.correct,explanation:q.explanation,answers:answers.map(a=>({...a,gain:winners.find(w=>w.id===a.id)?.gain||0})),round:q.title,options:q.options,type:q.type};r.phase='reveal';r.deadline=null;emit(r)}
function begin(r){stop(r);if(r.index>=r.questions.length){r.phase='finished';r.deadline=null;emit(r);return}r.phase='question';r.answers.clear();r.reveal=null;r.deadline=Date.now()+r.questions[r.index].time*1000;emit(r);r.timer=setTimeout(()=>reveal(r),r.questions[r.index].time*1000)}
function detachPlayer(socket){
 const r=rooms.get(socket.data.room),p=r?.players.get(socket.data.player);
 if(!r||!p||p.socket!==socket.id)return;
 p.connected=false;p.socket=null;
 if(r.phase==='lobby'){
  r.players.delete(p.id);
  if(r.host===p.id)r.host=r.players.keys().next().value||null;
 }else{
  // Preserve scores/answers until the round ends, but remove the departed player
  // from the active roster so remaining players aren't blocked.
  r.players.delete(p.id);r.answers.delete(p.id);
  if(r.host===p.id)r.host=r.players.keys().next().value||null;
 }
 socket.leave(r.code);socket.data.room=null;socket.data.player=null;
 if(!r.players.size){stop(r);rooms.delete(r.code);return}
 emit(r);
 if(r.phase==='question'&&r.players.size>0&&r.answers.size===r.players.size)reveal(r);
}
function safeAck(ack,obj){if(typeof ack==='function')ack(obj)}
function handleJoin(socket,data,ack,creating){const name=String(data?.name||'').trim().slice(0,22);if(!name){safeAck(ack,{error:'Введите имя'});return}let r,player;const token=String(data?.token||'');if(creating){const c=code();r={code:c,host:null,players:new Map(),answers:new Map(),phase:'lobby',index:0,questions:newDeck(),deadline:null,reveal:null,timer:null};rooms.set(c,r)}else{r=rooms.get(String(data?.code||''));if(!r){safeAck(ack,{error:'Комната не найдена'});return}player=token&&findPlayer(r,token);if(!player&&r.phase!=='lobby'){safeAck(ack,{error:'Игра уже началась. Новые игроки не подключаются.'});return}if(!player&&r.players.size>=10){safeAck(ack,{error:'В комнате уже 10 игроков'});return}}
 if(!player){const id=crypto.randomUUID();player={id,token:crypto.randomBytes(24).toString('hex'),name,score:0,connected:true};r.players.set(id,player);if(creating)r.host=id}
 player.connected=true;player.socket=socket.id;socket.join(r.code);socket.data.room=r.code;socket.data.player=player.id;safeAck(ack,{ok:true,code:r.code,token:player.token,id:player.id});emit(r)}
io.on('connection',socket=>{
 socket.on('leave',(_,a)=>{detachPlayer(socket);safeAck(a,{ok:true})});
 socket.on('create',(d,a)=>handleJoin(socket,d,a,true));socket.on('join',(d,a)=>handleJoin(socket,d,a,false));
 socket.on('resume',(d,a)=>{const r=rooms.get(String(d?.code||''));const p=r&&findPlayer(r,String(d?.token||''));if(!p){safeAck(a,{error:'Сессия не найдена'});return}p.socket=socket.id;p.connected=true;socket.join(r.code);socket.data.room=r.code;socket.data.player=p.id;safeAck(a,{ok:true,code:r.code,id:p.id});emit(r)});
 socket.on('start',(_,a)=>{const r=rooms.get(socket.data.room);if(!r||r.host!==socket.data.player||r.phase!=='lobby'){safeAck(a,{error:'Нет доступа'});return}if(r.players.size<2){safeAck(a,{error:'Нужно минимум два игрока'});return}r.index=0;for(const p of r.players.values())p.score=0;begin(r);safeAck(a,{ok:true})});
 socket.on('answer',(data,a)=>{const r=rooms.get(socket.data.room);if(!r||r.phase!=='question'||Date.now()>r.deadline){safeAck(a,{error:'Время вышло'});return}const id=socket.data.player;if(!r.players.has(id)||r.answers.has(id)){safeAck(a,{error:'Ответ уже принят или игрок не найден'});return}const q=r.questions[r.index];let value=data?.value,bet=0;
 if(q.type==='number'||q.type==='auction'){value=Number(value);if(!Number.isFinite(value)||value<0||!Number.isInteger(value)||value>1e12){safeAck(a,{error:'Введите целое неотрицательное число'});return}}
 else if(q.type==='truth'){if(typeof value!=='boolean'){safeAck(a,{error:'Выберите вариант'});return}}
 else if(!Number.isInteger(value)||value<0||value>=q.options.length){safeAck(a,{error:'Выберите вариант'});return}
 if(q.type==='auction'){bet=Number(data?.bet);const balance=Math.max(0,r.players.get(id).score);if(!Number.isInteger(bet)||bet<1||bet>Math.min(100,balance)){safeAck(a,{error:'Ставка должна быть от 1 до 100 и не выше баланса'});return}}
 r.answers.set(id,{value,bet,ms:Date.now()-(r.deadline-q.time*1000)});safeAck(a,{ok:true});emit(r);if(r.answers.size===r.players.size)reveal(r)});
 socket.on('next',(_,a)=>{const r=rooms.get(socket.data.room);if(!r||r.host!==socket.data.player||r.phase!=='reveal'){safeAck(a,{error:'Нет доступа'});return}r.index++;begin(r);safeAck(a,{ok:true})});
 socket.on('restart',(_,a)=>{const r=rooms.get(socket.data.room);if(!r||r.host!==socket.data.player||r.phase!=='finished'){safeAck(a,{error:'Нет доступа'});return}r.index=0;r.questions=newDeck(r.questions);for(const p of r.players.values())p.score=0;begin(r);safeAck(a,{ok:true})});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.room),p=r?.players.get(socket.data.player);if(!p||p.socket!==socket.id)return;p.connected=false;if(r.phase==='lobby'){r.players.delete(p.id);if(r.host===p.id)r.host=r.players.keys().next().value||null;if(!r.players.size){stop(r);rooms.delete(r.code);return}}emit(r)})
});
setInterval(()=>{for(const [c,r] of rooms){if(r.phase==='finished'&&!r.players.size){stop(r);rooms.delete(c)}}},600000).unref();
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('MIND BATTLE running on port '+(process.env.PORT||3000)));
