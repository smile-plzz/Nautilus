import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=mkdtempSync(path.join(os.tmpdir(),'nautilus-test-'));
const port=33000+Math.floor(Math.random()*10000);
const base='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(''),env:{...process.env,DATA_DIR:dir,PORT:String(port),ADMIN_PASSWORD:'test-secret',SESSION_SECRET:'test-signature-secret'},stdio:'ignore'});
async function call(route,body,cookie=''){
  const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',cookie},body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};
}
async function ready(){
  for(let i=0;i<60;i++){try{const r=await call('/api/health');if(r.status===200)return}catch{} await new Promise(resolve=>setTimeout(resolve,50))}
  throw Error('Server did not start');
}

test('Nautilus-only catalog books a private room once and supports owner inventory',async()=>{
  try{
    await ready();
    const page=await fetch(base+'/');
    assert.equal(page.status,200);
    const html=await page.text();
    assert.match(html,/NAUTILUS/);
    assert.match(html,/SAFETY · SERVICE · TRUST/);
    assert.match(html,/No money is collected/);
    const catalog=await call('/api/catalog');
    assert.equal(catalog.data.boats.length,1);
    const boat=catalog.data.boats[0];
    assert.equal(boat.name,'Nautilus');
    assert.equal(boat.source_url,'https://www.bdcruise.com/nautilus/');
    assert.deepEqual(boat.rooms.map(r=>r.capacity).sort((a,b)=>a-b),[4,5,6,8,12]);
    const date=boat.departures[0],room=boat.rooms.find(r=>r.capacity===4);
    const key={departure_id:date.id,room_id:room.id,guest_count:2};
    const parallel=await Promise.all([call('/api/holds',key),call('/api/holds',key)]);
    assert.deepEqual(parallel.map(r=>r.status).sort(),[201,409]);
    const hold=parallel.find(r=>r.status===201).data;
    assert.equal(hold.amount,room.price_per_person*room.capacity);
    const confirmed=await call('/api/checkout',{hold_id:hold.id,guest_name:'Test Guest',guest_phone:'01700000000'});
    assert.equal(confirmed.status,201);
    assert.equal((await call('/api/holds',key)).status,409);
    const booking=await call('/api/bookings/'+confirmed.data.booking_id);
    assert.equal(booking.data.boat_name,'Nautilus');
    assert.match(booking.data.terms_snapshot,/Concept reservation only/);

    const login=await call('/api/login',{password:'test-secret'});
    assert.equal(login.status,200);
    const owner=login.cookie.split(';')[0];
    const overview=await call('/api/owner/overview',undefined,owner);
    assert.equal(overview.data.bookings.length,1);

    const next=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
    const departure=await call('/api/owner/departures',{boat_id:boat.id,departure_date:next},owner);
    assert.equal(departure.status,201);
    const price=await call('/api/owner/prices',{departure_id:departure.data.id,room_id:room.id,price_per_person:12000},owner);
    assert.equal(price.status,200);
    const updated=await call('/api/catalog');
    assert.equal(updated.data.boats.length,1);
    const specific=updated.data.boats[0].departures.find(d=>d.id===departure.data.id);
    assert.equal(specific.prices[room.id],12000);
    assert.equal((await call('/api/owner/catalog')).status,401);
    // Checkout carries the actual guest count and a hold can be abandoned safely.
    assert.equal(hold.guest_count,2);
    const releaseKey={departure_id:departure.data.id,room_id:room.id,guest_count:1};
    const released=await call('/api/holds',releaseKey);
    assert.equal(released.status,201);
    assert.equal((await call('/api/holds/release',{hold_id:released.data.id})).status,200);
    assert.equal((await call('/api/checkout',{hold_id:released.data.id,guest_name:'Guest',guest_phone:'01700000000'})).status,409);
    const retry=await call('/api/holds',releaseKey);
    assert.equal(retry.status,201);
    await call('/api/holds/release',{hold_id:retry.data.id});
    // Guest lookup verifies both reference and phone; owner cancellation permits rebooking.
    assert.equal((await call('/api/guest/lookup',{reference:confirmed.data.booking_id,phone:'01811111111'})).status,404);
    assert.equal((await call('/api/guest/lookup',{reference:confirmed.data.booking_id,phone:'01700000000'})).data.kind,'booking');
    assert.equal((await call('/api/owner/bookings/cancel',{booking_id:confirmed.data.booking_id})).status,401);
    assert.equal((await call('/api/owner/bookings/cancel',{booking_id:confirmed.data.booking_id},owner)).status,200);
    const rebook=await call('/api/holds',key);
    assert.equal(rebook.status,201);
    assert.equal((await call('/api/checkout',{hold_id:rebook.data.id,guest_name:'New Guest',guest_phone:'01700000000'})).status,201);
    // Offer: submit, counter, guest accepts, checkout uses the agreed amount.
    const offerRoom=boat.rooms.find(r=>r.capacity===5);
    const offer=await call('/api/offers',{departure_id:departure.data.id,room_id:offerRoom.id,guest_count:3,amount:50000,guest_name:'Offer Guest',guest_phone:'01800000000'});
    assert.equal(offer.status,201);
    assert.equal((await call('/api/owner/offers/'+offer.data.id,{action:'counter',amount:55000},owner)).status,200);
    assert.equal((await call('/api/offers/'+offer.data.id+'/accept',{phone:'01900000000'})).status,403);
    assert.equal((await call('/api/offers/'+offer.data.id+'/accept',{phone:'01800000000'})).status,200);
    const offerHold=await call('/api/holds',{departure_id:departure.data.id,room_id:offerRoom.id,guest_count:3,offer_id:offer.data.id});
    assert.equal(offerHold.data.amount,55000);
    assert.equal((await call('/api/checkout',{hold_id:offerHold.data.id,guest_name:'Offer Guest',guest_phone:'01800000000'})).status,201);
    assert.equal((await call('/api/offers/'+offer.data.id)).data.status,'booked');
    // Content persists and rejects executable URLs; exports remain owner-only.
    const content=(await call('/api/content')).data;
    assert.equal((await call('/api/owner/content',{...content,hero_image:'javascript:alert(1)'},owner)).status,400);
    assert.equal((await call('/api/owner/content',{...content,story:'Our owner-approved demo story.'},owner)).status,200);
    assert.equal((await call('/api/content')).data.story,'Our owner-approved demo story.');
    assert.equal((await call('/api/owner/export')).status,401);
    const exported=await fetch(base+'/api/owner/export',{headers:{cookie:owner}});
    assert.equal(exported.status,200);
    assert.match(await exported.text(),/New Guest/);
    assert.equal((await call('/api/login',{password:'é'.repeat(11)})).status,401);
    const invalidDate=(new Date(Date.now()+365*86400000).getUTCFullYear())+'-02-30';
    assert.equal((await call('/api/owner/departures',{boat_id:boat.id,departure_date:invalidDate},owner)).status,400);

  }finally{
    child.kill();
    rmSync(dir,{recursive:true,force:true});
  }
});
