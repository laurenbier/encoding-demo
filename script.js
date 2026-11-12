"use strict";

// Original PSYC 402 practice experiment. No external libraries or server are required.
const WORD_LISTS = [
  ["apple", "chair", "river", "pencil", "window", "garden"],
  ["bicycle", "candle", "mountain", "spoon", "rabbit", "mirror"],
  ["blanket", "camera", "flower", "ladder", "orange", "pillow"]
];
const STRATEGIES = [
  {id:"rehearsal", label:"Maintenance rehearsal", description:"Repeat each word silently to yourself several times while it is on the screen.", detail:"Focus on repeating the exact word over and over. You do not need to invent a story or mental image."},
  {id:"self_reference", label:"Self-reference", description:"Think about how each word relates to you or your own life.", detail:"For each word, consider a personal experience, preference, or memory involving that object."},
  {id:"imagery", label:"Mental imagery", description:"Create a clear mental picture of each word.", detail:"Imagine what the object looks like, including its shape, color, and surrounding scene."}
];
const WORD_DURATION_MS = 4000;
const DISTRACTOR_DURATION_MS = 30000;
const $ = id => document.getElementById(id);
const screens = ["welcome","instruction","study","distractor-intro","distractor","recall","results"];
let session = null;
let activeTimer = null;

function shuffle(items) {
  const copy = [...items];
  // Unbiased Fisher-Yates shuffle, with cryptographic randomness when available.
  for(let i=copy.length-1;i>0;i--){
    let j;
    if(globalThis.crypto && typeof crypto.getRandomValues === "function"){
      const range=i+1, max=0x100000000, limit=max-(max%range);
      let value; do { value=crypto.getRandomValues(new Uint32Array(1))[0]; } while(value>=limit);
      j=value%range;
    }else{ j=Math.floor(Math.random()*(i+1)); }
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}
function updateProgress(screenId){
  const progress=$("experiment-progress");
  if(screenId==="welcome"){
    progress.classList.add("hidden");
    return;
  }
  progress.classList.remove("hidden");
  let stage, label;
  if(screenId==="instruction" || screenId==="study"){
    stage=session.blockIndex+1;
    label=`Encoding block ${stage} of 3`;
  }else if(screenId==="distractor-intro" || screenId==="distractor"){
    stage=4; label="Distractor task";
  }else if(screenId==="recall"){
    stage=5; label="Final free recall";
  }else{
    stage=5; label="Experiment complete";
  }
  const percent=screenId==="results"?100:Math.round((stage-1)/5*100);
  $("progress-label").textContent=label;
  $("progress-percent").textContent=`${percent}% complete`;
  $("progress-fill").style.width=`${percent}%`;
  $("progress-track").setAttribute("aria-valuenow",String(percent));
}
function showScreen(id){
  updateProgress(id);
  screens.forEach(name=>$(name).classList.toggle("hidden",name!==id));
  $("main").focus({preventScroll:true});
  window.scrollTo(0,0);
}
function clearTimer(){if(activeTimer!==null){clearInterval(activeTimer);activeTimer=null;}}
function createSession(){
  const strategyOrder=shuffle(STRATEGIES);
  const listOrder=shuffle(WORD_LISTS.map((words,index)=>({words,index})));
  const blocks=strategyOrder.map((strategy,i)=>({strategy,listIndex:listOrder[i].index,words:[...listOrder[i].words]}));
  return {
    id:`session-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    startedAt:new Date().toISOString(),blocks,blockIndex:0,studyRecords:[],
    distractorStart:null,distractorEnd:null,distractorStartNumber:null,distractorEntries:[],
    recallText:"",recalledTokens:[],results:[],finishedAt:null
  };
}
function startExperiment(){clearTimer();session=createSession();showInstructions();}
function showInstructions(){
  const {strategy}=session.blocks[session.blockIndex];
  $("block-counter").textContent=`ENCODING BLOCK ${session.blockIndex+1} OF 3`;
  $("instruction-title").textContent=strategy.label;
  $("instruction-description").textContent=strategy.description;
  $("instruction-detail").textContent=strategy.detail;
  showScreen("instruction");
}
function beginBlock(){
  const block=session.blocks[session.blockIndex];
  let wordIndex=0;
  $("study-block-label").textContent=`BLOCK ${session.blockIndex+1} OF 3`;
  $("study-strategy").textContent=block.strategy.label;
  showScreen("study");
  function nextWord(){
    clearTimer();
    if(wordIndex>=block.words.length){
      session.blockIndex++;
      if(session.blockIndex<3)showInstructions();else showScreen("distractor-intro");
      return;
    }
    const word=block.words[wordIndex];
    session.studyRecords.push({word,strategy:block.strategy.id,strategyLabel:block.strategy.label,
      blockNumber:session.blockIndex+1,listNumber:block.listIndex+1,position:wordIndex+1});
    $("study-word").textContent=word.toUpperCase();
    $("word-count").textContent=`Word ${wordIndex+1} of 6`;
    const start=performance.now();wordIndex++;
    $("word-timer").style.width="100%";
    activeTimer=setInterval(()=>{
      const elapsed=performance.now()-start;
      $("word-timer").style.width=`${Math.max(0,100*(1-elapsed/WORD_DURATION_MS))}%`;
      if(elapsed>=WORD_DURATION_MS)nextWord();
    },50);
  }
  nextWord();
}
function beginDistractor(){
  session.distractorStartNumber=300+Math.floor(Math.random()*600);
  session.distractorStart=new Date().toISOString();
  session.distractorEntries=[];
  $("starting-number").textContent=session.distractorStartNumber;
  $("count-total").textContent="0";
  $("count-input").value="";
  $("count-feedback").textContent="Keep going until the timer finishes.";
  showScreen("distractor");$("count-input").focus();
  const start=performance.now();
  $("seconds-left").textContent="30";
  clearTimer();
  activeTimer=setInterval(()=>{
    const remaining=Math.max(0,DISTRACTOR_DURATION_MS-(performance.now()-start));
    $("seconds-left").textContent=String(Math.ceil(remaining/1000));
    if(remaining<=0){
      clearTimer();session.distractorEnd=new Date().toISOString();
      $("recall-input").value="";showScreen("recall");$("recall-input").focus();
    }
  },50);
}
function submitCount(event){
  event.preventDefault();
  if(!session || !session.distractorStart || session.distractorEnd)return;
  const input=$("count-input"),value=Number(input.value);
  if(!input.value.trim()||!Number.isFinite(value))return;
  const expected=session.distractorStartNumber-3*(session.distractorEntries.length+1);
  session.distractorEntries.push({entered:value,expected,correct:value===expected});
  $("count-total").textContent=String(session.distractorEntries.length);
  $("count-feedback").textContent="Number recorded. Keep subtracting 3.";
  input.value="";input.focus();
}
function normalizeWord(word){return word.toLowerCase().normalize("NFKC").replace(/[^a-z]/g,"");}
function editDistanceAtMostOne(a,b){
  if(a===b)return true;
  if(Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,edits=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue;}
    if(++edits>1)return false;
    if(a.length>b.length)i++;
    else if(b.length>a.length)j++;
    else{i++;j++;}
  }
  return edits+(a.length-i)+(b.length-j)<=1;
}
function scoreRecall(text){
  // Stimuli are single common words. Tokenization supports spaces, commas and newlines.
  const tokens=text.split(/[\s,;]+/).map(normalizeWord).filter(Boolean);
  const remaining=[...tokens];
  const records=session.studyRecords;
  const matched=new Set();
  // Match exact responses first, so typos cannot take precedence over exact matches.
  for(let i=0;i<records.length;i++){
    const index=remaining.indexOf(records[i].word);
    if(index!==-1){matched.add(i);remaining.splice(index,1);}
  }
  // Accept one-character omissions, insertions or substitutions for words >=5 letters.
  // Reject ambiguous near-matches rather than falsely attributing a word to a strategy.
  for(let i=0;i<records.length;i++){
    if(matched.has(i)||records[i].word.length<5)continue;
    const eligible=remaining.map((token,index)=>({token,index})).filter(({token})=>token.length>=4&&editDistanceAtMostOne(token,records[i].word));
    for(const candidate of eligible){
      const possible=records.filter((r,k)=>!matched.has(k)&&r.word.length>=5&&editDistanceAtMostOne(candidate.token,r.word));
      if(possible.length===1){matched.add(i);remaining.splice(candidate.index,1);break;}
    }
  }
  return {tokens,results:records.map((record,index)=>({...record,recalled:matched.has(index)?1:0}))};
}
function submitRecall(){
  session.recallText=$("recall-input").value;
  const scored=scoreRecall(session.recallText);
  session.recalledTokens=scored.tokens;session.results=scored.results;
  session.finishedAt=new Date().toISOString();
  const container=$("score-cards");container.replaceChildren();
  let total=0;
  STRATEGIES.forEach(strategy=>{
    const score=scored.results.filter(r=>r.strategy===strategy.id&&r.recalled).length;
    total+=score;
    const card=document.createElement("div");card.className="score-card";
    const title=document.createElement("h2");title.textContent=strategy.label;
    const number=document.createElement("strong");number.textContent=`${score} / 6`;
    const percent=document.createElement("span");percent.textContent=`${Math.round(score/6*100)}% recalled`;
    card.append(title,number,percent);container.append(card);
  });
  $("total-score").textContent=`Total recall: ${total} / 18 words (${Math.round(total/18*100)}%)`;
  showScreen("results");
}
function csvEscape(value){const str=String(value??"");return /[",\r\n]/.test(str)?`"${str.replace(/"/g,'""')}"`:str;}
function makeCsv(columns,rows){return [columns.join(","),...rows.map(row=>columns.map(col=>csvEscape(row[col])).join(","))].join("\r\n")+"\r\n";}
function downloadCsv(filename,csv){
  const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function summaryData(){
  const row={session_id:session.id,started_at:session.startedAt,finished_at:session.finishedAt,
    strategy_order:session.blocks.map(b=>b.strategy.id).join(" | "),
    word_list_order:session.blocks.map(b=>b.listIndex+1).join(" | "),
    distractor_start_number:session.distractorStartNumber,distractor_entries:session.distractorEntries.length,
    distractor_correct_entries:session.distractorEntries.filter(x=>x.correct).length,
    recall_rehearsal:session.results.filter(r=>r.strategy==="rehearsal"&&r.recalled).length,
    recall_self_reference:session.results.filter(r=>r.strategy==="self_reference"&&r.recalled).length,
    recall_imagery:session.results.filter(r=>r.strategy==="imagery"&&r.recalled).length,
    total_recalled:session.results.filter(r=>r.recalled).length,
    total_studied:18,recall_response:session.recallText};
  return makeCsv(Object.keys(row),[row]);
}
function trialData(){
  const rows=session.results.map(r=>({session_id:session.id,word:r.word,strategy:r.strategy,
    strategy_label:r.strategyLabel,block_number:r.blockNumber,word_list_number:r.listNumber,
    position_in_block:r.position,recalled:r.recalled}));
  return makeCsv(["session_id","word","strategy","strategy_label","block_number","word_list_number","position_in_block","recalled"],rows);
}
$("start-btn").addEventListener("click",startExperiment);
$("begin-block-btn").addEventListener("click",beginBlock);
$("begin-distractor-btn").addEventListener("click",beginDistractor);
$("count-form").addEventListener("submit",submitCount);
$("submit-recall-btn").addEventListener("click",submitRecall);
$("download-summary-btn").addEventListener("click",()=>downloadCsv("encoding_summary.csv",summaryData()));
$("download-trials-btn").addEventListener("click",()=>downloadCsv("encoding_trials.csv",trialData()));
$("restart-btn").addEventListener("click",startExperiment);
