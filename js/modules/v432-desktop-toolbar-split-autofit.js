(()=>{
  // V4.41 — one horizontal split controller for desktop PC and the existing
  // mobile-landscape desktop workspace. EditorSplitController stays vertical.
  const root=document.documentElement;
  const STORAGE_KEY='omsDesktopCanvasSplitRatioV441A';
  const LEGACY_STORAGE_KEY='omsDesktopLandscapePreviewRatio';
  const MIN_PREVIEW=240;
  const MIN_TIMELINE=320;
  let btn=null;
  let raf=0;
  let fitRAF=0;
  let timelineFitRAF=0;
  let timelineFitReleaseRAF=0;
  let splitKeepTime=0;
  let splitKeepZoomScale=1;
  let splitPreserveUserZoom=false;
  let mainResizeObserver=null;
  let desktopCanvasSplitRatio=null;
  let originalPositionLayerActions=null;

  const inMobileLandscapeDesktop=()=>root.classList.contains('omsMobileLandscapeDesktop');
  const isDesktopPC=()=>window.matchMedia('(min-width:900px)').matches;
  const horizontalSplitEnabled=()=>isDesktopPC()||inMobileLandscapeDesktop();
  const editorMain=()=>document.querySelector('.editorMain');
  const transportToolbar=()=>document.querySelector('.transportBalanced');

  function readRatio(){
    if(Number.isFinite(desktopCanvasSplitRatio))return desktopCanvasSplitRatio;
    let value=NaN;
    try{value=parseFloat(sessionStorage.getItem(STORAGE_KEY))}catch(e){}
    // Preserve the former mobile-landscape ratio only when that layout is active;
    // a phone split must not become the first-run desktop-PC split.
    if(!Number.isFinite(value)&&inMobileLandscapeDesktop()){
      try{value=parseFloat(localStorage.getItem(LEGACY_STORAGE_KEY))}catch(e){}
    }
    desktopCanvasSplitRatio=Number.isFinite(value)?Math.max(.1,Math.min(.9,value)):NaN;
    return desktopCanvasSplitRatio;
  }

  function rememberRatio(value){
    desktopCanvasSplitRatio=Math.max(.1,Math.min(.9,value));
    try{sessionStorage.setItem(STORAGE_KEY,String(desktopCanvasSplitRatio))}catch(e){}
  }

  function beginTimelineSplitFit(){
    if(typeof timeline==='undefined'||!timeline||!model?.project)return;
    // V5.68 — synchronize the restored project BEFORE arming the responsive
    // split fit. syncProjectZoom() intentionally disables initialFitActive when
    // it sees a different project id. In legacy projects that ordering could
    // cancel the splitter's first live-fit pass and resurrect the saved old
    // timeline geometry. Consuming the project switch first makes old and new
    // projects enter the exact same splitter path.
    try{timeline.syncProjectZoom?.()}catch(e){}
    splitKeepTime=clamp(+model.time||0,0,Math.max(0,+model.project.duration||0));
    splitKeepZoomScale=timeline.projectTimelineZoomScale?.(model.project)??1;
    // V5.120 — a completed pinch writes a non-default viewport-relative zoom
    // scale. On mobile landscape that explicit user zoom must survive the
    // three-line splitter. V5.119 always forced scale=1 during splitter drag,
    // which was safe before pinch but discarded the user's zoom and could let
    // ruler/scroll geometry diverge from the centered playhead afterwards.
    splitPreserveUserZoom=inMobileLandscapeDesktop()&&Math.abs(splitKeepZoomScale-1)>.0001;
    timeline._desktopSplitResizeActive=true;
    timeline._desktopSplitResizeTime=splitKeepTime;
    timeline._mobileLandscapeSplitKeepScale=splitKeepZoomScale;
    timeline._mobileLandscapeSplitPreserveUserZoom=splitPreserveUserZoom;
    // Mobile landscape uses the same visible three-line splitter as desktop,
    // but Chromium delivers substantially more intermediate resize callbacks on
    // touch. Mark only that path so its geometry is owned by this transaction;
    // the already-stable desktop-PC behavior remains unchanged.
    timeline._mobileLandscapeSplitResizeActive=inMobileLandscapeDesktop();
    if(timeline._mobileLandscapeSplitResizeActive)timeline._mobileLandscapeSplitSuppressUntil=0;
    // With the default zoom, preserve the established responsive 2-second-fit
    // splitter behavior. After a user pinch on mobile landscape, keep the
    // explicit viewport-relative scale instead of re-arming initial fit.
    timeline.initialFitSeconds=2;
    timeline.initialFitActive=!splitPreserveUserZoom;
    cancelAnimationFrame(timelineFitReleaseRAF);
    timelineFitReleaseRAF=0;
  }

  function scheduleTimelineSplitFit(){
    if(typeof timeline==='undefined'||!timeline?._desktopSplitResizeActive||!model?.project)return;
    cancelAnimationFrame(timelineFitRAF);
    timelineFitRAF=requestAnimationFrame(()=>{
      timelineFitRAF=0;
      if(!timeline._desktopSplitResizeActive||!model?.project)return;
      const keep=clamp(splitKeepTime,0,Math.max(0,+model.project.duration||0));
      model.time=keep;
      timeline._desktopSplitResizeTime=keep;
      timeline.initialFitSeconds=2;
      const preserveMobileZoom=!!timeline._mobileLandscapeSplitResizeActive&&
        !!timeline._mobileLandscapeSplitPreserveUserZoom;
      if(preserveMobileZoom){
        // The pinch scale is dimensionless relative to the CURRENT viewport.
        // Reapply that same scale after every splitter width change so px/s,
        // center padding, ruler and scroll are rebuilt from one coherent width.
        timeline.initialFitActive=false;
        if(model.project)model.project.timelineZoomScale=timeline._mobileLandscapeSplitKeepScale||splitKeepZoomScale||1;
        timeline.applyViewportRelativeProjectZoom?.({persist:true,rebuild:true});
      }else{
        timeline.initialFitActive=true;
        // applyInitialSecondsFit rebuilds ruler/tracks with the NEW centerPad and
        // NEW px/s. This is the piece browser-resize had but the internal splitter
        // lacked, which caused the fixed 50% playhead to appear over another tick.
        timeline.applyInitialSecondsFit?.({persist:true,rebuild:true});
        // At default mobile zoom, commit scale=1 for the NEW viewport so a stale
        // project value cannot be replayed by a delayed ResizeObserver.
        if(timeline._mobileLandscapeSplitResizeActive){
          try{timeline.persistProjectTimelineZoom?.(timeline.px,{scale:1})}catch(e){}
        }
      }
      model.time=keep;
      const sc=document.getElementById('timelineScroll');
      if(sc&&timeline.isCentered?.()){
        timeline.syncingScroll=true;
        const target=keep*timeline.px;
        sc.scrollLeft=target;
        timeline.lastScrollLeft=target;
        requestAnimationFrame(()=>{
          timeline.syncingScroll=false;
          timeline.updatePlayhead?.();
        });
      }else{
        timeline.updatePlayhead?.();
      }
    });
  }

  function endTimelineSplitFit(){
    if(typeof timeline==='undefined'||!timeline?._desktopSplitResizeActive)return;
    // Final pass after layout settles, then keep the guard alive for one more
    // animation frame so Chromium's delayed resize-scroll cannot scrub time.
    scheduleTimelineSplitFit();
    cancelAnimationFrame(timelineFitReleaseRAF);
    const mobileLandscapeTxn=!!timeline._mobileLandscapeSplitResizeActive;
    timelineFitReleaseRAF=requestAnimationFrame(()=>{
      timelineFitReleaseRAF=requestAnimationFrame(()=>{
        if(typeof timeline==='undefined'||!timeline)return;
        const keep=clamp(splitKeepTime,0,Math.max(0,+model.project?.duration||0));
        model.time=keep;
        timeline._desktopSplitResizeTime=keep;

        if(mobileLandscapeTxn){
          // Android landscape needs one authoritative final build after the CSS
          // grid width has stopped changing. Keep the transaction flag active
          // during this rebuild so scroll events cannot reinterpret the layout
          // clamp as a user scrub.
          timeline.initialFitSeconds=2;
          const preserveMobileZoom=!!timeline._mobileLandscapeSplitPreserveUserZoom;
          if(preserveMobileZoom){
            timeline.initialFitActive=false;
            if(model.project)model.project.timelineZoomScale=timeline._mobileLandscapeSplitKeepScale||splitKeepZoomScale||1;
            timeline.applyViewportRelativeProjectZoom?.({persist:true,rebuild:true});
          }else{
            timeline.initialFitActive=true;
            timeline.applyInitialSecondsFit?.({persist:true,rebuild:true});
            try{timeline.persistProjectTimelineZoom?.(timeline.px,{scale:1})}catch(e){}
          }
          model.time=keep;
          const sc=document.getElementById('timelineScroll');
          if(sc&&timeline.isCentered?.()){
            const target=keep*timeline.px;
            timeline.syncingScroll=true;
            sc.scrollLeft=target;
            timeline.lastScrollLeft=target;
          }
          // Ignore late Android ResizeObserver deliveries briefly. The final
          // geometry above is authoritative for this completed drag.
          timeline._mobileLandscapeSplitSuppressUntil=performance.now()+220;
        }

        timeline.updatePlayhead?.();
        timeline._desktopSplitResizeActive=false;
        timeline._mobileLandscapeSplitResizeActive=false;
        timeline._mobileLandscapeSplitPreserveUserZoom=false;
        timeline._mobileLandscapeSplitKeepScale=1;
        splitPreserveUserZoom=false;
        splitKeepZoomScale=1;
        timelineFitReleaseRAF=0;
        requestAnimationFrame(()=>{
          if(typeof timeline==='undefined'||!timeline)return;
          timeline.syncingScroll=false;
          model.time=keep;
          timeline.updatePlayhead?.();
        });
      });
    });
  }

  function fitPopup(){
    const popup=document.getElementById('layerActionsPopup');
    if(!popup)return;
    popup.style.left='50%';
    popup.style.top='50%';
    popup.style.transform='translate(-50%,-50%)';
    popup.style.width=`${Math.min(322, window.innerWidth - 20)}px`;
    popup.style.maxHeight=`${Math.max(210, window.innerHeight - 12)}px`;
  }

  function ensureToolbarHandle(){
    const host=transportToolbar();
    if(!host)return null;
    if(btn&&btn.isConnected)return btn;
    btn=document.createElement('button');
    btn.type='button';
    btn.id='desktopCanvasSplitToolbarBtn';
    btn.setAttribute('aria-label','Geser lebar canvas dan timeline');
    btn.setAttribute('title','Geser untuk mengatur lebar canvas dan timeline');
    btn.innerHTML='<span class="desktopCanvasSplitGripV" aria-hidden="true"><i></i></span>';
    host.appendChild(btn);

    let active=false,activePointerId=null,startX=0,startPreview=0;
    const move=(ev)=>{
      if(!active||ev.pointerId!==activePointerId)return;
      ev.preventDefault();
      const main=editorMain();
      if(!main)return;
      const rect=main.getBoundingClientRect();
      const delta=ev.clientX-startX;
      const raw=startPreview+delta;
      const next=clampPreviewPx(raw,rect.width);
      const ratio=next/Math.max(1,rect.width);
      applySplit(ratio,{ensureFit:false});
      refitCanvasAfterLayout();
      scheduleTimelineSplitFit();
    };
    const up=(ev)=>{
      if(!active||ev.pointerId!==activePointerId)return;
      active=false;
      btn.classList.remove('dragging');
      try{btn.releasePointerCapture(ev.pointerId)}catch(e){}
      activePointerId=null;
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',up,true);
      window.removeEventListener('pointercancel',up,true);
      // The column width is final now. Synchronize center padding and the
      // scrollable end immediately so a fast Jump Start/End click cannot use
      // geometry from before the drag.
      try{timeline?.rebuild?.()}catch(e){}
      refitAfterLayout();
      endTimelineSplitFit();
    };
    btn.addEventListener('pointerdown',ev=>{
      if(!horizontalSplitEnabled())return;
      if(ev.pointerType==='mouse'&&ev.button!==0)return;
      if(active)return;
      const main=editorMain();
      if(!main)return;
      ev.preventDefault();
      const rect=main.getBoundingClientRect();
      active=true;
      activePointerId=ev.pointerId;
      startX=ev.clientX;
      startPreview=currentPreviewPx(rect.width);
      beginTimelineSplitFit();
      btn.classList.add('dragging');
      try{btn.setPointerCapture(ev.pointerId)}catch(e){}
      window.addEventListener('pointermove',move,true);
      window.addEventListener('pointerup',up,true);
      window.addEventListener('pointercancel',up,true);
    },{passive:false});
    return btn;
  }

  function getProjectAspect(){
    const p=(typeof model!=='undefined' && model && model.project)?model.project:null;
    if(!p)return 16/9;
    const w=Math.max(1,+p.width||1);
    const h=Math.max(1,+p.height||1);
    return w/h;
  }

  function clampPreviewPx(px,totalW){
    const maxPreview=Math.max(MIN_PREVIEW, totalW - MIN_TIMELINE);
    return Math.max(MIN_PREVIEW, Math.min(maxPreview, px));
  }

  function desiredPreviewPx(totalW){
    const main=editorMain();
    if(!main)return clampPreviewPx(totalW*.48,totalW);
    const h=main.getBoundingClientRect().height || main.clientHeight || 0;
    const aspect=getProjectAspect();
    // Viewport is preview height minus preview toolbar, with a small padding margin.
    const viewportH=Math.max(120,h - 44);
    const desired=viewportH*aspect + 12;
    return clampPreviewPx(desired,totalW);
  }

  function currentPreviewPx(totalW){
    const savedRatio=readRatio();
    if(Number.isFinite(savedRatio))return clampPreviewPx(totalW*savedRatio,totalW);
    const main=editorMain();
    if(main){
      const cols=(getComputedStyle(main).gridTemplateColumns||'').trim().split(/\s+/);
      if(cols.length>=2){
        const first=parseFloat(cols[0]);
        if(Number.isFinite(first)&&first>0)return clampPreviewPx(first,totalW);
      }
    }
    return clampPreviewPx(totalW*.47,totalW);
  }

  function applySplit(ratio,{ensureFit=true}={}){
    const main=editorMain();
    if(!main)return;
    if(!horizontalSplitEnabled()){
      main.style.removeProperty('grid-template-columns');
      return;
    }
    const rect=main.getBoundingClientRect();
    if(rect.width<MIN_PREVIEW+MIN_TIMELINE)return;
    const totalW=Math.max(1,rect.width);
    let previewPx;
    if(Number.isFinite(ratio))previewPx=clampPreviewPx(totalW*ratio,totalW);
    else previewPx=currentPreviewPx(totalW);
    // Keep the existing mobile-landscape first-fit policy. Desktop PC starts
    // from its own CSS grid ratio and lets the canvas zoom fit inside it.
    if(ensureFit&&inMobileLandscapeDesktop()){
      const desired=desiredPreviewPx(totalW);
      previewPx=Math.max(previewPx,desired);
    }
    previewPx=clampPreviewPx(previewPx,totalW);
    const ratioToSave=previewPx/totalW;
    rememberRatio(ratioToSave);
    main.style.setProperty('grid-template-columns', `${Math.round(previewPx)}px minmax(0,1fr)`, 'important');
    if(ensureFit)refitAfterLayout();
  }

  function refitCanvasAfterLayout(){
    cancelAnimationFrame(fitRAF);
    fitRAF=requestAnimationFrame(()=>{
      fitRAF=0;
      try{ui?.applyCompositionFitZoom?.()}catch(e){}
      try{renderer?.resize?.()}catch(e){}
      try{renderer?.render?.()}catch(e){}
    });
  }

  function refitAfterLayout(){
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        try{ui?.applyCompositionFitZoom?.()}catch(e){}
        try{ui?.fit?.()}catch(e){}
        try{timeline?.rebuild?.()}catch(e){}
        try{renderer?.resize?.()}catch(e){}
        try{renderer?.render?.()}catch(e){}
      });
    });
  }

  function patchLayerActionsPosition(){
    if(typeof ui==='undefined'||!ui||originalPositionLayerActions)return;
    originalPositionLayerActions=ui.positionLayerActions?.bind(ui);
    if(!originalPositionLayerActions)return;
    ui.positionLayerActions=function(){
      if(inMobileLandscapeDesktop())return fitPopup();
      const popup=document.getElementById('layerActionsPopup');
      if(popup){
        popup.style.removeProperty('left');
        popup.style.removeProperty('top');
        popup.style.removeProperty('transform');
        popup.style.removeProperty('max-height');
        popup.style.removeProperty('width');
      }
      return originalPositionLayerActions();
    };
  }

  function sync(){
    ensureToolbarHandle();
    const legacy=document.getElementById('desktopCanvasSplitHandle');
    if(legacy)legacy.style.display='none';
    if(horizontalSplitEnabled()){
      if(btn)btn.style.display='flex';
      applySplit(NaN,{ensureFit:true});
      if(inMobileLandscapeDesktop()&&document.getElementById('layerActionsShade')&&!document.getElementById('layerActionsShade').classList.contains('hidden'))fitPopup();
    }else{
      if(btn)btn.style.display='none';
      const main=editorMain();
      if(main)main.style.removeProperty('grid-template-columns');
    }
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)}

  ensureToolbarHandle();
  patchLayerActionsPosition();
  schedule();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  const modeObserver=new MutationObserver(schedule);
  modeObserver.observe(root,{attributes:true,attributeFilter:['class']});
  if(typeof ResizeObserver!=='undefined'){
    const main=editorMain();
    if(main){
      mainResizeObserver=new ResizeObserver(entries=>{
        if(entries.some(entry=>entry.contentRect.width>=MIN_PREVIEW+MIN_TIMELINE))schedule();
      });
      mainResizeObserver.observe(main);
    }
  }
  window.DesktopCanvasSplitController={
    get ratio(){return desktopCanvasSplitRatio},
    get enabled(){return horizontalSplitEnabled()},
    applyRatio(value){applySplit(Number(value),{ensureFit:true})}
  };
  setTimeout(()=>{patchLayerActionsPosition();schedule()},0);
})();
