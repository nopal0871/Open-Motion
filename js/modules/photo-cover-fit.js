/*
 * Photo Cover Fit — ganti foto tanpa meregangkan (tanpa distorsi).
 *
 * Aturan (setara CSS `object-fit: cover`, titik fokus di tengah):
 *  - Foto LEBIH LEBAR dari rasio bingkai layer  → sisi kiri/kanan di-crop otomatis.
 *  - Foto LEBIH TINGGI/sempit dari rasio bingkai → foto di-zoom hingga memenuhi
 *    lebar bingkai, bagian atas/bawah yang berlebih di-crop.
 *  Hasilnya selalu berasio sama dengan bingkai layer, sehingga ukuran, keyframe,
 *  transform, dan efek layer lama tetap utuh dan foto tidak pernah gepeng/melar.
 *
 * Modul ini mandiri (tanpa dependensi) dan dimuat sebelum app.js.
 */
(function(){
  'use strict';
  const KEY='oms.photoCoverFit';
  const MAX_EDGE=8192;      // batas aman ukuran canvas di browser mobile
  const TOLERANCE=0.01;     // selisih rasio <1% dianggap sama (tidak perlu crop)

  function enabled(){
    try{return localStorage.getItem(KEY)!=='0'}catch(e){return true}
  }
  function setEnabled(v){
    try{localStorage.setItem(KEY,v?'1':'0')}catch(e){}
  }

  async function decode(file){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){}
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.decoding='async';img.src=url;
      await img.decode();
      return img;
    }finally{setTimeout(()=>URL.revokeObjectURL(url),0)}
  }

  /** Hitung area sumber (sx,sy,sw,sh) agar rasionya persis = aspect (cover, tengah). */
  function coverRect(iw,ih,aspect){
    const imgAspect=iw/ih;
    if(imgAspect>aspect){          // terlalu lebar → crop kiri/kanan
      const sw=ih*aspect;
      return{sx:(iw-sw)/2,sy:0,sw,sh:ih,mode:'crop'};
    }
    const sh=iw/aspect;            // terlalu tinggi → zoom ke lebar, crop atas/bawah
    return{sx:0,sy:(ih-sh)/2,sw:iw,sh,mode:'zoom'};
  }

  function toBlob(canvas,type,quality){
    return new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error('toBlob gagal')),type,quality));
  }

  /**
   * @param {File|Blob} file    foto pengganti
   * @param {number} aspect     lebar/tinggi bingkai layer
   * @returns {Promise<{file:File|Blob, info:{changed:boolean, mode:string, label:string}}>}
   */
  async function fit(file,aspect){
    const same={file,info:{changed:false,mode:'none',label:''}};
    if(!(file instanceof Blob)||!/^image\//.test(file.type||'')||!Number.isFinite(aspect)||aspect<=0)return same;
    if(/^image\/(gif|svg)/.test(file.type))return same; // animasi/vektor jangan di-raster
    const bmp=await decode(file);
    const iw=bmp.width||bmp.naturalWidth,ih=bmp.height||bmp.naturalHeight;
    if(!iw||!ih)return same;
    if(Math.abs(iw/ih-aspect)/aspect<=TOLERANCE){bmp.close?.();return same}
    const r=coverRect(iw,ih,aspect);
    let ow=Math.max(1,Math.round(r.sw)),oh=Math.max(1,Math.round(r.sh));
    const k=Math.min(1,MAX_EDGE/Math.max(ow,oh));
    if(k<1){ow=Math.max(1,Math.round(ow*k));oh=Math.max(1,Math.round(oh*k))}
    const canvas=document.createElement('canvas');canvas.width=ow;canvas.height=oh;
    const ctx=canvas.getContext('2d');
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp,r.sx,r.sy,r.sw,r.sh,0,0,ow,oh);
    bmp.close?.();
    const keepLossy=/^image\/(jpeg|webp)$/.test(file.type);
    const type=keepLossy?file.type:'image/png';
    const blob=await toBlob(canvas,type,keepLossy?0.95:undefined);
    const out=new File([blob],file.name||'foto',{type,lastModified:Date.now()});
    return{file:out,info:{changed:true,mode:r.mode,
      label:r.mode==='crop'?'sisi kiri/kanan di-crop otomatis':'foto di-zoom hingga memenuhi bingkai (atas/bawah di-crop)'}};
  }

  window.omsPhotoCover={fit,enabled,setEnabled,coverRect};
})();
