        let allGroups = [];
        let allRoster = [];
        let filteredRoster = [];

        window.addEventListener('DOMContentLoaded', function() {
            loadShifts();
            loadGroups();
        });

        function loadShifts() {
            AppUtils.loadShifts(document.getElementById('shiftSelect'));
        }

        async function loadGroups() {
            allGroups = await AppUtils.loadGroups(document.getElementById('groupSelect'));
        }

        function clearFilters() {
            document.getElementById('shiftSelect').value = '';
            document.getElementById('groupSelect').value = '';
            document.getElementById('nameSearch').value = '';
            document.getElementById('result').style.display = 'none';
            document.getElementById('stats').style.display = 'none';
        }

        async function queryRoster() {
            const shift = document.getElementById('shiftSelect').value;
            const groupId = document.getElementById('groupSelect').value;
            const nameSearch = document.getElementById('nameSearch').value.trim();
            
            // 使用 DateUtils 获取北京时间今天日期查询排班
            const today = DateUtils.todayBeijing();
            
            const resultEl = document.getElementById('result');
            resultEl.style.display = 'block';
            resultEl.innerHTML = '<div class="empty">查询中...</div>';

            try {
                const response = await fetch(`/api/config?date=${today}`);
                const data = await response.json();

                if (!response.ok || !data.success) {
                    resultEl.innerHTML = '<div class="empty">查询失败：' + AppUtils.escapeHtml(data.error || '未知错误') + '</div>';
                    return;
                }

                allRoster = data.data || [];
                
                // 筛选数据
                filteredRoster = allRoster.filter(item => {
                    // 时段筛选
                    if (shift && item.duty_time !== shift) return false;
                    // 分组筛选
                    if (groupId && item.group_id != groupId) return false;
                    // 姓名筛选
                    if (nameSearch && !item.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
                    return true;
                });

                renderResults(filteredRoster);
                renderStats(filteredRoster);
            } catch (error) {
                console.error('查询失败:', error);
                resultEl.innerHTML = '<div class="empty">网络请求失败</div>';
            }
        }

        function renderStats(data) {
            const statsEl = document.getElementById('stats');
            
            // 按分组统计
            const groupStats = {};
            data.forEach(item => {
                const groupName = item.group_name || '未分组';
                if (!groupStats[groupName]) {
                    groupStats[groupName] = 0;
                }
                groupStats[groupName]++;
            });
            
            let statsHtml = `
                <div class="stat-card">
                    <div class="stat-number">${data.length}</div>
                    <div class="stat-label">总人数</div>
                </div>
            `;
            
            Object.keys(groupStats).forEach(groupName => {
                statsHtml += `
                    <div class="stat-card">
                        <div class="stat-number">${groupStats[groupName]}</div>
                        <div class="stat-label">${groupName}</div>
                    </div>
                `;
            });
            
            statsEl.innerHTML = statsHtml;
            statsEl.style.display = 'flex';
        }

        function renderResults(data) {
            const resultEl = document.getElementById('result');
            
            if (data.length === 0) {
                resultEl.innerHTML = '<div class="empty">未找到匹配的排班</div>';
                return;
            }
            
            const shift = document.getElementById('shiftSelect').value;
            const groupId = document.getElementById('groupSelect').value;
            const isSingleGroup = !!groupId;
            
            if (isSingleGroup) {
                renderFlatResults(data, resultEl);
            } else {
                renderGroupedResults(data, resultEl);
            }
        }

        function renderFlatResults(data, resultEl) {
            data.sort((a, b) => (a.duty_time || '').localeCompare(b.duty_time || ''));
            
            const groupName = data.length > 0 ? (data[0].group_name || '未分组') : '';
            
            let html = `<div class="group-header">${AppUtils.escapeHtml(groupName)} (${data.length}人)</div>`;
            html += '<div class="flat-list">';
            html += data.map(item => `
                <div class="result-item">
                    <span class="result-time">${AppUtils.escapeHtml(item.duty_time)}</span>
                    <span class="result-name">${AppUtils.escapeHtml(item.name)}</span>
                </div>
            `).join('');
            html += '</div>';
            
            resultEl.innerHTML = html;
        }

        function renderGroupedResults(data, resultEl) {
            const groupedData = {};
            data.forEach(item => {
                const groupName = item.group_name || '未分组';
                if (!groupedData[groupName]) {
                    groupedData[groupName] = [];
                }
                groupedData[groupName].push(item);
            });
            
            const sortedGroups = Object.keys(groupedData).sort((a, b) => {
                if (a === '未分组') return 1;
                if (b === '未分组') return -1;
                const groupA = allGroups.find(g => g.name === a);
                const groupB = allGroups.find(g => g.name === b);
                return (groupA?.order_index || 999) - (groupB?.order_index || 999);
            });
            
            let html = '';
            sortedGroups.forEach(groupName => {
                const items = groupedData[groupName];
                items.sort((a, b) => (a.duty_time || '').localeCompare(b.duty_time || ''));
                
                html += `
                    <div class="group-section">
                        <div class="group-header">${AppUtils.escapeHtml(groupName)} (${items.length}人)</div>
                        ${items.map(item => `
                            <div class="result-item">
                                <span class="result-time">${AppUtils.escapeHtml(item.duty_time)}</span>
                                <span class="result-name">${AppUtils.escapeHtml(item.name)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            });
            
            resultEl.innerHTML = html;
        }
