let uid, chatId = null, partnerId = null, queueRef, chatRef;

const chatWindow = document.getElementById('chat-window');
const input = document.getElementById('input');
const statusDiv = document.getElementById('status');

function appendMsg(msg, self=false) {
  chatWindow.innerHTML += `
    <div style="text-align:${self ? 'right':'left'};">
      <span style="background:${self?'#4286f4':'#e2e3e5'};color:${self?'#fff':'#111'};padding:7px 14px;border-radius:16px;">
        ${msg}
      </span>
    </div>
  `;
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function resetChat() {
  chatId = partnerId = null;
  chatWindow.innerHTML = '';
  statusDiv.textContent = "Looking for partner...";
}

document.getElementById('nextBtn').onclick = () => {
  endChat();
  startMatchmaking();
};

document.getElementById('backBtn').onclick = () => {
  // Optionally, cache previous chatId for "go back" feature.
};

document.getElementById('reportBtn').onclick = () => {
  if(partnerId && chatId){
    db.ref('reports').push({ from:uid, against:partnerId, chat:chatId, ts:Date.now() });
    endChat();
    alert("User reported. We'll review for inappropriate content.");
    startMatchmaking();
  }
};

input.addEventListener('keydown', e => {
  if(e.key === "Enter" && input.value.trim() && chatId) {
    db.ref('chats/'+chatId+'/messages').push({from:uid,text:input.value,ts:Date.now()});
    input.value = '';
  }
});

function endChat() {
  if(chatRef) chatRef.off();
  if(chatId) db.ref('chats/'+chatId).update({ended:true});
  resetChat();
}

function startMatchmaking() {
  resetChat();
  // Add to matchmaking queue
  queueRef = db.ref('queue').push({uid, ts:Date.now()});
  statusDiv.textContent = "Finding a stranger...";
  // Try to find a partner
  db.ref('queue').once('value', snap => {
    let found = false, entries = snap.val();
    for(let k in entries) {
      if(entries[k].uid !== uid) {
        // Found another user
        partnerId = entries[k].uid;
        found = true;
        // Remove both from queue
        db.ref('queue/'+k).remove();
        queueRef.remove();
        // Create chat room
        chatId = db.ref('chats').push({users:[uid,partnerId],ts:Date.now()}).key;
        break;
      }
    }
    if(!found) {
      // Wait to be matched (listener)
      queueRef.onDisconnect().remove();
      db.ref('queue').on('child_removed', tryMatchAgain);
    } else {
      startChat();
    }
  });
}

function tryMatchAgain(snap) {
  if(!chatId && !partnerId) startMatchmaking();
}
function startChat() {
  statusDiv.textContent = "Chatting with stranger.";
  chatRef = db.ref('chats/'+chatId+'/messages');
  chatRef.on('child_added', snap => {
    let msg = snap.val();
    appendMsg(msg.text, msg.from === uid);
  });
}

// Firebase anonymous login
auth.signInAnonymously().then(cred => {
  uid = cred.user.uid;
  startMatchmaking();
});
