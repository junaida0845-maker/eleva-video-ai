// ELEVA Floating Support Chat Widget
// Injects a fixed FAB + chat panel into every page.
// Backend: /functions/v1/eleva-support-chat
(function(){
'use strict';

if(window.__elevaChatWidgetLoaded)return;
window.__elevaChatWidgetLoaded=true;

const SUPABASE_URL='https://syxctolgqhdtcoaothwi.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5eGN0b2xncWhkdGNvYW90aHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDk5NjksImV4cCI6MjA5MDM4NTk2OX0.h38gOPGOcdIw_w8p4AEYVLHCaWuC8k2XRrjLPcFAtUw';
const ENDPOINT=SUPABASE_URL+'/functions/v1/eleva-support-chat';

const WELCOME_TEXT=
  'こんにちは！ELEVAのサポートAIです。\n\n'+
  '設定でわからないことがあれば、画面のスクリーンショットを送ってもらえると正確に案内できます。\n\n'+
  'どんなことでもお気軽に質問してください。';

// Suppress on pages that already have a dedicated chat UI
const SUPPRESS_PATHS=['/tiktok-shop-support.html'];
const path=location.pathname.toLowerCase();
if(SUPPRESS_PATHS.some(p=>path.endsWith(p)))return;

let chatHistory=[];
let pendingImage=null;
let loadingCounter=0;

// ── Styles ─────────────────────────────────
const css=`
#eleva-chat-fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:#c9a84c;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9000;box-shadow:0 4px 16px rgba(201,168,76,0.4);transition:transform 0.2s,background 0.2s;border:none;}
#eleva-chat-fab:hover{transform:scale(1.08);background:#f0d070;}
#eleva-chat-fab svg{width:26px;height:26px;color:#000;}

#eleva-chat-panel{position:fixed;bottom:90px;right:24px;width:340px;height:500px;max-height:calc(100vh - 120px);background:#111;border:1px solid rgba(201,168,76,0.4);border-radius:8px;display:none;flex-direction:column;z-index:9001;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:'DM Sans','Noto Sans JP',sans-serif;}
#eleva-chat-panel.open{display:flex;}

#eleva-chat-header{background:rgba(201,168,76,0.1);border-bottom:1px solid rgba(201,168,76,0.2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:500;color:#c9a84c;flex-shrink:0;letter-spacing:0.3px;}
#eleva-chat-header button{background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:22px;line-height:1;cursor:pointer;padding:0 4px;}
#eleva-chat-header button:hover{color:#fff;}

#eleva-chat-messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;}
#eleva-chat-messages::-webkit-scrollbar{width:5px;}
#eleva-chat-messages::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.3);border-radius:3px;}

.echat-msg-ai{background:rgba(201,168,76,0.08);border-left:2px solid #c9a84c;padding:10px 12px;border-radius:0 6px 6px 0;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.65;max-width:90%;word-break:break-word;}
.echat-msg-ai b{color:#c9a84c;font-weight:600;}
.echat-msg-user{background:rgba(255,255,255,0.06);padding:10px 12px;border-radius:6px 0 0 6px;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.65;max-width:90%;align-self:flex-end;word-break:break-word;}
.echat-msg-img{display:block;max-width:160px;max-height:160px;border-radius:4px;border:1px solid rgba(201,168,76,0.3);margin-top:6px;cursor:zoom-in;}
.echat-msg-img:first-child{margin-top:0;}
.echat-loading{display:inline-flex;gap:4px;}
.echat-loading span{width:6px;height:6px;border-radius:50%;background:#c9a84c;animation:echatDots 1.2s infinite ease-in-out;}
.echat-loading span:nth-child(2){animation-delay:0.15s;}
.echat-loading span:nth-child(3){animation-delay:0.3s;}
@keyframes echatDots{0%,60%,100%{opacity:0.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}

#eleva-chat-image-preview{padding:0 12px 8px;display:none;align-items:center;gap:8px;}
#eleva-chat-image-preview.show{display:flex;}
#eleva-chat-image-preview img{max-height:60px;border-radius:4px;border:1px solid #c9a84c;}
#eleva-chat-image-preview button{margin-left:auto;background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:18px;cursor:pointer;padding:2px 8px;}
#eleva-chat-image-preview button:hover{color:#fff;}

#eleva-chat-input-area{border-top:1px solid rgba(255,255,255,0.08);padding:10px 12px;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}
#eleva-chat-attach{background:transparent;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#c9a84c;padding:0;width:36px;height:36px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
#eleva-chat-attach:hover{background:rgba(201,168,76,0.12);border-color:#c9a84c;}
#eleva-chat-attach svg{width:16px;height:16px;}
#eleva-chat-text{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;padding:8px 10px;font-family:inherit;font-size:13px;line-height:1.5;resize:none;min-height:36px;max-height:100px;transition:border-color .15s,background .15s;}
#eleva-chat-text:focus{outline:none;border-color:#c9a84c;background:rgba(255,255,255,0.07);}
#eleva-chat-text::placeholder{color:rgba(255,255,255,0.3);}
#eleva-chat-send{background:#c9a84c;color:#000;border:none;border-radius:4px;padding:0 14px;height:36px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;letter-spacing:0.3px;transition:background .15s;}
#eleva-chat-send:hover:not(:disabled){background:#f0d070;}
#eleva-chat-send:disabled{opacity:0.4;cursor:not-allowed;}

#eleva-chat-imgmodal{position:fixed;inset:0;background:rgba(0,0,0,0.92);display:none;align-items:center;justify-content:center;z-index:9100;padding:20px;cursor:zoom-out;}
#eleva-chat-imgmodal.open{display:flex;}
#eleva-chat-imgmodal img{max-width:100%;max-height:100%;border-radius:4px;}

@media (max-width:520px){
  #eleva-chat-fab{bottom:16px;right:16px;}
  #eleva-chat-panel{bottom:80px;right:8px;left:8px;width:auto;height:calc(100dvh - 110px);max-height:calc(100dvh - 110px);}
}
`;

// ── Inject ─────────────────────────────────
function init(){
  const style=document.createElement('style');
  style.id='eleva-chat-widget-style';
  style.textContent=css;
  document.head.appendChild(style);

  const fab=document.createElement('button');
  fab.id='eleva-chat-fab';
  fab.setAttribute('aria-label','サポートチャットを開く');
  fab.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  fab.onclick=openChat;

  const panel=document.createElement('div');
  panel.id='eleva-chat-panel';
  panel.innerHTML=
    '<div id="eleva-chat-header">'+
      '<span>ELEVAサポート</span>'+
      '<button aria-label="閉じる" onclick="window.__elevaChat.close()">×</button>'+
    '</div>'+
    '<div id="eleva-chat-messages"></div>'+
    '<div id="eleva-chat-image-preview">'+
      '<img id="eleva-chat-preview-img" alt=""/>'+
      '<button aria-label="削除" onclick="window.__elevaChat.clearImg()">×</button>'+
    '</div>'+
    '<div id="eleva-chat-input-area">'+
      '<input type="file" id="eleva-chat-file" accept="image/*" hidden/>'+
      '<button id="eleva-chat-attach" aria-label="スクショ添付" title="スクショ添付">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>'+
      '</button>'+
      '<textarea id="eleva-chat-text" rows="1" placeholder="質問を入力（Enterで送信）"></textarea>'+
      '<button id="eleva-chat-send">送信</button>'+
    '</div>';

  const modal=document.createElement('div');
  modal.id='eleva-chat-imgmodal';
  modal.innerHTML='<img alt=""/>';
  modal.onclick=()=>{modal.classList.remove('open');modal.querySelector('img').src='';};

  document.body.appendChild(fab);
  document.body.appendChild(panel);
  document.body.appendChild(modal);

  document.getElementById('eleva-chat-attach').onclick=()=>document.getElementById('eleva-chat-file').click();
  document.getElementById('eleva-chat-file').onchange=handleImageUpload;
  document.getElementById('eleva-chat-send').onclick=sendMessage;

  const ta=document.getElementById('eleva-chat-text');
  ta.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
  });
  ta.addEventListener('input',()=>{
    ta.style.height='auto';
    ta.style.height=Math.min(100,ta.scrollHeight)+'px';
  });
}

// ── Open / close ─────────────────────────────────
function openChat(){
  const panel=document.getElementById('eleva-chat-panel');
  panel.classList.add('open');
  if(chatHistory.length===0)appendMessage('ai',WELCOME_TEXT,null);
  setTimeout(()=>document.getElementById('eleva-chat-text')?.focus(),50);
}
function closeChat(){
  document.getElementById('eleva-chat-panel').classList.remove('open');
}

// ── Escape + markdown-lite ─────────────────────────────────
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function formatText(s){
  return escapeHtml(s).replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>');
}

// ── Image ─────────────────────────────────
function compressImage(file,maxDim=1024,quality=0.85){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){
        if(w>=h){h=Math.round(h*maxDim/w);w=maxDim;}
        else{w=Math.round(w*maxDim/h);h=maxDim;}
      }
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('image load failed'));};
    img.src=url;
  });
}
async function handleImageUpload(e){
  const file=e.target.files&&e.target.files[0];
  e.target.value='';
  if(!file)return;
  if(!file.type.startsWith('image/')){alert('画像ファイルを選択してください。');return;}
  try{
    const dataUrl=await compressImage(file);
    pendingImage=dataUrl;
    document.getElementById('eleva-chat-preview-img').src=dataUrl;
    document.getElementById('eleva-chat-image-preview').classList.add('show');
  }catch(err){
    alert('画像の読み込みに失敗しました。');
  }
}
function clearImg(){
  pendingImage=null;
  document.getElementById('eleva-chat-image-preview').classList.remove('show');
  document.getElementById('eleva-chat-preview-img').src='';
}

// ── Messages ─────────────────────────────────
function appendMessage(role,text,imageData){
  const wrap=document.getElementById('eleva-chat-messages');
  const div=document.createElement('div');
  div.className=role==='ai'?'echat-msg-ai':'echat-msg-user';
  let html='';
  if(imageData){
    html+='<img class="echat-msg-img" src="'+escapeHtml(imageData)+'" alt="添付画像"/>';
  }
  if(text){
    html+=formatText(text);
  }
  div.innerHTML=html;
  const imgs=div.querySelectorAll('.echat-msg-img');
  imgs.forEach(im=>im.addEventListener('click',()=>{
    const m=document.getElementById('eleva-chat-imgmodal');
    m.querySelector('img').src=im.src;
    m.classList.add('open');
  }));
  wrap.appendChild(div);
  wrap.scrollTop=wrap.scrollHeight;
}
function appendLoading(){
  const id='echat-loading-'+(++loadingCounter);
  const wrap=document.getElementById('eleva-chat-messages');
  const div=document.createElement('div');
  div.className='echat-msg-ai';
  div.id=id;
  div.innerHTML='<span class="echat-loading"><span></span><span></span><span></span></span>';
  wrap.appendChild(div);
  wrap.scrollTop=wrap.scrollHeight;
  return id;
}
function removeLoading(id){const el=document.getElementById(id);if(el)el.remove();}

// ── Send ─────────────────────────────────
async function sendMessage(){
  const input=document.getElementById('eleva-chat-text');
  const sendBtn=document.getElementById('eleva-chat-send');
  const text=input.value.trim();
  if(!text&&!pendingImage)return;

  const imageData=pendingImage;
  appendMessage('user',text,imageData);
  input.value='';
  input.style.height='auto';
  pendingImage=null;
  clearImg();

  sendBtn.disabled=true;
  const loadingId=appendLoading();

  try{
    const token=await getAccessToken();
    const payload={
      message:text,
      history:chatHistory.slice(-10),
      page_url:location.pathname,
    };
    if(imageData)payload.image_base64=imageData;

    const res=await fetch(ENDPOINT,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        apikey:SUPABASE_ANON_KEY,
        'Authorization':'Bearer '+(token||SUPABASE_ANON_KEY),
      },
      body:JSON.stringify(payload),
    });
    const json=await res.json().catch(()=>({}));
    removeLoading(loadingId);

    if(res.ok&&json.reply){
      appendMessage('ai',json.reply,null);
      chatHistory.push({role:'user',content:text});
      chatHistory.push({role:'assistant',content:json.reply});
    }else{
      const msg=json.error||json.message||('HTTP '+res.status);
      appendMessage('ai','エラーが発生しました: '+msg+'\n\nもう一度お試しください。',null);
    }
  }catch(e){
    removeLoading(loadingId);
    appendMessage('ai','通信エラーが発生しました。ネットワークをご確認のうえ再送してください。',null);
  }finally{
    sendBtn.disabled=false;
    input.focus();
  }
}

async function getAccessToken(){
  try{
    if(window.ELEVA&&ELEVA.getSupabase){
      const sb=ELEVA.getSupabase();
      if(sb){
        const {data:{session}}=await sb.auth.getSession();
        return session?.access_token||null;
      }
    }
    if(window.supabase&&window.supabase.createClient){
      const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
      const {data:{session}}=await sb.auth.getSession();
      return session?.access_token||null;
    }
  }catch(e){}
  return null;
}

// ── Boot ─────────────────────────────────
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}

window.__elevaChat={open:openChat,close:closeChat,clearImg:clearImg};

})();
