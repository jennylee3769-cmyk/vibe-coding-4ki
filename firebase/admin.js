const $=id=>document.getElementById(id),lessons=window.VIBE4_LESSONS;
let transport=null,admin=false,connected=false,received=false,current=null,previewReady=false,selected=1,previewLesson=0,authUser=null,authCheck="signed-out",authError=null;
const authorized=()=>admin&&connected&&received&&current&&!current.isEmpty;
const allowed=()=>authorized()&&current.lesson===selected;
function goPreview(n){if(!previewReady)return;try{const d=$('viewer').contentDocument;d.getElementById('ctlJump').value=n;d.getElementById('ctlGo').click()}catch(e){previewReady=false}}
function render(){
 const course=lessons[selected],ok=allowed(),state=current&&!current.isEmpty,currentMatches=state&&current.lesson===selected;
 $('sessionLabel').textContent=(state?current.lesson:selected)+'차시'+(state?'':' · 미리보기');$('lessonTitle').textContent=course.title;
 $('summarySlide').textContent=currentMatches?(current.slide+1)+' / '+course.count:'상태 대기';$('currentNumber').textContent=currentMatches?current.slide+1:'—';$('currentTotal').textContent='/ '+course.count;
 $('currentTitle').textContent=currentMatches?course.titles[current.slide]:'선택 차시 미리보기 · 수업 적용은 별도 버튼';
 $('prevBtn').disabled=!ok||current.slide===0;$('nextBtn').disabled=!ok||current.slide===course.count-1;$('jump').disabled=$('jumpBtn').disabled=!ok;$('jump').max=course.count;$('jump').value=currentMatches?current.slide+1:1;
 for(const [id,key,summary]of [['lockSwitch','locked','summaryLock'],['pdfSwitch','pdf','summaryPdf'],['focusSwitch','focus','summaryFocus']]){const on=!!(state&&current[key]);$(id).disabled=!authorized();$(id).setAttribute('aria-checked',String(on));$(id).textContent=state?(on?'ON':'OFF'):'—';$(summary).textContent=$(id).textContent}
 $('initializeBtn').hidden=!(admin&&connected&&received&&current?.isEmpty);$('applyLesson').disabled=!authorized();$('logoutBtn').hidden=!authUser;
 const authMessages={'signed-out':'관리자 로그인 필요',pending:'로그인 완료 · 관리자 권한 확인 중',authorized:'관리자 권한 확인 완료',denied:'로그인 완료 · admins 목록에 관리자 권한이 없음',error:'로그인 완료 · 관리자 권한 조회 실패'};
 $('authStatus').textContent=(authMessages[authCheck]||authMessages['signed-out'])+(authError?' · '+authError:'')+(authUser?' · UID: '+authUser.uid:'');
 $('loginForm').querySelectorAll('label,input,button[type="submit"]').forEach(el=>el.hidden=admin);
 $('loginForm').querySelector('button[type="submit"]').disabled=authCheck==='pending';
 $('connection').textContent=(connected?'Firebase 연결':'Firebase 연결 대기')+' · '+(received?(current?.isEmpty?'수업 상태 없음':current?'상태 읽기 완료':'상태 오류'):'상태 읽기 대기');
 $('studentLink').href=course.slides+'?slide='+(currentMatches?current.slide+1:1);$('studentLink').setAttribute('aria-disabled','false');$('studentLink').tabIndex=0;
 $('practiceLink').href=course.practice;$('promptsLink').href=course.prompts;
 document.querySelectorAll('[data-lesson]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.lesson)===selected)));
 $('viewer').hidden=false;$('empty').hidden=true;
 if(previewLesson!==selected){previewLesson=selected;previewReady=false;$('viewer').title=selected+'차시 슬라이드 미리보기';$('viewer').src=course.slides+'?view=1&slide=1'}
 if(currentMatches)goPreview(current.slide+1);
}
async function write(values){if(!authorized())return;try{await transport.patch(values);$('status').textContent='Firebase 상태 저장 완료'}catch(e){$('status').textContent='저장 실패 · 관리자 권한·Database Rules·연결 확인'}}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!transport)return;try{await transport.login($('email').value.trim(),$('password').value);render()}catch(e){$('authStatus').textContent='로그인 실패 · '+(e.code||'Authentication·계정·허용 도메인 확인')}finally{$('password').value=''}});
$('logoutBtn').addEventListener('click',async()=>{if(transport)await transport.logout()});
$('initializeBtn').addEventListener('click',async()=>{try{await transport.initialize();$('status').textContent='수업 상태 시작'}catch(e){$('status').textContent='상태 시작 실패 · Database Rules·권한 확인'}});
$('applyLesson').addEventListener('click',()=>write({lesson:selected,slide:0}));
$('prevBtn').addEventListener('click',()=>{if(allowed())write({slide:current.slide-1})});$('nextBtn').addEventListener('click',()=>{if(allowed())write({slide:current.slide+1})});
$('jumpForm').addEventListener('submit',e=>{e.preventDefault();const n=Number($('jump').value);if(allowed()&&Number.isInteger(n)&&n>=1&&n<=lessons[selected].count)write({slide:n-1})});
for(const [id,key]of [['lockSwitch','locked'],['pdfSwitch','pdf'],['focusSwitch','focus']])$(id).addEventListener('click',()=>{if(authorized())write({[key]:!current[key]})});
for(let id=1;id<=4;id++){const b=document.createElement('button');b.type='button';b.dataset.lesson=id;b.append(document.createTextNode(id+'차시'));const small=document.createElement('small');small.textContent=lessons[id].count+'장 연결';b.append(small);b.addEventListener('click',()=>{selected=id;render();$('status').textContent=id+'차시 미리보기 · 서버 차시 전환은 수업 시작 버튼으로 적용'});$('sessions').append(b)}
$('viewer').addEventListener('load',()=>{try{previewReady=!!$('viewer').contentDocument.getElementById('ctlGo');render()}catch(e){previewReady=false}});
function fullStatus(){const native=!!document.fullscreenElement,fallback=document.querySelector('.preview').classList.contains('expanded-preview');$('fullscreenBtn').textContent=native||fallback?'전체화면 종료':'전체화면';$('fullscreenBtn').setAttribute('aria-pressed',String(native||fallback));}
function exitFallback(){document.querySelector('.preview').classList.remove('expanded-preview');document.body.classList.remove('preview-expanded');fullStatus()}
$('fullscreenBtn').addEventListener('click',async()=>{const panel=document.querySelector('.preview');try{if(document.fullscreenElement){await document.exitFullscreen()}else if(panel.classList.contains('expanded-preview')){exitFallback()}else if(panel.requestFullscreen&&document.fullscreenEnabled){await panel.requestFullscreen()}else{panel.classList.add('expanded-preview');document.body.classList.add('preview-expanded');$('status').textContent='브라우저 전체화면 미지원 · 화면 확대 보기'}fullStatus()}catch(e){panel.classList.add('expanded-preview');document.body.classList.add('preview-expanded');fullStatus();$('status').textContent='브라우저 전체화면 제한 · 화면 확대 보기'}});
document.addEventListener('fullscreenchange',fullStatus);document.addEventListener('keydown',e=>{if(e.key==='Escape')exitFallback()});
render();
import('./sync.js').then(module=>{transport=module.createSync(window.FIREBASE_CONFIG,window.DECK_ID);transport.onAdmin((ok,user,check)=>{admin=ok;authUser=user;authCheck=check.status;authError=check.error;render()});transport.onConnection(on=>{connected=on;render()});transport.onState(s=>{received=true;current=s;if(s&&!s.isEmpty)selected=s.lesson;render()})}).catch(()=>{$('connection').textContent='Firebase 초기화 실패';$('authStatus').textContent='Firebase 설정·네트워크 확인 필요';$('status').textContent='학생 기본 슬라이드 열람 유지'});
