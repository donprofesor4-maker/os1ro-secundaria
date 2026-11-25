function doGet(){return S1_doGet();}
function doPost(e){return S1_doPost(e);}
/** OS1 de secundaria · Registro privado. Publicar como aplicación web, ejecutar como propietario. */
const S1_DB_KEY = 'S1_SHEET_ID';
function S1_doGet() { return ContentService.createTextOutput('OS1 de secundaria · Servicio de expedientes.'); }
function S1_doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (JSON.stringify(p).length > 250000) throw Error('El reporte es demasiado grande.');
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { return S1_json_(S1_api_(p)); } finally { lock.releaseLock(); }
  } catch (e) { return S1_json_({ok:false,error:String(e.message || e)}); }
}
function S1_json_(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }
function S1_db_() {
  const id = PropertiesService.getScriptProperties().getProperty(S1_DB_KEY);
  if (!id) throw Error('El profesor todavía no ha activado el registro.');
  return SpreadsheetApp.openById(id);
}
function S1_rows_(name) { const s=S1_db_().getSheetByName(name); return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues():[]; }
function S1_safe_(v) { return String(v).replace(/^[=+@-]/,"'").slice(0,120); }
function S1_hash_(v) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v)); }
function S1_clean_(s,max) { s=String(s||'').trim().replace(/\s+/g,' '); if(!s||s.length>max)throw Error('Revisa los datos del alumno.'); return s; }
function S1_identity_(p) {
  const name=S1_clean_(p.name,80), group=S1_clean_(p.group,20), pin=String(p.pin||'');
  if(!/^\d{6}$/.test(pin))throw Error('La clave personal debe tener seis números.');
  const props=PropertiesService.getScriptProperties();
  const id=S1_hash_(name.normalize('NFKC').toLocaleLowerCase('es')+'|'+group.normalize('NFKC').toLocaleLowerCase('es'));
  const digest=S1_hash_(props.getProperty('S1_PEPPER')+'|'+id+'|'+pin);
  const cache=CacheService.getScriptCache(), key='s1_fail_'+id;
  if(Number(cache.get(key)||0)>=8)throw Error('Demasiados intentos. Espera diez minutos y pide ayuda al profesor.');
  const roster=S1_rows_('Alumnos'), index=roster.findIndex(r=>r[0]===id);
  if(index<0) {
    if(p.action!=='register')throw Error('No encontramos ese alumno. Revisa nombre y grupo o elige Primera vez.');
    if(String(p.classCode||'')!==props.getProperty('S1_CLASS_CODE'))throw Error('Pide al profesor el código de clase.');
    S1_db_().getSheetByName('Alumnos').appendRow([id,S1_safe_(name),S1_safe_(group),digest,new Date()]);
  } else if(roster[index][3]!==digest) {
    cache.put(key,String(Number(cache.get(key)||0)+1),600);
    throw Error('Los datos o la clave no coinciden.');
  }
  cache.remove(key); return {id,name,group};
}
function S1_api_(p) {
  if(!['register','load','save'].includes(p.action))throw Error('Operación no disponible.');
  const student=S1_identity_(p);
  const sheet=S1_db_().getSheetByName('Estado'), all=S1_rows_('Estado'), index=all.findIndex(r=>r[0]===student.id);
  let state=index<0?{version:1,logs:[],snapshot:null,revision:0}:JSON.parse(all[index][1]);
  state.logs=S1_rows_('Evidencias').filter(r=>r[1]===student.id).map(r=>JSON.parse(r[2]));
  if(p.action!=='save')return {ok:true,state,student:{name:student.name,group:student.group}};
  const report=p.report;
  if(!report||!/^[-\w]{12,80}$/.test(report.id)||!Array.isArray(report.logs))throw Error('Reporte inválido.');
  const sessions=S1_rows_('Sesiones');
  if(state.lastReportId===report.id||sessions.some(r=>r[0]===report.id&&r[2]===student.id))return {ok:true,duplicate:true,revision:state.revision};
  if(report.revision!==state.revision)throw Error('Hay un avance más reciente en otra computadora. Descarga tu bitácora, sal y vuelve a entrar para recuperarlo.');
  const now=new Date(), existing=new Set(state.logs.map(x=>x.id)), additions=[];
  for(const entry of report.logs) {
    if(!entry||typeof entry.id!=='string'||entry.id.length>100||existing.has(entry.id))continue;
    if(!Number.isInteger(entry.mission)||entry.mission<1||entry.mission>72||!['guardar','crear carpeta','accredited'].includes(entry.action))continue;
    if(entry.action==='accredited'&&!S1_validCredit_(entry))throw Error('Una evidencia no coincide con el encargo. Pide ayuda al profesor.');
    entry.receivedAt=now.toISOString(); if(JSON.stringify(entry).length>44000)throw Error('Evidencia demasiado grande.'); state.logs.push(entry); additions.push([entry.id,student.id,JSON.stringify(entry),now]); existing.add(entry.id);
  }
  if(state.logs.length>1800)throw Error('La bitácora está llena. Pide al profesor que la archive.');
  // El expediente conserva todas las evidencias; las repeticiones no duplican encargos.
  const summary=S1_summary_(state.logs);
  if(report.snapshot) {
    const s=report.snapshot;
    if(!Number.isInteger(s.level)||s.level<0||s.level>10||!Number.isInteger(s.taskIndex)||!s.model||!Array.isArray(s.model.files)||!Array.isArray(s.model.folders))throw Error('Punto de continuación inválido.');
    if(s.taskIndex<0||s.taskIndex>=SecondaryRules.build(report.theme,s.level).tasks.length||!Array.isArray(s.completed)||!s.completed.every(n=>Number.isInteger(n)&&n>=0&&n<=10))throw Error('Punto de continuación inválido.');
    if(!['central','space'].includes(report.theme))throw Error('Estación inválida.');
    state.snapshots=state.snapshots||{};state.snapshots[report.theme]=s;state.snapshot=s;
  }
  state.revision++; state.updatedAt=now.toISOString();
  state.lastReportId=report.id;
  const encoded=JSON.stringify({...state,logs:undefined});
  if(encoded.length>45000)throw Error('El expediente necesita archivarse. Descarga la bitácora y avisa al profesor.');
  const values=[student.id,encoded,now,summary.basic,summary.hacker];
  if(additions.length){const ev=S1_db_().getSheetByName('Evidencias'); ev.getRange(ev.getLastRow()+1,1,additions.length,4).setValues(additions);}
  if(index<0)sheet.appendRow(values);else sheet.getRange(index+2,1,1,values.length).setValues([values]);
  S1_db_().getSheetByName('Sesiones').appendRow([report.id,now,student.id,S1_safe_(student.name),S1_safe_(student.group),summary.basic,summary.hacker,summary.errors,report.reason==='finished'?'Juego terminado':'Guardado automático',state.snapshot?state.snapshot.level+1:'',state.snapshot?state.snapshot.taskIndex+1:'',state.revision]);
  S1_updateSummary_();
  return {ok:true,revision:state.revision,savedAt:state.updatedAt,summary};
}
function S1_validCredit_(entry) {
  const local=(entry.mission-1)%36+1, theme=entry.mission>36?'space':'central';
  const level=local<=30?Math.floor((local-1)/3):10,order=local<=30?(local-1)%3:local-31;
  const expected=SecondaryRules.build(theme,level).tasks[order],d=entry.detail,e=d&&d.evidence;
  if(!d||d.schemaVersion!==2||d.theme!==theme)return false;
  if(!e||e.destination!==expected.path||e.name!==expected.name||JSON.stringify(e.request)!==JSON.stringify(expected))return false;
  if(!Array.isArray(e.folders)||!e.folders.includes(expected.path)||!Array.isArray(e.files))return false;
  if(!e.files.some(f=>f.path===expected.path&&f.name===expected.name))return false;
  if(expected.action==='backup'&&!e.files.some(f=>f.path===expected.from&&f.name===expected.file))return false;
  if(expected.from&&expected.action!=='backup'&&e.files.some(f=>f.path===expected.from&&f.name===expected.file))return false;
  return true;
}
function S1_isBasic_(n){return n>=1&&n<=30||n>=37&&n<=66;}
function S1_summary_(logs) {
  const ids=new Set(logs.filter(x=>x.action==='accredited'&&x.ok).map(x=>x.mission));
  return {basic:[...ids].filter(S1_isBasic_).length,hacker:[...ids].filter(x=>!S1_isBasic_(x)).length,errors:logs.filter(x=>!x.ok).length};
}
/** Ejecutar una vez desde el editor. Nunca desde la aplicación pública. */
function S1_prepararRegistro() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(S1_DB_KEY))return;
  const ss=SpreadsheetApp.create('OS1 de secundaria · Expedientes y evaluación trimestral');
  const schemas={Evidencias:['Evidencia ID','Alumno ID','Evidencia JSON','Fecha recibida'],Alumnos:['ID','Alumno','Grupo','Clave cifrada','Alta'],Estado:['ID','Expediente JSON','Último envío','Básicas','Hacker'],Sesiones:['Reporte ID','Fecha de recepción','Alumno ID','Alumno','Grupo','Básicas acreditadas / 60','Hacker / 12','Errores acumulados','Motivo','Nivel siguiente','Encargo siguiente','Revisión'],Trimestres:['Trimestre','Desde (inclusive)','Hasta (exclusive)','Encargos básicos asignados (1–30 central; 37–66 espacial, separados por coma)'],Resumen:['Alumno','Grupo','Trimestre','Asignados','Acreditados','Promedio propuesto / 10','Hacker (informativo)','Último envío','Nota docente']};
  ss.getSheets()[0].setName('Trimestres');
  Object.keys(schemas).forEach(name=>{const s=ss.getSheetByName(name)||ss.insertSheet(name); s.appendRow(schemas[name]);s.setFrozenRows(1);s.getRange(1,1,1,schemas[name].length).setBackground('#17365d').setFontColor('white').setFontWeight('bold');s.setColumnWidths(1,schemas[name].length,155);s.getRange(1,1,1,schemas[name].length).setWrap(true);s.setRowHeight(1,48);});
  const term=ss.getSheetByName('Trimestres');
  term.getRange(2,1,3,4).setValues([['1',new Date(2026,7,1),new Date(2026,11,1),[...Array.from({length:30},(_,i)=>i+1),...Array.from({length:30},(_,i)=>i+37)].join(',')],['2',new Date(2026,11,1),new Date(2027,3,1),''],['3',new Date(2027,3,1),new Date(2027,7,1),'']]);
  term.getRange('B2:C4').setNumberFormat('yyyy-mm-dd');term.setColumnWidth(4,580);
  ss.getSheetByName('Estado').hideSheet();ss.getSheetByName('Alumnos').hideSheet();
  props.setProperties({S1_SHEET_ID:ss.getId(),S1_PEPPER:Utilities.getUuid()+Utilities.getUuid(),S1_CLASS_CODE:Utilities.getUuid().slice(0,8).toUpperCase()});
  const guide=ss.insertSheet('Inicio'); guide.getRange(1,1,9,2).setValues([
    ['OS1 de secundaria · Panel docente','Solo el propietario debe acceder a esta hoja.'],
    ['Código de clase',props.getProperty('S1_CLASS_CODE')],
    ['Ingreso del alumno','Nombre, grupo y clave personal de seis números. Primera vez: código de clase.'],
    ['Trimestres','Ajusta fechas y encargos asignados. Las fechas son una propuesta editable.'],
    ['Promedio propuesto','10 × encargos básicos acreditados dentro del periodo / encargos asignados. Sin asignación: sin nota.'],
    ['Repeticiones','Cada encargo cuenta una sola vez por trimestre. Central: 1–30; espacial: 37–66. Los envíos y los intentos no se promedian.'],
    ['Reto hacker','Se registra por separado; no penaliza a quien no lo realiza.'],
    ['Revisión docente','Resumen es una propuesta del juego, no una calificación oficial. Nota docente se conserva.'],
    ['Actualizar','Ejecuta S1_actualizarResumen después de cambiar las fechas o asignaciones.']]);
  guide.setColumnWidth(1,190);guide.setColumnWidth(2,760);guide.getRange('A1:B9').setWrap(true);guide.autoResizeRows(1,9);ss.setActiveSheet(guide);
  ss.setSpreadsheetTimeZone('America/Mexico_City');console.log(ss.getUrl());
}
function S1_actualizarResumen(){S1_updateSummary_();}
function S1_updateSummary_() {
  const ss=S1_db_(), terms=S1_rows_('Trimestres'), roster=S1_rows_('Alumnos'), states=S1_rows_('Estado');
  const sheet=ss.getSheetByName('Resumen'), old=S1_rows_('Resumen'), notes=new Map(old.map(r=>[r[0]+'|'+r[1]+'|'+r[2],r[8]]));
  const output=[];
  for(const s of states){const person=roster.find(r=>r[0]===s[0]);if(!person)continue;const state=JSON.parse(s[1]);state.logs=S1_rows_('Evidencias').filter(r=>r[1]===s[0]).map(r=>JSON.parse(r[2]));
    for(const t of terms){if(!(t[1] instanceof Date)||!(t[2] instanceof Date))continue;
      const assigned=[...new Set(String(t[3]).split(',').map(Number).filter(n=>Number.isInteger(n)&&S1_isBasic_(n)))];
      const logs=state.logs.filter(x=>new Date(x.receivedAt)>=t[1]&&new Date(x.receivedAt)<t[2]);
      const ids=new Set(logs.filter(x=>x.action==='accredited'&&x.ok).map(x=>x.mission));
      const count=assigned.filter(n=>ids.has(n)).length;
      output.push([person[1],person[2],String(t[0]),assigned.length,count,assigned.length?Math.round(100*count/assigned.length)/10:'',S1_summary_(logs).hacker,s[2],notes.get(person[1]+'|'+person[2]+'|'+t[0])||'']);
    }
  }
  if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,9).clearContent();
  if(output.length){sheet.getRange(2,1,output.length,9).setValues(output);sheet.getRange(2,6,output.length,1).setNumberFormat('0.0');sheet.getRange(2,8,output.length,1).setNumberFormat('yyyy-mm-dd hh:mm');}
}

(function(root){
'use strict';
const roots=['Escritorio','Descargas','Documentos','Imágenes','Música','Videos'];
const central=[[["horario.pdf","Documentos/Inicio de curso/Horarios"],["portada.png","Imágenes/Inicio de curso/Portadas"],["reglamento.docx","Documentos/Inicio de curso/Reglamentos"]],[["exposicion.pptx","Documentos/Presentaciones","historia-exposicion.pptx"],["encuesta.xlsx","Documentos/Datos","grupo-encuesta.xlsx"],["lectura.pdf","Documentos/Lecturas","espanol-lectura.pdf"]],[["resena.docx","Documentos/Español"],["problemas.xlsx","Documentos/Matemáticas"],["observaciones.pdf","Documentos/Ciencias"]],[["mediciones.csv","Documentos/Ciencias/Experimento/Datos"],["procedimiento.docx","Documentos/Ciencias/Experimento/Reporte"],["montaje.png","Imágenes/Ciencias/Experimento"]],[["entrevista.mp3","Documentos/Historia/Investigación/Audio"],["fuentes.pdf","Documentos/Historia/Investigación/Fuentes"],["mapa.png","Imágenes/Historia/Investigación"]],[["documento01.docx","Documentos/Español/Reseña","resena-borrador.docx"],["datos02.xlsx","Documentos/Matemáticas/Estadística","encuesta-resultados.xlsx"],["captura03.png","Imágenes/Ciencias","experimento-montaje.png"]],[["reporte.docx","Documentos/Ciencias/Experimento","reporte-revisado.docx"],["resultados.xlsx","Documentos/Matemáticas/Estadística","resultados-revisados.xlsx"],["exposicion.pptx","Documentos/Historia/Presentación","exposicion-version-final.pptx"]],[["resena.docx","Documentos/Español/Reseña",null,"Imágenes"],["mediciones.csv","Documentos/Ciencias/Experimento/Datos",null,"Música"],["portada.png","Imágenes/Proyecto",null,"Documentos"]],[["plan.docx","Documentos/Proyecto escolar"],["fuentes.pdf","Documentos/Proyecto escolar"],["cronograma.xlsx","Documentos/Proyecto escolar"]],[["reporte.pdf","Documentos/Entrega trimestral/Reportes"],["datos.csv","Documentos/Entrega trimestral/Datos"],["portada.png","Documentos/Entrega trimestral/Recursos"]],[["borrador01.docx","Documentos/Entrega integradora/Ciencias/Reportes","ciencias-reporte-final.docx"],["tabla02.csv","Documentos/Entrega integradora/Ciencias/Datos","ciencias-mediciones.csv"],["foto.png","Documentos/Entrega integradora/Ciencias/Imágenes","montaje-version-final.png"],["exposicion03.pptx","Documentos/Entrega integradora/Presentación","proyecto-presentacion-final.pptx"],["fuentes.pdf","Documentos/Entrega integradora/Referencias","fuentes-verificadas.pdf","Descargas"],["reporte.docx","Documentos/Entrega integradora/Respaldo","reporte-respaldo.docx","Documentos/Borradores","backup"]]];
const space=[[["tripulacion.pdf","Documentos/Inicio de misión/Tripulación"],["luna.png","Imágenes/Inicio de misión/Luna"],["bitacora.docx","Documentos/Inicio de misión/Bitácoras"]],[["mision.pptx","Documentos/Presentaciones","orion-mision.pptx"],["telemetria.csv","Documentos/Datos","orion-telemetria.csv"],["protocolo.pdf","Documentos/Protocolos","orion-protocolo.pdf"]],[["navegacion.xlsx","Documentos/Navegación"],["gravedad.docx","Documentos/Ciencia"],["motor.pdf","Documentos/Ingeniería"]],[["muestras.csv","Documentos/Ciencia/Europa/Datos"],["analisis.docx","Documentos/Ciencia/Europa/Reportes"],["superficie.png","Imágenes/Europa/Exploración"]],[["senal.mp3","Documentos/Europa/Investigación/Audio"],["referencias.pdf","Documentos/Europa/Investigación/Fuentes"],["orbita.png","Imágenes/Europa/Investigación"]],[["archivo01.docx","Documentos/Ciencia/Europa","europa-informe-preliminar.docx"],["tabla02.xlsx","Documentos/Navegación/Ruta","trayectoria-calculos.xlsx"],["captura03.png","Imágenes/Marte","marte-superficie.png"]],[["informe.docx","Documentos/Ciencia/Europa","informe-revisado.docx"],["trayectoria.xlsx","Documentos/Navegación/Ruta","trayectoria-revisada.xlsx"],["mision.pptx","Documentos/Ingeniería/Presentación","mision-version-final.pptx"]],[["motor.docx","Documentos/Ingeniería/Diagnóstico",null,"Imágenes"],["telemetria.csv","Documentos/Navegación/Datos",null,"Música"],["europa.png","Imágenes/Europa",null,"Documentos"]],[["plan.docx","Documentos/Proyecto Europa"],["referencias.pdf","Documentos/Proyecto Europa"],["suministros.xlsx","Documentos/Proyecto Europa"]],[["hallazgos.pdf","Documentos/Entrega espacial/Reportes"],["muestras.csv","Documentos/Entrega espacial/Datos"],["descenso.mp4","Documentos/Entrega espacial/Recursos"]],[["borrador01.docx","Documentos/Expedición Orión/Europa/Reportes","europa-reporte-final.docx"],["tabla02.csv","Documentos/Expedición Orión/Europa/Datos","europa-muestras.csv"],["marte.png","Documentos/Expedición Orión/Marte/Imágenes","marte-version-final.png"],["exposicion03.pptx","Documentos/Expedición Orión/Presentación","expedicion-presentacion-final.pptx"],["referencias.pdf","Documentos/Expedición Orión/Fuentes","referencias-verificadas.pdf","Descargas"],["informe.docx","Documentos/Expedición Orión/Respaldo","informe-respaldo.docx","Documentos/Borradores","backup"]]];
const levelNames=["Recibir y guardar", "Formatos de trabajo", "Archivos por materia", "Datos y evidencias", "Fuentes de investigación", "Nombres que explican", "Conservar versiones", "Corregir ubicaciones", "Crear un proyecto", "Preparar la entrega", "Reto hacker · Entrega integradora"];
const spaceNames=["Primer contacto", "Formatos de la misión", "Departamentos a bordo", "Datos de Europa", "Fuentes de exploración", "Identifica los registros", "Conserva versiones", "Rescate en órbita", "Proyecto Europa", "Entrega espacial", "Reto hacker · Expedición Orión"];
function normalize(s){return String(s).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')}
function build(theme,index){
 const source=theme==='space'?space:central, tasks=source[index].map(([file,path,name,from,action])=>({file,path,name:name||file,from:from||null,action:action||(from?"move":"save")}));
 const folders=new Set(roots);let files=[];
 const addPath=path=>{const parts=path.split('/');for(let i=1;i<=parts.length;i++)folders.add(parts.slice(0,i).join('/'))};
 tasks.forEach(t=>{if(index<3)addPath(t.path);else if(index<8){const parent=t.path.split('/').slice(0,-1).join('/');if(parent)addPath(parent);}if(t.from){addPath(t.from);files.push({name:t.file,path:t.from})}if(index===6)files.push({name:t.file,path:t.path})});
 if(index>=2&&index<8){['Imágenes/Animales','Imágenes/Paisajes','Documentos/Proyectos'].forEach(addPath)}
 if(index===10){
  const duplicate=tasks[2];addPath(duplicate.path);files.push({name:duplicate.file,path:duplicate.path});
  addPath('Documentos/Borradores');addPath('Documentos/Proyecto anterior/Reportes');
  addPath(tasks[0].path.split('/').slice(0,2).join('/')+'/Borradores');
  files.push({name:tasks[1].file,path:'Descargas'},{name:'reporte-version-antigua.docx',path:'Documentos/Borradores'});
 }
 return {tasks,folders:[...folders],files};
}
function validate(task,path,name,files,folders){
 if(folders&&!folders.includes(path))return {ok:false,message:"Crea primero la carpeta de entrega y entra en ella."};
 if(task.from&&!files.some(f=>f.path===task.from&&normalize(f.name)===normalize(task.file)))return {ok:false,message:'El archivo de origen no está disponible. Revisa el encargo.'};
 if(normalize(path)!==normalize(task.path))return {ok:false,message:`El destino es ${task.path.replaceAll('/',' › ')}. Revisa la ruta antes de guardar.`};
 if(normalize(name)!==normalize(task.name))return {ok:false,message:`Escribe el nombre solicitado: ${task.name}`};
 if(files.some(f=>f.path===path&&normalize(f.name)===normalize(name)))return {ok:false,message:'Ese nombre ya existe. Conserva el original y usa el nombre nuevo del encargo.'};
 return {ok:true};
}
function createFolder(folders,parent,name){
 name=String(name).trim();if(!name||/[\\/<>:"|?*]/.test(name)||/^\.+$/.test(name))return {ok:false,message:'Escribe un nombre de carpeta válido, sin diagonales ni signos especiales.'};
 if(parent&&!folders.includes(parent))return {ok:false,message:'Abre primero una carpeta válida.'};
 const path=parent?parent+'/'+name:name;if(folders.some(p=>normalize(p)===normalize(path)))return {ok:false,message:'Esta carpeta ya existe. Ábrela para continuar.'};
 return {ok:true,path};
}
const api={version:2,build,validate,createFolder,normalize,levelNames,spaceNames};
if(typeof module!=='undefined')module.exports=api;else root.SecondaryRules=api;
})(typeof window!=='undefined'?window:globalThis);
