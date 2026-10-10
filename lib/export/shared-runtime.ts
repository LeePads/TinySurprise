import { enhancedTemplateRuntime } from "./enhanced-template-runtime";
import { templateRuntime } from "./template-runtime";

export const sharedRuntime = String.raw`
(()=>{
  const d=window.__TINY_SURPRISE__;
  const root=document.getElementById('app');
  let templateCleanup=null;
  const disposeTemplate=()=>{
    const cleanup=templateCleanup;
    templateCleanup=null;
    cleanup?.();
    activeDialogCleanup?.();
    closeMusicSettings();
    root.querySelectorAll('audio,video').forEach(media=>media.pause());
  };
  const motionMode=matchMedia('(prefers-reduced-motion: reduce)').matches||d.appearance?.animationIntensity==='reduced'?'reduced':'full';
  const reducedMotion=motionMode==='reduced';
  // The attribute is the final runtime decision, including the recipient's
  // OS preference, so full and reduced selectors cannot describe different
  // states of the same exported experience.
  document.documentElement.dataset.tinyExportMotion=motionMode;
  const syncVisibility=()=>document.documentElement.classList.toggle('page-hidden',document.hidden);
  document.addEventListener('visibilitychange',syncVisibility);
  window.addEventListener('pageshow',syncVisibility);
  window.addEventListener('focus',syncVisibility);
  syncVisibility();
  // A large file can finish parsing while Android is transitioning the
  // viewer into the foreground. Recheck after the first paint so a stale
  // hidden-state pause cannot freeze the exported experience.
  requestAnimationFrame(syncVisibility);
  setTimeout(syncVisibility,500);
  const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[character]));
  const completion=d.completion||{};
  const progressDefinition=d.progress||{};
  const progressLabel=(current,total)=>String(progressDefinition.activeLabel||'{current} of {total}')
    .replaceAll('{current}',String(current))
    .replaceAll('{total}',String(total))
    .replaceAll('{remaining}',String(Math.max(0,total-current)));
  const completionMarkup=(className='final',options={})=>
    '<div class="'+className+'">'+
      (completion.eyebrow&&options.includeEyebrow!==false?'<p class="eyebrow">'+esc(completion.eyebrow)+'</p>':'')+
      (completion.title?'<h2'+(options.titleId?' id="'+options.titleId+'"':'')+(options.focusableTitle?' tabindex="-1"':'')+'>'+esc(completion.title)+'</h2>':'')+
      (options.descriptionId?'<div id="'+options.descriptionId+'">':'')+
      (options.includeCompletionMessage&&completion.completionMessage&&completion.completionMessage.trim()!==String(completion.finalMessage||'').trim()?'<p class="completion-message">'+esc(completion.completionMessage)+'</p>':'')+
      (completion.finalMessage?'<p class="completion-message">'+esc(completion.finalMessage)+'</p>':'')+
      (completion.closingMessage?'<p class="completion-closing">'+esc(completion.closingMessage)+'</p>':'')+
      (completion.signature?'<p class="completion-signature"><em>'+esc(completion.signature)+'</em></p>':'')+
      (options.descriptionId?'</div>':'')+
    '</div>';
  const presentation=image=>{
    const p=image?.presentation||{};
    const mode=p.mode==='fill'||p.mode==='custom'?p.mode:'fit';
    const focalX=Math.min(1,Math.max(0,Number.isFinite(p.focalX)?p.focalX:.5));
    const focalY=Math.min(1,Math.max(0,Number.isFinite(p.focalY)?p.focalY:.5));
    const zoom=Math.min(3,Math.max(1,Number.isFinite(p.zoom)?p.zoom:1));
    return {mode,focalX,focalY,zoom};
  };
  const presentationStyle=image=>{
    const p=presentation(image);
    return 'object-fit:'+(p.mode==='fit'?'contain':'cover')+';object-position:'+(p.focalX*100)+'% '+(p.focalY*100)+'%;transform:'+(p.mode==='custom'?'scale('+p.zoom+')':'scale(1)')+';transform-origin:'+(p.focalX*100)+'% '+(p.focalY*100)+'%';
  };
  const dialogFocusableSelector='a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let activeDialogCleanup=null;
  function bindDialogFocus(dialog,initialFocus,trigger,onClose){
    if(dialog.id!=='music-settings-overlay'&&musicSettings){closeMusicSettings();document.body.classList.add('dialog-open');}
    activeDialogCleanup?.();
    const dock=document.getElementById('music-dock');
    const dockWasInert=dock?.inert??false;
    if(dock){dock.querySelectorAll('details').forEach(el=>el.open=false);dock.inert=true;}
    const background=[];
    let branch=dialog;
    while(branch.parentElement&&branch!==root){
      const parent=branch.parentElement;
      Array.from(parent.children).filter(element=>element!==branch&&element instanceof HTMLElement&&!element.matches('.dialog-backdrop')).forEach(element=>{background.push({element,inert:element.inert});element.inert=true;});
      branch=parent;
    }
    const completionPanel=dialog.querySelector('.catch-final__panel,.recipient-completion-panel');
    const completionBody=dialog.querySelector('#catch-completion-description,.recipient-completion-body');
    const measurePanel=()=>{
      if(!completionPanel||!completionBody)return;
      const style=getComputedStyle(completionPanel);
      const fixedElements=completionPanel.matches('.catch-final__panel')?Array.from(completionPanel.querySelectorAll('.final>h2,.final>.eyebrow,.controls')):Array.from(completionPanel.children).filter(element=>element!==completionBody);
      const fixed=fixedElements.reduce((height,element)=>{
        const css=getComputedStyle(element);return height+element.getBoundingClientRect().height+parseFloat(css.marginTop)+parseFloat(css.marginBottom);
      },parseFloat(style.paddingTop)+parseFloat(style.paddingBottom));
      completionPanel.dataset.scrollWhole=String(fixed>parseFloat(style.maxHeight)*.55);
    };
    const panelResize=completionPanel&&typeof ResizeObserver!=='undefined'?new ResizeObserver(measurePanel):null;
    if(completionPanel){panelResize?.observe(completionPanel);completionPanel.querySelectorAll('.final>h2,.final>.eyebrow,.controls').forEach(element=>panelResize?.observe(element));measurePanel();}
    const getFocusable=()=>Array.from(dialog.querySelectorAll(dialogFocusableSelector))
      .filter(element=>!element.hidden&&!element.closest('[inert]')&&element.getAttribute('aria-hidden')!=='true'&&getComputedStyle(element).visibility!=='hidden'&&getComputedStyle(element).display!=='none'&&element.getClientRects().length>0);
    let cleaned=false;
    let initialFrame=0;
    const focusInitial=()=>{
      if(cleaned||activeDialogCleanup!==cleanup||!dialog.isConnected)return;
      const target=initialFocus?.isConnected?initialFocus:getFocusable()[0];
      (target||dialog).focus({preventScroll:true});
    };
    const onKeyDown=event=>{
      if(event.key==='Escape'){
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if(event.key!=='Tab')return;
      const focusable=getFocusable();
      if(!focusable.length){
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first=focusable[0];
      const last=focusable[focusable.length-1];
      if(!dialog.contains(document.activeElement)){
        event.preventDefault();
        first.focus();
      }else if(event.shiftKey&&(document.activeElement===first||!focusable.includes(document.activeElement))){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();
        first.focus();
      }
    };
    const cleanup=()=>{
      if(cleaned)return;
      cleaned=true;
      cancelAnimationFrame(initialFrame);
      panelResize?.disconnect();
      background.forEach(({element,inert})=>{element.inert=inert;});
      document.removeEventListener('keydown',onKeyDown,true);
      if(dock)dock.inert=dockWasInert;
      if(activeDialogCleanup===cleanup)activeDialogCleanup=null;
      requestAnimationFrame(()=>{
        if(activeDialogCleanup)return;
        const visible=element=>element?.isConnected&&!element.disabled&&!element.closest('[inert]')&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
        const target=visible(trigger)?trigger:document.getElementById('catch-progress');
        if(visible(target))target.focus({preventScroll:true});
      });
    };
    activeDialogCleanup=cleanup;
    document.addEventListener('keydown',onKeyDown,true);
    initialFrame=requestAnimationFrame(focusInitial);
    return cleanup;
  }
  const music={audio:null,playing:false,muted:Boolean(d.music?.startMuted),failed:false};
  let musicSettings=null;
  function closeMusicSettings(){
    if(!musicSettings)return;
    const settings=musicSettings;musicSettings=null;
    settings.trigger?.setAttribute('aria-expanded','false');
    settings.cleanup?.();settings.overlay.remove();
    document.body.classList.remove('dialog-open');
  }
  function openMusicSettings(trigger){
    if(musicSettings)return;
    trigger?.setAttribute('aria-expanded','true');
    const overlay=document.createElement('div');overlay.id='music-settings-overlay';overlay.className='music-settings-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','music-settings-title');
    overlay.innerHTML='<section class="music-settings-panel"><header><h2 id="music-settings-title">Music settings</h2><button type="button" data-music-close aria-label="Close music settings">×</button></header><p data-music-status role="status"></p><div class="music-options"><button type="button" data-music-play>Play music</button><label>Volume <output data-music-volume-label></output><input aria-label="Music volume" type="range" min="0" max="100" value="'+Math.round((music.audio?.volume??(d.music.volume??60)/100)*100)+'" data-music-volume></label><button type="button" data-music-mute>Mute</button><button type="button" data-music-restart>Restart song</button><button type="button" data-music-retry>Retry audio</button></div></section>';
    root.append(overlay);document.body.classList.add('dialog-open');
    overlay.querySelector('[data-music-close]').onclick=closeMusicSettings;
    overlay.onclick=event=>{if(event.target===overlay)closeMusicSettings();};
    overlay.querySelector('[data-music-play]').onclick=window.__toggleMusic;
    overlay.querySelector('[data-music-mute]').onclick=window.__toggleMute;
    overlay.querySelector('[data-music-volume]').oninput=event=>{window.__setMusicVolume(event.target.value);syncMusic();};
    overlay.querySelector('[data-music-restart]').onclick=()=>{const audio=ensureAudio();if(audio)audio.currentTime=0;};
    overlay.querySelector('[data-music-retry]').onclick=window.__retryMusic;
    musicSettings={overlay,trigger,cleanup:bindDialogFocus(overlay,overlay.querySelector('[data-music-close]'),trigger,closeMusicSettings)};
    syncMusic();
  }
  const audioPreviewEvent='tiny-audio-preview-start';
  const claimAudioPreview=owner=>window.dispatchEvent(new CustomEvent(audioPreviewEvent,{detail:{owner}}));
  window.addEventListener(audioPreviewEvent,event=>{if(event.detail?.owner!=='shared-music')music.audio?.pause();});
  function hash(value){
    let result=2166136261;
    for(const character of String(value).trim().toLocaleLowerCase().replace(/\s+/g,' ')){
      result^=character.charCodeAt(0);
      result=Math.imul(result,16777619);
    }
    return(result>>>0).toString(36);
  }

  function hasMusic(){return Boolean(d.music?.dataUrl||d.music?.videoId);}
  function youtubeWatchUrl(){return d.music?.videoId?'__YOUTUBE_WATCH__'+encodeURIComponent(d.music.videoId):'';}
  function musicButtonLabel(){return d.music?.dataUrl?'Music':'Open YouTube';}
  function announce(message){document.querySelectorAll('[data-music-status]').forEach(el=>{if(el.textContent!==message)el.textContent=message;});}
  function syncMusic(){
    document.querySelectorAll('[data-music-play]').forEach(el=>el.textContent=music.playing?'Pause music':'Play music');
    document.querySelectorAll('[data-music-mute]').forEach(el=>el.textContent=music.muted?'Unmute':'Mute');
    announce(music.failed?'This audio could not play in this browser. Retry, or ask the sender for an MP3 or M4A copy.':music.playing?(music.muted?'Music is muted.':'Music is playing.'):'Music is paused.');
    document.querySelectorAll('[data-music-alert]').forEach(el=>{el.hidden=!music.failed;el.textContent=music.failed?'Music needs attention. Open Music settings to retry.':'';});
    document.querySelectorAll('[data-music-retry]').forEach(el=>el.hidden=!music.failed);
    document.querySelectorAll('[data-music-volume-label]').forEach(el=>el.textContent=Math.round((music.audio?.volume??(d.music.volume??60)/100)*100)+'%');
  }
  function ensureAudio(){
    if(!d.music?.dataUrl)return null;
    if(music.audio)return music.audio;
    const audio=new Audio(d.music.dataUrl);audio.preload='none';audio.loop=Boolean(d.music.loop);
    audio.volume=Math.max(0,Math.min(1,(d.music.volume??60)/100));audio.muted=music.muted;
    audio.addEventListener('play',()=>{claimAudioPreview('shared-music');music.playing=true;music.failed=false;syncMusic();});
    audio.addEventListener('pause',()=>{music.playing=false;syncMusic();});
    audio.addEventListener('ended',()=>{music.playing=false;syncMusic();});
    audio.addEventListener('error',()=>{music.failed=true;music.playing=false;syncMusic();});
    music.audio=audio;return audio;
  }
  function playAudio(){const audio=ensureAudio();if(!audio)return;audio.play().catch(()=>{music.failed=true;syncMusic();});}
  function beginUploaded(){playAudio();}
  window.__toggleMusic=()=>{const audio=ensureAudio();if(audio){if(audio.paused)playAudio();else audio.pause();}};
  window.__toggleMute=()=>{const audio=ensureAudio();if(audio){audio.muted=!audio.muted;music.muted=audio.muted;syncMusic();}};
  window.__setMusicVolume=value=>{const audio=ensureAudio();if(audio)audio.volume=Math.max(0,Math.min(1,Number(value)/100));};
  window.__retryMusic=()=>{const audio=ensureAudio();if(audio){music.failed=false;audio.load();playAudio();}};
  function mountMusicControls(){
    if(!hasMusic()||document.getElementById('music-dock')||root.querySelector('.cover'))return;
    const host=root.querySelector('.catch-header,.topline')||root.firstElementChild;if(!host)return;
    const dock=document.createElement('section');dock.id='music-dock';dock.className='music-dock';dock.setAttribute('aria-label','Music');
    if(!d.music?.dataUrl){
      dock.innerHTML='<a class="music-open" href="'+esc(youtubeWatchUrl())+'" target="_blank" rel="noopener noreferrer" aria-label="Open YouTube, needs internet">Open YouTube</a>';
    }else{
      dock.innerHTML='<div class="music-dock-row"><button type="button" data-music-play>Play music</button><button type="button" data-music-settings aria-label="Music settings" aria-haspopup="dialog" aria-expanded="false" aria-controls="music-settings-overlay"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 17h16M8 4v6M16 14v6" /></svg></button></div><p data-music-alert hidden class="music-status" role="status"></p>';
      dock.querySelector('[data-music-play]').onclick=window.__toggleMusic;
      dock.querySelector('[data-music-settings]').onclick=event=>openMusicSettings(event.currentTarget);
    }
    host.prepend(dock);if(d.music?.dataUrl)syncMusic();
  }
  new MutationObserver(()=>{if(musicSettings&&!musicSettings.overlay.isConnected)closeMusicSettings();if(!document.getElementById('music-dock'))mountMusicControls();}).observe(root,{childList:true,subtree:true});
  let openingInProgress=false;
  let finishOpening=null;
  let openingFocusFrame=0;
  let focusAfterOpening=null;
  function playOpening(done){
    if(openingInProgress)return;
    openingInProgress=true;
    cancelAnimationFrame(openingFocusFrame);
    openingFocusFrame=0;
    focusAfterOpening=null;
    document.querySelector('.opening-flourish')?.remove();
    const previousInert=root.inert;
    const previousBusy=root.getAttribute('aria-busy');
    const previousHidden=root.getAttribute('aria-hidden');
    const previousFocus=document.activeElement;
    const previousContent=Array.from(root.childNodes);
    const alreadyHidden=root.classList.contains('opening-stage-hidden');
    const startButton=root.querySelector('#start');
    const startWasDisabled=startButton?.disabled;
    if(startButton)startButton.disabled=true;
    root.inert=true;
    root.setAttribute('aria-busy','true');
    root.setAttribute('aria-hidden','true');
    root.classList.add('opening-stage-hidden');
    const style=d.cover?.openingStyle||'gentle-fade';
    const flourish=document.createElement('div');
    flourish.className='opening-flourish opening-flourish-'+style;
    flourish.setAttribute('role','status');
    flourish.setAttribute('aria-label','Opening your surprise');
    flourish.innerHTML=
      '<span aria-hidden="true">\u2665</span><small>Opening moment</small>'+
      '<strong>A little moment, just for you</strong><i></i>';
    let exitTimer=0;
    let finishTimer=0;
    let finished=false;
    const cleanup=()=>{
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
      flourish.remove();
      root.classList.toggle('opening-stage-hidden',alreadyHidden);
      root.inert=previousInert;
      if(previousBusy===null)root.removeAttribute('aria-busy');
      else root.setAttribute('aria-busy',previousBusy);
      if(previousHidden===null)root.removeAttribute('aria-hidden');
      else root.setAttribute('aria-hidden',previousHidden);
      if(startButton)startButton.disabled=startWasDisabled;
      finishOpening=null;
      openingInProgress=false;
    };
    const finish=(restoreFocus=true)=>{
      if(finished)return;
      finished=true;
      try{done();}
      catch(error){
        // Keep the original controls and their listeners usable for a retry.
        root.replaceChildren(...previousContent);
        throw error;
      }
      finally{
        cleanup();
        if(restoreFocus&&root.contains(previousFocus)&&!root.inert)previousFocus.focus({preventScroll:true});
      }
      focusAfterOpening=()=>{
        if(openingFocusFrame)return;
        openingFocusFrame=requestAnimationFrame(()=>{
          openingFocusFrame=0;
          focusAfterOpening=null;
          if(activeDialogCleanup||root.contains(document.activeElement))return;
          const heading=root.querySelector('h1');
          if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
        });
      };
      if(restoreFocus)focusAfterOpening();
    };
    finishOpening=finish;
    if(reducedMotion){finish();return;}
    document.body.appendChild(flourish);
    flourish.tabIndex=-1;
    flourish.focus({preventScroll:true});
    // The cover stays hidden even during the exit fade. Render the experience
    // while hidden, then reveal it and remove the flourish in one handoff.
    exitTimer=setTimeout(()=>flourish.classList.add('leaving'),1550);
    finishTimer=setTimeout(finish,2100);
  }
  function start(){
    if(openingInProgress)return;
    if(d.music?.dataUrl)beginUploaded();
    playOpening(()=>{renderTemplate();mountMusicControls();});
  }
  function cover(){
    const youtube=Boolean(d.music?.videoId);
    const uploaded=Boolean(d.music?.dataUrl);
    const musicNote=uploaded?'Your uploaded audio is included.':youtube?'YouTube opens separately and needs internet.':'';
    const buttons='<button id="start" class="primary">Start Surprise</button>'+(youtube&&!uploaded?'<p><a class="music-open" href="'+esc(youtubeWatchUrl())+'" target="_blank" rel="noopener noreferrer">Open YouTube</a></p>':'');
    root.innerHTML=
      '<main class="cover"><div class="cover-inner card">'+
        (d.cover.photo
          ? '<div class="cover-photo-frame"><img class="cover-photo" decoding="async" alt="Cover memory" style="'+presentationStyle(d.cover.photo)+'" src="'+esc(d.cover.photo.previewUrl)+'"></div>'
          : '')+
        '<div class="cover-gift" aria-hidden="true">♥</div>'+
        '<p class="eyebrow">A TinySurprise for</p>'+
        '<h1>'+esc(d.recipient)+'</h1>'+
        '<p class="opening">'+esc(d.cover.message)+'</p>'+
        '<p class="music-status">'+musicNote+'</p>'+
        buttons+
        '<p class="from">Made with care by '+esc(d.sender)+'</p>'+
      '</div></main>';
    document.getElementById('start')?.addEventListener('click',()=>start(false));
    document.getElementById('start-music')?.addEventListener('click',()=>start(true));
    document.getElementById('start-quiet')?.addEventListener('click',()=>start(false));
    // The start action initializes the player; do not create an audio
    // element while the cover is waiting for a decision.
  }
  function unlock(){
    const choices=(d.passphraseChoices||[]).filter(choice=>String(choice).trim());
    const choiceMode=d.passphraseMode==='choice'&&choices.length>=2;
    const answerUi=choiceMode
      ? '<div id="secret-choices" class="field">'+choices.map((choice,index)=>
          '<button type="button" data-secret-choice="'+index+'">'+
            '<span aria-hidden="true">'+String.fromCharCode(65+index)+'</span> '+
            esc(choice)+
          '</button>'
        ).join('')+
        '<p id="lock-error" class="music-status" role="alert"></p></div>'
      : '<form id="unlock-form" class="field">'+
          '<label for="secret">Your answer</label>'+
          '<input id="secret" autocomplete="off" required>'+
          '<button class="primary">Open my surprise</button>'+
          '<p id="lock-error" class="music-status" role="alert"></p>'+
        '</form>';
    root.innerHTML=
      '<main class="cover"><div class="cover-inner card">'+
        '<p class="eyebrow">A tiny secret for '+esc(d.recipient)+'</p>'+
        '<h1>'+esc(d.passphraseQuestion||'What is our little secret?')+'</h1>'+
        '<p class="opening">Answer this first, then your surprise will open.</p>'+
        answerUi+
      '</div></main>';
    const check=value=>{
      const accepted=d.passphraseHashes||[];
      if(accepted.includes(hash(value))){
        d.cover.enabled?cover():start(false);
      }else{
        document.getElementById('lock-error').textContent=
          choiceMode
            ? 'That wasn\'t the key. Try another choice.'
            : 'Not quite—try another memory.';
      }
    };
    if(choiceMode){
      document.querySelectorAll('[data-secret-choice]').forEach(button=>
        button.addEventListener('click',()=>check(choices[Number(button.dataset.secretChoice)]))
      );
    }else{
      document.getElementById('unlock-form').addEventListener('submit',event=>{
        event.preventDefault();
        check(document.getElementById('secret').value);
      });
    }
  }
${templateRuntime}
${enhancedTemplateRuntime}
  let musicWasPlayingBeforeHide=false;
  function pauseMusicForHidden(){
    root.querySelectorAll('audio,video').forEach(media=>media.pause());
    if(music.audio&&!music.audio.paused){
      musicWasPlayingBeforeHide=true;
      music.audio.pause();
      return;
    }

  }
  function resumeMusicFromHidden(){
    if(!musicWasPlayingBeforeHide)return;
    musicWasPlayingBeforeHide=false;
    if(music.audio){music.audio.play().catch(()=>{music.failed=true;syncMusic();});return;}

  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)pauseMusicForHidden();else resumeMusicFromHidden();
  });
  window.addEventListener('pagehide',event=>{
    // Settle a hidden transition before leaving, including automatic openings
    // without a cover. A cached document returns to a usable experience.
    try{finishOpening?.(false);}
    finally{
      cancelAnimationFrame(openingFocusFrame);
      openingFocusFrame=0;
      if(!event.persisted)disposeTemplate();
      music.audio?.pause();
      root.querySelectorAll('audio,video').forEach(media=>media.pause());
    }
  });
  window.addEventListener('pageshow',()=>focusAfterOpening?.());
  d.passphraseHashes?.length?unlock():d.cover.enabled?cover():start(false);
})()
`;
