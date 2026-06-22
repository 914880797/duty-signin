let allRoster = [];
let currentSearch = '';
let shiftConfig = [];
let oldShiftNames = {};
let allGroups = [];
let allowedPersonsList = [];

window.addEventListener('DOMContentLoaded', function() {
    runMigrations();
    loadShiftConfig();
    loadRoster();
    loadGroups();
    loadCycleSettings();
    updateShiftSelects();
    updateGroupSelects();
});

function runMigrations() {
    fetch('/api/migrate-record-type', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
            if (data.migrated) console.log('DB迁移: record_type列已添加');
            else console.log('DB迁移: record_type列已存在, 跳过');
        })
        .catch(e => console.error('DB迁移失败:', e));
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    var tabMap = {
        'roster': 1,
        'groups': 2,
        'settings': 3,
        'config': 4,
        'announcement': 5,
        'batch': 6
    };

    var n = tabMap[tab];
    if (!n) return;

    document.querySelector('.tab-btn:nth-child(' + n + ')').classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');

    if (tab === 'groups') loadGroups();
    else if (tab === 'settings') loadCycleSettings();
    else if (tab === 'config') loadShiftConfig();
    else if (tab === 'announcement') loadAnnouncements();
    else if (tab === 'batch') { updateBatchSelects(); }
}

function timeToMinutes(timeStr) {
    const [hours, mins] = timeStr.split(':').map(Number);
    return hours * 60 + mins;
}

function showMessage(text, type) {
    const msgEl = document.getElementById('message');
    if (msgEl) {
        msgEl.innerText = text;
        msgEl.className = 'message ' + type;
        msgEl.style.display = 'block';
        setTimeout(() => msgEl.style.display = 'none', 3000);
    }
}
