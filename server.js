import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA !== 'false';
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'nautilus.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS boats (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, tagline TEXT NOT NULL, description TEXT NOT NULL,
  departure_point TEXT NOT NULL, duration TEXT NOT NULL, highlights TEXT NOT NULL, theme TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY, boat_id INTEGER NOT NULL REFERENCES boats(id),
  name TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0),
  price_per_person INTEGER NOT NULL CHECK(price_per_person > 0), features TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS departures (
  id INTEGER PRIMARY KEY, boat_id INTEGER NOT NULL REFERENCES boats(id),
  departure_date TEXT NOT NULL, return_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
);
CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY, departure_id INTEGER NOT NULL REFERENCES departures(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id), guest_count INTEGER NOT NULL,
  amount INTEGER NOT NULL, offer_id TEXT, expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, departure_id INTEGER NOT NULL REFERENCES departures(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id), guest_count INTEGER NOT NULL,
  amount INTEGER NOT NULL, fee INTEGER NOT NULL, guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL, terms_snapshot TEXT NOT NULL, created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  UNIQUE(departure_id, room_id)
);
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY, departure_id INTEGER NOT NULL REFERENCES departures(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id), guest_count INTEGER NOT NULL,
  guest_name TEXT NOT NULL, guest_phone TEXT NOT NULL,
  proposed_amount INTEGER NOT NULL, final_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS departure_prices (
  departure_id INTEGER NOT NULL REFERENCES departures(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  price_per_person INTEGER NOT NULL CHECK(price_per_person > 0),
  PRIMARY KEY(departure_id,room_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_hold ON holds(departure_id, room_id) WHERE status='active';
`);
// Add optional presentation fields without disturbing existing demo bookings.
for (const [name,type] of [
  ['source_url',"TEXT NOT NULL DEFAULT ''"],
  ['itinerary',"TEXT NOT NULL DEFAULT ''"],
  ['inclusions',"TEXT NOT NULL DEFAULT ''"],
  ['exclusions',"TEXT NOT NULL DEFAULT ''"],
  ['showcase',"INTEGER NOT NULL DEFAULT 0"]
]) {
  if (!db.prepare('PRAGMA table_info(boats)').all().some(column=>column.name===name))
    db.exec(`ALTER TABLE boats ADD COLUMN ${name} ${type}`);
}
for (const table of ['boats','rooms']) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(column=>column.name==='published'))
    db.exec(`ALTER TABLE ${table} ADD COLUMN published INTEGER NOT NULL DEFAULT 1`);
}

if (SEED_DEMO_DATA && !db.prepare('SELECT id FROM boats WHERE showcase=1 LIMIT 1').get()) {
  const boat=db.prepare(`INSERT INTO boats
    (name,tagline,description,departure_point,duration,highlights,theme,source_url,itinerary,inclusions,exclusions,showcase)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`).run(
    'Nautilus','A private houseboat journey into Tanguar Haor',
    'A two-day, one-night houseboat experience based in Sunamganj. This concept page uses details from a public BD Cruise listing and traveler notes; current inventory, schedule, prices, and permissions require confirmation by Nautilus.',
    'Saheb Bari Ghat, Sunamganj','2 days · 1 night',
    'Nine AC cabins described in published listing|Attached washrooms|Spacious lobby|Rooftop dining|Onboard cook and trip manager','blue',
    'https://www.bdcruise.com/nautilus/',
    'The published sample itinerary visits Tanguar Haor Watch Tower, Tekerghat, Shahid Siraj Lake (also called Niladri Lake), Lakmachora, Jadukata River, Barikka Tila, and Shimul Bagan. Stops and timing vary with water level, weather, and operating conditions.',
    'The published example includes cabin accommodation, sightseeing, breakfast, snacks, lunch and dinner across the trip, onboard cook and guide, and rooftop dining.',
    'Transport to and from Sunamganj and personal expenses are excluded in the published example.'
  ).lastInsertRowid;
  const addRoom=db.prepare('INSERT INTO rooms (boat_id,name,capacity,price_per_person,features) VALUES (?,?,?,?,?)');
  for (const [name,capacity,features] of [
    ['Cabin C · sample',4,'Private room|AC cabin described in listing|Capacity from published category'],
    ['Cabin B · sample',5,'Private room|AC cabin described in listing|Capacity from published category'],
    ['Cabin A · sample',6,'Private room|AC cabin described in listing|Capacity from published category'],
    ['Penthouse · sample',8,'Private room|Traveler-reported capacity|Verify exact layout with operator'],
    ['Cabin D · sample',12,'Private room|Largest category described in published listing']
  ]) addRoom.run(boat,name,capacity,15000,features);
  const addDate=db.prepare('INSERT INTO departures (boat_id,departure_date,return_date) VALUES (?,?,?)');
  const today=new Date();
  for (let n=1;n<=4;n++) {
    const day=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+n*7));
    addDate.run(boat,day.toISOString().slice(0,10),new Date(day.getTime()+86400000).toISOString().slice(0,10));
  }
}

const statement = (sql,...params) => db.prepare(sql).get(...params);
const rows = (sql,...params) => db.prepare(sql).all(...params);
const uid = (prefix) => prefix + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();
const now = () => Date.now();
const terms = 'Concept reservation only. No money is collected. Nautilus has not approved this prototype. Availability, route, price, payment, and cancellation terms require direct operator confirmation.';
const feeFor = amount => Math.round(amount * 0.05);

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result=fn(); db.exec('COMMIT'); return result; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
function expire() {
  db.prepare("UPDATE holds SET status='expired' WHERE status='active' AND expires_at <= ?").run(now());
  db.prepare("UPDATE offers SET status='expired' WHERE status IN ('pending','countered','accepted') AND expires_at <= ?").run(now());
}
function inventory(departureId,roomId) {
  const item=statement(`SELECT d.id departure_id,d.departure_date,d.return_date,d.status departure_status,
    r.id room_id,r.boat_id,r.name room_name,r.capacity,
    COALESCE(p.price_per_person,r.price_per_person) price_per_person,b.name boat_name,b.departure_point,
    r.published room_published,b.published boat_published
    FROM departures d JOIN rooms r ON r.boat_id=d.boat_id JOIN boats b ON b.id=d.boat_id
    LEFT JOIN departure_prices p ON p.departure_id=d.id AND p.room_id=r.id
    WHERE d.id=? AND r.id=?`,departureId,roomId);
  if (!item || item.departure_status!=='open' || !item.room_published || !item.boat_published ||
    item.departure_date < new Date().toISOString().slice(0,10)) throw problem(404,'Room or departure unavailable');
  return item;
}
function available(departureId,roomId) {
  return !statement("SELECT id FROM bookings WHERE departure_id=? AND room_id=? AND status='confirmed'",departureId,roomId)
    && !statement("SELECT id FROM holds WHERE departure_id=? AND room_id=? AND status='active' AND expires_at>?",departureId,roomId,now());
}
function problem(code,message) { const e=new Error(message); e.status=code; return e; }
function requiredText(value,max=100) { return typeof value==='string' && value.trim().length>=2 && value.trim().length<=max ? value.trim() : null; }
function positiveInt(value) { return Number.isSafeInteger(value) && value>0 ? value : null; }
function optionalText(value,max=500) { return typeof value==='string' && value.trim().length<=max ? value.trim() : null; }
function listText(value) {
  const text=optionalText(value,1200);
  return text===null?null:text.split(/[|\n]/).map(s=>s.trim()).filter(Boolean).join('|');
}
function secret() { return process.env.SESSION_SECRET || 'local-development-only-secret'; }
function token() {
  const body=Buffer.from(JSON.stringify({exp:now()+12*3600000})).toString('base64url');
  return body+'.'+crypto.createHmac('sha256',secret()).update(body).digest('base64url');
}
function isAdmin(req) {
  const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('hb_owner='));
  if (!raw) return false;
  const [body,sig]=raw.slice(9).split('.');
  if (!body || !sig) return false;
  const expected=crypto.createHmac('sha256',secret()).update(body).digest('base64url');
  if (sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(body,'base64url').toString()).exp>now(); } catch { return false; }
}
function requireAdmin(req) { if (!isAdmin(req)) throw problem(401,'Owner login required'); }
async function body(req) {
  let text='';
  for await (const chunk of req) { text+=chunk; if (text.length>16000) throw problem(413,'Request too large'); }
  try { return JSON.parse(text||'{}'); } catch { throw problem(400,'Invalid JSON'); }
}
function send(res,status,data,headers={}) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});
  res.end(JSON.stringify(data));
}
function catalog() {
  expire();
  const boats=rows('SELECT * FROM boats WHERE published=1 AND showcase=1 ORDER BY id LIMIT 1').map(b=>({
    ...b, highlights:b.highlights.split('|'),
    rooms:rows('SELECT * FROM rooms WHERE boat_id=? AND published=1 ORDER BY capacity',b.id).map(r=>({...r,features:r.features.split('|')})),
    departures:rows("SELECT * FROM departures WHERE boat_id=? AND status='open' AND departure_date>=date('now') ORDER BY departure_date",b.id)
      .map(d=>({...d,prices:Object.fromEntries(rows('SELECT room_id,price_per_person FROM departure_prices WHERE departure_id=?',d.id).map(p=>[p.room_id,p.price_per_person])),
        unavailable:rows(`SELECT room_id FROM bookings WHERE departure_id=? AND status='confirmed'
        UNION SELECT room_id FROM holds WHERE departure_id=? AND status='active' AND expires_at>?`,d.id,d.id,now()).map(x=>x.room_id)}))
  }));
  return {boats,fee_percent:5,demo:true};
}

async function api(req,res,url) {
  const route=url.pathname;
  if (req.method==='GET' && route==='/api/health') return send(res,200,{ok:true});
  if (req.method==='GET' && route==='/api/catalog') return send(res,200,catalog());
  if (req.method==='GET' && route==='/api/session') return send(res,200,{admin:isAdmin(req)});
  if (req.method==='POST' && route==='/api/login') {
    const input=await body(req);
    const password=process.env.ADMIN_PASSWORD;
    if (!password || typeof input.password!=='string' || input.password.length!==password.length ||
      !crypto.timingSafeEqual(Buffer.from(input.password),Buffer.from(password))) throw problem(401,'Incorrect password');
    return send(res,200,{admin:true},{'set-cookie':`hb_owner=${token()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${process.env.NODE_ENV==='production'?'; Secure':''}`});
  }
  if (req.method==='POST' && route==='/api/logout') return send(res,200,{admin:false},{'set-cookie':'hb_owner=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
  if (req.method==='POST' && route==='/api/holds') {
    const input=await body(req);
    const departureId=positiveInt(input.departure_id),roomId=positiveInt(input.room_id),guestCount=positiveInt(input.guest_count);
    if (!departureId||!roomId||!guestCount) throw problem(400,'Choose a date, room and valid guest count');
    const hold=transaction(()=>{
      expire();
      const item=inventory(departureId,roomId);
      if (guestCount>item.capacity) throw problem(400,'Guest count exceeds room capacity');
      if (!available(departureId,roomId)) throw problem(409,'That room was just booked or is held in checkout');
      let amount=item.capacity*item.price_per_person;
      let offerId=null;
      if (input.offer_id) {
        const offer=statement('SELECT * FROM offers WHERE id=?',input.offer_id);
        if (!offer || offer.status!=='accepted' || offer.expires_at<=now() || offer.departure_id!==departureId ||
          offer.room_id!==roomId || offer.guest_count!==guestCount) throw problem(409,'Offer is no longer valid');
        amount=offer.final_amount; offerId=offer.id;
      }
      const id=uid('HOLD'),expires_at=now()+10*60000;
      db.prepare('INSERT INTO holds (id,departure_id,room_id,guest_count,amount,offer_id,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(id,departureId,roomId,guestCount,amount,offerId,expires_at,now());
      return {id,expires_at,amount,fee:feeFor(amount),room:item.room_name,boat:item.boat_name,date:item.departure_date,demo:true};
    });
    return send(res,201,hold);
  }
  if (req.method==='POST' && route==='/api/checkout') {
    const input=await body(req);
    const name=requiredText(input.guest_name),phone=requiredText(input.guest_phone,30);
    if (!name||!phone||!/^\+?[0-9\s-]{8,20}$/.test(phone)) throw problem(400,'Enter a name and valid phone number');
    const booking=transaction(()=>{
      expire();
      const hold=statement("SELECT * FROM holds WHERE id=? AND status='active'",input.hold_id);
      if (!hold||hold.expires_at<=now()) throw problem(409,'Checkout hold expired; select your room again');
      const item=inventory(hold.departure_id,hold.room_id);
      if (hold.guest_count>item.capacity) throw problem(409,'Room capacity changed during checkout');
      if (statement('SELECT id FROM bookings WHERE departure_id=? AND room_id=?',hold.departure_id,hold.room_id))
        throw problem(409,'Room already booked');
      const id=uid('HB');
      db.prepare('INSERT INTO bookings (id,departure_id,room_id,guest_count,amount,fee,guest_name,guest_phone,terms_snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(id,hold.departure_id,hold.room_id,hold.guest_count,hold.amount,feeFor(hold.amount),name,phone,terms,now());
      db.prepare("UPDATE holds SET status='converted' WHERE id=?").run(hold.id);
      if (hold.offer_id) db.prepare("UPDATE offers SET status='booked' WHERE id=?").run(hold.offer_id);
      return id;
    });
    return send(res,201,{booking_id:booking,demo:true});
  }
  if (req.method==='GET' && route.startsWith('/api/bookings/')) {
    const id=route.split('/')[3];
    const b=statement(`SELECT x.*,d.departure_date,d.return_date,r.name room_name,b.name boat_name,b.departure_point
      FROM bookings x JOIN departures d ON d.id=x.departure_id JOIN rooms r ON r.id=x.room_id
      JOIN boats b ON b.id=r.boat_id WHERE x.id=?`,id);
    if (!b) throw problem(404,'Booking not found');
    return send(res,200,{...b,guest_phone:isAdmin(req)?b.guest_phone:undefined,guest_name:isAdmin(req)?b.guest_name:undefined,demo:true});
  }
  if (req.method==='POST' && route==='/api/offers') {
    const input=await body(req);
    const departureId=positiveInt(input.departure_id),roomId=positiveInt(input.room_id),
      guestCount=positiveInt(input.guest_count),amount=positiveInt(input.amount),
      name=requiredText(input.guest_name),phone=requiredText(input.guest_phone,30);
    if (!departureId||!roomId||!guestCount||!amount||!name||!phone||!/^\+?[0-9\s-]{8,20}$/.test(phone))
      throw problem(400,'Complete the offer, guest name and phone number');
    const offer=transaction(()=>{
      expire();
      const item=inventory(departureId,roomId);
      if (guestCount>item.capacity||amount<1000) throw problem(400,'Invalid guest count or offer amount');
      if (!available(departureId,roomId)) throw problem(409,'Room is currently unavailable');
      const id=uid('OFFER'),expires_at=now()+48*3600000;
      db.prepare('INSERT INTO offers (id,departure_id,room_id,guest_count,guest_name,guest_phone,proposed_amount,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id,departureId,roomId,guestCount,name,phone,amount,expires_at,now());
      return {id,expires_at,status:'pending'};
    });
    return send(res,201,offer);
  }
  if (req.method==='GET' && route.startsWith('/api/offers/')) {
    const o=statement('SELECT * FROM offers WHERE id=?',route.split('/')[3]);
    if (!o) throw problem(404,'Offer not found');
    return send(res,200,{id:o.id,departure_id:o.departure_id,room_id:o.room_id,guest_count:o.guest_count,
      proposed_amount:o.proposed_amount,final_amount:o.final_amount,status:o.status,expires_at:o.expires_at});
  }
  if (req.method==='GET' && route==='/api/owner/catalog') {
    requireAdmin(req);
    return send(res,200,{boats:rows('SELECT * FROM boats ORDER BY showcase DESC,id').map(b=>({
      ...b,
      rooms:rows('SELECT * FROM rooms WHERE boat_id=? ORDER BY id',b.id),
      departures:rows('SELECT * FROM departures WHERE boat_id=? ORDER BY departure_date DESC LIMIT 60',b.id),
      prices:rows(`SELECT p.* FROM departure_prices p JOIN departures d ON d.id=p.departure_id
        WHERE d.boat_id=?`,b.id)
    }))});
  }
  if (req.method==='POST' && route==='/api/owner/boats') {
    requireAdmin(req); const input=await body(req);
    const id=input.id===undefined?null:positiveInt(input.id);
    const name=requiredText(input.name,100),tagline=requiredText(input.tagline,180),
      description=requiredText(input.description,1200),departurePoint=requiredText(input.departure_point,180),
      duration=requiredText(input.duration,100),highlights=listText(input.highlights),
      itinerary=optionalText(input.itinerary,2000),inclusions=optionalText(input.inclusions,2000),
      exclusions=optionalText(input.exclusions,2000);
    if (!name||!tagline||!description||!departurePoint||!duration||!highlights||
      itinerary===null||inclusions===null||exclusions===null) throw problem(400,'Complete the boat details');
    const theme=['blue','green','gold'].includes(input.theme)?input.theme:'blue';
    const published=input.published===false?0:1;
    let sourceUrl=optionalText(input.source_url,400);
    if (sourceUrl===null) throw problem(400,'Invalid source URL');
    if (sourceUrl) {
      try { if (!['https:','http:'].includes(new URL(sourceUrl).protocol)) throw Error(); }
      catch { throw problem(400,'Source URL must use HTTP or HTTPS'); }
    }
    if (id && !statement('SELECT id FROM boats WHERE id=?',id)) throw problem(404,'Boat not found');
    if (id) {
      db.prepare(`UPDATE boats SET name=?,tagline=?,description=?,departure_point=?,duration=?,highlights=?,
        theme=?,source_url=?,itinerary=?,inclusions=?,exclusions=?,published=? WHERE id=?`)
        .run(name,tagline,description,departurePoint,duration,highlights,theme,sourceUrl,itinerary,inclusions,exclusions,published,id);
      return send(res,200,{id});
    }
    const result=db.prepare(`INSERT INTO boats
      (name,tagline,description,departure_point,duration,highlights,theme,source_url,itinerary,inclusions,exclusions,published)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(name,tagline,description,departurePoint,duration,highlights,theme,sourceUrl,itinerary,inclusions,exclusions,published);
    return send(res,201,{id:Number(result.lastInsertRowid)});
  }
  if (req.method==='POST' && route==='/api/owner/rooms') {
    requireAdmin(req); const input=await body(req);
    const boatId=positiveInt(input.boat_id),id=input.id===undefined?null:positiveInt(input.id),
      name=requiredText(input.name,100),capacity=positiveInt(input.capacity),
      price=positiveInt(input.price_per_person),features=listText(input.features);
    if (!boatId||!statement('SELECT id FROM boats WHERE id=?',boatId)||!name||!capacity||capacity>100||
      !price||price>1000000||features===null) throw problem(400,'Enter a valid room, capacity and price');
    const published=input.published===false?0:1;
    if (id) {
      const old=statement('SELECT * FROM rooms WHERE id=? AND boat_id=?',id,boatId);
      if (!old) throw problem(404,'Room not found');
      if (statement(`SELECT id FROM bookings WHERE room_id=? AND guest_count>? AND status='confirmed' LIMIT 1`,id,capacity) ||
        statement(`SELECT id FROM holds WHERE room_id=? AND guest_count>? AND status='active' AND expires_at>? LIMIT 1`,id,capacity,now()))
        throw problem(409,'Capacity cannot fall below a booking or active checkout');
      db.prepare('UPDATE rooms SET name=?,capacity=?,price_per_person=?,features=?,published=? WHERE id=?')
        .run(name,capacity,price,features,published,id);
      return send(res,200,{id});
    }
    const result=db.prepare('INSERT INTO rooms (boat_id,name,capacity,price_per_person,features,published) VALUES (?,?,?,?,?,?)')
      .run(boatId,name,capacity,price,features,published);
    return send(res,201,{id:Number(result.lastInsertRowid)});
  }
  if (req.method==='POST' && route==='/api/owner/prices') {
    requireAdmin(req); const input=await body(req);
    const departureId=positiveInt(input.departure_id),roomId=positiveInt(input.room_id),
      price=positiveInt(input.price_per_person);
    if (!departureId||!roomId||!price||price>1000000||
      !statement('SELECT id FROM departures WHERE id=? AND departure_date>=date(\'now\')',departureId) ||
      !statement('SELECT r.id FROM rooms r JOIN departures d ON d.boat_id=r.boat_id WHERE d.id=? AND r.id=?',departureId,roomId))
      throw problem(400,'Choose a future departure, its room and a valid rate');
    db.prepare(`INSERT INTO departure_prices(departure_id,room_id,price_per_person) VALUES (?,?,?)
      ON CONFLICT(departure_id,room_id) DO UPDATE SET price_per_person=excluded.price_per_person`)
      .run(departureId,roomId,price);
    return send(res,200,{departure_id:departureId,room_id:roomId,price_per_person:price});
  }
  if (req.method==='POST' && route==='/api/owner/departures/status') {
    requireAdmin(req); const input=await body(req);
    const id=positiveInt(input.departure_id),status=input.status;
    if (!id||!['open','closed'].includes(status)) throw problem(400,'Choose a departure and status');
    const departure=statement('SELECT * FROM departures WHERE id=?',id);
    if (!departure) throw problem(404,'Departure not found');
    if (status==='open'&&departure.departure_date<new Date().toISOString().slice(0,10))
      throw problem(409,'Past departures cannot be opened');
    db.prepare('UPDATE departures SET status=? WHERE id=?').run(status,id);
    return send(res,200,{id,status});
  }
  if (req.method==='POST' && route==='/api/owner/rooms/unblock') {
    requireAdmin(req); const input=await body(req);
    const id=requiredText(input.booking_id,80);
    if (!id||!id.startsWith('BLOCK-')) throw problem(400,'Choose an external room block');
    const result=db.prepare("DELETE FROM bookings WHERE id=? AND amount=0 AND guest_name='External booking'").run(id);
    if (!result.changes) throw problem(404,'External room block not found');
    return send(res,200,{id,unblocked:true});
  }
  if (req.method==='POST' && route==='/api/owner/departures') {
    requireAdmin(req); const input=await body(req);
    const boatId=positiveInt(input.boat_id),date=input.departure_date;
    if (!boatId||!statement('SELECT id FROM boats WHERE id=?',boatId)||typeof date!=='string'||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)||date<=new Date().toISOString().slice(0,10)||
      Number.isNaN(Date.parse(date+'T00:00:00Z'))) throw problem(400,'Choose a boat and future date');
    const returnDate=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
    if (statement('SELECT id FROM departures WHERE boat_id=? AND departure_date=?',boatId,date)) throw problem(409,'Departure already exists');
    const result=db.prepare('INSERT INTO departures (boat_id,departure_date,return_date) VALUES (?,?,?)').run(boatId,date,returnDate);
    return send(res,201,{id:Number(result.lastInsertRowid)});
  }
  if (req.method==='POST' && route==='/api/owner/rooms/block') {
    requireAdmin(req); const input=await body(req);
    const departureId=positiveInt(input.departure_id),roomId=positiveInt(input.room_id);
    if (!departureId||!roomId) throw problem(400,'Select departure and room');
    const id=transaction(()=>{
      expire(); inventory(departureId,roomId);
      if (!available(departureId,roomId)) throw problem(409,'Room cannot be blocked while held or booked');
      const id=uid('BLOCK');
      db.prepare('INSERT INTO bookings (id,departure_id,room_id,guest_count,amount,fee,guest_name,guest_phone,terms_snapshot,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(id,departureId,roomId,1,0,0,'External booking','—','Blocked by owner',now(),'confirmed');
      return id;
    });
    return send(res,201,{id});
  }
  if (req.method==='POST' && route.match(/^\/api\/owner\/offers\/[A-Z0-9-]+$/)) {
    requireAdmin(req); const id=route.split('/')[4],input=await body(req);
    const result=transaction(()=>{
      expire();
      const offer=statement('SELECT * FROM offers WHERE id=?',id);
      if (!offer||!['pending','countered'].includes(offer.status)) throw problem(409,'Offer is no longer open');
      if (input.action==='decline') {
        db.prepare("UPDATE offers SET status='declined' WHERE id=?").run(id);
        return {status:'declined'};
      }
      if (!['accept','counter'].includes(input.action)) throw problem(400,'Invalid action');
      if (!available(offer.departure_id,offer.room_id)) throw problem(409,'Room is unavailable');
      const amount=input.action==='accept'?offer.proposed_amount:positiveInt(input.amount);
      if (!amount||amount<1000) throw problem(400,'Invalid counteroffer');
      const status=input.action==='accept'?'accepted':'countered';
      db.prepare('UPDATE offers SET status=?,final_amount=?,expires_at=? WHERE id=?').run(status,amount,now()+24*3600000,id);
      return {status,final_amount:amount};
    });
    return send(res,200,result);
  }
  if (req.method==='POST' && route.match(/^\/api\/offers\/[A-Z0-9-]+\/accept$/)) {
    const id=route.split('/')[3],input=await body(req);
    const offer=statement('SELECT * FROM offers WHERE id=?',id);
    if (!offer||offer.status!=='countered'||offer.expires_at<=now()) throw problem(409,'Counteroffer expired');
    if (input.phone!==offer.guest_phone) throw problem(403,'Phone number does not match the offer');
    db.prepare("UPDATE offers SET status='accepted' WHERE id=? AND status='countered'").run(id);
    return send(res,200,{status:'accepted'});
  }
  if (req.method==='GET' && route==='/api/owner/overview') {
    requireAdmin(req); expire();
    return send(res,200,{
      offers:rows(`SELECT o.*,b.name boat_name,r.name room_name,d.departure_date FROM offers o
        JOIN rooms r ON r.id=o.room_id JOIN boats b ON b.id=r.boat_id JOIN departures d ON d.id=o.departure_id
        ORDER BY o.created_at DESC LIMIT 80`),
      bookings:rows(`SELECT x.*,b.name boat_name,r.name room_name,d.departure_date FROM bookings x
        JOIN rooms r ON r.id=x.room_id JOIN boats b ON b.id=r.boat_id JOIN departures d ON d.id=x.departure_id
        ORDER BY x.created_at DESC LIMIT 80`)
    });
  }
  throw problem(404,'Not found');
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if (req.method==='POST' && req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)
      throw problem(403,'Cross-origin request rejected');
    if (url.pathname.startsWith('/api/')) return await api(req,res,url);
    const target=url.pathname==='/'||url.pathname==='/owner'?'/index.html':url.pathname;
    const filename=path.resolve(ROOT,'public','.'+target);
    if (!filename.startsWith(path.join(ROOT,'public')+path.sep)) throw problem(404,'Not found');
    const stat=fs.statSync(filename);
    if (!stat.isFile()) throw problem(404,'Not found');
    res.writeHead(200,{'content-type':MIME[path.extname(filename)]||'application/octet-stream','x-content-type-options':'nosniff'});
    fs.createReadStream(filename).pipe(res);
  } catch(e) {
    if (e.code==='ENOENT'||e.code==='EISDIR') return send(res,404,{error:'Not found'});
    if (e.code?.startsWith('SQLITE_CONSTRAINT')) return send(res,409,{error:'Room or date is no longer available'});
    if (!e.status) console.error(e);
    send(res,e.status||500,{error:e.status?e.message:'Unexpected server error'});
  }
});
if (process.env.NODE_ENV==='production') {
  const missing=['ADMIN_PASSWORD','SESSION_SECRET'].filter(key=>!process.env[key]);
  if (missing.length) throw new Error('Missing Render environment variable(s): '+missing.join(', ')+'. Add them in the service Environment settings and redeploy.');
}
const port=Number(process.env.PORT)||3000;
if (process.env.NODE_ENV!=='test') server.listen(port,()=>console.log('Nautilus site listening on '+port));
export {server,db};
