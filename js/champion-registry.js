/* Shared catalogue metadata and portraits. GitHub is the durable source. */
(() => {
  'use strict';
  const classes = Object.freeze({science:'Científico',mystic:'Místico',cosmic:'Cósmico',tech:'Tecnológico',mutant:'Mutante',skill:'Hábil',universal:'Universal / especial'});
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const byValue = new Map();
  const previews = new Map();
  const uppercase = new Set(['nicominoru','METARANGO4','novaleMETARANGO3','METARANGO5','karolinadean']);
  for (const group of window.PortrayerChampionGroups) {
    const groupClass = group.value.replace(/_champions$/, '');
    for (const item of group.choices.filter(Boolean)) {
      if (byValue.has(item.value)) continue;
      const suffix = item.value.split('_').pop();
      byValue.set(item.value, Object.freeze({value:item.value, text:item.label,
        className: classes[groupClass] ? groupClass : classes[suffix] ? suffix : 'universal'}));
    }
  }
  function publish() {
    window.PortrayerChampions = Object.freeze([...byValue.values()]);
    document.dispatchEvent(new CustomEvent('px:catalogue-updated'));
  }
  function validate(entry) {
    return entry && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(entry.value) &&
      typeof entry.text === 'string' && entry.text.trim().length > 0 && entry.text.length <= 80 &&
      Object.hasOwn(classes, entry.className);
  }
  function add(entries, preview) {
    if (!Array.isArray(entries)) throw new Error('El catálogo de personajes no es válido.');
    if (!entries.every(validate)) throw new Error('Hay un personaje con datos no válidos en el catálogo.');
    const added = [];
    for (const entry of entries) {
      if (byValue.has(entry.value)) continue;
      const item = Object.freeze({value:entry.value,text:entry.text.trim(),className:entry.className,custom:true});
      byValue.set(item.value,item);
      let group = window.PortrayerChampionGroups.find(g => g.value === `${item.className}_champions`);
      if (!group) {
        group = {id:100,label:'Universales / especiales',value:'universal_champions',choices:[]};
        window.PortrayerChampionGroups.push(group);
      }
      group.choices.push({value:item.value,label:item.text});
      added.push({value:item.value,label:item.text});
      if (preview?.startsWith('data:image/png;base64,')) previews.set(item.value, preview);
    }
    if (added.length && window.PortrayerOriginalChoices) {
      const picker = window.PortrayerOriginalChoices;
      const selected = document.querySelector('#app select#portrait')?.value;
      let selectedOnce = false;
      const groups = window.PortrayerChampionGroups.map(group => ({...group,
        choices:group.choices.filter(Boolean).map(choice => {
          const isSelected = choice.value === selected && !selectedOnce;
          if (isSelected) selectedOnce = true;
          return {...choice,selected:isSelected};
        })
      }));
      // Choices hides ungrouped additions when groups already exist. Rebuild
      // its groups, retaining the current selection and the Vue model.
      picker.clearStore();
      picker.setChoices(groups,'value','label',false);
    }
    publish();
  }
  function portraitURL(value) {
    if (previews.has(value)) return previews.get(value);
    const asset = value === 'adaptoid_Gold' ? 'adaptoid_gold' : value;
    return `./assets/portraits/${encodeURIComponent(asset)}.${uppercase.has(asset) ? 'PNG' : 'png'}`;
  }
  window.PortrayerCatalogue = Object.freeze({classes, normalize, validate, add, portraitURL,
    get: value => byValue.get(value),
    hasName: name => [...byValue.values()].some(entry=>normalize(entry.text)===normalize(name))});
  publish();
  window.PortrayerCatalogueReady = fetch('./data/champions.json', {cache:'no-store'})
    .then(response=>{if(!response.ok) throw new Error('No se pudo cargar el catálogo añadido.');return response.json();})
    .then(entries=>{add(entries);return true;})
    .catch(()=>{
      document.dispatchEvent(new CustomEvent('px:catalogue-error'));
      const showNotice=()=>{const notice=document.getElementById('px-catalogue-notice');if(notice)notice.hidden=false;};
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showNotice,{once:true});
      else showNotice();
      return false;
    });
})();
