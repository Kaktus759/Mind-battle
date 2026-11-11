'use strict';





module.exports.attach = function attachFighting(rootIO) {
const io=rootIO.of('/fighting');
const TICK_MS = 1000 / 30;
const ARENA = { width: 960, floor: 430 };
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cleanName = v => typeof v === 'string' ? v.trim().slice(0, 18).replace(/[<>]/g, '') || 'Боец' : 'Боец';
const makePlayer = (id, index, name) => ({
  id, index, name, x: index === 0 ? 225 : 735, hp: 100, facing: index === 0 ? 1 : -1,
  action: 'idle', actionUntil: 0, cooldownUntil: 0, hitDone: false,
  input: { left: false, right: false, block: false }, ready: false, wins: 0
});
function publicState(room) {
  return { code: room.code, phase: room.phase, seconds: room.seconds, winner: room.winner,
    players: room.players.map(p => p && ({ index:p.index, name:p.name, x:p.x, hp:p.hp,
      facing:p.facing, action:p.action, ready:p.ready, wins:p.wins })) };
}
function broadcast(room) { io.to(room.code).emit('state', publicState(room)); }
function resetRound(room) {
  room.players.forEach((p, i) => { p.x = i ? 735 : 225; p.hp = 100; p.facing = i ? -1 : 1;
    p.action = 'idle'; p.actionUntil = 0; p.cooldownUntil = 0; p.hitDone = false;
    p.input = { left: false, right: false, block: false }; });
  room.phase = 'playing'; room.seconds = 90; room.started = Date.now(); room.winner = null;
}
function startIfReady(room) {
  if (room.players.length === 2 && room.players.every(p => p.ready)) {
    resetRound(room); broadcast(room);
  }
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  socket.data.roomCode = null;
  socket.leave(code);
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter(p => p.id !== socket.id);
  if (!room.players.length) { rooms.delete(code); return; }
  room.phase = 'waiting'; room.winner = null;
  room.players.forEach(p => { p.ready = false; p.input = {left:false,right:false,block:false}; });
  io.to(code).emit('notice', 'Соперник отключился. Ожидаем нового игрока.');
  broadcast(room);
}
function joinRoom(socket, code, name) {
  if (socket.data.roomCode) leaveRoom(socket);
  const room = rooms.get(code);
  if (!room) return socket.emit('errorMessage', 'Комната не найдена.');
  if (room.players.length >= 2) return socket.emit('errorMessage', 'Комната уже заполнена.');
  const used = new Set(room.players.map(p => p.index));
  const index = used.has(0) ? 1 : 0;
  room.players.push(makePlayer(socket.id, index, cleanName(name)));
  room.players.sort((a,b) => a.index - b.index);
  socket.join(code); socket.data.roomCode = code;
  socket.emit('joined', { code, index });
  broadcast(room);
}
io.on('connection', socket => {
  socket.on('create', ({ name } = {}) => {
    let code; do { code = randomCode(); } while (rooms.has(code));
    rooms.set(code, { code, players:[], phase:'waiting', seconds:90, winner:null, started:0 });
    joinRoom(socket, code, name);
  });
  socket.on('join', ({ code, name } = {}) => {
    const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!/^[A-Z2-9]{5}$/.test(normalized)) return socket.emit('errorMessage','Введите код из 5 символов.');
    joinRoom(socket, normalized, name);
  });
  socket.on('ready', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase === 'playing') return;
    const p = room.players.find(p => p.id === socket.id);
    if (!p) return;
    p.ready = true; startIfReady(room); broadcast(room);
  });
  socket.on('input', data => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || !data || typeof data !== 'object') return;
    const p = room.players.find(p => p.id === socket.id); if (!p) return;
    if (typeof data.left === 'boolean') p.input.left = data.left;
    if (typeof data.right === 'boolean') p.input.right = data.right;
    if (typeof data.block === 'boolean') p.input.block = data.block;
  });
  socket.on('attack', kind => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || !['punch','kick'].includes(kind)) return;
    const p = room.players.find(p => p.id === socket.id);
    const now = Date.now(); if (!p || now < p.cooldownUntil || p.hp <= 0) return;
    p.action = kind; p.actionUntil = now + (kind === 'punch' ? 240 : 380);
    p.cooldownUntil = now + (kind === 'punch' ? 380 : 620); p.hitDone = false;
  });
  socket.on('disconnect', () => leaveRoom(socket));
});
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase !== 'playing' || room.players.length !== 2) continue;
    const [a,b] = room.players;
    for (const p of [a,b]) {
      const other = p === a ? b : a;
      p.facing = other.x >= p.x ? 1 : -1;
      if (now >= p.actionUntil) p.action = p.input.block ? 'block' : 'idle';
      if (p.action === 'idle' || p.action === 'walk') {
        const direction = Number(p.input.right) - Number(p.input.left);
        p.x = clamp(p.x + direction * 5, 42, ARENA.width - 42);
        p.action = direction ? 'walk' : 'idle';
      }
    }
    // Minimum distance prevents fighters overlapping.
    if (Math.abs(a.x - b.x) < 65) {
      const mid = (a.x + b.x) / 2;
      const sign = a.x <= b.x ? -1 : 1;
      a.x = clamp(mid + sign * 32.5, 42, 918);
      b.x = clamp(mid - sign * 32.5, 42, 918);
    }
    for (const p of [a,b]) {
      const other = p === a ? b : a;
      if ((p.action !== 'punch' && p.action !== 'kick') || p.hitDone) continue;
      const reach = p.action === 'punch' ? 105 : 135;
      if (Math.abs(other.x - p.x) <= reach && (other.x - p.x) * p.facing >= 0) {
        const blocking = other.input.block && other.action === 'block';
        other.hp = clamp(other.hp - (blocking ? 2 : (p.action === 'punch' ? 9 : 14)), 0, 100);
        if (!blocking) { other.action = 'hurt'; other.actionUntil = now + 180; }
      }
      p.hitDone = true;
    }
    room.seconds = Math.max(0, 90 - Math.floor((now - room.started) / 1000));
    if (a.hp <= 0 || b.hp <= 0 || room.seconds <= 0) {
      room.phase = 'finished'; room.winner = a.hp === b.hp ? -1 : a.hp > b.hp ? a.index : b.index;
      room.players.forEach(p => { p.ready = false; p.input = { left:false,right:false,block:false }; });
    }
    broadcast(room);
  }
}, TICK_MS);
};
