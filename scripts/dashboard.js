        let allGroups = [];
        let allRecords = [];
        let filteredRecords = [];

        // Initialize
        window.addEventListener('DOMContentLoaded', async function() {
            await initDates();
            loadShifts();
            loadGroups();
            loadData();
        });

        // Initialize dates
        async function initDates() {
            const endDate = DateUtils.todayBeijing();

            let startDateValue = DateUtils.daysAgoBeijing(7);
            try {
                const settings = await AppUtils.apiFetch('/api/settings');
                if (settings && settings.cycleStartDate) {
                    startDateValue = settings.cycleStartDate;
                }
            } catch (e) {}

            document.getElementById('endDate').value = endDate;
            document.getElementById('startDate').value = startDateValue;
        }

        function loadShifts() {
            AppUtils.loadShifts(document.getElementById('shiftSelect'));
        }

        async function loadGroups() {
            allGroups = await AppUtils.loadGroups(document.getElementById('groupSelect'));
        }

        // 加载数据
        async function loadData() {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const shift = document.getElementById('shiftSelect').value;
            const groupId = document.getElementById('groupSelect').value;
            const nameSearch = document.getElementById('nameSearch').value.trim();

            let url = '/api/records';
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (shift) params.append('duty_time', shift);
            url += '?' + params.toString();

            try {
                const responseData = await AppUtils.apiFetch(url);

                allRecords = responseData.success ? (responseData.data || []) : [];

                filteredRecords = allRecords.filter(record => {
                    if (groupId && record.group_id != groupId) return false;
                    if (nameSearch && !record.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
                    return true;
                });

                renderStats();
                renderCharts();
            } catch (error) {
                console.error('加载数据失败:', error);
                alert('加载数据失败：' + error.message);
            }
        }

        // 渲染统计卡片
        function renderStats() {
            const totalRecords = filteredRecords.length;
            const uniquePersons = new Set(filteredRecords.map(r => r.name)).size;
            const today = DateUtils.todayBeijing();
            // 使用 created_at 转换为北京时间后比较
            const todayCount = filteredRecords.filter(r => {
                if (!r.created_at) return false;
                const date = new Date(r.created_at);
                const bjDateStr = DateUtils.formatBeijingDate(date);
                return bjDateStr === today;
            }).length;
            const groupsCount = new Set(filteredRecords.map(r => r.group_id || 'none')).size;

            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-number">${totalRecords}</div>
                    <div class="stat-label">总打卡次数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${uniquePersons}</div>
                    <div class="stat-label">值班人数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${todayCount}</div>
                    <div class="stat-label">今日打卡</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${groupsCount}</div>
                    <div class="stat-label">分组数量</div>
                </div>
            `;
        }

        // 渲染图表
        function renderCharts() {
            renderShiftChart();
            renderGroupChart();
            renderPersonChart();
            renderDateChart();
        }

        // 按时段分布图表
        function renderShiftChart() {
            const shiftCounts = {};
            filteredRecords.forEach(r => {
                shiftCounts[r.duty_time] = (shiftCounts[r.duty_time] || 0) + 1;
            });

            const maxCount = Math.max(...Object.values(shiftCounts), 1);
            const chartEl = document.getElementById('shiftChart');
            
            chartEl.innerHTML = Object.entries(shiftCounts)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([shift, count]) => `
                    <div class="bar-item">
                        <div class="bar-label">${AppUtils.escapeHtml(shift)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
                        </div>
                        <div class="bar-value">${count}</div>
                    </div>
                `).join('');
        }

        // 按分组分布图表
        function renderGroupChart() {
            const groupCounts = {};
            filteredRecords.forEach((r) => {
                const groupName = r.group_name || '未分组';
                groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
            });

            const maxCount = Math.max(...Object.values(groupCounts), 1);
            const chartEl = document.getElementById('groupChart');
            
            chartEl.innerHTML = Object.entries(groupCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([group, count]) => `
                    <div class="bar-item">
                        <div class="bar-label">${AppUtils.escapeHtml(group)}</div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
                        </div>
                        <div class="bar-value">${count}</div>
                    </div>
                `).join('');
        }

        // 人员排行图表
        function renderPersonChart() {
            const personCounts = {};
            filteredRecords.forEach(r => {
                personCounts[r.name] = (personCounts[r.name] || 0) + 1;
            });

            const top10 = Object.entries(personCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const maxCount = Math.max(...top10.map(([, count]) => count), 1);
            const chartEl = document.getElementById('personChart');
            
            chartEl.innerHTML = top10.map(([name, count]) => `
                <div class="bar-item">
                    <div class="bar-label">${AppUtils.escapeHtml(name)}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
                    </div>
                    <div class="bar-value">${count}</div>
                </div>
            `).join('');
        }

        // 日期趋势图表
        function renderDateChart() {
            const dateCounts = {};
            filteredRecords.forEach(r => {
                const displayDate = DateUtils.getNaturalDate(r.created_at, r.duty_time);
                dateCounts[displayDate] = (dateCounts[displayDate] || 0) + 1;
            });

            const sortedDates = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
            const maxCount = Math.max(...sortedDates.map(([, count]) => count), 1);
            const chartEl = document.getElementById('dateChart');
            
            chartEl.innerHTML = sortedDates.map(([date, count]) => `
                <div class="bar-item">
                    <div class="bar-label">${date.slice(5)}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
                    </div>
                    <div class="bar-value">${count}</div>
                </div>
            `).join('');
        }

        // 清除筛选
        async function clearFilters() {
            await initDates();
            document.getElementById('shiftSelect').value = '';
            document.getElementById('groupSelect').value = '';
            document.getElementById('nameSearch').value = '';
            loadData();
        }
