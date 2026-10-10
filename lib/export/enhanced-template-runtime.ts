import { CATCH_HEART_SPAWN_RUNTIME } from "../catch-heart-spawn";

export const enhancedTemplateRuntime = String.raw`
const legacyRenderTemplate=renderTemplate;

const framedImage=(image,alt,className='')=>image?.previewUrl
  ? '<div class="image-frame '+className+'" data-presentation-mode="'+presentation(image).mode+'"><img class="photo" data-presentation-mode="'+presentation(image).mode+'" loading="lazy" decoding="async" alt="'+esc(alt)+'" style="'+presentationStyle(image)+'" src="'+esc(image.previewUrl)+'"></div>'
  : '';
const defaultFill=image=>image&&!image.presentation?{...image,presentation:{mode:'fill'}}:image;

${CATCH_HEART_SPAWN_RUNTIME}

function enhancedShell(title,body,includeMusic=true,opening=d.openingMessage,showReplay=true){
  closeMusicSettings();
  activeDialogCleanup?.();
  root.querySelectorAll('audio,video').forEach(media=>media.pause());
  document.body.classList.remove('dialog-open');
  document.body.dataset.tinyTopMusicControls=includeMusic&&hasMusic()?'true':'false';
  document.getElementById('music-dock')?.remove();
  root.innerHTML=
    '<main class="page">'+
      '<div class="topline">'+
        '<div class="controls">'+
          ''+
          (showReplay?'<button id="replay" type="button">Replay</button>':'')+
        '</div>'+
      '</div>'+
      '<h1>'+esc(title)+'</h1>'+
      '<p class="opening">'+esc(opening)+'</p>'+
      body+
    '</main>';
  document.getElementById('replay')?.addEventListener('click',()=>{
    if(d.template==='photo-puzzle'){
      window.__tinyPuzzleReplayFocus=true;
      window.__tinyPuzzleRenderToken=(window.__tinyPuzzleRenderToken||0)+1;
    }
    if(d.template==='cozy-playlist')window.__tinyPlaylistReplayFocus=true;
    renderTemplate();
  });
}

function renderEnhancedPuzzle(){
  const content=d.content;
  const puzzleRenderToken=window.__tinyPuzzleRenderToken||0;
  const size=content.difficulty==='easy'?3:content.difficulty==='hard'?5:4;
  const total=size*size;
  const solved=Array.from({length:total},(_,index)=>index);
  const photoUrl=content.photo?.previewUrl||'';
  const photoPresentation=presentation(content.photo);
  // Zero is the intentional top-left empty section in the solved image.
  const sourceIndex=value=>Math.max(0,value);
  const validMoves=state=>{
    const empty=state.emptyIndex;
    const row=Math.floor(empty/size);
    const column=empty%size;
    return [empty-size,empty+size,empty-1,empty+1].filter(index=>
      index>=0&&index<total&&
      Math.abs(Math.floor(index/size)-row)+Math.abs(index%size-column)===1
    );
  };
  const moveState=(state,index)=>{
    if(!validMoves(state).includes(index))return null;
    const next={tiles:[...state.tiles],emptyIndex:index};
    [next.tiles[state.emptyIndex],next.tiles[index]]=[next.tiles[index],next.tiles[state.emptyIndex]];
    return next;
  };
  const solvedState=()=>({tiles:[...solved],emptyIndex:0});
  const isSolved=state=>state.tiles.every((value,index)=>value===index);
  const shufflePuzzle=minMoves=>{
    let state=solvedState();
    let movesApplied=0;
    for(let step=0;step<minMoves*2&&movesApplied<minMoves;step++){
      const moves=validMoves(state);
      const next=moveState(state,moves[Math.floor(Math.random()*moves.length)]);
      if(next){state=next;movesApplied++;}
    }
    if(isSolved(state)){
      const moves=validMoves(state);
      const next=moveState(state,moves[0]);
      if(next)state=next;
    }
    return state;
  };
  let state=shufflePuzzle(50);
  let helps=2;
  let imageReady=false;
  let completionTimer=0;
  templateCleanup=()=>{
    clearTimeout(completionTimer);
    window.__tinyPuzzleRenderToken=(window.__tinyPuzzleRenderToken||0)+1;
  };
  activeDialogCleanup?.();
  document.body.classList.remove('dialog-open');
  enhancedShell(
    'Bring this memory together',
    '<div class="card puzzle-card">'+
      '<p class="from puzzle-from">Made with care by '+esc(d.sender)+'</p>'+
      '<p id="puzzle-status" class="puzzle-status" role="status" aria-live="polite" aria-atomic="true">Preparing the puzzle photo…</p>'+
       '<div id="puzzle-stage" class="puzzle-stage"><div class="puzzle-backdrop" style="background-image:url(&quot;'+esc(photoUrl)+'&quot;);background-position:'+photoPresentation.focalX*100+'% '+photoPresentation.focalY*100+'%;background-size:cover"></div><div id="puzzle-board" class="puzzle" style="--n:'+size+'" aria-busy="true"></div></div>'+
      '<div class="controls puzzle-controls">'+
        '<button id="puzzle-restart" type="button" disabled>Restart</button>'+
         '<button id="puzzle-help-toggle" type="button" aria-expanded="false" aria-controls="puzzle-help-dialog" disabled>Hint · 2</button>'+
      '</div>'+
      '<p id="puzzle-instructions" class="puzzle-instruction" tabindex="-1">Slide a neighboring piece into the open space.</p>'+
      '<div id="puzzle-help-dialog" class="puzzle-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="puzzle-help-title" aria-hidden="true" tabindex="-1">'+
        '<section class="puzzle-sheet">'+
          '<div class="puzzle-sheet-head"><div><h2 id="puzzle-help-title">Need a little help?</h2><p>You can make the puzzle easier or reveal the memory now.</p></div><button id="puzzle-help-close" class="icon-button" type="button" aria-label="Close puzzle help">×</button></div>'+
          '<div class="puzzle-help-options">'+
             '<button id="puzzle-hint" type="button"><strong id="puzzle-hint-label">Give me a hint</strong><small id="puzzle-hint-help">Move a few pieces closer to place. 2 hints left.</small></button>'+
            '<button id="puzzle-reveal" type="button"><strong>Reveal the memory</strong><small>Skip the rest of the puzzle.</small></button>'+
          '</div>'+
        '</section>'+
      '</div>'+
      '<div id="puzzle-reveal-dialog" class="puzzle-overlay hidden" role="alertdialog" aria-modal="true" aria-labelledby="puzzle-reveal-title" aria-describedby="puzzle-reveal-message" aria-hidden="true" tabindex="-1">'+
        '<section class="puzzle-sheet puzzle-confirm-sheet">'+
         '<h2 id="puzzle-reveal-title">Reveal the memory?</h2><p id="puzzle-reveal-message">You can skip the rest of the puzzle and see what\'s behind it.</p>'+
          '<div class="controls"><button id="puzzle-reveal-cancel" type="button">Keep solving</button><button id="puzzle-reveal-confirm" class="primary" type="button">Reveal memory</button></div>'+
        '</section>'+
      '</div>'+
      '<div id="puzzle-final" class="final hidden" role="region" aria-labelledby="puzzle-completion-title" aria-describedby="puzzle-completion-description">'+
        '<div class="puzzle-completion-media">'+framedImage(content.photo,'Completed puzzle memory')+'</div>'+
        completionMarkup('final',{titleId:'puzzle-completion-title',descriptionId:'puzzle-completion-description',focusableTitle:true,includeCompletionMessage:true})+
        '<button id="puzzle-replay" class="primary" type="button">Puzzle again</button>'+
      '</div>'+
    '</div>'
  );
  const board=document.getElementById('puzzle-board');
  const status=document.getElementById('puzzle-status');
  const instruction=document.getElementById('puzzle-instructions');
  const restartButton=document.getElementById('puzzle-restart');
  const helpToggle=document.getElementById('puzzle-help-toggle');
  const helpDialog=document.getElementById('puzzle-help-dialog');
  const helpClose=document.getElementById('puzzle-help-close');
  const hintButton=document.getElementById('puzzle-hint');
  const hintLabel=document.getElementById('puzzle-hint-label');
  const hintHelp=document.getElementById('puzzle-hint-help');
  const revealButton=document.getElementById('puzzle-reveal');
  const revealDialog=document.getElementById('puzzle-reveal-dialog');
  const revealCancel=document.getElementById('puzzle-reveal-cancel');
  const revealConfirm=document.getElementById('puzzle-reveal-confirm');
  const final=document.getElementById('puzzle-final');
  const focusPuzzle=()=>requestAnimationFrame(()=>instruction?.focus());
  const focusCompletion=()=>requestAnimationFrame(()=>document.getElementById('puzzle-completion-title')?.focus());
  const updateHintLabels=()=>{
    helpToggle.textContent=helps>0?'Hint · '+helps:'Hint';
    helpToggle.setAttribute('aria-label',helps>0?'Open puzzle help, '+helps+' hints remaining':'Open puzzle help, no hints remaining');
    if(helps>0){
      hintButton.disabled=false;
      hintLabel.textContent='Give me a hint';
      hintHelp.textContent='Move a few pieces closer to place. '+helps+' '+(helps===1?'hint':'hints')+' left.';
    }else{
      hintButton.disabled=true;
      hintLabel.textContent='No hints left';
      hintHelp.textContent="You've used both hints for this puzzle.";
    }
  };
  const closeHelp=()=>{
    if(helpDialog.classList.contains('hidden'))return;
    helpDialog.classList.add('hidden');
    helpDialog.setAttribute('aria-hidden','true');
    helpToggle.setAttribute('aria-expanded','false');
    document.body.classList.remove('dialog-open');
    activeDialogCleanup?.();
  };
  const closeReveal=()=>{
    if(revealDialog.classList.contains('hidden'))return;
    revealDialog.classList.add('hidden');
    revealDialog.setAttribute('aria-hidden','true');
    document.body.classList.remove('dialog-open');
    activeDialogCleanup?.();
  };
  const openHelp=()=>{
    closeReveal();
    helpDialog.classList.remove('hidden');
    helpDialog.removeAttribute('aria-hidden');
    helpToggle.setAttribute('aria-expanded','true');
    document.body.classList.add('dialog-open');
    bindDialogFocus(helpDialog,helpClose,helpToggle,closeHelp);
  };
  const openReveal=()=>{
    closeHelp();
    revealDialog.classList.remove('hidden');
    revealDialog.removeAttribute('aria-hidden');
    document.body.classList.add('dialog-open');
    bindDialogFocus(revealDialog,revealCancel,revealButton,closeReveal);
  };
  const finish=()=>{
    closeHelp();
    closeReveal();
    state=solvedState();
    draw('Puzzle complete.');
    board.querySelectorAll('button').forEach(tile=>{tile.disabled=true});
    clearTimeout(completionTimer);
    completionTimer=setTimeout(()=>{
      if((window.__tinyPuzzleRenderToken||0)!==puzzleRenderToken)return;
      final.classList.remove('hidden');
      focusCompletion();
    },reducedMotion?0:280);
  };
  const draw=(message='Slide a neighboring piece into the open space.')=>{
    if(!imageReady)return;
    const empty=state.emptyIndex;
    const movable=index=>validMoves(state).includes(index);
    board.innerHTML=state.tiles.map((value,index)=>{
       if(value===0)return '<span class="tile tile-empty" role="img" aria-label="Empty space"></span>';
      const source=sourceIndex(value);
      const row=Math.floor(source/size);
      const column=source%size;
      const style='position:absolute;display:block;max-width:none;max-height:none;pointer-events:none;width:'+(size*100)+'%;height:'+(size*100)+'%;left:'+(-column*100)+'%;top:'+(-row*100)+'%;object-fit:'+(photoPresentation.mode==='fit'?'contain':'cover')+';object-position:'+(photoPresentation.focalX*100)+'% '+(photoPresentation.focalY*100)+'%;transform:'+(photoPresentation.mode==='custom'?'scale('+photoPresentation.zoom+')':'scale(1)')+';transform-origin:'+(photoPresentation.focalX*100)+'% '+(photoPresentation.focalY*100)+'%';
      return '<button class="tile" aria-label="Puzzle piece '+value+', row '+(Math.floor(index/size)+1)+', column '+(index%size+1)+', '+(movable(index)?'movable into the empty space':'not movable right now')+'" data-i="'+index+'" style="min-height:0"'+(movable(index)?'':' disabled')+'><img src="'+esc(photoUrl)+'" alt="" aria-hidden="true" draggable="false" decoding="sync" style="'+style+'"></button>';
    }).join('');
    board.setAttribute('aria-busy','false');
    status.textContent=message;
    board.querySelectorAll('button').forEach(button=>button.addEventListener('click',event=>{
      const restoreFocus=event.detail===0;
      const destination=state.emptyIndex;
      const index=Number(button.dataset.i);
      const next=moveState(state,index);
      if(!next)return;
      const movedPiece=state.tiles[index];
      state=next;
      draw('Moved puzzle piece '+movedPiece+'. Choose a neighboring piece to continue.');
      if(isSolved(state))finish();
      else if(restoreFocus){
        const target=board.querySelector('button[data-i="'+destination+'"]:not(:disabled)')||board.querySelector('button:not(:disabled)');
        target?.focus({preventScroll:true});
      }
    }));
  };
  const prepareImage=()=>{
    if(!photoUrl){
      status.textContent='This puzzle is missing its photo. Return to the builder and choose it again.';
      board.setAttribute('aria-busy','false');
      return;
    }
    const image=new Image();
    image.decoding='async';
    const ready=()=>{
      if(imageReady||(window.__tinyPuzzleRenderToken||0)!==puzzleRenderToken)return;
      imageReady=true;
      restartButton.disabled=false;
      helpToggle.disabled=false;
      updateHintLabels();
      draw();
    };
    image.onload=()=>{
      if(typeof image.decode==='function')void image.decode().catch(()=>{}).finally(ready);
      else ready();
    };
    image.onerror=()=>{
      if((window.__tinyPuzzleRenderToken||0)!==puzzleRenderToken)return;
      status.textContent='This puzzle photo could not be loaded. Try creating the file again.';
      board.setAttribute('aria-busy','false');
    };
    image.src=photoUrl;
    if(image.complete&&image.naturalWidth)ready();
  };
  restartButton.addEventListener('click',()=>{
    if(!imageReady)return;
    clearTimeout(completionTimer);
    final.classList.add('hidden');
    helps=2;
    state=shufflePuzzle(50);
    updateHintLabels();
    draw();
    focusPuzzle();
  });
  helpToggle.addEventListener('click',openHelp);
  helpClose.addEventListener('click',closeHelp);
  helpDialog.addEventListener('click',event=>{if(event.target===helpDialog)closeHelp();});
  hintButton.addEventListener('click',()=>{
    if(!helps)return;
    const next=shufflePuzzle(Math.max(2,size-1));
    if(!next||isSolved(next))return;
    state=next;
    helps--;
    updateHintLabels();
    draw('A few pieces moved closer.');
    closeHelp();
    setTimeout(()=>{if(!final.classList.contains('hidden'))return;status.textContent='Slide a neighboring piece into the open space.';},2800);
  });
  revealButton.addEventListener('click',openReveal);
  revealCancel.addEventListener('click',closeReveal);
  revealDialog.addEventListener('click',event=>{if(event.target===revealDialog)closeReveal();});
  revealConfirm.addEventListener('click',finish);
  document.getElementById('puzzle-replay').addEventListener('click',()=>{
    window.__tinyPuzzleReplayFocus=true;
    window.__tinyPuzzleRenderToken=(window.__tinyPuzzleRenderToken||0)+1;
    renderTemplate();
  });
  let pointerStart=null;
  const puzzleBoard=board;
  puzzleBoard.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
  puzzleBoard.addEventListener('pointerup',event=>{
    if(!pointerStart)return;
    const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;
    pointerStart=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<32)return;
    const empty=state.emptyIndex;
    const candidate=Math.abs(dx)>Math.abs(dy)?empty+(dx>0?-1:1):empty+(dy>0?-size:size);
    puzzleBoard.querySelector('[data-i="'+candidate+'"]')?.click();
  });
  prepareImage();
  if(window.__tinyPuzzleReplayFocus){
    window.__tinyPuzzleReplayFocus=false;
    focusPuzzle();
  }
}

function renderEnhancedDate(){
  const content=d.content;
  const dateIntro=(content.introMessage||d.openingMessage||'').trim();
  const resultTitle=(content.result.title||'').trim()||'Our little date, chosen together';
  const resultDescription=(content.result.description||'').trim()||'Here is the adventure your choices made.';
  const resultDetails=(content.result.details||'').trim();
  let round=0;
  let picks=[];
  let interactionMode='play';
  let changeTrigger=null;
  const focusDateHeading=()=>requestAnimationFrame(()=>{
    const heading=document.getElementById(round>=content.rounds.length?'date-result-title':'date-round-title');
    heading?.focus({preventScroll:true});
  });
  const closeChangePicker=(selectedRound)=>{
    activeDialogCleanup?.();
    document.body.classList.remove('dialog-open');
    document.getElementById('date-change-backdrop')?.remove();
    changeTrigger=null;
    if(typeof selectedRound==='number'){
      round=selectedRound;
      interactionMode='edit-result';
      draw(true);
      return;
    }
  };
  const openChangePicker=event=>{
    changeTrigger=event.currentTarget;
    const backdrop=document.createElement('div');
    backdrop.id='date-change-backdrop';
    backdrop.className='dialog-backdrop date-change-backdrop';
    backdrop.innerHTML=
      '<section class="dialog date-change-dialog" role="dialog" aria-modal="true" aria-labelledby="date-change-title" tabindex="-1">'+
        '<div class="date-change-head"><div><p class="eyebrow">Choose a round</p><h2 id="date-change-title">Change a choice</h2></div><button id="date-change-close" class="icon-button" aria-label="Close change-a-choice picker">×</button></div>'+
        '<div class="date-change-list">'+content.rounds.map((item,index)=>{
          const answer=picks[index];
          return '<button type="button" class="date-change-item" data-round="'+index+'"><strong>'+esc(item.question)+'</strong>'+(answer?'<small>'+esc(answer.title)+'</small>':'')+'</button>';
        }).join('')+'</div>'+
      '</section>';
    root.appendChild(backdrop);
    document.body.classList.add('dialog-open');
    const dialog=backdrop.querySelector('.date-change-dialog');
    const closeButton=backdrop.querySelector('#date-change-close');
    const close=()=>closeChangePicker();
    closeButton.addEventListener('click',close);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)close()});
    backdrop.querySelectorAll('.date-change-item').forEach(button=>button.addEventListener('click',()=>closeChangePicker(Number(button.dataset.round))));
    activeDialogCleanup=bindDialogFocus(dialog,closeButton,changeTrigger,close);
  };
  const draw=(focus=false)=>{
    if(round>=content.rounds.length){
      enhancedShell(
        'Choose our next little adventure',
        '<div class="card final date-result">'+
          '<p class="eyebrow">It\u2019s a date</p>'+
          '<h2 id="date-result-title" tabindex="-1">'+esc(resultTitle)+'</h2>'+
          '<p id="date-result-description" class="opening">'+esc(resultDescription)+'</p>'+
          '<div class="date-plan" role="list" aria-label="Our date plan">'+picks.map((option,index)=>
            '<article class="date-plan-item" role="listitem">'+
              (option.photo
                ? framedImage(option.photo,'Selected date choice','date-plan-media')
                : '<span class="date-plan-number" aria-hidden="true">'+(index+1)+'</span>')+
              '<div class="date-plan-copy"><span class="eyebrow">Choice '+(index+1)+'</span><strong>'+esc(option.kind==='recipient-decides'?(option.title||'You choose this part'):option.title)+'</strong>'+
              (option.details?'<small>'+esc(option.details)+'</small>':'')+'</div>'+
            '</article>'
          ).join('')+'</div>'+
          (resultDetails?'<p class="opening">'+esc(resultDetails)+'</p>':'')+
          '<div class="date-divider" aria-hidden="true"></div>'+
          (completion.eyebrow?'<p class="eyebrow">'+esc(completion.eyebrow)+'</p>':'')+
          (completion.finalMessage?'<p class="completion-message">'+esc(completion.finalMessage)+'</p>':'')+
          (completion.closingMessage?'<p class="completion-closing">'+esc(completion.closingMessage)+'</p>':'')+
          (completion.signature?'<p class="completion-signature"><em>'+esc(completion.signature)+'</em></p>':'')+
          '<div class="controls date-result-actions"><button id="date-again" class="primary">Choose again</button><button id="date-change">Change a choice</button></div>'+
        '</div>',
        true,
        dateIntro,
        true
      );
      document.getElementById('date-again').addEventListener('click',()=>{
        round=0;
        picks=[];
        interactionMode='play';
        draw(true);
      });
      document.getElementById('date-change').addEventListener('click',openChangePicker);
      if(focus)focusDateHeading();
      return;
    }
    const current=content.rounds[round];
    let choice=picks[round]?.id||null;
    enhancedShell(
      'Choose our next little adventure',
      '<div class="date-round">'+
        '<div class="controls date-progress" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center"><span>'+(round?'<button id="date-back">Back</button>':'')+'</span><p class="eyebrow" style="text-align:center">Round '+(round+1)+' of '+content.rounds.length+'</p><span></span></div>'+
        '<h2 id="date-round-title" tabindex="-1">'+esc(current.question)+'</h2>'+
        '<div class="grid">'+current.options.map((option,index)=>
          '<button class="date-choice '+(choice===option.id?'date-picked':'')+'" aria-pressed="'+(choice===option.id?'true':'false')+'" data-i="'+index+'">'+
            (option.photo
              ? framedImage(option.photo,'Date choice')
              : '')+
            '<strong>'+esc(option.kind==='recipient-decides'?(option.title||'You choose this part'):option.title)+'</strong>'+
            (option.details?'<small>'+esc(option.details)+'</small>':'')+
            (option.kind==='recipient-decides'?'<small class="date-recipient-note">This part stays yours to decide.</small>':'')+
          '</button>'
        ).join('')+'</div><div class="date-action-zone"><button id="date-confirm" class="primary" '+(choice?'':'disabled')+'>'+(round===content.rounds.length-1?'Reveal our date':'Keep choosing')+'</button></div>'+
      '</div>',
      true,
      dateIntro,
      false,
    );
    document.getElementById('date-back')?.addEventListener('click',()=>{round--;draw(true);});
    document.querySelectorAll('.date-choice').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('.date-choice').forEach(item=>{item.classList.remove('date-picked');item.setAttribute('aria-pressed','false')});
      button.classList.add('date-picked');
      button.setAttribute('aria-pressed','true');
      choice=current.options[Number(button.dataset.i)].id;
      document.getElementById('date-confirm').disabled=false;
    }));
    document.getElementById('date-confirm').addEventListener('click',()=>{
      const option=current.options.find(item=>item.id===choice);
      if(!option)return;
      picks[round]=option;
      if(interactionMode==='edit-result'){
        interactionMode='play';
        round=content.rounds.length;
        draw(true);
        return;
      }
      round++;
      draw(true);
    });
  };
  draw();
}

function renderEnhancedStars(){
  const content=d.content;
  const points=[[16,64],[43,22],[77,58],[61,79],[26,34],[86,26],[46,57],[10,22],[76,82]];
  const seen=[];
  enhancedShell(
    'Wish upon our constellation',
    '<div class="stars">'+
      '<svg id="constellation" aria-hidden="true"></svg>'+
      content.stars.map((star,index)=>
        '<button class="star" aria-label="Open wish '+(index+1)+'" data-i="'+index+
          '" style="left:'+points[index][0]+'%;top:'+points[index][1]+'%;color:'+
          esc(star.color)+'">\u2605</button>'
      ).join('')+
    '</div>'+
    '<p id="star-progress" class="notice" role="status" aria-live="polite">'+progressLabel(0,content.stars.length)+'</p>'+
    '<div id="wish-dialog" class="dialog hidden" role="dialog" aria-modal="true">'+
      '<button id="close-wish">Close</button><div id="wish-card"></div>'+
    '</div>'+
    '<div id="star-final" class="final hidden">'+completionMarkup('final')+'</div>'
  );
  const dialog=document.getElementById('wish-dialog');
  const lines=document.getElementById('constellation');
  document.getElementById('close-wish').addEventListener('click',()=>{
    dialog.classList.add('hidden');
  });
  document.querySelectorAll('.star').forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.i);
    const star=content.stars[index];
    if(!seen.includes(index)){
      if(seen.length){
        const previous=points[seen[seen.length-1]];
        const next=points[index];
        lines.insertAdjacentHTML(
          'beforeend',
          '<line x1="'+previous[0]+'%" y1="'+previous[1]+'%" x2="'+next[0]+
            '%" y2="'+next[1]+'%"></line>'
        );
      }
      seen.push(index);
      button.classList.add('opened');
    }
    document.getElementById('wish-card').innerHTML=
      (star.photo
        ? framedImage(star.photo,'Wish memory')
        : '')+
      '<p class="eyebrow">A wish from me to you</p>'+
      '<h2>'+esc(star.wish)+'</h2>'+
      '<p class="opening">'+esc(star.message)+'</p>';
    dialog.classList.remove('hidden');
    document.getElementById('star-progress').textContent=
      progressLabel(seen.length,content.stars.length);
    if(seen.length===content.stars.length){
      document.getElementById('star-final').classList.remove('hidden');
    }
  }));
}

function renderEnhancedPlaylist(){
  const content=d.content;
  const tracks=Array.isArray(content.tracks)?content.tracks:[];
  if(!tracks.length){
    enhancedShell('The cozy playlist','<section class="card" role="alert"><h2>Playlist unavailable</h2><p>This Cozy Playlist could not be opened because its songs are incomplete.</p></section>',false);
    return;
  }
  let current=0;
  const explored=new Set();
  let playlistPreviewCleanup=null;
  templateCleanup=()=>{playlistPreviewCleanup?.();playlistPreviewCleanup=null;};
  let completionWasVisible=false;
  let focusReplay=Boolean(window.__tinyPlaylistReplayFocus);
  window.__tinyPlaylistReplayFocus=false;
  const draw=(focusTarget=null)=>{
    playlistPreviewCleanup?.();
    playlistPreviewCleanup=null;
    const track=tracks[current];
    explored.add(track.id);
    const complete=explored.size===tracks.length;
    const justCompleted=!completionWasVisible&&complete;
    completionWasVisible=complete;
    enhancedShell(
      'The cozy playlist',
      '<section class="card playlist-now" aria-labelledby="playlist-now-title">'+
        (track.photo
          ? framedImage(defaultFill(track.photo),'Song memory')
          : '')+
        '<p class="eyebrow" id="playlist-progress">'+progressLabel(explored.size,tracks.length)+'</p>'+
        '<p id="playlist-announcement" role="status" aria-live="polite" aria-atomic="true" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"></p>'+
        '<p class="notice" id="playlist-track-state">Selected</p>'+
        '<h2 id="playlist-now-title">'+esc(track.title)+'</h2>'+
        '<p class="eyebrow">'+esc(track.artist)+'</p>'+
        '<section class="notice"><strong>Liner note</strong><p>'+esc(track.why)+'</p></section>'+
        (track.audio?.dataUrl
          ? '<audio id="playlist-audio" preload="metadata" src="'+esc(track.audio.dataUrl)+'"></audio><label for="playlist-seek">Song position</label><input id="playlist-seek" type="range" min="0" max="1" value="0" step="1" aria-describedby="playlist-error" aria-valuetext="0:00 of duration unavailable"><div class="controls"><button id="playlist-play">Play</button><span id="playlist-time" class="notice">0:00 / 0:00</span></div><p id="playlist-error" class="notice hidden" role="alert"></p>'
          : '<p class="notice">'+(track.link?'This song opens from its link below.':'This one is a story interlude from an older playlist.')+'</p>')+
        (track.link
          ? '<a class="primary" href="'+esc(track.link)+'" target="_blank" rel="noopener noreferrer">Open song elsewhere</a>'
          : '')+
        '<div class="controls">'+
          '<button id="playlist-prev" '+(current===0?'disabled':'')+'>Previous</button>'+
          '<button id="playlist-next" '+(current===tracks.length-1?'disabled':'')+'>Next song</button>'+
        '</div>'+
      '</section>'+
      '<div class="grid playlist-grid" role="list" aria-label="Playlist tracks">'+tracks.map((item,index)=>
        '<div role="listitem"><button type="button" class="playlist-track '+(index===current?'selected':'')+'" data-playlist-index="'+index+'" aria-current="'+(index===current?'true':'')+'" aria-label="'+esc(item.title+', '+item.artist+', song '+(index+1)+' of '+tracks.length+(index===current?', selected':''))+'">'+
          (item.photo
            ? framedImage(defaultFill(item.photo),'Song memory')
            : '')+
          '<strong>'+esc(item.title)+'</strong>'+
          '<span class="eyebrow">'+esc(item.artist)+'</span>'+
          '<span class="notice">'+(explored.has(item.id)?'Explored':item.audio?.dataUrl?'Local song':item.link?'External song':'Story interlude')+'</span>'+
        '</button></div>'
      ).join('')+'</div>'+
      (complete?completionMarkup('final',{titleId:'playlist-completion-title',focusableTitle:true}):'')
    ,false);
    document.getElementById('playlist-prev')?.addEventListener('click',event=>{current--;draw(event.detail===0?'playlist-prev':null);});
    document.getElementById('playlist-next')?.addEventListener('click',event=>{current++;draw(event.detail===0?'playlist-next':null);});
    document.querySelectorAll('[data-playlist-index]').forEach(button=>
      button.addEventListener('click',event=>{current=Number(button.dataset.playlistIndex);draw(event.detail===0?'track':null);})
    );
    const external=document.querySelector('.playlist-now a.primary');
    external?.addEventListener('click',()=>{
      explored.add(track.id);
      if(explored.size===tracks.length&&!completionWasVisible)setTimeout(draw,0);
    });
    const audio=document.getElementById('playlist-audio');
    const seek=document.getElementById('playlist-seek');
    const play=document.getElementById('playlist-play');
    const time=document.getElementById('playlist-time');
    const state=document.getElementById('playlist-track-state');
    const error=document.getElementById('playlist-error');
    const announcement=document.getElementById('playlist-announcement');
    const completionTitle=document.getElementById('playlist-completion-title');
    const updateTrackLabel=mode=>{
      const button=document.querySelector('[data-playlist-index="'+current+'"]');
      if(button)button.setAttribute('aria-label',track.title+', '+track.artist+', song '+(current+1)+' of '+tracks.length+', '+mode);
    };
    const timeLabel=value=>Number.isFinite(value)&&value>=0?Math.floor(value/60)+':'+Math.floor(value%60).toString().padStart(2,'0'):'0:00';
    const announce=message=>{
      if(announcement)announcement.textContent=message;
    };
    if(audio){
      const owner='playlist-audio';
      const claim=()=>window.dispatchEvent(new CustomEvent('tiny-audio-preview-start',{detail:{owner}}));
      const pauseWhenAnotherStarts=event=>{if(event.detail?.owner!==owner)audio.pause();};
      const showError=()=>{
        if(error){error.textContent='This song could not be played on this device.';error.classList.remove('hidden');}
        if(state)state.textContent='Unavailable';
        if(play)play.textContent='Play';
        updateTrackLabel('selected and unavailable');
        announce('Playback unavailable for this song.');
      };
      const loadedMetadata=()=>{
        const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
        seek.max=String(Math.max(1,duration));
        seek.setAttribute('aria-valuetext','0:00 of '+(duration?timeLabel(duration):'duration unavailable'));
        time.textContent='0:00 / '+(duration?timeLabel(duration):'0:00');
      };
      const timeUpdate=()=>{
        const duration=Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
        const currentTime=Number.isFinite(audio.currentTime)&&audio.currentTime>=0?audio.currentTime:0;
        seek.value=String(Math.min(currentTime,Math.max(1,duration)));
        seek.setAttribute('aria-valuetext',timeLabel(currentTime)+' of '+(duration?timeLabel(duration):'duration unavailable'));
        time.textContent=timeLabel(currentTime)+' / '+(duration?timeLabel(duration):'0:00');
      };
      const onPlay=()=>{if(error)error.classList.add('hidden');if(state)state.textContent='Playing';if(play)play.textContent='Pause';updateTrackLabel('selected and playing');announce('Playing '+track.title+'.');};
      const onPause=()=>{if(audio.ended)return;if(state)state.textContent='Paused';if(play)play.textContent='Play';updateTrackLabel('selected and paused');};
      const onEnded=()=>{if(state)state.textContent='Selected';if(play)play.textContent='Play';updateTrackLabel('selected');announce('Finished '+track.title+'.');if(complete)completionTitle?.focus();else play?.focus();};
      const onPlayClick=()=>{
        if(audio.paused){
          if(error)error.classList.add('hidden');
          claim();
          audio.play().catch(showError);
        }else audio.pause();
      };
      const onSeek=()=>{audio.currentTime=Number(seek.value);};
      audio.addEventListener('play',claim);
      window.addEventListener('tiny-audio-preview-start',pauseWhenAnotherStarts);
      audio.addEventListener('loadedmetadata',loadedMetadata);
      audio.addEventListener('timeupdate',timeUpdate);
      audio.addEventListener('play',onPlay);
      audio.addEventListener('pause',onPause);
      audio.addEventListener('error',showError);
      audio.addEventListener('ended',onEnded);
      play.addEventListener('click',onPlayClick);
      seek.addEventListener('input',onSeek);
      playlistPreviewCleanup=()=>{
        audio.removeEventListener('play',claim);
        window.removeEventListener('tiny-audio-preview-start',pauseWhenAnotherStarts);
        audio.removeEventListener('loadedmetadata',loadedMetadata);
        audio.removeEventListener('timeupdate',timeUpdate);
        audio.removeEventListener('play',onPlay);
        audio.removeEventListener('pause',onPause);
        audio.removeEventListener('error',showError);
        audio.removeEventListener('ended',onEnded);
        play.removeEventListener('click',onPlayClick);
        seek.removeEventListener('input',onSeek);
        audio.pause();
      };
    }
    if(justCompleted)requestAnimationFrame(()=>document.getElementById('playlist-completion-title')?.focus());
    else if(focusReplay)requestAnimationFrame(()=>document.querySelector('[data-playlist-index]')?.focus());
    else if(focusTarget){
      const navigation=focusTarget==='track'?null:document.getElementById(focusTarget);
      const target=navigation&&!navigation.disabled?navigation:document.querySelector('[data-playlist-index="'+current+'"]');
      target?.focus({preventScroll:true});
    }
    focusReplay=false;
  };
  draw();
}

let catchRenderCycle=0;
function renderEnhancedCatch(){
  const content=d.content;
  const found=[];
  const cycle=catchRenderCycle++;
  const activeHeartCount=Math.min(5,content.hearts.length);
  const staticHearts=motionMode==='reduced';
  const completionHasDescription=Boolean(completion.finalMessage||completion.closingMessage||completion.signature);
  activeDialogCleanup?.();
  const heart=content.heartAssetDataUrl
    ? '<img class="export-heart-art" alt="" src="'+esc(content.heartAssetDataUrl)+'">'
    : '\u2665';
  const heartButton=(index,slot)=>{
    const spawn=catchHeartSpawn(index,cycle);
    return '<button class="export-heart" aria-label="Catch heart '+(index+1)+'" data-slot="'+slot+'" data-i="'+index+
      '" style="left:clamp(0.5rem,'+spawn.left.toFixed(2)+'%,calc(100% - 4.5rem));'+(staticHearts?'top:'+spawn.top.toFixed(2)+'%;':'--catch-heart-start-top:'+spawn.initialTop.toFixed(2)+'%;')+'--catch-heart-duration:'+spawn.duration.toFixed(2)+'s;animation-delay:'+spawn.delay.toFixed(2)+'s">'+heart+'</button>';
  };
  root.innerHTML=
    '<main class="catch-experience"><section class="catch-page">'+
      '<header class="catch-header">'+
        '<h1>For '+esc(d.recipient)+'</h1>'+
        '<p class="opening">'+esc(d.openingMessage)+'</p>'+
        '<div class="catch-header-actions">'+
          '<span id="catch-progress" class="catch-chip" tabindex="-1">'+progressLabel(0,content.hearts.length)+'</span>'+
          ''+
        '</div>'+
      '</header>'+
      '<div id="catch-field" class="catch-field">'+Array.from({length:activeHeartCount},(_,slot)=>heartButton(slot,slot)).join('')+'</div>'+
      '<section id="catch-finished" class="card hidden"><h2>Every little memory, found.</h2><div class="controls"><button id="catch-read-final" class="primary">Read the final note</button><button id="catch-finished-review">Revisit memories</button><button id="catch-finished-replay">Play again</button></div></section>'+
      '</section></main>'+
      '<div id="catch-final" class="catch-final hidden" role="dialog" aria-modal="true" aria-labelledby="catch-completion-title"'+(completionHasDescription?' aria-describedby="catch-completion-description"':'')+' tabindex="-1">'+
        '<div class="catch-final__panel">'+completionMarkup('final',{titleId:'catch-completion-title',focusableTitle:true,includeEyebrow:false,descriptionId:completionHasDescription?'catch-completion-description':''})+
          '<div class="controls"><button id="catch-review" class="primary" type="button">Revisit memories</button><button id="catch-replay" type="button">Play again</button></div>'+
        '</div>'+
      '</div>'+
      '<div id="heart-backdrop" class="dialog-backdrop hidden"></div>'+
      '<div id="heart-dialog" class="dialog heart-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="heart-title" tabindex="-1">'+
        '<div class="heart-dialog__head">'+
          '<p id="heart-dialog-progress" class="heart-dialog__progress">Heart 1 of '+content.hearts.length+'</p>'+
          '<button id="close-heart" class="heart-dialog__close" type="button" '+
            'aria-label="Close">&#10005;</button>'+
        '</div>'+
        '<div id="heart-card" class="heart-dialog__body"></div>'+
        '<div class="heart-dialog__foot">'+
          '<button id="keep-catching" class="primary" type="button">Keep catching</button>'+
        '</div>'+
      '</div>'+
      '<div id="memories-backdrop" class="dialog-backdrop hidden"></div>'+
      '<div id="memories-dialog" class="dialog heart-dialog hidden" role="dialog" aria-modal="true" aria-label="Memory collection" tabindex="-1">'+
        '<div class="heart-dialog__head">'+
          '<p class="heart-dialog__progress">Memory collection</p>'+
          '<button id="close-memories" class="heart-dialog__close" type="button" '+
            'aria-label="Close memories">&#10005;</button>'+
        '</div>'+
        '<div id="memories-list" class="heart-dialog__body memories-list"></div>'+
      '</div>';
  // Replay re-enters this function with the dialog rebuilt closed; clear any
  // leftover open-state flag from the previous round.
  document.body.classList.remove('dialog-open');
  const dialog=document.getElementById('heart-dialog');
  const backdrop=document.getElementById('heart-backdrop');
  const progress=document.getElementById('catch-progress');
  const final=document.getElementById('catch-final');
  const body=document.getElementById('heart-card');
  const dialogProgress=document.getElementById('heart-dialog-progress');
  const closeButton=document.getElementById('close-heart');
  const memoriesDialog=document.getElementById('memories-dialog');
  const memoriesBackdrop=document.getElementById('memories-backdrop');
  const memoriesList=document.getElementById('memories-list');
  const closeMemoriesButton=document.getElementById('close-memories');
  let activeTrigger=null;
  let completionBackgroundState=[];
  templateCleanup=()=>{
    setCompletionBackgroundInert(false);
  };
  const setCompletionBackgroundInert=(inert)=>{
    if(inert){
      if(completionBackgroundState.length)return;
      const targets=[document.querySelector('.catch-header'),...document.querySelectorAll('#catch-field > .export-heart')].filter(Boolean);
      completionBackgroundState=targets.map(element=>({
        element,
        inert:element.inert,
        ariaHidden:element.getAttribute('aria-hidden')
      }));
      targets.forEach(element=>{
        element.inert=true;
        element.setAttribute('aria-hidden','true');
      });
      return;
    }
    completionBackgroundState.forEach(({element,inert,ariaHidden})=>{
      element.inert=inert;
      if(ariaHidden===null)element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden',ariaHidden);
    });
    completionBackgroundState=[];
  };
  const firstPlayableHeart=()=>document.querySelector('.export-heart:not(.hidden):not(.caught)')||document.getElementById('catch-progress');
  const closeCompletion=()=>{
    activeDialogCleanup?.();
    final.classList.add('hidden');
    document.body.classList.remove('dialog-open');
    setCompletionBackgroundInert(false);
    requestAnimationFrame(()=>firstPlayableHeart()?.focus());
  };
  const openCompletion=()=>{
    if(!final.isConnected||!final.classList.contains('hidden'))return;
    document.getElementById('catch-field').classList.add('hidden');
    document.getElementById('catch-finished').classList.remove('hidden');
    final.classList.remove('hidden');
    document.body.classList.add('dialog-open');
    setCompletionBackgroundInert(true);
    final.querySelector('.catch-final__panel').scrollTop=0;
    final.querySelector('#catch-completion-description')?.scrollTo(0,0);
    bindDialogFocus(final,document.getElementById('catch-completion-title'),null,closeCompletion);
  };
  // Use a real backdrop and the shared focus/inert contract for memory dialogs.
  const closeDialog=()=>{
    const completed=found.length===content.hearts.length;
    dialog.classList.add('hidden');
    backdrop.classList.add('hidden');
    document.body.classList.remove('dialog-open');
    activeDialogCleanup?.();
    activeTrigger=null;
    if(completed)openCompletion();
  };
  const openDialog=trigger=>{
    activeTrigger=trigger;
    backdrop.classList.remove('hidden');
    dialog.classList.remove('hidden');
    document.body.classList.add('dialog-open');
    body.scrollTop=0;
    bindDialogFocus(dialog,closeButton,activeTrigger,closeDialog);
  };

  closeButton.addEventListener('click',closeDialog);
  document.getElementById('keep-catching').addEventListener('click',closeDialog);
  backdrop.addEventListener('click',closeDialog);
  // The fixed button pool is replenished from all uncaught memories in order.
  const heartButtons=[...document.querySelectorAll('.export-heart')];
  const refreshHearts=()=>{
    const remaining=content.hearts.map((_,index)=>index).filter(index=>!found.includes(index));
    heartButtons.forEach((button,slot)=>{
      const nextIndex=remaining[slot];
      if(nextIndex === undefined){
        button.classList.add('hidden');
        button.classList.remove('catch-final-heart','caught');
        button.removeAttribute('data-i');
        button.setAttribute('aria-disabled','true');
        return;
      }
      const spawn=catchHeartSpawn(nextIndex,cycle);
      button.dataset.i=String(nextIndex);
      button.innerHTML=heart;
      button.classList.remove('hidden','caught');
      button.classList.toggle('catch-final-heart',remaining.length===1);
      button.removeAttribute('aria-disabled');
      button.style.left='clamp(0.5rem,'+spawn.left.toFixed(2)+'%,calc(100% - 4.5rem))';
      button.style.setProperty('--catch-heart-start-top',spawn.initialTop.toFixed(2)+'%');
      button.style.setProperty('--catch-heart-duration',(spawn.duration+(remaining.length===1?2.5:0)).toFixed(2)+'s');
      button.style.animationDelay=spawn.delay.toFixed(2)+'s';
      if(staticHearts)button.style.top=spawn.top.toFixed(2)+'%';
      else button.style.removeProperty('top');
      button.setAttribute('aria-label',remaining.length===1?'Catch the final glowing heart':'Catch heart '+(nextIndex+1));
    });
  };
  const closeMemoriesDialog=()=>{
    memoriesDialog.classList.add('hidden');
    memoriesBackdrop.classList.add('hidden');
    document.body.classList.remove('dialog-open');
    activeDialogCleanup?.();
  };
  const openMemoriesDialog=(trigger=firstPlayableHeart())=>{
    memoriesList.innerHTML=content.hearts.map((item,index)=>found.includes(index)?
      '<button type="button" data-i="'+index+'" class="memory-collection-item">'+
        (item.photo?framedImage({...item.photo,presentation:{...item.photo.presentation,mode:'fill'}},'','memory-collection-photo'):'')+
        '<span class="memory-collection-copy"><strong>Memory '+(index+1)+'</strong><span>'+esc(item.message||'A photo to remember')+'</span></span><span aria-hidden="true">›</span></button>':''
    ).join('');
    memoriesList.querySelectorAll('button').forEach(button=>{
      button.addEventListener('click',()=>{
        const index=Number(button.dataset.i);
        closeMemoriesDialog();
        showMemory(index,firstPlayableHeart(),false);
      });
    });
    memoriesBackdrop.classList.remove('hidden');
    memoriesDialog.classList.remove('hidden');
    document.body.classList.add('dialog-open');
    bindDialogFocus(memoriesDialog,closeMemoriesButton,trigger,closeMemoriesDialog);
  };
  closeMemoriesButton.addEventListener('click',closeMemoriesDialog);
  memoriesBackdrop.addEventListener('click',closeMemoriesDialog);
  const showMemory=(index,trigger,newlyCaught)=>{
    const item=content.hearts[index];
    if(newlyCaught){
      found.push(index);
      trigger.classList.add('caught');
      trigger.setAttribute('aria-disabled','true');
      refreshHearts();
    }
    body.innerHTML=
      (item.photo
        ? '<div class="heart-dialog-photo-frame"><img class="photo heart-dialog-photo" data-presentation-mode="'+presentation(item.photo).mode+'" decoding="async" alt="Shared memory" style="'+presentationStyle(item.photo)+'" src="'+esc(item.photo.previewUrl)+'"></div>'
        : '')+
      '<p id="heart-title" class="note '+(item.photo?'note--secondary':'note--primary')+'">'+
        esc(item.message||'Just a heart, caught with love.')+
      '</p>';
    openDialog(trigger);
    progress.textContent=progressLabel(found.length,content.hearts.length);
    dialogProgress.textContent='Heart '+(index+1)+' of '+content.hearts.length;
    document.getElementById('keep-catching').textContent=found.length===content.hearts.length?'Read the final note':'Keep catching';
  };
  heartButtons.forEach(button=>button.addEventListener('click',()=>{
    const index=Number(button.dataset.i);
    if(found.includes(index))return;
    showMemory(index,button,true);
  }));
  refreshHearts();
  document.getElementById('catch-review').addEventListener('click',()=>{
    closeCompletion();
    openMemoriesDialog(firstPlayableHeart());
  });
  const replay=()=>{
    activeDialogCleanup?.();
    document.body.classList.remove('dialog-open');
    setCompletionBackgroundInert(false);
    renderTemplate();
    requestAnimationFrame(()=>firstPlayableHeart()?.focus());
  };
  document.getElementById('catch-replay').addEventListener('click',replay);
  document.getElementById('catch-read-final').addEventListener('click',openCompletion);
  document.getElementById('catch-finished-review').addEventListener('click',event=>openMemoriesDialog(event.currentTarget));
  document.getElementById('catch-finished-replay').addEventListener('click',replay);
}

renderTemplate=function(){
  disposeTemplate();
  if(d.template==='catch-the-heart')return renderEnhancedCatch();
  if(d.template==='photo-puzzle')return renderEnhancedPuzzle();
  if(d.template==='choose-our-date')return renderEnhancedDate();
  if(d.template==='wish-upon-a-star')return renderEnhancedStars();
  if(d.template==='cozy-playlist')return renderEnhancedPlaylist();
  return legacyRenderTemplate();
};
`;
