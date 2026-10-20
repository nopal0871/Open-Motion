(() => {
  'use strict';
  const installBtn=document.getElementById('homeInstallBtn');
  if(!installBtn)return;

  let deferredInstallPrompt=null;
  const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true ||
    window.navigator.standalone===true;
  const refreshState=()=>{
    const standalone=isStandalone();
    installBtn.hidden=standalone;
    installBtn.classList.toggle('ready',!!deferredInstallPrompt&&!standalone);
    installBtn.title=deferredInstallPrompt?'Instal Open Motion':'Instal Open Motion';
  };

  window.addEventListener('beforeinstallprompt',event=>{
    // Keep Chrome's install event so the persistent Home button can invoke it.
    event.preventDefault();
    deferredInstallPrompt=event;
    refreshState();
  });

  installBtn.addEventListener('click',async()=>{
    if(isStandalone()){refreshState();return}
    if(!deferredInstallPrompt){
      const local=location.protocol==='file:'||location.protocol==='content:';
      try{
        window.toast?.(local
          ? 'Instal PWA hanya tersedia dari situs HTTPS. Buka Open Motion melalui GitHub Pages.'
          : 'Chrome belum menyiapkan prompt instal. Coba menu ⋮ → Instal aplikasi / Tambahkan ke layar utama.');
      }catch(_){}
      return;
    }

    installBtn.setAttribute('aria-busy','true');
    try{
      const promptEvent=deferredInstallPrompt;
      const result=await promptEvent.prompt();
      // A captured beforeinstallprompt can only be used once.
      deferredInstallPrompt=null;
      refreshState();
      if(result?.outcome==='dismissed'){
        try{window.toast?.('Instalasi dibatalkan. Tombol INSTAL akan aktif lagi saat Chrome menawarkan prompt baru.')}catch(_){}
      }
    }catch(error){
      console.warn('[Open Motion PWA] install prompt gagal:',error);
      deferredInstallPrompt=null;
      refreshState();
      try{window.toast?.('Prompt instal belum tersedia. Coba menu ⋮ Chrome → Instal aplikasi.')}catch(_){}
    }finally{
      installBtn.removeAttribute('aria-busy');
    }
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    refreshState();
    try{window.toast?.('Open Motion berhasil diinstal.')}catch(_){}
  });

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',refreshState);
  refreshState();

  if('serviceWorker' in navigator && (location.protocol==='https:' ||
      location.hostname==='localhost' || location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./'})
        .catch(error=>console.warn('[Open Motion PWA] service worker gagal:',error));
    },{once:true});
  }
})();
