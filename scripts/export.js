(function() {
    let currentSheet = '', allData = {}, groups = [], cycleStartDate = null, cycleDates = [], dataLoaded = false;

    function init() {
        document.getElementById('btnApply').addEventListener('click', applyFilters);
        document.getElementById('btnClear').addEventListener('click', clearFilters);
        AppUtils.loadSettings(
            function(data) {
                cycleStartDate = data.cycleStartDate || DateUtils.formatBeijingDate();
                loadData();
            },
            function() {
                cycleStartDate = DateUtils.formatBeijingDate();
                loadData();
            }
        );
    }

    function generateCycleDates(start, end) {
        cycleDates = [];
        const s = new Date(start + 'T00:00:00Z');
        const e = new Date(end + 'T00:00:00Z');
        for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
            const year = String(d.getUTCFullYear());
            const month = String(d.getUTCMonth()+1).padStart(2,'0');
            const day = String(d.getUTCDate()).padStart(2,'0');
            cycleDates.push({
                fullDate: year + '-' + month + '-' + day,
                displayDate: (d.getUTCMonth()+1) + '月' + d.getUTCDate() + '号'
            });
        }
    }

    function loadData() {
        Promise.all([
            AppUtils.apiFetch('/api/records'),
            AppUtils.apiFetch('/api/groups')
        ]).then(([recData, grpData]) => {
            const records = recData.success ? (recData.data || []) : (Array.isArray(recData) ? recData : []);
            groups = grpData.data || grpData || [];
            allData = processDataByGroup(records);
            renderSheetTabs();
            if (groups.length > 0) { currentSheet = groups[0].name; renderTable(currentSheet); }
        }).catch(e => {
            document.getElementById('dutyTable').innerHTML = '<tr><td colspan="40" class="empty">加载失败：' + e.message + '</td></tr>';
        });
    }

    function processDataByGroup(records) {
        const data = {};
        groups.forEach(g => { data[g.name] = { persons: [], records: {}, maxDate: null }; });
        if (!data['未分组']) data['未分组'] = { persons: [], records: {}, maxDate: null };

        records.forEach(r => {
            const gn = r.group_name || '未分组';
            if (!data[gn]) data[gn] = { persons: [], records: {}, maxDate: null };
            if (!data[gn].persons.includes(r.name)) data[gn].persons.push(r.name);

            const displayDate = DateUtils.getNaturalDate(r.created_at);

            if (!data[gn].records[r.name]) data[gn].records[r.name] = {};
            const cell = data[gn].records[r.name][displayDate];
            const isMakeup = r.record_type === 'makeup' || r.ip_address === 'makeup';

            if (!cell) {
                data[gn].records[r.name][displayDate] = { signin: isMakeup ? 0 : 1, makeup: isMakeup ? 1 : 0 };
            } else {
                if (isMakeup) cell.makeup++;
                else cell.signin++;
            }

            if (!data[gn].maxDate || displayDate > data[gn].maxDate) data[gn].maxDate = displayDate;
        });

        Object.keys(data).forEach(k => data[k].persons.sort());
        generateCycleDates(cycleStartDate, DateUtils.todayBeijing());
        dataLoaded = true;
        return data;
    }

    function renderSheetTabs() {
        const html = groups.length > 0 ? groups.map((g,i) =>
            '<div class="sheet-tab'+(i===0?' active':'')+'" data-group="'+g.name+'" role="tab" aria-selected="'+(i===0?'true':'false')+'">'+g.name+'</div>'
        ).join('') : '<div class="sheet-tab active" role="tab" aria-selected="true">未分组</div>';
        document.getElementById('sheetTabs').innerHTML = html;
        document.querySelectorAll('.sheet-tab').forEach((tab, i) => {
            tab.addEventListener('click', () => {
                currentSheet = tab.dataset.group;
                document.querySelectorAll('.sheet-tab').forEach((t, j) => {
                    t.classList.toggle('active', j === i);
                    t.setAttribute('aria-selected', j === i ? 'true' : 'false');
                });
                renderTable(currentSheet);
            });
        });
    }

    function renderTable(sheetName) {
        const table = document.getElementById('dutyTable');
        const data = allData[sheetName] || { persons: [], records: {} };
        if (data.persons.length === 0) {
            table.innerHTML = '<tr><td colspan="40" class="empty">暂无数据</td></tr>';
            updateGlobalStats();
            return;
        }
        const days = cycleDates.length;
        let html = '<thead><tr><!--姓名--><th class="name-col" scope="col">姓名</th><th class="group-col" scope="col">分组</th>';
        cycleDates.forEach(d => { html += '<th class="date-cell" scope="col">'+d.displayDate+'</th>'; });
        html += '<th class="stats-col-fixed" scope="col">共计</th><th class="stats-col-fixed" scope="col">累计</th><th class="stats-col-fixed" scope="col">缺席</th></tr></thead><tbody>';
        let ts = 0, ta = 0;
        data.persons.forEach(name => {
            const rec = data.records[name] || {};
            let s = 0;
            html += '<tr data-name="'+name+'" data-group="'+sheetName+'"><td class="name-col">'+name+'</td><td class="group-col">'+sheetName+'</td>';
            cycleDates.forEach(d => {
                const cell = rec[d.fullDate];
                const total = cell ? (cell.signin + cell.makeup) : 0;
                const v = total > 0 ? 1 : '';
                const makeupOnly = cell && cell.signin === 0 && cell.makeup > 0;
                const sv = total > 1 ? '<sup>'+total+'</sup>' : '';
                if (v) s++;
                html += '<td class="date-cell'+(v?' value-1':'')+(makeupOnly?' makeup':'')+(total>1?' multi-slot':'')+'" data-date="'+d.fullDate+'">'+(makeupOnly ? '补'+sv : v+sv)+'</td>';
            });
            const a = days - s;
            html += '<td class="stats-col-fixed">'+s+'</td><td class="stats-col-fixed">'+s+'</td><td class="stats-col-fixed">'+a+'</td></tr>';
            ts += s; ta += a;
        });
        html += '</tbody>';
        table.innerHTML = html;
        table.querySelectorAll('td:first-child').forEach(td => {
            td.addEventListener('click', function() {
                const name = this.parentNode.dataset.name;
                document.querySelectorAll('.highlight-row').forEach(r => r.classList.remove('highlight-row'));
                table.querySelectorAll('tr[data-name="'+name+'"]').forEach(r => r.classList.add('highlight-row'));
            });
        });
        updateGlobalStats();
    }

    function updateGlobalStats() {
        let totalP = 0, totalS = 0;
        Object.keys(allData).forEach(gn => {
            const gd = allData[gn];
            if (!gd || !gd.persons) return;
            totalP += gd.persons.length;
            gd.persons.forEach(nm => {
                const rd = gd.records[nm] || {};
                Object.keys(rd).forEach(() => { totalS++; });
            });
        });
        document.getElementById('totalPersons').textContent = totalP;
        document.getElementById('totalShifts').textContent = totalS;
        document.getElementById('avgShifts').textContent = totalP > 0 ? (totalS/totalP).toFixed(1) : '0';
    }

    function applyFilters() {
        const v = document.getElementById('searchInput').value.trim().toLowerCase();
        document.querySelectorAll('#dutyTable tbody tr').forEach(r => {
            r.classList.toggle('highlight-row', v && r.dataset.name.toLowerCase().includes(v));
        });
    }

    function clearFilters() {
        document.getElementById('searchInput').value = '';
        document.querySelectorAll('#dutyTable tbody tr').forEach(r => r.classList.remove('highlight-row'));
    }

    window.exportExcel = function() {
        if (typeof XLSX === 'undefined') { alert('Excel 库未加载'); return; }
        if (!dataLoaded) {
            alert('数据加载中，请稍后再试');
            return;
        }
        if (!groups || groups.length === 0 || Object.keys(allData).length === 0) {
            alert('没有可导出的数据');
            return;
        }
        try {
            const bjNow = DateUtils.getBeijingNow();
            const y = String(bjNow.getUTCFullYear());
            const m = String(bjNow.getUTCMonth()+1).padStart(2,'0');
            const days = cycleDates.length;
            const wb = { SheetNames: [], Sheets: {} };
            groups.forEach(g => {
                const gn = g.name;
                const gd = allData[gn];
                if (!gd || !gd.persons || gd.persons.length === 0) return;
                const data = [['姓名', '分组']];
                cycleDates.forEach(d => { data[0].push(d.displayDate); });
                data[0].push('共计', '累计', '缺席');
                gd.persons.forEach(nm => {
                    const rd = gd.records[nm] || {};
                    let s = 0;
                    const row = [nm, gn];
                    cycleDates.forEach(d => {
                        const raw = rd[d.fullDate];
                        const isMakeup = raw === 2;
                        if (raw) s++;
                        row.push(isMakeup ? '补' : (raw ? 1 : ''));
                    });
                    row.push(s, s, days - s);
                    data.push(row);
                });
                const ws = XLSX.utils.aoa_to_sheet(data);
                wb.SheetNames.push(gn);
                wb.Sheets[gn] = ws;
            });
            if (wb.SheetNames.length === 0) { alert('无数据可导出'); return; }
            const filename = '值班表_' + y + m + '.xlsx';
            XLSX.writeFile(wb, filename);
            alert('已导出 Excel 文件：' + filename);
        } catch (e) {
            console.error('Excel error:', e);
            alert('导出失败：' + e.message);
        }
    }

    window.addEventListener('DOMContentLoaded', init);
})();
