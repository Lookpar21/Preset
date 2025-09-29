
(function(){
  const RANKS = ["A","2","3","4","5","6","7","8","9","0"]; // 0=10/J/Q/K
  const VAL = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"0":0};
  const LS_KEY = "bacc_pro_stock_v1";
  const hist = {undo:[], redo:[]};

  function initCounts(decks){
    const c={}; for(const r of RANKS){ c[r]=(r==="0"?16:4)*decks; } return c;
  }
  let counts = initCounts(8); // default 8-deck

  // UI helpers
  function $(id){ return document.getElementById(id); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function sumCounts(c){ return Object.values(c).reduce((a,b)=>a+b,0); }
  function pushUndo(){ hist.undo.push(clone(counts)); hist.redo.length=0; }
  function take(c,r){ if(c[r]<=0) return false; c[r]--; return true; }
  function add(c,r){ c[r]++; }

  // Stock grid
  function renderStock(){
    const wrap = $("stockGrid");
    wrap.innerHTML = "";
    for(const r of RANKS){
      const div = document.createElement("div");
      div.className="counter";
      div.innerHTML = `
        <label style="min-width:52px">${r}</label>
        <button class="btn" data-r="${r}" data-op="-">-</button>
        <input type="number" min="0" value="${counts[r]}" data-r="${r}" />
        <button class="btn" data-r="${r}" data-op="+">+</button>
      `;
      wrap.appendChild(div);
    }
    wrap.querySelectorAll("button").forEach(btn=>{
      btn.onclick = ()=>{
        const r = btn.dataset.r, op = btn.dataset.op;
        pushUndo();
        if(op==="+") add(counts,r); else if(counts[r]>0) counts[r]--;
        renderStock();
      };
    });
    wrap.querySelectorAll("input").forEach(inp=>{
      inp.onchange = ()=>{
        pushUndo();
        const r = inp.dataset.r;
        counts[r] = Math.max(0, parseInt(inp.value||"0",10));
        renderStock();
      };
    });
  }

  // Select options
  function makeRankOptions(sel){ sel.innerHTML = RANKS.map(r=>`<option>${r}</option>`).join(""); }
  ["p1","p2","b1","b2"].forEach(id=>makeRankOptions($(id)));

  // Presets & stock ops
  $("preset6").onclick = ()=>{ pushUndo(); counts = initCounts(6); renderStock(); };
  $("preset8").onclick = ()=>{ pushUndo(); counts = initCounts(8); renderStock(); };
  $("resetShoe").onclick = ()=>{ pushUndo(); counts = initCounts(8); renderStock(); };

  $("saveLocal").onclick = ()=>{ localStorage.setItem(LS_KEY, JSON.stringify(counts)); alert("บันทึกสถานการณ์แล้ว"); };
  $("loadLocal").onclick = ()=>{ const s=localStorage.getItem(LS_KEY); if(!s) return alert("ยังไม่มีการบันทึก"); pushUndo(); counts=JSON.parse(s); renderStock(); };
  $("doExport").onclick = ()=>{ $("exportBox").value = JSON.stringify(counts); };
  $("doImport").onclick = ()=>{ try{ const obj = JSON.parse($("importBox").value); for(const r of RANKS){ if(typeof obj[r]!=="number") throw 0; } pushUndo(); counts=obj; renderStock(); }catch(e){ alert("JSON ไม่ถูกต้อง"); } };
  $("undo").onclick = ()=>{ if(hist.undo.length){ hist.redo.push(clone(counts)); counts = hist.undo.pop(); renderStock(); } };
  $("redo").onclick = ()=>{ if(hist.redo.length){ hist.undo.push(clone(counts)); counts = hist.redo.pop(); renderStock(); } };

  // Apply 4 open cards to stock
  $("applyOpen").onclick = ()=>{
    const P1=$("p1").value,P2=$("p2").value,B1=$("b1").value,B2=$("b2").value;
    const wants=[P1,B1,P2,B2];
    const c=clone(counts);
    for(const r of wants){ if(c[r]<=0) return alert("สต็อกไม่พอ: "+r); c[r]--; }
    pushUndo(); counts=c; renderStock(); alert("ตัดสต็อกจากไพ่เปิด 4 ใบเรียบร้อย");
  };

  // Baccarat rules
  function total2(r1,r2){ return (VAL[r1]+VAL[r2])%10; }
  function playerDraws(t){ return t<=5; }
  function bankerDraws(bTot, playerDrew, p3){
    if(!playerDrew) return bTot<=5;
    if(bTot<=2) return true;
    if(bTot===3) return p3!=="8";
    if(bTot===4) return ["2","3","4","5","6","7"].includes(p3);
    if(bTot===5) return ["4","5","6","7"].includes(p3);
    if(bTot===6) return ["6","7"].includes(p3);
    return false; // 7 stand
  }

  function pct(x){ return (x*100).toFixed(3)+"%"; }
  function small(x){
    if(x<1e-6) return x.toExponential(2);
    if(x<1e-3) return x.toFixed(6);
    return x.toFixed(6);
  }

  function humanSeq(s){ return [s.P1,s.B1,s.P2,s.B2,s.P3||"—",s.B3||"—"].join(", "); }

  function computeRound(){
    const P1=$("p1").value,P2=$("p2").value,B1=$("b1").value,B2=$("b2").value;
    // check feasibility
    const need = {}; [P1,P2,B1,B2].forEach(r=>{need[r]=(need[r]||0)+1;});
    for(const r in need){ if(counts[r]<need[r]) return {error:"สต็อกไม่พอต่อไพ่เปิด 4 ใบ: "+r}; }

    const base = clone(counts);
    // conditional model: remove the 4 open cards
    [P1,B1,P2,B2].forEach(r=>{ base[r]--; });

    const R0 = sumCounts(base);
    const p2 = total2(P1,P2);
    const b2 = total2(B1,B2);
    const natural = (p2===8||p2===9)||(b2===8||b2===9);

    const outputs = { sequences:[], p3dist:{}, b3dist:{}, outcomes:{Player:0,Banker:0,Tie:0} };
    function addOutcome(p,b,prob){ if(p>b) outputs.outcomes.Player+=prob; else if(b>p) outputs.outcomes.Banker+=prob; else outputs.outcomes.Tie+=prob; }

    if(natural){
      outputs.sequences.push({seq:{P1,B1,P2,B2}, prob:1});
      addOutcome(p2,b2,1);
      outputs.p3dist=null; outputs.b3dist=null;
      return {outputs, R0, p2, b2, natural:true};
    }

    const pMust = playerDraws(p2);
    if(!pMust){
      // Player stands
      const bMust = bankerDraws(b2,false,null);
      if(!bMust){
        outputs.sequences.push({seq:{P1,B1,P2,B2}, prob:1});
        addOutcome(p2,b2,1);
        outputs.p3dist=null; outputs.b3dist=null;
        return {outputs, R0, p2, b2, natural:false};
      } else {
        for(const y of RANKS){
          const cy = base[y]; if(cy<=0) continue;
          const prob = cy / R0;
          const bTot = (b2 + VAL[y])%10;
          outputs.sequences.push({seq:{P1,B1,P2,B2,B3:y}, prob});
          outputs.b3dist[y]=(outputs.b3dist[y]||0)+prob;
          addOutcome(p2,bTot,prob);
        }
        outputs.p3dist=null;
        return {outputs, R0, p2, b2, natural:false};
      }
    } else {
      // Player draws one, then Banker maybe draws
      for(const x of RANKS){
        const cx = base[x]; if(cx<=0) continue;
        const probP3 = cx / R0;
        outputs.p3dist[x]=(outputs.p3dist[x]||0)+probP3;

        const afterP = clone(base); afterP[x]--; const R1 = R0-1;
        const pTot = (p2 + VAL[x])%10;
        const bMust = bankerDraws(b2,true,x);

        if(!bMust){
          outputs.sequences.push({seq:{P1,B1,P2,B2,P3:x}, prob:probP3});
          addOutcome(pTot,b2,probP3);
        } else {
          for(const y of RANKS){
            const cy = afterP[y]; if(cy<=0) continue;
            const prob = probP3 * (cy / R1);
            const bTot = (b2 + VAL[y])%10;
            outputs.sequences.push({seq:{P1,B1,P2,B2,P3:x,B3:y}, prob});
            outputs.b3dist[y]=(outputs.b3dist[y]||0)+(probP3 * (cy/R1));
            addOutcome(pTot,bTot,prob);
          }
        }
      }
      return {outputs, R0, p2, b2, natural:false};
    }
  }

  function render(res){
    if(res.error){ alert(res.error); return; }
    $("outputs").style.display="block";

    const {outputs,R0,p2,b2,natural} = res;
    // Summary
    $("summary").innerHTML = `
      <div class="grid g-3">
        <div class="stat"><span>ไพ่คงเหลือหลัง “สมมติ” เปิด 4 ใบ</span><b>${R0}</b></div>
        <div class="stat"><span>แต้มสองใบแรก • Player</span><b>${p2}</b></div>
        <div class="stat"><span>แต้มสองใบแรก • Banker</span><b>${b2}</b></div>
      </div>
      <div style="margin-top:8px">
        ${ natural ? `<span class="pill">จบด้วย Natural (4 ใบ)</span>` :
          (p2<=5 ? `<span class="pill">Player ต้องจั่ว</span>` : `<span class="pill">Player ยืน</span>`)
        }
        ${
          natural ? "" :
          (p2<=5 ? `<span class="pill">Banker จั่วตามตาราง (ขึ้นกับไพ่ใบที่ 3 ของ Player)</span>` :
                    (b2<=5 ? `<span class="pill">Banker ต้องจั่ว</span>` : `<span class="pill">Banker ยืน</span>`))
        }
      </div>
    `;

    // P3 dist
    const p3Box = $("p3dist");
    if(outputs.p3dist===null){
      p3Box.innerHTML = `<div class="muted">ไม่มีการจั่วไพ่ใบที่ 3 ของ Player</div>`;
    }else if(Object.keys(outputs.p3dist).length===0){
      p3Box.innerHTML = `<div class="muted">Player ยืน</div>`;
    }else{
      const rows = Object.entries(outputs.p3dist).sort((a,b)=>b[1]-a[1])
        .map(([r,p])=>`<tr><td class="mono">${r}</td><td>${pct(p)}</td></tr>`).join("");
      p3Box.innerHTML = `<table><thead><tr><th>หน้าไพ่</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // B3 dist
    const b3Box = $("b3dist");
    if(outputs.b3dist===null){
      b3Box.innerHTML = `<div class="muted">ไม่มีการจั่วไพ่ใบที่ 3 ของ Banker</div>`;
    }else if(Object.keys(outputs.b3dist).length===0){
      b3Box.innerHTML = `<div class="muted">Banker ยืน</div>`;
    }else{
      const rows = Object.entries(outputs.b3dist).sort((a,b)=>b[1]-a[1])
        .map(([r,p])=>`<tr><td class="mono">${r}</td><td>${pct(p)}</td></tr>`).join("");
      b3Box.innerHTML = `<table><thead><tr><th>หน้าไพ่</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // Sequences
    const topk = parseInt($("topk").value,10)||20;
    const seqs = outputs.sequences.slice().sort((a,b)=>b.prob-a.prob);
    const cut = seqs.slice(0, topk);
    const totalProb = outputs.sequences.reduce((s,v)=>s+v.prob,0);
    const rows = cut.map((s,i)=>`
      <tr>
        <td>${i+1}</td>
        <td class="mono">${humanSeq(s.seq)}</td>
        <td>${pct(s.prob)}</td>
        <td class="muted mono small">${small(s.prob)}</td>
      </tr>
    `).join("");
    $("seqTable").innerHTML = `
      <table>
        <thead><tr><th>#</th><th>ลำดับ</th><th>%</th><th class="mono">p</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" class="muted">ไม่มีลำดับ (จบ natural หรือยืนทั้งคู่)</td></tr>`}</tbody>
        <tfoot><tr><th colspan="2" class="muted">ผลรวมความน่าจะเป็นทั้งหมด</th><th colspan="2">${pct(totalProb)}</th></tr></tfoot>
      </table>
    `;

    // Outcomes summary
    const P = outputs.outcomes.Player, B = outputs.outcomes.Banker, T = outputs.outcomes.Tie;
    const sum = P+B+T;
    $("finalOutcomes").innerHTML = `
      <div class="grid g-3">
        <div class="stat"><span>Player ชนะ</span><b class="ok">${pct(P)}</b><span class="muted mono small">${small(P)}</span></div>
        <div class="stat"><span>Banker ชนะ</span><b class="bad">${pct(B)}</b><span class="muted mono small">${small(B)}</span></div>
        <div class="stat"><span>Tie</span><b class="warn">${pct(T)}</b><span class="muted mono small">${small(T)}</span></div>
      </div>
      <div class="muted small" style="margin-top:6px">ตรวจสอบ: ผลรวม ≈ ${pct(sum)}</div>
    `;
  }

  $("calc").onclick = ()=>{ const res = computeRound(); render(res); };

  // Initial render
  renderStock();
})();
