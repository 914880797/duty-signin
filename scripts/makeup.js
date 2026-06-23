(function() {
    let missedData = [], cycleStartDate = null, makeupDone = new Set(), allMakeupRecords = [];

    function init() {
        document.getElementById('btnApply').addEventListener('click', applyFilters);
        document.getElementById('btnClear').addEventListener('click', clearFilters);
        AppUtils.loadSettings(
            function(data) {
                cycleStartDate = data.cycleStartDate || DateUtils.formatBeijingDate();
                loadMissed();
            },
            function() {
                cycleStartDate = DateUtils.formatBeijingDate();
                loadMissed();
            }
        );
        loadMakeupRecords();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        return parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日';
    }

    function loadMissed() {
        const url = '/api/makeup-missed?start_date=' + encodeURIComponent(cycleStartDate) + '&end_date=' + encodeURIComponent(DateUtils.todayBeijing());
        fetch(url).then(r => r.json()).then(data => {
            missedData = (data.success ? data.data : []) || [];
            if (!Array.isArray(missedData)) missedData = [];
            renderTable();
        }).catch(e => {
            console.error('Load missed error:', e);
            renderTable([]);
        });
    }

    function renderTable() {
        const tbody = document.querySelector('#makeupTable tbody');
        const searchVal = document.getElementById('searchInput').value.trim().toLowerCase();

        let filtered = missedData;
        if (searchVal) {
            filtered = missedData.filter(r => r.name && r.name.toLowerCase().includes(searchVal));
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="5">没有漏打卡记录</td></tr>';
        } else {
            var esc = AppUtils.escapeHtml;
            tbody.innerHTML = filtered.map((r, i) => {
                const key = r.name + '|' + r.duty_date + '|' + r.duty_time;
                const done = makeupDone.has(key);
                return '<tr data-key="' + esc(key) + '">' +
                    '<td>' + esc(r.duty_date) + '</td>' +
                    '<td>' + esc(r.duty_time) + '</td>' +
                    '<td class="name-cell">' + esc(r.name) + '</td>' +
                    '<td>' + esc(r.group_name || '-') + '</td>' +
                    '<td><button class="btn-makeup' + (done ? ' done' : '') + '" data-name="' + esc(r.name) + '" data-date="' + esc(r.duty_date) + '" data-time="' + esc(r.duty_time) + '" data-group="' + esc(r.group_id || '') + '"' + (done ? ' disabled' : '') + '>' + (done ? '已补' : '补卡') + '</button></td>' +
                '</tr>';
            }).join('');

            tbody.querySelectorAll('.btn-makeup:not([disabled])').forEach(btn => {
                btn.addEventListener('click', function() {
                    const name = this.dataset.name;
                    const dutyDate = this.dataset.date;
                    const dutyTime = this.dataset.time;
                    const groupId = this.dataset.group;
                    doMakeup(name, dutyDate, dutyTime, groupId, this);
                });
            });
        }

        updateStats();
    }

    function updateStats() {
        const today = DateUtils.todayBeijing();
        const yesterday = DateUtils.daysAgoBeijing(1);

        document.getElementById('totalMissed').textContent = missedData.length;
        document.getElementById('todayMissed').textContent = missedData.filter(r => r.duty_date === today).length;
        document.getElementById('todayMakeup').textContent = allMakeupRecords.filter(r => r.duty_date === today).length;
        document.getElementById('yesterdayMakeup').textContent = allMakeupRecords.filter(r => r.duty_date === yesterday).length;
        document.getElementById('totalMakeup').textContent = allMakeupRecords.length;
    }

    function doMakeup(name, dutyDate, dutyTime, groupId, btn) {
        btn.disabled = true;
        btn.textContent = '...';

        fetch('/api/makeup-signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                duty_date: dutyDate,
                duty_time: dutyTime,
                group_id: groupId || null
            })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                const key = name + '|' + dutyDate + '|' + dutyTime;
                makeupDone.add(key);
                btn.classList.add('done');
                btn.textContent = '已补';
                showToast(name + ' ' + dutyDate + ' ' + dutyTime + ' 补卡成功', 'success');
                loadMakeupRecords();

                missedData = missedData.filter(r => {
                    const rk = r.name + '|' + r.duty_date + '|' + r.duty_time;
                    return rk !== key;
                });
                renderTable();
            } else {
                btn.disabled = false;
                btn.textContent = '补卡';
                showToast(data.error || '补卡失败', 'error');
            }
        }).catch(e => {
            btn.disabled = false;
            btn.textContent = '补卡';
            showToast('网络错误: ' + e.message, 'error');
        });
    }

    function loadMakeupRecords() {
        fetch('/api/records').then(r => r.json()).then(data => {
            const records = (data.success ? data.data : []) || [];
            allMakeupRecords = Array.isArray(records)
                ? records.filter(r => r.record_type === 'makeup' || r.ip_address === 'makeup')
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                : [];
            renderMakeupDoneTable(allMakeupRecords);
            updateStats();
        }).catch(e => {
            console.error('Load makeup records error:', e);
        });
    }

    function renderMakeupDoneTable(records) {
        const tbody = document.querySelector('#makeupDoneTable tbody');
        if (!records || records.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="5">暂无补卡记录</td></tr>';
            return;
        }
        var esc = AppUtils.escapeHtml;
        tbody.innerHTML = records.map(r => {
            return '<tr>' +
                '<td>' + esc(r.duty_date) + '</td>' +
                '<td>' + esc(r.duty_time) + '</td>' +
                '<td class="name-cell">' + esc(r.name) + '</td>' +
                '<td>' + esc(r.group_name || '-') + '</td>' +
                '<td style="color:#4CAF50">' + esc(r.created_at) + '</td>' +
            '</tr>';
        }).join('');
    }

    function applyFilters() {
        renderTable();
    }

    function clearFilters() {
        document.getElementById('searchInput').value = '';
        renderTable();
    }

    function showToast(msg, type) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = 'toast ' + type + ' show';
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => { toast.className = 'toast'; }, 2000);
    }

    window.addEventListener('DOMContentLoaded', init);
})();
