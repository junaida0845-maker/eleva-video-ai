// ELEVA UI translations — central dictionary backed by
// /functions/v1/get-ui-translations. Caches per-namespace per-lang
// in sessionStorage so the API is hit at most once per page load.
//
// Usage:
//   await ElevaUIT.load('mypage');           // preloads namespace
//   const s = ElevaUIT.t('save', 'common');   // lookup
//   ElevaUIT.apply(document.body);             // replaces text on
//                                              // [data-uit="key"] and
//                                              // [data-uit-ph="key"] (placeholder)
(function(win){
'use strict';

const SUPABASE_URL='https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eGN0b2xncWhkdGNvYW90aHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDk5NjksImV4cCI6MjA5MDM4NTk2OX0.h38gOPGOcdIw_w8p4AEYVLHCaWuC8k2XRrjLPcFAtUw';

// In-page memo (current lang × namespace -> dict)
const MEMO=new Map();
function memoKey(lang,ns){return lang+'::'+ns;}
function ssKey(lang,ns){return 'eleva_uit::'+lang+'::'+ns;}

function currentLang(){return (localStorage.getItem('eleva_lang')||'ja').toLowerCase();}

async function load(namespace,lang){
  lang=(lang||currentLang()).toLowerCase();
  const k=memoKey(lang,namespace);
  if(MEMO.has(k))return MEMO.get(k);
  // Try sessionStorage first
  try{
    const cached=sessionStorage.getItem(ssKey(lang,namespace));
    if(cached){
      const dict=JSON.parse(cached);
      MEMO.set(k,dict);
      return dict;
    }
  }catch{}
  // Fetch
  try{
    const url=SUPABASE_URL+'/functions/v1/get-ui-translations?locale='+encodeURIComponent(lang)+'&namespace='+encodeURIComponent(namespace);
    const res=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY}});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const body=await res.json();
    const dict=body.translations||{};
    MEMO.set(k,dict);
    try{sessionStorage.setItem(ssKey(lang,namespace),JSON.stringify(dict));}catch{}
    return dict;
  }catch(e){
    console.warn('[ui-i18n] load failed',namespace,lang,e);
    MEMO.set(k,{});
    return {};
  }
}

function t(key,namespace,lang){
  lang=(lang||currentLang()).toLowerCase();
  const dict=MEMO.get(memoKey(lang,namespace))||{};
  return dict[key]||key;
}

function apply(root,namespace){
  if(!root)root=document.body;
  // [data-uit="key"]  →  textContent
  root.querySelectorAll('[data-uit]').forEach(el=>{
    const k=el.getAttribute('data-uit');
    const ns=el.getAttribute('data-uit-ns')||namespace||'common';
    const val=t(k,ns);
    if(val&&val!==k){
      if(el.tagName==='INPUT'||el.tagName==='TEXTAREA')el.value=val;
      else el.textContent=val;
    }
  });
  // [data-uit-ph="key"]  →  placeholder
  root.querySelectorAll('[data-uit-ph]').forEach(el=>{
    const k=el.getAttribute('data-uit-ph');
    const ns=el.getAttribute('data-uit-ns')||namespace||'common';
    const val=t(k,ns);
    if(val&&val!==k)el.placeholder=val;
  });
}

async function loadAndApply(namespace,root){
  await load(namespace);
  // Also preload 'common' as a default fallback ns
  if(namespace!=='common')await load('common');
  apply(root||document.body,namespace);
}

// Clear cache when language changes (other code can call ElevaUIT.reset())
function reset(){
  MEMO.clear();
  try{
    Object.keys(sessionStorage).forEach(k=>{if(k.startsWith('eleva_uit::'))sessionStorage.removeItem(k);});
  }catch{}
}

win.ElevaUIT={load,t,apply,loadAndApply,reset};
})(window);
