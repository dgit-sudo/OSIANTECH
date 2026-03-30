import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const instructorTokenStorageKey = 'osian-instructor-token';

const root = document.querySelector('[data-session-page]');
if (!root) {
  // No meeting page.
} else {
  const meetingId = String(root.getAttribute('data-meeting-id') || '').trim();

  const feedbackEl = document.getElementById('session-feedback');
  const roleEl = document.getElementById('session-role');
  const metaEl = document.getElementById('session-meta');
  const localVideoEl = document.getElementById('session-local-video');
  const gridEl = document.getElementById('session-video-grid');

  const toggleMicBtn = document.getElementById('session-toggle-mic');
  const toggleCamBtn = document.getElementById('session-toggle-cam');
  const shareScreenBtn = document.getElementById('session-share-screen');
  const supportBtn = document.getElementById('session-support');
  const endClassBtn = document.getElementById('session-end-class');

  const chatListEl = document.getElementById('session-chat-list');
  const chatForm = document.getElementById('session-chat-form');
  const chatInput = document.getElementById('session-chat-input');

  const whiteboardWrapEl = document.getElementById('session-whiteboard-wrap');
  const whiteboardEl = document.getElementById('session-whiteboard');
  const whiteboardClearBtn = document.getElementById('session-whiteboard-clear');

  let myRole = '';
  let authHeaders = {};
  let socket = null;
  let localStream = null;
  let screenStream = null;
  let accessPayload = null;
  let drawing = false;
  let endClassTimer = null;

  const peers = new Map();
  const remoteVideos = new Map();

  function setFeedback(message = '', type = 'info') {
    if (!feedbackEl) return;
    if (!message) {
      feedbackEl.className = 'auth-feedback';
      feedbackEl.textContent = '';
      return;
    }
    feedbackEl.className = `auth-feedback auth-feedback-${type}`;
    feedbackEl.textContent = message;
  }

  function addChatMessage(sender, text, own = false) {
    if (!chatListEl) return;
    const wrap = document.createElement('div');
    wrap.className = `support-msg ${own ? 'support-msg-admin' : 'support-msg-user'}`;
    wrap.innerHTML = `<div class="support-msg-text"><strong>${sender}:</strong> ${text}</div>`;
    chatListEl.appendChild(wrap);
    chatListEl.scrollTop = chatListEl.scrollHeight;
  }

  function upsertRemoteVideo(socketId, label) {
    if (!gridEl) return null;
    if (remoteVideos.has(socketId)) return remoteVideos.get(socketId).video;

    const card = document.createElement('article');
    card.className = 'session-video-card';
    card.setAttribute('data-peer', socketId);

    const header = document.createElement('header');
    const title = document.createElement('span');
    title.textContent = label || 'Participant';
    header.appendChild(title);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;

    card.append(header, video);
    gridEl.appendChild(card);
    remoteVideos.set(socketId, { card, video });
    return video;
  }

  function removeRemoteVideo(socketId) {
    const record = remoteVideos.get(socketId);
    if (!record) return;
    record.card.remove();
    remoteVideos.delete(socketId);
  }

  async function getAuthHeaders() {
    const instructorToken = String(window.localStorage.getItem(instructorTokenStorageKey) || '').trim();
    if (instructorToken) {
      return { 'X-Instructor-Token': instructorToken };
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        return { Authorization: `Bearer ${idToken}` };
      }
    }

    return {};
  }

  async function fetchAccess() {
    authHeaders = await getAuthHeaders();
    const response = await fetch(`/api/session/${encodeURIComponent(meetingId)}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Access denied.');
    }
    return payload;
  }

  async function setupLocalMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoEl) localVideoEl.srcObject = localStream;
  }

  function createPeer(socketId, initiator, peerMeta = {}) {
    if (peers.has(socketId)) return peers.get(socketId);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('session:signal', {
          to: socketId,
          type: 'ice',
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const video = upsertRemoteVideo(socketId, peerMeta?.name || 'Participant');
      if (video && event.streams[0]) {
        video.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        pc.close();
        peers.delete(socketId);
        removeRemoteVideo(socketId);
      }
    };

    peers.set(socketId, pc);

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (!socket) return;
          socket.emit('session:signal', {
            to: socketId,
            type: 'offer',
            sdp: pc.localDescription,
          });
        })
        .catch(() => {
          setFeedback('Could not start media handshake.', 'error');
        });
    }

    return pc;
  }

  async function handleSignal({ from, type, sdp, candidate, participant }) {
    const pc = createPeer(from, false, participant);

    if (type === 'offer' && sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('session:signal', {
        to: from,
        type: 'answer',
        sdp: pc.localDescription,
      });
      return;
    }

    if (type === 'answer' && sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      return;
    }

    if (type === 'ice' && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore stale ICE candidates.
      }
    }
  }

  function setupSocket(socketToken) {
    socket = io({
      auth: {
        token: socketToken,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('session:join');
      setFeedback('Connected to live class.', 'success');
    });

    socket.on('session:participants', (participants = []) => {
      participants.forEach((participant) => {
        if (!participant?.socketId || participant.socketId === socket.id) return;
        createPeer(participant.socketId, true, participant);
      });
    });

    socket.on('session:participant-joined', (participant) => {
      if (!participant?.socketId || participant.socketId === socket.id) return;
      createPeer(participant.socketId, true, participant);
      addChatMessage('System', `${participant.name || 'Participant'} joined the class`);
    });

    socket.on('session:participant-left', ({ socketId }) => {
      const peer = peers.get(socketId);
      if (peer) {
        peer.close();
        peers.delete(socketId);
      }
      removeRemoteVideo(socketId);
    });

    socket.on('session:signal', (payload) => {
      handleSignal(payload).catch(() => {
        // Ignore signaling failures to keep room alive.
      });
    });

    socket.on('session:chat', (payload) => {
      const sender = payload?.sender || 'Participant';
      const text = String(payload?.message || '').trim();
      if (!text) return;
      addChatMessage(sender, text, false);
    });

    socket.on('session:whiteboard', (payload) => {
      if (!whiteboardEl || myRole === 'instructor') return;
      const ctx = whiteboardEl.getContext('2d');
      if (!ctx) return;
      if (payload?.type === 'clear') {
        ctx.clearRect(0, 0, whiteboardEl.width, whiteboardEl.height);
        return;
      }
      if (payload?.type === 'draw') {
        ctx.strokeStyle = '#8b75d7';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(payload.fromX, payload.fromY);
        ctx.lineTo(payload.toX, payload.toY);
        ctx.stroke();
      }
    });

    socket.on('session:ended', () => {
      setFeedback('Class ended by instructor.', 'info');
      window.setTimeout(() => {
        window.location.replace('/dashboard');
      }, 2500);
    });

    socket.on('disconnect', () => {
      setFeedback('Disconnected from meeting room.', 'error');
    });
  }

  function setupWhiteboard() {
    if (!whiteboardEl || myRole !== 'instructor') return;
    whiteboardWrapEl.hidden = false;

    const ctx = whiteboardEl.getContext('2d');
    if (!ctx) return;

    function getPos(event) {
      const rect = whiteboardEl.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * whiteboardEl.width,
        y: ((clientY - rect.top) / rect.height) * whiteboardEl.height,
      };
    }

    let prev = null;

    const startDraw = (event) => {
      drawing = true;
      prev = getPos(event);
    };

    const draw = (event) => {
      if (!drawing || !prev) return;
      const next = getPos(event);
      ctx.strokeStyle = '#8b75d7';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();

      if (socket) {
        socket.emit('session:whiteboard', {
          type: 'draw',
          fromX: prev.x,
          fromY: prev.y,
          toX: next.x,
          toY: next.y,
        });
      }

      prev = next;
    };

    const stopDraw = () => {
      drawing = false;
      prev = null;
    };

    whiteboardEl.addEventListener('mousedown', startDraw);
    whiteboardEl.addEventListener('mousemove', draw);
    whiteboardEl.addEventListener('mouseup', stopDraw);
    whiteboardEl.addEventListener('mouseleave', stopDraw);

    whiteboardEl.addEventListener('touchstart', (event) => {
      event.preventDefault();
      startDraw(event);
    }, { passive: false });

    whiteboardEl.addEventListener('touchmove', (event) => {
      event.preventDefault();
      draw(event);
    }, { passive: false });

    whiteboardEl.addEventListener('touchend', stopDraw);

    if (whiteboardClearBtn) {
      whiteboardClearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, whiteboardEl.width, whiteboardEl.height);
        if (socket) socket.emit('session:whiteboard', { type: 'clear' });
      });
    }
  }

  function setupControls() {
    if (toggleMicBtn) {
      toggleMicBtn.addEventListener('click', () => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        toggleMicBtn.textContent = track.enabled ? 'Mute Mic' : 'Unmute Mic';
      });
    }

    if (toggleCamBtn) {
      toggleCamBtn.addEventListener('click', () => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        toggleCamBtn.textContent = track.enabled ? 'Turn Off Camera' : 'Turn On Camera';
      });
    }

    if (shareScreenBtn) {
      shareScreenBtn.addEventListener('click', async () => {
        try {
          if (!screenStream) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            peers.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
              if (sender) sender.replaceTrack(screenTrack);
            });
            shareScreenBtn.textContent = 'Stop Sharing';

            screenTrack.onended = () => {
              const camTrack = localStream?.getVideoTracks?.()[0] || null;
              peers.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
                if (sender && camTrack) sender.replaceTrack(camTrack);
              });
              screenStream = null;
              shareScreenBtn.textContent = 'Share Screen';
            };
          } else {
            screenStream.getTracks().forEach((t) => t.stop());
            screenStream = null;
            shareScreenBtn.textContent = 'Share Screen';
          }
        } catch {
          setFeedback('Screen share is not available.', 'error');
        }
      });
    }

    if (supportBtn) {
      supportBtn.addEventListener('click', async () => {
        if (socket) socket.emit('session:support-request');
        const response = await fetch(`/api/session/${encodeURIComponent(meetingId)}/support`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({}),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setFeedback(payload?.error || 'Could not raise support alert.', 'error');
          return;
        }
        setFeedback('Technical support alert sent to admin.', 'success');
      });
    }

    if (chatForm) {
      chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = String(chatInput?.value || '').trim();
        if (!message || !socket) return;
        socket.emit('session:chat', { message });
        addChatMessage('You', message, true);
        chatInput.value = '';
      });
    }

    if (endClassBtn) {
      endClassBtn.addEventListener('click', async () => {
        const response = await fetch(`/api/session/${encodeURIComponent(meetingId)}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({}),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          setFeedback(payload?.error || 'Could not end class yet.', 'error');
          return;
        }

        if (socket) socket.emit('session:end-class');
        setFeedback('Class ended successfully.', 'success');
        window.setTimeout(() => window.location.replace('/instructor'), 1200);
      });
    }
  }

  function scheduleEndClassUnlock() {
    if (!endClassBtn || myRole !== 'instructor' || !accessPayload?.meeting?.endsAt) return;
    const endAt = new Date(accessPayload.meeting.endsAt);
    if (Number.isNaN(endAt.getTime())) return;

    const update = () => {
      endClassBtn.disabled = Date.now() < endAt.getTime();
    };

    update();
    if (endClassTimer) clearInterval(endClassTimer);
    endClassTimer = setInterval(update, 15000);
  }

  async function bootstrap() {
    try {
      accessPayload = await fetchAccess();
      myRole = accessPayload.role;

      if (roleEl) roleEl.textContent = myRole.toUpperCase();
      if (metaEl) {
        const startsAt = accessPayload?.meeting?.startsAt ? new Date(accessPayload.meeting.startsAt) : null;
        const endsAt = accessPayload?.meeting?.endsAt ? new Date(accessPayload.meeting.endsAt) : null;
        const when = startsAt && !Number.isNaN(startsAt.getTime())
          ? `${startsAt.toLocaleString()} - ${endsAt ? endsAt.toLocaleTimeString() : ''}`
          : 'Class session';
        metaEl.textContent = `Class ${accessPayload?.meeting?.classNo || 1} • ${when}`;
      }

      if (whiteboardWrapEl) {
        whiteboardWrapEl.hidden = myRole !== 'instructor';
      }
      if (endClassBtn) {
        endClassBtn.hidden = !(myRole === 'instructor');
        endClassBtn.disabled = !Boolean(accessPayload?.permissions?.canEndClass);
      }

      await setupLocalMedia();
      setupControls();
      scheduleEndClassUnlock();
      setupWhiteboard();
      setupSocket(accessPayload.socketToken);
    } catch (error) {
      setFeedback(error?.message || 'Unable to access this meeting.', 'error');
      window.setTimeout(() => {
        window.location.replace('/404');
      }, 2500);
    }
  }

  onAuthStateChanged(auth, () => {
    if (!meetingId) {
      setFeedback('Invalid meeting id.', 'error');
      return;
    }
    bootstrap();
  });
}
