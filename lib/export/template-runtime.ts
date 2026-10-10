export const templateRuntime = String.raw`
function renderTemplate(){
  const c=window.__TINY_SURPRISE__;
  const root=document.getElementById('app');
  const content=c.content;
  const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[character]));
  const img=(image,alt)=>image?.previewUrl
    ? '<div class="image-frame" data-presentation-mode="'+presentation(image).mode+'"><img class="photo" data-presentation-mode="'+presentation(image).mode+'" loading="lazy" decoding="async" alt="'+esc(alt)+'" style="'+presentationStyle(image)+'" src="'+esc(image.previewUrl)+'"></div>'
    : '';
  const shell=(title,body)=>{
    closeMusicSettings();
    activeDialogCleanup?.();
    document.body.classList.remove('dialog-open');
    root.querySelectorAll('audio,video').forEach(media=>media.pause());
    document.body.dataset.tinyTopMusicControls=hasMusic()?'true':'false';
    document.getElementById('music-dock')?.remove();
    root.innerHTML=
      '<main class="page">'+
        '<div class="topline">'+
          '<div class="controls">'+
            ''+
            '<button id="replay" type="button">Replay</button>'+
          '</div>'+
        '</div>'+
        '<h1>'+esc(title)+'</h1>'+
        '<p class="opening">'+esc(c.openingMessage)+'</p>'+
        body+
      '</main>';
    document.getElementById('replay')?.addEventListener('click',()=>renderTemplate());
  };

  if(c.template==='open-when'){
    const opened=new Set();
    const soundtrack=content.musicFile?.dataUrl
      ? '<section class="letter-soundtrack notice"><strong>\u266b A song for these letters</strong>'+
          '<audio controls preload="metadata" src="'+esc(content.musicFile.dataUrl)+'"></audio></section>'
      : '';
    shell(
      'Letters for every moment',
      '<p class="notice">Open one whenever you need a familiar voice, a memory, or a little courage.</p>'+
      soundtrack+
      '<div class="envelopes letter-grid">'+content.envelopes.map((envelope,index)=>
        '<button class="envelope letter-envelope" data-i="'+index+'"><strong>'+
          esc(envelope.title)+'</strong><small>Break the little seal</small></button>'
      ).join('')+'<button id="open-final-envelope" type="button" class="envelope letter-envelope final-envelope" disabled aria-disabled="true" aria-label="Final note locked until all letters are opened"><strong>One last note</strong><small>Open all letters first</small></button></div>'+
      '<div id="note-overlay" class="letter-overlay hidden"><div id="note" class="dialog letter-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="note-title" aria-hidden="true" tabindex="-1">'+
        '<header class="letter-dialog-head"><button id="close-note" type="button">\u2190 Back to the letters</button></header><div id="note-content" class="letter-dialog-body"></div>'+
      '</div></div>'+
      ''
    );
    const dialog=document.getElementById('note');
    const overlay=document.getElementById('note-overlay');
    const closeButton=document.getElementById('close-note');
    const finalButton=document.getElementById('open-final-envelope');
    let activeTrigger=null;
    const syncFinal=()=>{
      const available=content.envelopes.length>0&&opened.size===content.envelopes.length;
      finalButton.disabled=!available;
      finalButton.setAttribute('aria-disabled',String(!available));
      finalButton.setAttribute('aria-label',available?'Open the final note':'Final note locked until all letters are opened');
      finalButton.querySelector('small').textContent=available?'Always here when you want it':'Open all letters first';
    };
    const closeNote=()=>{
      if(dialog.classList.contains('hidden'))return;
      dialog.querySelectorAll('video').forEach(video=>video.pause());
      dialog.classList.add('hidden');
      overlay.classList.add('hidden');
      document.body.classList.remove('dialog-open');
      dialog.setAttribute('aria-hidden','true');
      activeDialogCleanup?.();
      activeTrigger=null;
    };
    closeButton.addEventListener('click',closeNote);
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeNote();});
    document.querySelectorAll('.letter-envelope[data-i]').forEach(button=>button.addEventListener('click',()=>{
      const index=Number(button.dataset.i);
      const envelope=content.envelopes[index];
      activeTrigger=button;
      opened.add(envelope.id);
      syncFinal();
      button.classList.add('opened');
      button.querySelector('small').textContent='Read it again';
      document.getElementById('note-content').innerHTML=
        '<p class="eyebrow">Opened with care</p>'+
        '<h2 id="note-title">'+esc(envelope.title)+'</h2>'+
        '<p class="opening">'+esc(envelope.message)+'</p>'+
        img(envelope.photo,'Photo inside note')+
        (envelope.video
          ? '<video class="letter-video" controls playsinline preload="metadata" src="'+esc(envelope.video.previewUrl)+'"></video>'
          : '');
      dialog.classList.remove('hidden');
      overlay.classList.remove('hidden');
      document.body.classList.add('dialog-open');
      document.getElementById('note-content').scrollTop=0;
      dialog.removeAttribute('aria-hidden');
      bindDialogFocus(dialog,closeButton,activeTrigger,closeNote);
    }));
    finalButton.addEventListener('click',event=>{
      if(finalButton.disabled)return;
      activeTrigger=event.currentTarget;
      document.getElementById('note-content').innerHTML='<p class="eyebrow">A note to keep</p><h2 id="note-title">One last note</h2>'+completionMarkup('final');
      dialog.classList.remove('hidden');
      overlay.classList.remove('hidden');
      document.body.classList.add('dialog-open');
      document.getElementById('note-content').scrollTop=0;
      dialog.removeAttribute('aria-hidden');
      bindDialogFocus(dialog,closeButton,activeTrigger,closeNote);
    });
    syncFinal();
    return;
  }

  if(c.template==='choose-our-date'){
    shell(
      'Choose our next little adventure',
      '<div class="grid">'+content.options.map((option,index)=>
        '<button class="card date-choice" data-i="'+index+'">'+
          img(option.photo,'Date idea')+
          '<h2>'+esc(option.title)+'</h2>'+
          '<p>'+esc(option.details)+'</p>'+
        '</button>'
      ).join('')+'</div>'+
      '<section id="date-final" class="final hidden"></section>'
    );
    document.querySelectorAll('.date-choice').forEach(button=>button.addEventListener('click',()=>{
      const option=content.options[Number(button.dataset.i)];
      document.getElementById('date-final').innerHTML=
        '<h2>'+esc(option.title)+'</h2><p>'+esc(content.revealMessage)+'</p>'+completionMarkup('final');
      document.getElementById('date-final').classList.remove('hidden');
    }));
    return;
  }

  if(c.template==='memory-quiz'){
    let current=0;
    let score=0;
    const focusQuizElement=target=>requestAnimationFrame(()=>{
      document.getElementById(target==='feedback'?'quiz-next':'quiz-question-title')?.focus();
    });
    const draw=(focusTarget='question')=>{
      const question=content.questions[current];
      const answers=question.answers
        .map((answer,originalIndex)=>({answer,originalIndex}))
        .filter(item=>Boolean(String(item.answer||'').trim()));
      shell(
        'A little memory quiz',
        '<div class="card">'+
          '<p class="eyebrow">'+progressLabel(current+1,content.questions.length)+'</p>'+
          '<h2 id="quiz-question-title" tabindex="-1">'+esc(question.prompt)+'</h2>'+
          '<div class="grid quiz-answers">'+answers.map(item=>
            '<button type="button" class="answer" data-i="'+item.originalIndex+'">'+esc(item.answer)+'<span class="answer-state" aria-hidden="true"></span></button>'
          ).join('')+'</div>'+
          '<div id="quiz-note" class="notice hidden"></div>'+
        '</div>'
      );
      if(focusTarget)focusQuizElement(focusTarget);
      document.querySelectorAll('.answer').forEach(button=>button.addEventListener('click',()=>{
        const correct=Number(button.dataset.i)===question.correctIndex;
        if(correct)score++;
        document.querySelectorAll('.answer').forEach(answer=>{
          const answerIndex=Number(answer.dataset.i);
          const answerText=String(question.answers[answerIndex]||'');
          const answerCorrect=answerIndex===question.correctIndex;
          const selected=answerIndex===Number(button.dataset.i);
          answer.disabled=true;
          answer.setAttribute('aria-label',answerCorrect&&selected
            ? answerText+'. Your answer. Correct answer.'
            : answerCorrect
              ? answerText+'. Correct answer.'
              : selected
                ? answerText+'. Your answer.'
                : answerText);
          const state=answer.querySelector('.answer-state');
          if(state)state.textContent=answerCorrect
            ? ' — Correct answer'
            : selected
              ? ' — Your answer'
              : '';
        });
        const note=document.getElementById('quiz-note');
        note.classList.remove('hidden');
        note.innerHTML=
          img(question.photo,'Shared quiz memory')+
          '<p id="quiz-feedback" role="status" aria-live="polite" aria-atomic="true">'+(correct?'You remembered it \u2726':'Not quite\u2014but here\u2019s the memory.')+'</p>'+
          (question.memoryNote?'<p>'+esc(question.memoryNote)+'</p>':'')+
          '<button type="button" id="quiz-next" class="primary">'+
            (current===content.questions.length-1?'See the result':'Next memory')+
          '</button>';
        focusQuizElement('feedback');
        document.getElementById('quiz-next').addEventListener('click',()=>{
          if(current===content.questions.length-1){
            const ratio=score/content.questions.length;
            const heading=ratio>=.8?'You remembered the little things.':ratio>=.45?'So many of these moments stayed with you.':'The memories matter more than the score.';
            const trigger=document.getElementById('quiz-next');
            const result=document.createElement('div');
            result.className='recipient-completion-overlay quiz-result';
            result.setAttribute('role','dialog');
            result.setAttribute('aria-modal','true');
            result.setAttribute('aria-labelledby','quiz-result-title');
            result.innerHTML='<section class="recipient-completion-panel"><p class="eyebrow">'+score+' of '+content.questions.length+' remembered</p><h2 id="quiz-result-title" tabindex="-1">'+heading+'</h2><div class="recipient-completion-body">'+completionMarkup('final')+'</div><button class="primary" id="quiz-again">Remember them again</button></section>';
            root.appendChild(result);
            document.body.classList.add('dialog-open');
            const again=document.getElementById('quiz-again');
            const closeResult=()=>{result.remove();activeDialogCleanup?.();document.body.classList.remove('dialog-open');};
            bindDialogFocus(result,document.getElementById('quiz-result-title'),trigger,closeResult);
            again.addEventListener('click',()=>{activeDialogCleanup?.();current=0;score=0;draw('replay');});
          }else{
            current++;
            draw('question');
          }
        });
      }));
    };
    draw('question');
    return;
  }

  if(c.template==='our-storybook'){
    const storybookPages=Array.isArray(content.pages)?content.pages:[];
    const storybookCompositions=new Set(['auto','photo-note','photo-led','note-focused','split']);
    const storybookIds=new Set();
    const storybookPlayable=storybookPages.length>=2&&storybookPages.length<=20&&
      typeof content.finalMessage==='string'&&content.finalMessage.trim()&&
      storybookPages.every(page=>{
        if(!page||typeof page!=='object'||Array.isArray(page))return false;
        if(typeof page.id!=='string'||!page.id.trim()||storybookIds.has(page.id))return false;
        storybookIds.add(page.id);
        return typeof page.title==='string'&&page.title.trim()&&typeof page.body==='string'&&page.body.trim()&&
          (page.composition===undefined||storybookCompositions.has(page.composition));
      });
    if(!storybookPlayable){
      shell('Our tiny storybook','<section class="card" role="alert"><h2>This Storybook could not be opened</h2><p>Its pages are incomplete or unsupported. Ask the sender for a new copy.</p></section>');
      return;
    }
    let current=0;
    let removeGesture=()=>{};
    let focusRequest=0;
    templateCleanup=()=>{removeGesture();focusRequest++;};
    const focusStoryTarget=(selector)=>{
      const request=++focusRequest;
      let attempts=0;
      const focus=()=>{
        if(request!==focusRequest)return;
        const target=root.querySelector(selector);
        if(target){target.focus();return;}
        if(attempts++<20)requestAnimationFrame(focus);
      };
      requestAnimationFrame(focus);
    };
    const draw=(focusTarget='none')=>{
      removeGesture();
      focusRequest++;
      if(current>=storybookPages.length){
        shell('Our tiny storybook','<p id="storybook-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true">Back cover</p><section class="card storybook-back-cover"><h2 id="storybook-back-cover-title" tabindex="-1">'+esc(c.completion?.title||'The end, for now')+'</h2>'+completionMarkup('final')+'<div class="controls"><button id="story-again" class="primary">Read again</button><button id="story-browse">Browse chapters</button></div></section>');
        if(focusTarget==='back-cover')focusStoryTarget('#storybook-back-cover-title');
        document.getElementById('story-again').addEventListener('click',()=>{current=0;draw('page')});
        document.getElementById('story-browse').addEventListener('click',()=>{current=0;draw('chapters')});
        return;
      }
      const page=storybookPages[current];
      const nextPage=storybookPages[current+1];
      const pageMarkup=(item,index,secondary=false)=>{
        const composition=item.composition&&item.composition!=='auto'?item.composition:!item.photo?'note-focused':String(item.body||'').trim().length<150?'photo-led':String(item.body||'').trim().length>420?'photo-note':'split';
        const presentedPhoto=composition==='photo-led'&&item.photo&&!item.photo.presentation?{...item.photo,presentation:{mode:'fill'}}:item.photo;
        const headingAttributes=secondary?'':' id="storybook-page-title" tabindex="-1"';
        return '<article class="storybook-page storybook-page--'+esc(composition)+(secondary?' storybook-page--adjacent':'')+'">'+img(presentedPhoto,'Story memory')+'<p class="eyebrow">'+progressLabel(index+1,storybookPages.length)+'</p><h2'+headingAttributes+'>'+esc(item.title)+'</h2><p class="opening">'+esc(item.body)+'</p></article>';
      };
      shell(
        'Our tiny storybook',
        '<div class="storybook-root" style="touch-action:pan-y"><p id="storybook-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true">'+esc(progressLabel(current+1,storybookPages.length))+'</p>'+
        '<div class="storybook-spread">'+pageMarkup(page,current)+(nextPage?pageMarkup(nextPage,current+1,true):'')+'</div>'+
          ((storybookPages.length>8||focusTarget==='chapters')?'<details class="notice"'+(focusTarget==='chapters'?' open':'')+'><summary>Chapters</summary><div class="controls">'+storybookPages.map((item,index)=>'<button type="button" data-story-index="'+index+'"'+(current===index?' aria-current="page"':'')+'>'+(index+1)+'. '+esc(item.title)+'</button>').join('')+'</div></details>':'')+
          '<div class="controls">'+
            '<button id="back" '+(!current?'disabled':'')+'>Previous</button>'+
            '<button id="next" class="primary">'+(current===storybookPages.length-1?'Close the book':'Turn the page')+'</button>'+
          '</div></div>'
      );
      if(focusTarget==='page')focusStoryTarget('#storybook-page-title');
      if(focusTarget==='chapters')focusStoryTarget('[data-story-index]');
      document.getElementById('back').addEventListener('click',()=>{current=Math.max(0,current-1);draw('page')});
      document.getElementById('next').addEventListener('click',()=>{current=Math.min(storybookPages.length,current+1);draw(current>=storybookPages.length?'back-cover':'page')});
      document.querySelectorAll('[data-story-index]').forEach(button=>button.addEventListener('click',()=>{current=Number(button.dataset.storyIndex);draw('page')}));
      let startX=0;
      let startY=0;
      let pointerId=null;
      const onPointerDown=event=>{if(!event.isPrimary)return;startX=event.clientX;startY=event.clientY;pointerId=event.pointerId};
      const onPointerUp=event=>{if(pointerId!==event.pointerId)return;pointerId=null;const dx=event.clientX-startX;const dy=event.clientY-startY;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)){current=Math.min(storybookPages.length,Math.max(0,current+(dx<0?1:-1)));draw(current>=storybookPages.length?'back-cover':'page')}};
      const onPointerCancel=()=>{pointerId=null};
      root.addEventListener('pointerdown',onPointerDown);
      root.addEventListener('pointerup',onPointerUp);
      root.addEventListener('pointercancel',onPointerCancel);
      removeGesture=()=>{root.removeEventListener('pointerdown',onPointerDown);root.removeEventListener('pointerup',onPointerUp);root.removeEventListener('pointercancel',onPointerCancel);pointerId=null};
    };
    draw();
    return;
  }

  if(c.template==='wish-upon-a-star'){
    const seen=new Set();
    shell(
      'Wish upon a star',
      '<div class="stars">'+content.stars.map((star,index)=>
        '<button class="star" data-i="'+index+'" style="left:'+(8+(index*23)%82)+
          '%;top:'+(10+(index*31)%70)+'%">\u2605</button>'
      ).join('')+
      '<p id="star-note" class="notice">Tap a star to reveal its wish.</p></div>'+
      '<div id="star-final" class="final hidden">'+completionMarkup('final')+'</div>'
    );
    document.querySelectorAll('.star').forEach(button=>button.addEventListener('click',()=>{
      const index=Number(button.dataset.i);
      const star=content.stars[index];
      seen.add(index);
      document.getElementById('star-note').innerHTML=
        '<strong>'+esc(star.wish)+'</strong><p>'+esc(star.message)+'</p>';
      if(seen.size===content.stars.length){
        document.getElementById('star-final').classList.remove('hidden');
      }
    }));
    return;
  }

  if(c.template==='cozy-playlist'){
    shell(
      'The cozy playlist',
      '<div class="grid">'+content.tracks.map(track=>
        '<article class="card">'+
          img(track.photo,'Song memory')+
          '<h2>'+esc(track.title)+'</h2>'+
          '<p class="eyebrow">'+esc(track.artist)+'</p>'+
          '<p>'+esc(track.why)+'</p>'+
          (track.link
            ? '<a class="primary" href="'+esc(track.link)+'" target="_blank" rel="noopener noreferrer">Open song</a>'
            : '')+
        '</article>'
      ).join('')+'</div>'+
      completionMarkup('final')
    );
  }
}
`;
