// Comprueba nuevas publicaciones sin borrar cuadernos, evidencias ni expedientes.
(function(){'use strict';
const current='s1-4',script=document.currentScript,base=new URL('.',script.src);
const manifest=new URL('version.json',base);manifest.searchParams.set('r',Date.now());
fetch(manifest,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
 if(typeof data.version!=='string'||!/^s1-[0-9]+$/.test(data.version)||Number(data.version.slice(3))<=Number(current.slice(3)))return;
 const guard='os1s1.actualizar.'+location.pathname+'.'+data.version;
 if(sessionStorage.getItem(guard))return;
 sessionStorage.setItem(guard,'1');const next=new URL(location.href);next.searchParams.set('v',data.version);next.searchParams.set('actualizado',Date.now());location.replace(next.href);
}).catch(()=>{});
})();
