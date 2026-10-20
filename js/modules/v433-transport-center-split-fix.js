(()=>{
  let raf=0;
  const root=document.documentElement;

  function normalizeTransport(){
    const transport=document.querySelector('.transportBalanced');
    if(!transport)return;

    // V4.35+ owns playback/navigation placement. V4.33 is retained only for
    // the independent desktop split handle. It must never re-parent transport
    // buttons in response to timeline mutations, resize, or orientation.
    const splitBtn=document.getElementById('desktopCanvasSplitToolbarBtn');
    if(splitBtn){
      if(splitBtn.parentElement!==transport)transport.appendChild(splitBtn);
      const enabled=root.classList.contains('omsMobileLandscapeDesktop')||window.matchMedia('(min-width:900px)').matches;
      splitBtn.style.display=enabled?'flex':'none';
    }

    const legacy=document.getElementById('desktopCanvasSplitHandle');
    if(legacy)legacy.style.display='none';
  }

  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(normalizeTransport);
  }

  schedule();
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  document.addEventListener('DOMContentLoaded',schedule,{once:true});
  try{screen.orientation?.addEventListener?.('change',schedule)}catch(e){}
  const mo=new MutationObserver(schedule);
  // Only global layout-mode changes matter here. Timeline DOM churn from
  // pinch zoom / ruler rebuild is intentionally excluded.
  mo.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  setTimeout(schedule,0);
  setTimeout(schedule,120);
})();
