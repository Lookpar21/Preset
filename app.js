const RANKS = ["A","2","3","4","5","6","7","8","9","0"];
const VAL = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"0":0};

let shoe = {}; // 8-deck default
function resetShoe(decks=8){
  shoe = {};
  for (const r of RANKS){ shoe[r] = (r==="0"?16:4)*decks; }
}
resetShoe();

for (const id of ["p1","p2","b1","b2"]){
  const sel=document.getElementById(id);
  RANKS.forEach(r=>{
    const opt=document.createElement("option");
    opt.value=r; opt.text=r; sel.add(opt);
  });
}

function total2(r1,r2){return (VAL[r1]+VAL[r2])%10;}
function playerDraws(total){return total<=5;}
function bankerDraws(bTot,pDrew,p3){
  if(!pDrew) return bTot<=5;
  if(bTot<=2) return true;
  if(bTot===3) return p3!=="8";
  if(bTot===4) return ["2","3","4","5","6","7"].includes(p3);
  if(bTot===5) return ["4","5","6","7"].includes(p3);
  if(bTot===6) return ["6","7"].includes(p3);
  return false;
}

document.getElementById("calcBtn").onclick=()=>{
  const p1=document.getElementById("p1").value;
  const p2=document.getElementById("p2").value;
  const b1=document.getElementById("b1").value;
  const b2=document.getElementById("b2").value;
  let counts={...shoe};
  counts[p1]--; counts[p2]--; counts[b1]--; counts[b2]--;
  const R0=Object.values(counts).reduce((a,b)=>a+b,0);

  const p2tot=total2(p1,p2);
  const b2tot=total2(b1,b2);
  const natural=(p2tot===8||p2tot===9||b2tot===8||b2tot===9);
  let summary=`<p>Player แต้ม: ${p2tot}, Banker แต้ม: ${b2tot}</p>`;
  if(natural){ summary+="<p><b>Natural – จบที่ 4 ใบ</b></p>"; }
  document.getElementById("summary").innerHTML=summary;
  document.getElementById("results").classList.remove("hidden");

  let p3dist={}, outcome={P:0,B:0,T:0};

  if(!natural){
    const pDraw=playerDraws(p2tot);
    for(const x of RANKS){
      if(pDraw && counts[x]>0){
        let probP3=counts[x]/R0;
        const afterP={...counts}; afterP[x]--;
        const R1=R0-1;
        const pTot=(p2tot+VAL[x])%10;
        const bMust=bankerDraws(b2tot,true,x);
        if(!bMust){
          // banker stand
          if(pTot>b2tot) outcome.P+=probP3;
          else if(pTot<b2tot) outcome.B+=probP3;
          else outcome.T+=probP3;
        } else {
          for(const y of RANKS){
            if(afterP[y]>0){
              let prob=probP3*(afterP[y]/R1);
              const bTot=(b2tot+VAL[y])%10;
              if(pTot>bTot) outcome.P+=prob;
              else if(pTot<bTot) outcome.B+=prob;
              else outcome.T+=prob;
            }
          }
        }
        p3dist[x]=probP3;
      }
    }
  }

  let outHtml="<h3>ความน่าจะเป็นผลลัพธ์</h3><table><tr><th>ผล</th><th>%</th></tr>";
  outHtml+=`<tr><td>Player</td><td>${(outcome.P*100).toFixed(2)}%</td></tr>`;
  outHtml+=`<tr><td>Banker</td><td>${(outcome.B*100).toFixed(2)}%</td></tr>`;
  outHtml+=`<tr><td>Tie</td><td>${(outcome.T*100).toFixed(2)}%</td></tr>`;
  outHtml+="</table>";

  let best = "Player";
  let maxProb = outcome.P;
  if(outcome.B>maxProb){best="Banker"; maxProb=outcome.B;}
  if(outcome.T>maxProb){best="Tie"; maxProb=outcome.T;}

  outHtml+=`<p><b>🎯 แนะนำเดิมพัน:</b> ${best} (โอกาส ${(maxProb*100).toFixed(2)}%)</p>`;
  document.getElementById("outcomes").innerHTML=outHtml;
};
