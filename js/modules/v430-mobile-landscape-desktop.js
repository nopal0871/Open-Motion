(()=>{
  const root=document.documentElement;
  let raf=0,last=null;

  const isTouchLandscape=()=>{
    let coarse=false,hoverNone=true,landscape=false;
    try{
      coarse=window.matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints||0)>0;
      hoverNone=window.matchMedia('(hover:none)').matches;
      landscape=window.matchMedia('(orientation:landscape)').matches || window.innerWidth>window.innerHeight;
    }catch(e){
      coarse=(navigator.maxTouchPoints||0)>0;
      landscape=window.innerWidth>window.innerHeight;
    }
    // A real touch-first landscape device gets the desktop workspace. A hybrid
    // desktop with a mouse keeps its normal CSS desktop behavior.
    return !!(coarse&&hoverNone&&landscape);
  };

  const relayout=(desktopLandscape)=>{
    // Orientation is layout-only. Do not serialize/restore, recreate the model,
    // replace the project object, or touch history stacks.
    const keepTime=typeof model!=='undefined'?model.time:null;
    const keepSelected=typeof model!=='undefined'?model.selected:null;
    const keepProject=typeof model!=='undefined'?model.project:null;

    if(desktopLandscape){
      try{editorSplit?.clearManualSelectedSticky?.({restore:true})}catch(e){}
      try{editorSplit?.stopSelectedLayerFocusSession?.({restore:true})}catch(e){}
    }

    try{portraitSideControls?.sync?.({refit:false})}catch(e){}

    const main=document.querySelector('.editorMain');
    if(main&&desktopLandscape){
      main.classList.remove('fitCompositionLayout');
      main.style.removeProperty('grid-template-rows');
    }

    requestAnimationFrame(()=>{
      try{ui?.fit?.()}catch(e){}
      try{timeline?.rebuild?.()}catch(e){}
      try{renderer?.resize?.()}catch(e){}

      // Returning to portrait while an Inspector is already open should regain
      // the normal mobile Inspector focus rules without reopening the project.
      if(!desktopLandscape){
        try{
          if(editorSplit?.isDrawerOpen?.())editorSplit?.onDrawerOpened?.(false);
          else editorSplit?.afterFit?.();
        }catch(e){}
      }

      // Fail closed against any layout callback accidentally navigating state.
      if(typeof model!=='undefined'){
        if(model.project===keepProject){
          if(keepTime!=null)model.time=keepTime;
          model.selected=keepSelected;
        }
      }
      try{renderer?.render?.()}catch(e){}
      try{ui?.sync?.()}catch(e){}
    });
  };

  const sync=()=>{
    raf=0;
    const next=isTouchLandscape();
    if(next===last)return;
    last=next;
    root.classList.toggle('omsMobileLandscapeDesktop',next);
    root.dataset.workspaceMode=next?'desktop-landscape':'responsive';
    relayout(next);
  };

  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(sync);
  };

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  try{window.matchMedia('(orientation:landscape)').addEventListener?.('change',schedule)}catch(e){}

  // Resolve after the original editor controllers have initialized.
  schedule();
})();
