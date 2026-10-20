(()=>{
  class TransportGeometryController{
    constructor(){
      this.navIds=['jumpStart','prevKey','nextKey','jumpEnd'];
      this.raf=0;
      this.verifyRaf=0;
      this.layoutCount=0;
      this.lastReason='initial';
      this.lastDiagnostics=null;
      this.rootObserver=null;
      this.resizeObserver=null;
      this.boundResize=()=>this.schedule('resize');
      this.boundOrientation=()=>this.schedule('orientation');
      this.install();
    }

    clamp(v,a,b){return Math.max(a,Math.min(b,v))}
    centerX(rect){return rect.left+rect.width/2}
    centerY(rect){return rect.top+rect.height/2}
    rect(el){
      const r=el.getBoundingClientRect();
      return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cx:this.centerX(r),cy:this.centerY(r)}
    }
    transport(){return document.querySelector('.transportBalanced')}
    vertical(transport){return !!transport?.closest('.portraitRightRail')}

    clearInlineControl(el){
      if(!el)return;
      el.classList.remove('omsPlayAnchoredNav','omsPlayheadAnchoredControl');
      ['left','top','right','bottom','position','transform','z-index'].forEach(p=>el.style.removeProperty(p));
    }

    ensureDock(transport){
      let dock=document.getElementById('transportRightDock');
      if(!dock){
        dock=document.createElement('div');
        dock.id='transportRightDock';
        dock.className='transportRightDock';
      }
      if(dock.parentElement!==transport)transport.appendChild(dock);
      return dock;
    }

    arrangeRightDock(transport,right,vertical){
      const dock=this.ensureDock(transport);
      const audio=document.getElementById('audioToggle');
      const actions=document.getElementById('layerActionsBtn');
      if(vertical){
        if(audio&&audio.parentElement!==right)right.appendChild(audio);
        if(actions&&actions.parentElement!==right)right.appendChild(actions);
        dock.style.display='none';
        right.classList.remove('omsRightDockDetached');
        return dock;
      }
      if(audio&&audio.parentElement!==dock)dock.appendChild(audio);
      if(actions&&actions.parentElement!==dock)dock.appendChild(actions);
      dock.style.display='flex';
      right.classList.add('omsRightDockDetached');
      return dock;
    }

    restorePortraitSideRail(transport,left,center,right,play,nav,record){
      nav.forEach(el=>this.clearInlineControl(el));
      this.clearInlineControl(play);
      const [jumpStart,prevKey,nextKey,jumpEnd]=nav;
      if(record&&record.parentElement!==left)left.prepend(record);
      if(jumpStart&&jumpStart.parentElement!==left)left.appendChild(jumpStart);
      if(prevKey&&prevKey.parentElement!==left)left.appendChild(prevKey);
      if(play&&play.parentElement!==center)center.appendChild(play);
      if(nextKey&&nextKey.parentElement!==right)right.prepend(nextKey);
      if(jumpEnd&&jumpEnd.parentElement!==right){
        if(nextKey?.nextSibling)right.insertBefore(jumpEnd,nextKey.nextSibling);
        else right.prepend(jumpEnd);
      }
      left.classList.remove('omsPlayAnchorEmpty');
    }

    renderedScale(el,rect){
      const sx=rect.width/Math.max(1,el.offsetWidth||rect.width);
      const sy=rect.height/Math.max(1,el.offsetHeight||rect.height);
      return{x:Number.isFinite(sx)&&sx>0?sx:1,y:Number.isFinite(sy)&&sy>0?sy:1}
    }

    writeControl(el,left,top){
      el.style.setProperty('left',`${left}px`,'important');
      el.style.setProperty('top',`${top}px`,'important');
      el.style.setProperty('right','auto','important');
      el.style.setProperty('bottom','auto','important');
    }

    correctRenderedCenters(controls,targets,scale){
      let corrected=false;
      controls.forEach((el,i)=>{
        const r=el.getBoundingClientRect();
        const delta=targets[i]-(r.left+r.width/2);
        if(Math.abs(delta)<.001)return;
        const current=parseFloat(el.style.left)||0;
        el.style.setProperty('left',`${current+delta/scale.x}px`,'important');
        corrected=true;
      });
      return corrected;
    }

    visibleGeometry(el){
      const svg=el?.querySelector('svg');
      const paths=[...(svg?.querySelectorAll('path')||[])];
      if(!svg)return null;
      const sr=this.rect(svg);
      if(!paths.length)return{svg:sr,visible:null};
      const rects=paths.map(p=>p.getBoundingClientRect());
      const visible={
        left:Math.min(...rects.map(r=>r.left)),right:Math.max(...rects.map(r=>r.right)),
        top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))
      };
      visible.width=visible.right-visible.left;
      visible.height=visible.bottom-visible.top;
      visible.cx=visible.left+visible.width/2;
      visible.cy=visible.top+visible.height/2;
      return{svg:sr,visible}
    }

    markLayout(transport){
      this.layoutCount++;
      transport.dataset.omsTransportController='geometry';
      transport.dataset.omsTransportLayoutCount=String(this.layoutCount);
      transport.dataset.omsTransportLayoutReason=this.lastReason;
    }

    diagnostics(){
      const playhead=document.getElementById('playhead');
      const play=document.getElementById('playBtn');
      const nav=this.navIds.map(id=>document.getElementById(id));
      if(!playhead||!play||nav.some(el=>!el))return null;
      const ph=this.rect(playhead),pr=this.rect(play),nr=nav.map(el=>this.rect(el));
      const geometry=Object.fromEntries([play,...nav].map(el=>[el.id,this.visibleGeometry(el)]));
      return{
        layoutCount:this.layoutCount,
        reason:this.lastReason,
        devicePixelRatio:window.devicePixelRatio||1,
        playhead:ph,
        controls:Object.fromEntries([[play.id,pr],...nav.map((el,i)=>[el.id,nr[i]])]),
        deltas:{
          play:pr.cx-ph.cx,
          nearLeft:ph.cx-nr[1].cx,nearRight:nr[2].cx-ph.cx,
          nearSymmetry:(ph.cx-nr[1].cx)-(nr[2].cx-ph.cx),
          farLeft:ph.cx-nr[0].cx,farRight:nr[3].cx-ph.cx,
          farSymmetry:(ph.cx-nr[0].cx)-(nr[3].cx-ph.cx)
        },
        geometry,
        parents:Object.fromEntries([play,...nav].map(el=>[el.id,el.parentElement?.className||el.parentElement?.id||null]))
      }
    }

    arrange(){
      this.raf=0;
      const transport=this.transport();
      const left=transport?.querySelector('.transportLeft');
      const center=transport?.querySelector('.transportCenter');
      const right=transport?.querySelector('.transportRight');
      const play=document.getElementById('playBtn');
      const record=document.getElementById('preRenderRecordBtn');
      const playhead=document.getElementById('playhead');
      const timelineArea=document.querySelector('.timelineArea');
      const nav=this.navIds.map(id=>document.getElementById(id));
      if(!transport||!left||!center||!right||!play||!playhead||!timelineArea||nav.some(el=>!el))return;

      const vertical=this.vertical(transport);
      this.arrangeRightDock(transport,right,vertical);
      if(vertical){
        this.restorePortraitSideRail(transport,left,center,right,play,nav,record);
        this.markLayout(transport);
        this.lastDiagnostics=this.diagnostics();
        return;
      }

      // Hidden editors have zero-sized layout boxes. ResizeObserver will wake
      // this controller when the real toolbar becomes measurable again.
      const preTR=transport.getBoundingClientRect();
      const preAR=timelineArea.getBoundingClientRect();
      if(preTR.width<2||preTR.height<2||preAR.width<2||preAR.height<2)return;

      if(record&&record.parentElement!==transport)transport.appendChild(record);
      [play,...nav].forEach(el=>{
        if(el.parentElement!==transport)transport.appendChild(el);
        el.classList.add('omsPlayheadAnchoredControl');
      });
      nav.forEach(el=>el.classList.add('omsPlayAnchoredNav'));
      left.classList.add('omsPlayAnchorEmpty');

      const cluster=document.getElementById('transportPlaybackCluster');
      if(cluster&&cluster!==center&&cluster.children.length===0)cluster.style.display='none';

      const tr=transport.getBoundingClientRect();
      const phr=playhead.getBoundingClientRect();
      if(!tr.width||!tr.height||!Number.isFinite(phr.left))return;
      const scale=this.renderedScale(transport,tr);
      const anchorViewportX=phr.left+phr.width/2;
      const anchorLocalX=(anchorViewportX-tr.left)/scale.x;
      const anchorLocalY=(tr.height/2)/scale.y;

      // Independent controls only limit available room. They never define center.
      const split=document.getElementById('desktopCanvasSplitToolbarBtn');
      let leftSafeViewport=tr.left+8*scale.x;
      if(split&&getComputedStyle(split).display!=='none'){
        const sr=split.getBoundingClientRect();
        leftSafeViewport=Math.max(leftSafeViewport,sr.right+6*scale.x);
      }
      if(record&&getComputedStyle(record).display!=='none'){
        const rr=record.getBoundingClientRect();
        if(rr.width>0&&rr.height>0)leftSafeViewport=Math.max(leftSafeViewport,rr.right+6*scale.x);
      }
      const dock=document.getElementById('transportRightDock');
      const dr=dock?.getBoundingClientRect();
      let rightSafeViewport=tr.right-8*scale.x;
      if(dr&&dr.width>0&&dr.height>0)rightSafeViewport=Math.min(rightSafeViewport,dr.left-6*scale.x);

      const sideRoomLocal=Math.max(58,Math.min(
        (anchorViewportX-leftSafeViewport)/scale.x,
        (rightSafeViewport-anchorViewportX)/scale.x
      ));
      const buttonW=Math.max(30,nav[0].getBoundingClientRect().width/scale.x||34);
      const maxFar=Math.max(54,sideRoomLocal-buttonW/2-3);
      const far=this.clamp(88,54,maxFar);
      const near=Math.min(46,Math.max(32,far*.52));

      const controls=[play,...nav];
      const localPositions=[anchorLocalX,anchorLocalX-far,anchorLocalX-near,anchorLocalX+near,anchorLocalX+far];
      controls.forEach((el,i)=>this.writeControl(el,localPositions[i],anchorLocalY));

      // Close the loop using actual rendered button centers. This resolves the
      // browser's 1/64 CSS-pixel quantization without a device-specific offset.
      const targets=[anchorViewportX,anchorViewportX-far*scale.x,anchorViewportX-near*scale.x,anchorViewportX+near*scale.x,anchorViewportX+far*scale.x];
      this.correctRenderedCenters(controls,targets,scale);
      this.correctRenderedCenters(controls,targets,scale);

      this.markLayout(transport);
      cancelAnimationFrame(this.verifyRaf);
      this.verifyRaf=requestAnimationFrame(()=>{this.lastDiagnostics=this.diagnostics()});
    }

    schedule(reason='layout'){
      this.lastReason=reason;
      cancelAnimationFrame(this.raf);
      this.raf=requestAnimationFrame(()=>requestAnimationFrame(()=>this.arrange()));
    }

    install(){
      window.addEventListener('resize',this.boundResize,{passive:true});
      window.addEventListener('orientationchange',this.boundOrientation,{passive:true});
      try{screen.orientation?.addEventListener?.('change',this.boundOrientation)}catch(e){}
      document.addEventListener('DOMContentLoaded',()=>this.schedule('dom-ready'),{once:true});

      const observedTransport=this.transport();
      if(observedTransport&&'ResizeObserver' in window){
        this.resizeObserver=new ResizeObserver(entries=>{
          const box=entries?.[0]?.contentRect;
          if(box&&box.width>1&&box.height>1)this.schedule('transport-resize');
        });
        this.resizeObserver.observe(observedTransport);
      }

      // Only global layout-mode changes are observed. Timeline/ruler/track/time
      // mutations are deliberately outside this controller's wake-up graph.
      this.rootObserver=new MutationObserver(()=>this.schedule('layout-mode'));
      this.rootObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});

      this.schedule('initial');
      setTimeout(()=>this.schedule('initial-visible'),120);
      setTimeout(()=>this.schedule('initial-settled'),360);
    }
  }

  window.TransportGeometryController=TransportGeometryController;
  window.omsTransportGeometryController=new TransportGeometryController();
  window.omsMeasureTransportGeometry=()=>window.omsTransportGeometryController?.diagnostics?.();
})();
