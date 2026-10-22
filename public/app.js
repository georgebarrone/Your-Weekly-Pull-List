const $ = id=>document.getElementById(id);
const state={overview:null,tab:'home',busy:false};
const h = value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const shortDate = value => {try{return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});}catch{return value;}};
let toastTimer;
function toast(message,isError=false){const t=$('toast');t.textContent=message;t.className=`toast${isError?' error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),5500);}
async function api(path,{method='GET',body}={}){
  const response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>({error:'Unexpected response'}));
  if(response.status===401 && path!=='/login'){showLogin();throw Error('Session expired. Enter your PIN again.');}
  if(!response.ok)throw Error(json.error||`Request failed (${response.status})`);
  return json;
}
function showLogin(){ $('login').classList.remove('hidden');$('app').classList.add('hidden');$('pin').focus();}
function showApp(){ $('login').classList.add('hidden');$('app').classList.remove('hidden');}
function setBusy(busy){state.busy=busy;document.querySelectorAll('button').forEach(button=>{if(button.id==='logout'||button.id==='closeModal')return;button.disabled=busy;});}
async function withBusy(job){if(state.busy)return;setBusy(true);try{await job();}catch(e){toast(e.message,true);}finally{setBusy(false);}}
function cover(coverUrl){const allowed = /^https:\/\//.test(coverUrl||'');return `<div class="cover-placeholder">${allowed?`<img loading="lazy" alt="Comic cover" src="${h(coverUrl)}">`:'✳'}</div>`;}
function empty(message,sub=''){return `<div class="empty"><strong>${h(message)}</strong>${h(sub)}</div>`;}
function seriesCard(s){const latest=s.latest;return `<article class="series-card"><div class="series-top">${cover(latest?.cover_url)}<div><div class="series-title">${h(s.title)}</div><div class="series-meta">${h(s.publisher||'COMIC SERIES')} · ${s.kind==='limited'?'LIMITED':'ONGOING'}</div></div></div><div class="series-bottom"><span class="current">${latest?`Latest listed: ${h(latest.issue_number)}`:'Awaiting catalog data'}</span><button class="text-button" data-remove="${h(s.id)}">REMOVE ×</button></div></article>`;}
function subscriptionRow(s){return `<div class="list-row"><div class="list-row-left"><strong>${h(s.title)}</strong><span>${h(s.kind)} · ${h(s.publisher||'Publisher unknown')} · ${s.latest?'Latest listed '+h(s.latest.issue_number):'No recent listing'}</span></div><div class="row-actions"><a href="${h(s.series_url)}" target="_blank" rel="noopener noreferrer">Series page ↗</a><button class="text-button" data-remove="${h(s.id)}">UNSUBSCRIBE ×</button></div></div>`;}
function issueRow(c,subscribed,delivered){return `<div class="list-row"><div class="list-row-left"><strong>${h(c.series_title)} <span style="color:#ad463e">${h(c.issue_number)}</span></strong><span>${h(c.publisher)} · ${h(shortDate(c.release_date))}${c.date_source?.startsWith('Manually')?' · Manually entered':''}</span></div><div class="row-actions">${delivered?'<span class="badge">DELIVERED</span>':subscribed?'<span class="badge new">ON YOUR LIST</span>':'<span class="badge">NOT SUBSCRIBED</span>'}<a href="${h(c.issue_url)}" target="_blank" rel="noopener noreferrer">View ↗</a>${!subscribed?`<button class="btn border" data-addurl="${h(c.series_url)}">+ Subscribe</button>`:''}${subscribed&&!delivered?`<button class="btn border" data-send="${h(c.id)}">Email now ↗</button>`:''}</div></div>`;}
function setOverview(data){state.overview=data;render();}
function render(){const data=state.overview;if(!data)return;
 const subs=data.subscriptions||[], catalog=data.catalog||[],history=data.history||[], up=data.upcoming||[],pending=data.pending||[];
 const subscribed=new Set(subs.map(s=>s.series_url)); const delivered=new Set(history.map(d=>d.issue_id));
 $('weekLabel').textContent=`THIS WEEK  /  ${shortDate(data.week.start).toUpperCase()} — ${shortDate(data.week.end).toUpperCase()}`;
 $('statSeries').textContent=subs.length;$('statWeekly').textContent=up.filter(c=>subscribed.has(c.series_url)).length;
 $('statPending').textContent=pending.length;$('statDelivered').textContent=history.length;
 $('seriesCount').textContent=`/ ${String(subs.length).padStart(2,'0')}`;
 $('homeSubs').innerHTML=subs.length?subs.slice(0,9).map(seriesCard).join(''):empty('Your shelf is looking a little empty.','Add your first comic to get started.');
 $('allSubs').innerHTML=subs.length?subs.map(subscriptionRow).join(''):empty('Nothing subscribed yet.','Tap Add series to start your collection.');
 $('manualSeries').innerHTML=`<option value="">Choose a subscribed series</option>${subs.map(s=>`<option value="${h(s.series_url)}">${h(s.title)}</option>`).join('')}`;
 const query=$('search').value.trim().toLowerCase();
 const filtered=up.filter(c=>c.series_title.toLowerCase().includes(query) || c.publisher.toLowerCase().includes(query));
 $('weeklyReleases').innerHTML=filtered.length?filtered.map(c=>issueRow(c,subscribed.has(c.series_url),delivered.has(c.id))).join(''):empty('No matching releases.','Try refreshing the catalog or changing your search.');
 $('historyList').innerHTML=history.length?history.map(x=>`<div class="list-row"><div class="list-row-left"><strong>${h(x.series_title||'Comic issue')} ${h(x.issue_number)}</strong><span>${h(x.release_date)} · Sent ${h(x.delivered_at)} · ${h(x.mode)}</span></div><span class="badge">✓ DELIVERED</span></div>`).join(''):empty('No deliveries yet.','Issues you receive by email will appear here.');
}
function showTab(tab){state.tab=tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));
 $(tab==='home'?'homePanel':tab==='collection'?'collectionPanel':tab==='releases'?'releasesPanel':'historyPanel').classList.remove('hidden');
 $('currentSection').textContent={home:'OVERVIEW',collection:'MY PULL LIST',releases:'THIS WEEK',history:'HISTORY'}[tab];
 document.querySelector('.hero').classList.toggle('hidden',tab!=='home');document.querySelector('.status-line').classList.toggle('hidden',tab!=='home');document.querySelector('.stats-grid').classList.toggle('hidden',tab!=='home');
 window.scrollTo({top:0,behavior:'smooth'});
}
function openModal(url=''){$('seriesUrl').value=url;$('modal').classList.remove('hidden');$('seriesUrl').focus();}
function closeModal(){$('modal').classList.add('hidden');}
async function reload() {setOverview(await api('/overview'));}
async function refresh(){const data=await api('/catalog/refresh',{method:'POST'});setOverview(data.overview);$('syncLine').textContent=`Checked ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} · ${data.imported} listed issues`;toast(`Catalog refreshed · ${data.imported} issue listings found`);}
async function subscribe(url){const data=await api('/subscriptions',{method:'POST',body:{url}});setOverview(data.overview);closeModal();toast(`Added ${data.subscription.title}. Latest issue: ${data.immediate==='emailed'?'emailed successfully':data.immediate.replace('no-latest-issue-in-catalog','not found in the current catalog')}`);}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';await withBusy(async()=>{try{await api('/login',{method:'POST',body:{pin:$('pin').value}});$('pin').value='';showApp();await reload();}catch(error){$('loginError').textContent=error.message;}});});
$('logout').addEventListener('click',()=>withBusy(async()=>{await api('/logout',{method:'POST'});showLogin();}));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
['addHero','addSection','addCollection'].forEach(id=>$(id).addEventListener('click',()=>openModal()));
['refreshHero','refreshReleases'].forEach(id=>$(id).addEventListener('click',()=>withBusy(refresh)));
$('closeModal').addEventListener('click',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('addForm').addEventListener('submit',e=>{e.preventDefault();withBusy(()=>subscribe($('seriesUrl').value.trim()));});
$('search').addEventListener('input',render);
$('manualIssueForm').addEventListener('submit',e=>{e.preventDefault();withBusy(async()=>{const data=await api('/issues/manual',{method:'POST',body:{seriesUrl:$('manualSeries').value,issueNumber:$('manualNumber').value.trim(),releaseDate:$('manualDate').value,issueUrl:$('manualUrl').value.trim(),sendNow:$('manualSend').checked}});setOverview(data.overview);$('manualIssueForm').reset();toast('Issue added · '+data.delivery);});});
document.body.addEventListener('click',e=>{const remove=e.target.closest('[data-remove]'),add=e.target.closest('[data-addurl]'),send=e.target.closest('[data-send]');
 if(remove){if(!confirm('Unsubscribe from this series? Delivery history will be kept.'))return;withBusy(async()=>{const data=await api(`/subscriptions/${encodeURIComponent(remove.dataset.remove)}`,{method:'DELETE'});setOverview(data.overview);toast('Series unsubscribed.');});}
 if(add)withBusy(()=>subscribe(add.dataset.addurl));
 if(send)withBusy(async()=>{const data=await api(`/issues/${encodeURIComponent(send.dataset.send)}/send`,{method:'POST'});setOverview(data.overview);toast('Issue email sent.');});
});
(async()=>{try{const status=await api('/auth');if(status.authenticated){showApp();await reload();}else showLogin();}catch(e){showLogin();toast(e.message,true);}})();
