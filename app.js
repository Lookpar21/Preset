// ===== Constants & helpers =====
const RANKS = ["A","2","3","4","5","6","7","8","9","0"]; // 0 = 10/J/Q/K
const VAL = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"0":0};
const LS_KEY = "bacc_next_advisor_full_v1";

let shoe = initShoe(8); // default 8 decks

function initShoe(decks){
  const c={};
  for(const r of RANKS){ c[r] = (r==="0" ? 16 : 4)*decks; }
  return c;
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function sumCounts(c){ return Object.values(c).reduce((a,b)=>a+b,0); }
function take(c,r){ if(c[r]<=0) return false; c[r]--; return true; }
function add(c,r){ c[r]++; }
function pct(x){ return (x*100).toFixed(2)+"%"; }
function $(id){ return document.getElementById(id); }

// ===== UI setup =====
function buildRankSelects(){
  for(const id of ["p1","p2","b1","b2","p3opt","b3opt"]){
    const sel=$(id); sel.innerHTML="";
    const blank = document.createElement("option"); blank.value=""; blank.text="—"; sel.add(blank);
    for(const r of RANKS){ const opt=document.createElement("option"); opt.value=r; opt.text=r; sel.add(opt); }
  }
}
function renderStock(){
  // update stock summary (total and per-rank)
  const totalLeft = sumCounts(shoe);
  const parts = RANKS.map(r => r+': <b>'+shoe[r]+'</b>');
  const sumDiv = $("stockSummary");
  if(sumDiv){ sumDiv.innerHTML = '<span class="badge">รวมคงเหลือ: <b>'+totalLeft+'</b> ใบ</span> ' + parts.map(p=>'<span class="badge">'+p+'</span>').join(' '); }

  const wrap = $("stock"); wrap.innerHTML="";
  for(const r of RANKS){
    const div = document.createElement("div");
    div.className="slot";
    div.innerHTML = `
      <h5>${r}</h5>
      <div class="ctrl">
        <button class="btn" data-op="-" data-r="${r}">-</button>
        <input type="number" min="0" value="${shoe[r]}" data-r="${r}">
        <button class="btn" data-op="+" data-r="${r}">+</button>
      </div>
    `;
    wrap.appendChild(div);
  }
  wrap.querySelectorAll("button").forEach(btn=>{
    btn.onclick = ()=>{
      const r = btn.dataset.r, op = btn.dataset.op;
      if(op==="+") add(shoe,r); else if(shoe[r]>0) shoe[r]--;
      renderStock();
    };
  });
  wrap.querySelectorAll("input").forEach(inp=>{
    inp.onchange = ()=>{ const r=inp.dataset.r; shoe[r]=Math.max(0, parseInt(inp.value||"0",10)); };
  });
}

// ===== Baccarat rules =====
function total2(r1,r2){ return (VAL[r1]+VAL[r2])%10; }
function playerDraws(total){ return total<=5; }
function bankerDraws(bTot, pDrew, p3){
  if(!pDrew) return bTot<=5;
  if(bTot<=2) return true;
  if(bTot===3) return p3!=="8";
  if(bTot===4) return ["2","3","4","5","6","7"].includes(p3);
  if(bTot===5) return ["4","5","6","7"].includes(p3);
  if(bTot===6) return ["6","7"].includes(p3);
  return false; // 7 stand
}

// ===== Current round analysis =====
function analyzeCurrentRound(p1,p2,b1,b2,p3Sel=null,b3Sel=null){
  // feasibility
  const need={}; [p1,p2,b1,b2].forEach(r=>need[r]=(need[r]||0)+1);
  for(const r in need){ if(shoe[r]<need[r]) return {error:"สต็อกไม่พอสำหรับไพ่ที่ระบุ: "+r}; }

  const base = clone(shoe);
  [p1,p2,b1,b2].forEach(r=>base[r]--);
  const R0 = sumCounts(base);

  const p2tot = total2(p1,p2);
  const b2tot = total2(b1,b2);
  const natural = (p2tot===8||p2tot===9)||(b2tot===8||b2tot===9);

  const outputs = { p2tot, b2tot, natural, p3dist:{}, b3dist:{}, outcome:{P:0,B:0,T:0} };
  // If user provided actual P3 and/or B3, compute deterministic outcome accordingly
  if(!natural){
    const pMustByRule = playerDraws(p2tot);
    if(p3Sel && pMustByRule){
      if(base[p3Sel]<=0){ outputs.error="สต็อกไม่พอสำหรับไพ่ P3: "+p3Sel; return outputs; }
      base[p3Sel]--;
      const R1 = sumCounts(base);
      outputs.p3dist = null;
      const pTot = (p2tot + VAL[p3Sel])%10;
      const bMust = bankerDraws(b2tot, true, p3Sel);
      if(b3Sel && bMust){
        if(base[b3Sel]<=0){ outputs.error="สต็อกไม่พอสำหรับไพ่ B3: "+b3Sel; return outputs; }
        base[b3Sel]--;
        outputs.b3dist = null;
        const bTot = (b2tot + VAL[b3Sel])%10;
        if(pTot>bTot) outputs.outcome.P=1; else if(bTot>pTot) outputs.outcome.B=1; else outputs.outcome.T=1;
        return outputs;
      } else if(!bMust){
        outputs.b3dist = null;
        if(pTot>b2tot) outputs.outcome.P=1; else if(b2tot>pTot) outputs.outcome.B=1; else outputs.outcome.T=1;
        return outputs;
      } else {
        for(const y of RANKS){
          const cy = base[y]; if(cy<=0) continue;
          const prob = cy / R1;
          const bTot=(b2tot+VAL[y])%10;
          if(pTot>bTot) outputs.outcome.P+=prob; else if(bTot>pTot) outputs.outcome.B+=prob; else outputs.outcome.T+=prob;
          outputs.b3dist[y]=(outputs.b3dist[y]||0)+prob;
        }
        return outputs;
      }
    }
  }


  if(natural){
    if(p2tot>b2tot) outputs.outcome.P = 1;
    else if(b2tot>p2tot) outputs.outcome.B = 1;
    else outputs.outcome.T = 1;
    return outputs;
  }

  const pMust = playerDraws(p2tot);

  if(!pMust){
    const bMust = bankerDraws(b2tot, false, null);
    if(!bMust){
      if(p2tot>b2tot) outputs.outcome.P=1; else if(b2tot>p2tot) outputs.outcome.B=1; else outputs.outcome.T=1;
      return outputs;
    }else{
      for(const y of RANKS){
        const cy = base[y]; if(cy<=0) continue;
        const prob = cy / R0;
        outputs.b3dist[y]=(outputs.b3dist[y]||0)+prob;
        const bTot=(b2tot+VAL[y])%10;
        if(p2tot>bTot) outputs.outcome.P+=prob; else if(bTot>p2tot) outputs.outcome.B+=prob; else outputs.outcome.T+=prob;
      }
      return outputs;
    }
  }else{
    for(const x of RANKS){
      const cx = base[x]; if(cx<=0) continue;
      const probP3 = cx / R0;
      outputs.p3dist[x]=(outputs.p3dist[x]||0)+probP3;
      const afterP = clone(base); afterP[x]--; const R1=R0-1;
      const pTot = (p2tot + VAL[x])%10;
      const bMust = bankerDraws(b2tot,true,x);
      if(!bMust){
        if(pTot>b2tot) outputs.outcome.P+=probP3; else if(b2tot>pTot) outputs.outcome.B+=probP3; else outputs.outcome.T+=probP3;
      }else{
        for(const y of RANKS){
          const cy = afterP[y]; if(cy<=0) continue;
          const prob = probP3 * (cy / R1);
          outputs.b3dist[y]=(outputs.b3dist[y]||0)+(probP3 * (cy/R1));
          const bTot=(b2tot+VAL[y])%10;
          if(pTot>bTot) outputs.outcome.P+=prob; else if(bTot>pTot) outputs.outcome.B+=prob; else outputs.outcome.T+=prob;
        }
      }
    }
    return outputs;
  }
}

function renderCurrent(outputs){
  $("currentWrap").style.display="block";
  let html = `<div class="stat">
    <span class="badge">แต้ม Player: <b>${outputs.p2tot}</b></span>
    <span class="badge">แต้ม Banker: <b>${outputs.b2tot}</b></span>
    ${outputs.natural?'<span class="badge">Natural</span>':''}
  </div>`;
  $("summary").innerHTML = html;

  // dists
  function distTable(obj,title){
    if(obj===null){ return `<div class="hint">ไม่มีการจั่ว</div>`; }
    const ks=Object.keys(obj);
    if(!ks.length) return `<div class="hint">—</div>`;
    let t = `<table><thead><tr><th>ไพ่</th><th>%</th></tr></thead><tbody>`;
    for(const r of RANKS){ if(obj[r]) t+=`<tr><td>${r}</td><td>${pct(obj[r])}</td></tr>`; }
    t+=`</tbody></table>`; return t;
  }
  $("p3dist").innerHTML = distTable(outputs.p3dist,"P3");
  $("b3dist").innerHTML = distTable(outputs.b3dist,"B3");

  // outcome + recommendation
  const o = outputs.outcome;
  let best="Player", bestP=o.P;
  if(o.B>bestP){ best="Banker"; bestP=o.B; }
  if(o.T>bestP){ best="Tie"; bestP=o.T; }
  let out = `<h4>ความน่าจะเป็นผลตานี้</h4>
    <table><tr><th>ผล</th><th>%</th></tr>
    <tr><td>Player</td><td>${pct(o.P)}</td></tr>
    <tr><td>Banker</td><td>${pct(o.B)}</td></tr>
    <tr><td>Tie</td><td>${pct(o.T)}</td></tr></table>
    <p><b>แนะนำเดิมพัน (ตานี้):</b> ${best} — ${pct(bestP)}</p>`;
  $("outcomes").innerHTML = out;
}

// ===== Apply current round to shoe =====
function applyRoundToShoe(p1,p2,b1,b2,p3,b3){
  const wants=[p1,p2,b1,b2];
  if(p3) wants.push(p3);
  if(b3) wants.push(b3);
  for(const r of wants){
    if(shoe[r]<=0){ alert("สต็อกไม่พอสำหรับหน้าไพ่: "+r); return false; }
    shoe[r]--;
  }
  renderStock();
  return true;
}

// ===== Save/Load =====
function saveShoe(){ localStorage.setItem(LS_KEY, JSON.stringify(shoe)); alert("บันทึกสต็อกแล้ว"); }
function loadShoe(){ const s=localStorage.getItem(LS_KEY); if(!s) return alert("ยังไม่มีการบันทึก"); shoe=JSON.parse(s); renderStock(); }

// ===== Monte Carlo: simulate NEXT round =====
function drawOne(c){
  // returns a rank sampled without replacement; mutates c
  const total = sumCounts(c);
  let k = Math.floor(Math.random()*total)+1;
  for(const r of RANKS){
    if(c[r]>0){
      if(k<=c[r]){ c[r]--; return r; }
      k-=c[r];
    }
  }
  return null;
}
function simulateOneRound(startCounts){
  const c = clone(startCounts);
  const P1=drawOne(c), B1=drawOne(c), P2=drawOne(c), B2=drawOne(c);
  const p2 = total2(P1,P2), b2 = total2(B1,B2);
  let pairP = (P1===P2), pairB=(B1===B2);
  let natural = (p2===8||p2===9)||(b2===8||b2===9);
  if(natural){
    if(p2>b2) return {res:"P", pairP, pairB, natural:true};
    if(b2>p2) return {res:"B", pairP, pairB, natural:true};
    return {res:"T", pairP, pairB, natural:true};
  }
  // Player draw?
  let P3=null, B3=null;
  if(playerDraws(p2)){
    P3 = drawOne(c);
  }
  // Banker rule
  const p3rank = P3;
  const pTot = P3? (p2+VAL[P3])%10 : p2;
  const bankMust = bankerDraws(b2, !!P3, P3);
  if(bankMust){
    B3 = drawOne(c);
  }
  const bTot = B3? (b2+VAL[B3])%10 : b2;

  if(pTot>bTot) return {res:"P", pairP, pairB, natural:false};
  if(bTot>pTot) return {res:"B", pairP, pairB, natural:false};
  return {res:"T", pairP, pairB, natural:false};
}

function simulateNext(trials){
  const start = clone(shoe);
  let P=0,B=0,T=0, pairP=0, pairB=0, nat=0;
  for(let i=0;i<trials;i++){
    const r = simulateOneRound(start);
    if(r.res==="P") P++; else if(r.res==="B") B++; else T++;
    if(r.pairP) pairP++;
    if(r.pairB) pairB++;
    if(r.natural) nat++;
  }
  return {
    P: P/trials,
    B: B/trials,
    T: T/trials,
    pairP: pairP/trials,
    pairB: pairB/trials,
    natural: nat/trials
  };
}

function renderNext(res, trials){
  $("nextWrap").style.display="block";
  $("nextSummary").innerHTML = `<div class="stat">
    <span class="badge">จำลอง: <b>${trials.toLocaleString()}</b> รอบ</span>
    <span class="badge">สต็อกไพ่เริ่มต้น: <b>${sumCounts(shoe)}</b> ใบ</span>
  </div>`;
  let best="Player", bestP=res.P;
  if(res.B>bestP){ best="Banker"; bestP=res.B; }
  if(res.T>bestP){ best="Tie"; bestP=res.T; }
  $("nextOutcomes").innerHTML = `
    <h4>ตาถัดไป – ความน่าจะเป็น</h4>
    <table>
      <tr><th>ผล</th><th>%</th></tr>
      <tr><td>Player</td><td>${pct(res.P)}</td></tr>
      <tr><td>Banker</td><td>${pct(res.B)}</td></tr>
      <tr><td>Tie</td><td>${pct(res.T)}</td></tr>
    </table>
    <div class="stat">
      <span class="badge">Player Pair: <b>${pct(res.pairP)}</b></span>
      <span class="badge">Banker Pair: <b>${pct(res.pairB)}</b></span>
      <span class="badge">Natural (8/9): <b>${pct(res.natural)}</b></span>
    </div>
    <p><b>🎯 แนะนำเดิมพัน (ตาถัดไป):</b> ${best} — ${pct(bestP)}</p>
  `;
}

// ===== Wire up =====
function setup(){
  buildRankSelects();
  renderStock();


  $("preset8").onclick=()=>{ shoe=initShoe(8); renderStock(); };
  $("saveShoe").onclick=()=>saveShoe();
  $("loadShoe").onclick=()=>loadShoe();

  $("calcRound").onclick=()=>{
    const p1=$("p1").value, p2=$("p2").value, b1=$("b1").value, b2=$("b2").value;
    const p3=$("p3opt").value||null, b3=$("b3opt").value||null; const out = analyzeCurrentRound(p1,p2,b1,b2,p3,b3);
    if(out.error){ alert(out.error); return; }
    renderCurrent(out);
  };

  $("applyRound").onclick=()=>{
    const p1=$("p1").value, p2=$("p2").value, b1=$("b1").value, b2=$("b2").value;
    const p3=$("p3opt").value || null, b3=$("b3opt").value || null;
    if(applyRoundToShoe(p1,p2,b1,b2,p3,b3)){
      alert("ตัดสต็อกจากตานี้เรียบร้อย");
    }
  };

  $("simNext").onclick=()=>{
    const trials = Math.max(2000, parseInt($("trials").value||"10000",10));
    const res = simulateNext(trials);
    renderNext(res, trials);
  };
}

document.addEventListener("DOMContentLoaded", setup);
