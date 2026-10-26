const $ = id=>document.getElementById(id);
const state={overview:null,tab:'home',busy:false,searchResults:[],selectedSuggestion:-1,searchRequest:0,releaseResults:[],releaseSelected:-1,releaseRequest:0};
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
function issueRow(c,subscribed,delivered){return `<div class="list-row"><div class="list-row-left"><strong>${h(c.series_title)} <span style="color:#ad463e">${h(c.issue_number)}</span></strong><span>${h(c.publisher)} · ${h(shortDate(c.release_date))}${c.date_source?.startsWith('Manually')?' · Manually entered':''}</span></div><div class="row-actions">${delivered?'<span class="badge">DELIVERED</span>':subscribed?'<span class="badge new">ON YOUR LIST</span>':'<span class="badge">NOT SUBSCRIBED</span>'}<a href="${h(c.issue_url)}" target="_blank" rel="noopener noreferrer">View ↗</a>${!subscribed?`<button class="btn border" data-addurl="${h(c.series_url)}">+ Subscribe</button>`:''}${subscribed&&!delivered?`<button class="btn border" data-send="${h(c.id)}">SEND EMAIL ↗</button><button class="btn border" data-pdf="${h(c.id)}">${c.authorized_pdf_url?'PDF LINK ✓':'SET PDF ↥'}</button>`:''}</div></div>`;}
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
 const filtered=(query?catalog:up).filter(c=>c.series_title.toLowerCase().includes(query) || (c.publisher||'').toLowerCase().includes(query));
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
function openModal(url=''){
  $('modal').classList.remove('hidden');
  $('seriesUrl').value=url;
  if(url){$('manualFallback').classList.remove('hidden');$('toggleManual').setAttribute('aria-expanded','true');$('seriesUrl').focus();}
  else {$('seriesSearch').value='';state.searchResults=[];state.selectedSuggestion=-1;hideSuggestions();$('searchStatus').textContent='Enter at least 2 characters to search.';$('seriesSearch').focus();}
}
function closeModal(){
  $('modal').classList.add('hidden');
  state.searchRequest++;
  clearTimeout(searchTimer);
  hideSuggestions();
}
function hideSuggestions(){
  $('seriesSuggestions').classList.add('hidden');
  $('seriesSearch').setAttribute('aria-expanded','false');
}
function renderSuggestions(){
  const box=$('seriesSuggestions');
  if(!state.searchResults.length){hideSuggestions();return;}
  box.innerHTML=state.searchResults.map((item,i)=>`<button type="button" class="suggestion${state.selectedSuggestion===i?' active':''}" role="option" aria-selected="${state.selectedSuggestion===i}" data-suggest="${i}"><strong>${h(item.title)}</strong><span>${h(item.publisher||'SELECT ↵')}</span></button>`).join('');
  box.classList.remove('hidden');
  $('seriesSearch').setAttribute('aria-expanded','true');
}
let searchTimer;
async function searchTitles(){
  const query=$('seriesSearch').value.trim();
  const token=++state.searchRequest;
  if(query.length<2){state.searchResults=[];hideSuggestions();$('searchStatus').textContent='Enter at least 2 characters to search.';return;}
  $('searchStatus').textContent='SEARCHING INDEX...';
  try{
    const data=await api('/series/search?q='+encodeURIComponent(query));
    if(token!==state.searchRequest)return;
    state.searchResults=data.results||[];
    state.selectedSuggestion=-1;
    renderSuggestions();
    $('searchStatus').textContent=state.searchResults.length?`${state.searchResults.length} RESULT(S) — SELECT A TITLE OR USE ↑ ↓ ENTER`:'No match in the available index. You can still use a direct series URL.';
  }catch(err){
    if(token!==state.searchRequest)return;
    state.searchResults=[];hideSuggestions();$('searchStatus').textContent=err.message;
  }
}
function chooseSuggestion(index){
  const item=state.searchResults[index];
  if(!item)return;
  $('seriesSearch').value=item.title;
  hideSuggestions();
  withBusy(()=>subscribe(item.url));
}
async function reload() {setOverview(await api('/overview'));}
async function refresh(){const data=await api('/catalog/refresh',{method:'POST'});setOverview(data.overview);$('syncLine').textContent=`Checked ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})} · ${data.imported} listed issues`;toast(`Catalog refreshed · ${data.imported} issue listings found`);}
async function subscribe(url){const data=await api('/subscriptions',{method:'POST',body:{url}});setOverview(data.overview);closeModal();toast(`Added ${data.subscription.title}. Latest issue: ${data.immediate==='emailed'?'emailed successfully':data.immediate.replace('no-latest-issue-in-catalog','not found in the current catalog')}`);}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginError').textContent='';await withBusy(async()=>{try{await api('/login',{method:'POST',body:{pin:$('pin').value}});$('pin').value='';showApp();await reload();}catch(error){$('loginError').textContent=error.message;}});});
$('logout').addEventListener('click',()=>withBusy(async()=>{await api('/logout',{method:'POST'});showLogin();}));
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
['addHero','addSection','addCollection'].forEach(id=>$(id).addEventListener('click',()=>openModal()));
['refreshHero','refreshReleases'].forEach(id=>$(id).addEventListener('click',()=>withBusy(refresh)));
$('toggleManual').addEventListener('click',()=>{
  const show=$('manualFallback').classList.contains('hidden');
  $('manualFallback').classList.toggle('hidden',!show);
  $('toggleManual').setAttribute('aria-expanded',String(show));
  $('toggleManual').textContent=show?'[-] HIDE DIRECT URL':'[+] USE A DIRECT SERIES URL INSTEAD';
  if(show)$('seriesUrl').focus();
});
$('seriesSearch').addEventListener('input',()=>{
  clearTimeout(searchTimer);
  const q=$('seriesSearch').value.trim();
  state.searchRequest++;
  state.searchResults=[];state.selectedSuggestion=-1;hideSuggestions();
  if(q.length<2){state.searchResults=[];hideSuggestions();$('searchStatus').textContent='Enter at least 2 characters to search.';return;}
  $('searchStatus').textContent='SEARCHING INDEX...';
  searchTimer=setTimeout(searchTitles,270);
});
$('seriesSearch').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    if(!state.searchResults.length)return;
    e.preventDefault();
    const delta=e.key==='ArrowDown'?1:-1;
    state.selectedSuggestion=(state.selectedSuggestion+delta+state.searchResults.length)%state.searchResults.length;
    renderSuggestions();
  }
  if(e.key==='Escape')hideSuggestions();
});
$('seriesSearchForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(state.selectedSuggestion>=0)chooseSuggestion(state.selectedSuggestion);
  else if(state.searchResults.length===1)chooseSuggestion(0);
  else if(state.searchResults.length>1){state.selectedSuggestion=0;renderSuggestions();$('searchStatus').textContent='Choose a title with ↑ ↓ then press Enter.';}
  else searchTitles();
});
$('seriesSuggestions').addEventListener('click',e=>{
  const suggestion=e.target.closest('[data-suggest]');
  if(suggestion)chooseSuggestion(Number(suggestion.dataset.suggest));
});
$('closeModal').addEventListener('click',closeModal);
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
$('addForm').addEventListener('submit',e=>{e.preventDefault();withBusy(()=>subscribe($('seriesUrl').value.trim()));});
let releaseTimer;
function drawReleaseSuggestions(){
  const box=$('releaseSuggestions');
  if(!state.releaseResults.length){box.classList.add('hidden');$('search').setAttribute('aria-expanded','false');return;}
  box.innerHTML=state.releaseResults.map((item,i)=>`<button type="button" class="suggestion${state.releaseSelected===i?' active':''}" role="option" aria-selected="${state.releaseSelected===i}" data-release-suggest="${i}"><strong>${h(item.title)}</strong><span>+ SUBSCRIBE ↵</span></button>`).join('');
  box.classList.remove('hidden');$('search').setAttribute('aria-expanded','true');
}
async function findReleaseTitles(){
  const query=$('search').value.trim();
  const token=++state.releaseRequest;
  if(query.length<2){state.releaseResults=[];drawReleaseSuggestions();return;}
  $('releaseSearchStatus').textContent='SEARCHING...';
  try{
    const data=await api('/series/search?q='+encodeURIComponent(query));
    if(token!==state.releaseRequest)return;
    state.releaseResults=data.results||[];
    state.releaseSelected=-1;
    drawReleaseSuggestions();
    $('releaseSearchStatus').textContent=state.releaseResults.length?`${state.releaseResults.length} MATCHES IN SERIES INDEX`:'No series match in the current index.';
  }catch(e){if(token!==state.releaseRequest)return;state.releaseResults=[];drawReleaseSuggestions();$('releaseSearchStatus').textContent=e.message;}
}
function chooseRelease(index){
  const item=state.releaseResults[index];if(!item)return;
  state.releaseResults=[];drawReleaseSuggestions();
  $('search').value='';$('releaseSearchStatus').textContent='';
  withBusy(()=>subscribe(item.url));
}
$('search').addEventListener('input',()=>{
  render();clearTimeout(releaseTimer);state.releaseRequest++;
  state.releaseResults=[];state.releaseSelected=-1;drawReleaseSuggestions();
  if($('search').value.trim().length<2){state.releaseResults=[];drawReleaseSuggestions();$('releaseSearchStatus').textContent='';return;}
  releaseTimer=setTimeout(findReleaseTitles,270);
});
$('search').addEventListener('keydown',e=>{
  if(['ArrowDown','ArrowUp'].includes(e.key)&&state.releaseResults.length){
    e.preventDefault();state.releaseSelected=(state.releaseSelected+(e.key==='ArrowDown'?1:-1)+state.releaseResults.length)%state.releaseResults.length;drawReleaseSuggestions();
  }else if(e.key==='Enter'){
    e.preventDefault();
    if(state.releaseSelected>=0)chooseRelease(state.releaseSelected);
    else if(state.releaseResults.length===1)chooseRelease(0);
    else if(!state.releaseResults.length)findReleaseTitles();
    else {state.releaseSelected=0;drawReleaseSuggestions();}
  }else if(e.key==='Escape'){state.releaseResults=[];drawReleaseSuggestions();}
});
$('releaseSuggestions').addEventListener('click',e=>{
  const item=e.target.closest('[data-release-suggest]');if(item)chooseRelease(Number(item.dataset.releaseSuggest));
});
$('manualIssueForm').addEventListener('submit',e=>{e.preventDefault();withBusy(async()=>{const data=await api('/issues/manual',{method:'POST',body:{seriesUrl:$('manualSeries').value,issueNumber:$('manualNumber').value.trim(),releaseDate:$('manualDate').value,issueUrl:$('manualUrl').value.trim(),sendNow:$('manualSend').checked}});setOverview(data.overview);$('manualIssueForm').reset();toast('Issue added · '+data.delivery);});});
document.body.addEventListener('click',e=>{const remove=e.target.closest('[data-remove]'),add=e.target.closest('[data-addurl]'),send=e.target.closest('[data-send]'),pdf=e.target.closest('[data-pdf]');
 if(remove){if(!confirm('Unsubscribe from this series? Delivery history will be kept.'))return;withBusy(async()=>{const data=await api(`/subscriptions/${encodeURIComponent(remove.dataset.remove)}`,{method:'DELETE'});setOverview(data.overview);toast('Series unsubscribed.');});}
 if(add)withBusy(()=>subscribe(add.dataset.addurl));
 if(send)withBusy(async()=>{const data=await api(`/issues/${encodeURIComponent(send.dataset.send)}/send`,{method:'POST'});setOverview(data.overview);toast('Issue email sent. A PDF is attached only if an approved source is configured.');});
 if(pdf){
   const value=prompt('Enter a HTTPS PDF URL from a host you are authorized to distribute from (must be in AUTHORIZED_PDF_HOSTS). Leave blank to clear:');
   if(value===null)return;
   withBusy(async()=>{
     const data=await api(`/issues/${encodeURIComponent(pdf.dataset.pdf)}/authorized-pdf`,{method:'POST',body:{url:value.trim()||null}});
     setOverview(data.overview);
     toast(value.trim()?'Approved PDF link saved.':'PDF link cleared.');
   });
 }
});
(async()=>{try{const status=await api('/auth');if(status.authenticated){showApp();await reload();}else showLogin();}catch(e){showLogin();toast(e.message,true);}})();
