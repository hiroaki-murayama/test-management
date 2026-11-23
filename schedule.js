
const $ = id => document.getElementById(id);
const statuses = ['未整理','要確認','未着手','進行中','確認待ち','提出済','完了','保留'];
const parentKinds = ['研究プロジェクト','出願先','奨学金','出願Step'];
const empty = () => ({data:{schemaVersion:1,entries:[]}, revision:0});
const completed = entry => ['完了','提出済'].includes(entry.status);
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
const dayKey = date => date.toISOString().slice(0,10);
const utc = key => new Date(key+'T00:00:00Z');
const shiftDay = (key,days) => dayKey(new Date(utc(key).valueOf()+days*86400000));
const sortDates = entries => entries.sort((a,b)=>a.due.localeCompare(b.due)||a.title.localeCompare(b.title,'ja'));
function upcoming(entries, start){
  const dates = sortDates(entries.filter(entry=>entry.due&&!completed(entry)));
  return {late:dates.filter(entry=>entry.due<start),soon:dates.filter(entry=>entry.due>=start&&entry.due<=shiftDay(start,6))};
}
function el(tag, text, className){
  const node = document.createElement(tag);
  if(text != null)node.textContent=text;
  if(className)node.className=className;
  return node;
}
function transact(mode, action) {
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open('research-phd-workspace-v1',1);
    request.onupgradeneeded = ()=>request.result.createObjectStore('workspace');
    request.onerror = ()=>reject(request.error);
    request.onsuccess = ()=>{
      const db=request.result;
      try {
        const tx=db.transaction('workspace',mode);
        const store=tx.objectStore('workspace');
        const read=store.get('records');
        let result, failure;
        read.onsuccess=()=>{
          try {result=action(read.result??empty(),store);}
          catch(error){failure=error;tx.abort();}
        };
        tx.oncomplete=()=>{db.close();resolve(result);};
        tx.onabort=()=>{db.close();reject(failure||tx.error||new Error('端末内データを保存できませんでした。'));};
      } catch(error){db.close();reject(error);}
    };
  });
}
const readWorkspace = () => transact('readonly',workspace=>workspace);
function mountHome(){
  const widget=el('section',null,'schedule-widget');
  widget.setAttribute('aria-label','直近7日間の予定');
  const root=$('root');
  let timer, target, generation=0;
  async function update(){
    const draw=++generation;
    const header=el('div',null,'schedule-head');
    header.append(el('h2','直近7日間'));
    const link=el('a','月間カレンダー →');
    link.href='./calendar.html';
    header.append(link);
    try {
      const {data}=await readWorkspace();
      if(draw!==generation||!widget.isConnected)return;
      const {late,soon}=upcoming(data.entries,today());
      header.firstChild.textContent='直近7日間 · '+soon.length+'件';
      widget.replaceChildren(header);
      if(late.length){
        const overdue=el('a','期限超過 '+late.length+'件','schedule-late');
        overdue.href='./calendar.html#overdue';
        widget.append(overdue);
      }
      const list=el('ul');
      for(const entry of soon.slice(0,5)){
        const row=el('li');
        const date=el('time',entry.due.slice(5).replace('-','/'));
        date.dateTime=entry.due;
        const item=el('a',entry.title);
        item.href='./calendar.html#'+entry.due;
        row.append(date,item);
        list.append(row);
      }
      widget.append(soon.length?list:el('p','直近7日間の締切・予定はありません。'));
    }catch(error){
      if(draw===generation)widget.replaceChildren(header,el('p','予定を読み込めませんでした。'));
    }
  }
  function sync(){
    const host=root.querySelector('.home-layout');
    if(host!==target){target=host; if(!host)widget.remove();}
    if(!host)return;
    if(!widget.isConnected)host.insertBefore(widget,host.querySelector('.home-summary')?.nextSibling??null);
    clearTimeout(timer);
    timer=setTimeout(update,80);
  }
  new MutationObserver(changes=>{
    if(changes.some(change=>!widget.contains(change.target)))sync();
  }).observe(root,{childList:true,subtree:true,characterData:true});
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&sessionStorage.getItem('calendar-changed')){
      sessionStorage.removeItem('calendar-changed');
      location.reload();
      return;
    }
    sessionStorage.removeItem('calendar-changed');
    sync();
  });
  window.addEventListener('focus',sync);
  sync();
}
function mountCalendar(){
  let records=[], editing=null;
  let selected=/^#\d{4}-\d{2}-\d{2}$/.test(location.hash)&&Number.isFinite(utc(location.hash.slice(1)).valueOf())?location.hash.slice(1):today();
  let month=selected.slice(0,7)+'-01',overdue=location.hash==='#overdue';
  const dialog=$('event-dialog'), form=$('event-form');
  $('event-status').replaceChildren(...statuses.map(status=>new Option(status,status)));
  const parentOf=entry=>records.find(parent=>entry.related.includes(parent.id)&&parentKinds.includes(parent.kind));
  function render(){
    const now=today(), first=utc(month);
    $('month-title').textContent=first.getUTCFullYear()+'年 '+(first.getUTCMonth()+1)+'月';
    const days=$('calendar-grid');
    days.replaceChildren(...['月','火','水','木','金','土','日'].map(day=>el('span',day,'calendar-weekday')));
    const included=sortDates(records.filter(e=>e.due&&($('show-completed').checked||!completed(e))));
    const byDate=new Map();
    for(const entry of included){
      if(!byDate.has(entry.due))byDate.set(entry.due,[]);
      byDate.get(entry.due).push(entry);
    }
    for(let i=0;i<(first.getUTCDay()+6)%7;i++)days.append(el('span'));
    for(let key=month;key.slice(0,7)===month.slice(0,7);key=shiftDay(key,1)){
      const count=byDate.get(key)?.length??0;
      const cell=el('button',Number(key.slice(8)));
      cell.setAttribute('aria-pressed',String(!overdue&&selected===key));
      if(key===now)cell.setAttribute('aria-current','date');
      cell.setAttribute('aria-label',key+' '+count+'件');
      if(count)cell.append(el('small',count+'件'));
      cell.onclick=()=>{selected=key;overdue=false;render();};
      days.append(cell);
    }
    const entries=overdue?upcoming(records,now).late:byDate.get(selected)??[];
    $('day-title').textContent=(overdue?'期限超過':selected.replaceAll('-','/'))+' · '+entries.length+'件';
    const list=$('day-events');
    list.replaceChildren();
    for(const entry of entries){
      const row=el('li');
      const button=el('button',entry.title);
      button.append(el('small',[overdue?entry.due:'',parentOf(entry)?.title||entry.group,entry.kind,entry.status].filter(Boolean).join(' · ')));
      button.onclick=()=>openEditor(entry);
      row.append(button); list.append(row);
    }
    if(!entries.length)list.append(el('li','予定はありません。'));
  }
  async function refresh(){
    try{records=(await readWorkspace()).data.entries;$('calendar-error').textContent='';render();}
    catch(error){$('calendar-error').textContent='予定を読み込めませんでした。';}
  }
  function move(delta){
    const date=utc(month);date.setUTCMonth(date.getUTCMonth()+delta);
    month=selected=dayKey(date);overdue=false;render();
  }
  function openEditor(entry){
    editing=entry;
    $('event-heading').textContent=entry?'予定・タスクを編集':'予定・タスクを追加';
    $('event-title').value=entry?.title??'';
    $('event-date').value=entry?.due??selected;
    $('event-status').value=entry?.status??'未着手';
    $('event-parent-label').hidden=!!entry;
    $('event-parent').replaceChildren(new Option('関連先なし',''),...records.filter(e=>parentKinds.includes(e.kind)).map(e=>new Option(e.title,e.id)));
    $('event-error').textContent='';
    dialog.showModal();
  }
  $('prev-month').onclick=()=>move(-1);
  $('next-month').onclick=()=>move(1);
  $('this-month').onclick=()=>{selected=today();month=selected.slice(0,7)+'-01';overdue=false;render();};
  $('show-completed').onchange=render;
  $('add-event').onclick=()=>openEditor(null);
  $('close-event').onclick=()=>dialog.close();
  form.onsubmit=async event=>{
    event.preventDefault();
    const title=$('event-title').value.trim(), due=$('event-date').value, status=$('event-status').value;
    const parentId=$('event-parent').value, previous=editing;
    if(!title||!due){$('event-error').textContent='タイトルと日付を入力してください。';return;}
    const submit=form.querySelector('[type=submit]');
    submit.disabled=true;
    try {
      records=await transact('readwrite',(workspace,store)=>{
        const current=workspace.data.entries;
        if(!previous&&current.length>=5000)throw new Error('登録上限の5000件に達しました。');
        const latest=previous&&current.find(entry=>entry.id===previous.id);
        if(previous&&(!latest||latest.updated!==previous.updated))throw new Error('別の画面で更新されました。閉じて開き直してください。');
        const parent=parentId&&current.find(entry=>entry.id===parentId);
        if(!previous&&parentId&&!parent)throw new Error('関連先が見つかりません。閉じて開き直してください。');
        const item={...(latest??{id:crypto.randomUUID(),kind:'メモ',priority:'中',group:parent?.group||'',related:parent?[parent.id]:[],next:'',body:'',links:'',version:'',progress:0,checks:[]}),title,due,status,updated:new Date().toISOString()};
        const entries=latest?current.map(entry=>entry.id===item.id?item:entry):[...current,item];
        store.put({data:{...workspace.data,entries},revision:workspace.revision+1},'records');
        return entries;
      });
      selected=due;month=due.slice(0,7)+'-01';overdue=false;
      if(completed({status}))$('show-completed').checked=true;
      try{sessionStorage.setItem('calendar-changed','1');}catch{}
      dialog.close();render();
    }catch(error){$('event-error').textContent=error.message;}
    finally{submit.disabled=false;}
  };
  window.addEventListener('pageshow',refresh);
  refresh();
}
if($('calendar-grid'))mountCalendar();
else if($('root'))mountHome();
