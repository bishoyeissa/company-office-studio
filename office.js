const $=id=>document.getElementById(id);
const number=new Intl.NumberFormat('en-US');
const localOffice=location.hostname==='127.0.0.1' && location.port==='4247';
const rosterPath=new URL('.',location.href).pathname;
const storageKey='company-office/v2/'+rosterPath;
const legacyKey='company-office/v1/'+rosterPath;
const startingRoster=JSON.parse($('team-roster').textContent);
const profileFields=['name','role','duties'];
function browserRoster(){
  const current=localStorage.getItem(storageKey);
  const raw=current ?? localStorage.getItem(legacyKey);
  if(raw===null)return startingRoster.map(record=>({...record}));
  const records=JSON.parse(raw);
  if(!Array.isArray(records)||records.length!==startingRoster.length||records.some((e,i)=>!e||e.id!==i+1||profileFields.some(k=>typeof e[k]!=='string')))throw Error('Invalid roster');
  if(current===null){
    for(const [i,record] of records.entries()){
      for(const field of profileFields){
        if(!record[field].trim())record[field]=startingRoster[i][field];
      }
    }
  }
  return records;
}
if(!localOffice)$('storage-mode').textContent='Saved in this browser';
let employees=[],editing=null,original=null;
const title=e=>e.name || 'Employee '+number.format(e.id);
function render(){
  const query=$('search').value.trim().toLocaleLowerCase();
  $('list').replaceChildren();
  for(const e of employees){
    const name=title(e);OfficeScene.label(e.id-1,name,e.role);
    if(![name,e.role,String(e.id),number.format(e.id)].join(' ').toLocaleLowerCase().includes(query))continue;
    const b=document.createElement('button');b.className='staff';b.onclick=()=>{OfficeScene.visit(e.id-1);openEmployee(e.id-1)};
    const badge=document.createElement('span');badge.className='badge';badge.textContent=number.format(e.id);const avatar=document.createElement('img');avatar.alt='';avatar.src=OfficeScene.asset('employee-'+(e.id-1)+'.webp');badge.prepend(avatar);
    badge.style.setProperty('--tint',['#e1eee4','#f1e7d9','#e2e9ef','#efe3df'][e.id%4]);
    const text=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');
    strong.textContent=name;small.textContent=e.role || 'Role unassigned';text.append(strong,small);
    const activity=document.createElement('small');activity.className='staff-activity';activity.id='staff-activity-'+(e.id-1);
    activity.textContent=OfficeScene.activity(e.id-1);text.append(activity);
    const arrow=document.createElement('span');arrow.className='open';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
    b.append(badge,text,arrow);$('list').append(b);
  }
  if(!$('list').childElementCount){const p=document.createElement('p');p.className='empty';p.textContent='No matching employees.';$('list').append(p)}
  $('done').textContent=number.format(employees.filter(e=>e.name && e.role).length)+' / 14';
}
function openEmployee(i){
  const e=employees[i];if(!e)return;editing=i;original={...e};
  $('profile-task').hidden=i!==0;
  $('seat').textContent='Desk '+number.format(e.id);$('heading').textContent=title(e);
  $('empname').value=e.name;$('role').value=e.role;$('duties').value=e.duties;$('feedback').textContent='';
  $('card').showModal();
}
async function loadRoster(){
  if(!localOffice){employees=browserRoster();render();return}
  const res=await fetch('/api/employees',{cache:'no-store'});if(!res.ok)throw Error();
  employees=await res.json();render();
}
$('form').onsubmit=async event=>{
  event.preventDefault();if(editing===null)return;
  const next={name:$('empname').value.trim(),role:$('role').value.trim(),duties:$('duties').value.trim()};
  $('save').disabled=true;
  try{
    if(!localOffice){
      const records=browserRoster();
      if(JSON.stringify(records[editing])!==JSON.stringify(original)){employees=records;render();$('feedback').textContent='This profile changed in another tab. Reopen it to see the latest version.';return}
      records[editing]={...original,...next};
      localStorage.setItem(storageKey,JSON.stringify(records));employees=records;
    }else{
    const response=await fetch('/api/employees/'+original.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({original,values:next})});
    if(response.status===409){await loadRoster();$('feedback').textContent='This profile changed in another tab. Reopen it to see the latest version.';return}
    if(!response.ok)throw Error();
    employees=await response.json();
    }
    render();$('card').close();$('status').textContent='Saved the profile for '+title(employees[editing])+'.';
  }catch(e){$('feedback').textContent='Unable to save. Check your connection or browser storage settings.'}
  finally{$('save').disabled=false}
};
$('search').oninput=render;$('close').onclick=()=>$('card').close();
$('card').setAttribute('aria-labelledby','heading');
OfficeScene.init(openEmployee);employees=startingRoster;render();
loadRoster().catch(()=>{$('status').textContent='Unable to read the directory. Check your browser storage settings.'});

window.addEventListener('storage',event=>{if(!localOffice && [storageKey,legacyKey,null].includes(event.key))loadRoster().catch(()=>{$('status').textContent='Unable to refresh the team directory.'})});

const officePanel=$('office-panel');
const fullScreenButton=$('fullscreen-toggle');
function updateFullScreen(){
  const expanded=document.fullscreenElement===officePanel || officePanel.classList.contains('viewport-mode');
  officePanel.classList.toggle('expanded',expanded);
  fullScreenButton.setAttribute('aria-pressed',String(expanded));
  $('fullscreen-label').textContent=expanded?'Exit full screen':'Full screen';
}
function setViewportMode(enabled){
  officePanel.classList.toggle('viewport-mode',enabled);
  document.documentElement.classList.toggle('office-expanded',enabled);
  updateFullScreen();
}
fullScreenButton.addEventListener('click',async()=>{
  if(officePanel.classList.contains('viewport-mode')){
    setViewportMode(false);
  }else if(document.fullscreenElement===officePanel){
    await document.exitFullscreen();
  }else if(officePanel.requestFullscreen && document.fullscreenEnabled){
    try{await officePanel.requestFullscreen()}catch{setViewportMode(true)}
  }else{
    setViewportMode(true);
  }
});
document.addEventListener('fullscreenchange',updateFullScreen);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape' && officePanel.classList.contains('viewport-mode') && !officePanel.querySelector('dialog[open]')){
    setViewportMode(false);
    fullScreenButton.focus({preventScroll:true});
  }
});

const inbox=$('task-inbox');
const taskPrefix='office-studio/manager-inbox/'+rosterPath+'/';
let useOfficeInbox=localOffice;
let submission=null;
let historyVersion=0;
function browserTasks(){
  return Object.keys(localStorage).filter(key=>key.startsWith(taskPrefix))
    .map(key=>JSON.parse(localStorage.getItem(key))).sort((a,b)=>b.created.localeCompare(a.created));
}
async function refreshTasks(){
  const version=++historyVersion;
  let tasks;
  if(useOfficeInbox){
    const response=await fetch('/api/tasks',{cache:'no-store'});
    if(response.status===404){
      useOfficeInbox=false;
      $('task-storage').textContent='Tasks are saved in this browser. Copy a task to Codex to start work.';
      tasks=browserTasks();
    }else{
      if(!response.ok)throw Error('Inbox unavailable');
      tasks=[...await response.json(),...browserTasks()].sort((a,b)=>b.created.localeCompare(a.created));
    }
  }else tasks=browserTasks();
  if(version!==historyVersion)return;
  $('task-history').replaceChildren();
  for(const task of tasks){
    const item=document.createElement('li');
    const brief=document.createElement('p');brief.dir='auto';brief.textContent=task.brief;
    const time=document.createElement('small');
    time.textContent='Submitted · '+new Date(task.created).toLocaleString('en-US');
    const copy=document.createElement('button');copy.type='button';copy.textContent='Copy for Codex';
    copy.onclick=async()=>{
      try{
        await navigator.clipboard.writeText('Rami, please handle this task:\n\n'+task.brief);
        $('task-message').textContent='Copied. Paste the task into your Codex chat to start work.';
      }catch{
        const range=document.createRange();range.selectNodeContents(brief);
        const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
        $('task-message').textContent='The brief is selected. Use Copy on your device.';
      }
    };
    item.append(brief,time,copy);$('task-history').append(item);
  }
  if(!tasks.length)$('task-history').textContent='No tasks yet.';
}
async function openInbox(){
  if($('card').open)$('card').close();
  $('task-message').textContent='';
  inbox.showModal();
  $('task-brief').focus();
  try{await refreshTasks()}catch{$('task-message').textContent='Unable to load the task history.'}
}
if(localOffice)$('task-storage').textContent='Tasks are saved in the office inbox on this computer. Ask Codex to pick up a submitted task to start work.';
$('task-open').onclick=$('profile-task').onclick=openInbox;
$('inbox-close').onclick=()=>inbox.close();
$('task-brief').oninput=()=>{submission=null;$('task-brief').setCustomValidity('')};
$('task-form').onsubmit=async event=>{
  event.preventDefault();
  if($('send-task').disabled)return;
  const field=$('task-brief'),brief=field.value.trim();
  if(!brief){field.setCustomValidity('Enter a task brief.');field.reportValidity();return}
  $('send-task').disabled=true;field.readOnly=true;
  try{
    submission??={id:crypto.randomUUID(),brief,created:new Date().toISOString()};
    if(useOfficeInbox){
      const response=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submission)});
      if(!response.ok)throw Error('Submission failed');
    }else localStorage.setItem(taskPrefix+submission.id,JSON.stringify(submission));
    submission=null;field.value='';
    $('task-message').textContent='Task added to Rami’s inbox.';
    try{await refreshTasks()}catch{$('task-message').textContent='Task saved. Reopen the inbox to refresh the history.'}
  }catch{$('task-message').textContent='Could not confirm submission. Your brief is still here. Try again.'}
  finally{$('send-task').disabled=false;field.readOnly=false}
};
window.addEventListener('storage',event=>{
  if(inbox.open && !useOfficeInbox && (!event.key || event.key.startsWith(taskPrefix)))
    refreshTasks().catch(()=>{$('task-message').textContent='Unable to refresh history.'});
});
