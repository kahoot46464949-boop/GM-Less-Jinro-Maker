const app=document.getElementById("app");

const BASE=[
 {id:"villager",name:"村人",team:"村人陣営",desc:"特殊能力を持たない村人。",abilities:[]},
 {id:"wolf",name:"人狼",team:"人狼陣営",wolfGroup:"wolf",desc:"夜に1人を襲撃する。",abilities:[{trigger:"night",effect:"attack",target:"alive_other",uses:0}]},
 {id:"seer",name:"占い師",team:"村人陣営",desc:"夜に1人を占い、人狼陣営か調べる。",abilities:[{trigger:"night",effect:"divine_team",target:"alive_other",uses:0}]},
 {id:"guard",name:"狩人",team:"村人陣営",desc:"夜に1人を護衛し、襲撃から守る。",abilities:[{trigger:"night",effect:"protect",target:"alive_other",uses:0}]},
 {id:"madman",name:"狂人",team:"人狼陣営",wolfGroup:"madman",desc:"人狼陣営だが、人狼とは別枠。",abilities:[]}
];

const EFFECTS={
 none:{name:"なし"},
 attack:{name:"襲撃",night:true},
 divine_team:{name:"陣営を調査",night:true},
 divine_role:{name:"役職を調査",night:true},
 protect:{name:"護衛",night:true},
 revive:{name:"蘇生",night:true},
 revenge:{name:"道連れ",death:true},
 seal:{name:"能力封印",night:true},
 self_eliminate:{name:"自己脱落",night:true},
 vote_weight_plus:{name:"投票数を+1",passive:true}
};
const TRIGGERS={
 night:"夜",
 game_start:"ゲーム開始時",
 vote:"投票時",
 execution:"処刑時",
 death:"死亡時"
};
const TARGETS={
 self:"自分",
 alive_other:"生存者1人",
 alive_any:"生存者（自分を含む）",
 dead:"死亡者1人",
 random_alive:"ランダムな生存者",
 random_player:"ランダムなプレイヤー",
 all:"全員",
 specific_role:"特定役職のプレイヤー"
};
const WOLF_GROUPS={
 wolf:"人狼系（人狼同士が分かる）",
 madman:"狂人系（人狼とは別枠）"
};
const WIN_CONDITIONS={
 team:"所属陣営の勝利",
 survive:"自分が生存してゲーム終了",
 die:"自分が死亡してゲーム終了",
 executed:"自分が投票で処刑される",
 wolves_dead:"人狼陣営が全滅した時に自分が生存",
 villagers_dead:"村人陣営が全滅した時に自分が生存",
 jackal:"人狼が全滅し、自分と他の1人だけが生存",
 };

let custom=[];try{custom=JSON.parse(localStorage.getItem("jinro_custom_roles")||"[]")}catch{}
custom=custom.map(normalizeRole);

const S={
 screen:"home",players:[],roles:[...BASE,...custom],counts:{},assign:{},reveal:0,
 phase:"",actions:{},votes:{},results:[],winner:null,turn:0,
 sealed:{},pendingDeath:[],gameStarted:false,justRevived:{},revivedThisNight:[],assignCounts:{"村人陣営":0,"人狼陣営":0,"第三陣営":0}
};

function normalizeRole(r){
 const x={...r,abilities:Array.isArray(r.abilities)?r.abilities:[]};
 x.winPriority=x.team==="第三陣営"&&Number.isFinite(+r.winPriority)?+r.winPriority:50;
 x.factionName=x.team==="第三陣営"?(r.factionName||r.name):undefined;
 if(x.team==="人狼陣営"&&!x.wolfGroup)x.wolfGroup="wolf";
 return x;
}
function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function role(id){return S.roles.find(r=>r.id===S.assign[id])}
function alive(){return S.players.filter(p=>p.alive)}
function dead(){return S.players.filter(p=>!p.alive)}
function pname(id){return (S.players.find(p=>p.id===id)||{}).name||"不明"}
function teamClass(t){return t==="人狼陣営"?"red":t==="村人陣営"?"blue":"gold"}
function shell(t,b){app.innerHTML=`<div class="container"><h1>${t}</h1>${b}</div>`}
function go(x){S.screen=x;render()}
function render(){({home,players,roles,dist,game,custom:customScreen,help,assign,result}[S.screen]||home)()}

function home(){
 shell("🐺 人狼メーカー V4.0",`
 <p class="muted">GMなしで、自由な人狼ゲームを。</p>
 <div class="card grid">
  <button id="new">ゲームを作る</button>
  <button class="secondary" id="edit">オリジナル役職を作る</button>
  <button class="secondary" id="help">📖 遊び方・ヘルプ</button>
  <button class="secondary" id="assign">🃏 アサイン（闇鍋）</button>
 </div>
 <div class="card">
  <h3>V4.1.0：ヘルプ＋アサイン配役＋投票数修正</h3>
  <p>オリジナル役職を「発動タイミング × 能力 × 対象 × 使用制限」で作れます。</p>
  <p class="muted small">通常配役と、陣営だけ決めて役職をランダムにするアサイン配役に対応しています。</p>
 </div>`);
 document.getElementById("new").onclick=()=>{S.players=[];S.counts={};S.assign={};S.winner=null;S.gameStarted=false;S.assignCounts={"村人陣営":0,"人狼陣営":0,"第三陣営":0};go("players")};
 document.getElementById("edit").onclick=()=>go("custom");
 document.getElementById("help").onclick=()=>go("help");
 document.getElementById("assign").onclick=()=>go("assign");
}

function players(){
 shell("① プレイヤー登録",`
 <div class="card"><div class="row"><input id="pn" placeholder="プレイヤー名"><button id="add">追加</button></div></div>
 <div class="card grid">${S.players.map(p=>`<div class="player"><span>${esc(p.name)}</span><button class="danger" data-del="${p.id}">削除</button></div>`).join("")||'<p class="muted">まだいません。</p>'}</div>
 <div class="row"><button class="secondary" id="back">戻る</button><button id="next" ${S.players.length<3?"disabled":""}>次へ</button></div>`);
 document.getElementById("add").onclick=()=>{let n=document.getElementById("pn").value.trim();if(!n||S.players.some(p=>p.name===n))return alert("名前が空か、重複しています。");S.players.push({id:(crypto.randomUUID?.()||("p_"+Date.now()+"_"+Math.random().toString(36).slice(2))),name:n,alive:true});players()};
 document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{S.players=S.players.filter(p=>p.id!==b.dataset.del);players()});
 document.getElementById("back").onclick=()=>go("home");document.getElementById("next").onclick=()=>go("roles");
}

function roles(){
 let total=Object.values(S.counts).reduce((a,b)=>a+b,0);
 const groups=[
  ["村人陣営","blue"],
  ["人狼陣営","red"],
  ["第三陣営","gold"]
 ];
 const groupHtml=groups.map(([team,cls])=>{
   const rs=S.roles.filter(r=>r.team===team);
   if(!rs.length)return "";
   return `<section class="role-group ${cls}">
    <h3><span class="team-dot"></span>${team}</h3>
    <div class="grid">${rs.map(r=>`
      <div class="role">
       <div class="desc"><b>${esc(r.name)}</b>
        <div class="muted">${esc(r.desc)}</div>
        ${r.abilities.length?`<div>${r.abilities.map(a=>`<span class="tag">${TRIGGERS[a.trigger]||a.trigger}：${EFFECTS[a.effect]?.name||a.effect}</span>`).join("")}</div>`:""}
       </div>
       <input data-role="${r.id}" type="number" min="0" value="${S.counts[r.id]||0}" style="max-width:90px" aria-label="${esc(r.name)}の人数">
      </div>`).join("")}</div>
   </section>`;
 }).join("");
 shell("② 配役設定",`
 <p class="muted">陣営ごとにまとめています。合計を${S.players.length}人にしてください。</p>
 <div class="card">${groupHtml}</div>
 <p>現在 <b>${total}</b> / ${S.players.length}人</p>
 <div class="row"><button class="secondary" id="back">戻る</button><button class="secondary" id="assign">🃏 アサイン配役</button><button id="start" ${total!==S.players.length?"disabled":""}>役職配布へ</button></div>`);
 document.querySelectorAll("[data-role]").forEach(x=>x.onchange=()=>{S.counts[x.dataset.role]=Math.max(0,+x.value||0);roles()});
 document.getElementById("back").onclick=()=>go("players");
 document.getElementById("assign").onclick=()=>go("assign");
 document.getElementById("start").onclick=()=>{
   let pool=[];for(const [id,n] of Object.entries(S.counts))for(let i=0;i<n;i++)pool.push(id);
   shuffle(pool);startWithPool(pool);
 };
}

function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function startWithPool(pool){
 S.players.forEach((p,i)=>{
   S.assign[p.id]=pool[i];
   p.voteBonus=(role(p.id)?.abilities||[]).filter(a=>a.effect==="vote_weight_plus").length;
   p.alive=true;
 });
 S.reveal=0;S.turn=0;S.phase="";S.actions={};S.votes={};S.results=[];S.winner=null;S.justRevived={};S.revivedThisNight=[];go("dist");
}
function dist(){
 if(S.reveal>=S.players.length){
   S.phase="night";S.actions={};S.sealed={};S.nightReady={};S.justRevived={};S.revivedThisNight=[];S.nightTurnIndex=0;S.nightInfoShown={};S.nightStartCount=0;S.firstNight=true;S.gameStarted=true;
   return game();
 }
 let p=S.players[S.reveal];
 shell("③ 役職確認",`<div class="card center" id="rc"><p>${S.reveal+1} / ${S.players.length}</p><div class="big">${esc(p.name)}</div><p class="muted">本人だけ画面を見てください。</p><button id="show">役職を見る</button></div>`);
 document.getElementById("show").onclick=()=>{let r=role(p.id);document.getElementById("rc").innerHTML=`
 <p>${esc(p.name)}さんの役職</p><div class="big">${esc(r.name)}</div>
 <div class="notice"><b>${esc(r.team)}</b><br>${esc(r.desc)}${r.abilities.length?`<hr>${r.abilities.map(a=>`<div>${esc(TRIGGERS[a.trigger]||a.trigger)}：${esc(EFFECTS[a.effect]?.name||a.effect)} / ${esc(TARGETS[a.target]||a.target)} / ${a.uses===0?"無制限":a.uses+"回"}</div>`).join("")}`:""}</div>
 <button id="ok">確認して次へ</button>`;document.getElementById("ok").onclick=()=>{S.reveal++;dist()}};
}

function check(event=null){
 const a=alive();
 const wolves=a.filter(p=>{const r=role(p.id);return r?.team==="人狼陣営"&&r?.wolfGroup!=="madman";});
 const villagers=a.filter(p=>role(p.id)?.team==="村人陣営");
 const candidates=[];
 const add=(label,priority,key)=>candidates.push({label,priority:Number.isFinite(+priority)?+priority:50,key});

 // 「襲撃能力を持つ非・村人陣営」が2つ以上残っている間は、
 // どの勝利条件が成立していてもゲームを終了しない。
 // 第三陣営は factionName が同じなら同じ陣営として数える。
 const killerFactions=new Set();
 for(const p of a){
   const r=role(p.id);
   if(!r || r.team==="村人陣営") continue;
   if((r.abilities||[]).some(ab=>ab.effect==="attack")){
     const faction=r.team==="人狼陣営"
       ? "wolf:"+(r.wolfGroup||"wolf")
       : "third:"+(r.factionName||r.name);
     killerFactions.add(faction);
   }
 }
 const killerConflict=killerFactions.size>=2;

 // 通常陣営の終了条件。
 const wolfEnd=!killerConflict &&
   wolves.length>0 &&
   wolves.length>=a.filter(p=>!wolves.includes(p)).length;
 const villagerEnd=!killerConflict && wolves.length===0;
 const gameEnded=wolfEnd||villagerEnd;

 if(villagerEnd) add("村人陣営",50,"village");
 if(wolfEnd) add("人狼陣営",50,"wolf");

 // 第三陣営の勝利条件。
 for(const p of S.players){
   const r=role(p.id);
   if(!r || r.team!=="第三陣営") continue;
   const wins=Array.isArray(r.winConditions)?r.winConditions:[];
   if(!wins.length) continue;

   const satisfied=wins.every(w=>{
     if(w==="survive") return gameEnded&&p.alive;
     if(w==="die") return gameEnded&&!p.alive;
     if(w==="executed") return event==="execution"&&S.lastExecuted===p.id;
     if(w==="wolves_dead") return gameEnded&&wolves.length===0&&p.alive;
     if(w==="villagers_dead") return gameEnded&&villagers.length===0&&p.alive;
     // ジャッカル：人狼が残っている2人状態は killerConflict により続行。
     if(w==="jackal") return gameEnded&&a.length===2&&p.alive;
     return false;
   });
   if(satisfied) add(`${p.name}（第三陣営）`,r.winPriority,"third:"+p.id);
 }

 if(!candidates.length) return null;
 const max=Math.max(...candidates.map(x=>x.priority));
 return [...new Map(
   candidates.filter(x=>x.priority===max).map(x=>[x.key,x])
 )].map(x=>x[1].label).join(" ＆ ");
}

function applyGameStartAbilities(){
 const notifications=[];
 for(const p of alive()){
   const r=role(p.id); if(!r)continue;
   r.abilities.forEach((a,i)=>{
     if(a.trigger!=="game_start"||a.effect==="none")return;
     const key=p.id+":"+i;
     if(S.actions[key]?.gameStartDone)return;
     S.actions[key]={...(S.actions[key]||{}),gameStartDone:true,used:(S.actions[key]?.used||0)+1};
     const allTargets=nightTargetable();
     let targets=[];
     if(a.target==="self")targets=[p];
     else if(a.target==="alive_any")targets=nightTargetable();
     else if(a.target==="random_alive"){const pool=nightTargetable();targets=[pool[Math.floor(Math.random()*pool.length)]].filter(Boolean);}
     else if(a.target==="random_player"){const pool=nightTargetable();targets=[pool[Math.floor(Math.random()*pool.length)]].filter(Boolean);}
     else if(a.target==="all")targets=allTargets;
     else if(a.target==="alive_other")targets=nightTargetable().filter(t=>t.id!==p.id);
     else targets=nightTargetable().filter(t=>t.id!==p.id);

     if(a.effect==="reveal_all_roles" || (a.effect==="divine_role"&&a.target==="all")){
       notifications.push({player:p, title:"👁️ ゲーム開始時の能力", html:allTargets.map(t=>`<div><b>${esc(t.name)}</b>：${esc(role(t.id)?.name||"不明")}</div>`).join("")});
     }else if(a.effect==="divine_team"&&a.target==="all"){
       notifications.push({player:p,title:"👁️ ゲーム開始時の能力",html:allTargets.map(t=>`<div><b>${esc(t.name)}</b>：${esc(role(t.id)?.team||"不明")}</div>`).join("")});
     }else if(a.effect==="self_eliminate"){
       killPlayer(p.id,"ゲーム開始時の能力");
     }else if(a.effect==="attack"){
       targets.forEach(t=>killPlayer(t.id,"ゲーム開始時の能力"));
     }else if(a.effect==="revive"){
       targets.forEach(t=>{if(!t.alive){t.alive=true;S.justRevived[t.id]=true;if(!S.revivedThisNight.includes(t.id))S.revivedThisNight.push(t.id);}});
     }else if(a.effect==="seal"){
       targets.forEach(t=>S.sealed[t.id]=true);
     }else if(a.effect==="vote_weight_plus"){
       p.voteBonus=(p.voteBonus||0)+1;
     }else if(a.effect==="revenge"){
       targets.forEach(t=>killPlayer(t.id,"道連れ"));
     }
   });
 }
 S.gameStartNotifications=notifications;
 S.winner=check();
}

function showSequentialNotices(notes,onDone){
 if(!notes.length)return onDone&&onDone();
 const n=notes.shift();
 showNotice(n.title,`<div class="muted small">${esc(n.player.name)}さん本人のみ確認してください。</div><div style="margin-top:14px">${n.html}</div>`,()=>showSequentialNotices(notes,onDone));
}


function help(){
 shell("📖 遊び方・ヘルプ",`
 <div class="card">
  <h3>🎮 基本の遊び方</h3>
  <ol>
   <li><b>プレイヤー登録</b>で参加者を追加します。3人以上で開始できます。</li>
   <li><b>配役設定</b>で各役職の人数を決めます。合計人数を参加者数に合わせます。</li>
   <li><b>役職確認</b>で1人ずつ自分の役職を確認します。画面は本人だけ見てください。</li>
   <li><b>夜</b>は表示されたプレイヤーが順番に自分の能力を処理します。能力がない人も「夜の行動を終了」を押します。</li>
   <li><b>昼</b>に結果を確認して会議を行い、<b>投票</b>で生存者から1人を選びます。</li>
   <li>処刑結果を処理したら次の夜へ進み、勝利条件を満たすまで繰り返します。</li>
  </ol>
  <p class="muted small">人狼メーカーはGMの代わりに進行処理を行います。ゲーム中は、画面に表示された人だけが操作してください。</p>
 </div>

 <div class="card">
  <h3>⚙️ オリジナル役職の作り方</h3>
  <p>役職は <b>陣営 ＋ 能力 ＋ 勝利条件</b> の組み合わせで作ります。</p>
  <div class="notice"><b>① 発動タイミング</b><br>「夜」「ゲーム開始時」「投票時」「処刑時」「死亡時」から選びます。</div>
  <div class="notice"><b>② 能力</b><br>襲撃、占い、護衛、蘇生、道連れ、能力封印、自己脱落などから選びます。<br><span class="muted small">「投票数を+1」はパッシブ能力なので、ゲーム中は自動で効果が適用されます。</span></div>
  <div class="notice"><b>③ 対象</b><br>自分、生存者、死亡者、ランダム対象、全員などから選びます。</div>
  <div class="notice"><b>④ 使用制限</b><br>「無制限」「1回」「2回」「3回」から選びます。夜の能力は、無制限でも同じ夜に同じ能力を何度も選ぶことはできません。</div>
  <p><b>作成例：占い師</b></p>
  <div class="card">発動：夜<br>能力：陣営を調査<br>対象：生存者1人<br>使用制限：無制限</div>
  <p class="muted small">第三陣営は勝利条件と「勝利判定優先度」も設定できます。優先度が高い勝利条件ほど優先して判定されます。</p>
 </div>

 <div class="card">
  <h3>🃏 アサイン（闇鍋）</h3>
  <p>陣営ごとの人数だけを決め、実際の役職はその陣営の中からランダムに選びます。</p>
  <p>例：<b>人狼陣営1・村人陣営4・第三陣営1</b>なら、合計6人をその構成にしてアサインします。</p>
  <p class="muted small">同じ役職が複数人に選ばれることがあります。また、人狼陣営に狂人系しか残らない設定などでは、通常の人狼ゲームと異なる展開になるので注意してください。</p>
 </div>

 <div class="row"><button class="secondary" id="home">ホームへ</button><button id="custom">オリジナル役職を作る</button></div>`);
 document.getElementById("home").onclick=()=>go("home");
 document.getElementById("custom").onclick=()=>go("custom");
}

function assign(){
 const teams=[
  ["村人陣営","blue","村人側の人数"],
  ["人狼陣営","red","人狼側の人数"],
  ["第三陣営","gold","第三陣営の人数"]
 ];
 const total=teams.reduce((sum,[team])=>sum+(+S.assignCounts[team]||0),0);
 const available=Object.fromEntries(teams.map(([team])=>[team,S.roles.filter(r=>r.team===team)]));
 const missing=teams.filter(([team])=>(+S.assignCounts[team]||0)>0&&!available[team].length).map(([team])=>team);

 shell("🃏 アサイン（闇鍋）",`
 <div class="card">
  <p>陣営ごとの人数だけ決めると、各陣営の役職をランダムに割り当てます。</p>
  <p class="muted small">役職は陣営内からランダム抽選・重複あり。保存済みのオリジナル役職も対象です。</p>
  ${teams.map(([team,cls,label])=>`
   <div class="role ${cls}">
    <div class="desc"><b>${team}</b><div class="muted small">${label} / 使用可能な役職 ${available[team].length}種</div></div>
    <input data-ac="${team}" type="number" min="0" max="${S.players.length}" value="${+S.assignCounts[team]||0}" aria-label="${team}の人数">
   </div>`).join("")}
 </div>
 <div class="card center">
  <p>現在 <b>${total}</b> / ${S.players.length}人</p>
  ${missing.length?`<p class="muted">⚠️ ${missing.join("・")}には使用できる役職がありません。</p>`:""}
  <p class="muted small">例：6人なら「村人4・人狼1・第三1」で闇鍋配役にできます。</p>
 </div>
 <div class="row"><button class="secondary" id="back">配役設定へ</button><button id="startAssign" ${total!==S.players.length||missing.length?"disabled":""}>ランダムアサインして役職確認へ</button></div>`);
 document.querySelectorAll("[data-ac]").forEach(el=>el.onchange=()=>{
   S.assignCounts[el.dataset.ac]=Math.max(0,Math.min(S.players.length,+el.value||0));assign();
 });
 document.getElementById("back").onclick=()=>go("roles");
 document.getElementById("startAssign").onclick=()=>{
   const pool=[];
   for(const [team] of teams){
     const n=+S.assignCounts[team]||0,rs=available[team];
     for(let i=0;i<n;i++)pool.push(rs[Math.floor(Math.random()*rs.length)].id);
   }
   shuffle(pool);startWithPool(pool);
 };
}

function customScreen(editId=null){
 const customs=S.roles.filter(r=>!BASE.some(b=>b.id===r.id));
 const editing=editId?S.roles.find(r=>r.id===editId):null;
 shell(editing?"⚙️ オリジナル役職を編集":"⚙️ オリジナル役職作成",`
 <div class="row"><button type="button" class="secondary" id="helpCustom">📖 役職作成ヘルプ</button></div>
 <div class="card">
  <div class="section-title"><h3>① 基本情報</h3></div>
  <div class="grid two">
   <div><label>役職名</label><input id="rn" placeholder="例：猫又"></div>
   <div><label>陣営</label><select id="rt"><option>村人陣営</option><option>人狼陣営</option><option>第三陣営</option></select></div>
   <div id="priorityBox"></div>
   <div id="factionBox"></div>
  </div>
  <div><label>説明</label><textarea id="rd" placeholder="この役職の特徴"></textarea></div>

  <div id="wolfGroupBox"></div>

  <div class="section-title"><h3>② 能力</h3><p class="muted small">能力は最大3個。まずは用意されたパーツを組み合わせます。</p></div>
  <div id="abilities"></div>
  <button class="secondary" id="addAbility">＋ 能力を追加</button>

  <div class="section-title"><h3>③ 第三陣営の勝利条件</h3></div>
  <div id="winBox"></div>
  <div class="row"><button type="button" id="save">この役職を保存</button><button type="button" class="secondary" id="clear">入力をクリア</button></div>
 </div>

 <div class="card"><h3>保存済みオリジナル役職</h3>
 ${customs.map(r=>`<div class="role"><div class="desc"><b>${esc(r.name)}</b> <span class="badge ${teamClass(r.team)}">${esc(r.team)}</span>
 <div class="muted">${esc(r.desc)}</div>${r.abilities.map(a=>`<span class="tag">${esc(TRIGGERS[a.trigger]||a.trigger)}：${esc(EFFECTS[a.effect]?.name||a.effect)}</span>`).join("")}
 ${r.team==="第三陣営"&&r.winConditions?.length?`<div class="small">勝利条件：${r.winConditions.map(x=>esc(WIN_CONDITIONS[x]||x)).join(" / ")}</div>`:""}${r.team==="第三陣営"?`<div class="small">勝利判定優先度：${esc(r.winPriority??50)}</div>`:""}</div>
 <div class="row"><button type="button" class="secondary" data-e="${r.id}">編集</button><button type="button" class="danger" data-c="${r.id}">削除</button></div></div>`).join("")||'<p class="muted">まだありません。</p>'}
 </div>
 <button class="secondary" id="back">ホームへ</button>`);

 let abilityData=editing?.abilities?.map(x=>({...x}))||[];
 if(editing){document.getElementById("rn").value=editing.name;document.getElementById("rt").value=editing.team;document.getElementById("rd").value=editing.desc||"";}
 const renderAbilities=()=>{
   const box=document.getElementById("abilities");
   box.innerHTML=abilityData.map((a,i)=>`
   <div class="ability-box">
    <div class="row"><strong>能力 ${i+1}</strong><button class="danger" data-rm="${i}">削除</button></div>
    <div class="grid two">
      <div><label>いつ発動？</label><select data-a="${i}" data-k="trigger">${Object.entries(TRIGGERS).map(([k,v])=>`<option value="${k}" ${a.trigger===k?"selected":""}>${v}</option>`).join("")}</select></div>
      <div><label>どんな能力？</label><select data-a="${i}" data-k="effect">${Object.entries(EFFECTS).map(([k,v])=>`<option value="${k}" ${a.effect===k?"selected":""}>${v.name}</option>`).join("")}</select></div>
      <div><label>対象</label><select data-a="${i}" data-k="target">${Object.entries(TARGETS).map(([k,v])=>`<option value="${k}" ${a.target===k?"selected":""}>${v}</option>`).join("")}</select></div>
      <div><label>使用制限</label><select data-a="${i}" data-k="uses">
       <option value="0" ${a.uses===0?"selected":""}>無制限</option>
       <option value="1" ${a.uses===1?"selected":""}>1回</option>
       <option value="2" ${a.uses===2?"selected":""}>2回</option>
       <option value="3" ${a.uses===3?"selected":""}>3回</option>
      </select></div>
    </div>
   </div>`).join("") || `<p class="muted">能力なしでもOKです。</p>`;
   box.querySelectorAll("[data-a]").forEach(el=>el.onchange=()=>{let i=+el.dataset.a;let k=el.dataset.k;abilityData[i][k]=k==="uses"?+el.value:el.value;renderAbilities()});
   box.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{abilityData.splice(+b.dataset.rm,1);renderAbilities()});
 };
 renderAbilities();
 document.getElementById("addAbility").onclick=()=>{if(abilityData.length>=3)return alert("能力は最大3個です。");abilityData.push({trigger:"night",effect:"none",target:"alive_other",uses:0});renderAbilities()};
 const updatePriority=()=>{
   const box=document.getElementById("priorityBox"),team=document.getElementById("rt").value;
   if(team!=="第三陣営"){
     box.innerHTML='<div class="card"><b>勝利判定優先度：50（固定）</b><p class="muted small">村人陣営・人狼陣営は通常勝利として50に固定されます。</p></div>';
     return;
   }
   const value=editing?.winPriority??50;
   box.innerHTML=`<div class="card"><label>勝利判定優先度</label><input id="rprio" type="number" min="1" max="999" value="${value}"><p class="muted small">数字が大きいほど優先。50が通常陣営の基準です。</p></div>`;
 };
 const updateFaction=()=>{
   const box=document.getElementById("factionBox");
   const team=document.getElementById("rt").value;
   if(!box)return;
   if(team!=="第三陣営"){box.innerHTML="";return}
   const value=editing?.factionName||editing?.name||"";
   box.innerHTML=`<div class="card"><label>第三陣営名</label><input id="rFaction" value="${esc(value)}" placeholder="例：ジャッカル"><p class="muted small">同じ名前なら同じ第三陣営として扱います。</p></div>`;
 };
 const updateWolfGroup=()=>{
   const box=document.getElementById("wolfGroupBox"),team=document.getElementById("rt").value;
   if(team!=="人狼陣営"){box.innerHTML="";return;}
   const current=editing?.wolfGroup||"wolf";
   box.innerHTML=`<div class="card"><label>人狼陣営内の区分</label><select id="wg"><option value="wolf" ${current==="wolf"?"selected":""}>${WOLF_GROUPS.wolf}</option><option value="madman" ${current==="madman"?"selected":""}>${WOLF_GROUPS.madman}</option></select><p class="muted small">人狼系は互いに分かります。狂人系は人狼系とは別枠で、互いの正体を自動では知りません。</p></div>`;
 };
 const updateWin=()=>{
   const team=document.getElementById("rt").value,box=document.getElementById("winBox");
   if(team!=="第三陣営"){box.innerHTML='<p class="muted">第三陣営ではないため、所属陣営の勝利条件を使用します。</p>';return}
   const selected=new Set(editing?.winConditions||[]);
   box.innerHTML=`<div class="choice-grid">${Object.entries(WIN_CONDITIONS).map(([k,v])=>`<label class="choice"><input type="checkbox" data-win="${k}" ${selected.has(k)?"checked":""}>${v}</label>`).join("")}</div>
   <p class="muted small">複数選択した場合は現在「すべて満たす（AND）」として扱います。</p>`;
 };
 document.getElementById("rt").onchange=()=>{updatePriority();updateFaction();updateWolfGroup();updateWin()};updatePriority();updateFaction();updateWolfGroup();updateWin();
 document.getElementById("save").addEventListener("click",(ev)=>{ev.preventDefault();
   const rnEl=document.getElementById("rn"), rdEl=document.getElementById("rd"), rtEl=document.getElementById("rt"), prioEl=document.getElementById("rprio");
   let name=rnEl.value.trim(),desc=rdEl.value.trim(),team=rtEl.value;
   let winPriority=team==="第三陣営"?Math.max(1,Math.min(999,parseInt(prioEl?.value||50,10))):50;
   let factionName=team==="第三陣営"?(document.getElementById("rFaction")?.value.trim()||name):undefined;
   if(!name)return alert("役職名を入力してください。");
   let wins=[...document.querySelectorAll("[data-win]:checked")].map(x=>x.dataset.win);
   if(team==="第三陣営"&&!wins.length)return alert("第三陣営は勝利条件を1つ以上選んでください。");
   const wolfGroup=team==="人狼陣営"?(document.getElementById("wg")?.value||"wolf"):undefined;
   if(editing){
     editing.name=name;editing.team=team;editing.desc=desc||"オリジナル役職";editing.abilities=abilityData.map(x=>({...x}));editing.winConditions=team==="第三陣営"?wins:["team"];editing.winPriority=winPriority;
     if(team==="第三陣営")editing.factionName=factionName;else delete editing.factionName;
     if(team==="人狼陣営")editing.wolfGroup=wolfGroup;else delete editing.wolfGroup;
   }else{
     let r={id:"custom_"+Date.now(),name,team,wolfGroup:team==="人狼陣営"?wolfGroup:undefined,desc:desc||"オリジナル役職",abilities:abilityData.map(x=>({...x})),winConditions:team==="第三陣営"?wins:["team"],winPriority,factionName};
     S.roles.push(r);
   }
   saveCustoms();customScreen();
 });
 document.getElementById("clear").onclick=()=>customScreen();
 document.querySelectorAll("[data-e]").forEach(b=>b.addEventListener("click",ev=>{
   ev.preventDefault(); ev.stopPropagation(); customScreen(b.dataset.e);
 }));
 document.querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click",ev=>{
   ev.preventDefault(); ev.stopPropagation();
   S.roles=S.roles.filter(r=>r.id!==b.dataset.c); saveCustoms(); customScreen();
 }));
 const backHome=document.getElementById("back");
 if(backHome) backHome.addEventListener("click",ev=>{ev.preventDefault();go("home")});
 const helpCustom=document.getElementById("helpCustom");
 if(helpCustom) helpCustom.addEventListener("click",ev=>{ev.preventDefault();go("help")});
}
function saveCustoms(){localStorage.setItem("jinro_custom_roles",JSON.stringify(S.roles.filter(r=>!BASE.some(b=>b.id===r.id))))}

function game(){
 if(S.winner)return result();
 if(S.phase==="night")return night();
 if(S.phase==="day")return day();
 if(S.phase==="vote")return vote();
}

function availableAbilities(playerId,trigger){
 const r=role(playerId);if(!r)return[];
 return r.abilities.filter((a,i)=>{
   if(a.trigger!==trigger||a.effect==="none"||EFFECTS[a.effect]?.passive||S.sealed[playerId])return false;
   const key=playerId+":"+i;
   const used=S.actions[key]?.used||0;
   // 「無制限」はゲーム全体ではなく、1夜ごとの使用制限なし。
   // 夜に1回選択した能力は、その夜は再選択できない。
   if(trigger==="night") return !S.actions[key]?.actedThisNight && (a.uses===0 || used<a.uses);
   return a.uses===0 || used<a.uses;
 });
}

function night(){
 if(S.winner)return result();
 const living=alive().filter(p=>!S.justRevived[p.id]);
 if(!living.length)return resolveNight();
 const p=living.find(x=>!S.nightReady[x.id]);
 if(!p)return resolveNight();

 // 最初の夜だけ、人狼は人狼同士を確認する。
 if(S.firstNight && role(p.id)?.team==="人狼陣営" && role(p.id)?.wolfGroup!=="madman" && !S.wolfInfoShown?.[p.id]){
   S.wolfInfoShown=S.wolfInfoShown||{};
   S.wolfInfoShown[p.id]=true;
   const wolves=living.filter(x=>role(x.id)?.team==="人狼陣営" && role(x.id)?.wolfGroup!=="madman").map(x=>x.name);
   return showPrivateTurnStart(p,()=>showNotice("🐺 人狼仲間",`あなた以外の人狼系役職：<b>${esc(wolves.filter(n=>n!==p.name).join("、")||"なし")}</b>`,()=>processGameStartForPlayer(p)));
 }
 return showPrivateTurnStart(p,()=>processGameStartForPlayer(p));
}

function showPrivateTurnStart(p,onYes){
 showYesNotice("🌙 夜のターン",`<b>${esc(p.name)}さんですか？</b><br><span class="muted small">本人だけ確認して「はい」を押してください。</span>`,onYes);
}

function processGameStartForPlayer(p){
 const r=role(p.id);
 const notes=[];
 if(S.firstNight && r){
   r.abilities.forEach((a,i)=>{
     if(a.trigger!=="game_start"||a.effect==="none")return;
     const key=p.id+":"+i;
     if(S.actions[key]?.gameStartDone)return;
     S.actions[key]={...(S.actions[key]||{}),gameStartDone:true,used:(S.actions[key]?.used||0)+1};
     const all=nightTargetable();
     if(a.effect==="reveal_all_roles" || (a.effect==="divine_role"&&a.target==="all")){
       notes.push({title:"👁️ ゲーム開始時の能力",html:all.map(t=>`<div><b>${esc(t.name)}</b>：${esc(role(t.id)?.name||"不明")}</div>`).join("")});
     }else if(a.effect==="reveal_all_teams" || (a.effect==="divine_team"&&a.target==="all")){
       notes.push({title:"👁️ ゲーム開始時の能力",html:all.map(t=>`<div><b>${esc(t.name)}</b>：${esc(role(t.id)?.team||"不明")}</div>`).join("")});
     }else if(a.effect==="self_eliminate")killPlayer(p.id,"ゲーム開始時の能力");
   });
 }
 const next=()=>nightAbilityScreen(p);
 if(notes.length)return showSequentialNotices(notes.map(n=>({...n,player:p})),next);
 next();
}

function nightAbilityScreen(p){
 const abilities=availableAbilities(p.id,"night");
 if(!abilities.length){
   shell("🌙 夜",`<div class="card center"><p>${esc(p.name)}さん</p><h2>${esc(role(p.id)?.name||"役職不明")}</h2><p>今夜使用できる能力はありません。</p><button id="done">夜の行動を終了</button></div>`);
   document.getElementById("done").onclick=()=>{S.nightReady[p.id]=true;game()};
   return;
 }
 shell("🌙 夜",`<div class="card center"><p>${esc(p.name)}さん</p><h2>${esc(role(p.id)?.name||"役職不明")}</h2><p>使用する能力を選んでください。</p></div>
 <div class="card grid">${abilities.map((a,idx)=>`<button class="secondary" data-ability="${idx}">${esc(EFFECTS[a.effect]?.name||a.effect)}</button>`).join("")}<button id="done" class="secondary">能力を使わず終了</button></div>`);
 document.querySelectorAll("[data-ability]").forEach(b=>b.onclick=()=>nightChooseTarget(p,abilities[+b.dataset.ability]));
 document.getElementById("done").onclick=()=>{S.nightReady[p.id]=true;game()};
}

function nightTargetable(){return alive().filter(t=>!S.justRevived[t.id]);}

function nightChooseTarget(p,a){
 let targets=[];
 if(a.target==="self")targets=[p];
 else if(a.target==="alive_other")targets=nightTargetable().filter(t=>t.id!==p.id);
 else if(a.target==="alive_any")targets=nightTargetable();
 else if(a.target==="dead")targets=dead();
 else if(a.target==="random_alive")targets=[...nightTargetable()];
 else if(a.target==="random_player")targets=[...S.players];
 else if(a.target==="all")targets=[...nightTargetable()];
 else targets=nightTargetable().filter(t=>t.id!==p.id);
 if(a.effect==="self_eliminate")targets=[p];
 if(["random_alive","random_player"].includes(a.target)){
   targets=[targets[Math.floor(Math.random()*targets.length)]].filter(Boolean);
 }
 if(a.target==="all")return performNight({p,a,key:p.id+":"+p.roleIndex},null,targets);
 if(!targets.length){return showNotice("🌙 対象なし","この能力の対象がいません。",()=>game());}
 shell("🌙 夜",`<div class="card center"><p>${esc(p.name)}さん</p><h2>${esc(EFFECTS[a.effect]?.name||a.effect)}</h2><p>対象を選んでください。</p></div><div class="card grid">${targets.map(t=>`<button class="secondary" data-nt="${t.id}">${esc(t.name)}</button>`).join("")}</div><button id="cancel" class="secondary">戻る</button>`);
 document.querySelectorAll("[data-nt]").forEach(b=>b.onclick=()=>performNight({p,a,key:p.id+":"+p.roleIndex},b.dataset.nt));
 document.getElementById("cancel").onclick=()=>night();
}


function showYesNotice(title,message,onYes){
 const el=document.createElement("div");
 el.className="toast-overlay";
 el.innerHTML=`<div class="toast-card"><div class="big toast-title">${title}</div><div class="toast-message">${message}</div><button id="yesBtn">はい</button></div>`;
 document.body.appendChild(el);
 document.getElementById("yesBtn").onclick=()=>{el.remove();onYes&&onYes();};
}
function showNotice(title,message,onClose){
 const el=document.createElement("div");
 el.className="toast-overlay";
 el.innerHTML=`<div class="toast-card"><div class="big toast-title">${title}</div><div class="toast-message">${message}</div><button id="toastOk">確認</button></div>`;
 document.body.appendChild(el);
 document.getElementById("toastOk").onclick=()=>{el.remove();if(onClose)onClose();};
}

function performNight(x,targetId,allTargets=null){
 const a=x.a;
 const idx=role(x.p.id)?.abilities.indexOf(a)??0;
 const key=x.p.id+":"+idx;
 S.actions[key]={...(S.actions[key]||{}),used:(S.actions[key]?.used||0)+1,actedThisNight:true,type:a.effect,target:targetId,targets:allTargets,actor:x.p.id};
 if(a.effect==="self_eliminate")killPlayer(x.p.id,"自己脱落");
 else if(a.effect==="attack"){
   if(allTargets)S.actions[key].targets=allTargets.map(t=>t.id); else S.actions[key].attack=true;
 }
 else if(a.effect==="protect")S.actions[key].protect=true;
 else if(a.effect==="divine_team"){
   const ids=allTargets?allTargets.map(t=>t.id):[targetId];
   S.actions[key].result=ids.map(id=>`${pname(id)}は${role(id).team==="人狼陣営"?"人狼陣営":"人狼陣営ではありません"}`).join(" / ");
   return showNotice("🔮 占い結果",ids.map(id=>`<b>${esc(pname(id))}</b>：<b>${esc(role(id).team==="人狼陣営"?"人狼陣営":"人狼陣営ではありません")}</b>`).join("<br>"),()=>{S.nightReady[x.p.id]=true;game()});
 }
 else if(a.effect==="divine_role"||a.effect==="reveal_all_roles"){
   const ids=allTargets?allTargets.map(t=>t.id):[targetId];
   S.actions[key].result=ids.map(id=>`${pname(id)}の役職は「${role(id).name}」`).join(" / ");
   return showNotice("🔮 役職情報",ids.map(id=>`<b>${esc(pname(id))}</b>：<b>「${esc(role(id).name)}」</b>`).join("<br>"),()=>{S.nightReady[x.p.id]=true;game()});
 }
 else if(a.effect==="revive"){
   (allTargets||[S.players.find(p=>p.id===targetId)]).filter(Boolean).forEach(t=>{
     if(!t.alive){
       t.alive=true;
       S.justRevived[t.id]=true;
       if(!S.revivedThisNight.includes(t.id))S.revivedThisNight.push(t.id);
     }
   });
 }
 else if(a.effect==="seal"){
   (allTargets||[S.players.find(p=>p.id===targetId)]).filter(Boolean).forEach(t=>S.sealed[t.id]=true);
 }
 else if(a.effect==="revenge"){
   (allTargets||[S.players.find(p=>p.id===targetId)]).filter(Boolean).forEach(t=>killPlayer(t.id,"道連れ"));
 }
 else if(a.effect==="vote_weight_plus")x.p.voteBonus=(x.p.voteBonus||0)+1;
 S.nightReady[x.p.id]=true;
 game();
}

function killPlayer(id,reason){
 const p=S.players.find(x=>x.id===id);
 if(!p||!p.alive)return;
 p.alive=false;
 S.lastDead=id;
 S.results.push(`${p.name}が${reason}になりました。`);
 // Death-trigger abilities are handled immediately.
 for(const a of availableAbilities(id,"death")){
   if(a.effect==="revenge"){
     const targets=nightTargetable().filter(t=>t.id!==id);
     if(targets.length){const t=targets[Math.floor(Math.random()*targets.length)];t.alive=false;S.results.push(`${p.name}の道連れで${t.name}が死亡しました。`)}
   }
 }
}

function resolveNight(){
 const acts=Object.values(S.actions).filter(a=>a.actor);
 const attacks=acts.filter(a=>a.attack&&a.target);
 const guards=new Set(acts.filter(a=>a.protect&&a.target).map(a=>a.target));
 const before=new Set(alive().map(p=>p.id));
 for(const a of attacks){
   if(!guards.has(a.target))killPlayer(a.target,"襲撃");
 }
 const deaths=S.players.filter(p=>before.has(p.id)&&!p.alive);
 const revived=(S.revivedThisNight||[]).map(id=>S.players.find(p=>p.id===id)).filter(Boolean);
 S.results=deaths.length?deaths.map(p=>`${p.name}が死亡しました。`):["昨夜、死亡した人はいませんでした。"];
 if(revived.length) S.results.push(...revived.map(p=>`${p.name}が復活しました。`));
 S.actions={};S.sealed={};S.winner=check();
 if(S.winner)return result();
 S.phase="day";
 showReport("🌅 朝になりました",S.results,()=>game());
}

function day(){
 shell("☀️ 昼",`
 <div class="card">${S.results.map(x=>`<div class="result-line">${esc(x)}</div>`).join("")}</div>
 <div class="card grid">${alive().map(p=>`<div class="player"><span>${esc(p.name)}</span><span class="badge">生存</span></div>`).join("")}</div>
 <button id="vote">投票へ</button>`);
 document.getElementById("vote").onclick=()=>{
   const lines=["会議を開始します。"];
   showReport("🗣️ 会議開始",lines,()=>{
     S.phase="vote";S.votes={};
     // 「蘇生直後」の状態はこの会議開始をもって終了。次の夜から通常通り対象・ターンになる。
     S.justRevived={};S.revivedThisNight=[];
     game();
   });
 }
}

function vote(){
 let p=alive().find(x=>!S.votes[x.id]);
 if(!p)return resolveVote();
 shell("🗳️ 投票",`
 <div class="card center"><p>${esc(p.name)}さんの投票</p><p class="muted">自分自身にも投票できます。</p></div>
 <div class="card grid">${alive().map(t=>`<button class="secondary" data-v="${t.id}">${esc(t.name)}</button>`).join("")}</div>`);
 document.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{S.votes[p.id]=b.dataset.v;game()});
}

function resolveVote(){
 let c={};
 for(const [voter,target] of Object.entries(S.votes)){
   const bonus=S.players.find(p=>p.id===voter)?.voteBonus||0;
   c[target]=(c[target]||0)+1+bonus;
 }
 let max=Math.max(...Object.values(c)),top=Object.keys(c).filter(x=>c[x]===max);
 if(top.length===1){
   let p=S.players.find(x=>x.id===top[0]);
   S.lastExecuted=p.id;p.alive=false;S.results=[`${p.name}が処刑されました。`];
   for(const a of role(p.id)?.abilities||[]){
     if(a.trigger==="execution"&&a.effect==="revenge"){
       let ts=alive().filter(t=>t.id!==p.id);if(ts.length){let t=ts[Math.floor(Math.random()*ts.length)];t.alive=false;S.results.push(`${p.name}の能力で${t.name}が道連れになりました。`);}
     }
   }
 }else S.results=["同票のため、誰も処刑されません。"];
 S.winner=check("execution");
 if(S.winner)return showReport("⚰️ 処刑結果",S.results,()=>result());
 showReport("⚰️ 処刑結果",S.results,()=>{S.phase="night";S.actions={};S.sealed={};S.nightReady={};S.justRevived={};S.revivedThisNight=[];S.firstNight=false;S.wolfInfoShown={};game()});
}

function showReport(title,lines,onClose){
 const el=document.createElement("div");
 el.className="toast-overlay report-overlay";
 el.innerHTML=`<div class="toast-card"><div class="big toast-title">${title}</div><div class="toast-message">${lines.map(x=>`<div class="result-line">${esc(x)}</div>`).join("")}</div><button id="reportOk">次へ</button></div>`;
 document.body.appendChild(el);
 document.getElementById("reportOk").onclick=()=>{el.remove();onClose&&onClose();};
}

function result(){
 shell("🏆 ゲーム終了",`
 <div class="card center"><div class="big">${esc(S.winner)}の勝利！</div>
 ${S.players.map(p=>`<div class="player"><span>${esc(p.name)} ${p.alive?"（生存）":"（死亡）"}</span><span class="badge">${esc(role(p.id)?.name||"不明")}</span></div>`).join("")}</div>
 <button id="home">ホームへ</button>`);
 document.getElementById("home").onclick=()=>go("home");
}
if("serviceWorker" in navigator && (location.protocol==="http:"||location.protocol==="https:")){
  navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}
render();
