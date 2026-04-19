// ELEVA legal-shell — language switcher + shared footer for /legal/*
// Reads UI labels from /i18n/legal.json. Body content is per-page,
// wrapped in <div data-lang-show="xx">…</div> blocks.
(function(){
'use strict';

const LANGS=['ja','en','zh-cn','zh-tw','ko'];
const LANG_META={
  ja:{flag:'🇯🇵',name:'日本語'},
  en:{flag:'🇺🇸',name:'English'},
  'zh-cn':{flag:'🇨🇳',name:'简体中文'},
  'zh-tw':{flag:'🇹🇼',name:'繁體中文'},
  ko:{flag:'🇰🇷',name:'한국어'},
};

let UI={};

function detectLang(){
  const url=new URL(location.href);
  const q=url.searchParams.get('lang');
  if(q&&LANGS.includes(q))return q;
  const stored=localStorage.getItem('eleva_lang');
  if(stored&&LANGS.includes(stored))return stored;
  if(stored&&stored.startsWith('en'))return 'en';
  if(stored&&stored.startsWith('zh-tw'))return 'zh-tw';
  if(stored&&stored.startsWith('zh-cn'))return 'zh-cn';
  if(stored&&stored.startsWith('ko'))return 'ko';
  const nav=(navigator.language||'ja').toLowerCase();
  if(nav.startsWith('en'))return 'en';
  if(nav.startsWith('ko'))return 'ko';
  if(nav.startsWith('zh-tw')||nav==='zh-hk'||nav==='zh-hant')return 'zh-tw';
  if(nav.startsWith('zh'))return 'zh-cn';
  return 'ja';
}

function applyLang(lang){
  if(!LANGS.includes(lang))lang='ja';
  localStorage.setItem('eleva_lang',lang);
  document.documentElement.lang=lang;
  const url=new URL(location.href);
  url.searchParams.set('lang',lang);
  history.replaceState({},'',url);

  // Show/hide language-tagged blocks. Fallback: en, then ja.
  const tagged=Array.from(document.querySelectorAll('[data-lang-show]'));
  const groupedByContainer=new Map();
  tagged.forEach(el=>{
    const parent=el.parentElement||document.body;
    if(!groupedByContainer.has(parent))groupedByContainer.set(parent,[]);
    groupedByContainer.get(parent).push(el);
    el.style.display='none';
  });
  groupedByContainer.forEach(blocks=>{
    const order=[lang,'en','ja'];
    let chosen=null;
    for(const l of order){
      chosen=blocks.find(el=>(el.getAttribute('data-lang-show')||'').split(',').map(s=>s.trim()).includes(l));
      if(chosen)break;
    }
    if(chosen)chosen.style.display='';
  });
  // Apply UI strings
  const ui=UI[lang]||UI.en||UI.ja||{};
  document.querySelectorAll('[data-legal]').forEach(el=>{
    const k=el.getAttribute('data-legal');
    if(ui[k])el.textContent=ui[k];
  });
  // Update selector label
  const sel=document.getElementById('lang-selector-current');
  if(sel)sel.textContent=(LANG_META[lang]?.flag||'')+' '+(LANG_META[lang]?.name||lang);
}

function buildSelector(){
  const wrap=document.getElementById('lang-selector');
  if(!wrap)return;
  wrap.innerHTML=`
    <button id="lang-selector-btn" style="display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #1f1f1f;border-radius:8px;color:#a8a8a8;font-size:12px;background:transparent;cursor:pointer;font-family:inherit;">
      <span id="lang-selector-current">日本語</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style="color:#d4af37;"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div id="lang-selector-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:#0f0f0f;border:1px solid #1f1f1f;border-radius:10px;min-width:160px;padding:4px;z-index:100;box-shadow:0 4px 16px rgba(0,0,0,0.5);"></div>
  `;
  wrap.style.position='relative';
  const menu=document.getElementById('lang-selector-menu');
  menu.innerHTML=LANGS.map(l=>`
    <button onclick="LegalShell.set('${l}')" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;background:transparent;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;text-align:left;font-family:inherit;">
      <span>${LANG_META[l].flag}</span><span>${LANG_META[l].name}</span>
    </button>
  `).join('');
  document.getElementById('lang-selector-btn').addEventListener('click',e=>{
    e.stopPropagation();
    const open=menu.style.display==='block';
    menu.style.display=open?'none':'block';
  });
  document.addEventListener('click',()=>{menu.style.display='none';});
}

function buildFooter(){
  const f=document.getElementById('legal-footer');
  if(!f)return;
  f.innerHTML=`
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:18px;margin-bottom:14px;">
      <a href="/commerce.html" data-legal="footer_commerce" style="color:#6b6b6b;font-size:12px;text-decoration:none;">特定商取引法に基づく表記</a>
      <a href="/terms.html" data-legal="footer_terms" style="color:#6b6b6b;font-size:12px;text-decoration:none;">利用規約</a>
      <a href="/privacy.html" data-legal="footer_privacy" style="color:#6b6b6b;font-size:12px;text-decoration:none;">プライバシーポリシー</a>
      <a href="/company.html" data-legal="footer_company" style="color:#6b6b6b;font-size:12px;text-decoration:none;">会社情報</a>
      <a href="/contact.html" data-legal="footer_contact" style="color:#6b6b6b;font-size:12px;text-decoration:none;">お問い合わせ</a>
    </div>
    <div style="color:#6b6b6b;font-size:11px;letter-spacing:.5px;">© 2026 株式会社LETIZIA — All rights reserved.</div>
  `;
  f.querySelectorAll('a').forEach(a=>a.addEventListener('mouseenter',()=>a.style.color='#d4af37'));
  f.querySelectorAll('a').forEach(a=>a.addEventListener('mouseleave',()=>a.style.color='#6b6b6b'));
}

async function init(){
  try{
    const res=await fetch('/i18n/legal.json',{cache:'no-cache'});
    if(res.ok)UI=await res.json();
  }catch(e){console.warn('[legal-shell] i18n load failed',e);}
  buildSelector();
  buildFooter();
  applyLang(detectLang());
}

window.LegalShell={
  set(lang){applyLang(lang);},
  get(){return localStorage.getItem('eleva_lang')||'ja';},
  langs:LANGS,
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
