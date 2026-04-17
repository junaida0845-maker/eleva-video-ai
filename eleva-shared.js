// ELEVA Shared Module v2.0
(function(win){
'use strict';
const SUPABASE_URL='https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eGN0b2xncWhkdGNvYW90aHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDk5NjksImV4cCI6MjA5MDM4NTk2OX0.h38gOPGOcdIw_w8p4AEYVLHCaWuC8k2XRrjLPcFAtUw';
const STORAGE_URL=SUPABASE_URL+'/storage/v1/object/media-uploads/';
let _sb=null;

function getSupabase(){
  if(_sb)return _sb;
  if(!win.supabase){console.error('Supabase not loaded');return null;}
  _sb=win.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{autoRefreshToken:true,persistSession:true}});
  return _sb;
}

async function checkAuth({requireAuth=true,redirectIfAuth=false,onUser}={}){
  const sb=getSupabase();if(!sb)return null;
  const {data:{session}}=await sb.auth.getSession();
  if(session){
    if(redirectIfAuth){win.location.href='/dashboard.html';return null;}
    if(onUser)onUser(session.user);
    return session.user;
  }else{
    if(requireAuth){win.location.href='/login.html';return null;}
    return null;
  }
}

async function logout(){
  const sb=getSupabase();if(sb)await sb.auth.signOut();
  win.location.href='/login.html';
}

// ── Splash Screen ─────────────────────────────────────────
function showSplash(){
  if(sessionStorage.getItem('eleva_splashed'))return;
  sessionStorage.setItem('eleva_splashed','1');
  const el=document.createElement('div');
  el.id='eleva-splash';
  el.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a0a;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
  el.innerHTML='<div id="splash-logo" style="font-size:clamp(48px,8vw,80px);font-weight:800;letter-spacing:0.5em;color:#c9a84c;text-shadow:0 0 30px #c9a84c,0 0 80px rgba(201,168,76,0.5);opacity:0;transition:opacity 0.6s,letter-spacing 1.2s,color 0.5s,text-shadow 0.5s;">ELEVA</div><div id="splash-sub" style="font-size:14px;color:#aaaaaa;letter-spacing:0.2em;opacity:0;transition:opacity 0.4s;">AI × SNS Growth</div>';
  const style=document.createElement('style');
  style.textContent='@keyframes splashOut{to{opacity:0;transform:scale(1.05)}}';
  document.head.appendChild(style);
  document.body.prepend(el);
  const logo=el.querySelector('#splash-logo'),sub=el.querySelector('#splash-sub');
  setTimeout(()=>{logo.style.opacity='1';},300);
  setTimeout(()=>{logo.style.color='#f0d070';logo.style.letterSpacing='0.05em';logo.style.textShadow='0 0 40px #f0d070,0 0 100px rgba(240,208,112,0.6)';},1500);
  setTimeout(()=>{sub.style.opacity='1';},2200);
  setTimeout(()=>{el.style.animation='splashOut 0.4s ease forwards';},2600);
  setTimeout(()=>{el.remove();style.remove();},3100);
}

// ── Language System ───────────────────────────────────────
const LANG_MAP={'ja':'ja','ko':'ko','ko-KR':'ko','zh-TW':'zh-tw','zh-HK':'zh-tw','zh-CN':'zh-cn','zh':'zh-tw','de':'de','fr':'fr','es':'es','pt-BR':'pt-br','th':'th','vi':'vi','id':'id','ar':'ar','hi':'hi','ms':'ms','tl':'tl','tr':'tr','ru':'ru','nl':'nl','it':'it','pl':'pl','sv':'sv','en-GB':'en-gb','en-US':'en-us','en':'en-us'};

function detectLanguage(){
  const saved=localStorage.getItem('eleva_lang');if(saved)return saved;
  const bl=navigator.language||'ja';
  const det=LANG_MAP[bl]||LANG_MAP[bl.split('-')[0]]||'ja';
  localStorage.setItem('eleva_lang',det);return det;
}

function t(key){return win.elevaT?win.elevaT(key):key;}

function applyLanguage(code){
  localStorage.setItem('eleva_lang',code);
  if(win.elevaApplyDeep){
    win.elevaApplyDeep(code);
  } else {
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const v=t(el.dataset.i18n);
      if(el.tagName==='INPUT'||el.tagName==='TEXTAREA')el.placeholder=v;
      else el.textContent=v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el=>{el.placeholder=t(el.dataset.i18nPh);});
  }
}

function showLanguageModal(){
  const existing=document.getElementById('lang-modal');if(existing)existing.remove();
  const lang=localStorage.getItem('eleva_lang')||'ja';
  const names=win.ELEVA_LANG_NAMES||{};
  const langs=Object.keys(names);
  const modal=document.createElement('div');
  modal.id='lang-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  modal.innerHTML=`<div style="background:#111111;border:1px solid rgba(201,168,76,0.3);border-radius:16px;width:90%;max-width:400px;max-height:70vh;overflow:hidden;display:flex;flex-direction:column;">
    <div style="padding:20px 24px;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#f0d070;font-weight:700;font-size:16px;">🌐 言語を選択 / Select Language</span>
      <button onclick="document.getElementById('lang-modal').remove()" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div style="overflow-y:auto;padding:8px 0;">
      ${langs.map(code=>`<button onclick="window.ELEVA.applyLanguage('${code}');document.getElementById('lang-modal').remove();setTimeout(()=>{if(window.elevaApplyDeep)window.elevaApplyDeep('${code}');},100);" style="width:100%;background:${code===lang?'rgba(201,168,76,0.1)':'none'};border:none;border-bottom:1px solid rgba(255,255,255,0.05);padding:14px 24px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='rgba(201,168,76,0.08)'" onmouseout="this.style.background='${code===lang?'rgba(201,168,76,0.1)':'none'}'">
        <span style="font-size:22px;">${names[code]?.flag||'🌐'}</span>
        <span style="color:${code===lang?'#f0d070':'#ffffff'};font-size:15px;flex:1;text-align:left;">${names[code]?.native||code}</span>
        ${code===lang?'<span style="color:#c9a84c;">✓</span>':''}
      </button>`).join('')}
    </div>
  </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  document.body.appendChild(modal);
}

// ── Hamburger Menu ────────────────────────────────────────
function initHamburger(activePage){
  const SVG=win.ELEVA_ICONS||{};
  const iconSvg=k=>SVG[k]?`<span style="display:inline-flex;align-items:center;">${SVG[k]}</span>`:`<span data-icon="${k}"></span>`;
  const items=[
    {iconKey:'home',key:'home',href:'/dashboard.html',id:'home'},
    {iconKey:'generate',key:'generate',href:'/dashboard.html#generate',id:'generate'},
    {iconKey:'trend',key:'trend',href:'/trend.html',id:'trend'},
    {iconKey:'history',key:'history',href:'/history.html',id:'history'},
    {iconKey:'chart',key:'engagement',href:'/engagement.html',id:'engagement'},
    {iconKey:'add',key:'add_video',href:'#add-video',id:'add-video'},
    {iconKey:'settings',key:'settings',href:'/settings.html',id:'settings'},
  ];
  const btn=document.createElement('button');
  btn.id='eleva-hamburger';btn.innerHTML=SVG.settings?`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`:'☰';
  btn.style.cssText='position:fixed;top:16px;left:16px;z-index:1000;background:none;border:none;color:#c9a84c;font-size:24px;cursor:pointer;padding:8px;line-height:1;';
  const ov=document.createElement('div');
  ov.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:998;backdrop-filter:blur(4px);';
  const panel=document.createElement('nav');
  panel.id='eleva-nav-panel';
  panel.style.cssText='position:fixed;top:0;left:-280px;width:280px;height:100vh;background:#111111;border-right:1px solid rgba(201,168,76,0.2);z-index:999;transition:left 0.3s cubic-bezier(0.4,0,0.2,1);overflow-y:auto;display:flex;flex-direction:column;';
  panel.innerHTML=`<div style="padding:24px 20px;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:20px;font-weight:800;color:#f0d070;letter-spacing:0.1em;">ELEVA</span>
    <button onclick="closeHamburger()" style="background:none;border:none;color:#666;font-size:20px;cursor:pointer;">×</button>
  </div>
  <div style="flex:1;padding:8px 0;">
    ${items.map(it=>{const active=activePage===it.id;return`<a href="${it.href}" data-i18n="${it.key}" style="display:flex;align-items:center;gap:12px;padding:14px 20px;color:${active?'#f0d070':'#ffffff'};text-decoration:none;font-size:15px;${active?'background:rgba(201,168,76,0.1);border-right:3px solid #c9a84c;':''}transition:all 0.15s;" onmouseover="this.style.color='#c9a84c'" onmouseout="this.style.color='${active?'#f0d070':'#ffffff'}'"><span style="flex-shrink:0;display:inline-flex;align-items:center;">${iconSvg(it.iconKey)}</span>${t(it.key)||it.key}</a>`;}).join('')}
  </div>
  <div style="padding:16px 20px;border-top:1px solid rgba(201,168,76,0.15);">
    <button onclick="window.ELEVA.showLanguageModal()" style="width:100%;background:none;border:1px solid rgba(201,168,76,0.3);color:#c9a84c;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;"><span style="display:inline-flex;align-items:center;">${iconSvg('globe')}</span> Language</button>
  </div>`;

  function openHamburger(){panel.style.left='0';ov.style.display='block';}
  win.closeHamburger=function(){panel.style.left='-280px';ov.style.display='none';};
  btn.addEventListener('click',openHamburger);
  ov.addEventListener('click',win.closeHamburger);
  panel.querySelector('[href="#add-video"]')?.addEventListener('click',e=>{e.preventDefault();win.closeHamburger();showAddVideoModal();});
  document.body.append(btn,ov,panel);
}

function showAddVideoModal(){
  const m=document.createElement('div');
  m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
  m.innerHTML=`<div style="background:#111111;border:1px solid #c9a84c;border-radius:16px;padding:32px;max-width:380px;width:90%;text-align:center;">
    <div style="font-size:20px;font-weight:700;color:#f0d070;margin-bottom:12px;" data-i18n="add_video">動画を追加</div>
    <p style="color:#aaaaaa;margin-bottom:24px;" data-i18n="generate_title">新しい動画を生成しますか？</p>
    <div style="display:flex;gap:12px;justify-content:center;">
      <button onclick="window.location.href='/dashboard.html#generate'" style="background:#c9a84c;color:#000;border:none;padding:12px 28px;border-radius:8px;font-weight:600;cursor:pointer;font-size:15px;" data-i18n="yes">YES</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:#333;color:#666;border:none;padding:12px 28px;border-radius:8px;cursor:pointer;font-size:15px;" data-i18n="no">NO</button>
    </div>
  </div>`;
  m.addEventListener('click',e=>{if(e.target===m)m.remove();});
  document.body.appendChild(m);
}

// ── Support Chatbot ───────────────────────────────────────
function initChatbot(){
  const fab=document.createElement('button');
  fab.id='chatbot-fab';
  fab.innerHTML='💬';
  fab.style.cssText='position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:#c9a84c;border:none;border-radius:50%;font-size:22px;cursor:pointer;z-index:990;box-shadow:0 0 20px rgba(201,168,76,0.4);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
  fab.addEventListener('mouseover',()=>fab.style.transform='scale(1.1)');
  fab.addEventListener('mouseout',()=>fab.style.transform='scale(1)');

  const chatWin=document.createElement('div');
  chatWin.id='chatbot-window';
  chatWin.style.cssText='position:fixed;bottom:92px;right:24px;width:340px;height:480px;background:#111111;border:1px solid rgba(201,168,76,0.3);border-radius:16px;z-index:989;display:none;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  const qrs=[t('quick_reply_1'),t('quick_reply_2'),t('quick_reply_3')];

  chatWin.innerHTML=`<div style="background:#0d0d0d;padding:16px 20px;border-bottom:1px solid rgba(201,168,76,0.2);display:flex;justify-content:space-between;align-items:center;">
    <span style="color:#f0d070;font-weight:700;font-size:15px;" data-i18n="chatbot_title">${t('chatbot_title')}</span>
    <button id="chatbot-close" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;">×</button>
  </div>
  <div id="chatbot-msgs" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;">
    <div style="background:#1a1a1a;color:#aaaaaa;padding:12px 16px;border-radius:18px 18px 18px 4px;font-size:14px;max-width:85%;" data-i18n="chatbot_welcome">${t('chatbot_welcome')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
      ${qrs.map(q=>`<button class="qr-chip" onclick="window.elevaChat('${q}')" style="background:transparent;border:1px solid #c9a84c;color:#c9a84c;padding:6px 12px;border-radius:20px;font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(201,168,76,0.1)'" onmouseout="this.style.background='transparent'">${q}</button>`).join('')}
    </div>
  </div>
  <div style="padding:12px;border-top:1px solid rgba(201,168,76,0.15);display:flex;gap:8px;">
    <input id="chatbot-input" type="text" placeholder="${t('chatbot_placeholder')}" data-i18n-ph="chatbot_placeholder" style="flex:1;background:#1a1a1a;border:1px solid #c9a84c;color:#fff;padding:10px 14px;border-radius:24px;font-size:14px;outline:none;"/>
    <button id="chatbot-send" style="background:#c9a84c;border:none;color:#000;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">➤</button>
  </div>`;

  document.body.append(fab,chatWin);

  let chatHistory=[];
  fab.addEventListener('click',()=>{
    chatWin.style.display=chatWin.style.display==='flex'?'none':'flex';
  });
  chatWin.querySelector('#chatbot-close').addEventListener('click',()=>{chatWin.style.display='none';});

  win.elevaChat=async function(msg){
    if(!msg)return;
    const msgs=chatWin.querySelector('#chatbot-msgs');
    const uMsg=document.createElement('div');
    uMsg.style.cssText='background:#c9a84c;color:#000;padding:10px 16px;border-radius:18px 18px 4px 18px;font-size:14px;max-width:80%;align-self:flex-end;margin-left:auto;';
    uMsg.textContent=msg;msgs.appendChild(uMsg);msgs.scrollTop=msgs.scrollHeight;
    chatHistory.push({role:'user',content:msg});

    const typing=document.createElement('div');
    typing.style.cssText='background:#1a1a1a;padding:12px 16px;border-radius:18px 18px 18px 4px;max-width:85%;';
    typing.innerHTML='<span style="color:#c9a84c;">⋯</span>';
    msgs.appendChild(typing);msgs.scrollTop=msgs.scrollHeight;

    try{
      const res=await fetch(SUPABASE_URL+'/functions/v1/eleva-support-chat',{
        method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+SUPABASE_ANON_KEY},
        body:JSON.stringify({message:msg,history:chatHistory.slice(-6),lang:localStorage.getItem('eleva_lang')||'ja'})
      });
      const data=await res.json();
      typing.remove();
      const aMsg=document.createElement('div');
      aMsg.style.cssText='background:#1a1a1a;color:#ffffff;padding:10px 16px;border-radius:18px 18px 18px 4px;font-size:14px;max-width:85%;white-space:pre-wrap;';
      aMsg.textContent=data.reply||data.message||t('error');
      msgs.appendChild(aMsg);chatHistory.push({role:'assistant',content:aMsg.textContent});
    }catch(e){
      typing.style.color='#ff4444';typing.textContent=t('error');
    }
    msgs.scrollTop=msgs.scrollHeight;
    chatWin.querySelector('#chatbot-input').value='';
  };

  chatWin.querySelector('#chatbot-send').addEventListener('click',()=>win.elevaChat(chatWin.querySelector('#chatbot-input').value.trim()));
  chatWin.querySelector('#chatbot-input').addEventListener('keypress',e=>{if(e.key==='Enter')win.elevaChat(e.target.value.trim());});
}

// ── Background Generation Banner ──────────────────────────
function initBackgroundGen(){
  const gen=JSON.parse(localStorage.getItem('eleva_generating')||'null');
  if(!gen)return;
  showGenBanner(gen.taskId,gen.generationId,gen.platform);
  let pollInterval=setInterval(async()=>{
    try{
      const res=await fetch('/api/video-status?taskId='+gen.taskId);
      const data=await res.json();
      if(data.status==='completed'||data.videoUrl){
        clearInterval(pollInterval);
        localStorage.removeItem('eleva_generating');
        showCompletionBanner(gen.generationId);
        if('Notification' in win && Notification.permission==='granted'){
          new Notification('ELEVA',{body:t('push_completed'),icon:'/icon.png'});
        }
      }
    }catch(e){}
  },10000);
}

function showGenBanner(taskId,generationId,platform){
  const existing=document.getElementById('gen-banner');if(existing)return;
  const banner=document.createElement('div');
  banner.id='gen-banner';
  banner.style.cssText='position:fixed;top:0;left:0;right:0;background:#c9a84c;color:#000;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;z-index:9990;font-size:14px;font-weight:600;';
  banner.innerHTML=`<span>⚡ <span data-i18n="generating">${t('generating')}</span> — <span data-i18n="background_notice">${t('background_notice')}</span></span><a href="/history.html" style="color:#000;text-decoration:underline;font-size:13px;" data-i18n="history">${t('history')}</a>`;
  document.body.prepend(banner);
  document.body.style.paddingTop=(parseInt(document.body.style.paddingTop||'0')+44)+'px';
}
win.elevaShowGenBanner=showGenBanner;

function showCompletionBanner(generationId){
  const b=document.getElementById('gen-banner');if(b)b.remove();
  const banner=document.createElement('div');
  banner.style.cssText='position:fixed;top:0;left:0;right:0;background:#1a1a1a;border-bottom:2px solid #44ff88;color:#44ff88;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;z-index:9990;font-size:14px;font-weight:600;';
  banner.innerHTML=`<span>✅ <span data-i18n="completed">${t('completed')}</span></span><a href="/history.html${generationId?'?id='+generationId:''}" style="background:#44ff88;color:#000;padding:6px 16px;border-radius:20px;text-decoration:none;font-size:13px;font-weight:700;" data-i18n="view_now">${t('view_now')}</a>`;
  document.body.prepend(banner);
  setTimeout(()=>banner.remove(),10000);
}

// ── Push Notifications ────────────────────────────────────
function requestPushPermission(){
  if(!('Notification' in win))return;
  if(Notification.permission!=='default')return;
  if(localStorage.getItem('eleva_push_asked'))return;
  setTimeout(()=>{
    localStorage.setItem('eleva_push_asked','1');
    const m=document.createElement('div');
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;';
    m.innerHTML=`<div style="background:#111111;border:1px solid #c9a84c;border-radius:16px;padding:28px;max-width:360px;width:90%;text-align:center;">
      <div style="font-size:32px;margin-bottom:12px;">🔔</div>
      <div style="color:#f0d070;font-weight:700;font-size:16px;margin-bottom:10px;" data-i18n="push_title">${t('push_title')}</div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="Notification.requestPermission();this.closest('[style*=fixed]').remove();" style="background:#c9a84c;color:#000;border:none;padding:10px 24px;border-radius:8px;font-weight:600;cursor:pointer;" data-i18n="push_allow">${t('push_allow')}</button>
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:#333;color:#666;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;" data-i18n="push_later">${t('push_later')}</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  },3000);
}

// ── Media Upload ──────────────────────────────────────────
async function uploadToStorage(file,userId){
  const ts=Date.now();
  const path=`${userId}/${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const sb=getSupabase();
  const {data,error}=await sb.storage.from('media-uploads').upload(path,file,{upsert:true});
  if(error)throw error;
  return SUPABASE_URL+'/storage/v1/object/public/media-uploads/'+path;
}

// ── Main Init ─────────────────────────────────────────────
async function initElevaPage({page,requireAuth=true,redirectIfAuth=false,onUser,skipSplash}={}){
  detectLanguage();
  if(!skipSplash)showSplash();
  applyLanguage(localStorage.getItem('eleva_lang')||'ja');
  const user=await checkAuth({requireAuth,redirectIfAuth,onUser});
  if(requireAuth&&!user)return;
  if(page&&page!=='landing'){
    initHamburger(page);
    initChatbot();
    initBackgroundGen();
    if(!localStorage.getItem('eleva_push_asked')&&user){
      requestPushPermission();
    }
  }
  return user;
}

win.ELEVA={
  getSupabase,checkAuth,logout,applyLanguage,detectLanguage,showLanguageModal,
  initHamburger,initChatbot,initBackgroundGen,showGenBanner,requestPushPermission,
  uploadToStorage,initElevaPage,t,
  SUPABASE_URL,SUPABASE_ANON_KEY,STORAGE_URL
};
})(window);
