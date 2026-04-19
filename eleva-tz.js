// ELEVA timezone-aware time formatting
// All times are stored in UTC; render in the user's preferred_timezone
// (loaded once from /functions/v1/user-preferences and cached in
// localStorage). Falls back to navigator-detected TZ, then Asia/Tokyo.
(function(win){
'use strict';

const SUPABASE_URL='https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eGN0b2xncWhkdGNvYW90aHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDk5NjksImV4cCI6MjA5MDM4NTk2OX0.h38gOPGOcdIw_w8p4AEYVLHCaWuC8k2XRrjLPcFAtUw';

const LANG_TO_LOCALE={
  ja:'ja-JP','en':'en-US','en-us':'en-US','en-gb':'en-GB',
  'zh-cn':'zh-CN','zh-tw':'zh-TW',ko:'ko-KR',
  th:'th-TH',vi:'vi-VN',id:'id-ID',hi:'hi-IN',ar:'ar-SA',
  es:'es-ES','es-mx':'es-MX','pt-br':'pt-BR',
  fr:'fr-FR',de:'de-DE',it:'it-IT',ru:'ru-RU',tr:'tr-TR',
  pl:'pl-PL',nl:'nl-NL',fil:'fil-PH',he:'he-IL',
};

function detectFallbackTz(){
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Tokyo';}
  catch{return 'Asia/Tokyo';}
}

function getLocale(){
  const lang=(localStorage.getItem('eleva_lang')||'ja').toLowerCase();
  return LANG_TO_LOCALE[lang]||navigator.language||'en-US';
}

function getTimezone(){
  const cached=localStorage.getItem('eleva_tz');
  return cached||detectFallbackTz();
}

async function syncTimezone(){
  // Best-effort: pull preferred_timezone from user-preferences and cache.
  try{
    if(!win.ELEVA||!win.ELEVA.getSupabase)return;
    const sb=win.ELEVA.getSupabase();
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return;
    const res=await fetch(SUPABASE_URL+'/functions/v1/user-preferences',{
      headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+session.access_token},
    });
    if(!res.ok)return;
    const data=await res.json();
    if(data.preferred_timezone){
      localStorage.setItem('eleva_tz',data.preferred_timezone);
    }
  }catch(e){/* silent */}
}

function formatDateTime(utc,opts={}){
  if(!utc)return '—';
  const d=utc instanceof Date?utc:new Date(utc);
  if(isNaN(d.getTime()))return '—';
  const o={timeZone:getTimezone(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...opts};
  try{return new Intl.DateTimeFormat(getLocale(),o).format(d);}
  catch{return d.toISOString().replace('T',' ').slice(0,16);}
}
function formatDate(utc){
  return formatDateTime(utc,{hour:undefined,minute:undefined});
}
function formatTime(utc){
  return formatDateTime(utc,{year:undefined,month:undefined,day:undefined});
}

// Relative time, locale-aware ("3 minutes ago", "3分前").
function formatRelative(utc){
  if(!utc)return '—';
  const d=utc instanceof Date?utc:new Date(utc);
  if(isNaN(d.getTime()))return '—';
  const diffSec=Math.round((d.getTime()-Date.now())/1000);
  const abs=Math.abs(diffSec);
  let value=diffSec,unit='second';
  if(abs>=86400){value=Math.round(diffSec/86400);unit='day';}
  else if(abs>=3600){value=Math.round(diffSec/3600);unit='hour';}
  else if(abs>=60){value=Math.round(diffSec/60);unit='minute';}
  try{return new Intl.RelativeTimeFormat(getLocale(),{numeric:'auto'}).format(value,unit);}
  catch{return formatDateTime(utc);}
}

win.ElevaTZ={
  syncTimezone,
  getTimezone,
  getLocale,
  formatDateTime,
  formatDate,
  formatTime,
  formatRelative,
};

// Auto-sync once on load (no-op if not signed in)
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncTimezone);
else syncTimezone();
})(window);
