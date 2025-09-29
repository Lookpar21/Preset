// v3.3 App JS (ตัดสต็อก, Undo/Redo, Monte Carlo, AutoSave ครบ)
const RANKS=["A","2","3","4","5","6","7","8","9","0"];
const VAL={A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"0":0};
let shoe={},undoStack=[],redoStack=[];
const LS_KEY="bacc_v33_autosave";
const $=id=>document.getElementById(id);
const clone=o=>JSON.parse(JSON.stringify(o));
function initShoe(){shoe={};for(const r of RANKS)shoe[r]=(r==="0"?16:4)*8;renderStock();saveAll();}
function renderStock(){const wrap=$("stock");wrap.innerHTML="";$("stockSummary").innerHTML=`รวมคงเหลือ: <b>${Object.values(shoe).reduce((a,b)=>a+b,0)}</b> ใบ`;for(const r of RANKS){wrap.innerHTML+=`<div class='slot'><h5>${r}</h5><div>${shoe[r]}</div></div>`;}}
function total2(r1,r2){return(VAL[r1]+VAL[r2])%10;}
function playerDraws(t){return t<=5;}
function bankerDraws(bt,pDrew,p3){if(!pDrew)return bt<=5;if(bt<=2)return true;if(bt===3)return p3!=="8";if(bt===4)return["2","3","4","5","6","7"].includes(p3);if(bt===5)return["4","5","6","7"].includes(p3);if(bt===6)return["6","7"].includes(p3);return false;}
function analyzeCurrent(){/* simplified: distribution + outcome calc */const p1=$("p1").value,p2=$("p2").value,b1=$("b1").value,b2=$("b2").value; if(!p1||!p2||!b1||!b2){alert("ใส่ไพ่ครบก่อน");return;}const base=clone(shoe);[p1,p2,b1,b2].forEach(r=>base[r]--);let pTot=total2(p1,p2),bTot=total2(b1,b2);const natural=pTot>=8||bTot>=8;let result="";if(natural){if(pTot>bTot)result=`🎯 Player ชนะด้วย ${pTot} ต่อ ${bTot}`;else if(bTot>pTot)result=`🎯 Banker ชนะด้วย ${bTot} ต่อ ${pTot}`;else result=`🎯 Tie ${pTot}-${bTot}`;}else{result=`Player=${pTot}, Banker=${bTot}`;}$("currentOutcome").innerHTML=`<p>${result}</p>`;}
function applyRound(){undoStack.push(JSON.stringify(shoe));redoStack=[];["p1","p2","b1","b2","p3","b3"].forEach(id=>{const v=$(id).value;if(v)shoe[v]--;});renderStock();saveAll();}
function undo(){if(!undoStack.length)return;redoStack.push(JSON.stringify(shoe));shoe=JSON.parse(undoStack.pop());renderStock();saveAll();}
function redo(){if(!redoStack.length)return;undoStack.push(JSON.stringify(shoe));shoe=JSON.parse(redoStack.pop());renderStock();saveAll();}
function simulate(){const trials=parseInt($("trials").value)||10000;let P=0,B=0,T=0;for(let i=0;i<trials;i++){const c=clone(shoe);function draw(){const tot=Object.values(c).reduce((a,b)=>a+b,0);let k=Math.floor(Math.random()*tot)+1;for(const r of RANKS){if(c[r]>0){if(k<=c[r]){c[r]--;return r;}k-=c[r];}}}const P1=draw(),B1=draw(),P2=draw(),B2=draw();let pTot=total2(P1,P2),bTot=total2(B1,B2);const natural=pTot>=8||bTot>=8;if(natural){if(pTot>bTot)P++;else if(bTot>pTot)B++;else T++;continue;}if(playerDraws(pTot))pTot=(pTot+VAL[draw()])%10;if(bankerDraws(bTot,true,null))bTot=(bTot+VAL[draw()])%10;if(pTot>bTot)P++;else if(bTot>pTot)B++;else T++;}$("nextOutcome").innerHTML=`<p>Player ${(P/trials*100).toFixed(2)}% Banker ${(B/trials*100).toFixed(2)}% Tie ${(T/trials*100).toFixed(2)}%</p>`;}
function saveAll(){localStorage.setItem(LS_KEY,JSON.stringify({shoe,sel:{p1:$("p1").value,p2:$("p2").value,b1:$("b1").value,b2:$("b2").value,p3:$("p3").value,b3:$("b3").value}}));}
function loadAll(){const raw=localStorage.getItem(LS_KEY);if(!raw)return initShoe();try{const st=JSON.parse(raw);shoe=st.shoe||{};if(Object.keys(shoe).length===0)initShoe();else renderStock();Object.entries(st.sel).forEach(([k,v])=>{if($(k))$(k).value=v;});}catch{initShoe();}}
function buildSelects(){const opts="<option value=''>-</option>"+RANKS.map(r=>`<option value='${r}'>${r}</option>`).join("");["p1","p2","b1","b2","p3","b3"].forEach(id=>$(id).innerHTML=opts);}
document.addEventListener("DOMContentLoaded",()=>{buildSelects();loadAll();$("preset8").onclick=initShoe;$("resetStock").onclick=initShoe;$("calc").onclick=analyzeCurrent;$("apply").onclick=applyRound;$("undo").onclick=undo;$("redo").onclick=redo;$("simulate").onclick=simulate;});