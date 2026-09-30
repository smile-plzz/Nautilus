const $ = selector => document.querySelector(selector);
const money = n => 'Tk ' + Number(n).toLocaleString('en-BD');
const fmt = date => new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const rate = (room,departure) => Number(departure?.prices?.[room.id]??room.price_per_person);
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const defaultReviews=$('#review-list').innerHTML, defaultProof=$('#proof-grid').innerHTML;
let catalog={boats:[]}, siteContent={};
let current=null,chosenDate=null,chosenRoom=null,hold=null;
const modal=$('#modal'),modalBody=$('#modal-body');
const toast=message=>{const el=$('#toast');el.textContent=message;el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',4300)};
async function api(url,options={}) {
  const r=await fetch(url,{...options,headers:{'content-type':'application/json',...options.headers}});
  const data=await r.json();
  if (!r.ok) throw new Error(data.error||'Something went wrong');
  return data;
}
function open(html){clearInterval(checkout.timer);modalBody.innerHTML=html;if(!modal.open)modal.showModal()}
function close(){
  const activeHold=hold; hold=null; clearInterval(checkout.timer);
  modal.close();modalBody.innerHTML='';document.body.classList.remove('owner-view');
  if(activeHold)api('/api/holds/release',{method:'POST',body:JSON.stringify({hold_id:activeHold.id})}).then(refresh).catch(()=>{});
}
modal.addEventListener('cancel',event=>{event.preventDefault();close()});
$('#close-modal').onclick=close;
modal.addEventListener('click',event=>{if(event.target===modal) close()});
function loading(button,promise){button.disabled=true;const label=button.textContent;button.textContent='Please wait…';return promise.finally(()=>{button.disabled=false;button.textContent=label})}
async function refresh(){
  catalog=await api('/api/catalog');
  const dates=[...new Set(catalog.boats.flatMap(b=>b.departures.map(d=>d.departure_date)))].sort();
  const select=$('#date-filter'),selected=select.value;
  select.innerHTML='<option value="">Any date</option>'+dates.map(d=>`<option value="${d}">${fmt(d)}</option>`).join('');
  select.value=dates.includes(selected)?selected:'';
  renderBoats();
}
function renderBoats(){
  const date=$('#date-filter').value,guests=Number($('#guests-filter').value);
  const items=catalog.boats.filter(b=>b.departures.some(d=>(!date||d.departure_date===date)&&b.rooms.some(r=>r.capacity>=guests&&!d.unavailable.includes(r.id))));
  $('#result-count').textContent=`${items.reduce((n,b)=>n+b.departures.filter(d=>!date||d.departure_date===date).reduce((m,d)=>m+b.rooms.filter(r=>r.capacity>=guests&&!d.unavailable.includes(r.id)).length,0),0)} cabin / date options`;
  $('#boats').innerHTML=items.length?items.map(b=>{
    const options=b.departures.filter(d=>!date||d.departure_date===date)
      .flatMap(d=>b.rooms.filter(r=>r.capacity>=guests&&!d.unavailable.includes(r.id)).map(r=>r.capacity*rate(r,d)));
    const lowest=Math.min(...options);
    return `<article class="boat-card"><div class="card-art ${b.theme}"><img src="${escapeHTML(siteContent.hero_image||'/images/nautilus-6.jpg')}" alt="Nautilus houseboat" loading="lazy"><span class="art-tag">PRIVATE CABIN · 2 DAYS / 1 NIGHT</span></div><div class="card-content">
      <span class="card-location">↗ ${escapeHTML(b.departure_point)}</span><h3>${escapeHTML(b.name)}</h3>
      <p>${escapeHTML(b.tagline)}</p><div class="card-line"></div><div class="card-meta"><div><small>Private rooms from</small><strong>${money(lowest)}</strong></div><button data-boat="${b.id}">Choose a cabin</button></div></div></article>`;
  }).join(''):'<div class="empty">No rooms match those filters. Try another date or group size.</div>';
  document.querySelectorAll('[data-boat]').forEach(button=>button.onclick=()=>showBoat(Number(button.dataset.boat)));
}
$('#date-filter').onchange=renderBoats;$('#guests-filter').onchange=renderBoats;
function showBoat(id,dateId=null,roomId=null){
  current=catalog.boats.find(b=>b.id===id);
  chosenDate=current.departures.find(d=>d.id===dateId)||current.departures.find(d=>d.departure_date===$('#date-filter').value)||current.departures[0];
  chosenRoom=current.rooms.find(r=>r.id===roomId)||current.rooms.find(r=>chosenDate&&r.capacity>=Number($('#guests-filter').value)&&!chosenDate.unavailable.includes(r.id))||current.rooms[0];
  renderBoat();
}
function renderBoat(){
  if (!chosenDate) return open('<div class="modal-inner"><h2>No departures yet</h2><p>Check back later.</p></div>');
  const unavailable=chosenDate.unavailable.includes(chosenRoom.id)||chosenRoom.capacity<Number($('#guests-filter').value);
  const currentRate=rate(chosenRoom,chosenDate),listed=chosenRoom.capacity*currentRate;
  open(`<div class="modal-inner"><div class="section-kicker">${current.showcase?'INDEPENDENT CONCEPT PREVIEW':'THE BOAT'}</div><h2>${escapeHTML(current.name)}</h2><p class="muted">${escapeHTML(current.description)}<br>↗ ${escapeHTML(current.departure_point)} · ${escapeHTML(current.duration)}</p>
  ${current.showcase?`<p class="notice">Published trip details are a reference, not operator-confirmed inventory or an official Nautilus booking page. <a href="${escapeHTML(current.source_url)}" target="_blank" rel="noopener noreferrer">View the BD Cruise source</a></p>`:''}
  ${current.itinerary||current.inclusions||current.exclusions?`<div class="source-details">${current.itinerary?`<b>Trip outline</b><p>${escapeHTML(current.itinerary)}</p>`:''}${current.inclusions?`<b>Included</b><p>${escapeHTML(current.inclusions)}</p>`:''}${current.exclusions?`<b>Not included</b><p>${escapeHTML(current.exclusions)}</p>`:''}</div>`:''}
  <label class="guest-selector">Guests travelling <input id="trip-guests" type="number" min="1" max="${Math.max(...current.rooms.map(r=>r.capacity))}" value="${Number($('#guests-filter').value)}"></label><h3>Choose a departure</h3><div class="departure-list">${current.departures.map(d=>`<button class="date-pill ${d.id===chosenDate.id?'active':''}" data-date="${d.id}">${fmt(d.departure_date)}</button>`).join('')}</div>
  <h3>Choose a private room</h3><div class="room-list">${current.rooms.map(r=>`<button class="room-option ${r.id===chosenRoom.id?'active':''}" data-room="${r.id}" ${chosenDate.unavailable.includes(r.id)||r.capacity<Number($('#guests-filter').value)?'disabled':''}><span><b>${escapeHTML(r.name)}</b><small>Up to ${r.capacity} guest${r.capacity===1?'':'s'} · ${escapeHTML(r.features.join(' · '))}${chosenDate.unavailable.includes(r.id)?' · Unavailable':r.capacity<Number($('#guests-filter').value)?' · Too small for your group':''}</small></span><strong>${money(r.capacity*rate(r,chosenDate))}</strong></button>`).join('')}</div>
  <div class="booking-summary"><div>${escapeHTML(chosenRoom.name)} · up to ${chosenRoom.capacity} guests</div><strong>${money(listed)} total</strong><div>At ${money(currentRate)} × ${chosenRoom.capacity} places · private room · package included</div></div>
  <p class="notice">Preview only: no money is collected. ${current.showcase?'These dates, cabin entries and the ৳15,000 per-person rate are illustrative, not Nautilus-approved availability or a current quote.':'These boats and dates are fictional.'} A pending offer does not reserve the room.</p>
  <div class="actions"><button class="button dark" id="book-now" ${unavailable?'disabled':''}>Book at listed price</button><button class="button ghost" id="make-offer" ${unavailable?'disabled':''}>Make an offer</button></div></div>`);
  $('#trip-guests').onchange=e=>{const count=Number(e.target.value);if(count===Number($('#guests-filter').value))return;if(!Number.isInteger(count)||count<1||count>Math.max(...current.rooms.map(r=>r.capacity))){toast('Enter a guest count within the cabin capacity');return}if(![...$('#guests-filter').options].some(o=>Number(o.value)===count))$('#guests-filter').add(new Option(`${count} guests`,String(count)));$('#guests-filter').value=String(count);chosenRoom=current.rooms.find(r=>r.capacity>=count&&!chosenDate.unavailable.includes(r.id))||chosenRoom;renderBoats();renderBoat()};
  modalBody.querySelectorAll('[data-date]').forEach(btn=>btn.onclick=()=>{chosenDate=current.departures.find(d=>d.id===Number(btn.dataset.date));if(chosenDate.unavailable.includes(chosenRoom.id))chosenRoom=current.rooms.find(r=>!chosenDate.unavailable.includes(r.id))||current.rooms[0];renderBoat()});
  modalBody.querySelectorAll('[data-room]').forEach(btn=>btn.onclick=()=>{chosenRoom=current.rooms.find(r=>r.id===Number(btn.dataset.room));renderBoat()});
  $('#book-now').onclick=()=>startHold();
  $('#make-offer').onclick=offerForm;
}
async function startHold(offerId=null,guestCount=null){
  try{
    hold=await api('/api/holds',{method:'POST',body:JSON.stringify({departure_id:chosenDate.id,room_id:chosenRoom.id,guest_count:guestCount||Math.min(Number($('#guests-filter').value),chosenRoom.capacity),offer_id:offerId})});
    checkout();
    await refresh();
  }catch(e){toast(e.message);await refresh()}
}
function checkout(){
  open(`<div class="modal-inner"><div class="section-kicker">SIMULATED CHECKOUT</div><h2>Almost on your way.</h2><p class="muted">Your room is held until ${new Date(hold.expires_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}. Payment is simulated in this prototype.</p>
  <div class="booking-summary">${escapeHTML(hold.boat)} · ${escapeHTML(hold.room)}<br>${fmt(hold.date)} · ${hold.guest_count} guest${hold.guest_count===1?'':'s'}<br><strong>${money(hold.amount)} total</strong><br><small>Illustrative platform fee: ${money(hold.fee)} included in total.</small></div>
  <form class="form" id="checkout-form"><label>Your name<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label><label>Phone number<input name="phone" type="tel" required placeholder="01XXXXXXXXX" autocomplete="tel"></label><p class="notice">Demo checkout. Clicking confirm creates a sample booking without charging you.</p><label class="consent"><input type="checkbox" required> I understand this creates a sample booking and does not charge money or reserve a real trip.</label><button class="button dark" type="submit">Confirm sample booking</button></form></div>`);
  const time=document.createElement('p');time.className='hold-countdown';time.setAttribute('role','timer');$('#checkout-form').before(time);
  const tick=()=>{const seconds=Math.max(0,Math.ceil((hold.expires_at-Date.now())/1000));time.textContent=`Cabin held for ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(!seconds){clearInterval(checkout.timer);$('#checkout-form button').disabled=true;time.textContent='Hold expired. Close this window and choose your cabin again.'}};
  tick();checkout.timer=setInterval(tick,1000);
  $('#checkout-form').onsubmit=async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    try{
      const result=await loading(form.querySelector('button'),api('/api/checkout',{method:'POST',body:JSON.stringify({hold_id:hold.id,guest_name:form.elements.namedItem('name').value,guest_phone:form.elements.namedItem('phone').value})}));
      const id=result.booking_id;hold=null;clearInterval(checkout.timer);await refresh();confirmation(id);
    }catch(err){toast(err.message);if(err.message.includes('expired')){close();await refresh()}}
  };
}
async function confirmation(id){
  const b=await api('/api/bookings/'+encodeURIComponent(id));
  open(`<div class="modal-inner"><div class="section-kicker">SAMPLE RESERVATION</div><h2>Your trip is on the horizon.</h2><p class="muted">This is a simulated confirmation; it cannot be used to board a boat.</p>
  <div class="booking-summary"><b>Booking ID: ${escapeHTML(b.id)}</b><br>Status: ${escapeHTML(b.status)}<br>${escapeHTML(b.boat_name)} · ${escapeHTML(b.room_name)}<br>${fmt(b.departure_date)} – ${fmt(b.return_date)}<br>${b.guest_count} guests · ${money(b.amount)}<br>Boarding: ${escapeHTML(b.departure_point)}</div>
  <p class="notice">${escapeHTML(b.terms_snapshot)}</p><div class="actions"><button class="button dark" id="done">Done</button><button class="button ghost" id="print-booking">Print summary</button></div></div>`);
  $('#done').onclick=close;$('#print-booking').onclick=()=>window.print();
}
function offerForm(){
  open(`<div class="modal-inner"><div class="section-kicker">MAKE IT YOURS</div><h2>Propose a price.</h2><p class="muted">${escapeHTML(current.name)} · ${escapeHTML(chosenRoom.name)} · ${fmt(chosenDate.departure_date)}. Listed total: ${money(chosenRoom.capacity*rate(chosenRoom,chosenDate))}.</p>
  <form class="form" id="offer-form"><label>Number of guests<input name="guests" type="number" min="1" max="${chosenRoom.capacity}" value="${Math.min(Number($('#guests-filter').value),chosenRoom.capacity)}" required></label>
  <label>Your total offer (BDT)<input name="amount" type="number" min="1000" step="1" required placeholder="e.g. 65000"></label>
  <label>Your name<input name="name" required minlength="2" maxlength="100"></label><label>Phone number<input name="phone" type="tel" required placeholder="01XXXXXXXXX"></label>
  <p class="notice">Offers last 48 hours. The room remains available to other guests until you start checkout on an accepted offer.</p><button class="button dark" type="submit">Send offer</button></form></div>`);
  $('#offer-form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget;
    try{
      const result=await loading(form.querySelector('button'),api('/api/offers',{method:'POST',body:JSON.stringify({
        departure_id:chosenDate.id,room_id:chosenRoom.id,guest_count:Number(form.guests.value),
        amount:Number(form.elements.namedItem('amount').value),guest_name:form.elements.namedItem('name').value,guest_phone:form.elements.namedItem('phone').value
      })}));
      offerStatus(result.id,form.elements.namedItem('phone').value);
    }catch(err){toast(err.message)}
  };
}
async function manageListings(initialBoats=null,selectedBoat=null){
  const boats=initialBoats||(await api('/api/owner/catalog')).boats;
  const options='<option value="">New boat</option>'+boats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
  open(`<div class="modal-inner"><div class="section-kicker">OWNER CATALOG · DEMO</div><h2>Make it yours.</h2>
    <p class="muted">Edit trip descriptions and cabin inventory. Existing demo bookings keep their agreed amount. Publishing a listing does not make it a real trip.</p>
    <form class="form" id="boat-editor"><h3>Boat details</h3><label>Choose a boat<select name="id">${options}</select></label>
      <label>Name<input name="name" required maxlength="100"></label><label>Short tagline<input name="tagline" required maxlength="180"></label>
      <label>Description<textarea name="description" rows="4" required maxlength="1200"></textarea></label>
      <label>Boarding point<input name="departure_point" required maxlength="180"></label>
      <label>Duration<input name="duration" required maxlength="100" placeholder="2 days · 1 night"></label>
      <label>Highlights (one per line)<textarea name="highlights" rows="3" maxlength="1200"></textarea></label>
      <label>Theme<select name="theme"><option value="blue">Blue</option><option value="green">Green</option><option value="gold">Gold</option></select></label>
      <label>Published source URL (optional)<input name="source_url" type="url" maxlength="400"></label>
      <label>Itinerary summary<textarea name="itinerary" rows="3" maxlength="2000"></textarea></label>
      <label>What is included<textarea name="inclusions" rows="3" maxlength="2000"></textarea></label>
      <label>What is excluded<textarea name="exclusions" rows="3" maxlength="2000"></textarea></label>
      <label><input name="published" type="checkbox" checked> Show in public catalog</label>
      <button class="button dark" type="submit">Save boat</button></form>
    <form class="form" id="room-editor"><h3>Private rooms</h3><label>Boat<select name="boat_id">${boats.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}</select></label>
      <label>Choose a room<select name="id"></select></label>
      <label>Room name<input name="name" required maxlength="100"></label>
      <label>Capacity<input name="capacity" type="number" required min="1" max="100"></label>
      <label>Default rate per person (BDT)<input name="price_per_person" type="number" required min="1" max="1000000"></label>
      <label>Features (one per line)<textarea name="features" rows="3" maxlength="1200"></textarea></label>
      <label><input name="published" type="checkbox" checked> Show this room</label>
      <button class="button dark" type="submit">Save room</button></form>
    <div class="actions" style="margin-top:26px"><button class="button ghost" id="back-owner">Back to dashboard</button></div></div>`);
  const boatForm=$('#boat-editor'),roomForm=$('#room-editor');
  const el=(form,name)=>form.elements.namedItem(name);
  function fillBoat(){
    const b=boats.find(item=>item.id===Number(el(boatForm,'id').value));
    for(const key of ['name','tagline','description','departure_point','duration','highlights','theme','source_url','itinerary','inclusions','exclusions'])
      el(boatForm,key).value=b?(key==='highlights'?b.highlights.replaceAll('|','\n'):b[key]||''):'';
    if(!b)el(boatForm,'theme').value='blue';
    el(boatForm,'published').checked=b?Boolean(b.published):true;
  }
  function fillRoom(){
    const b=boats.find(item=>item.id===Number(el(roomForm,'boat_id').value));
    el(roomForm,'id').innerHTML='<option value="">New room</option>'+(b?.rooms||[]).map(r=>`<option value="${r.id}">${escapeHTML(r.name)}</option>`).join('');
    for(const key of ['name','capacity','price_per_person','features'])el(roomForm,key).value='';
    el(roomForm,'published').checked=true;
  }
  function chooseRoom(){
    const b=boats.find(item=>item.id===Number(el(roomForm,'boat_id').value));
    const r=b?.rooms.find(item=>item.id===Number(el(roomForm,'id').value));
    for(const key of ['name','capacity','price_per_person','features'])
      el(roomForm,key).value=r?(key==='features'?r.features.replaceAll('|','\n'):r[key]):'';
    el(roomForm,'published').checked=r?Boolean(r.published):true;
  }
  el(boatForm,'id').onchange=fillBoat;fillBoat();
  el(roomForm,'boat_id').onchange=fillRoom;fillRoom();
  el(roomForm,'id').onchange=chooseRoom;
  if(selectedBoat&&boats.some(b=>b.id===selectedBoat)){
    el(boatForm,'id').value=String(selectedBoat);fillBoat();
    el(roomForm,'boat_id').value=String(selectedBoat);fillRoom();
  }
  boatForm.onsubmit=async e=>{
    e.preventDefault();
    const input={};
    for(const key of ['name','tagline','description','departure_point','duration','highlights','theme','source_url','itinerary','inclusions','exclusions'])input[key]=el(boatForm,key).value;
    if(el(boatForm,'id').value)input.id=Number(el(boatForm,'id').value);
    input.published=el(boatForm,'published').checked;
    try{const result=await api('/api/owner/boats',{method:'POST',body:JSON.stringify(input)});await refresh();manageListings(null,result.id);toast('Boat saved')}
    catch(err){toast(err.message)}
  };
  roomForm.onsubmit=async e=>{
    e.preventDefault();
    const input={boat_id:Number(el(roomForm,'boat_id').value),name:el(roomForm,'name').value,
      capacity:Number(el(roomForm,'capacity').value),price_per_person:Number(el(roomForm,'price_per_person').value),
      features:el(roomForm,'features').value,published:el(roomForm,'published').checked};
    if(el(roomForm,'id').value)input.id=Number(el(roomForm,'id').value);
    try{await api('/api/owner/rooms',{method:'POST',body:JSON.stringify(input)});await refresh();manageListings(null,input.boat_id);toast('Room saved')}
    catch(err){toast(err.message)}
  };
  $('#back-owner').onclick=owner;
}
async function offerStatus(id,phone=''){
  try{
    const o=await api('/api/offers/'+encodeURIComponent(id));
    open(`<div class="modal-inner"><div class="section-kicker">YOUR OFFER</div><h2>${o.status==='accepted'?'Your offer was accepted.':'Offer '+escapeHTML(o.status)+'.'}</h2>
    <div class="booking-summary"><b>${escapeHTML(o.id)}</b><br>Your offer: ${money(o.proposed_amount)}<br>${o.final_amount?'Current agreed price: '+money(o.final_amount)+'<br>':''}Status: ${escapeHTML(o.status)}<br>Expires: ${new Date(o.expires_at).toLocaleString('en-GB')}</div>
    <p class="muted">Save this offer ID to check its status later. The room is only reserved when checkout starts.</p>
    <div class="actions">${o.status==='accepted'?'<button class="button dark" id="offer-pay">Proceed to demo checkout</button>':''}
    ${o.status==='countered'?'<button class="button dark" id="accept-counter">Accept counteroffer</button>':''}
    <button class="button ghost" id="offer-refresh">Refresh status</button></div></div>`);
    $('#offer-refresh').onclick=()=>offerStatus(id,phone);
    if(o.status==='accepted') $('#offer-pay').onclick=async()=>{await refresh();current=catalog.boats.find(b=>b.rooms.some(r=>r.id===o.room_id));chosenDate=current?.departures.find(d=>d.id===o.departure_id);chosenRoom=current?.rooms.find(r=>r.id===o.room_id);if(!chosenDate||!chosenRoom){toast('This departure or cabin is no longer available');return}startHold(id,o.guest_count)};
    if(o.status==='countered') $('#accept-counter').onclick=async()=>{
      const number=phone||prompt('Enter the phone number used for this offer');
      if(!number)return;
      try{await api('/api/offers/'+encodeURIComponent(id)+'/accept',{method:'POST',body:JSON.stringify({phone:number})});offerStatus(id,number)}
      catch(err){toast(err.message)}
    };
  }catch(err){toast(err.message)}
}
$('#owner-link').onclick=owner;
async function owner(){
  document.body.classList.add('owner-view');
  const session=await api('/api/session');
  if(!session.admin){
    open(`<div class="modal-inner"><div class="section-kicker">OWNER ACCESS</div><h2>Welcome aboard.</h2><p class="muted">Prototype owner dashboard for inventory and offers.</p><form class="form" id="login-form"><label>Owner password<input name="password" type="password" required></label><button class="button dark">Open dashboard</button></form></div>`);
    $('#login-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget;try{await loading(form.querySelector('button'),api('/api/login',{method:'POST',body:JSON.stringify({password:form.elements.namedItem('password').value})}));owner()}catch(err){toast(err.message)}};return;
  }
  const overview=await api('/api/owner/overview');
  const ownerCatalog=(await api('/api/owner/catalog')).boats;
  open(`<div class="modal-inner"><div class="section-kicker">OWNER DASHBOARD · DEMO</div><h2>Nautilus operations.</h2><div class="owner-stats"><article><small>Active bookings</small><strong>${overview.bookings.filter(b=>b.status==='confirmed'&&!b.id.startsWith('BLOCK-')).length}</strong></article><article><small>Sample booking value</small><strong>${money(overview.bookings.filter(b=>b.status==='confirmed').reduce((n,b)=>n+b.amount,0))}</strong></article><article><small>Awaiting reply</small><strong>${overview.offers.filter(o=>['pending','countered'].includes(o.status)).length}</strong></article></div><p class="muted">Manage Nautilus’s departures, prices and guest requests. External blocks keep cabins sold by phone or other channels out of the available inventory.</p>
  <div class="actions"><button class="button ghost" id="manage-listings">Cabins & trip details</button><button class="button ghost" id="manage-content">Website content</button><a class="button ghost" href="/api/owner/export" download>Export bookings</a></div>
  <form class="form" id="departure-form"><h3>Add a departure</h3><label>Boat<select name="boat">${ownerCatalog.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}</select></label><label>Departure date<input name="date" type="date" required></label><button class="button dark">Add departure</button></form>
  <form class="form" id="price-form"><h3>Set a dated room rate</h3><label>Boat<select name="boat">${ownerCatalog.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}</select></label><label>Departure<select name="departure"></select></label><label>Room<select name="room"></select></label><label>Rate per person (BDT)<input name="price" type="number" min="1" max="1000000" required></label><button class="button ghost">Save dated rate</button></form>
  <form class="form" id="status-form"><h3>Open or close a departure</h3><label>Boat<select name="boat">${ownerCatalog.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}</select></label><label>Departure<select name="departure"></select></label><label>Status<select name="status"><option value="closed">Close sales</option><option value="open">Open sales</option></select></label><button class="button ghost">Update departure</button></form>
  <form class="form" id="block-form"><h3>Block a room sold elsewhere</h3><label>Boat<select name="boat">${ownerCatalog.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}</select></label><label>Departure<select name="departure"></select></label><label>Room<select name="room"></select></label><button class="button ghost">Block room</button></form>
  <h3>Offers</h3><div class="owner-grid">${overview.offers.length?overview.offers.map(o=>`<div class="owner-item"><b>${escapeHTML(o.boat_name)} · ${escapeHTML(o.room_name)}</b> · ${fmt(o.departure_date)}<br>${escapeHTML(o.guest_name)} · ${escapeHTML(o.guest_phone)} · ${o.guest_count} guests<br>Offered ${money(o.proposed_amount)} · <b>${escapeHTML(o.status)}</b> ${o.final_amount?'· '+money(o.final_amount):''}<br><small>${escapeHTML(o.id)}</small>${['pending','countered'].includes(o.status)?`<div><button data-offer-action="accept" data-id="${o.id}">Accept</button><button data-offer-action="counter" data-id="${o.id}">Counter</button><button data-offer-action="decline" data-id="${o.id}">Decline</button></div>`:''}</div>`).join(''):'<div class="empty">No offers yet.</div>'}</div>
  <h3>Bookings & external blocks</h3><div class="owner-grid">${overview.bookings.length?overview.bookings.map(b=>`<div class="owner-item"><b>${escapeHTML(b.boat_name)} · ${escapeHTML(b.room_name)}</b> · ${fmt(b.departure_date)}<br>${escapeHTML(b.guest_name)} · ${escapeHTML(b.guest_phone)}<br>${money(b.amount)} · ${escapeHTML(b.id)}<span class="status-tag">${escapeHTML(b.status)}</span>${b.status==='confirmed'&&!b.id.startsWith('BLOCK-')?`<div><button data-cancel="${escapeHTML(b.id)}">Cancel sample booking</button></div>`:''}${b.id.startsWith('BLOCK-')?`<div><button data-unblock="${escapeHTML(b.id)}">Reopen external block</button></div>`:''}</div>`).join(''):'<div class="empty">No bookings yet.</div>'}</div>
  <div class="actions" style="margin-top:26px"><button class="button ghost" id="owner-refresh">Refresh</button><button class="button ghost" id="owner-logout">Sign out</button></div></div>`);
  const depForm=$('#departure-form'),blockForm=$('#block-form'),priceForm=$('#price-form'),statusForm=$('#status-form');
  $('#manage-content').onclick=contentEditor;
  $('#manage-listings').onclick=()=>manageListings(ownerCatalog);
  function fill(){
    const boat=ownerCatalog.find(b=>b.id===Number(blockForm.elements.namedItem('boat').value));
    blockForm.elements.namedItem('departure').innerHTML=(boat?.departures||[])
      .filter(d=>d.status==='open'&&d.departure_date>=new Date().toISOString().slice(0,10))
      .map(d=>`<option value="${d.id}">${fmt(d.departure_date)}</option>`).join('');
    blockForm.elements.namedItem('room').innerHTML=(boat?.rooms||[]).filter(r=>r.published)
      .map(r=>`<option value="${r.id}">${escapeHTML(r.name)}</option>`).join('');
  }
  blockForm.elements.namedItem('boat').onchange=fill;fill();
  function fillOwner(form,includeRooms){
    const boat=ownerCatalog.find(b=>b.id===Number(form.elements.namedItem('boat').value));
    form.elements.namedItem('departure').innerHTML=(boat?.departures||[])
      .filter(d=>d.departure_date>=new Date().toISOString().slice(0,10))
      .map(d=>`<option value="${d.id}">${fmt(d.departure_date)} · ${escapeHTML(d.status)}</option>`).join('');
    if(includeRooms)form.elements.namedItem('room').innerHTML=(boat?.rooms||[]).map(r=>`<option value="${r.id}">${escapeHTML(r.name)} · ${money(r.price_per_person)}/person</option>`).join('');
  }
  priceForm.elements.namedItem('boat').onchange=()=>fillOwner(priceForm,true);fillOwner(priceForm,true);
  statusForm.elements.namedItem('boat').onchange=()=>fillOwner(statusForm,false);fillOwner(statusForm,false);
  priceForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/owner/prices',{method:'POST',body:JSON.stringify({departure_id:Number(priceForm.elements.namedItem('departure').value),room_id:Number(priceForm.elements.namedItem('room').value),price_per_person:Number(priceForm.elements.namedItem('price').value)})});await refresh();owner()}catch(err){toast(err.message)}};
  statusForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/owner/departures/status',{method:'POST',body:JSON.stringify({departure_id:Number(statusForm.elements.namedItem('departure').value),status:statusForm.elements.namedItem('status').value})});await refresh();owner()}catch(err){toast(err.message)}};
  depForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/owner/departures',{method:'POST',body:JSON.stringify({boat_id:Number(depForm.elements.namedItem('boat').value),departure_date:depForm.elements.namedItem('date').value})});await refresh();owner()}catch(err){toast(err.message)}};
  blockForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/owner/rooms/block',{method:'POST',body:JSON.stringify({departure_id:Number(blockForm.elements.namedItem('departure').value),room_id:Number(blockForm.elements.namedItem('room').value)})});await refresh();owner()}catch(err){toast(err.message)}};
  modalBody.querySelectorAll('[data-offer-action]').forEach(btn=>btn.onclick=async()=>{
    let amount;
    if(btn.dataset.offerAction==='counter'){amount=Number(prompt('Counteroffer total price (BDT)'));if(!Number.isSafeInteger(amount)||amount<1000)return}
    try{await api('/api/owner/offers/'+btn.dataset.id,{method:'POST',body:JSON.stringify({action:btn.dataset.offerAction,amount})});owner()}catch(err){toast(err.message)}
  });
  modalBody.querySelectorAll('[data-unblock]').forEach(btn=>btn.onclick=async()=>{
    try{await api('/api/owner/rooms/unblock',{method:'POST',body:JSON.stringify({booking_id:btn.dataset.unblock})});await refresh();owner()}catch(err){toast(err.message)}
  });
  modalBody.querySelectorAll('[data-cancel]').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Cancel this sample booking and reopen the cabin?'))return;
    try{await api('/api/owner/bookings/cancel',{method:'POST',body:JSON.stringify({booking_id:btn.dataset.cancel})});await refresh();owner()}catch(err){toast(err.message)}
  });
  const forms=[depForm,priceForm,statusForm,blockForm];
  const panels=document.createElement('div');panels.className='owner-panels';forms[0].before(panels);forms.forEach(form=>panels.append(form));
  $('#owner-refresh').onclick=owner;
  $('#owner-logout').onclick=async()=>{await api('/api/logout',{method:'POST'});close()};
}
Promise.all([loadContent(),refresh()]).then(renderBoats).catch(err=>{ $('#boats').innerHTML='<div class="empty">We could not load availability. <button id="retry">Try again</button></div>';$('#retry').onclick=()=>location.reload();toast(err.message)});
if(location.pathname==='/owner')owner().catch(err=>toast(err.message));

$('#menu-toggle').onclick=()=>{const expanded=$('#menu-toggle').getAttribute('aria-expanded')!=='true';$('#menu-toggle').setAttribute('aria-expanded',String(expanded));$('#main-nav').classList.toggle('expanded',expanded)};
$('#main-nav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#main-nav').classList.remove('expanded');$('#menu-toggle').setAttribute('aria-expanded','false')}));
$('#lookup-link').onclick=lookup;
function lookup(){
  open(`<div class="modal-inner"><div class="section-kicker">RETURN TO YOUR PLANS</div><h2>Find your booking.</h2><p class="muted">Use the reference from your sample booking or offer and the phone number you entered.</p><form class="form" id="lookup-form"><label>Booking or offer reference<input name="reference" required placeholder="HB-… or OFFER-…" maxlength="80"></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" required></label><button class="button dark">Check status</button></form></div>`);
  $('#lookup-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{const result=await loading(f.querySelector('button'),api('/api/guest/lookup',{method:'POST',body:JSON.stringify({reference:f.reference.value.trim().toUpperCase(),phone:f.phone.value.trim()})}));if(result.kind==='offer')offerStatus(result.item.id,f.phone.value.trim());else confirmation(result.item.id)}catch(err){toast(err.message)}};
}
async function loadContent(){
  siteContent=await api('/api/content');
  const c=siteContent;
  $('.hero-art').style.backgroundImage=`linear-gradient(90deg,rgba(6,24,34,.92),rgba(6,24,34,.5) 55%,rgba(6,24,34,.1)),url(${JSON.stringify(c.hero_image)})`;
  $('#story-copy').textContent=c.story;
  $('#boarding-notes').textContent=c.boarding_notes;
  $('#gallery-grid').innerHTML=c.gallery.map((item,i)=>`<button class="gallery-tile" data-image="${i}"><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.caption)}" loading="lazy"><span>${escapeHTML(item.caption)}</span></button>`).join('');
  $('#gallery-grid').querySelectorAll('[data-image]').forEach(btn=>btn.onclick=()=>{const item=c.gallery[Number(btn.dataset.image)];open(`<div class="lightbox"><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.caption)}"><p>${escapeHTML(item.caption)}</p></div>`)});
  $('#crew-list').innerHTML=c.crew.map(person=>`<article><b>${escapeHTML(person.name)}</b><span>${escapeHTML(person.role)}</span></article>`).join('');
  $('#review-list').innerHTML=defaultReviews;$('#proof-grid').innerHTML=defaultProof;
  if(c.reviews.length)$('#review-list').innerHTML=c.reviews.map(r=>`<div class="voice-card"><div class="quote-mark">“</div><blockquote>${escapeHTML(r.quote)}</blockquote><div class="voice-source">${escapeHTML(r.name)} · ${escapeHTML(r.source)}</div></div>`).join('');
  if(c.credentials.length)$('#proof-grid').innerHTML=c.credentials.map(item=>`<article><span>OPERATOR DOCUMENT</span><b>${escapeHTML(item.title)}</b><small>${escapeHTML(item.issuer)}</small>${item.url?`<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">View document</a>`:''}</article>`).join('');
  $('#contact-actions').innerHTML=(c.contact_phone?`<a class="button dark" href="tel:${escapeHTML(c.contact_phone)}">Call Nautilus</a>`:'')+(c.whatsapp?`<a class="button ghost" href="https://wa.me/${escapeHTML(c.whatsapp)}" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>`:'')+(c.contact_email?`<a href="mailto:${escapeHTML(c.contact_email)}">${escapeHTML(c.contact_email)}</a>`:'')+(!c.contact_phone&&!c.whatsapp&&!c.contact_email?'<p>Direct operator contact will appear here once confirmed by the owner.</p>':'')+'<a class="button dark" href="#book">Explore sample dates</a>';
  const cabins=[{name:'Private AC cabin',image:'/images/nautilus-3.jpg',text:'Rest together in your own space. The public listing describes attached washrooms and air conditioning.'},{name:'Room for your group',image:'/images/nautilus-5.jpg',text:'Pick a cabin category that fits your party. Your price covers the entire cabin, even with fewer guests.'}];
  $('#cabin-showcase').innerHTML=cabins.map(r=>`<article><img src="${r.image}" alt="${r.name}" loading="lazy"><div><h3>${r.name}</h3><p>${r.text}</p></div></article>`).join('');
}
$('#privacy-link').onclick=()=>open(`<div class="modal-inner"><div class="section-kicker">BEFORE YOU BOOK</div><h2>Privacy & trip terms.</h2><h3>Preview privacy</h3><p>${escapeHTML(siteContent.privacy_note)}</p><h3>Cancellation & weather</h3><p>${escapeHTML(siteContent.cancellation_policy)}</p><h3>Boarding</h3><p>${escapeHTML(siteContent.boarding_notes)}</p><p class="notice">All checkout activity in this prototype is simulated. No real reservations or payments are created.</p></div>`);
async function contentEditor(){
  await loadContent();const c=siteContent;
  const fields=[['story','Boat story'],['boarding_notes','Boarding instructions'],['cancellation_policy','Cancellation & weather policy'],['privacy_note','Privacy notice']];
  const lists={gallery:{label:'Gallery · image URL | caption',fields:['url','caption']},reviews:{label:'Guest-approved reviews · name | quote | source',fields:['name','quote','source']},credentials:{label:'Credentials · title | issuer & validity | HTTPS document URL',fields:['title','issuer','url']},crew:{label:'Crew · name | role',fields:['name','role']}};
  open(`<div class="modal-inner"><div class="section-kicker">WEBSITE CONTENT</div><h2>Tell your story.</h2><p class="muted">Only publish accurate, owner-approved content. Leave reviews and credentials empty until real sources are available. Add one entry per line in the lists below, separated by |.</p><form class="form" id="content-form">${fields.map(([key,label])=>`<label>${label}<textarea name="${key}" rows="3" maxlength="2500">${escapeHTML(c[key])}</textarea></label>`).join('')}${[['contact_phone','Operator phone'],['contact_email','Operator email'],['whatsapp','WhatsApp digits with country code'],['hero_image','Hero photo URL']].map(([key,label])=>`<label>${label}<input name="${key}" value="${escapeHTML(c[key])}"></label>`).join('')}${Object.entries(lists).map(([key,config])=>`<label>${config.label}<textarea name="${key}" rows="4">${escapeHTML(c[key].map(item=>config.fields.map(field=>item[field]).join(' | ')).join('\n'))}</textarea></label>`).join('')}<button class="button dark">Save website content</button></form><button class="button ghost" id="content-back">Back to dashboard</button></div>`);
  $('#content-back').onclick=owner;
  $('#content-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const input={};for(const key of [...fields.map(x=>x[0]),'contact_phone','contact_email','whatsapp','hero_image'])input[key]=f.elements.namedItem(key).value.trim();for(const [key,config]of Object.entries(lists))input[key]=f.elements.namedItem(key).value.split('\n').filter(line=>line.trim()).map(line=>Object.fromEntries(config.fields.map((field,i)=>[field,line.split('|')[i]?.trim()||''])));try{await loading(f.querySelector('button'),api('/api/owner/content',{method:'POST',body:JSON.stringify(input)}));await loadContent();renderBoats();toast('Website content saved');owner()}catch(err){toast(err.message)}};
}
