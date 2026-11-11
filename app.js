const SUNDAY_TASK={day:"日",name:"回憶收集",text:"寫下這週最開心、最難忘的瞬間。",xp:10};
const TITLES=[[50,"🐣 戀愛新手村"],[100,"🧸 黏踢踢小情侶"],[200,"🤡 專業互鬧選手"],[300,"💗 甜蜜製造機"],[500,"🍀 穩定升溫中"],[800,"🍜 吃貨雙人組"],[1200,"🧠 心電感應學徒"],[1800,"🎢 雙人副本老手"],[2500,"🌈 放閃職人"],[3500,"🔥 傳說級黏人精"],[5000,"🛡️ 永久組隊隊長"],[6500,"🌌 宇宙級閃光彈"],[8000,"👑 戀愛滿等玩家"]];
const QUESTIONS=["你覺得我最欠揍但又最可愛的地方是什麼？","如果我變成一隻蟑螂，你還會愛我嗎？","如果我們一起被困在荒島，你覺得誰會先崩潰？","最近哪一個瞬間讓你突然很想我？","第一次見到我的時候，你心裡在想什麼？","我做過最讓你傻眼的一件事是什麼？","用三個詞形容我們這段關係。","如果明天放假一整天，你想跟我做什麼？","你覺得我們誰比較會吃醋？","我最常對你說的一句話是什麼？","如果要幫我們拍一部電影，片名叫什麼？","你偷偷覺得我哪一個習慣很好笑？","我們吵架之後，你最希望我怎麼哄你？","你最想跟我一起完成的一件事是什麼？","如果可以交換身份一天，你最想用我的身份做什麼？","你覺得我們十年後會在幹嘛？","我哪一個表情你最受不了（但其實很喜歡）？","你最想吃我煮的哪一道菜？","我們之間最好笑的一個暗號或梗是什麼？","哪一首歌會讓你想到我？","如果我們養一隻寵物，要叫什麼名字？","我最近做了什麼讓你覺得被照顧到？","你覺得我們的戀愛像哪一種遊戲？","你今天最想對我撒嬌的一句話是？","如果只能用一個 emoji 代表我，你會選哪個？","我們第一次約會，你最記得哪個畫面？","你覺得我身上最像小孩的地方是什麼？","如果我們一起去旅行，誰負責迷路？"];

const LOVE_START=new Date(2026,10,4);
const DIARY_XP=10, PHOTO_BONUS=10, STREAK_BONUS=10, STREAK_STEP=7;
const NOSAVE="沒存到，請再試一次";

const $=id=>document.getElementById(id);
let done={};      // dateKey -> {dow,xp}
let entries=[];   // diary docs
// 新功能的資料存在 done/x~集合~id，沿用現有的 Firebase 規則，不用另外開權限
const store={birthdays:[],wishes:[],rounds:[],answers:[],capsules:[],custom:[],fixes:[],hugs:[],replies:[],backups:[],bonus:[],reviews:[],wrote:[]};
// 刪除時在原本的資料上標記 trashed，30 天後才真的清掉
const trash={diary:[],photos:[],wishes:[],capsules:[],custom:[]};
let db=null, local=false;
const LS="love-base-v1";

function pad(n){return String(n).padStart(2,"0")}
function key(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function today(){const d=new Date();d.setHours(0,0,0,0);return d}
function dow(d){return (d.getDay()+6)%7} // Mon=0
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2200)}

function dayOf(iso){const d=new Date(iso);return isNaN(d)?"":key(d)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function fromKey(k){const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)}
const byAt=(a,b)=>String(a.at).localeCompare(String(b.at));
const nameOf=n=>n?n+(n===myName()?"（我）":""):"未署名";
const nowIso=()=>new Date().toISOString();
// 離線時寫入會先排隊、連上才完成，不等它，畫面才不會卡住
const commit=p=>{if(navigator.onLine)return p;p.catch(()=>{});return Promise.resolve()};
const xRef=(c,id)=>db.collection("done").doc(`x~${c}~${id}`);

async function addDoc(c,data){
  const id=db?db.collection("done").doc().id:"l"+Date.now()+Math.random().toString(36).slice(2,6);
  if(db)await commit(xRef(c,id).set(data));
  if(!store[c].find(x=>x.id===id))store[c].push({id,...data});
  if(!db)saveLocal();
  renderAll();
}
async function updDoc(c,id,data){
  const w=store[c].find(x=>x.id===id);if(!w)return;
  const old={...w};Object.assign(w,data);renderAll();
  try{db?await xRef(c,id).update(data):saveLocal()}catch(e){Object.assign(w,old);renderAll();toast(NOSAVE)}
}
const TRASH_DAYS=30, TRASHED="移到垃圾桶了，30 天內可以復原";
const trashMark=()=>({at:nowIso(),by:myName()});
async function delDoc(c,id){
  const item=store[c].find(x=>x.id===id);if(!item)return;
  const mark=trashMark();
  store[c]=store[c].filter(x=>x.id!==id);trash[c].push({...item,trashed:mark});renderAll();
  try{db?await xRef(c,id).update({trashed:mark}):saveLocal();toast(TRASHED)}
  catch(e){store[c].push(item);trash[c]=trash[c].filter(x=>x.id!==id);renderAll();toast("刪除失敗")}
}
function armDelete(box,c){box.querySelectorAll(".del").forEach(b=>{b.onclick=()=>{
  if(b.dataset.confirm){delDoc(c,b.dataset.id)}else{b.dataset.confirm=1;b.textContent="再按一次";setTimeout(()=>{if(b.isConnected){delete b.dataset.confirm;b.textContent="刪除"}},3000)}}})}


// 兩個人當天都有寫日記或傳照片才算連續，或用補簽卡補上的日子
function onTimeDays(){return [...dayRecords()].filter(([,r])=>r.onTime.size>=need()).map(([d])=>d)}
function activeDays(){return new Set([...onTimeDays(),...store.fixes.map(f=>f.day)])}
function streakBonus(){
  let bonus=0,run=0,prev=null;
  for(const d of [...activeDays()].map(fromKey).sort((a,b)=>a-b)){
    run=prev&&key(addDays(prev,1))===key(d)?run+1:1;
    if(run%STREAK_STEP===0)bonus+=STREAK_BONUS;
    prev=d;
  }
  return bonus;
}
function renderStreak(){
  const a=activeDays(),t=today();
  let c=a.has(key(t))?t:addDays(t,-1),n=0;
  while(a.has(key(c))){n++;c=addDays(c,-1)}
  const cards=Math.floor(onTimeDays().length/STREAK_STEP)-store.fixes.length;
  // 一張卡補一天：手上的卡夠補滿整段空缺才能補
  const gap=[];let d=c;
  while(cards>0&&gap.length<cards&&!a.has(key(d))){gap.push(d);d=addDays(d,-1)}
  const repair=gap.length>0&&a.has(key(d)),md=x=>`${x.getMonth()+1}/${x.getDate()}`;
  $("streak").innerHTML=`<span>🔥 連續<span class="num">${n}</span>天</span><span class="muted">再 ${STREAK_STEP-n%STREAK_STEP} 天 +${STREAK_BONUS} XP</span><span>🎫 補簽卡 ${Math.max(0,cards)} 張</span>${repair?`<button class="btn" type="button" id="fixBtn">補上 ${gap.length>1?`${md(gap[gap.length-1])}～${md(gap[0])}（用 ${gap.length} 張）`:md(c)}</button>`:""}`;
  if(repair)$("fixBtn").onclick=async()=>{try{for(const x of gap)await addDoc("fixes",{day:key(x),at:nowIso(),by:myName()});toast("補簽成功 🎫")}catch(e){toast(NOSAVE)}};
}

// 所有 XP 都要兩個人一起達成：日期 -> 誰寫了日記、誰傳了照片、誰當天就完成
function dayRecords(){
  const m=new Map(),get=d=>{if(!m.has(d))m.set(d,{diary:new Set,photo:new Set,onTime:new Set});return m.get(d)};
  entries.forEach(e=>{if(!e.by)return;const r=get(e.date);r.diary.add(e.by);if(dayOf(e.at)===e.date)r.onTime.add(e.by)});
  store.wrote.forEach(w=>{if(!w.by)return;const r=get(w.date);r.diary.add(w.by);if(dayOf(w.at)===w.date)r.onTime.add(w.by)});
  store.bonus.forEach(b=>{if(!b.by)return;const r=get(b.date);r.photo.add(b.by);if(dayOf(b.at)===b.date)r.onTime.add(b.by)});
  return m;
}
const whoDid=r=>new Set([...r.diary,...r.photo]);
function togetherDays(){return [...dayRecords()].filter(([,r])=>whoDid(r).size>=need()).map(([d])=>d)}
function totalXP(){
  let xp=0;
  for(const [d,r] of dayRecords()){
    if(r.diary.size>=need())xp+=DIARY_XP;
    if(r.photo.size>=need())xp+=PHOTO_BONUS;
  }
  const reviews=new Map();
  store.reviews.forEach(r=>{if(!r.by)return;if(!reviews.has(r.date))reviews.set(r.date,new Set);reviews.get(r.date).add(r.by)});
  for(const who of reviews.values())if(who.size>=need())xp+=SUNDAY_TASK.xp;
  return xp+streakBonus();
}

function nextAnniv(){const t=today(),m=LOVE_START.getMonth(),d=LOVE_START.getDate();let n=new Date(t.getFullYear(),m,d);if(n<=t)n=new Date(t.getFullYear()+1,m,d);return n}
// 生日倒數：存在 done 的 x~birthdays~名字，只記月和日
function bdayOf(n){return store.birthdays.find(b=>b.id===n)}
function renderBdays(){
  const t=today();
  $("bdays").innerHTML=NAMES.map(n=>{const b=bdayOf(n);if(!b||!b.m||!b.d)return "";
    let nx=new Date(t.getFullYear(),b.m-1,b.d);if(nx<t)nx=new Date(t.getFullYear()+1,b.m-1,b.d);
    const left=Math.round((nx-t)/864e5),who=n===myName()?"我":n;
    return `<span>${left===0?`🎂 今天是${who}的生日！`:`🎂 ${who}的生日還有 ${left} 天`}</span>`}).join("");
  const f=$("bdayForm");if(f.contains(document.activeElement))return;
  f.innerHTML=NAMES.map(n=>{const b=bdayOf(n)||{};
    return `<div class="bday-row"><b>${esc(n)}</b><select data-bm="${esc(n)}" aria-label="${esc(n)}的生日月份"><option value="">月</option>${[...Array(12)].map((_,i)=>`<option value="${i+1}" ${b.m===i+1?"selected":""}>${i+1} 月</option>`).join("")}</select><select data-bd="${esc(n)}" aria-label="${esc(n)}的生日日期"><option value="">日</option>${[...Array(31)].map((_,i)=>`<option value="${i+1}" ${b.d===i+1?"selected":""}>${i+1} 日</option>`).join("")}</select></div>`}).join("");
  f.querySelectorAll("select").forEach(sel=>sel.onchange=()=>saveBday(sel.dataset.bm||sel.dataset.bd));
}
async function saveBday(n){
  const m=Number(document.querySelector(`[data-bm="${n}"]`).value),d=Number(document.querySelector(`[data-bd="${n}"]`).value);
  if(!m||!d)return;
  if(new Date(2024,m-1,d).getMonth()!==m-1){toast(`${m} 月沒有 ${d} 日`);return}
  const doc={m,d,by:myName(),at:nowIso()};
  store.birthdays=store.birthdays.filter(b=>b.id!==n).concat([{id:n,...doc}]);
  try{if(db)await commit(xRef("birthdays",n).set(doc));else saveLocal();toast(`${n}的生日記好了 🎂`)}catch(e){toast(NOSAVE)}
  document.activeElement&&document.activeElement.blur();renderBdays();
}
function renderAnniv(){
  const t=today(),left=Math.round((nextAnniv()-t)/864e5),n=Math.round((t-LOVE_START)/864e5)+1;
  const isDay=t>LOVE_START&&t.getMonth()===LOVE_START.getMonth()&&t.getDate()===LOVE_START.getDate();
  $("anniv").innerHTML=(isDay?`🎉 今天是我們的 ${t.getFullYear()-LOVE_START.getFullYear()} 週年！`:`💝 在一起第<span class="num">${n}</span>天`)+`<span class="left">距離 ${LOVE_START.getMonth()+1}/${LOVE_START.getDate()} 週年還有 ${left} 天</span>`;
}

function renderHUD(){
  renderAnniv();renderBdays();
  const xp=totalXP(); $("xp").textContent=xp;
  let cur=null,next=TITLES[0],prev=0;
  for(const t of TITLES){if(xp>=t[0]){cur=t;prev=t[0]}else{next=t;break}}
  if(cur&&cur===TITLES[TITLES.length-1])next=null;
  $("curTitle").textContent=cur?cur[1]:"尚未解鎖";
  if(next){$("nextText").textContent=`再 ${next[0]-xp} XP 解鎖「${next[1]}」`;$("barFill").style.width=Math.max(3,(xp-prev)/(next[0]-prev)*100)+"%"}
  else{$("nextText").textContent="已經滿等了，繼續累積回憶吧！";$("barFill").style.width="100%"}
  const shownTitle=cur||TITLES[0];
  const rung=([n,name],st)=>`<div class="rung ${xp>=n?"on":""}"><span class="need num">${n} XP</span><span class="name">${name}</span><span class="st">${st||(xp>=n?"已解鎖":"未解鎖")}</span></div>`;
  $("ladderList").innerHTML=rung(shownTitle,cur?"最近達成":"下一個");
  $("ladderRest").innerHTML=TITLES.filter(t=>t!==shownTitle).map(t=>rung(t)).join("");
  $("ladderN").textContent=`${TITLES.length-1} 個`;
}

function renderQuests(){
  const t=today(), tk=key(t), ti=dow(t), task=SUNDAY_TASK, revs=store.reviews.filter(r=>r.date===tk).sort(byAt), myRev=revs.find(r=>r.by===myName()), both=new Set(revs.map(r=>r.by)).size>=need();
  $("todayBox").hidden=ti!==6;
  if(ti===6)renderWeekRecap(t);
  $("todayCard").innerHTML=`<div class="tag">今天 · 星期${task.day}</div><h3>${esc(task.name)} <span class="xpchip num" style="font-size:16px">+${task.xp} XP</span></h3><p>${esc(task.text)}</p>
  <div class="done-line">${both?"✓ 兩個人都寫好了":myRev?"你寫好了，等對方":`兩個人都寫好 +${task.xp} XP`}</div>`;
  $("reviewList").innerHTML=revs.map(r=>`<div><b>${esc(nameOf(r.by))}</b>${esc(r.text)}${r.by===myName()?' <button type="button" class="reply-del" id="reviewEdit">修改</button>':""}</div>`).join("");
  $("reviewForm").hidden=!!myRev&&!reviewEditing;
  if(myRev)$("reviewEdit").onclick=()=>{reviewEditing=true;$("reviewText").value=myRev.text;$("reviewForm").hidden=false;$("reviewText").focus()};
  renderTodayPhotos();
}

/* ===== 生活紀錄照片 =====
   photos/{日期_名字}：縮圖 th + 說明（列表用，檔案小）
   pics/{日期_名字}：原圖 img（點開才載入） */
let photos=[], photoLimit=30, photoUnsub=null, photoErr="", uploading=null, pendingDate=null, pendingSwap=false;
function photosOn(d){return photos.filter(p=>p.date===d&&!p.entry)}
const DAY_PH_MAX=9;
function myPhotos(d){const main=d+"_"+myName();return photos.filter(p=>p.date===d&&p.by===myName()&&!p.entry).sort((a,b)=>(b.id===main)-(a.id===main)||String(a.at).localeCompare(String(b.at)))}
function myPhoto(d){return myPhotos(d)[0]}
function photoBtn(p,cls){return `<button type="button" class="${cls}" data-open="${esc(p.id)}" aria-label="${esc(p.by)} 的照片"><img src="${p.th}" alt="" loading="lazy"><span class="nm">${esc(p.by)}${p.by===myName()?"（我）":""}</span></button>`}
function renderTodayPhotos(){
  const t=today(), k=key(t), box=$("todayPhotos");
  $("photoCap").hidden=!db||!!photoErr||!myPhoto(k)||!capEditing;
  if(!db){box.innerHTML='<div class="ph-note">📸 要連上伺服器才能上傳照片。</div>';return}
  if(photoErr==="rules"){box.innerHTML='<div class="ph-note">📸 照片功能還沒開通：要先到 Firebase 更新一次「規則」。</div>';return}
  const mine=myPhoto(k), others=photosOn(k).filter(p=>p.by!==myName()), up=uploading===k;
  let h='<div class="ph-pair">';
  const mineAll=myPhotos(k);
  h+=mine?mineAll.map(p=>photoBtn(p,"ph-slot has")).join("")+(mineAll.length<DAY_PH_MAX?`<button type="button" class="ph-slot" data-up="${k}" ${up?"disabled":""}>${up?"上傳中…":"＋<br>再加照片"}</button>`:""):`<button type="button" class="ph-slot" data-up="${k}" ${up?"disabled":""}>${up?"上傳中…":"📸<br>上傳我的照片<br><small>可以一次選很多張</small>"}</button>`;
  h+=others.length?others.map(p=>photoBtn(p,"ph-slot has")).join(""):'<div class="ph-slot wait">等對方上傳…</div>';
  h+='</div>';
  if(mine)h+=`<div class="row"><button class="btn ghost" type="button" data-up="${k}" data-swap="1" ${up?"disabled":""}>${up?"上傳中…":mineAll.length>1?"換第一張":"換一張"}</button><button class="btn ghost small" type="button" id="capEdit">✏️ ${mine.cap?"改這句話":"寫一句話"}</button>${mine.cap?`<span class="ph-note">「${esc(mine.cap)}」</span>`:""}</div>`;
  box.innerHTML=h;
  if(mine)$("capEdit").onclick=()=>{capEditing=true;const c=$("photoCap");c.value=mine.cap||"";c.hidden=false;c.focus()};
}
function renderWall(){
  const w=$("wall");
  if(!db){w.innerHTML='<div class="empty">要連上伺服器才看得到照片。</div>';$("wallMore").hidden=true;return}
  if(photoErr==="rules"){w.innerHTML='<div class="empty">照片功能還沒開通：要先到 Firebase 更新一次「規則」。</div>';$("wallMore").hidden=true;return}
  if(!photos.length){w.innerHTML='<div class="empty">還沒有照片。在上面的每日任務上傳第一張吧！</div>';$("wallMore").hidden=true;return}
  const days=[...new Set(photos.map(p=>p.date))].sort().reverse();
  const wk="日一二三四五六";
  w.innerHTML=days.map(d=>{const [y,m,dd]=d.split("-").map(Number);const dt=new Date(y,m-1,dd);
    return `<div class="wall-day"><h3>${m}/${dd}（${wk[dt.getDay()]}）</h3><div class="wall-grid">${photos.filter(p=>p.date===d).map(p=>photoBtn(p,"")).join("")}</div></div>`}).join("");
  $("wallMore").hidden=photos.length<photoLimit;
}
function renderPhotosAll(){renderQuests();renderToday();renderDiaryToday();renderOpen()}

function loadImg(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>res({im,url});im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("decode"))};im.src=url})}
function shrink(im,side,maxLen,q){
  let out="";
  for(let n=0;n<10;n++){
    const s=Math.min(1,side/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(1,Math.round(im.naturalWidth*s)),h=Math.max(1,Math.round(im.naturalHeight*s));
    const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);
    out=c.toDataURL("image/jpeg",q);if(out.length<=maxLen)return out;
    if(q>.55)q-=.1;else side*=.8;
  }
  return out;
}
$("wallMore").onclick=()=>{photoLimit+=30;subPhotos()};
document.addEventListener("click",ev=>{
  const u=ev.target.closest("[data-up]");
  if(u&&!u.disabled){if(!db||photoErr||uploading)return;pendingDate=u.dataset.up;pendingSwap=!!u.dataset.swap;$("photoFile").multiple=!pendingSwap;$("photoFile").value="";$("photoFile").click();return}
  const o=ev.target.closest("[data-open]");
  if(o){const box=o.closest("#wall")||o.closest(".wall-grid,.ph-pair,.thumbs")||o.parentElement;openPhoto(o.dataset.open,[...box.querySelectorAll("[data-open]")].map(x=>x.dataset.open))}
});
$("photoFile").addEventListener("change",async()=>{
  const date=pendingDate;let files=pickFiles($("photoFile").files||[],99);if(!files.length||!date)return;
  if(!navigator.onLine){toast("沒有網路，連上後再上傳照片");return}
  if(!myName()){toast("請先登出再選你是誰");return}
  const mainId=date+"_"+myName(),hasMain=myPhotos(date).some(p=>p.id===mainId);
  if(pendingSwap)files=files.slice(0,1);
  else{const room=DAY_PH_MAX-myPhotos(date).length;if(files.length>room){files=files.slice(0,Math.max(0,room));toast(`一天最多 ${DAY_PH_MAX} 張，只放前 ${files.length} 張`)}}
  if(!files.length)return;
  uploading=date;renderPhotosAll();
  let ok=0,msg="";
  for(let i=0;i<files.length;i++){
    try{
      const {im,url}=await loadImg(files[i]);
      const img=shrinkFull(im), th=shrinkThumb(im);URL.revokeObjectURL(url);
      // 第一張用固定的 id（日期_名字），其他張加亂數
      const asMain=pendingSwap||(!hasMain&&i===0);
      const id=asMain?mainId:`${mainId}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
      const meta={date,by:myName(),th,cap:"",at:new Date().toISOString()};
      if(asMain)await archivePhoto(id); // 換一張：舊的先搬進垃圾桶，不直接蓋掉
      await db.collection("pics").doc(id).set({img,date,by:myName()});
      await db.collection("photos").doc(id).set(meta);
      photos=photos.filter(p=>p.id!==id).concat([{id,...meta}]);ok++;
      if(files.length>1)renderPhotosAll();
    }catch(e){
      msg=e&&e.code==="permission-denied"?"照片功能還沒開通，要先更新 Firebase 規則":e&&e.message==="decode"?"有照片讀不到，換一張試試":"有照片上傳失敗，請再試一次";
    }
  }
  uploading=null;
  if(ok){
    const earned=!store.bonus.some(b=>b.id===mainId),partner=store.bonus.some(b=>b.date===date&&b.by!==myName());
    if(earned){
      const doc={date,xp:PHOTO_BONUS,by:myName(),at:new Date().toISOString()};
      try{await commit(xRef("bonus",mainId).set(doc));if(!store.bonus.some(b=>b.id===mainId))store.bonus.push({id:mainId,...doc})}catch(err){}
    }
    const n=ok>1?`${ok} 張照片`:"照片";
    toast(msg||(earned&&partner?`兩個人都傳了！+${PHOTO_BONUS} XP 📸`:earned?`${n}上傳好了 📸 等對方也傳就 +${PHOTO_BONUS} XP`:`${n}上傳好了 📸`));
  }else if(msg)toast(msg);
  renderPhotosAll();
});
let lbId=null, lbList=[], lbFull="";
// list：同一組照片的 id，可以左右切換
function openPhoto(id,list){
  const p=calAllPhotos().find(x=>x.id===id);if(!p)return;lbId=id;lbFull="";
  if(list)lbList=list.filter(i=>calAllPhotos().some(x=>x.id===i));
  if(!lbList.includes(id))lbList=[id];
  const i=lbList.indexOf(id),many=lbList.length>1;
  $("lbCount").textContent=many?`${i+1} / ${lbList.length}`:"";
  $("lbPrev").hidden=!many||i===0;$("lbNext").hidden=!many||i===lbList.length-1;
  $("lbImg").src=p.th;$("lbImg").alt=p.by+" 的照片";
  const [,m,d]=p.date.split("-").map(Number),mine=p.by===myName();
  $("lbCap").textContent=`${m}/${d} · ${p.by}${mine?"（我）":""}${p.cap?"\n「"+p.cap+"」":""}`;
  $("lbCapForm").hidden=true;$("lbCapEdit").hidden=!mine;$("lbCapEdit").textContent=p.cap?"✏️ 改這句話":"✏️ 寫一句話";
  const del=$("lbDel");del.hidden=!mine;delete del.dataset.confirm;del.textContent="刪除這張";
  $("lightbox").hidden=false;
  db.collection("pics").doc(id).get().then(s=>{const d=s.exists?s.data():null;if(lbId===id&&d&&d.img){lbFull=d.img;$("lbImg").src=d.img}}).catch(()=>{if(lbId===id)$("lbCount").textContent=($("lbCount").textContent?$("lbCount").textContent+" · ":"")+"原圖沒載到，先顯示縮圖"});
}
function lbStep(n){const i=lbList.indexOf(lbId)+n;if(i>=0&&i<lbList.length)openPhoto(lbList[i])}
$("lbPrev").onclick=()=>lbStep(-1);$("lbNext").onclick=()=>lbStep(1);
// 手指左右滑切換
(()=>{let x0=null,y0=0;const im=$("lbImg");
  im.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
  im.addEventListener("touchend",e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)lbStep(dx<0?1:-1)},{passive:true});
})();
// 幫自己的照片寫一句話（每日照片和日記照片都可以）
$("lbCapEdit").onclick=()=>{const p=calAllPhotos().find(x=>x.id===lbId);if(!p)return;$("lbCapForm").hidden=false;$("lbCapEdit").hidden=true;const t=$("lbCapText");t.value=p.cap||"";t.focus()};
$("lbCapForm").addEventListener("submit",async ev=>{
  ev.preventDefault();const id=lbId,cap=$("lbCapText").value.trim(),p=calAllPhotos().find(x=>x.id===id);if(!p)return;
  try{await commit(db.collection("photos").doc(id).update({cap}));[photos,calPhotos].forEach(l=>{const x=l.find(y=>y.id===id);if(x)x.cap=cap});openPhoto(id);renderPhotosAll();toast("寫好了 ✏️")}catch(e){toast(NOSAVE)}
});
// 存到手機：手機用分享選單（可以選「儲存影像」），電腦直接下載
$("lbSave").onclick=async()=>{
  const p=calAllPhotos().find(x=>x.id===lbId);if(!p)return;
  const src=lbFull||p.th,name=`love-base-${p.date}-${p.by}.jpg`;
  try{
    const blob=await (await fetch(src)).blob(),file=new File([blob],name,{type:"image/jpeg"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast("下載好了 ⬇️");
  }catch(e){if(!e||e.name!=="AbortError")toast("存不了，可以長按照片再選「儲存」")}
};
function closePhoto(){$("lightbox").hidden=true;lbId=null;lbList=[];lbFull="";$("lbImg").removeAttribute("src")}
$("lbClose").onclick=closePhoto;
$("lightbox").addEventListener("click",ev=>{if(ev.target.id==="lightbox")closePhoto()});
document.addEventListener("keydown",ev=>{if($("lightbox").hidden||ev.target.tagName==="INPUT")return;if(ev.key==="Escape")closePhoto();else if(ev.key==="ArrowLeft")lbStep(-1);else if(ev.key==="ArrowRight")lbStep(1)});
$("lbDel").onclick=async()=>{
  const b=$("lbDel"),id=lbId;if(!id)return;
  if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent="確定刪除？再按一次";return}
  try{await db.collection("photos").doc(id).update({trashed:trashMark()});photos=photos.filter(p=>p.id!==id);calPhotos=calPhotos.filter(p=>p.id!==id);closePhoto();renderPhotosAll();toast(TRASHED)}
  catch(e){toast("刪除失敗，請再試一次")}
};
function subPhotos(){
  if(!db)return;
  if(photoUnsub)photoUnsub();
  photoUnsub=db.collection("photos").orderBy("date","desc").limit(photoLimit).onSnapshot(
    s=>{photos=s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!p.trashed);photoErr="";renderPhotosAll();syncPhotoBonus()},
    e=>{photoErr=e&&e.code==="permission-denied"?"rules":"net";renderPhotosAll()});
}

const NAME_KEY="love-base-name", NAMES=["寒冰","夏夏"];
function myName(){try{return localStorage.getItem(NAME_KEY)||""}catch(e){return ""}}
let who="all";
function byChip(n){if(!n)return '<span class="by">未署名</span>';const me=n===myName();return `<span class="by ${me?"me":"them"}">✍️ ${esc(n)}${me?"（我）":""}</span>`}

let monthOpen={}; // 月份 -> 使用者手動開合的狀態
const SEARCH_PAGE=30;
let lastQ="", searchShown=SEARCH_PAGE;
function renderEntries(){
  const box=$("entries");
  if(!entries.length){box.innerHTML='<div class="empty">還沒有日記。寫下第一篇，就是「我們的第 1 篇日記」。</div>';return}
  const sorted=[...entries].sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
  const num=new Map(sorted.map((e,i)=>[e.id,i+1]));
  const me=myName();
  const q=$("dSearch").value.trim().toLowerCase();
  const hit=e=>!q||[e.date,e.mood,e.food,e.funny,e.say,e.s1,e.s2,e.by].some(v=>String(v||"").toLowerCase().includes(q));
  const shown=sorted.slice().reverse().filter(e=>(who==="all"||(who==="me"?e.by===me:e.by!==me))&&hit(e));
  $("dSearchN").textContent=q?`找到 ${shown.length} 篇`:"";
  if(!shown.length){box.innerHTML=`<div class="empty">${q?`找不到「${esc(q)}」的日記。`:who==="me"?"你還沒寫過日記。":"對方還沒寫過日記。"}</div>`;return}
  const card=e=>`<article class="entry ${e.by?(e.by===me?"me":"them"):""}"><header><b>📖 我們的第 ${num.get(e.id)} 篇日記</b><span>${esc(e.date)}${e.happy?" · ⭐ "+esc(e.happy)+"/10":""}</span></header>
  <div>${byChip(e.by)}</div>
  <dl>${[["⛅ 心情",e.mood],["🍜 吃了",e.food],["🤪 最好笑",e.funny],["💞 想對你說",e.say]].filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>
  ${(e.s1||e.s2)?`<blockquote>今天雖然${esc(e.s1||"＿＿")}，但因為有你${esc(e.s2||"＿＿")}。</blockquote>`:""}
  ${entryExtras(e,"list",`<div class="acts">${(!e.by||e.by===me)?`<button class="btn ghost edit" type="button" data-id="${esc(e.id)}">✏️ 編輯</button>`:""}<button class="btn ghost del" type="button" data-id="${esc(e.id)}">刪除</button></div>`)}</article>`;
  const groups=new Map();
  shown.forEach(e=>{const m=String(e.date).slice(0,7);if(!groups.has(m))groups.set(m,[]);groups.get(m).push(e)});
  const cur=key(today()).slice(0,7),first=groups.has(cur)?cur:[...groups.keys()][0];
  // 日記多了以後不能一次全部畫出來：只畫打開的月份，搜尋結果先畫前 SEARCH_PAGE 篇
  if(q!==lastQ){lastQ=q;searchShown=SEARCH_PAGE}
  let budget=q?searchShown:Infinity;
  const isOpen=m=>q?budget>0:(monthOpen[m]??m===first);
  box.innerHTML=[...groups].map(([m,list])=>{const [y,mo]=m.split("-").map(Number),open=isOpen(m);
    let body="";
    if(open){const part=list.slice(0,budget);budget-=part.length;body=part.map(card).join("")}
    return `<details class="month" data-m="${esc(m)}" ${open?"open":""}><summary>${y} 年 ${mo} 月<span>${list.length} 篇</span></summary><div class="month-body">${body}</div></details>`}).join("")
    +(q&&shown.length>searchShown?`<button class="btn ghost" type="button" id="dSearchMore">再顯示 ${Math.min(SEARCH_PAGE,shown.length-searchShown)} 篇（還有 ${shown.length-searchShown} 篇）</button>`:"");
  if(q&&shown.length>searchShown)$("dSearchMore").onclick=()=>{searchShown+=SEARCH_PAGE;renderEntries()};
  // 點開月份時才畫那個月的日記和載入照片
  box.querySelectorAll(".month summary").forEach(s=>s.onclick=()=>{const d=s.parentNode,m=d.dataset.m,opening=!d.open;monthOpen[m]=opening;
    if(opening&&!q){loadCalPhotos(m);if(!d.querySelector(".month-body").children.length)setTimeout(renderEntries,0)}});
  box.querySelectorAll("details.month[open]").forEach(d=>loadCalPhotos(d.dataset.m));
  attachReply("list");
  box.querySelectorAll(".edit").forEach(b=>b.onclick=()=>startEdit(b.dataset.id));
  box.querySelectorAll(".del").forEach(b=>{b.onclick=()=>{
    if(b.dataset.confirm){delEntry(b.dataset.id)}else{b.dataset.confirm=1;b.textContent="確定刪除？再按一次";setTimeout(()=>{if(b.isConnected){delete b.dataset.confirm;b.textContent="刪除"}},3000)}}});
}
async function delEntry(id){
  const item=entries.find(e=>e.id===id);if(!item)return;
  const old=entries,mark=trashMark();
  entries=entries.filter(e=>e.id!==id);trash.diary.push({...item,trashed:mark});renderAll();
  try{db?await db.collection("diary").doc(id).update({trashed:mark}):saveLocal();toast(TRASHED)}
  catch(e){entries=old;trash.diary=trash.diary.filter(x=>x.id!==id);renderAll();toast("刪除失敗")}
}

let happy=0, editId=null;
const FIELDS={dMood:"mood",dFood:"food",dFunny:"funny",dSay:"say",dS1:"s1",dS2:"s2"};
function startEdit(id){
  const e=entries.find(x=>x.id===id);if(!e)return;
  editId=id;renderDiaryToday();$("dDate").value=e.date||key(today());
  for(const [el,f] of Object.entries(FIELDS))$(el).value=e[f]||"";
  happy=Number(e.happy)||0;renderHearts();growAll();
  $("editBar").hidden=false;$("editText").textContent=`✏️ 正在編輯 ${e.date||""} 的日記`;
  $("diaryForm").classList.add("editing");$("dSave").textContent="儲存修改";$("dMsg").textContent="";$("dDraftClear").hidden=true;
  clearQueue();
  openFor("diaryForm");
}
function endEdit(){
  clearQueue();
  editId=null;$("editBar").hidden=true;$("diaryForm").classList.remove("editing");$("dSave").textContent="寫進日記";
  for(const el of Object.keys(FIELDS))$(el).value="";$("dDate").value=key(today());happy=0;renderHearts();growAll();restoreDraft();renderDiaryToday();
}
$("editCancel").onclick=endEdit;
let heartDragged=false,heartStart=null;
(function buildHearts(){
  $("hearts").innerHTML=[...Array(10)].map((_,i)=>`<button type="button" role="radio" aria-label="${i+1} 分" data-v="${i+1}">⭐</button>`).join("")+'<span class="score" id="score"></span>';
  $("hearts").addEventListener("click",ev=>{if(heartDragged)return;const b=ev.target.closest("button[data-v]");if(!b)return;ev.preventDefault();const v=+b.dataset.v;happy=(happy===v?0:v);renderHearts();saveDraft()});
  const pick=x=>{const bs=$("hearts").querySelectorAll("button[data-v]"),l=bs[0].getBoundingClientRect().left,r=bs[9].getBoundingClientRect().right;return Math.max(1,Math.min(10,Math.ceil((x-l)/(r-l)*10)))};
  $("hearts").addEventListener("pointerdown",ev=>{heartStart=ev.clientX;heartDragged=false});
  $("hearts").addEventListener("pointermove",ev=>{
    if(heartStart===null)return;
    if(!heartDragged&&Math.abs(ev.clientX-heartStart)<8)return;
    heartDragged=true;const v=pick(ev.clientX);if(v!==happy){happy=v;renderHearts()}
  });
  const endDrag=()=>{if(heartDragged)saveDraft();heartStart=null;setTimeout(()=>heartDragged=false,60)};
  $("hearts").addEventListener("pointerup",endDrag);
  $("hearts").addEventListener("pointercancel",endDrag);
})();
function renderHearts(){
  $("hearts").querySelectorAll("button[data-v]").forEach(b=>{const v=+b.dataset.v;b.classList.toggle("on",v<=happy);b.setAttribute("aria-checked",v===happy)});
  $("score").textContent=happy?happy+" / 10":"點星星打分數";
}
// 填寫時框框自動變高
function grow(t){t.style.height="auto";t.style.height=t.scrollHeight+2+"px"}
function growAll(){document.querySelectorAll("#diaryForm textarea").forEach(grow)}
$("diaryForm").addEventListener("input",ev=>{if(ev.target.tagName==="TEXTAREA")grow(ev.target)});
// 單行欄位按 Enter 不要送出（中文選字的 Enter 也不會）
$("diaryForm").addEventListener("keydown",ev=>{if(ev.key==="Enter"&&ev.target.tagName==="INPUT"&&!ev.isComposing&&ev.keyCode!==229)ev.preventDefault()});

$("diaryForm").addEventListener("submit",async ev=>{
  ev.preventDefault();
  const queued=dQueue.slice();
  const e={date:$("dDate").value,mood:$("dMood").value.trim(),food:$("dFood").value.trim(),funny:$("dFunny").value.trim(),say:$("dSay").value.trim(),happy:happy||null,s1:$("dS1").value.trim(),s2:$("dS2").value.trim(),at:new Date().toISOString(),by:myName()};
  if(!e.mood&&!e.food&&!e.funny&&!e.say&&!e.s1&&!e.s2&&!queued.length){$("dMsg").textContent="至少寫一格或放一張照片再存喔";return}
  $("dSave").disabled=true;$("dMsg").textContent="";
  if(editId){
    const old=entries.find(x=>x.id===editId);
    if(!old){$("dMsg").textContent="這篇日記已經被刪除了";endEdit();$("dSave").disabled=false;return}
    const upd={...e,at:old.at,by:old.by||myName(),edited:new Date().toISOString()};
    try{
      if(db)await commit(db.collection("diary").doc(editId).set(upd));
      else{Object.assign(old,upd);saveLocal()}
      Object.assign(old,upd);const eid=editId;endEdit();renderAll();
      const n=await uploadQueue(eid,upd.date,queued);toast(n?`修改好了 ✏️ 加了 ${n} 張照片`:"修改好了 ✏️");
    }catch(err){$("dMsg").textContent="沒存到，請再試一次"}
    $("dSave").disabled=false;return;
  }
  const counted=entries.some(x=>x.by===myName()&&x.date===e.date),partner=entries.some(x=>x.by&&x.by!==myName()&&x.date===e.date);
  try{
    let newId;
    if(db){const ref=db.collection("diary").doc();newId=ref.id;await commit(ref.set(e));if(!entries.find(x=>x.id===ref.id))entries.push({id:ref.id,...e})}
    else{e.id="l"+Date.now();entries.push(e);saveLocal()}
    clearQueue();
    diaryFormOpen=false;$("dDate").value=key(today());clearDraft();$("dMsg").textContent="";["dMood","dFood","dFunny","dSay","dS1","dS2"].forEach(i=>$(i).value="");happy=0;renderHearts();growAll();renderAll();toast(counted?"寫好了 💌":partner?`兩個人都寫了！+${DIARY_XP} XP 💌`:`寫好了 💌 等對方也寫就 +${DIARY_XP} XP`);
    if(newId&&queued.length){const n=await uploadQueue(newId,e.date,queued);if(n)toast(`日記寫好了，放了 ${n} 張照片 💌`)}
  }catch(err){$("dMsg").textContent="沒存到，請確認你有這個頁面的編輯權限"}
  $("dSave").disabled=false;
});

// 抽題：每天輪流抽一題（寒冰、夏夏隔天輪），每個月的題庫在 questions.json
// 兩人共用同一題，每人一份答案，都答完才揭曉
let lastRound=null, MONTHLY=null;
const need=()=>db?2:1;
fetch("questions.json",{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(j=>{if(j){MONTHLY=j;renderDraw();if(typeof renderTodo==="function")renderTodo()}}).catch(()=>{});
function monthBank(){const m=key(today()).slice(0,7),b=MONTHLY&&MONTHLY[m];return b&&Array.isArray(b.q)&&b.q.length?{month:Number(m.slice(5)),theme:b.theme||"",q:b.q}:{month:Number(m.slice(5)),theme:"",q:QUESTIONS}}
function allQuestions(){return [...monthBank().q,...store.custom.filter(c=>c.kind==="q").map(c=>c.text)]}
function roundDay(r){return r.day||dayOf(r.at)}
function curRound(){return store.rounds.reduce((a,b)=>!a||String(b.at)>String(a.at)?b:a,null)}
function todayRound(){const tk=key(today());return store.rounds.filter(r=>roundDay(r)===tk).reduce((a,b)=>!a||String(b.at)>String(a.at)?b:a,null)}
function turnOf(k){const [y,m,d]=k.split("-").map(Number);return NAMES[Math.floor(Date.UTC(y,m-1,d)/864e5)%2]}
function myTurn(){return !db||myName()===turnOf(key(today()))}
// 畫面上顯示的題目：今天的題目；今天還沒抽的話，顯示還沒揭曉的舊題目讓大家補答
function shownRound(){const t=todayRound();if(t)return t;const r=curRound();return r&&pairOf(r.id).length<need()?r:null}
function pairOf(id){const seen=new Map();store.answers.filter(a=>a.round===id).sort(byAt).forEach(a=>{if(!seen.has(a.by))seen.set(a.by,a)});return [...seen.values()].sort((a,b)=>(b.by===myName())-(a.by===myName()))}
function renderDraw(){
  const tk=key(today()),bank=monthBank(),extra=store.custom.filter(c=>c.kind==="q").length;
  const turn=turnOf(tk),tomorrow=new Date(today());tomorrow.setDate(tomorrow.getDate()+1);const next=turnOf(key(tomorrow));
  $("drawHint").textContent=`${bank.month} 月${bank.theme?"主題「"+bank.theme+"」":"題庫"} · 共 ${bank.q.length} 題${extra?`（另有自訂 ${extra} 題）`:""}`;
  renderLog();
  const t=todayRound(),r=shownRound(),b=$("drawBtn"),c=$("qCard");
  // 抽題按鈕：今天輪到的人才看得到；已經有人答了就不能換題
  if(!t){b.hidden=!myTurn();b.textContent="🎲 抽今天的題目"}
  else{b.hidden=!myTurn()||pairOf(t.id).length>0;b.textContent="🔁 換一題"}
  const turnLine=db?(t?(next===myName()?"明天輪到你抽":`明天輪到 ${next} 抽`):(myTurn()?"今天輪到你抽題":`今天輪到 ${turn} 抽題`)):"";
  if(!r){
    c.textContent=db&&!myTurn()?`今天輪到 ${turn} 抽題 🎲`:"按下面的按鈕抽今天的題目";
    $("ansForm").hidden=true;$("reveal").hidden=true;$("drawWho").hidden=true;$("ansHint").textContent=turnLine;lastRound=null;return}
  c.textContent=r.q;
  if(lastRound&&r.id!==lastRound){c.classList.remove("flip");void c.offsetWidth;c.classList.add("flip")}
  lastRound=r.id;
  const d=new Date(r.at);$("drawWho").hidden=false;
  $("drawWho").textContent=(r===t?"":"📌 還沒揭曉的題目 · ")+`🎲 ${r.by?nameOf(r.by):"有人"} 在 ${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} 抽的`;
  const ans=pairOf(r.id),mine=ans.find(a=>a.by===myName()),over=ans.length>=need();
  $("ansForm").hidden=!!mine||over;
  $("reveal").hidden=!over;
  if(over)$("reveal").innerHTML=ans.map(a=>`<div><b>${esc(nameOf(a.by))}</b>${esc(a.text)}</div>`).join("");
  const st=over?"過關！答案收進過關紀錄了":mine?"你答好了，等對方回答就會揭曉":ans.length?"對方答好了，換你":"";
  $("ansHint").textContent=[st,turnLine].filter(Boolean).join(" · ");
}
function renderLog(){
  const all=store.rounds.filter(r=>pairOf(r.id).length>=need()).sort(byAt).reverse();
  $("logN").textContent=all.length;
  const q=$("lSearch").value.trim().toLowerCase();
  const hit=r=>!q||[r.q,roundDay(r),...pairOf(r.id).flatMap(a=>[a.text,a.by])].some(v=>String(v||"").toLowerCase().includes(q));
  const list=all.filter(hit);
  $("lSearch").hidden=!all.length;
  $("lSearchN").textContent=q?`找到 ${list.length} 題`:"";
  if(q&&!list.length){$("logList").innerHTML=`<div class="empty">找不到「${esc(q)}」的過關紀錄。</div>`;return}
  $("logList").innerHTML=list.length?list.map(r=>`<article class="entry"><header><b>${esc(r.q)}</b><span>${esc(roundDay(r))}</span></header><dl>${pairOf(r.id).map(a=>`<dt>${esc(nameOf(a.by))}</dt><dd>${esc(a.text)}</dd>`).join("")}</dl></article>`).join(""):'<div class="empty">還沒有過關的題目。</div>';
}
async function drawQ(){
  if(!myTurn())return;
  const t=todayRound(),b=$("drawBtn");
  if(t&&pairOf(t.id).length)return;
  // 這個月的題目裡，挑抽過次數最少的
  const all=allQuestions(),cnt=q=>store.rounds.filter(x=>x.q===q&&x.id!==t?.id).length,min=Math.min(...all.map(cnt));
  let pool=all.filter(q=>cnt(q)===min&&q!==t?.q);
  if(!pool.length)pool=all.filter(q=>q!==t?.q);
  if(!pool.length)return;
  const q=pool[Math.floor(Math.random()*pool.length)];
  b.disabled=true;
  try{
    if(t)await updDoc("rounds",t.id,{q,at:nowIso(),by:myName()});
    else await addDoc("rounds",{q,at:nowIso(),by:myName(),day:key(today())});
  }catch(e){toast("沒抽成功，請再試一次")}
  b.disabled=false;
}
$("drawBtn").onclick=drawQ;

function bindForm(form,btn,build,after){
  $(form).addEventListener("submit",async ev=>{
    ev.preventDefault();
    const data=build();if(!data)return;
    $(btn).disabled=true;
    try{await addDoc(data.c,data.doc);after()}catch(e){toast(NOSAVE)}
    $(btn).disabled=false;
  });
}
// 中文選字按 Enter 時不要送出
["wishForm","cqForm"].forEach(f=>$(f).addEventListener("keydown",ev=>{if(ev.key==="Enter"&&(ev.isComposing||ev.keyCode===229))ev.preventDefault()}));
bindForm("ansForm","ansSave",()=>{const r=shownRound(),text=$("ansText").value.trim();return r&&text&&{c:"answers",doc:{round:r.id,text,by:myName(),at:nowIso()}}},()=>{$("ansText").value=""});

// 願望清單
// 願望分類：存在願望的 cat 欄位，舊願望沒有這個欄位就算「其他」
const WCATS={eat:"🍜 想吃",go:"📍 想去",do:"🎯 想做","":"✨ 其他"};
let wFilter="all", wCat="";
function syncWCat(){$("wCatPick").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.wc===wCat))}
$("wCatPick").querySelectorAll("button").forEach(b=>b.onclick=()=>{wCat=b.dataset.wc;syncWCat()});syncWCat();
function renderWishes(){
  const box=$("wishList"),q=$("wSearch").value.trim().toLowerCase();
  $("wSearch").hidden=!store.wishes.length;
  if(!store.wishes.length){$("wSearchN").textContent="";box.innerHTML='<div class="empty">還沒有願望。寫下第一件想一起完成的事。</div>';return}
  const cnt=c=>store.wishes.filter(w=>(w.cat||"")===c&&!w.done).length;
  $("wCatFilter").innerHTML=[["all","全部",store.wishes.filter(w=>!w.done).length],...Object.entries(WCATS).map(([c,l])=>[c,l,cnt(c)])].map(([c,l,n])=>`<button type="button" data-wc="${c}" aria-pressed="${wFilter===c}">${l} ${n}</button>`).join("");
  $("wCatFilter").querySelectorAll("button").forEach(b=>b.onclick=()=>{wFilter=b.dataset.wc;renderWishes()});
  const wishes=store.wishes.filter(w=>(wFilter==="all"||(w.cat||"")===wFilter)&&(!q||[w.text,w.by,w.doneDate,dayOf(w.at),w.done?"已完成":"未完成",WCATS[w.cat||""]].some(v=>String(v||"").toLowerCase().includes(q))));
  $("wSearchN").textContent=q?`找到 ${wishes.length} 個（完成 ${wishes.filter(w=>w.done).length} 個）`:"";
  if(!wishes.length){box.innerHTML=`<div class="empty">${q?`找不到「${esc(q)}」的願望。`:"這一類還沒有願望。"}</div>`;return}
  const open=wishes.filter(w=>!w.done).sort((a,b)=>byAt(b,a));
  const closed=wishes.filter(w=>w.done).sort((a,b)=>String(b.doneDate).localeCompare(String(a.doneDate)));
  box.innerHTML=[...open,...closed].map(w=>`<div class="wish ${w.done?"done":""}"><button class="check" type="button" data-id="${esc(w.id)}" aria-pressed="${!!w.done}" aria-label="${esc(w.text)}：${w.done?"已完成，點一下取消":"標記完成"}">✓</button><div class="t"><b>${esc(w.text)}</b><div><button type="button" class="cat" data-cat="${esc(w.id)}" aria-label="分類：${WCATS[w.cat||""]}，點一下換分類">${WCATS[w.cat||""]}</button>${esc(w.by||"")} 許的${w.done?` · ${esc(w.doneDate)} 完成`:""}</div></div><button class="btn ghost del" type="button" data-id="${esc(w.id)}">刪除</button></div>`).join("");
  box.querySelectorAll(".check").forEach(b=>b.onclick=()=>toggleWish(b.dataset.id));
  box.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{const w=store.wishes.find(x=>x.id===b.dataset.cat);if(!w)return;const ks=Object.keys(WCATS);updDoc("wishes",w.id,{cat:ks[(ks.indexOf(w.cat||"")+1)%ks.length]})});
  armDelete(box,"wishes");
}
function toggleWish(id){
  const w=store.wishes.find(x=>x.id===id);if(!w)return;
  const on=!w.done;
  updDoc("wishes",id,{done:on,doneDate:on?key(today()):null});
  if(on)toast("願望達成 🌠");
}
bindForm("wishForm","wSave",()=>{const text=$("wText").value.trim();return text&&{c:"wishes",doc:{text,cat:wCat,done:false,doneDate:null,by:myName(),at:nowIso()}}},()=>{$("wText").value="";toast("許願成功 🌠")});

// 自訂題庫和任務
function renderCustom(){
  const box=$("customList"),items=store.custom.filter(c=>c.kind==="q").sort(byAt).reverse();
  box.innerHTML=items.map(c=>`<div class="citem"><span>💬 ${esc(c.text)}</span><button class="btn ghost del" type="button" data-id="${esc(c.id)}">刪除</button></div>`).join("");
  armDelete(box,"custom");
}
bindForm("cqForm","cqSave",()=>{const text=$("cqText").value.trim();return text&&{c:"custom",doc:{kind:"q",text,by:myName(),at:nowIso()}}},()=>{$("cqText").value="";toast("加進題庫了")});

// 時光膠囊
function renderCapsules(){
  const box=$("capList"),tk=key(today());
  if(!store.capsules.length){box.innerHTML='<div class="empty">還沒有膠囊。封存第一封寫給未來的信。</div>';return}
  const acts=c=>`<div class="acts"><button class="btn ghost del" type="button" data-id="${esc(c.id)}">刪除</button></div>`;
  const opened=store.capsules.filter(c=>c.openDate<=tk).sort((a,b)=>b.openDate.localeCompare(a.openDate));
  const sealed=store.capsules.filter(c=>c.openDate>tk).sort((a,b)=>a.openDate.localeCompare(b.openDate));
  box.innerHTML=[...opened.map(c=>`<article class="entry"><header><b>💌 ${esc(c.openDate)} 打開的膠囊</b><span>${esc(nameOf(c.by))}寫於 ${esc(dayOf(c.at))}</span></header><p class="letter">${esc(c.text)}</p>${acts(c)}</article>`),
    ...sealed.map(c=>`<article class="entry sealed"><header><b>🔒 封存中</b><span>${esc(nameOf(c.by))}寫於 ${esc(dayOf(c.at))}</span></header><p class="letter">${esc(c.openDate)} 打開，還有 ${Math.round((fromKey(c.openDate)-today())/864e5)} 天</p>${acts(c)}</article>`)].join("");
  armDelete(box,"capsules");
}
bindForm("capForm","capSave",()=>{
  const text=$("capText").value.trim(),openDate=$("capDate").value;
  if(!text||!openDate)return null;
  if(openDate<=key(today())){$("capMsg").textContent="打開的日期要選明天以後";return null}
  $("capMsg").textContent="";
  return {c:"capsules",doc:{text,openDate,by:myName(),at:nowIso()}}
},()=>{$("capText").value="";toast("封存好了 ⏳")});

// 回憶
function renderOnThisDay(){
  const t=today(),y=new Date(t.getFullYear()-1,t.getMonth(),t.getDate()),m=new Date(t.getFullYear(),t.getMonth()-1,t.getDate());
  const slots=[["一年前的今天",y.getDate()===t.getDate()&&y],["一個月前的今天",m.getDate()===t.getDate()&&m],["一週前的今天",addDays(t,-7)]];
  const hits=slots.filter(x=>x[1]).map(([label,d])=>[label,entries.find(e=>e.date===key(d))]).filter(x=>x[1]);
  $("onThisDay").innerHTML=hits.length?hits.map(([label,e])=>`<article class="entry"><header><b>📅 ${label}</b><span>${esc(e.date)}${e.happy?" · ⭐ "+esc(e.happy)+"/10":""}</span></header><div>${byChip(e.by)}</div><dl>${[["⛅ 心情",e.mood],["🤪 最好笑",e.funny],["💞 想對你說",e.say]].filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl></article>`).join(""):'<div class="empty">一週前、一個月前、一年前的今天寫過日記，就會出現在這裡。</div>';
}
function renderChart(){
  const box=$("hChart"),t=today(),days=[...Array(30)].map((_,i)=>addDays(t,i-29)),fmt=d=>(d.getMonth()+1)+"/"+d.getDate();
  const pts=days.map((d,i)=>{const v=entries.filter(e=>e.date===key(d)&&e.happy).map(e=>+e.happy);return v.length?{i,d,v:v.reduce((a,b)=>a+b,0)/v.length}:null}).filter(Boolean);
  if(pts.length<2){box.innerHTML='<div class="empty">至少兩天的日記有打幸福指數，就會畫出曲線。</div>';return}
  const W=Math.max(280,box.clientWidth||640),H=180,L=24,R=10,T=20,B=22;
  const x=i=>L+i/29*(W-L-R),y=v=>T+(10-v)/9*(H-T-B);
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="最近 30 天幸福指數曲線">${[1,5,10].map(v=>`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("")}<text class="axis" x="${L}" y="${H-4}">${fmt(days[0])}</text><text class="axis" x="${W-R}" y="${H-4}" text-anchor="end">今天</text><polyline class="line" points="${pts.map(p=>x(p.i)+","+y(p.v)).join(" ")}"/>${pts.map(p=>`<circle class="dot" cx="${x(p.i)}" cy="${y(p.v)}" r="5"/>`).join("")}</svg><div class="tip" hidden></div>`;
  const svg=box.querySelector("svg"),tip=box.querySelector(".tip");
  svg.onpointermove=ev=>{
    const r=svg.getBoundingClientRect(),px=(ev.clientX-r.left)/r.width*W;
    const p=pts.reduce((a,b)=>Math.abs(x(b.i)-px)<Math.abs(x(a.i)-px)?b:a);
    tip.textContent=`${fmt(p.d)} · ⭐ ${Math.round(p.v*10)/10}`;tip.hidden=false;
    tip.style.left=Math.min(88,Math.max(12,x(p.i)/W*100))+"%";
  };
  svg.onpointerleave=()=>tip.hidden=true;
}
function renderMonth(){
  const pick=$("mPick"),keep=pick.value,cur=key(today()).slice(0,7);
  const months=[...new Set([cur,...entries.map(e=>String(e.date).slice(0,7)),...Object.keys(done).map(k=>k.slice(0,7))])].sort().reverse();
  pick.innerHTML=months.map(m=>`<option value="${m}">${m.replace("-"," 年 ")} 月</option>`).join("");
  pick.value=months.includes(keep)?keep:cur;
  const m=pick.value,es=entries.filter(e=>String(e.date).startsWith(m)),rated=es.filter(e=>e.happy);
  const avg=rated.length?(rated.reduce((a,e)=>a+ +e.happy,0)/rated.length).toFixed(1):"—";
  const tiles=[["日記",es.length+" 篇"],["一起完成",togetherDays().filter(k=>k.startsWith(m)).length+" 天"],["達成願望",store.wishes.filter(w=>w.done&&String(w.doneDate).startsWith(m)).length+" 個"],["平均幸福",avg]];
  $("mStats").innerHTML=tiles.map(([a,b])=>`<div class="stat"><span>${a}</span><b>${b}</b></div>`).join("");
  const best=[...rated].sort((a,b)=>b.happy-a.happy||String(b.date).localeCompare(String(a.date)))[0],funny=es.filter(e=>e.funny).slice(-3);
  $("mBest").innerHTML=(best?`<p>⭐ 最幸福的一天：${esc(best.date)}（${esc(best.happy)}/10）${esc(best.say||best.mood||"")}</p>`:"")+funny.map(e=>`<p>🤪 ${esc(e.date)}：${esc(e.funny)}</p>`).join("")||'<p class="sub">這個月還沒有日記。</p>';
}
$("mPick").onchange=renderMonth;
window.addEventListener("resize",()=>{if($("memories").classList.contains("open"))renderChart()});
function renderReviewsPast(){
  const days=[...new Set(store.reviews.map(r=>r.date))].sort().reverse();
  $("reviewN").textContent=`${days.length} 週`;
  $("reviewPast").innerHTML=days.length?days.map(d=>`<article class="entry"><header><b>${esc(d)}</b></header><dl>${store.reviews.filter(r=>r.date===d).sort(byAt).map(r=>`<dt>${esc(r.by)}</dt><dd>${esc(r.text)}</dd>`).join("")}</dl></article>`).join(""):'<div class="empty">星期日寫下這週回顧，就會收在這裡。</div>';
}
function renderMemories(){renderOnThisDay();renderReviewsPast();renderChart();renderMonth()}

// 月曆：照片牆只載入最近幾十張，所以看哪個月就另外抓那個月的照片
let calMonth=key(today()).slice(0,7), calDay=key(today()), calPhotos=[];
const calLoaded=new Set();
function calAllPhotos(){const m=new Map();[...calPhotos,...photos].forEach(p=>m.set(p.id,p));return [...m.values()]}
function loadCalPhotos(m){
  if(!db||calLoaded.has(m))return;
  calLoaded.add(m);
  db.collection("photos").where("date",">=",m+"-01").where("date","<=",m+"-31").get().then(s=>{
    const ids=new Set(s.docs.map(d=>d.id));
    calPhotos=calPhotos.filter(p=>!ids.has(p.id)).concat(s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!p.trashed));
    renderDiaryToday();renderOpen();if($("diaryMore").open)renderEntries();
  }).catch(()=>{calLoaded.delete(m);if(navigator.onLine)toast("這個月的照片沒載到，稍後會再試")});
}
function renderCalendar(){
  loadCalPhotos(calMonth);
  const [y,m]=calMonth.split("-").map(Number),t=today(),tk=key(t),cur=tk.slice(0,7);
  const offset=dow(new Date(y,m-1,1)),count=new Date(y,m,0).getDate(),ps=calAllPhotos(),together=new Set(togetherDays());
  const earliest=[key(LOVE_START).slice(0,7),...entries.map(e=>String(e.date).slice(0,7))].sort()[0];
  $("calTitle").textContent=`${y} 年 ${m} 月`;
  $("calPrev").disabled=calMonth<=earliest;
  $("calNext").disabled=calMonth>=cur;
  let h='<span></span>'.repeat(offset);
  for(let d=1;d<=count;d++){
    const k=calMonth+"-"+pad(d);
    const marks=[[entries.some(e=>e.date===k),"diary","日記"],[ps.some(p=>p.date===k),"photo","照片"],[together.has(k),"task","一起完成"],[store.wishes.some(w=>w.done&&w.doneDate===k),"wish","願望"]].filter(x=>x[0]);
    h+=`<button type="button" data-d="${k}" class="${marks.length?"has":""} ${k===tk?"today":""}" aria-pressed="${k===calDay}" aria-label="${m} 月 ${d} 日${marks.length?"，有"+marks.map(x=>x[2]).join("、"):""}" ${k>tk?"disabled":""}>${d}<span class="dots">${marks.map(x=>`<i class="d-${x[1]}"></i>`).join("")}</span></button>`;
  }
  $("calGrid").innerHTML=h;
  $("calGrid").querySelectorAll("button").forEach(b=>b.onclick=()=>{const same=calDay===b.dataset.d;calDay=same?null:b.dataset.d;renderCalendar();if(same)$("diaryMore").open=true});
  renderCalDetail();
}
function renderCalDetail(){
  const box=$("calDetail"),k=calDay;
  if(!k){if(replyTo&&replyTo.where==="cal")closeReply();box.innerHTML="";return}
  const dt=fromKey(k),label=`${dt.getMonth()+1}/${dt.getDate()}（${"日一二三四五六"[dt.getDay()]}）`;
  const es=entries.filter(e=>e.date===k).sort(byAt),ps=calAllPhotos().filter(p=>p.date===k&&!p.entry),ws=store.wishes.filter(w=>w.done&&w.doneDate===k);
  if(!es.length&&!ps.length&&!ws.length){box.innerHTML=`<div class="empty">${label} 還沒有紀錄。</div>`;return}
  box.innerHTML=`<article class="entry"><header><b>📅 ${label}</b></header>${ws.map(w=>`<div>🌠 達成願望：${esc(w.text)}</div>`).join("")}${ps.length?`<div class="wall-grid">${ps.map(p=>photoBtn(p,"")).join("")}</div>`:""}</article>`+es.map(e=>`<article class="entry ${e.by?(e.by===myName()?"me":"them"):""}"><header><div>${byChip(e.by)}</div><span>${e.happy?"⭐ "+esc(e.happy)+"/10":""}</span></header><dl>${[["⛅ 心情",e.mood],["🍜 吃了",e.food],["🤪 最好笑",e.funny],["💞 想對你說",e.say]].filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>${(e.s1||e.s2)?`<blockquote>今天雖然${esc(e.s1||"＿＿")}，但因為有你${esc(e.s2||"＿＿")}。</blockquote>`:""}${entryExtras(e,"cal")}</article>`).join("");
  attachReply("cal");
}
function shiftCal(n){
  const [y,m]=calMonth.split("-").map(Number);
  calMonth=key(new Date(y,m-1+n,1)).slice(0,7);
  calDay=calMonth===key(today()).slice(0,7)?key(today()):null;
  renderCalendar();
}
$("calPrev").onclick=()=>shiftCal(-1);
$("calNext").onclick=()=>shiftCal(1);

// 加到主畫面
let installEvt=null;
const isStandalone=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function renderInstall(){
  $("installBtn").hidden=!installEvt||isStandalone();
  $("installText").textContent=isStandalone()?"已經在主畫面上了 ✓":installEvt?"按下面的按鈕，手機桌面就會多一個基地圖示。":isIOS?"用 Safari 打開這個網址，按分享按鈕，選「加入主畫面」。第一次從主畫面打開時，要再輸入一次暗號和名字。":"打開瀏覽器的選單，選「加到主畫面」或「安裝應用程式」。";
}
window.addEventListener("beforeinstallprompt",ev=>{ev.preventDefault();installEvt=ev;renderInstall()});
window.addEventListener("appinstalled",()=>{installEvt=null;renderInstall();toast("加好了 📱")});
$("installBtn").onclick=async()=>{const e=installEvt;if(!e)return;installEvt=null;e.prompt();try{await e.userChoice}catch(err){}renderInstall()};

// 備份：匯出整個房間；補回時只新增目前沒有的資料，不改動現有內容
const BK_COLLS=["done","diary","pics","photos"], BK_KEY="love-base-last-backup";
let bkPending=[];
const bkMsg=t=>$("bkMsg").textContent=t;
// 備份檔是一個 HTML：打開是排好版的日記，裡面同時藏著還原用的完整資料
const BK_TAG='<script type="application/json" id="love-base-backup">';
function backupPayload(t){const i=t.indexOf(BK_TAG);if(i<0)return t;const a=i+BK_TAG.length;return t.slice(a,t.indexOf("<"+"/script>",a))}
function backupHtml(b){
  const live=o=>Object.entries(o||{}).map(([id,v])=>({id,...v})).filter(x=>!x.trashed);
  const xs=c=>Object.entries(b.data.done||{}).filter(([k])=>k.startsWith(`x~${c}~`)).map(([k,v])=>({id:k.split("~")[2],...v})).filter(x=>!x.trashed).sort(byAt);
  const diary=live(b.data.diary).sort((x,y)=>(String(x.date)+x.at).localeCompare(String(y.date)+y.at)),photos=live(b.data.photos).sort(byAt),replies=xs("replies");
  const wk="日一二三四五六",tk=key(today());
  const months=[...new Set(diary.map(e=>String(e.date).slice(0,7)))];
  const mName=m=>{const [y,mo]=m.split("-").map(Number);return `${y} 年 ${mo} 月`};
  const article=e=>{
    const dt=fromKey(e.date),rs=replies.filter(r=>r.entry===e.id),texts=rs.filter(r=>r.kind==="text"),first=diary.find(x=>x.date===e.date&&x.by===e.by).id===e.id;
    const phs=[first?photos.find(p=>!p.entry&&p.date===e.date&&p.by===e.by):null,...photos.filter(p=>p.entry===e.id).sort((a,b)=>String(a.at).localeCompare(String(b.at)))].filter(Boolean);
    return `<article><h3>${esc(e.date)}（${wk[dt.getDay()]}）<span>${esc(e.by||"未署名")}${e.happy?` · ⭐ ${esc(e.happy)}/10`:""}</span></h3><dl>${[["心情",e.mood],["吃了",e.food],["最好笑",e.funny],["想對你說",e.say]].filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>${(e.s1||e.s2)?`<blockquote>今天雖然${esc(e.s1||"＿＿")}，但因為有你${esc(e.s2||"＿＿")}。</blockquote>`:""}${phs.map(p=>`<img src="${esc(p.th)}" alt="當天的照片">`).join("")}${texts.map(r=>`<p class="re"><b>${esc(r.by)}</b> ${esc(r.text)}</p>`).join("")}</article>`;
  };
  const wishes=xs("wishes"),caps=xs("capsules"),rounds=xs("rounds"),answers=xs("answers"),wall=photos.filter(p=>!p.entry),reviews=xs("reviews");
  const passed=rounds.filter(r=>new Set(answers.filter(a=>a.round===r.id).map(a=>a.by)).size>=2);
  const part=(id,title,body)=>body?`<section id="${id}"><h2>${title}</h2>${body}</section>`:"";
  const json=JSON.stringify(b).replace(/</g,"\\u003c");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>戀愛基地備份 ${esc(dayOf(b.exportedAt))}</title><style>
:root{color-scheme:light}body{margin:0;background:#fbf6f8;color:#2a1b25;font:16px/1.75 "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif}
main{max-width:680px;margin:0 auto;padding:32px 16px 64px}h1{font-size:28px;margin:0}header p{margin:4px 0;color:#7c6672}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0}nav a{background:#fff;border:1px solid #ead9e1;border-radius:99px;padding:2px 12px;color:#2a1b25;text-decoration:none;font-size:14px}
h2{font-size:20px;margin:36px 0 12px;padding-bottom:6px;border-bottom:2px solid #e2457a}h3{font-size:16px;margin:0 0 6px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}h3 span{font-weight:400;font-size:14px;color:#7c6672}
article{background:#fff;border:1px solid #ead9e1;border-radius:12px;padding:14px 16px;margin:0 0 12px;break-inside:avoid;overflow-wrap:anywhere}dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}dt{color:#7c6672}dd{margin:0;white-space:pre-wrap}
blockquote{margin:8px 0 0;padding:8px 12px;background:#fde3ec;border-radius:8px}article img{display:inline-block;margin-right:8px;width:140px;height:140px;object-fit:cover;border-radius:8px;margin-top:8px}.re{margin:6px 0 0;padding:4px 10px;background:#f4ebef;border-radius:8px;font-size:14px}
ul{margin:0;padding-left:1.3em}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}figure{margin:0;font-size:13px;color:#7c6672}figure img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}
</style></head><body><main><header><h1>我們的戀愛遊戲基地</h1><p>備份於 ${esc(dayOf(b.exportedAt))} · ${diary.length} 篇日記 · ${photos.length} 張照片${b.full?" · 含原圖":""}</p><p>要救回資料時，到網站的「資料備份」選「從備份檔補回資料」，選這個檔案就可以。</p><nav>${months.map(m=>`<a href="#m${m}">${mName(m)}</a>`).join("")}${reviews.length?'<a href="#reviews">回顧</a>':""}${wishes.length?'<a href="#wishes">願望</a>':""}${passed.length?'<a href="#draw">抽題</a>':""}${caps.length?'<a href="#caps">膠囊</a>':""}${wall.length?'<a href="#wall">照片</a>':""}</nav></header>
${months.map(m=>{const list=diary.filter(e=>String(e.date).startsWith(m));return part("m"+m,`${mName(m)}（${list.length} 篇）`,list.map(article).join(""))}).join("")}
${part("reviews","每週回顧",[...new Set(reviews.map(r=>r.date))].sort().map(d=>`<article><h3>${esc(d)}</h3><dl>${reviews.filter(r=>r.date===d).map(r=>`<dt>${esc(r.by)}</dt><dd>${esc(r.text)}</dd>`).join("")}</dl></article>`).join(""))}
${part("wishes","願望清單",wishes.length?`<ul>${wishes.map(w=>`<li>${w.done?"✅":"⬜"} ${esc(w.text)}${w.done?`（${esc(w.doneDate)} 完成）`:""}</li>`).join("")}</ul>`:"")}
${part("draw","抽題紀錄",passed.map(r=>`<article><h3>${esc(r.q)}<span>${esc(dayOf(r.at))}</span></h3><dl>${[...new Map(answers.filter(a=>a.round===r.id).sort(byAt).map(a=>[a.by,a])).values()].map(a=>`<dt>${esc(a.by)}</dt><dd>${esc(a.text)}</dd>`).join("")}</dl></article>`).join(""))}
${part("caps","時光膠囊",caps.map(c=>`<article><h3>${c.openDate>tk?"🔒 封存中":"💌 已打開"}<span>${esc(c.by)} · ${esc(c.openDate)} 打開</span></h3>${c.openDate>tk?"":`<p style="margin:0;white-space:pre-wrap">${esc(c.text)}</p>`}</article>`).join(""))}
${part("wall","照片",wall.length?`<div class="grid">${wall.map(p=>`<figure><img src="${esc(p.th)}" alt="${esc(p.by)} 的照片" loading="lazy">${esc(p.date)} · ${esc(p.by)}${p.cap?`<br>${esc(p.cap)}`:""}</figure>`).join("")}</div>`:"")}
</main>${BK_TAG}${json}<${"/"}script></body></html>`;
}
function saveFile(name,text){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type:"text/html;charset=utf-8"}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function showLastBackup(){let v="";try{v=localStorage.getItem(BK_KEY)||""}catch(e){}bkMsg(v?`這台裝置上次備份：${v}`:"這台裝置還沒備份過。")}
async function exportBackup(full){
  if(!db||!navigator.onLine){toast("要連上網路才能備份");return}
  $("bkText").disabled=$("bkFull").disabled=true;bkMsg("整理資料中…");
  try{
    const data={};
    for(const c of BK_COLLS){
      if(c==="pics"&&!full)continue;
      const s=await db.collection(c).get();
      data[c]={};s.docs.forEach(d=>data[c][d.id]=d.data());
    }
    saveFile(`戀愛基地備份_${key(today())}${full?"_完整":""}.html`,backupHtml({app:"love-base",version:2,exportedAt:nowIso(),full,data}));
    try{localStorage.setItem(BK_KEY,key(today()))}catch(e){}
    try{await addDoc("backups",{full,by:myName(),at:nowIso()})}catch(e){}
    showLastBackup();toast("備份下載好了 💾");
  }catch(e){bkMsg("備份失敗，請確認網路後再試一次。")}
  $("bkText").disabled=$("bkFull").disabled=false;
}
async function prepRestore(text){
  $("bkConfirm").hidden=true;bkPending=[];
  let b;try{b=JSON.parse(backupPayload(text))}catch(e){bkMsg("這個檔案讀不出來，請選下載的備份檔。");return}
  if(b?.app!=="love-base"||!b.data){bkMsg("這不是基地的備份檔。");return}
  if(!db||!navigator.onLine){bkMsg("要連上網路才能補回資料。");return}
  bkMsg("比對中…");
  try{
    for(const c of BK_COLLS){
      if(!b.data[c])continue;
      const s=await db.collection(c).get(),have=new Set(s.docs.map(d=>d.id));
      for(const [id,v] of Object.entries(b.data[c]))if(!have.has(id))bkPending.push([c,id,v]);
    }
  }catch(e){bkMsg("比對失敗，請確認網路後再試一次。");return}
  if(!bkPending.length){bkMsg("備份裡的資料目前都還在，不用補回。");return}
  $("bkConfirm").textContent=`補回 ${bkPending.length} 筆資料`;$("bkConfirm").hidden=false;
  bkMsg(`備份日期 ${dayOf(b.exportedAt)}。只會補回目前沒有的資料，現有內容不會被改動；已經刪掉的東西也會一起回來。`);
}
async function applyRestore(){
  const list=bkPending;let ok=0;
  $("bkConfirm").disabled=true;
  try{for(const [c,id,v] of list){await db.collection(c).doc(id).set(v);ok++;bkMsg(`補回中… ${ok} / ${list.length}`)}bkMsg(`補回完成，共 ${ok} 筆。`);toast("資料補回來了 💾")}
  catch(e){bkMsg(`補到第 ${ok} 筆時失敗了，請確認網路後再選一次備份檔。`)}
  bkPending=[];$("bkConfirm").hidden=true;$("bkConfirm").disabled=false;
}
$("bkText").onclick=()=>exportBackup(false);
$("bkFull").onclick=()=>exportBackup(true);
$("bkPick").onclick=()=>{$("bkFile").value="";$("bkFile").click()};
$("bkFile").addEventListener("change",async()=>{const f=$("bkFile").files[0];if(f)prepRestore(await f.text())});
$("bkConfirm").onclick=applyRestore;

// 垃圾桶
const trashExpired=x=>Date.now()-new Date(x.trashed.at).getTime()>=TRASH_DAYS*864e5;
const trashDaysLeft=x=>Math.max(1,Math.ceil((new Date(x.trashed.at).getTime()+TRASH_DAYS*864e5-Date.now())/864e5));
function trashLabel(c,x){
  if(c==="diary")return `💌 ${esc(x.date)} 的日記：${esc(String(x.mood||x.say||x.funny||x.food||x.s1||x.s2||"").slice(0,40))}`;
  if(c==="photos")return `<img src="${esc(x.th)}" alt="" loading="lazy">📷 ${esc(x.date)} ${esc(x.by)} 的照片${x.replaced?"（被換掉的）":""}`;
  if(c==="wishes")return `🌠 ${esc(x.text)}`;
  if(c==="capsules")return x.openDate>key(today())?`🔒 封存中的膠囊（${esc(x.openDate)} 打開）`:`⏳ ${esc(x.text)}`;
  return x.kind==="q"?`💬 ${esc(x.text)}`:`📌 ${esc(x.name)}：${esc(x.text)}`;
}
function renderTrash(){
  const box=$("trashList"),items=Object.entries(trash).flatMap(([c,l])=>l.map(x=>[c,x])).sort((a,b)=>String(b[1].trashed.at).localeCompare(String(a[1].trashed.at)));
  $("trashN").textContent=items.length;
  box.innerHTML=items.length?items.map(([c,x])=>`<div class="citem"><span>${trashLabel(c,x)}<small>${esc(x.trashed.by||"有人")} 刪的 · 還剩 ${trashDaysLeft(x)} 天</small></span><div class="trash-acts"><button class="btn ghost" type="button" data-restore="${c}" data-id="${esc(x.id)}">復原</button><button class="btn ghost" type="button" data-purge="${c}" data-id="${esc(x.id)}">永久刪除</button></div></div>`).join(""):'<div class="empty">垃圾桶是空的。</div>';
  box.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>restoreItem(b.dataset.restore,b.dataset.id));
  box.querySelectorAll("[data-purge]").forEach(b=>{b.onclick=()=>{
    if(b.dataset.confirm){purgeItem(b.dataset.purge,b.dataset.id)}else{b.dataset.confirm=1;b.textContent="無法復原，再按一次";setTimeout(()=>{if(b.isConnected){delete b.dataset.confirm;b.textContent="永久刪除"}},3000)}}});
}
// 把某張照片（含原圖）複製到垃圾桶裡的新位置，原本的位置就可以放新照片
async function archivePhoto(id){
  if(!db)return;
  const ps=await db.collection("photos").doc(id).get();if(!ps.exists)return;
  const meta=ps.data()||{},pc=await db.collection("pics").doc(id).get();
  const nid=id+"~"+Date.now().toString(36);
  if(pc.exists)await db.collection("pics").doc(nid).set(pc.data());
  const {trashed,replaced,...rest}=meta;
  const doc={...rest,trashed:trashed||trashMark(),replaced:id};
  await db.collection("photos").doc(nid).set(doc);
  trash.photos=trash.photos.filter(x=>x.id!==id).concat([{id:nid,...doc}]);
}
// 復原被換掉的照片：跟現在那張交換，現在那張進垃圾桶
async function restoreReplaced(item){
  const orig=item.replaced,{id,trashed,replaced,...data}=item;
  const pc=await db.collection("pics").doc(id).get();
  await archivePhoto(orig);
  if(pc.exists)await db.collection("pics").doc(orig).set(pc.data());
  await db.collection("photos").doc(orig).set(data);
  await db.collection("photos").doc(id).delete();await db.collection("pics").doc(id).delete().catch(()=>{});
  trash.photos=trash.photos.filter(x=>x.id!==id);
  photos=photos.filter(p=>p.id!==orig).concat([{id:orig,...data}]);calPhotos=calPhotos.filter(p=>p.id!==orig).concat([{id:orig,...data}]);
}
function trashRef(c,id){return c==="diary"||c==="photos"?db.collection(c).doc(id):xRef(c,id)}
async function restoreItem(c,id){
  const item=trash[c].find(x=>x.id===id);if(!item)return;
  if(c==="photos"&&item.replaced&&db){
    try{await restoreReplaced(item);renderAll();toast("換回這張了 ♻️ 原本那張放進垃圾桶")}catch(e){toast("復原失敗，請再試一次")}
    return;
  }
  const {id:_id,trashed,replaced:_r,...data}=item;
  const list=c==="diary"?entries:c==="photos"?photos:store[c];
  trash[c]=trash[c].filter(x=>x.id!==id);list.push({id,...data});renderAll();
  try{
    db?await trashRef(c,id).set(data):saveLocal();
    if(c==="photos")calLoaded.delete(String(data.date).slice(0,7));
    renderAll();toast("復原了 ♻️");
  }catch(e){
    const i=list.findIndex(x=>x.id===id);if(i>=0)list.splice(i,1);
    trash[c].push(item);renderAll();toast("復原失敗，請再試一次");
  }
}
async function hardDelete(c,id){
  if(!db)return;
  await trashRef(c,id).delete();
  if(c==="photos")await db.collection("pics").doc(id).delete();
  if(c==="diary"){
    store.replies.filter(r=>r.entry===id).forEach(r=>xRef("replies",r.id).delete().catch(()=>{}));
    db.collection("photos").doc("d_"+id).delete().catch(()=>{});db.collection("pics").doc("d_"+id).delete().catch(()=>{});
    db.collection("photos").where("entry","==",id).get().then(s=>s.docs.forEach(d=>{d.ref.delete().catch(()=>{});db.collection("pics").doc(d.id).delete().catch(()=>{})})).catch(()=>{});
  }
}
async function purgeItem(c,id){
  const old=trash[c];trash[c]=old.filter(x=>x.id!==id);renderTrash();
  try{await hardDelete(c,id);if(!db)saveLocal();toast("永久刪除了")}catch(e){trash[c]=old;renderTrash();toast("刪除失敗")}
}
const purging=new Set();
function purgeExpired(){
  for(const c of Object.keys(trash))for(const x of trash[c]){
    if(!trashExpired(x)||purging.has(c+x.id))continue;
    purging.add(c+x.id);
    hardDelete(c,x.id).catch(()=>purging.delete(c+x.id));
    if(!db){trash[c]=trash[c].filter(y=>y.id!==x.id);saveLocal()}
  }
}
function subPhotoTrash(){
  db.collection("photos").where("trashed.at",">","").onSnapshot(s=>{
    trash.photos=s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.trashed);
    renderOpen();purgeExpired();
  },()=>{});
}

// 側邊選單（電腦版），手機用底部分頁
const SIDE_KEY="love-base-side";
function setSide(v,save){
  document.documentElement.dataset.side=v;
  const open=v==="open",b=$("sideToggle");
  b.textContent=open?"«":"»";
  b.setAttribute("aria-expanded",open);b.setAttribute("aria-label",open?"縮小選單":"展開選單");
  if(save)try{localStorage.setItem(SIDE_KEY,v)}catch(e){}
}
setSide(document.documentElement.dataset.side==="mini"?"mini":"open");
$("sideToggle").onclick=()=>setSide(document.documentElement.dataset.side==="open"?"mini":"open",true);

// 日記草稿：只存在這台裝置，寫進日記後清掉；編輯舊日記時不動草稿
const DRAFT_KEY="love-base-draft";
function saveDraft(){
  if(editId)return;
  const d={date:$("dDate").value,happy};
  for(const [el,f] of Object.entries(FIELDS))d[f]=$(el).value;
  const has=d.happy||Object.values(FIELDS).some(f=>d[f].trim());
  try{has?localStorage.setItem(DRAFT_KEY,JSON.stringify(d)):localStorage.removeItem(DRAFT_KEY)}catch(e){}
}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY)}catch(e){}$("dDraftClear").hidden=true}
function restoreDraft(){
  let d=null;try{d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null")}catch(e){}
  if(!d)return;
  $("dDate").value=d.date||key(today());
  for(const [el,f] of Object.entries(FIELDS))$(el).value=d[f]||"";
  happy=Number(d.happy)||0;renderHearts();growAll();
  const dt=fromKey($("dDate").value);
  $("dMsg").textContent=`已恢復 ${dt.getMonth()+1}/${dt.getDate()} 沒寫完的草稿`;$("dDraftClear").hidden=false;
}
$("diaryForm").addEventListener("input",saveDraft);
$("dDraftClear").onclick=()=>{
  const b=$("dDraftClear");
  if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent="再按一次";setTimeout(()=>{delete b.dataset.confirm;b.textContent="清除草稿"},3000);return}
  delete b.dataset.confirm;b.textContent="清除草稿";clearDraft();
  for(const el of Object.keys(FIELDS))$(el).value="";
  $("dDate").value=key(today());happy=0;renderHearts();growAll();$("dMsg").textContent="";
};

// 你不在時：比對這台裝置上次按「知道了」的時間
const SEEN_KEY="love-base-seen";
let seenMs=0;
function initSeen(){
  let v="";try{v=localStorage.getItem(SEEN_KEY)||""}catch(e){}
  if(!v){v=nowIso();try{localStorage.setItem(SEEN_KEY,v)}catch(e){}}
  seenMs=new Date(v).getTime();
}
function renderAway(){
  const card=$("awayCard");
  if(!db||!seenMs){card.hidden=true;return}
  const me=myName(),fresh=x=>x.by&&x.by!==me&&x.at&&new Date(x.at).getTime()>seenMs;
  const groups=[[entries.filter(fresh),n=>`💌 寫了 ${n} 篇日記`,"diary"],[photos.filter(fresh),n=>`📷 傳了 ${n} 張照片`,"photos"],[store.answers.filter(fresh),n=>`🎲 回答了 ${n} 題抽題`,"draw"],[store.wishes.filter(fresh),n=>`🌠 許了 ${n} 個願望`,"wishes"],[store.capsules.filter(fresh),n=>`⏳ 封存了 ${n} 顆膠囊`,"capsule"],[store.replies.filter(fresh).filter(r=>r.kind==="text"&&entries.find(e=>e.id===r.entry)?.by===me),n=>`💬 回應了你的日記（${n}）`,"calendar"],[store.reviews.filter(fresh),()=>"📝 寫了這週回顧","memories"],[store.hugs.filter(fresh),()=>"🤗 來討抱抱","hugCard"],[store.hugs.filter(h=>h.by===me&&h.backBy&&new Date(h.backAt).getTime()>seenMs),()=>"💞 抱了你","hugCard"]].filter(g=>g[0].length&&!layout.hidden.includes(g[2]==="diary"?"quests":g[2]));
  if(!groups.length){card.hidden=true;return}
  const name=groups[0][0][0].by===me?groups[0][0][0].backBy:groups[0][0][0].by;
  card.innerHTML=`<div class="row between"><h3>你不在時，${esc(name)}…</h3><button class="btn ghost" type="button" id="awayOk">知道了</button></div><div class="away-list">${groups.map(g=>`<a href="#${g[2]}">${g[1](g[0].length)}</a>`).join("")}</div>`;
  card.hidden=false;
  $("awayOk").onclick=()=>{const v=nowIso();seenMs=new Date(v).getTime();try{localStorage.setItem(SEEN_KEY,v)}catch(e){}renderAway()};
}

// 討抱抱
function renderHug(){
  const me=myName(),t=x=>{const d=new Date(x);return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
  $("hugCard").hidden=!db;
  const incoming=store.hugs.filter(h=>h.by&&h.by!==me&&!h.backAt).sort(byAt);
  const mine=store.hugs.find(h=>h.by===me&&!h.backAt);
  const back=store.hugs.filter(h=>h.by===me&&h.backAt&&!h.ack).sort(byAt);
  $("hugState").innerHTML=[
    ...incoming.map(h=>`<div class="hug-msg"><div><b>🤗 ${esc(h.by)} 想要抱抱</b>${h.text?`<p>${esc(h.text)}</p>`:""}<small>${t(h.at)}</small></div><button class="btn" type="button" data-hugback="${esc(h.id)}">抱回去 💞</button></div>`),
    ...back.map(h=>`<div class="hug-msg"><div><b>💞 ${esc(h.backBy)} 抱你了！</b><small>${t(h.backAt)}</small></div><button class="btn ghost" type="button" data-hugack="${esc(h.id)}">收到</button></div>`),
    ...(mine?[`<div class="hug-msg"><div><b>🫂 你討抱抱了，等對方回應…</b>${mine.text?`<p>${esc(mine.text)}</p>`:""}</div><button class="btn ghost" type="button" data-hugcancel="${esc(mine.id)}">收回</button></div>`]:[])
  ].join("");
  const busy=incoming.length||back.length||!!mine,showForm=hugOpen&&!mine;
  $("hugState").hidden=!busy;
  $("hugForm").hidden=!showForm;
  $("hugOpen").hidden=showForm||!!mine;
  $("hugCard").classList.toggle("mini",!busy&&!showForm);
  const n=store.hugs.filter(h=>h.backAt).length;
  $("hugN").textContent=n?`已經抱了 ${n} 次`:"";
  $("hugState").querySelectorAll("[data-hugback]").forEach(b=>b.onclick=()=>{updDoc("hugs",b.dataset.hugback,{backBy:me,backAt:nowIso()});toast("抱回去了 💞")});
  $("hugState").querySelectorAll("[data-hugack]").forEach(b=>b.onclick=()=>updDoc("hugs",b.dataset.hugack,{ack:true}));
  $("hugState").querySelectorAll("[data-hugcancel]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.hugcancel,old=store.hugs;store.hugs=old.filter(h=>h.id!==id);renderAll();
    try{await xRef("hugs",id).delete()}catch(e){store.hugs=old;renderAll();toast(NOSAVE)}
  });
}
bindForm("hugForm","hugSave",()=>({c:"hugs",doc:{text:$("hugText").value.trim(),by:myName(),at:nowIso()}}),()=>{$("hugText").value="";hugOpen=false;renderHug();toast("討抱抱送出去了 🤗")});
$("hugForm").addEventListener("keydown",ev=>{if(ev.key==="Enter"&&(ev.isComposing||ev.keyCode===229))ev.preventDefault()});

// 今天還差什麼
function renderTodo(){
  const t=today(),tk=key(t),me=myName(),items=[];
  if(store.hugs.some(h=>h.by&&h.by!==me&&!h.backAt))items.push([false,"🤗 抱抱對方","hugCard"]);
  if(dow(t)===6)items.push([store.reviews.some(r=>r.date===tk&&r.by===me),"📝 寫這週回顧","todayBox"]);
  if(db)items.push([!!myPhoto(tk),"📷 上傳我的照片","diary"]);
  items.push([entries.some(e=>e.by===me&&dayOf(e.at)===tk),"💌 寫今天的日記","diary"]);
  items.push([store.wishes.some(w=>w.by===me&&dayOf(w.at)===tk),"🌠 許個願","wishes"]);
  const r=shownRound(),ans=r?pairOf(r.id):[],answered=ans.some(a=>a.by===me),over=!!r&&ans.length>=need();
  if(r&&!over)items.push(answered?[true,"🎲 已回答抽題，等對方揭曉","draw"]:[false,"🎲 回答抽題","draw"]);
  else if(over&&roundDay(r)===tk)items.push([true,"🎲 今天的抽題過關了","draw"]);
  else if(myTurn())items.push([false,"🎲 今天輪到你抽題","draw"]);
  for(let i=items.length-1;i>=0;i--)if(layout.hidden.includes(["diary","todayBox"].includes(items[i][2])?"quests":items[i][2]))items.splice(i,1);
  const n=items.filter(x=>x[0]).length,all=n===items.length;
  $("todoCard").innerHTML=`<div class="row between"><h3>${all?"今天都完成了 🎉":"今天還差什麼"}</h3><span class="num">${n} / ${items.length}</span></div>${items.map(([ok,label,id])=>`<a class="todo-i ${ok?"ok":""}" href="#${id}"><span class="tick" aria-hidden="true">✓</span>${label}${ok?'<span class="sr-only">（已完成）</span>':""}</a>`).join("")}`;
}
function syncNotices(){$("notices").hidden=["bkNudge","awayCard","dBackfill"].every(id=>$(id).hidden)}
function renderToday(){renderBackupNudge();renderAway();renderHug();renderTodo();syncNotices()}

// 外觀與版面：都存在這台裝置，兩個人可以各自設定
const LAYOUT_KEY="love-base-layout";
const CATS=[{id:"today",secs:["today"]},{id:"diary",secs:["quests"]},{id:"play",secs:["wishes","draw"]},{id:"memory",secs:["calendar","photos","memories","capsule","book"]},{id:"more",secs:["ladder","rules","tools"]}];
const SEC_META={wishes:["願望","🌠"],draw:["抽題","🎲"],calendar:["月曆","📅"],photos:["照片","📷"],memories:["回顧","🕰️"],capsule:["膠囊","⏳"],book:["回憶書","📖"],ladder:["成就","🏆"],rules:["規則","🧸"],tools:["設定","⚙️"]};
const SEC_DEFAULT=Object.keys(SEC_META).filter(id=>id!=="tools");
let view="today";
const lastSub={};
function loadLayout(){
  let v=null;try{v=JSON.parse(localStorage.getItem(LAYOUT_KEY)||"null")}catch(e){}
  const order=(v?.order||[]).filter(id=>SEC_DEFAULT.includes(id));
  return {order:[...order,...SEC_DEFAULT.filter(id=>!order.includes(id))],hidden:(v?.hidden||[]).filter(id=>SEC_DEFAULT.includes(id))};
}
let layout=loadLayout();
function catSecs(c){const rank=id=>{const i=layout.order.indexOf(id);return i<0?99:i};return c.secs.filter(id=>!layout.hidden.includes(id)).sort((a,b)=>rank(a)-rank(b))}
function renderNav(){
  const cur=CATS.find(c=>c.secs.includes(view)),secs=catSecs(cur),sub=$("subNav");
  sub.hidden=secs.length<2;
  sub.innerHTML=secs.length<2?"":secs.map(id=>`<a href="#${id}" aria-current="${id===view}">${SEC_META[id][0]}</a>`).join("");
  document.querySelectorAll("[data-c]").forEach(a=>{const c=CATS.find(x=>x.id===a.dataset.c);a.hidden=!catSecs(c).length;a.setAttribute("aria-current",c===cur)});
}
function applyLayout(){
  layout.order.forEach(id=>{$(id).hidden=layout.hidden.includes(id)});
  if($(view).hidden)setView("today");else renderNav();
}
function renderLayoutList(){
  const box=$("layoutList"),last=layout.order.length-1;
  box.innerHTML=layout.order.map((id,i)=>{
    const [label,ic]=SEC_META[id],off=layout.hidden.includes(id);
    return `<div class="citem ${off?"off":""}"><span>${ic} ${label}</span><div class="layout-acts"><button class="btn ghost" type="button" data-move="-1" data-id="${id}" aria-label="${label} 往前" ${i?"":"disabled"}>↑</button><button class="btn ghost" type="button" data-move="1" data-id="${id}" aria-label="${label} 往後" ${i<last?"":"disabled"}>↓</button><button class="btn ghost" type="button" data-toggle="${id}" aria-pressed="${off}" aria-label="${off?"顯示":"隱藏"} ${label}">${off?"顯示":"隱藏"}</button></div></div>`}).join("");
  box.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.id,d=+b.dataset.move,i=layout.order.indexOf(id);
    layout.order.splice(i,1);layout.order.splice(i+d,0,id);commitLayout();
    box.querySelector(`[data-id="${id}"][data-move="${d}"]`)?.focus();
  });
  box.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.toggle;
    layout.hidden=layout.hidden.includes(id)?layout.hidden.filter(x=>x!==id):[...layout.hidden,id];commitLayout();
    box.querySelector(`[data-toggle="${id}"]`)?.focus();
  });
}
function commitLayout(){try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(layout))}catch(e){}applyLayout();renderLayoutList();renderAll()}
$("layoutReset").onclick=()=>{try{localStorage.removeItem(LAYOUT_KEY)}catch(e){}layout=loadLayout();commitLayout();try{localStorage.removeItem(LAYOUT_KEY)}catch(e){}toast("版面恢復預設了")};
function bindSeg(id,store_,get,apply){
  const seg=$(id),paint=()=>seg.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===get()));
  seg.querySelectorAll("button").forEach(b=>b.onclick=()=>{apply(b.dataset.v);try{localStorage.setItem(store_,b.dataset.v)}catch(e){}paint();renderChart()});
  paint();
}
const R=document.documentElement;
bindSeg("segTheme","love-base-theme",()=>R.dataset.theme||"system",v=>{if(v==="system")delete R.dataset.theme;else R.dataset.theme=v});
bindSeg("segFont","love-base-font",()=>R.dataset.font||"m",v=>{R.dataset.font=v});
applyLayout();
renderLayoutList();

// 一次只顯示一個區塊：底部分頁或側邊欄選分類，分類裡用上方的小標籤切換
function setView(id){
  const sec=$(id);
  if(!sec||sec.hidden||!CATS.some(c=>c.secs.includes(id)))id="today";
  view=id;
  const c=CATS.find(x=>x.secs.includes(id));
  lastSub[c.id]=id;
  document.documentElement.dataset.view=c.id;
  document.querySelectorAll(".wrap>section").forEach(x=>{const on=x.id===id;x.classList.toggle("current",on);x.classList.toggle("open",on)});
  renderNav();
  renderOpen();
}
function openFor(id){
  const el=$(id),sec=el&&el.closest("section");
  if(!sec){setView("today");scrollTo(0,0);return}
  setView(sec.id);
  if(el.tagName==="DETAILS")el.open=true;
  if(el===sec)scrollTo(0,0);else el.scrollIntoView({block:"start"});
}
document.addEventListener("click",ev=>{
  const a=ev.target.closest('a[href^="#"]');if(!a)return;
  ev.preventDefault();
  const c=a.dataset.c&&CATS.find(x=>x.id===a.dataset.c),secs=c&&catSecs(c),id=c?(secs.includes(lastSub[c.id])?lastSub[c.id]:secs[0]):a.getAttribute("href").slice(1);
  openFor(id);
  history.pushState(null,"","#"+id);
});
window.addEventListener("popstate",()=>openFor(location.hash.slice(1)||"today"));

// 今天的日記放在最前面；自己今天寫過就先收起表單，有草稿或正在編輯時一定打開
let diaryFormOpen=false;
function renderDiaryToday(){
  const tk=key(today()),me=myName(),list=entries.filter(e=>e.date===tk).sort(byAt),mine=list.some(e=>e.by===me),theirs=list.some(e=>e.by&&e.by!==me);
  let draft=false;try{draft=!!localStorage.getItem(DRAFT_KEY)}catch(e){}
  $("diaryForm").hidden=!(!mine||diaryFormOpen||editId||draft);
  $("dNew").hidden=!mine||!!editId||draft;
  $("dNew").textContent=diaryFormOpen?"收起":"✏️ 再寫一篇";
  $("diaryN").textContent=`${entries.length} 篇`;
  const box=$("diaryToday");
  box.innerHTML=list.map(e=>`<article class="entry ${e.by?(e.by===me?"me":"them"):""}"><header><div>${byChip(e.by)}</div><span>${e.happy?"⭐ "+esc(e.happy)+"/10":""}</span></header><dl>${[["⛅ 心情",e.mood],["🍜 吃了",e.food],["🤪 最好笑",e.funny],["💞 想對你說",e.say]].filter(r=>r[1]).map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>${(e.s1||e.s2)?`<blockquote>今天雖然${esc(e.s1||"＿＿")}，但因為有你${esc(e.s2||"＿＿")}。</blockquote>`:""}${entryExtras(e,"today",(!e.by||e.by===me)?`<div class="acts"><button class="btn ghost" type="button" data-editday="${esc(e.id)}">✏️ 編輯</button></div>`:"")}</article>`).join("")+(db&&!theirs?'<p class="sub" style="margin:0">對方今天還沒寫。</p>':"");
  attachReply("today");
  box.querySelectorAll("[data-editday]").forEach(b=>b.onclick=()=>startEdit(b.dataset.editday));
  const y=addDays(today(),-1),yk=key(y);let skip="";try{skip=localStorage.getItem(BF_KEY)||""}catch(e){}
  const bf=!!db&&yk>=key(LOVE_START)&&skip!==yk&&!editId&&!draft&&$("dDate").value!==yk&&!entries.some(e=>e.by===me&&e.date===yk);
  $("dBackfill").hidden=!bf;
  if(bf){
    $("dBackfill").innerHTML=`<div class="row between"><span>昨天（${y.getMonth()+1}/${y.getDate()}）的日記還沒寫，要補嗎？</span><div class="row"><button class="btn" type="button" id="bfGo" style="padding:4px 14px;font-size:13px">補寫</button><button class="btn ghost" type="button" id="bfNo" style="padding:4px 14px;font-size:13px">不用了</button></div></div>`;
    $("bfGo").onclick=()=>{diaryFormOpen=true;$("dDate").value=yk;renderDiaryToday();$("dMood").focus()};
    $("bfNo").onclick=()=>{try{localStorage.setItem(BF_KEY,yk)}catch(e){}renderDiaryToday()};
  }
  syncNotices();
}
$("diaryMore").addEventListener("toggle",()=>{if($("diaryMore").open)renderEntries()});
$("dNew").onclick=()=>{diaryFormOpen=!diaryFormOpen;if(!diaryFormOpen)$("dDate").value=key(today());renderDiaryToday()};

// 照片壓縮尺寸：原圖最多約 300KB，放得下原本兩倍以上的張數
const PHOTO_MAX=420000;
const shrinkFull=im=>shrink(im,1280,PHOTO_MAX,.76), shrinkThumb=im=>shrink(im,420,60000,.72);

// 日記照片：一篇最多 9 張，每張存成 photos/pics 各一筆，用 entry 欄位指回日記
const DIARY_PH_MAX=9;
let dQueue=[], diaryUp=null, addTarget=null;
function entryPhotos(id,all){return (all||calAllPhotos()).filter(p=>p.entry===id&&!p.trashed).sort((a,b)=>String(a.at).localeCompare(String(b.at)))}
function renderQueue(){
  const box=$("dPhotos");$("dPhotoBox").hidden=!db||!!photoErr;
  const have=editId?entryPhotos(editId).length:0, room=DIARY_PH_MAX-have-dQueue.length;
  box.innerHTML=dQueue.map((q,i)=>`<div class="qi"><img src="${q.url}" alt=""><button type="button" data-unq="${i}" aria-label="拿掉這張">✕</button></div>`).join("")+(room>0?`<button type="button" class="add" id="dPhotoAdd" aria-label="加照片">＋</button>`:"")+(editId&&have?`<span class="ph-note">這篇已經有 ${have} 張</span>`:"");
}
function clearQueue(){dQueue.forEach(q=>URL.revokeObjectURL(q.url));dQueue=[];renderQueue()}
function pickFiles(files,max){return [...files].filter(f=>/^image\//.test(f.type)||/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name)).slice(0,Math.max(0,max))}
$("dPhotoFile").addEventListener("change",async()=>{
  const files=$("dPhotoFile").files;if(!files||!files.length)return;
  if(addTarget){ // 直接加到已經寫好的日記
    const e=entries.find(x=>x.id===addTarget);addTarget=null;if(!e)return;
    const list=pickFiles(files,DIARY_PH_MAX-entryPhotos(e.id).length);
    if(list.length<files.length)toast(`一篇最多 ${DIARY_PH_MAX} 張，只放前 ${list.length} 張`);
    const n=await uploadQueue(e.id,e.date,list.map(f=>({file:f})));if(n)toast(`加了 ${n} 張照片 📷`);
    return;
  }
  const have=editId?entryPhotos(editId).length:0;
  const list=pickFiles(files,DIARY_PH_MAX-have-dQueue.length);
  if(list.length<files.length)toast(`一篇最多 ${DIARY_PH_MAX} 張`);
  list.forEach(f=>dQueue.push({file:f,url:URL.createObjectURL(f)}));
  renderQueue();
});
document.addEventListener("click",ev=>{
  if(ev.target.closest("#dPhotoAdd")){if(!navigator.onLine){toast("沒有網路，連上後再加照片");return}addTarget=null;$("dPhotoFile").value="";$("dPhotoFile").click();return}
  const u=ev.target.closest("[data-unq]");if(u){const q=dQueue.splice(+u.dataset.unq,1)[0];if(q)URL.revokeObjectURL(q.url);renderQueue();return}
  const a=ev.target.closest("[data-addph]");
  if(a&&!a.disabled){if(!navigator.onLine){toast("沒有網路，連上後再加照片");return}if(diaryUp)return;addTarget=a.dataset.addph;$("dPhotoFile").value="";$("dPhotoFile").click()}
});
async function uploadQueue(entryId,date,list){
  if(!db||!list.length)return 0;
  diaryUp=entryId;renderAll();
  let ok=0;
  for(let i=0;i<list.length;i++){
    $("dMsg").textContent=`上傳照片 ${i+1} / ${list.length}…`;
    try{
      const {im,url}=await loadImg(list[i].file);
      const img=shrinkFull(im),th=shrinkThumb(im);URL.revokeObjectURL(url);
      const id=`${date}_${myName()}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
      const meta={date,by:myName(),th,cap:"",at:new Date().toISOString(),entry:entryId};
      await db.collection("pics").doc(id).set({img,date,by:myName()});
      await db.collection("photos").doc(id).set(meta);
      const it={id,...meta};photos=photos.filter(p=>p.id!==id).concat([it]);calPhotos=calPhotos.filter(p=>p.id!==id).concat([it]);
      ok++;
    }catch(e){toast(e&&e.message==="decode"?"有一張照片讀不到，先跳過":"有一張照片沒傳成功，可以之後再加")}
  }
  (list||[]).forEach(q=>q.url&&URL.revokeObjectURL(q.url));
  $("dMsg").textContent="";diaryUp=null;renderAll();
  return ok;
}

// 回應日記：留言存成獨立資料，不佔日記本身的欄位
const BF_KEY="love-base-backfill-skip";
let replyTo=null;
const replyFormEl=$("replyForm"),replyTextEl=$("replyText");
function entryExtras(e,where,acts=""){
  const me=myName(),rs=store.replies.filter(r=>r.entry===e.id).sort(byAt),texts=rs.filter(r=>r.kind==="text"),all=calAllPhotos(),first=entries.filter(x=>x.date===e.date&&x.by===e.by).sort(byAt)[0]?.id===e.id;
  const own=entryPhotos(e.id,all),phs=[where==="list"&&first?all.find(p=>!p.entry&&p.date===e.date&&p.by===e.by):null,...own].filter(Boolean);
  const canAdd=db&&!photoErr&&e.by===me&&own.length<DIARY_PH_MAX;
  const addBtn=canAdd?`<button type="button" class="btn ghost" data-addph="${esc(e.id)}" ${diaryUp===e.id?"disabled":""}>${diaryUp===e.id?"上傳中…":"📷 加照片"}</button>`:"";
  return `${phs.length?`<div class="wall-grid">${phs.map(p=>photoBtn(p,"")).join("")}</div>`:""}${texts.length?`<div class="replies">${texts.map(r=>`<div class="reply ${r.by===me?"me":""}"><b>${esc(r.by)}</b> ${esc(r.text)}${r.by===me?` <button type="button" class="reply-del" data-replydel="${esc(r.id)}" aria-label="刪除這則回應">✕</button>`:""}</div>`).join("")}</div>`:""}<div class="reply-bar"><button type="button" class="btn ghost" data-reply="${esc(e.id)}" data-where="${where}">💬 回應</button>${addBtn}${acts}</div><div data-replyslot="${where}:${esc(e.id)}"></div>`;
}
function closeReply(){replyTo=null;replyFormEl.hidden=true;document.body.append(replyFormEl)}
function attachReply(where){
  if(!replyTo||replyTo.where!==where)return;
  const slot=document.querySelector(`[data-replyslot="${where}:${replyTo.entry}"]`);
  if(!slot){closeReply();return}
  replyFormEl.hidden=false;slot.append(replyFormEl);replyTextEl.focus({preventScroll:true});
}
async function dropReply(id){
  const old=store.replies;store.replies=old.filter(r=>r.id!==id);renderAll();
  try{db?await xRef("replies",id).delete():saveLocal()}catch(e){store.replies=old;renderAll();toast("刪除失敗")}
}
document.addEventListener("click",ev=>{
  const r=ev.target.closest("[data-reply]");
  if(r){
    if(replyTo&&replyTo.entry===r.dataset.reply&&replyTo.where===r.dataset.where){closeReply();return}
    replyTo={entry:r.dataset.reply,where:r.dataset.where};attachReply(replyTo.where);return;
  }
  const d=ev.target.closest("[data-replydel]");
  if(d){if(d.dataset.confirm)dropReply(d.dataset.replydel);else{d.dataset.confirm=1;d.textContent="確定刪除？"}}
});
bindForm("replyForm","replySend",()=>{const text=replyTextEl.value.trim();return text&&replyTo&&{c:"replies",doc:{entry:replyTo.entry,kind:"text",text,by:myName(),at:nowIso()}}},()=>{replyTextEl.value="";closeReply();toast("回應送出了 💬")});
$("replyForm").addEventListener("keydown",ev=>{if(ev.key==="Enter"&&(ev.isComposing||ev.keyCode===229))ev.preventDefault()});

// 備份提醒：任何一人備份過都算，超過 30 天才提醒，按「之後再說」隔 7 天
const BK_SNOOZE="love-base-backup-snooze";
let dataReady=false;
function renderBackupNudge(){
  const box=$("bkNudge");
  let snooze=0;try{snooze=+localStorage.getItem(BK_SNOOZE)||0}catch(e){}
  const last=store.backups.reduce((a,b)=>String(b.at)>a?String(b.at):a,""),days=last?Math.floor((Date.now()-new Date(last).getTime())/864e5):null;
  const started=entries.reduce((a,e)=>Math.min(a,new Date(e.at).getTime()||a),Date.now());
  if(!db||!dataReady||!entries.length||(days===null&&Date.now()-started<7*864e5)||(days!==null&&days<30)||Date.now()<snooze){box.hidden=true;syncNotices();return}
  box.innerHTML=`<div class="row between"><span>💾 ${days===null?"你們的日記還沒備份過":`已經 ${days} 天沒備份了`}</span><div class="row"><a class="btn" href="#bkBox" style="padding:4px 14px;font-size:13px;text-decoration:none">去備份</a><button class="btn ghost" type="button" id="bkLater" style="padding:4px 14px;font-size:13px">之後再說</button></div></div>`;
  box.hidden=false;
  $("bkLater").onclick=()=>{try{localStorage.setItem(BK_SNOOZE,Date.now()+7*864e5)}catch(e){}renderBackupNudge()};
}

// 照片空間
let packList=[];
const picMsg=t=>$("picMsg").textContent=t;
function loadSrc(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src})}
$("picScan").onclick=async()=>{
  if(!db||!navigator.onLine){picMsg("要連上網路才能檢查。");return}
  $("picPack").hidden=true;$("picScan").disabled=true;picMsg("檢查中…");
  try{
    const s=await db.collection("pics").get();
    let total=0;packList=[];
    s.docs.forEach(d=>{const n=(d.data().img||"").length;total+=n;if(n>PHOTO_MAX*1.15)packList.push(d.id)});
    picMsg(`目前有 ${s.docs.length} 張照片，約 ${(total/1048576).toFixed(1)} MB，免費空間是 1024 MB。${packList.length?"壓縮後畫質會略降，而且無法還原，建議先做完整備份。":"都已經夠小，不用壓縮。"}`);
    if(packList.length){$("picPack").textContent=`壓縮 ${packList.length} 張舊照片`;$("picPack").hidden=false}
  }catch(e){picMsg("檢查失敗，請確認網路後再試一次。")}
  $("picScan").disabled=false;
};
$("picPack").onclick=async()=>{
  const b=$("picPack");
  if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent="無法還原，再按一次開始";return}
  delete b.dataset.confirm;b.disabled=true;
  let ok=0,saved=0;
  try{
    for(const id of packList){
      const snap=await db.collection("pics").doc(id).get(),img=snap.data()?.img;
      if(img){const out=shrinkFull(await loadSrc(img));if(out.length<img.length){await db.collection("pics").doc(id).update({img:out});saved+=img.length-out.length}}
      ok++;picMsg(`壓縮中… ${ok} / ${packList.length}`);
    }
    picMsg(`完成，省下約 ${(saved/1048576).toFixed(1)} MB。`);toast("照片壓縮好了 🗜️");
  }catch(e){picMsg(`壓到第 ${ok} 張時失敗了，已完成的不受影響，可以重新檢查後再壓一次。`)}
  b.disabled=false;b.hidden=true;packList=[];
};

// 年度回憶書：從 11/4 起算，每滿一年是一冊
function bookCount(){let n=1;while(new Date(LOVE_START.getFullYear()+n,LOVE_START.getMonth(),LOVE_START.getDate())<=today())n++;return n}
function renderBook(){
  if(!$("book").classList.contains("open"))return;
  const pick=$("bookYear"),years=bookCount(),keep=+pick.value||years;
  pick.innerHTML=[...Array(years)].map((_,i)=>`<option value="${i+1}">第 ${i+1} 年</option>`).join("");
  pick.value=keep;
  const y0=LOVE_START.getFullYear()+keep-1,m0=LOVE_START.getMonth(),d0=LOVE_START.getDate();
  const from=new Date(y0,m0,d0),to=addDays(new Date(y0+1,m0,d0),-1),a=key(from),b=key(to),inR=k=>String(k)>=a&&String(k)<=b;
  const months=[];for(let d=new Date(y0,m0,1);key(d).slice(0,7)<=b.slice(0,7);d=new Date(d.getFullYear(),d.getMonth()+1,1))months.push(key(d).slice(0,7));
  const nowM=key(today()).slice(0,7);
  months.filter(m=>m<=nowM).forEach(m=>loadCalPhotos(m));
  const es=entries.filter(e=>inR(e.date)).sort((x,y)=>String(x.date).localeCompare(String(y.date))),ps=calAllPhotos().filter(p=>inR(p.date)).sort(byAt);
  if(!es.length&&!ps.length){$("bookBody").innerHTML='<div class="empty">這一年還沒有回憶，寫下第一篇日記吧。</div>';return}
  const rated=es.filter(e=>e.happy),avg=rated.length?(rated.reduce((s,e)=>s+ +e.happy,0)/rated.length).toFixed(1):"—";
  const dayN=Math.round((Math.min(to,today())-from)/864e5)+1;
  const tiles=[["日記",es.length+" 篇"],["照片",ps.length+" 張"],["一起完成",togetherDays().filter(inR).length+" 天"],["達成願望",store.wishes.filter(w=>w.done&&inR(w.doneDate)).length+" 個"],["抽題過關",store.rounds.filter(r=>inR(dayOf(r.at))&&pairOf(r.id).length>=need()).length+" 題"],["抱抱",store.hugs.filter(h=>h.backAt&&inR(dayOf(h.backAt))).length+" 次"],["回應日記",store.replies.filter(r=>r.kind==="text"&&es.some(e=>e.id===r.entry)).length+" 則"],["平均幸福",avg]];
  const say=e=>e.say||((e.s1||e.s2)?`今天雖然${e.s1||"＿＿"}，但因為有你${e.s2||"＿＿"}。`:"")||e.mood||e.funny||"";
  const best=[...rated].sort((x,y)=>y.happy-x.happy||String(y.date).localeCompare(String(x.date)))[0];
  const pages=months.map(m=>{
    const me=es.filter(e=>e.date.startsWith(m)),mp=ps.filter(p=>p.date.startsWith(m));
    if(!me.length&&!mp.length)return "";
    const top=[...me].filter(say).sort((x,y)=>(y.happy||0)-(x.happy||0))[0],fun=me.filter(e=>e.funny).slice(-1)[0],[yy,mm]=m.split("-").map(Number);
    return `<article class="entry book-m"><header><b>${yy} 年 ${mm} 月</b><span>${me.length} 篇日記 · ${mp.length} 張照片</span></header>${mp.length?`<div class="wall-grid">${mp.slice(0,3).map(p=>photoBtn(p,"")).join("")}</div>`:""}${top?`<blockquote>${esc(say(top))}<br><small>${esc(top.by||"")} · ${esc(top.date)}</small></blockquote>`:""}${fun?`<div>🤪 ${esc(fun.funny)}</div>`:""}</article>`;
  }).join("");
  $("bookBody").innerHTML=`<div class="book-cover"><b>第 ${keep} 年</b><span>一起走過 ${dayN} 天</span><span>${a} ～ ${b}</span></div><div class="stats">${tiles.map(([x,v])=>`<div class="stat"><span>${x}</span><b>${v}</b></div>`).join("")}</div>${best?`<div class="note">⭐ 最幸福的一天：${esc(best.date)}（${esc(best.happy)}/10）${esc(say(best))}</div>`:""}${pages}`;
}
$("bookYear").onchange=renderBook;
$("bookPrint").onclick=()=>window.print();

// 離線
const OFFLINE_TEXT="離線中 · 看的是上次的資料";
function showOffline(){if(db&&!navigator.onLine)$("status").textContent=OFFLINE_TEXT}
window.addEventListener("offline",showOffline);
window.addEventListener("online",()=>{if(db)$("status").textContent=dataReady?"● 兩人同步中":"連線中…"});
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});

let hugOpen=false,capEditing=false;
$("hugOpen").onclick=()=>{hugOpen=true;renderHug();$("hugText").focus()};
$("hugClose").onclick=()=>{hugOpen=false;renderHug()};
$("photoCap").addEventListener("keydown",ev=>{if(ev.key==="Enter"&&!ev.isComposing&&ev.keyCode!==229){ev.preventDefault();ev.target.blur()}});
$("photoCap").addEventListener("blur",async()=>{
  capEditing=false;
  const m=myPhoto(key(today())),v=$("photoCap").value.trim();
  if(m&&v!==(m.cap||"")){
    const old=m.cap;m.cap=v;
    try{await commit(db.collection("photos").doc(m.id).update({cap:v}))}catch(e){m.cap=old;toast(NOSAVE)}
  }
  renderTodayPhotos();
});

const bonusSyncing=new Set();
function syncDiaryMarks(){
  if(!db||!dataReady)return;
  [...entries,...trash.diary].filter(e=>e.by&&e.date).sort(byAt).forEach(e=>{
    const id=e.date+"_"+e.by,tag="w"+id;
    if(store.wrote.some(w=>w.id===id)||bonusSyncing.has(tag))return;
    bonusSyncing.add(tag);
    xRef("wrote",id).set({date:e.date,by:e.by,at:e.at}).catch(()=>bonusSyncing.delete(tag));
  });
}
function syncPhotoBonus(){
  if(!db||!dataReady)return;
  photos.filter(p=>!p.entry&&p.by).forEach(p=>{
    const id=p.date+"_"+p.by;
    if(store.bonus.some(b=>b.id===id)||bonusSyncing.has(id))return;
    bonusSyncing.add(id);
    xRef("bonus",id).set({date:p.date,xp:PHOTO_BONUS,by:p.by,at:p.at||nowIso()}).catch(()=>bonusSyncing.delete(id));
  });
}

let reviewEditing=false;
// 週日寫回顧時的參考：這七天的日記和照片
function renderWeekRecap(t){
  const from=key(addDays(t,-6)),to=key(t),inW=d=>String(d)>=from&&String(d)<=to,wk="日一二三四五六";
  const es=entries.filter(e=>inW(e.date)).sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at)),ps=calAllPhotos().filter(p=>inW(p.date)).sort(byAt);
  $("weekRecapN").textContent=`${es.length} 篇日記 · ${ps.length} 張照片`;
  if(!es.length&&!ps.length){$("weekRecapBody").innerHTML='<div class="empty">這週還沒有日記或照片。</div>';return}
  const label=d=>{const x=fromKey(d);return `${x.getMonth()+1}/${x.getDate()}（${wk[x.getDay()]}）`};
  const say=e=>e.say||e.funny||e.mood||e.food||e.s1||e.s2||"";
  const best=es.filter(e=>e.happy).sort((a,b)=>b.happy-a.happy)[0];
  $("weekRecapBody").innerHTML=`${ps.length?`<div class="wall-grid">${ps.slice(0,6).map(p=>photoBtn(p,"")).join("")}</div>${ps.length>6?`<div class="hint left-hint">還有 ${ps.length-6} 張在照片牆</div>`:""}`:""}${best?`<div class="recap-i">⭐ 最幸福的一天：${label(best.date)} ${esc(best.by||"")} ${esc(best.happy)}/10</div>`:""}${es.map(e=>`<div class="recap-i"><b>${label(e.date)}</b>${esc(e.by||"")}：${esc(String(say(e)).slice(0,60))}</div>`).join("")}`;
}
$("reviewForm").addEventListener("submit",async ev=>{
  ev.preventDefault();
  const text=$("reviewText").value.trim();if(!text)return;
  const date=key(today()),me=myName(),id=date+"_"+me,doc={date,by:me,text,at:nowIso()};
  const first=!store.reviews.some(r=>r.id===id),partner=store.reviews.some(r=>r.date===date&&r.by!==me);
  $("reviewSave").disabled=true;
  try{
    if(db)await commit(xRef("reviews",id).set(doc));
    store.reviews=store.reviews.filter(r=>r.id!==id).concat([{id,...doc}]);
    if(!db)saveLocal();
    reviewEditing=false;$("reviewText").value="";renderAll();
    toast(!first?"回顧改好了":partner?`兩個人都寫好了！+${SUNDAY_TASK.xp} XP 📝`:`寫好了 📝 等對方也寫就 +${SUNDAY_TASK.xp} XP`);
  }catch(e){toast(NOSAVE)}
  $("reviewSave").disabled=false;
});

// 收合中的區塊不重畫，展開時才更新
function renderOpen(){
  const open=id=>$(id).classList.contains("open");
  if($("diaryMore").open)renderEntries();
  if(open("photos"))renderWall();
  if(open("calendar"))renderCalendar();
  if(open("wishes"))renderWishes();
  if(open("draw")){renderDraw();renderCustom()}
  if(open("capsule"))renderCapsules();
  if(open("memories"))renderMemories();
  if(open("tools"))renderTrash();
  renderBook();
}
function renderAll(){renderHUD();renderStreak();renderQuests();renderToday();renderDiaryToday();renderOpen();renderQueue()}
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify({done,entries,...store,trash}))}catch(e){toast("這台裝置的儲存空間滿了，剛剛的內容沒有存到")}}
function loadLocal(){try{const s=JSON.parse(localStorage.getItem(LS)||"null");if(s){done=s.done||{};entries=s.entries||[];Object.keys(store).forEach(c=>store[c]=s[c]||[]);if(s.trash)Object.assign(trash,s.trash);delete done["draw-state"]}}catch(e){}}

$("dSearch").addEventListener("input",renderEntries);
$("wSearch").addEventListener("input",renderWishes);
$("lSearch").addEventListener("input",renderLog);
$("filter").querySelectorAll("button").forEach(b=>b.onclick=()=>{who=b.dataset.w;$("filter").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderEntries()});
$("dDate").value=key(today());
$("capDate").min=key(addDays(today(),1));$("capDate").value=key(nextAnniv());
renderHearts();renderAll();renderInstall();showLastBackup();restoreDraft();
openFor(location.hash.slice(1)||"today");

/* ===== 伺服器連線（Firebase） ===== */
const ROOM_KEY="love-base-room";
function getRoom(){try{return localStorage.getItem(ROOM_KEY)||""}catch(e){return ""}}
function showGate(msg){
  $("gate").hidden=false;$("gateMsg").textContent=msg||"";
  $("gateCode").value=getRoom();$("gateName").value=NAMES.includes(myName())?myName():"";syncPick();
  setTimeout(()=>($("gateCode").value?$("gateName"):$("gateCode")).focus(),50);
}
function syncPick(){const v=$("gateName").value.trim();$("namePick").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.n===v))}
$("namePick").querySelectorAll("button").forEach(b=>b.onclick=()=>{$("gateName").value=b.dataset.n;syncPick()});
$("gateName").addEventListener("input",syncPick);
$("gateForm").addEventListener("submit",ev=>{
  ev.preventDefault();
  const code=$("gateCode").value.trim();
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(code)){$("gateMsg").textContent="暗號要 8～64 個字，只能用英文、數字、- 或 _";return}
  const name=$("gateName").value.trim();
  if(!NAMES.includes(name)){$("gateMsg").textContent="請選「寒冰」或「夏夏」，對方才知道是誰寫的";return}
  try{localStorage.setItem(ROOM_KEY,code);localStorage.setItem(NAME_KEY,name)}catch(e){$("gateMsg").textContent="這個瀏覽器不能記住登入資料，可能是無痕模式，請改用一般視窗";return}
  location.reload();
});
$("logout").onclick=()=>{
  const b=$("logout");
  if(!b.dataset.confirm){b.dataset.confirm=1;b.textContent="記得暗號嗎？再按一次登出";setTimeout(()=>{delete b.dataset.confirm;b.textContent="登出"},4000);return}
  try{localStorage.removeItem(ROOM_KEY);localStorage.removeItem(NAME_KEY)}catch(e){}location.reload();
};

(async()=>{
  const configured=FIREBASE_CONFIG.apiKey&&!FIREBASE_CONFIG.apiKey.startsWith("請貼上");
  if(!configured||!window.firebase){local=true;loadLocal();renderAll();$("status").textContent=configured?"連不上伺服器 · 先存在這台裝置":"尚未設定伺服器 · 只存在這台裝置";return}
  const room=getRoom();
  if(!room||!NAMES.includes(myName())){$("status").textContent=room?"請選你是誰":"請輸入你們的暗號";showGate();return}
  $("meLabel").hidden=false;$("meLabel").textContent="你是 "+myName()+" ·";
  firebase.initializeApp(FIREBASE_CONFIG);
  const fs=firebase.firestore();
  fs.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  db=fs.collection("rooms").doc(room);
  showOffline();
  $("logout").hidden=false;
  initSeen();
  let got={done:false,diary:false};
  const timer=setTimeout(()=>{$("status").textContent=navigator.onLine?"暫時連不上，資料可能不是最新":OFFLINE_TEXT},10000);
  const ready=()=>{if(got.done&&got.diary){clearTimeout(timer);$("status").textContent="● 兩人同步中";dataReady=true;renderToday();purgeExpired();syncPhotoBonus();syncDiaryMarks()}};
  db.collection("done").onSnapshot({includeMetadataChanges:true},s=>{done={};Object.keys(store).forEach(c=>store[c]=[]);["wishes","capsules","custom"].forEach(c=>trash[c]=[]);s.docs.forEach(d=>{if(d.id==="draw-state")return;if(d.id.startsWith("x~")){const [,c,id]=d.id.split("~");const v=d.data();if(store[c])(v.trashed?trash[c]:store[c]).push({id,...v});return}done[d.id]=d.data()});if(!s.metadata?.fromCache)got.done=true;ready();renderAll()},()=>{clearTimeout(timer);$("status").textContent="同步中斷，重新整理試試"});
  subPhotos();subPhotoTrash();
  db.collection("diary").onSnapshot({includeMetadataChanges:true},s=>{const all=s.docs.map(d=>({id:d.id,...d.data()}));entries=all.filter(e=>!e.trashed);trash.diary=all.filter(e=>e.trashed);if(!s.metadata?.fromCache)got.diary=true;ready();renderAll()},()=>{clearTimeout(timer);$("status").textContent="同步中斷，重新整理試試"});
})();
