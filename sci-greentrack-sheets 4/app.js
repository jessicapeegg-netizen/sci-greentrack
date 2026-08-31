const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const RESOURCE_META = {
  electricity:{name:'ไฟฟ้า', icon:'⚡', unit:'kWh', goodDirection:'down'},
  water:{name:'น้ำประปา', icon:'💧', unit:'m³', goodDirection:'down'},
  general_waste:{name:'ขยะทั่วไป', icon:'🗑', unit:'kg', goodDirection:'down'},
  recycle:{name:'ขยะรีไซเคิล', icon:'♻', unit:'kg', goodDirection:'up'},
  organic:{name:'ขยะย่อยสลาย', icon:'🌿', unit:'kg', goodDirection:'down'},
  hazardous:{name:'ขยะอันตราย', icon:'☣', unit:'kg', goodDirection:'down'},
  diesel:{name:'น้ำมันดีเซล', icon:'⛽', unit:'L', goodDirection:'down'},
  gasoline:{name:'น้ำมันเบนซิน', icon:'🚗', unit:'L', goodDirection:'down'},
  ghg:{name:'ก๊าซเรือนกระจก', icon:'🌍', unit:'kgCO₂e', goodDirection:'down'}
};
const ANALYTIC_KEYS = Object.keys(RESOURCE_META).filter(k=>k!=='ghg');
const STORE_KEY='sciGreenTrackV1';
const y2565 = {
  electricity:[10120,10380,10940,11860,11350,10740,11220,11580,10680,10420,10210,10970],
  water:[310,325,342,366,350,328,340,352,331,318,309,321],
  general_waste:[430,445,460,478,451,439,448,465,442,421,416,428],
  recycle:[105,112,118,121,115,110,124,126,120,117,114,119],
  organic:[168,172,184,190,178,176,181,186,175,170,166,171],
  hazardous:[12,9,13,11,10,8,12,9,11,8,10,9],
  diesel:[94,102,96,110,105,98,103,107,99,96,92,97],
  gasoline:[68,72,70,79,76,71,75,77,73,69,67,70],
  ghg:[6250,6390,6650,7200,6890,6500,6780,7010,6520,6310,6190,6540]
};
const y2566 = {
  electricity:[9620,9870,10410,10960,10620,10080,10340,10820,10020,9760,9580,10110],
  water:[296,310,326,342,331,309,315,329,310,299,294,305],
  general_waste:[402,416,428,438,420,405,414,426,409,395,387,399],
  recycle:[118,122,130,135,129,126,138,142,134,130,128,132],
  organic:[155,160,168,174,166,158,163,171,161,157,151,158],
  hazardous:[10,8,9,9,8,7,9,8,8,7,8,7],
  diesel:[88,93,90,96,92,89,91,94,88,86,84,87],
  gasoline:[63,67,65,70,68,64,66,69,65,62,61,63],
  ghg:[5900,6040,6250,6590,6420,6120,6230,6510,6100,5940,5820,6060]
};

function seedRecords(){
  const rows=[];
  [[2565,y2565],[2566,y2566]].forEach(([year,data])=>{
    Object.entries(data).forEach(([resource,vals])=>vals.forEach((amount,month)=>rows.push({id:crypto.randomUUID(),year,month:month+1,resource,amount,building:'คณะวิทยาศาสตร์และเทคโนโลยี',source:'ข้อมูลสาธิต',note:'Demo only',createdAt:new Date().toISOString()})));
  });
  return rows;
}
function defaultState(){return {demo:true,records:seedRecords(),targets:[{year:2566,percent:10,note:'เป้าหมายสาธิต'}],actions:[{id:crypto.randomUUID(),title:'ลดเวลาการเปิดเครื่องปรับอากาศนอกช่วงใช้งาน',resource:'electricity',owner:'งานอาคารสถานที่',start:'2023-01-01',end:'2023-12-31',reduction:5,status:'กำลังดำเนินการ',detail:'ตรวจสอบตารางใช้งานห้องและปิดอุปกรณ์เมื่อไม่มีการใช้งาน'}],emissionFactors:{}}}
let state=loadState();
let selectedYear=2566, selectedResource='electricity';
let charts={};
let cloudMode=false;
let currentProfile=null;
let currentRole='admin';
let authSubscription=null;
let bootingCloud=false;
function isAdmin(){return currentRole==='admin'}
function loadState(){try{const v=JSON.parse(localStorage.getItem(STORE_KEY));return v&&v.records?v:defaultState()}catch{return defaultState()}}
function saveState(){if(!cloudMode)localStorage.setItem(STORE_KEY,JSON.stringify(state));}
function fmt(n,d=0){return Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d})}
function total(year,res){return state.records.filter(r=>Number(r.year)===Number(year)&&r.resource===res).reduce((s,r)=>s+Number(r.amount||0),0)}
function monthly(year,res){return Array.from({length:12},(_,i)=>state.records.filter(r=>Number(r.year)===Number(year)&&r.resource===res&&Number(r.month)===i+1).reduce((s,r)=>s+Number(r.amount||0),0))}
function pct(current,prev){return prev?((current-prev)/prev*100):0}
function getYears(){return [...new Set(state.records.map(r=>Number(r.year)))].sort((a,b)=>a-b)}
function resourceStatus(key,change){const good=RESOURCE_META[key].goodDirection==='up'?change>=0:change<=0; const abs=Math.abs(change); if(good)return {cls:'good',label:`ดี ${change>=0?'+':''}${change.toFixed(1)}%`}; if(abs<5)return {cls:'warning',label:`เฝ้าระวัง +${change.toFixed(1)}%`}; return {cls:'critical',label:`ต้องดำเนินการ +${change.toFixed(1)}%`}}
function yearOptions(){let years=getYears();if(!years.length)years=[2569];const sel=document.getElementById('globalYear');if(!years.includes(selectedYear))selectedYear=years.at(-1)||2569;sel.innerHTML=years.map(y=>`<option value="${y}" ${y===selectedYear?'selected':''}>${y}</option>`).join('');sel.value=selectedYear}
function destroyChart(k){delete charts[k]}
function chartOrMessage(canvasId, config, key){
  destroyChart(key);
  const canvas=document.getElementById(canvasId); if(!canvas)return;
  const rect=canvas.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2);
  const W=Math.max(420,rect.width||720), H=Math.max(260,rect.height||290);
  canvas.width=W*dpr; canvas.height=H*dpr; const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H); ctx.font='11px Tahoma, sans-serif'; ctx.fillStyle='#71827c'; ctx.strokeStyle='#e3ebe7'; ctx.lineWidth=1;
  const labels=config.data.labels||[]; const datasets=config.data.datasets||[]; const pad={l:55,r:20,t:24,b:50}; const cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
  const values=datasets.flatMap(d=>(d.data||[]).map(Number)).filter(Number.isFinite); let min=Math.min(...values,0), max=Math.max(...values,1);
  if(config.type==='line' && min>0) min*=0.92; if(max===min)max=min+1; const range=max-min;
  // horizontal grid + y labels
  for(let i=0;i<=4;i++){const y=pad.t+ch*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();const val=max-range*i/4;ctx.fillStyle='#71827c';ctx.textAlign='right';ctx.fillText(new Intl.NumberFormat('th-TH',{notation:'compact',maximumFractionDigits:1}).format(val),pad.l-8,y+4)}
  // x labels
  labels.forEach((lab,i)=>{const x=pad.l+(labels.length===1?cw/2:cw*i/Math.max(1,labels.length-1));ctx.textAlign='center';ctx.fillStyle='#71827c';ctx.fillText(String(lab),x,H-26)});
  const palette=['#8ba39a','#0b7a53','#94c83d','#173b4b'];
  if(config.type==='bar'){
    const groups=labels.length, series=datasets.length, groupW=cw/groups*0.72, barW=groupW/Math.max(series,1);
    datasets.forEach((d,di)=>{ctx.fillStyle=palette[di%palette.length];d.data.forEach((v,i)=>{v=Number(v)||0;const x=pad.l+cw*(i+.5)/groups-groupW/2+di*barW;const h=(v-min)/range*ch;ctx.fillRect(x,pad.t+ch-h,Math.max(3,barW-4),h)})});
  }else{
    datasets.forEach((d,di)=>{ctx.strokeStyle=palette[di%palette.length];ctx.fillStyle=palette[di%palette.length];ctx.lineWidth=di===datasets.length-1?3:2;ctx.beginPath();d.data.forEach((v,i)=>{v=Number(v)||0;const x=pad.l+(labels.length===1?cw/2:cw*i/Math.max(1,labels.length-1));const y=pad.t+ch-(v-min)/range*ch;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();d.data.forEach((v,i)=>{v=Number(v)||0;const x=pad.l+(labels.length===1?cw/2:cw*i/Math.max(1,labels.length-1));const y=pad.t+ch-(v-min)/range*ch;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill()})});
  }
  // legend
  let lx=pad.l; datasets.forEach((d,di)=>{ctx.fillStyle=palette[di%palette.length];ctx.fillRect(lx,H-12,12,3);ctx.fillStyle='#71827c';ctx.textAlign='left';ctx.fillText(d.label||'',lx+18,H-8);lx+=70});
  charts[key]={canvasId,config};
}
function deltaBadge(change,key){const st=resourceStatus(key,change);return `<span class="delta ${st.cls==='good'?'good':st.cls==='critical'?'bad':'neutral'}">${change>=0?'+':''}${change.toFixed(1)}%</span>`}
function updateDemoUI(){const badge=document.getElementById('demoBadge'),notice=document.getElementById('demoNotice');if(cloudMode){badge.textContent='Google Sheets';badge.className='badge';notice.style.display='none'}else{badge.textContent=state.demo?'ข้อมูลสาธิต':'ข้อมูลในเครื่อง';badge.className='badge '+(state.demo?'demo':'');notice.style.display=state.demo?'flex':'none'}}
function renderDashboard(){
  const prev=selectedYear-1;
  const keys=['electricity','water','general_waste','ghg'];
  document.getElementById('kpiGrid').innerHTML=keys.map(k=>{const c=total(selectedYear,k),p=total(prev,k),ch=pct(c,p),m=RESOURCE_META[k];return `<article class="kpi-card"><div class="kpi-top"><div class="kpi-icon">${m.icon}</div>${deltaBadge(ch,k)}</div><div class="kpi-label">${m.name}</div><div class="kpi-value">${fmt(c,k==='ghg'?0:1)}<span class="kpi-unit">${m.unit}</span></div></article>`}).join('');
  const scoreKeys=['electricity','water','general_waste','diesel','gasoline','ghg'];let good=0;scoreKeys.forEach(k=>{if(resourceStatus(k,pct(total(selectedYear,k),total(prev,k))).cls==='good')good++});const score=Math.round(55+45*(good/scoreKeys.length));document.getElementById('greenScore').textContent=score;document.getElementById('greenScoreRing').style.setProperty('--score-angle',`${score*3.6}deg`);
  const tr=document.getElementById('trendResource');tr.innerHTML=ANALYTIC_KEYS.map(k=>`<option value="${k}">${RESOURCE_META[k].name}</option>`).join(''); if(!ANALYTIC_KEYS.includes(tr.value))tr.value='electricity';renderTrendChart(tr.value);
  document.getElementById('healthList').innerHTML=ANALYTIC_KEYS.map(k=>{const c=pct(total(selectedYear,k),total(prev,k)),m=RESOURCE_META[k],s=resourceStatus(k,c);return `<div class="health-row"><div class="health-icon">${m.icon}</div><div class="health-name"><b>${m.name}</b><small>${fmt(total(selectedYear,k),1)} ${m.unit}</small></div><span class="status-pill ${s.cls}">${s.label}</span></div>`}).join('');
  chartOrMessage('yoyChart',{type:'bar',data:{labels:['ไฟฟ้า','น้ำ','ขยะทั่วไป','ดีเซล','เบนซิน'],datasets:[{label:String(prev),data:['electricity','water','general_waste','diesel','gasoline'].map(k=>total(prev,k))},{label:String(selectedYear),data:['electricity','water','general_waste','diesel','gasoline'].map(k=>total(selectedYear,k))}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,ticks:{font:{size:9}}},x:{ticks:{font:{size:9}}}}}},'yoy');
  const changes=ANALYTIC_KEYS.map(k=>({k,ch:pct(total(selectedYear,k),total(prev,k)),s:resourceStatus(k,pct(total(selectedYear,k),total(prev,k)))}));const bad=changes.filter(x=>x.s.cls!=='good').sort((a,b)=>b.ch-a.ch).slice(0,3);const goodList=changes.filter(x=>x.s.cls==='good').sort((a,b)=>a.ch-b.ch).slice(0,2);const insights=[...bad.map(x=>({good:false,title:`${RESOURCE_META[x.k].name}: ${x.ch>=0?'+':''}${x.ch.toFixed(1)}%`,text:'แนวโน้มเพิ่มขึ้นจากปีก่อน ควรตรวจสอบสาเหตุและกำหนดมาตรการลดการใช้ทรัพยากร'})),...goodList.map(x=>({good:true,title:`${RESOURCE_META[x.k].name}: ${x.ch.toFixed(1)}%`,text:'แนวโน้มดีขึ้นจากปีก่อน ควรรักษามาตรการและบันทึกปัจจัยความสำเร็จ'}))];document.getElementById('insightList').innerHTML=insights.length?insights.map(i=>`<div class="insight-item ${i.good?'good':''}"><b>${i.title}</b><p>${i.text}</p></div>`).join(''):'<div class="empty-state">ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์</div>';
}
function renderTrendChart(res){const prev=selectedYear-1;chartOrMessage('trendChart',{type:'line',data:{labels:MONTHS,datasets:[{label:String(prev),data:monthly(prev,res),tension:.35,borderWidth:2},{label:String(selectedYear),data:monthly(selectedYear,res),tension:.35,borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:false,ticks:{font:{size:9}}},x:{ticks:{font:{size:9}}}}}},'trend')}
function renderResources(){document.getElementById('resourceGrid').innerHTML=ANALYTIC_KEYS.map(k=>{const m=RESOURCE_META[k],c=total(selectedYear,k),ch=pct(c,total(selectedYear-1,k));return `<div class="resource-card ${k===selectedResource?'active':''}" data-resource="${k}"><div class="resource-card-top"><span class="icon">${m.icon}</span>${deltaBadge(ch,k)}</div><div class="value">${fmt(c,1)} <span class="unit">${m.unit}</span></div><div class="name">${m.name}</div></div>`}).join('');document.querySelectorAll('.resource-card').forEach(el=>el.onclick=()=>{selectedResource=el.dataset.resource;renderResources()});renderResourceDetail()}
function renderResourceDetail(){const k=selectedResource,m=RESOURCE_META[k],prev=selectedYear-1,c=total(selectedYear,k),p=total(prev,k),ch=pct(c,p);document.getElementById('resourceDetailTag').textContent=m.name.toUpperCase();document.getElementById('resourceDetailTitle').textContent=`${m.icon} ${m.name} — ${fmt(c,1)} ${m.unit}`;document.getElementById('resourceDetailChange').textContent=`${ch>=0?'+':''}${ch.toFixed(1)}% เทียบ ${prev}`;chartOrMessage('resourceDetailChart',{type:'line',data:{labels:MONTHS,datasets:[{label:String(prev),data:monthly(prev,k),tension:.35,borderWidth:2},{label:String(selectedYear),data:monthly(selectedYear,k),tension:.35,borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:false},x:{ticks:{font:{size:9}}}}}},'resourceDetail');const a=monthly(prev,k),b=monthly(selectedYear,k);document.getElementById('resourceMonthlyTable').innerHTML=MONTHS.map((mo,i)=>`<tr><td>${mo}</td><td class="num">${fmt(a[i],1)}</td><td class="num">${fmt(b[i],1)}</td><td class="num">${a[i]?`${pct(b[i],a[i])>=0?'+':''}${pct(b[i],a[i]).toFixed(1)}%`:'-'}</td></tr>`).join('')}
function renderCarbon(){const prev=selectedYear-1,c=total(selectedYear,'ghg'),p=total(prev,'ghg'),ch=pct(c,p);document.getElementById('carbonSummary').innerHTML=`<article class="carbon-total"><small>GHG ปี ${selectedYear}</small><strong>${fmt(c)} kgCO₂e</strong><span>${ch>=0?'+':''}${ch.toFixed(1)}% เทียบปีก่อน</span></article><article class="card"><span class="section-tag">BASELINE</span><h3>${fmt(p)} kgCO₂e</h3><p class="muted">ค่าที่บันทึกในปี ${prev}</p></article><article class="card"><span class="section-tag">CHANGE</span><h3>${fmt(c-p)} kgCO₂e</h3><p class="muted">ส่วนต่างจากปีก่อน</p></article>`;if(!isAdmin()){document.getElementById('efTable').innerHTML=ANALYTIC_KEYS.map(k=>{const ef=state.emissionFactors[k]||{};return `<div class="readonly-ef"><div>${RESOURCE_META[k].icon} <b>${RESOURCE_META[k].name}</b><small>${ef.source||'ยังไม่ระบุแหล่งอ้างอิง'}</small></div><b>${ef.factor??'-'}</b></div>`}).join('')}else{document.getElementById('efTable').innerHTML=ANALYTIC_KEYS.map(k=>{const ef=state.emissionFactors[k]||{};return `<div class="ef-row"><div class="ef-name">${RESOURCE_META[k].icon} ${RESOURCE_META[k].name}</div><input data-ef-key="${k}" data-ef-field="factor" type="number" step="0.000001" placeholder="EF" value="${ef.factor??''}"><input class="ef-source" data-ef-key="${k}" data-ef-field="source" placeholder="แหล่งอ้างอิง / ปี" value="${ef.source??''}"><button class="tiny-btn" data-save-ef="${k}">บันทึก</button></div>`}).join('');document.querySelectorAll('[data-save-ef]').forEach(btn=>btn.onclick=async()=>{const k=btn.dataset.saveEf;const factor=document.querySelector(`[data-ef-key="${k}"][data-ef-field="factor"]`).value;const source=document.querySelector(`[data-ef-key="${k}"][data-ef-field="source"]`).value;try{setBusy(true,'กำลังบันทึก Emission Factor...');if(cloudMode)await Cloud.saveEmissionFactor(k,factor===''?null:Number(factor),source);state.emissionFactors[k]={factor:factor===''?null:Number(factor),source};state.demo=false;saveState();updateDemoUI();renderCalculatedCarbon()}catch(err){showError(err)}finally{setBusy(false)}})}renderCalculatedCarbon()}
function renderCalculatedCarbon(){const rows=ANALYTIC_KEYS.map(k=>{const ef=state.emissionFactors[k];if(!ef||!Number.isFinite(ef.factor))return null;return {k,val:total(selectedYear,k)*ef.factor,source:ef.source}}).filter(Boolean);const el=document.getElementById('calculatedCarbon');if(!rows.length){el.innerHTML='<div class="empty-state">ยังไม่ได้ตั้งค่า Emission Factor<br>เมื่อบันทึก EF แล้ว ระบบจะแสดงผลคำนวณที่นี่</div>';return}const sum=rows.reduce((s,r)=>s+r.val,0);el.innerHTML=`<div class="carbon-total"><small>Calculated Emissions</small><strong>${fmt(sum)} kgCO₂e</strong><span>จากหมวดที่มีการตั้งค่า EF แล้ว</span></div>${rows.map(r=>`<div class="calc-row"><div>${RESOURCE_META[r.k].icon} <strong>${RESOURCE_META[r.k].name}</strong><br><span class="muted">${r.source||'ไม่ได้ระบุแหล่งอ้างอิง'}</span></div><b>${fmt(r.val)} kgCO₂e</b></div>`).join('')}`}
function renderTargets(){const target=state.targets.find(t=>Number(t.year)===selectedYear);const baseline=total(selectedYear-1,'ghg'),actual=total(selectedYear,'ghg');if(target&&baseline){const targetValue=baseline*(1-target.percent/100),reduction=baseline-actual,needed=baseline-targetValue,progress=Math.max(0,Math.min(100,needed?reduction/needed*100:0));document.getElementById('targetProgress').innerHTML=`<div class="target-gauge"><span class="section-tag">NET ZERO PROGRESS ${selectedYear}</span><div class="big">${fmt(progress,1)}%</div><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div><p class="muted">ความก้าวหน้าต่อเป้าหมายลด ${target.percent}% จาก Baseline ปี ${selectedYear-1}</p><div class="target-stats"><div class="target-stat"><small>Baseline</small><b>${fmt(baseline)} kgCO₂e</b></div><div class="target-stat"><small>Target</small><b>${fmt(targetValue)} kgCO₂e</b></div><div class="target-stat"><small>Actual</small><b>${fmt(actual)} kgCO₂e</b></div></div></div>`}else document.getElementById('targetProgress').innerHTML='<div class="empty-state">ยังไม่มีเป้าหมายสำหรับปีนี้ กรุณาตั้งเป้าหมายด้านขวา</div>';document.getElementById('targetYear').value=selectedYear;document.getElementById('targetPercent').value=target?.percent??10;document.getElementById('targetNote').value=target?.note??'';document.getElementById('targetTable').innerHTML=state.targets.sort((a,b)=>a.year-b.year).map(t=>{const b=total(t.year-1,'ghg'),a=total(t.year,'ghg'),tv=b*(1-t.percent/100);const status=!a?'รอข้อมูล':a<=tv?'บรรลุ':'กำลังดำเนินการ';return `<tr><td>${t.year}</td><td class="num">${fmt(b)}</td><td class="num">${t.percent}%</td><td class="num">${fmt(tv)}</td><td class="num">${a?fmt(a):'-'}</td><td><span class="status-pill ${status==='บรรลุ'?'good':'warning'}">${status}</span></td></tr>`}).join('')||'<tr><td colspan="6">ยังไม่มีเป้าหมาย</td></tr>'}
function renderActions(){const el=document.getElementById('actionBoard');el.innerHTML=state.actions.length?state.actions.map(a=>{const m=RESOURCE_META[a.resource]||RESOURCE_META.electricity;const progress=a.status==='เสร็จสิ้น'?100:a.status==='กำลังดำเนินการ'?60:20;return `<article class="action-card"><div class="action-card-head"><span class="status-pill ${a.status==='เสร็จสิ้น'?'good':a.status==='กำลังดำเนินการ'?'warning':'critical'}">${a.status}</span><span>${m.icon}</span></div><h3>${a.title}</h3><div class="action-meta">หมวด: ${m.name}<br>ผู้รับผิดชอบ: ${a.owner}<br>${a.start||'-'} → ${a.end||'-'}<br>เป้าหมายลด: ${a.reduction||0}%</div><div class="action-progress"><span style="width:${progress}%"></span></div><div class="action-foot"><span>${progress}% workflow</span>${isAdmin()?`<button class="delete-btn" data-del-action="${a.id}">ลบ</button>`:''}</div></article>`}).join(''):'<div class="empty-state">ยังไม่มีมาตรการ</div>';if(isAdmin())document.querySelectorAll('[data-del-action]').forEach(btn=>btn.onclick=async()=>{if(!confirm('ลบมาตรการนี้หรือไม่?'))return;try{setBusy(true,'กำลังลบมาตรการ...');if(cloudMode)await Cloud.deleteAction(btn.dataset.delAction);state.actions=state.actions.filter(a=>a.id!==btn.dataset.delAction);state.demo=false;saveState();updateDemoUI();renderActions()}catch(err){showError(err)}finally{setBusy(false)}})}
function populateForms(){document.getElementById('entryResource').innerHTML=Object.entries(RESOURCE_META).map(([k,m])=>`<option value="${k}">${m.icon} ${m.name} (${m.unit})</option>`).join('');document.getElementById('entryMonth').innerHTML=MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');document.getElementById('entryYear').value=selectedYear;document.getElementById('actionResource').innerHTML=ANALYTIC_KEYS.map(k=>`<option value="${k}">${RESOURCE_META[k].name}</option>`).join('');document.getElementById('actionStart').value=new Date().toISOString().slice(0,10)}
function renderLatestRecords(){const rows=[...state.records].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,10);document.getElementById('latestRecords').innerHTML=rows.map(r=>{const m=RESOURCE_META[r.resource]||{icon:'•',name:r.resource,unit:''};return `<div class="latest-item"><div class="record-icon">${m.icon}</div><div><b>${m.name} · ${MONTHS[r.month-1]} ${r.year}</b><small>${r.building||'-'} · ${r.source||'ไม่ระบุแหล่งข้อมูล'}</small></div><div class="record-value">${fmt(r.amount,2)} ${m.unit}</div></div>`}).join('')}
function reportStatus(k){const ch=pct(total(selectedYear,k),total(selectedYear-1,k));const st=resourceStatus(k,ch);return `<span class="status-pill ${st.cls}">${ch>=0?'+':''}${ch.toFixed(1)}%</span>`}
function renderReport(){const prev=selectedYear-1;const ghg=total(selectedYear,'ghg'),pghg=total(prev,'ghg'),ghgCh=pct(ghg,pghg);const dataLabel=cloudMode?'Google Sheets':state.demo?'ข้อมูลสาธิต':'ข้อมูลในเครื่อง';const note=state.demo&&!cloudMode?'รายงานนี้ใช้ข้อมูลสาธิต ไม่ใช่ข้อมูลทางการ กรุณานำเข้าข้อมูลจริงก่อนใช้อ้างอิง':cloudMode?'ข้อมูลจัดเก็บในฐานข้อมูลกลางและเข้าถึงตามสิทธิ์ผู้ใช้ โปรดตรวจสอบความถูกต้องและแหล่งข้อมูลก่อนนำไปใช้อ้างอิง':'ข้อมูลจัดเก็บในเบราว์เซอร์ของอุปกรณ์นี้ โปรดตรวจสอบความถูกต้องและแหล่งข้อมูลก่อนนำไปใช้อ้างอิง';document.getElementById('reportSheet').innerHTML=`<div class="report-header"><div><span class="section-tag">SCI GREENTRACK REPORT</span><h2>รายงานการใช้ทรัพยากร ปี ${selectedYear}</h2><p class="muted">คณะวิทยาศาสตร์และเทคโนโลยี มหาวิทยาลัยราชภัฏวไลยอลงกรณ์</p></div><div class="badge ${state.demo&&!cloudMode?'demo':''}">${dataLabel}</div></div><div class="report-summary"><div class="report-stat"><small>GHG Emissions</small><b>${fmt(ghg)} kgCO₂e</b></div><div class="report-stat"><small>เปลี่ยนแปลงจาก ${prev}</small><b>${ghgCh>=0?'+':''}${ghgCh.toFixed(1)}%</b></div><div class="report-stat"><small>จำนวนรายการข้อมูล</small><b>${state.records.filter(r=>r.year===selectedYear).length} รายการ</b></div></div><h3>สรุปทรัพยากร</h3><div class="table-wrap"><table><thead><tr><th>ทรัพยากร</th><th>${prev}</th><th>${selectedYear}</th><th>เปลี่ยนแปลง</th></tr></thead><tbody>${ANALYTIC_KEYS.map(k=>{const m=RESOURCE_META[k];return `<tr><td>${m.icon} ${m.name}</td><td class="num">${fmt(total(prev,k),1)} ${m.unit}</td><td class="num">${fmt(total(selectedYear,k),1)} ${m.unit}</td><td>${reportStatus(k)}</td></tr>`}).join('')}</tbody></table></div><h3 style="margin-top:22px">มาตรการที่ติดตาม</h3><div class="table-wrap"><table><thead><tr><th>มาตรการ</th><th>ผู้รับผิดชอบ</th><th>เป้าหมายลด</th><th>สถานะ</th></tr></thead><tbody>${state.actions.map(a=>`<tr><td>${a.title}</td><td>${a.owner}</td><td>${a.reduction||0}%</td><td>${a.status}</td></tr>`).join('')||'<tr><td colspan="4">ไม่มีข้อมูล</td></tr>'}</tbody></table></div><p class="report-note">หมายเหตุ: ${note}<br>โครงสร้างหมวดข้อมูลอ้างอิงจากหน้า Green Office คณะวิทยาศาสตร์และเทคโนโลยี: https://sci.vru.ac.th/home/greenoffice</p>`}
function renderAll(){yearOptions();updateDemoUI();populateForms();renderDashboard();renderResources();renderCarbon();renderTargets();renderActions();renderLatestRecords();renderReport()}
function setView(v){
  if((v==='settings'||v==='users')&&!isAdmin())v='dashboard';
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  const view=document.getElementById(`view-${v}`);if(view)view.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
  const titles={dashboard:'ภาพรวมการใช้ทรัพยากร',resources:'วิเคราะห์ทรัพยากร',carbon:'Carbon Center',targets:'Net Zero Target',actions:'Action Plan',entry:'บันทึกข้อมูล',reports:'Reports',users:'ผู้ใช้งานและสิทธิ์',settings:'Data & Settings'};
  document.getElementById('pageTitle').textContent=titles[v]||'SCI GreenTrack';
  document.getElementById('sidebar').classList.remove('open');
  if(v==='reports')renderReport();
  if(v==='users')renderUsers();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-view-jump]').forEach(b=>b.onclick=()=>setView(b.dataset.viewJump));
document.getElementById('menuBtn').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
document.getElementById('globalYear').onchange=e=>{selectedYear=Number(e.target.value);renderAll()};
document.getElementById('trendResource').onchange=e=>renderTrendChart(e.target.value);

document.getElementById('targetForm').onsubmit=async e=>{
  e.preventDefault();if(!isAdmin())return;
  const y=Number(document.getElementById('targetYear').value),percent=Number(document.getElementById('targetPercent').value),note=document.getElementById('targetNote').value;
  try{setBusy(true,'กำลังบันทึกเป้าหมาย...');const t={year:y,percent,note};if(cloudMode)await Cloud.saveTarget(t);state.targets=state.targets.filter(x=>Number(x.year)!==y);state.targets.push(t);state.demo=false;saveState();updateDemoUI();renderTargets()}catch(err){showError(err)}finally{setBusy(false)}
};

document.getElementById('dataEntryForm').onsubmit=async e=>{
  e.preventDefault();
  const row={resource:document.getElementById('entryResource').value,year:Number(document.getElementById('entryYear').value),month:Number(document.getElementById('entryMonth').value),amount:Number(document.getElementById('entryAmount').value),building:document.getElementById('entryBuilding').value,source:document.getElementById('entrySource').value,note:document.getElementById('entryNote').value,createdAt:new Date().toISOString()};
  try{setBusy(true,'กำลังบันทึกข้อมูล...');const saved=cloudMode?await Cloud.insertRecord(row):{...row,id:crypto.randomUUID()};state.records.push(saved);state.demo=false;saveState();selectedYear=Number(row.year);document.getElementById('dataEntryForm').reset();renderAll();setView('entry')}catch(err){showError(err)}finally{setBusy(false)}
};

document.getElementById('addActionBtn').onclick=()=>{if(isAdmin())document.getElementById('actionDialog').showModal()};
document.getElementById('actionForm').addEventListener('submit',async e=>{
  const submitter=e.submitter;if(submitter?.value==='cancel')return;e.preventDefault();if(!isAdmin())return;
  const action={id:crypto.randomUUID(),title:document.getElementById('actionTitle').value,resource:document.getElementById('actionResource').value,owner:document.getElementById('actionOwner').value,start:document.getElementById('actionStart').value,end:document.getElementById('actionEnd').value,reduction:Number(document.getElementById('actionReduction').value||0),status:document.getElementById('actionStatus').value,detail:document.getElementById('actionDetail').value};
  try{setBusy(true,'กำลังบันทึกมาตรการ...');const saved=cloudMode?await Cloud.addAction(action):action;state.actions.push(saved);state.demo=false;saveState();document.getElementById('actionDialog').close();document.getElementById('actionForm').reset();updateDemoUI();renderActions()}catch(err){showError(err)}finally{setBusy(false)}
});

document.getElementById('printReportBtn').onclick=()=>window.print();
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s}
function recordsToCsv(rows){return ['year,month,resource,amount,building,source,note',...rows.map(r=>[r.year,r.month,r.resource,r.amount,r.building,r.source,r.note].map(csvEscape).join(','))].join('\n')}
function download(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
document.getElementById('exportCsvBtn').onclick=()=>download(`sci-greentrack-${selectedYear}.csv`,recordsToCsv(state.records.filter(r=>r.year===selectedYear)),'text/csv;charset=utf-8');
document.getElementById('downloadTemplateBtn').onclick=()=>download('sci-greentrack-template.csv','year,month,resource,amount,building,source,note\n2569,1,electricity,0,คณะวิทยาศาสตร์และเทคโนโลยี,ใบแจ้งค่าไฟ,');
document.getElementById('backupJsonBtn').onclick=()=>download('sci-greentrack-backup.json',JSON.stringify(state,null,2),'application/json');
function parseCsv(text){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);const headers=lines.shift().split(',').map(x=>x.trim());return lines.map(line=>{const vals=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){vals.push(cur);cur=''}else cur+=ch}vals.push(cur);return Object.fromEntries(headers.map((h,i)=>[h,vals[i]??'']))})}
document.getElementById('csvInput').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;const status=document.getElementById('importStatus');
  try{const rows=parseCsv(await f.text()).filter(r=>RESOURCE_META[r.resource]&&Number(r.year)&&Number(r.month)&&Number.isFinite(Number(r.amount))).map(r=>({year:Number(r.year),month:Number(r.month),resource:r.resource,amount:Number(r.amount),building:r.building||'',source:r.source||'',note:r.note||'',createdAt:new Date().toISOString()}));if(!rows.length)throw new Error('ไม่พบแถวข้อมูลที่ถูกต้อง');setBusy(true,'กำลังนำเข้าข้อมูล...');const inserted=cloudMode?await Cloud.bulkInsertRecords(rows):rows.map(r=>({...r,id:crypto.randomUUID()}));state.records.push(...inserted);state.demo=false;saveState();renderAll();status.className='status-message success';status.textContent=`นำเข้าสำเร็จ ${inserted.length} รายการ`}catch(err){status.className='status-message error';status.textContent='นำเข้าไม่สำเร็จ: '+err.message}finally{setBusy(false);e.target.value=''}
};

document.getElementById('resetDemoBtn').onclick=()=>{if(cloudMode)return;if(!confirm('ต้องการลบข้อมูลปัจจุบันและกลับไปใช้ข้อมูลสาธิตใช่หรือไม่?'))return;state=defaultState();selectedYear=2566;saveState();renderAll();setView('dashboard')};
document.getElementById('seedCloudBtn').onclick=async()=>{if(!cloudMode||!isAdmin())return;if(!confirm('นำข้อมูลสาธิต 2 ปีขึ้นฐานข้อมูลกลางหรือไม่? ควรใช้เฉพาะเพื่อ Demo'))return;try{setBusy(true,'กำลังนำข้อมูลสาธิตขึ้น Cloud...');const n=await Cloud.seedDemo(defaultState());await reloadCloudState();alert(`เพิ่มข้อมูลสาธิต ${n} รายการแล้ว`)}catch(err){showError(err)}finally{setBusy(false)}};
document.getElementById('refreshCloudBtn').onclick=async()=>{if(cloudMode)await reloadCloudState();else renderAll()};
document.getElementById('refreshUsersBtn').onclick=()=>renderUsers(true);
const createUserForm=document.getElementById('createUserForm');
if(createUserForm) createUserForm.onsubmit=async e=>{
  e.preventDefault(); if(!cloudMode||!isAdmin()) return;
  try{
    setBusy(true,'กำลังสร้างผู้ใช้...');
    await Cloud.createUser(
      document.getElementById('newUserName').value,
      document.getElementById('newUserEmail').value,
      document.getElementById('newUserPassword').value,
      document.getElementById('newUserRole').value
    );
    createUserForm.reset(); await renderUsers(); alert('เพิ่มผู้ใช้เรียบร้อย');
  }catch(err){showError(err)}finally{setBusy(false)}
};
document.getElementById('logoutBtn').onclick=async()=>{try{setBusy(true,'กำลังออกจากระบบ...');await Cloud.signOut();cloudMode=true;currentProfile=null;currentRole='user';showAuthGate()}catch(err){showError(err)}finally{setBusy(false)}};

function setBusy(on,text='กำลังโหลด...'){
  let el=document.getElementById('cloudLoading');
  if(on){if(!el){el=document.createElement('div');el.id='cloudLoading';el.className='cloud-loading';document.body.appendChild(el)}el.textContent=text;el.hidden=false}else if(el)el.hidden=true
}
function showError(err){console.error(err);alert(err?.message||String(err))}
function showAuthMessage(msg,type=''){const el=document.getElementById('authStatus');el.textContent=msg;el.className='auth-status '+type}
function showAuthGate(){document.getElementById('authGate').hidden=false;document.getElementById('appShell').hidden=true;document.getElementById('logoutBtn').hidden=true}
function showApp(){document.getElementById('authGate').hidden=true;document.getElementById('appShell').hidden=false}
function applyPermissions(){
  document.querySelectorAll('.admin-only').forEach(el=>el.hidden=!isAdmin());
  document.querySelectorAll('.local-only').forEach(el=>el.hidden=cloudMode);
  document.querySelectorAll('.cloud-only').forEach(el=>el.hidden=!cloudMode);
  document.getElementById('userChip').hidden=!cloudMode;
  document.getElementById('logoutBtn').hidden=!cloudMode;
  const prof=currentProfile||{};
  document.getElementById('userName').textContent=prof.full_name||prof.email||'Local Admin';
  document.getElementById('userRole').textContent=(currentRole||'user').toUpperCase();
  document.getElementById('userAvatar').textContent=(prof.full_name||prof.email||'A').trim().charAt(0).toUpperCase();
  document.getElementById('cloudStatus').textContent=cloudMode?'เชื่อมฐานข้อมูลกลาง':'Local Demo';
  document.getElementById('cloudNote').textContent=cloudMode?'Netlify + Apps Script + Google Sheets':'ยังไม่ได้เชื่อม API';
  document.getElementById('cloudDot').className='dot '+(cloudMode?'online':'offline');
  renderCloudSetupInfo();
}
function renderCloudSetupInfo(){const el=document.getElementById('cloudSetupInfo');if(!el)return;el.innerHTML=cloudMode?`<b>เชื่อมต่อแล้ว</b><br>ผู้ใช้: ${currentProfile?.email||'-'} · สิทธิ์: ${currentRole.toUpperCase()}<br><span class="permission-note">ข้อมูลกลาง: Google Sheets · API: Google Apps Script · Proxy: Netlify Function</span>`:`<b>ยังไม่ได้เชื่อมฐานข้อมูลกลาง</b><br>ตรวจ Environment Variables <code>GAS_WEB_APP_URL</code> และ <code>GAS_SHARED_SECRET</code> ใน Netlify`}
async function reloadCloudState(){if(!cloudMode)return;try{setBusy(true,'กำลังซิงก์ฐานข้อมูล...');state=await Cloud.loadState();const years=getYears();if(years.length&&!years.includes(selectedYear))selectedYear=years.at(-1);renderAll();applyPermissions()}catch(err){showError(err)}finally{setBusy(false)}}
async function enterCloudSession(){if(bootingCloud)return;bootingCloud=true;try{setBusy(true,'กำลังโหลดบัญชีและฐานข้อมูล...');const session=Cloud.session||await Cloud.getSession();if(!session){showAuthGate();return}currentProfile=await Cloud.loadProfile();currentRole=currentProfile?.role||'user';cloudMode=true;state=await Cloud.loadState();const years=getYears();selectedYear=years.at(-1)||2569;showApp();applyPermissions();renderAll()}catch(err){showAuthGate();showAuthMessage('โหลดระบบไม่สำเร็จ: '+err.message,'error')}finally{setBusy(false);bootingCloud=false}}
async function renderUsers(){
  const tbody=document.getElementById('usersTable');
  if(!tbody||!isAdmin()){if(tbody)tbody.innerHTML='<tr><td colspan="6">ไม่มีสิทธิ์</td></tr>';return}
  tbody.innerHTML='<tr><td colspan="6">กำลังโหลด...</td></tr>';
  try{
    const users=await Cloud.listProfiles();
    tbody.innerHTML=users.map(u=>`<tr>
      <td>${u.full_name||'-'}</td>
      <td>${u.email||'-'}${u.id===currentProfile?.id?' <span class="role-badge admin">คุณ</span>':''}</td>
      <td>${u.id===currentProfile?.id?`<span class="role-badge ${u.role}">${u.role.toUpperCase()}</span>`:`<select class="role-select" data-role-user="${u.id}"><option value="user" ${u.role==='user'?'selected':''}>USER</option><option value="admin" ${u.role==='admin'?'selected':''}>ADMIN</option></select>`}</td>
      <td><span class="status-pill ${u.active===false?'critical':'good'}">${u.active===false?'ปิดใช้งาน':'ใช้งาน'}</span></td>
      <td>${u.created_at?new Date(u.created_at).toLocaleDateString('th-TH'):'-'}</td>
      <td><div class="action-row"><button class="tiny-btn" data-reset-user="${u.id}" type="button">รหัสผ่าน</button>${u.id===currentProfile?.id?'':`<button class="tiny-btn" data-toggle-user="${u.id}" data-active="${u.active===false?'false':'true'}" type="button">${u.active===false?'เปิด':'ปิด'}</button>`}</div></td>
    </tr>`).join('')||'<tr><td colspan="6">ยังไม่มีผู้ใช้</td></tr>';
    document.querySelectorAll('[data-role-user]').forEach(sel=>sel.onchange=async()=>{
      const role=sel.value;if(!confirm(`เปลี่ยนสิทธิ์เป็น ${role.toUpperCase()} หรือไม่?`)){await renderUsers();return}
      try{setBusy(true,'กำลังเปลี่ยนสิทธิ์...');await Cloud.setRole(sel.dataset.roleUser,role);await renderUsers()}catch(err){showError(err);await renderUsers()}finally{setBusy(false)}
    });
    document.querySelectorAll('[data-reset-user]').forEach(btn=>btn.onclick=async()=>{
      const password=prompt('ตั้งรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)'); if(!password)return;
      try{setBusy(true,'กำลังเปลี่ยนรหัสผ่าน...');await Cloud.resetPassword(btn.dataset.resetUser,password);alert('เปลี่ยนรหัสผ่านแล้ว Session เดิมของผู้ใช้นี้ถูกยกเลิก')}catch(err){showError(err)}finally{setBusy(false)}
    });
    document.querySelectorAll('[data-toggle-user]').forEach(btn=>btn.onclick=async()=>{
      const active=btn.dataset.active!=='true';
      if(!confirm(`${active?'เปิด':'ปิด'}บัญชีผู้ใช้นี้หรือไม่?`))return;
      try{setBusy(true,'กำลังเปลี่ยนสถานะผู้ใช้...');await Cloud.toggleUser(btn.dataset.toggleUser,active);await renderUsers()}catch(err){showError(err)}finally{setBusy(false)}
    });
  }catch(err){tbody.innerHTML=`<tr><td colspan="6">${err.message}</td></tr>`}
}

let signupMode=false;
document.getElementById('authSwitchBtn').onclick=()=>{signupMode=!signupMode;document.getElementById('loginForm').hidden=signupMode;document.getElementById('signupForm').hidden=!signupMode;document.getElementById('authSwitchBtn').textContent=signupMode?'มีบัญชีแล้ว? เข้าสู่ระบบ':'ยังไม่มีบัญชี? สมัครใช้งาน';showAuthMessage(signupMode?'สร้างบัญชีใหม่':'เข้าสู่ระบบเพื่อใช้งานฐานข้อมูลกลาง')};
document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();try{setBusy(true,'กำลังเข้าสู่ระบบ...');await Cloud.signIn(document.getElementById('loginEmail').value,document.getElementById('loginPassword').value);showAuthMessage('เข้าสู่ระบบสำเร็จ','success');await enterCloudSession()}catch(err){showAuthMessage(err.message,'error')}finally{setBusy(false)}};
document.getElementById('signupForm').onsubmit=async e=>{e.preventDefault();try{setBusy(true,'กำลังสร้างบัญชี...');const data=await Cloud.signUp(document.getElementById('signupEmail').value,document.getElementById('signupPassword').value,document.getElementById('signupName').value);if(data.session){showAuthMessage('สร้างบัญชีและเข้าสู่ระบบแล้ว','success');await enterCloudSession()}else{showAuthMessage('สร้างบัญชีแล้ว','success');signupMode=false;document.getElementById('loginForm').hidden=false;document.getElementById('signupForm').hidden=true}}catch(err){showAuthMessage(err.message,'error')}finally{setBusy(false)}};

async function boot(){
  if(Cloud.configured()){
    try{
      if(!authSubscription)authSubscription=Cloud.onAuthStateChange(async(event,newSession)=>{if(event==='SIGNED_IN'&&newSession&&!document.getElementById('appShell').hidden)return;if(event==='SIGNED_OUT')showAuthGate()});
      const session=await Cloud.getSession();
      if(session)await enterCloudSession();
      else{cloudMode=true;currentRole='user';showAuthGate();showAuthMessage('เข้าสู่ระบบเพื่อใช้งานฐานข้อมูลกลาง')}
    }catch(err){showAuthGate();showAuthMessage('เชื่อม Google Sheets API ไม่สำเร็จ: '+err.message,'error')}
  }else{
    cloudMode=false;currentRole='admin';currentProfile={full_name:'Local Demo Admin',email:'local@demo',role:'admin'};state=loadState();showApp();applyPermissions();renderAll();
  }
}

boot();
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{Object.values(charts).forEach(c=>chartOrMessage(c.canvasId,c.config,c.canvasId))},180)});
