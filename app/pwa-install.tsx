'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,X} from 'lucide-react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function PwaInstall(){
 const [prompt,setPrompt]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(true),[help,setHelp]=useState(false),[busy,setBusy]=useState(false),[offline,setOffline]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const mode=window.matchMedia('(display-mode: standalone)');
  const update=()=>setInstalled(mode.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);
  const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
  const complete=()=>{setInstalled(true);setPrompt(null);setHelp(false);};
  const network=()=>setOffline(!navigator.onLine);
  update();network();mode.addEventListener('change',update);window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',complete);window.addEventListener('online',network);window.addEventListener('offline',network);
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
  return()=>{mode.removeEventListener('change',update);window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',complete);window.removeEventListener('online',network);window.removeEventListener('offline',network);};
 },[]);
 useEffect(()=>{if(help)dialog.current?.showModal();else dialog.current?.close();},[help]);
 async function install(){if(!prompt){setHelp(true);return;}setBusy(true);try{await prompt.prompt();await prompt.userChoice;setPrompt(null);}catch{setHelp(true);}finally{setBusy(false);}}
 return <>{offline&&<span className="offline-label" role="status">Offline</span>}{!installed&&<button className="notification-btn install-btn" disabled={busy} onClick={install}><Download size={16}/>{busy?'Installing…':'Install app'}</button>}<dialog ref={dialog} onCancel={()=>setHelp(false)} onClick={e=>{if(e.target===dialog.current)setHelp(false);}}><div className="modal install-help"><button className="close" aria-label="Close installation help" onClick={()=>setHelp(false)}><X size={20}/></button><h2>Take Job Radar with you</h2><p>Install it for quick access from your home screen or desktop.</p><p><b>Chrome or Edge:</b> open the browser menu and choose “Install Job Radar” or “Install app”.</p><p><b>iPhone or iPad:</b> open this site in Safari, tap Share, then “Add to Home Screen”.</p><p>If you’re in an in-app browser, open this page in your regular browser first.</p></div></dialog></>;
}
