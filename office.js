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
