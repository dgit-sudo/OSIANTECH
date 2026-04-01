const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const assetVersion = String(
  process.env.ASSET_VERSION
  || process.env.RENDER_GIT_COMMIT
  || process.env.GITHUB_SHA
  || Date.now(),
);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.assetVersion = assetVersion;

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
const indexRouter = require('./routes/index');
const coursesRouter = require('./routes/courses');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const profileRouter = require('./routes/profile');
const adminRouter = require('./routes/admin');
const supportRouter = require('./routes/support');
const instructorRouter = require('./routes/instructor');
const sessionRouter = require('./routes/session');
const {
  getMeetingById,
  verifySessionAccessToken,
  markMeetingSupportRequested,
  endMeeting,
} = require('./lib/session-core');

app.use('/', indexRouter);
app.use('/courses', coursesRouter);
app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);
app.use('/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/instructor', instructorRouter);
app.use('/', sessionRouter);

const roomParticipants = new Map();

function participantNameFromRole(role, identity) {
  if (role === 'instructor') return 'Instructor';
  if (role === 'admin') return 'Support/Admin';
  if (role === 'learner') return 'Learner';
  return identity || 'Participant';
}

io.use(async (socket, next) => {
  try {
    const token = String(socket.handshake?.auth?.token || '').trim();
    const payload = verifySessionAccessToken(token);
    if (!payload?.mid || !payload?.role) {
      return next(new Error('Unauthorized.'));
    }

    const meeting = await getMeetingById(payload.mid);
    if (!meeting || meeting.endedAt) {
      return next(new Error('Meeting not active.'));
    }

    const endsAt = meeting.endsAt ? new Date(meeting.endsAt) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime()) || Date.now() > endsAt.getTime()) {
      return next(new Error('Meeting expired.'));
    }

    socket.data.meetingId = meeting.meetingId;
    socket.data.role = payload.role;
    socket.data.identity = String(payload.identity || '');
    socket.data.participant = {
      socketId: socket.id,
      role: payload.role,
      name: participantNameFromRole(payload.role, payload.identity),
    };
    return next();
  } catch {
    return next(new Error('Unauthorized.'));
  }
});

io.on('connection', (socket) => {
  const meetingId = socket.data.meetingId;
  const participant = socket.data.participant;
  const roomKey = `session:${meetingId}`;

  socket.on('session:join', () => {
    socket.join(roomKey);
    const current = roomParticipants.get(roomKey) || new Map();
    current.set(socket.id, participant);
    roomParticipants.set(roomKey, current);

    const others = [...current.values()].filter((p) => p.socketId !== socket.id);
    socket.emit('session:participants', others);
    socket.to(roomKey).emit('session:participant-joined', participant);
  });

  socket.on('session:signal', (payload = {}) => {
    const to = String(payload.to || '').trim();
    if (!to) return;
    io.to(to).emit('session:signal', {
      from: socket.id,
      type: payload.type,
      sdp: payload.sdp || null,
      candidate: payload.candidate || null,
      participant,
    });
  });

  socket.on('session:chat', (payload = {}) => {
    const message = String(payload.message || '').trim().slice(0, 500);
    if (!message) return;
    io.to(roomKey).emit('session:chat', {
      sender: participant.name,
      role: participant.role,
      message,
      at: new Date().toISOString(),
    });
  });

  socket.on('session:whiteboard', (payload = {}) => {
    if (socket.data.role !== 'instructor') return;
    io.to(roomKey).emit('session:whiteboard', payload);
  });

  socket.on('session:support-request', async () => {
    try {
      await markMeetingSupportRequested(meetingId, socket.data.role);
      io.to(roomKey).emit('session:chat', {
        sender: 'System',
        role: 'system',
        message: 'Technical support was requested. Admin has been notified.',
        at: new Date().toISOString(),
      });
    } catch {
      // Ignore support notification errors.
    }
  });

  socket.on('session:end-class', async () => {
    if (socket.data.role !== 'instructor') return;
    try {
      await endMeeting(meetingId, {
        role: 'instructor',
        instructorUid: socket.data.identity,
      });
      io.to(roomKey).emit('session:ended', { by: 'instructor', at: new Date().toISOString() });
      setTimeout(() => {
        io.in(roomKey).disconnectSockets(true);
        roomParticipants.delete(roomKey);
      }, 1000);
    } catch {
      socket.emit('session:chat', {
        sender: 'System',
        role: 'system',
        message: 'Class cannot be ended before scheduled end time.',
        at: new Date().toISOString(),
      });
    }
  });

  socket.on('disconnect', () => {
    const current = roomParticipants.get(roomKey);
    if (!current) return;
    current.delete(socket.id);
    if (current.size === 0) {
      roomParticipants.delete(roomKey);
      return;
    }
    roomParticipants.set(roomKey, current);
    socket.to(roomKey).emit('session:participant-left', { socketId: socket.id });
  });
});

// Compatibility redirects for legacy auth links.
app.get('/enroll', (_req, res) => res.redirect('/auth?mode=signup'));
app.get('/signup', (_req, res) => res.redirect('/auth?mode=signup'));
app.get('/signin', (_req, res) => res.redirect('/auth?mode=signin'));
app.get('/checkout', (req, res) => {
  const id = Number.parseInt(String(req.query.courseId || ''), 10);
  if (Number.isFinite(id) && id > 0) {
    return res.redirect(`/courses/${id}/checkout`);
  }
  return res.redirect('/courses');
});
app.get('/checkout/:id', (req, res) => {
  const id = Number.parseInt(String(req.params.id || ''), 10);
  if (Number.isFinite(id) && id > 0) {
    return res.redirect(`/courses/${id}/checkout`);
  }
  return res.redirect('/courses');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found', page: '' });
});

server.listen(PORT, () => {
  console.log(`Osian Academy running at http://localhost:${PORT}`);
});

module.exports = app;
