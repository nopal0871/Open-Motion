(()=>{
  const root=document.documentElement;
  const STORAGE_KEY='omsDesktopLandscapePreviewRatio';
  const MIN_PREVIEW=220;
  const MIN_TIMELINE=260;
  let handle=null;
  let raf=0;
  let originalPositionLayerActions=null;

  const inDesktopLandscape=()=>root.classList.contains('omsMobileLandscapeDesktop');
  const editorMain=()=>document.querySelector('.editorMain');
  const timelineArea=()=>document.querySelector('.timelineArea');

  function ensureHandle(){
    const ta=timelineArea();
    if(!ta)return null;
    if(handle&&handle.isConnected)return handle;
    handle=document.createElement('button');
    handle.type='button';
    handle.id='desktopCanvasSplitHandle';
    handle.setAttribute('aria-label','Geser lebar canvas dan timeline');
    handle.setAttribute('title','Geser untuk mengatur lebar canvas');
    handle.innerHTML='<span class="desktopCanvasSplitGrip" aria-hidden="true"><i></i></span>';
    ta.appendChild(handle);

    let active=false,startX=0,startPreview=0;
    const onMove=(clientX)=>{
      const main=editorMain();
      if(!main)return;
      const rect=main.getBoundingClientRect();
      const delta=clientX-startX;
      const maxPreview=Math.max(MIN_PREVIEW,rect.width-MIN_TIMELINE);
      const next=Math.max(MIN_PREVIEW,Math.min(maxPreview,startPreview+delta));
      const ratio=Math.max(.26,Math.min(.74,next/Math.max(1,rect.width)));
      try{localStorage.setItem(STORAGE_KEY,String(ratio))}catch(e){}
      applySplit(ratio);
    };
    const move=(ev)=>{if(!active)return;ev.preventDefault();onMove(ev.clientX)};
    const up=(ev)=>{
      if(!active)return;
      active=false;
      handle.classList.remove('dragging');
      try{handle.releasePointerCapture(ev.pointerId)}catch(e){}
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',up,true);
      try{ui?.fit?.()}catch(e){}
      try{timeline?.rebuild?.()}catch(e){}
      try{renderer?.resize?.()}catch(e){}
      try{renderer?.render?.()}catch(e){}
    };
    handle.addEventListener('pointerdown',ev=>{
      if(!inDesktopLandscape())return;
      const main=editorMain();
      if(!main)return;
      ev.preventDefault();
      active=true;
      startX=ev.clientX;
      startPreview=previewWidth(main);
      handle.classList.add('dragging');
      try{handle.setPointerCapture(ev.pointerId)}catch(e){}
      window.addEventListener('pointermove',move,true);
      window.addEventListener('pointerup',up,true);
      window.addEventListener('pointercancel',up,true);
    },{passive:false});
    return handle;
  }

  function previewWidth(main){
    const cs=getComputedStyle(main);
    const cols=(cs.gridTemplateColumns||'').split(' ');
    if(cols.length>=2){
      const first=parseFloat(cols[0]);
      if(Number.isFinite(first)&&first>0)return first;
    }
    const rect=main.getBoundingClientRect();
    let ratio=.47;
    try{ratio=parseFloat(localStorage.getItem(STORAGE_KEY))||ratio}catch(e){}
    return rect.width*ratio;
  }

  function applySplit(ratio){
    const main=editorMain();
    if(!main)return;
    if(!inDesktopLandscape()){
      main.style.removeProperty('grid-template-columns');
      return;
    }
    const rect=main.getBoundingClientRect();
    const safeRatio=Math.max(.26,Math.min(.74,Number.isFinite(ratio)?ratio:.47));
    const preview=Math.max(MIN_PREVIEW,Math.min(Math.max(MIN_PREVIEW,rect.width-MIN_TIMELINE),rect.width*safeRatio));
    main.style.setProperty('grid-template-columns',`${Math.round(preview)}px minmax(0,1fr)`,'important');
  }

  function fitLayerActionsPopup(){
    const popup=document.getElementById('layerActionsPopup');
    if(!popup)return;
    popup.style.left='50%';
    popup.style.top='50%';
    popup.style.transform='translate(-50%,-50%)';
    popup.style.width=`${Math.min(344,window.innerWidth-28)}px`;
    popup.style.maxHeight=`${Math.max(200,window.innerHeight-24)}px`;
  }

  function sync(){
    // V4.41: the toolbar controller below is the sole horizontal-split owner.
    // Do not create or run the superseded timeline-edge handle/controller.
    const legacy=document.getElementById('desktopCanvasSplitHandle');
    if(legacy)legacy.remove();
    if(document.getElementById('layerActionsShade')&&!document.getElementById('layerActionsShade').classList.contains('hidden')&&inDesktopLandscape())fitLayerActionsPopup();
  }

  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)}

  function patchLayerActionsPosition(){
    if(typeof ui==='undefined'||!ui||originalPositionLayerActions)return;
    originalPositionLayerActions=ui.positionLayerActions?.bind(ui);
    if(!originalPositionLayerActions)return;
    ui.positionLayerActions=function(){
      if(inDesktopLandscape())return fitLayerActionsPopup();
      const popup=document.getElementById('layerActionsPopup');
      if(popup)popup.style.removeProperty('transform');
      return originalPositionLayerActions();
    };
  }

  patchLayerActionsPosition();
  schedule();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  setTimeout(()=>{patchLayerActionsPosition();schedule()},0);
})();
