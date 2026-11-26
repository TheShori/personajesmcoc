/* Owner-operated publisher: credentials live only in this open form. */
(() => {
  'use strict';
  const catalogue = window.PortrayerCatalogue;
  const dialog = document.getElementById('px-champion-dialog');
  const form = document.getElementById('px-champion-form');
  const field = name => form.elements.namedItem(name);
  const status = document.getElementById('px-upload-status');
  const preview = document.getElementById('px-upload-preview');
  const submit = document.getElementById('px-upload-submit');
  const close = document.getElementById('px-upload-close');
  const result = document.getElementById('px-upload-result');
  const repo = 'TheShori/personajesmcoc';
  const base = `https://api.github.com/repos/${repo}`;
  let png = '', busy = false, imageRevision = 0, slugEdited = false, saved = false;
  const slugify = name => catalogue.normalize(name).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80);
  function say(message, error=false) {
    status.textContent=message;
    status.classList.toggle('is-error',error);
  }
  function reset() {
    form.reset(); png=''; slugEdited=false; saved=false; ++imageRevision;
    preview.hidden=true; preview.removeAttribute('src'); result.hidden=true;
    submit.textContent='Publicar en GitHub'; submit.formNoValidate=false; say('');
    updatePath();
  }
  function updatePath() {
    document.getElementById('px-upload-path').textContent=`assets/portraits/${field('slug').value || 'nombre_del_personaje'}.png`;
  }
  document.getElementById('px-add-champion').addEventListener('click',()=>{
    reset();dialog.showModal();field('name').focus();
  });
  close.addEventListener('click',()=>{field('token').value='';dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else field('token').value='';});
  dialog.addEventListener('close',()=>{field('token').value='';++imageRevision;});
  field('name').addEventListener('input',()=>{
    if(!slugEdited)field('slug').value=slugify(field('name').value);
    updatePath();
  });
  field('slug').addEventListener('input',()=>{slugEdited=true;updatePath();});
  field('image').addEventListener('change',async()=>{
    const revision=++imageRevision;
    png='';preview.hidden=true;preview.removeAttribute('src');
    const file=field('image').files[0];
    if(!file)return;
    try {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Selecciona una imagen PNG, JPG o WebP.');
      if(file.size>10*1024*1024)throw Error('La imagen debe ocupar menos de 10 MB.');
      say('Preparando imagen…');
      const bitmap=await createImageBitmap(file);
      if(revision!==imageRevision){bitmap.close();return;}
      try {
        if(!bitmap.width||!bitmap.height||bitmap.width>8192||bitmap.height>8192)throw Error('La imagen debe medir como máximo 8192 × 8192 píxeles.');
        const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
        const ctx=canvas.getContext('2d'),scale=Math.min(256/bitmap.width,256/bitmap.height);
        const width=bitmap.width*scale,height=bitmap.height*scale;
        ctx.drawImage(bitmap,(256-width)/2,(256-height)/2,width,height);
        png=canvas.toDataURL('image/png');preview.src=png;preview.hidden=false;
        say('Imagen preparada. Se guardará como PNG de 256 × 256, sin recortar ni deformar.');
      }finally{bitmap.close();}
    }catch(error){if(revision===imageRevision)say(error.message || 'No se pudo abrir la imagen.',true);}
  });
  async function publish(entry, image, token) {
    async function api(path, method='GET', body) {
      let response;
      try {
        response=await fetch(base+path,{method,cache:'no-store',redirect:'error',
          headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
          ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
      }catch{throw Error('No se pudo contactar con GitHub. Comprueba tu conexión e inténtalo de nuevo.');}
      if(!response.ok){
        const messages={401:'El token no es válido o ha caducado.',403:'GitHub ha rechazado la operación. Revisa el permiso Contents: Read and write y el límite de peticiones.',404:'No se puede acceder al repositorio con este token. Selecciona personajesmcoc al crearlo.',409:'El repositorio ha cambiado. Vuelve a intentarlo para usar la última versión.',422:'GitHub no ha aceptado el cambio. Puede haber una actualización simultánea o una regla de protección de la rama.',429:'GitHub ha limitado las peticiones. Espera unos minutos.'};
        throw Error(messages[response.status] || `GitHub devolvió un error (${response.status}). No se ha confirmado la publicación.`);
      }
      return response.json();
    }
    const ref=await api('/git/ref/heads/main');
    const head=ref.object.sha;
    const commit=await api(`/git/commits/${head}`);
    const tree=await api(`/git/trees/${commit.tree.sha}?recursive=1`);
    if(tree.truncated)throw Error('No se pudo comprobar el catálogo completo. No se ha publicado nada.');
    const imagePath=`assets/portraits/${entry.value}.png`;
    if(tree.tree.some(file=>file.path.toLowerCase()===imagePath.toLowerCase()))throw Error('Ya existe una imagen con ese nombre de archivo. Elige otro identificador.');
    const metadata=tree.tree.find(file=>file.path==='data/champions.json');
    if(!metadata)throw Error('No se encuentra el catálogo en GitHub. Recarga la web cuando termine su actualización.');
    const blob=await api(`/git/blobs/${metadata.sha}`);
    if(blob.encoding!=='base64')throw Error('No se pudo leer el catálogo de GitHub.');
    let entries;
    try {entries=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}
    catch{throw Error('El catálogo de GitHub no es válido. No se ha publicado nada.');}
    if(!Array.isArray(entries)||!entries.every(catalogue.validate))throw Error('El catálogo de GitHub contiene datos no válidos. No se ha modificado.');
    if(entries.some(item=>item.value===entry.value||catalogue.normalize(item.text)===catalogue.normalize(entry.text)))throw Error('Este personaje ya está publicado. Recarga la página para encontrarlo.');
    say('Guardando imagen y personaje en GitHub…');
    const imageBlob=await api('/git/blobs','POST',{content:image.split(',')[1],encoding:'base64'});
    const newTree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[
      {path:imagePath,mode:'100644',type:'blob',sha:imageBlob.sha},
      {path:'data/champions.json',mode:'100644',type:'blob',content:JSON.stringify([...entries,entry],null,2)+'\n'}
    ]});
    const newCommit=await api('/git/commits','POST',{message:`Añadir personaje: ${entry.text}`,tree:newTree.sha,parents:[head]});
    try {
      await api('/git/refs/heads/main','PATCH',{sha:newCommit.sha,force:false});
    }catch(error){
      // A lost response can occur after GitHub has accepted the write.
      // Confirm that exact commit before showing success; never force the ref.
      const current=await api('/git/ref/heads/main').catch(()=>null);
      if(current?.object.sha!==newCommit.sha)throw error;
    }
    return newCommit.sha;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    if(saved){reset();field('name').focus();return;}
    const entry={value:field('slug').value.trim(),text:field('name').value.trim(),className:field('className').value};
    if(!catalogue.validate(entry)){say('Completa el nombre, la clase y un identificador con letras minúsculas, números, guiones o guiones bajos.',true);return;}
    if(catalogue.get(entry.value)||catalogue.hasName(entry.text)){say('Ese nombre o identificador ya existe en el buscador. Elige uno diferente.',true);return;}
    if(!png){say('Espera a que se prepare una imagen válida antes de publicar.',true);return;}
    if(!field('token').value.trim()){say('Introduce tu token de GitHub para guardar el personaje en el repositorio.',true);field('token').focus();return;}
    busy=true;close.disabled=true;submit.disabled=true;form.querySelector('fieldset').disabled=true;
    say('Comprobando el catálogo de GitHub…');
    try {
      const sha=await publish(entry,png,field('token').value.trim());
      field('token').value='';
      catalogue.add([entry],png);
      document.dispatchEvent(new CustomEvent('px:champion-requested',{detail:{value:entry.value}}));
      saved=true;
      say(`${entry.text} guardado en GitHub y disponible en tus tres buscadores. Para los demás usuarios aparecerá cuando termine la actualización de la web (puede tardar unos minutos).`);
      result.href=`https://github.com/${repo}/commit/${sha}`;result.hidden=false;
      submit.textContent='Añadir otro personaje';
    }catch(error){say(error.message,true);}
    finally{
      busy=false;close.disabled=false;submit.disabled=false;form.querySelector('fieldset').disabled=false;
      // The success action resets the form; it must not require a token again.
      submit.formNoValidate=saved;
    }
  });
})();
