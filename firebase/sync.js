// Existing decks/{deck}/state, 0-based slide, admins/{uid} authorization reused.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getDatabase,ref,onValue,update,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import {getAuth,signInWithEmailAndPassword,signOut,onAuthStateChanged,setPersistence,browserSessionPersistence} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
export function isConfigured(c){return !!(c?.apiKey&&c.databaseURL&&c.projectId)}
export function validState(s){return !!s&&Number.isInteger(s.lesson)&&s.lesson>=1&&s.lesson<=4&&Number.isInteger(s.slide)&&s.slide>=0&&s.slide<1000&&s.slide<({1:31,2:32,3:32,4:32}[s.lesson])&&['locked','pdf','focus'].every(k=>typeof s[k]==='boolean')}
export function createSync(config,deckId){
 const app=getApps().find(a=>a.name==='vibe4-classroom')||initializeApp(config,'vibe4-classroom');
 const db=getDatabase(app),auth=getAuth(app),stateRef=ref(db,'decks/'+deckId+'/state');
 let connected=false,isAdmin=false,user=null,known=false,current=null,authGeneration=0;
 const stateListeners=new Set(),adminListeners=new Set(),connectionListeners=new Set();
 let adminOff=null;
 const emitAdmin=()=>adminListeners.forEach(cb=>cb(isAdmin,user));
 const stateOff=onValue(stateRef,s=>{known=true;current=s.val();stateListeners.forEach(cb=>cb(current===null?{isEmpty:true}:validState(current)?{...current,isEmpty:false}:null))},()=>{known=false;current=null;stateListeners.forEach(cb=>cb(null))});
 const connectionOff=onValue(ref(db,'.info/connected'),s=>{connected=s.val()===true;connectionListeners.forEach(cb=>cb(connected))},()=>{connected=false;connectionListeners.forEach(cb=>cb(false))});
 const authOff=onAuthStateChanged(auth,u=>{authGeneration++;const generation=authGeneration;if(adminOff){adminOff();adminOff=null}user=u;isAdmin=false;emitAdmin();if(u)adminOff=onValue(ref(db,'admins/'+u.uid),s=>{if(generation!==authGeneration)return;isAdmin=s.val()===true;emitAdmin()},()=>{if(generation!==authGeneration)return;isAdmin=false;emitAdmin()})});
 function writable(){if(!user||!isAdmin)throw Error('not-admin');if(!connected)throw Error('offline');if(!known)throw Error('state-unread')}
 return {
  onState(cb){stateListeners.add(cb);if(known)cb(current===null?{isEmpty:true}:validState(current)?{...current,isEmpty:false}:null);return()=>stateListeners.delete(cb)},
  onConnection(cb){connectionListeners.add(cb);cb(connected);return()=>connectionListeners.delete(cb)},
  onAdmin(cb){adminListeners.add(cb);cb(isAdmin,user);return()=>adminListeners.delete(cb)},
  async login(email,password){await setPersistence(auth,browserSessionPersistence);return signInWithEmailAndPassword(auth,email,password)},
  logout(){return signOut(auth)},
  async initialize(){writable();if(current!==null)throw Error('state-exists');return runTransaction(stateRef,s=>s===null?{lesson:1,slide:0,locked:true,pdf:true,focus:false,updatedAt:serverTimestamp()}:undefined,{applyLocally:false})},
  async patch(values){writable();if(!validState(current))throw Error('state-invalid');const allowed=['lesson','slide','locked','pdf','focus'];if(Object.keys(values).some(k=>!allowed.includes(k))||!validState({...current,...values}))throw Error('invalid-state');return update(stateRef,{...values,updatedAt:serverTimestamp()})},
  setSlide(n){return this.patch({slide:n})},setLock(on){return this.patch({locked:on})},setPdf(on){return this.patch({pdf:on})},setFocus(on){return this.patch({focus:on})},
  close(){stateOff();connectionOff();authOff();if(adminOff)adminOff();stateListeners.clear();adminListeners.clear();connectionListeners.clear()}
 };
}
