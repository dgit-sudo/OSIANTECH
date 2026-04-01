const express = require('express');

const {
  ensureSessionTables,
  resolveActorFromRequest,
  getLearnerActivation,
  getInstructorActivation,
  createMeetingFromActivation,
  getMeetingById,
  getJoinUrl,
  authorizeMeetingActor,
  createSessionAccessToken,
  markMeetingSupportRequested,
  listOngoingMeetings,
  endMeeting,
  canOpenJoinWindow,
} = require('../lib/session-core');

const router = express.Router();

function isMobileRequest(req) {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  const chMobile = String(req.headers['sec-ch-ua-mobile'] || '').trim();
  if (chMobile === '?1') return true;
  return /android|iphone|ipad|ipod|mobile|windows phone|blackberry|opera mini/i.test(ua);
}

router.get('/session/:courseSlug/:meetingId', async (req, res) => {
  if (isMobileRequest(req)) {
    return res.status(403).send('Session room is available on desktop/laptop only.');
  }

  const meetingId = String(req.params.meetingId || '').trim();
  const courseSlug = String(req.params.courseSlug || '').trim();

  try {
    await ensureSessionTables();
    const meeting = await getMeetingById(meetingId);
    if (!meeting || meeting.courseSlug !== courseSlug || meeting.endedAt) {
      return res.status(404).render('404', { title: '404 - Session Not Found', page: '' });
    }

    return res.render('session-room', {
      title: 'Live Session - Osian Academy',
      page: 'session-room',
      meetingId,
      courseSlug,
      courseTitle: meeting.courseTitle || courseSlug,
      instructorName: meeting.instructorName || meeting.instructorUid,
      classNo: Number(meeting.classNo || 1),
    });
  } catch {
    return res.status(404).render('404', { title: '404 - Session Not Found', page: '' });
  }
});

router.post('/api/session/learner/join-link', async (req, res) => {
  try {
    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor || actor.role !== 'learner' || !actor.uid) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const courseId = Number.parseInt(String(req.body?.courseId || ''), 10);
    const activation = await getLearnerActivation(actor.uid, courseId);
    if (!activation) {
      return res.status(404).json({ error: 'No joinable class found for this course.' });
    }

    if (!canOpenJoinWindow(activation.startsAt, activation.endsAt)) {
      return res.status(403).json({ error: 'Join link becomes available 30 minutes before class.' });
    }

    const meeting = await createMeetingFromActivation(activation);
    return res.json({
      ok: true,
      joinUrl: getJoinUrl(req, meeting.joinPath),
      joinPath: meeting.joinPath,
      meetingId: meeting.meetingId,
      classNo: meeting.classNo,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not create join link.' });
  }
});

router.post('/api/session/instructor/join-link', async (req, res) => {
  try {
    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor || actor.role !== 'instructor' || !actor.instructorUid) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const courseId = Number.parseInt(String(req.body?.courseId || ''), 10);
    const learnerUid = String(req.body?.learnerUid || '').trim();
    const activation = await getInstructorActivation(actor.instructorUid, learnerUid, courseId);
    if (!activation) {
      return res.status(404).json({ error: 'No joinable class found for this learner.' });
    }

    if (!canOpenJoinWindow(activation.startsAt, activation.endsAt)) {
      return res.status(403).json({ error: 'Join link becomes available 30 minutes before class.' });
    }

    const meeting = await createMeetingFromActivation(activation);
    return res.json({
      ok: true,
      joinUrl: getJoinUrl(req, meeting.joinPath),
      joinPath: meeting.joinPath,
      meetingId: meeting.meetingId,
      classNo: meeting.classNo,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not create join link.' });
  }
});

router.post('/api/session/admin/join-link', async (req, res) => {
  try {
    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor || actor.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const meetingId = String(req.body?.meetingId || '').trim();
    const meeting = await getMeetingById(meetingId);
    if (!meeting || meeting.endedAt) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    return res.json({
      ok: true,
      joinUrl: getJoinUrl(req, meeting.joinPath),
      joinPath: meeting.joinPath,
      meetingId: meeting.meetingId,
      classNo: meeting.classNo,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not create join link.' });
  }
});

router.get('/api/session/admin/ongoing', async (req, res) => {
  try {
    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor || actor.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const meetings = await listOngoingMeetings();
    return res.json({ ok: true, meetings });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not load ongoing meetings.' });
  }
});

router.post('/api/session/:meetingId/access', async (req, res) => {
  try {
    if (isMobileRequest(req)) {
      return res.status(403).json({ error: 'Session room is available on desktop/laptop only.' });
    }

    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const meetingId = String(req.params.meetingId || '').trim();
    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const authz = authorizeMeetingActor(meeting, actor);
    if (!authz.ok) {
      return res.status(403).json({ error: authz.reason || 'Forbidden.' });
    }

    const actorIdentity = actor.role === 'instructor'
      ? actor.instructorUid
      : (actor.uid || actor.email || 'admin');

    const socketToken = createSessionAccessToken(meeting, authz.role, actorIdentity);
    const endAt = meeting.endsAt ? new Date(meeting.endsAt) : null;
    const canEndClass = authz.role === 'instructor'
      && endAt
      && !Number.isNaN(endAt.getTime())
      && Date.now() >= endAt.getTime();

    return res.json({
      ok: true,
      role: authz.role,
      meeting: {
        meetingId: meeting.meetingId,
        courseSlug: meeting.courseSlug,
        courseTitle: meeting.courseTitle || meeting.courseSlug,
        courseId: meeting.courseId,
        classNo: meeting.classNo,
        instructorName: meeting.instructorName || meeting.instructorUid,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
      },
      permissions: {
        canWhiteboard: authz.role === 'instructor',
        canEndClass,
      },
      socketToken,
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not authorize access.' });
  }
});

router.post('/api/session/:meetingId/support', async (req, res) => {
  try {
    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor || !['learner', 'instructor', 'admin'].includes(actor.role)) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const meetingId = String(req.params.meetingId || '').trim();
    const meeting = await getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    const authz = authorizeMeetingActor(meeting, actor);
    if (!authz.ok) {
      return res.status(403).json({ error: authz.reason || 'Forbidden.' });
    }

    await markMeetingSupportRequested(meetingId, authz.role);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Could not raise support alert.' });
  }
});

router.post('/api/session/:meetingId/end', async (req, res) => {
  try {
    await ensureSessionTables();
    const actor = await resolveActorFromRequest(req);
    if (!actor || actor.role !== 'instructor') {
      return res.status(401).json({ error: 'Only instructor can end class.' });
    }

    const meetingId = String(req.params.meetingId || '').trim();
    const result = await endMeeting(meetingId, actor);
    return res.json({ ok: true, alreadyEnded: Boolean(result?.alreadyEnded) });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Could not end class.' });
  }
});

module.exports = router;
