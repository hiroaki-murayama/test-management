
import {readWorkspace} from './schedule.js';
const root=document.getElementById('root');
const parentTypes=['出願先','奨学金'];
const attachedTypes=['出願Step','必要書類','研究計画書','推薦状','面接準備','CV','強み・懸念点'];
const closed=e=>['完了','提出済'].includes(e.status);
const node=(tag,content,cls)=>{
  const element=document.createElement(tag);
  if(content!=null)element.textContent=content;
  if(cls)element.className=cls;
  return element;
};
const sections=[
  ['書類・研究計画',['必要書類','研究計画書','CV']],
  ['推薦状',['推薦状']],
  ['面接準備',['面接準備','強み・懸念点']],
  ['予定・タスク',['メモ','マイルストーン']],
];
function organize(entries){
  const parents=entries.filter(entry=>parentTypes.includes(entry.kind));
  const used=new Set();
  const groups=parents.map(parent=>{
    const matches=entry=>entry.related.includes(parent.id)||
      (!!parent.group&&entry.group===parent.group&&!entry.related.some(id=>parents.some(p=>p.id===id&&p.id!==parent.id)));
    const stages=entries.filter(entry=>entry.kind==='出願Step'&&matches(entry)).sort((a,b)=>a.title.localeCompare(b.title,'ja',{numeric:true}));
    const stageItems=stages.map(stage=>{
      used.add(stage.id);
      const items=entries.filter(e=>!parentTypes.includes(e.kind)&&e.kind!=='出願Step'&&e.related.includes(stage.id));
      items.forEach(e=>used.add(e.id));
      return {stage,items};
    });
    const stageChildIds=new Set(stageItems.flatMap(group=>group.items.map(e=>e.id)));
    const direct=entries.filter(entry=>!parentTypes.includes(entry.kind)&&entry.kind!=='出願Step'&&!stageChildIds.has(entry.id)&&
      (entry.related.includes(parent.id)||(attachedTypes.includes(entry.kind)&&matches(entry))));
    direct.forEach(e=>used.add(e.id));
    return {parent,stageItems,direct};
  });
  return {groups,unlinked:entries.filter(e=>attachedTypes.includes(e.kind)&&!used.has(e.id)&&
    (e.kind==='出願Step'||['必要書類','推薦状','面接準備'].includes(e.kind)))};
}
if(root){
  const host=node('section',null,'application-overview');
  host.setAttribute('aria-label','出願・奨学金の構成');
  const top=node('div',null,'application-overview-top');
  const content=node('div');
  const toggle=node('button','一覧・比較を開く');
  toggle.type='button';
  top.append(node('strong','表示方法'),toggle);
  host.append(top,content);
  let main,toolbar,structured=true,last='',timer,serial=0;
  const expanded=new Map();
  function switchView(value){
    structured=value;
    if(main)main.classList.toggle('applications-structured',value);
    toggle.textContent=value?'一覧・比較を開く':'出願先ごとの表示に戻る';
    content.hidden=!value;
  }
  toggle.onclick=()=>switchView(!structured);
  function titleLine(item){
    const row=node('span',null,'application-entry-title');
    row.append(node('strong',item.title),node('span',item.status,closed(item)?'app-status app-done':'app-status'));
    if(item.due)row.append(node('time',item.due));
    return row;
  }
  function openNative(item){
    switchView(false);
    const titles=[...main.querySelectorAll('.record-title')];
    const title=titles.find(e=>e.textContent===item.title);
    if(title)title.closest('button')?.click();
    else toolbar.querySelector('input')?.focus();
  }
  function fold(id,summary,initial){
    const panel=node('details',null,'application-fold');
    panel.open=expanded.get(id)??initial;
    panel.ontoggle=()=>expanded.set(id,panel.open);
    const heading=node('summary');
    heading.append(summary);
    panel.append(heading);
    return panel;
  }
  function entryPanel(item){
    const panel=fold('item:'+item.id,titleLine(item),false);
    const body=node('div',null,'application-entry-info');
    if(item.next)body.append(node('p','次の行動　'+item.next));
    if(item.current)body.append(node('p',item.current));
    if(item.blocker)body.append(node('p','確認待ち・障害　'+item.blocker));
    if(item.body)body.append(node('p',item.body));
    if(item.checks?.length){
      const list=node('ul');
      for(const check of item.checks)list.append(node('li',(check.done?'✓ ':'')+check.text));
      body.append(list);
    }
    if(!body.childNodes.length)body.append(node('p','詳細メモはありません。'));
    panel.append(body);
    return panel;
  }
  function itemsPanel(items){
    const section=node('div',null,'application-items');
    const placed=new Set();
    for(const [label,kinds] of [...sections,['その他',null]]){
      const subset=items.filter(item=>!placed.has(item.id)&&(!kinds||kinds.includes(item.kind)));
      if(!subset.length)continue;
      subset.forEach(item=>placed.add(item.id));
      section.append(node('h3',label+' · '+subset.length+'件'));
      for(const item of subset)section.append(entryPanel(item));
    }
    return section;
  }
  function render(entries){
    const {groups,unlinked}=organize(entries);
    const signature=JSON.stringify([groups,unlinked]);
    if(signature===last)return;
    last=signature;
    content.replaceChildren();
    for(const kind of parentTypes){
      const list=groups.filter(g=>g.parent.kind===kind);
      const section=node('div',null,'application-category');
      section.append(node('h2',(kind==='出願先'?'PhD・入学出願':'奨学金')+' · '+list.length+'件'));
      if(!list.length)section.append(node('p','登録されていません。','application-empty'));
      for(const {parent,stageItems,direct} of list){
        const panel=fold('parent:'+parent.id,titleLine(parent),!closed(parent)&&list[0].parent.id===parent.id);
        const body=node('div',null,'application-fold-body');
        if(parent.current||parent.next)body.append(node('p',parent.current||'次の行動　'+parent.next));
        for(const {stage,items} of stageItems){
          const label=titleLine(stage);
          label.append(node('span',items.filter(closed).length+'/'+items.length+' 完了','app-progress'));
          const row=fold('stage:'+stage.id,label,stage.status==='進行中');
          const inner=node('div',null,'application-fold-body');
          if(stage.next)inner.append(node('p','次の行動　'+stage.next));
          if(items.length)inner.append(itemsPanel(items));
          row.append(inner);
          body.append(row);
        }
        if(direct.length)body.append(itemsPanel(direct));
        const button=node('button','管理画面を開く','application-manage');
        button.onclick=()=>openNative(parent);
        body.append(button);panel.append(body);section.append(panel);
      }
      content.append(section);
    }
    if(unlinked.length){
      const panel=fold('unlinked',node('strong','出願先に未接続 · '+unlinked.length+'件'),false);
      panel.append(itemsPanel(unlinked));content.append(panel);
    }
  }
  function sync(){
    const candidate=root.querySelector('main');
    const filters=candidate?.querySelector('.toolbar');
    const heading=candidate?.querySelector('h1')?.textContent?.trim();
    if(heading!=='出願・奨学金'||!filters){
      main?.classList.remove('applications-structured');
      host.remove();main=null;clearTimeout(timer);return;
    }
    if(!main){main=candidate;toolbar=filters;switchView(true);}
    if(!host.isConnected)filters.before(host);
    clearTimeout(timer);
    const token=++serial;
    timer=setTimeout(async()=>{
      try{const {data}=await readWorkspace();if(token===serial&&host.isConnected)render(data.entries);}
      catch{if(host.isConnected)content.textContent='構成を読み込めませんでした。一覧・比較から確認できます。';}
    },70);
  }
  new MutationObserver(changes=>{
    if(changes.some(change=>!host.contains(change.target)))sync();
  }).observe(root,{subtree:true,childList:true,characterData:true});
  window.addEventListener('pageshow',sync);
  window.addEventListener('focus',sync);
  sync();
}
