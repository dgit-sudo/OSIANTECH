import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase-client.js';

const instructorTokenStorageKey = 'osian-instructor-token';

const root = document.querySelector('[data-session-page]');
if (!root) {
  // No meeting page.
} else {
  const meetingId = String(root.getAttribute('data-meeting-id') || '').trim();
  const courseTitleFromPage = String(root.getAttribute('data-course-title') || '').trim();
  const instructorNameFromPage = String(root.getAttribute('data-instructor-name') || '').trim();
  const classNoFromPage = String(root.getAttribute('data-class-no') || '').trim();

  const isMobileClient = /android|iphone|ipad|ipod|mobile|windows phone|blackberry|opera mini/i
    .test(String(navigator.userAgent || '').toLowerCase());

  const feedbackEl = document.getElementById('session-feedback');
  const roleEl = document.getElementById('session-role');
  const courseNameEl = document.getElementById('session-course-name');
  const instructorNameEl = document.getElementById('session-instructor-name');
  const classNoEl = document.getElementById('session-class-no');
  const connectionStateEl = document.getElementById('session-connection-state');
  const participantCountEl = document.getElementById('session-participant-count');
  const localVideoEl = document.getElementById('session-local-video');
  const gridEl = document.getElementById('session-video-grid');
  const controlDockEl = document.getElementById('session-control-dock');
  const sidepanelEl = document.getElementById('session-sidepanel');
  const chatPanelEl = document.getElementById('session-chat-panel');

  const toggleMicBtn = document.getElementById('session-toggle-mic');
  const toggleCamBtn = document.getElementById('session-toggle-cam');
  const shareScreenBtn = document.getElementById('session-share-screen');
  const toggleChatBtn = document.getElementById('session-toggle-chat');
  const toggleWhiteboardBtn = document.getElementById('session-toggle-whiteboard');
  const supportBtn = document.getElementById('session-support');
  const leaveBtn = document.getElementById('session-leave');
  const endClassBtn = document.getElementById('session-end-class');
  const moreWrapEl = document.getElementById('session-more-wrap');
  const moreBtn = document.getElementById('session-more-btn');
  const moreMenuEl = document.getElementById('session-more-menu');

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
  let controlsHideTimer = null;
  let moreMenuHideTimer = null;
  let activeSidePanel = '';

  const peers = new Map();
  const remoteVideos = new Map();

  function setConnectionState(label = 'Connecting', tone = 'neutral') {
    if (!connectionStateEl) return;
    connectionStateEl.textContent = label;
    connectionStateEl.className = `session-state-pill session-state-pill--${tone}`;
  }

  function updateParticipantCount() {
    if (!participantCountEl) return;
    const count = remoteVideos.size + 1;
    participantCountEl.textContent = `${count} participant${count === 1 ? '' : 's'}`;
  }

  function setControlButtonState(button, { active = true, tone = 'default', label = '' } = {}) {
    if (!button) return;
    button.classList.toggle('session-control-btn--inactive', !active);
    button.classList.toggle('session-control-btn--danger', tone === 'danger');
    button.classList.toggle('session-control-btn--primary', tone === 'primary');
    if (label) {
      const labelEl = button.querySelector('[data-btn-label]');
      if (labelEl) labelEl.textContent = label;
    }
  }

  function updatePanelButtons() {
    if (toggleChatBtn) toggleChatBtn.classList.toggle('session-control-btn--active', activeSidePanel === 'chat');
    if (toggleWhiteboardBtn) toggleWhiteboardBtn.classList.toggle('session-control-btn--active', activeSidePanel === 'whiteboard');
  }

  function showSidePanel(panelName = '') {
    activeSidePanel = panelName;
    if (sidepanelEl) sidepanelEl.hidden = !panelName;
    if (chatPanelEl) chatPanelEl.hidden = panelName !== 'chat';
    if (whiteboardWrapEl) whiteboardWrapEl.hidden = panelName !== 'whiteboard';
    updatePanelButtons();
  }

  function toggleSidePanel(panelName = '') {
    showSidePanel(activeSidePanel === panelName ? '' : panelName);
  }

  function clearControlsHideTimer() {
    if (!controlsHideTimer) return;
    window.clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }

  function scheduleControlDockAutoHide() {
    if (!controlDockEl) return;
    clearControlsHideTimer();
    controlsHideTimer = window.setTimeout(() => {
      if (moreMenuEl && !moreMenuEl.hidden) return;
      controlDockEl.classList.add('session-control-dock--hidden');
    }, 3500);
  }

  function revealControlDock() {
    if (!controlDockEl) return;
    controlDockEl.classList.remove('session-control-dock--hidden');
    scheduleControlDockAutoHide();
  }

  function clearMoreMenuHideTimer() {
    if (!moreMenuHideTimer) return;
    window.clearTimeout(moreMenuHideTimer);
    moreMenuHideTimer = null;
  }

  function scheduleMoreMenuHide() {
    if (!moreMenuEl) return;
    clearMoreMenuHideTimer();
    moreMenuHideTimer = window.setTimeout(() => {
      moreMenuEl.hidden = true;
      revealControlDock();
    }, 2200);
  }

  function setMoreMenuOpen(open) {
    if (!moreMenuEl) return;
    moreMenuEl.hidden = !open;
    if (open) {
      clearControlsHideTimer();
      clearMoreMenuHideTimer();
      scheduleMoreMenuHide();
      return;
    }
    clearMoreMenuHideTimer();
    scheduleControlDockAutoHide();
  }

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

    // Hide empty-state placeholder once a message arrives
    const emptyEl = document.getElementById('session-chat-empty');
    if (emptyEl) emptyEl.hidden = true;

    const escHtml = (s) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const wrap = document.createElement('div');
    wrap.className = `session-chat-msg ${own ? 'session-chat-msg--own' : 'session-chat-msg--other'}`;
    wrap.innerHTML = `
      <div class="session-chat-bubble">
        ${!own ? `<span class="session-chat-sender">${escHtml(sender)}</span>` : ''}
        <p class="session-chat-text">${escHtml(text)}</p>
        <time class="session-chat-time">${time}</time>
      </div>`;
    chatListEl.appendChild(wrap);
    chatListEl.scrollTop = chatListEl.scrollHeight;
  }

  function upsertRemoteVideo(socketId, label) {
    if (!gridEl) return null;
    if (remoteVideos.has(socketId)) return remoteVideos.get(socketId).video;

    const card = document.createElement('article');
    card.className = 'session-video-card session-video-card--remote';
    card.setAttribute('data-peer', socketId);

    const header = document.createElement('header');
    const title = document.createElement('span');
    title.textContent = label || 'Participant';
    header.appendChild(title);

    const tag = document.createElement('span');
    tag.className = 'session-video-tag';
    tag.textContent = 'Remote';
    header.appendChild(tag);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;

    card.append(header, video);
    gridEl.appendChild(card);
    remoteVideos.set(socketId, { card, video });
    updateParticipantCount();
    return video;
  }

  function removeRemoteVideo(socketId) {
    const record = remoteVideos.get(socketId);
    if (!record) return;
    record.card.remove();
    remoteVideos.delete(socketId);
    updateParticipantCount();
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
      setConnectionState('Connected', 'live');
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
      updateParticipantCount();
    });

    socket.on('session:participant-left', ({ socketId }) => {
      const peer = peers.get(socketId);
      if (peer) {
        peer.close();
        peers.delete(socketId);
      }
      removeRemoteVideo(socketId);
      updateParticipantCount();
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
      setConnectionState('Meeting Ended', 'danger');
      window.setTimeout(() => {
        window.location.replace('/dashboard');
      }, 2500);
    });

    socket.on('disconnect', () => {
      setFeedback('Disconnected from meeting room.', 'error');
      setConnectionState('Disconnected', 'danger');
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
    if (root) {
      root.addEventListener('mousemove', () => revealControlDock());
      root.addEventListener('touchstart', () => revealControlDock(), { passive: true });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = Boolean(moreMenuEl?.hidden);
        setMoreMenuOpen(shouldOpen);
      });
    }

    if (moreWrapEl) {
      moreWrapEl.addEventListener('mouseenter', () => {
        if (!moreMenuEl?.hidden) clearMoreMenuHideTimer();
      });
      moreWrapEl.addEventListener('mouseleave', () => {
        if (!moreMenuEl?.hidden) scheduleMoreMenuHide();
      });
    }

    document.addEventListener('click', (event) => {
      if (!moreMenuEl || moreMenuEl.hidden) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (moreWrapEl && moreWrapEl.contains(target)) return;
      setMoreMenuOpen(false);
    });

    if (toggleMicBtn) {
      toggleMicBtn.addEventListener('click', () => {
        if (!localStream) return;
        const track = localStream.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setControlButtonState(toggleMicBtn, {
          active: track.enabled,
          tone: 'primary',
          label: track.enabled ? 'Mute Mic' : 'Unmute Mic',
        });
      });
    }

    if (toggleChatBtn) {
      toggleChatBtn.addEventListener('click', () => {
        toggleSidePanel('chat');
      });
    }

    if (toggleWhiteboardBtn) {
      toggleWhiteboardBtn.addEventListener('click', () => {
        toggleSidePanel('whiteboard');
      });
    }

    if (toggleCamBtn) {
      toggleCamBtn.addEventListener('click', () => {
        if (!localStream) return;
        const track = localStream.getVideoTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setControlButtonState(toggleCamBtn, {
          active: track.enabled,
          tone: 'primary',
          label: track.enabled ? 'Turn Off Camera' : 'Turn On Camera',
        });
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
            setControlButtonState(shareScreenBtn, { active: true, label: 'Stop Sharing' });

            screenTrack.onended = () => {
              const camTrack = localStream?.getVideoTracks?.()[0] || null;
              peers.forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
                if (sender && camTrack) sender.replaceTrack(camTrack);
              });
              screenStream = null;
              setControlButtonState(shareScreenBtn, { active: true, label: 'Share Screen' });
            };
          } else {
            screenStream.getTracks().forEach((t) => t.stop());
            screenStream = null;
            setControlButtonState(shareScreenBtn, { active: true, label: 'Share Screen' });
          }
        } catch {
          setFeedback('Screen share is not available.', 'error');
        }
      });
    }

    if (supportBtn) {
      supportBtn.addEventListener('click', async () => {
        setMoreMenuOpen(false);
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
        setControlButtonState(supportBtn, { active: true, label: 'Support Requested' });
      });
    }

    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        setMoreMenuOpen(false);

        if (endClassTimer) {
          clearInterval(endClassTimer);
          endClassTimer = null;
        }

        if (socket) {
          socket.disconnect();
          socket = null;
        }

        peers.forEach((pc) => {
          try { pc.close(); } catch {}
        });
        peers.clear();

        if (screenStream) {
          screenStream.getTracks().forEach((track) => {
            try { track.stop(); } catch {}
          });
          screenStream = null;
        }

        if (localStream) {
          localStream.getTracks().forEach((track) => {
            try { track.stop(); } catch {}
          });
          localStream = null;
        }

        remoteVideos.forEach((record) => {
          if (record?.card) record.card.remove();
        });
        remoteVideos.clear();

        if (localVideoEl) localVideoEl.srcObject = null;
        updateParticipantCount();
        setFeedback('You left the call. Rejoin anytime from your dashboard.', 'info');

        const redirectPath = myRole === 'instructor' ? '/instructor' : '/dashboard';
        window.setTimeout(() => {
          window.location.replace(redirectPath);
        }, 250);
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
        setMoreMenuOpen(false);
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
      if (isMobileClient) {
        throw new Error('Session room is available on desktop/laptop only.');
      }

      accessPayload = await fetchAccess();
      myRole = accessPayload.role;

      if (roleEl) roleEl.textContent = myRole.toUpperCase();
      setConnectionState('Joining...', 'neutral');
      if (courseNameEl) {
        courseNameEl.textContent = accessPayload?.meeting?.courseTitle
          || courseTitleFromPage
          || accessPayload?.meeting?.courseSlug
          || '-';
      }
      if (instructorNameEl) {
        instructorNameEl.textContent = accessPayload?.meeting?.instructorName || instructorNameFromPage || '-';
      }
      if (classNoEl) {
        classNoEl.textContent = String(accessPayload?.meeting?.classNo || classNoFromPage || '1');
      }

      if (whiteboardWrapEl) {
        whiteboardWrapEl.hidden = true;
      }
      if (whiteboardClearBtn && myRole !== 'instructor') {
        whiteboardClearBtn.hidden = true;
      }
      if (endClassBtn) {
        endClassBtn.hidden = !(myRole === 'instructor');
        endClassBtn.disabled = !Boolean(accessPayload?.permissions?.canEndClass);
      }
      if (toggleWhiteboardBtn && myRole !== 'instructor') {
        toggleWhiteboardBtn.hidden = true;
      }

      await setupLocalMedia();
      updateParticipantCount();
      setControlButtonState(toggleMicBtn, { active: true, tone: 'primary', label: 'Mute Mic' });
      setControlButtonState(toggleCamBtn, { active: true, tone: 'primary', label: 'Turn Off Camera' });
      setControlButtonState(shareScreenBtn, { active: true, label: 'Share Screen' });
      setControlButtonState(supportBtn, { active: true, label: 'Raise Technical Support' });
      showSidePanel('');
      revealControlDock();
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
