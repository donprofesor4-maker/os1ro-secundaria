(function(root){'use strict';
const base='os1s1.registro.v2',theme=document.body.dataset.theme,$=id=>document.getElementById(id),config=root.OS1_REGISTRO||{};
let person=null,revision=0,busy=null,timer=null,session=0;
const uid=()=>crypto.randomUUID();
function scope(){return person?base+'.'+encodeURIComponent(person.name.toLocaleLowerCase('es')+'|'+person.group.toLocaleLowerCase('es')):base+'.invitado';}
function key(kind){return scope()+'.'+kind+(kind==='game'?'.'+theme:'');}
function read(kind,fallback){try{return JSON.parse(localStorage.getItem(key(kind)))??fallback;}catch{return fallback;}}
function write(kind,value){localStorage.setItem(key(kind),JSON.stringify(value));}
function status(s){$('registro-status').textContent=s;}
async function request(payload){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);try{const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,school:'s1'}),signal:controller.signal,redirect:'follow'});if(!response.ok)throw Error('Sin confirmación del servidor.');const data=await response.json();if(!data.ok)throw Error(data.error||'No se pudo guardar.');return data;}finally{clearTimeout(timeout);}}
function auth(){return {name:person.name,group:person.group,pin:person.pin};}
function merge(remote){const all=new Map(remote.map(x=>[x.id,x]));read('evidence',{logs:[]}).logs.forEach(x=>{if(!all.has(x.id))all.set(x.id,x)});write('evidence',{version:2,logs:[...all.values()]});write('synced',remote.map(x=>x.id));}
function changed(){write('dirty',true);schedule();}
function schedule(){if(!person||timer)return;timer=setTimeout(()=>{timer=null;save();},1000);}
async function save(){if(!person)return;if(busy)return busy;const savedSession=session,student=auth(),pendingKey=key('pending'),revisionKey=key('revision'),syncedKey=key('synced');
 busy=(async()=>{try{
  root.dispatchEvent(new Event('os1s1:checkpoint'));
  let report=read('pending',null);
  if(!report){report={id:uid(),revision:read('revision',revision),theme,reason:'automatic',logs:read('evidence',{logs:[]}).logs.filter(x=>!read('synced',[]).includes(x.id)),snapshot:read('game',null)};write('pending',report);}
  status('Guardando avance… puedes seguir trabajando.');const result=await request({...student,action:'save',report});
  localStorage.setItem(revisionKey,JSON.stringify(result.revision));localStorage.removeItem(pendingKey);
  const ids=new Set(JSON.parse(localStorage.getItem(syncedKey)||'[]'));report.logs.forEach(x=>ids.add(x.id));localStorage.setItem(syncedKey,JSON.stringify([...ids]));
  if(session!==savedSession)return;
  revision=result.revision;status('✓ Avance guardado automáticamente en tu expediente.');
  if(read('evidence',{logs:[]}).logs.some(x=>!ids.has(x.id))||JSON.stringify(read('game',null))!==JSON.stringify(report.snapshot))schedule();else write('dirty',false);
 }catch(e){if(session!==savedSession)return;status(e.name==='QuotaExceededError'?'No se pudo guardar en este equipo. Descarga tu bitácora y avisa al profesor.':'Guardado en este equipo. Pendiente de conexión: se reintentará automáticamente.');if(/más reciente/.test(e.message)){status(e.message+' Tus evidencias siguen en este equipo.');$('registro-recover').hidden=false;}}
 finally{busy=null;}})();return busy;
}
async function enter(e){e.preventDefault();$('registro-enter').disabled=true;try{
 if(!config.endpoint)throw Error('El registro todavía no está activado.');
 const candidate={name:$('alumno-name').value.trim().replace(/\s+/g,' '),group:$('alumno-group').value.trim().replace(/\s+/g,' '),pin:$('alumno-pin').value};
 const data=await request({...candidate,action:$('alumno-first').checked?'register':'load',classCode:$('alumno-class').value.trim()});
 person=candidate;session++;revision=data.state.revision;merge(data.state.logs);
 const pending=read('pending',null);
 if(!pending){const localRevision=read('revision',revision);if(!read('dirty',false)||localRevision!==revision)write('game',data.state.snapshots?.[theme]||null);write('revision',revision);}
 $('registro-dialog').close();$('registro-student').textContent=person.name+' · '+person.group;$('registro-exit').hidden=false;$('registro-open').hidden=true;
 root.dispatchEvent(new Event('os1s1:identity'));status('Expediente recuperado. El avance se guarda automáticamente.');schedule();
 }catch(error){$('registro-error').textContent=error.name==='AbortError'?'La conexión tardó demasiado. Vuelve a intentar.':error.message;}finally{$('registro-enter').disabled=false;}}
async function exit(){if(!person)return;document.querySelector('main').inert=true;await save();await save();document.querySelector('main').inert=false;if(read('pending',null)&&!confirm('El último envío sigue pendiente. Se conserva en este equipo. ¿Cerrar sesión de todos modos?'))return;person=null;session++;clearTimeout(timer);timer=null;root.dispatchEvent(new Event('os1s1:identity'));$('registro-form').reset();$('class-row').hidden=true;$('registro-error').textContent='Sesión cerrada. El siguiente alumno puede entrar.';$('registro-dialog').showModal();$('registro-student').textContent='Mi expediente';$('registro-exit').hidden=true;$('registro-open').hidden=false;}
$('registro-recover').onclick=async()=>{if(!person)return;try{const data=await request({...auth(),action:'load'}),backup=read('conflicts',[]);backup.push(read('pending',null));write('conflicts',backup);localStorage.removeItem(key('pending'));merge(data.state.logs);write('revision',data.state.revision);write('game',data.state.snapshots?.[theme]||null);revision=data.state.revision;$('registro-recover').hidden=true;root.dispatchEvent(new Event('os1s1:identity'));schedule();}catch(e){status(e.message);}};
if(!config.endpoint){$('registro-open').hidden=true;status('Tu avance se conserva en esta computadora. El expediente escolar todavía no está disponible.');return;}
root.OS1Registro={key,read,write,uid,isStudent:()=>!!person,send:async()=>{await save();if(!read('pending',null))root.location.href='../../index.html';},changed};
$('registro-form').addEventListener('submit',enter);$('registro-exit').onclick=exit;
$('alumno-first').addEventListener('change',()=>{$('class-row').hidden=!$('alumno-first').checked;});
$('registro-guest').onclick=()=>{$('registro-dialog').close();status('Invitado: solo se conserva en este equipo. Entra con tus datos para usar tu expediente.');};
$('registro-open').onclick=()=>$('registro-dialog').showModal();$('registro-dialog').addEventListener('cancel',e=>e.preventDefault());
root.addEventListener('online',schedule);root.addEventListener('os1s1:changed',changed);
root.addEventListener('beforeunload',e=>{if(person&&(busy||read('pending',null)||timer)){e.preventDefault();e.returnValue='';}});
setInterval(()=>{if(person&&read('pending',null)&&$('registro-recover').hidden)schedule();},15000);
try{const guest=base+'.invitado.evidence',old=localStorage.getItem('donprofesor.os.s1.entregas.v1');if(!localStorage.getItem(guest)&&old)localStorage.setItem(guest,old);}catch{}
$('registro-dialog').showModal();
})(window);
