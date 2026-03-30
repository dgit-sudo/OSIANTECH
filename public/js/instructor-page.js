const tokenStorageKey = 'osian-instructor-token';

const root = document.querySelector('[data-instructor-page]');
if (!root) {
  // No instructor page loaded.
} else {
  const signinForm = document.getElementById('instructor-signin-form');
  const emailInput = document.getElementById('instructor-email');
  const passwordInput = document.getElementById('instructor-password');
  const authCard = document.getElementById('instructor-auth-card');
  const dashboardEl = document.getElementById('instructor-dashboard');
  const feedbackEl = document.getElementById('instructor-feedback');
  const signoutBtn = document.getElementById('instructor-signout-btn');
  const nameEl = document.getElementById('instructor-name');
  const emailCopyEl = document.getElementById('instructor-email-copy');
  const availabilityEl = document.getElementById('instructor-availability');
  const classesEl = document.getElementById('instructor-classes');

  let refreshTimer = null;

  function getToken() {
    return String(window.localStorage.getItem(tokenStorageKey) || '').trim();
  }

  function setToken(token = '') {
    if (!token) {
      window.localStorage.removeItem(tokenStorageKey);
      return;
    }
    window.localStorage.setItem(tokenStorageKey, token);
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

  function formatWhen(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  function showSignedOut() {
    if (authCard) authCard.hidden = false;
    if (dashboardEl) dashboardEl.hidden = true;
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function showSignedIn() {
    if (authCard) authCard.hidden = true;
    if (dashboardEl) dashboardEl.hidden = false;
  }

  function renderAvailability(slots = []) {
    if (!availabilityEl) return;
    if (!slots.length) {
      availabilityEl.textContent = 'No availability configured by admin yet.';
      return;
    }

    availabilityEl.innerHTML = slots
      .map((slot) => {
        if (slot.slotDate) {
          return `<div>${slot.slotDate}: ${slot.startTime} - ${slot.endTime} IST</div>`;
        }
        return `<div>${slot.weekdayLabel}: ${slot.startTime} - ${slot.endTime} IST</div>`;
      })
      .join('');
  }

  function renderClasses(classes = []) {
    if (!classesEl) return;
    classesEl.innerHTML = '';

    if (!classes.length) {
      classesEl.textContent = 'No class activations yet.';
      return;
    }

    const frag = document.createDocumentFragment();
    classes.forEach((item) => {
      const classNo = Number(item?.classNo || 1);
      const classStart = item?.selectedClassStartAt ? new Date(item.selectedClassStartAt) : null;
      const classEnd = item?.selectedClassEndAt
        ? new Date(item.selectedClassEndAt)
        : (classStart && !Number.isNaN(classStart.getTime())
          ? new Date(classStart.getTime() + (60 * 60 * 1000))
          : null);
      const hasClassTime = classStart && !Number.isNaN(classStart.getTime());
      const nowMs = Date.now();
      const joinWindowStart = hasClassTime ? classStart.getTime() - (30 * 60 * 1000) : Number.NaN;
      const joinWindowEnd = classEnd && !Number.isNaN(classEnd.getTime()) ? classEnd.getTime() : Number.NaN;
      const showJoinNow = hasClassTime
        && nowMs >= joinWindowStart
        && nowMs <= joinWindowEnd
        && item?.status === 'activated'
        && !item?.noGoodTimeslot;

      const wrap = document.createElement('div');
      wrap.className = 'support-msg support-msg-admin';
      wrap.innerHTML = `
        <div class="support-msg-text"><strong>${item.courseTitle || 'Course'}</strong> - ${item.userName || item.userEmail || item.uid}</div>
        <div class="support-msg-text">Class No: ${classNo}</div>
        <div class="support-msg-text">Slot: ${item.timeslotLabel || 'User requested manual slot'}</div>
        <div class="support-msg-text">Status: ${item.status || '-'}</div>
        <div class="support-msg-time">Requested: ${formatWhen(item.requestedAt)} | Next class: ${formatWhen(item.nextClassAt)}</div>
      `;

      if (showJoinNow) {
        const joinBtn = document.createElement('button');
        joinBtn.type = 'button';
        joinBtn.className = 'dashboard-course-action-btn';
        joinBtn.title = 'Join live class room';
        joinBtn.textContent = `Join Now (Class ${classNo})`;
        joinBtn.addEventListener('click', () => {
          joinBtn.disabled = true;
          getInstructorJoinLink(item)
            .then((url) => {
              window.location.href = url;
            })
            .catch((error) => {
              setFeedback(error?.message || 'Could not open class room.', 'error');
              joinBtn.disabled = false;
            });
        });
        wrap.appendChild(joinBtn);
      }
      frag.appendChild(wrap);
    });

    classesEl.appendChild(frag);
  }

  async function fetchMe() {
    const token = getToken();
    if (!token) throw new Error('No token');

    const response = await fetch('/instructor/api/me', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not load instructor profile.');
    }
    return payload;
  }

  async function fetchClasses() {
    const token = getToken();
    if (!token) throw new Error('No token');

    const response = await fetch('/instructor/api/classes/upcoming', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || 'Could not load class notifications.');
    }
    return payload;
  }

  async function getInstructorJoinLink(item) {
    const token = getToken();
    if (!token) throw new Error('Session expired. Please sign in again.');

    const response = await fetch('/api/session/instructor/join-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        courseId: item?.courseId,
        learnerUid: item?.uid,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || !payload?.joinUrl) {
      throw new Error(payload?.error || 'Join link is not available yet.');
    }

    return payload.joinUrl;
  }

  async function refreshDashboard() {
    const me = await fetchMe();
    const classes = await fetchClasses();

    if (nameEl) nameEl.textContent = me.instructor?.displayName || 'Instructor';
    if (emailCopyEl) emailCopyEl.textContent = me.instructor?.email || '';
    renderAvailability(Array.isArray(me.availability) ? me.availability : []);
    renderClasses(Array.isArray(classes.classes) ? classes.classes : []);
  }

  async function signIn(email, password) {
    const response = await fetch('/instructor/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || !payload?.token) {
      throw new Error(payload?.error || 'Sign in failed.');
    }

    setToken(payload.token);
    showSignedIn();
    await refreshDashboard();
    setFeedback('Signed in successfully.', 'success');

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      refreshDashboard().catch(() => {
        // Silent background refresh errors.
      });
    }, 10000);
  }

  if (signinForm) {
    signinForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = String(emailInput?.value || '').trim();
      const password = String(passwordInput?.value || '');
      if (!email || !password) {
        setFeedback('Email and password are required.', 'error');
        return;
      }

      setFeedback('Signing in...', 'info');
      signIn(email, password).catch((error) => {
        setFeedback(error?.message || 'Could not sign in.', 'error');
      });
    });
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      setToken('');
      showSignedOut();
      setFeedback('Signed out.', 'info');
    });
  }

  const token = getToken();
  if (!token) {
    showSignedOut();
  } else {
    showSignedIn();
    refreshDashboard()
      .then(() => {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
          refreshDashboard().catch(() => {
            // Silent background refresh errors.
          });
        }, 10000);
      })
      .catch(() => {
        setToken('');
        showSignedOut();
        setFeedback('Session expired. Please sign in again.', 'error');
      });
  }
}
