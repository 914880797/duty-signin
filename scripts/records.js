        let allRecords = [];
        let filteredRecords = [];

        // 页面加载时初始化
        window.addEventListener('DOMContentLoaded', async () => {
            const today = DateUtils.todayBeijing();

            let startDate = DateUtils.daysAgoBeijing(30);
            let validTimes = null;
            try {
                const settings = await AppUtils.apiFetch('/api/settings');
                if (settings.cycleStartDate) {
                    startDate = settings.cycleStartDate;
                }
                if (settings.validDutyTimes && settings.validDutyTimes.length > 0) {
                    validTimes = settings.validDutyTimes;
                }
            } catch (error) {}

            document.getElementById('endDate').value = today;
            document.getElementById('startDate').value = startDate;

            loadTimeSlots(validTimes);
            loadGroups();
            loadData();
        });

        // 加载时段列表
        async function loadTimeSlots(cachedTimes) {
            try {
                let slots;
                if (cachedTimes && cachedTimes.length > 0) {
                    slots = cachedTimes.map(t => ({ time_slot: t }));
                } else {
                    const responseData = await AppUtils.apiFetch('/api/time-slots');
                    slots = responseData.success ? (responseData.data || []) : [];
                }

                const select = document.getElementById('timeSlotSelect');
                slots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot.time_slot;
                    option.textContent = slot.time_slot;
                    select.appendChild(option);
                });
            } catch (error) {
                console.error('加载时段失败:', error);
            }
        }

        // 加载分组列表
        async function loadGroups() {
            try {
                const result = await AppUtils.apiFetch('/api/groups');
                const groups = result.success ? (result.data || []) : [];

                const select = document.getElementById('groupSelect');
                if (Array.isArray(groups)) {
                    groups.forEach(group => {
                        const option = document.createElement('option');
                        option.value = group.id;
                        option.textContent = group.name;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('加载分组失败:', error);
            }
        }

        // 加载数据
        async function loadData() {
            const tbody = document.getElementById('recordsBody');
            tbody.innerHTML = '<tr><td colspan="6" class="loading">加载中...</td></tr>';

            const params = new URLSearchParams();

            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const timeSlot = document.getElementById('timeSlotSelect').value;
            const groupId = document.getElementById('groupSelect').value;
            const name = document.getElementById('nameInput').value.trim();

            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (timeSlot) params.append('duty_time', timeSlot);
            if (groupId) params.append('group_id', groupId);
            if (name) params.append('name', name);

            try {
                const responseData = await AppUtils.apiFetch(`/api/records?${params.toString()}`);

                const records = responseData.success ? (responseData.data || []) : [];

                allRecords = records;
                filteredRecords = records;

                if (records.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" class="empty">
                                <div class="empty-icon">📭</div>
                                <div>暂无打卡记录</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                var e = AppUtils.escapeHtml;
                tbody.innerHTML = records.map(record => `
                    <tr>
                        <td>${e(record.duty_date || '-')}</td>
                        <td>${e(record.duty_time || '-')}</td>
                        <td>${e(record.name || '-')}</td>
                        <td>${e(record.group_name || '-')}</td>
                        <td>${record.created_at ? formatTime(record.created_at) : '-'}</td>
                        <td>${e(record.ip_address || '-')}</td>
                    </tr>
                `).join('');
            } catch (error) {
                console.error('加载数据失败:', error);
                tbody.innerHTML = '<tr><td colspan="6" class="empty">加载失败：' + AppUtils.escapeHtml(error.message) + '</td></tr>';
            }
        }

        // 格式化时间（转换为北京时间）
        function formatTime(isoString) {
            const date = new Date(isoString);
            return DateUtils.formatBeijingTime(date);
        }

        // 清除筛选
        function clearFilters() {
            const today = DateUtils.todayBeijing();
            const startStr = DateUtils.daysAgoBeijing(30);

            document.getElementById('startDate').value = startStr;
            document.getElementById('endDate').value = today;
            document.getElementById('timeSlotSelect').value = '';
            document.getElementById('groupSelect').value = '';
            document.getElementById('nameInput').value = '';

            loadData();
        }
