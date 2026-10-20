(()=>{
  const PLAY_SVG='<svg class="transportPlaySvg play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4L20 12L8 20Z"/></svg>';
  const PAUSE_SVG='<svg class="transportPlaySvg pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5V19M16 5V19"/></svg>';

  window.omsSetPlayButtonVisual=function omsSetPlayButtonVisual(playing){
    const btn=document.getElementById('playBtn');
    if(!btn)return;
    btn.innerHTML=playing?PAUSE_SVG:PLAY_SVG;
    btn.setAttribute('aria-label',playing?'Jeda':'Putar');
    btn.setAttribute('title',playing?'Jeda':'Putar');
    btn.dataset.playVisual=playing?'pause':'play';
  };

  // Triangle vertices are chosen so their centroid is exactly x=12, the
  // center of the 24x24 viewBox: (8 + 8 + 20) / 3 = 12.
  // V4.40 then places that button center on the rendered playhead X.
  const sync=()=>window.omsSetPlayButtonVisual?.(!!(typeof model!=='undefined'&&model.playing));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
  setTimeout(sync,0);
})();
