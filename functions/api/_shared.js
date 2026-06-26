const TZ_OFFSET = 8 * 60 * 60 * 1000;
const DAY_MINUTES = 24 * 60;
const SALT = 'monkeycode_salt_2026';

function pad(n) { return String(n).padStart(2, '0'); }

function getBeijingNow() {
  return new Date(Date.now() + TZ_OFFSET);
}

function todayBeijing() {
  const bj = getBeijingNow();
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`;
}

function daysAgoBeijing(days) {
  const bj = getBeijingNow();
  bj.setTime(bj.getTime() - days * 24 * 60 * 60 * 1000);
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`;
}

function formatBeijingNow() {
  const bj = getBeijingNow();
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())}`;
}

function getDutyTimeRange(dutyTime) {
  if (!dutyTime || dutyTime === '未安排') return null;
  const clean = dutyTime.replace(/\s+/g, '');
  const match = clean.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) return null;
  let [, startHour, startMin, endHour, endMin] = match.map(Number);
  const originalStartHour = startHour;
  if (startHour === 24) startHour = 0;
  if (endHour === 24) endHour = 0;
  return {
    startTime: startHour * 60 + startMin,
    endTime: endHour * 60 + endMin,
    name: clean,
    isOvernight: originalStartHour > endHour && originalStartHour !== 24
  };
}

function getDutyStartMinutes(dutyTime) {
  if (!dutyTime) return null;
  const clean = dutyTime.replace(/\s+/g, '');
  const match = clean.match(/(\d{2}):(\d{2})/);
  if (!match) return null;
  const hour = parseInt(match[1]) % 24;
  return hour * 60 + parseInt(match[2]);
}

function getDutyEndMinutes(dutyTime) {
  if (!dutyTime) return null;
  const clean = dutyTime.replace(/\s+/g, '');
  const match = clean.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[3]) * 60 + parseInt(match[4]);
}

function getBeijingNowMinutes() {
  const bj = getBeijingNow();
  return bj.getUTCHours() * 60 + bj.getUTCMinutes();
}

async function hashPassword(password, salt = SALT) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdmin(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const { results } = await env.DB.prepare(
    `SELECT username FROM admin_users WHERE is_active = 1`
  ).all();
  for (const admin of (results || [])) {
    if (token === await hashPassword(admin.username)) return true;
  }
  return false;
}

function jsonSuccess(data, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}

function jsonError(message, status = 500, context = {}) {
  reportError(status, message, context);
  return Response.json({ success: false, error: message, ...context }, { status });
}

function reportError(status, message, context = {}) {
  console.error(JSON.stringify({
    timestamp: formatBeijingNow(),
    status,
    message,
    ...context
  }));
}

export {
  pad,
  getBeijingNow,
  todayBeijing,
  daysAgoBeijing,
  formatBeijingNow,
  getDutyTimeRange,
  getDutyStartMinutes,
  getDutyEndMinutes,
  getBeijingNowMinutes,
  hashPassword,
  verifyAdmin,
  jsonSuccess,
  jsonError,
  reportError,
};
