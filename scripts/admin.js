        let allRoster = [];
        let currentSearch = '';
        let shiftConfig = [];
        let oldShiftNames = {};
        let allGroups = [];
        let allowedPersonsList = [];

        const defaultShifts = [
            { id: 1, name: '04:00-06:00', startTime: '04:00', endTime: '06:00' },
            { id: 2, name: '06:00-08:00', startTime: '06:00', endTime: '08:00' },
            { id: 3, name: '08:00-09:30', startTime: '08:00', endTime: '09:30' },
            { id: 4, name: '09:30-11:00', startTime: '09:30', endTime: '11:00' },
            { id: 5, name: '11:00-12:30', startTime: '11:00', endTime: '12:30' },
            { id: 6, name: '12:30-14:00', startTime: '12:30', endTime: '14:00' },
            { id: 7, name: '14:00-15:30', startTime: '14:00', endTime: '15:30' },
            { id: 8, name: '15:30-17:00', startTime: '15:30', endTime: '17:00' },
            { id: 9, name: '17:00-18:30', startTime: '17:00', endTime: '18:30' },
            { id: 10, name: '18:30-20:00', startTime: '18:30', endTime: '20:00' },
            { id: 11, name: '20:00-21:30', startTime: '20:00', endTime: '21:30' },
            { id: 12, name: '21:30-23:00', startTime: '21:30', endTime: '23:00' },
            { id: 13, name: '23:00-24:00', startTime: '23:00', endTime: '24:00' },
            { id: 14, name: '24:00-04:00', startTime: '24:00', endTime: '04:00' }
        ];

        window.addEventListener('DOMContentLoaded', function() {
            loadShiftConfig();
            loadRoster();
            loadGroups();
            loadCycleSettings();
            updateShiftSelects();
            updateGroupSelects();
        });

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

        function loadShiftConfig() {
            shiftConfig = JSON.parse(localStorage.getItem('shiftConfig')) || defaultShifts;
            oldShiftNames = {};
            shiftConfig.forEach(s => { oldShiftNames[s.id] = s.name; });
            renderShiftConfig();
            // 自动同步有效时段到后端，防止未保存导致旧时段残留
            syncValidTimesToBackend();
        }

        function syncValidTimesToBackend() {
            const validTimes = shiftConfig.map(s => s.name);
            fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valid_duty_times: validTimes })
            }).then(r => r.json()).then(data => {
                if (data.success && data.deleted) {
                    // 后台静默清理完成
                }
            }).catch(e => console.error('syncValidTimes error:', e));

            fetch('/api/validate-timeslots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valid_duty_times: validTimes })
            }).catch(e => console.error('validateTimeslots error:', e));
        }

        function renderShiftConfig() {
            const tbody = document.getElementById('shiftConfigBody');
            tbody.innerHTML = shiftConfig.map((shift, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td><input type="text" class="form-input" value="${shift.name}" onchange="updateShiftName(${shift.id}, this.value)" style="padding: 8px;"></td>
                    <td><input type="time" class="time-input" value="${shift.startTime === '24:00' ? '00:00' : shift.startTime}" onchange="updateShiftTime(${shift.id}, 'start', this.value)"></td>
                    <td><input type="time" class="time-input" value="${shift.endTime === '24:00' ? '00:00' : shift.endTime}" onchange="updateShiftTime(${shift.id}, 'end', this.value)"></td>
                    <td><button onclick="deleteShiftConfig(${shift.id})" class="delete-shift-btn">🗑️ 删除</button></td>
                </tr>
            `).join('');
        }

        function updateShiftName(id, value) {
            const shift = shiftConfig.find(s => s.id === id);
            if (shift) shift.name = value;
        }

        function updateShiftTime(id, type, value) {
            const shift = shiftConfig.find(s => s.id === id);
            if (shift) {
                if (type === 'start') shift.startTime = value;
                else shift.endTime = value === '00:00' ? '24:00' : value;
            }
        }

        function addNewShift() {
            const newId = Math.max(...shiftConfig.map(s => s.id)) + 1;
            shiftConfig.push({
                id: newId,
                name: '新时段',
                startTime: '00:00',
                endTime: '01:00'
            });
            renderShiftConfig();
            setTimeout(() => {
                const wrapper = document.querySelector('#configTab .table-wrapper');
                if (wrapper) {
                    wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
                }
            }, 100);
        }

        function deleteShiftConfig(id) {
            if (shiftConfig.length <= 1) {
                alert('至少需要保留一个时段！');
                return;
            }
            if (!confirm('确定要删除此时段吗？\n\n删除时段将同时清除所有该时段的排班记录和绑定。')) return;

            const targetShift = shiftConfig.find(s => s.id === id);
            const dutyTime = targetShift ? targetShift.name : null;

            shiftConfig = shiftConfig.filter(s => s.id !== id);
            renderShiftConfig();

            if (dutyTime) {
                fetch('/api/cleanup-timeslot', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duty_time: dutyTime })
                }).then(r => r.json()).then(data => {
                    if (data.success) {
                        showMessage('时段 ' + dutyTime + ' 已删除，共清理 ' +
                            data.deleted_duty_config + ' 条排班记录和 ' +
                            data.deleted_duty_bindings + ' 条绑定', 'success');
                        setTimeout(() => loadRoster(), 500);
                    }
                }).catch(e => console.error('Cleanup error:', e));
            }
        }

        function validateAndSaveConfig() {
            if (!checkAdminAuth()) return false;
            
            const errors = [];
            
            for (let i = 0; i < shiftConfig.length; i++) {
                const shift = shiftConfig[i];
                const startMins = timeToMinutes(shift.startTime);
                let endMins = timeToMinutes(shift.endTime === '24:00' ? '00:00' : shift.endTime);
                
                if (shift.endTime === '24:00' || endMins < startMins) endMins += 24 * 60;
                
                if (startMins >= endMins && !shift.name.includes('24:00')) {
                    errors.push(`第 ${i + 1} 个时段：开始时间不能大于等于结束时间`);
                }
                
                for (let j = 0; j < shiftConfig.length; j++) {
                    if (i === j) continue;
                    const other = shiftConfig[j];
                    const otherStart = timeToMinutes(other.startTime);
                    let otherEnd = timeToMinutes(other.endTime === '24:00' ? '00:00' : other.endTime);
                    if (other.endTime === '24:00' || otherEnd < otherStart) otherEnd += 24 * 60;
                    
                    if (startMins < otherEnd && endMins > otherStart) {
                        errors.push(`第 ${i + 1} 个时段与第 ${j + 1} 个时段有重叠`);
                    }
                }
            }
            
            const statusEl = document.getElementById('configStatus');
            
            if (errors.length > 0) {
                statusEl.innerHTML = `<div class="message error" style="display:block;">❌ 验证失败：<br>${errors.join('<br>')}</div>`;
                return false;
            }
            
            localStorage.setItem('shiftConfig', JSON.stringify(shiftConfig));
            statusEl.innerHTML = `<div class="message success" style="display:block;">✅ 配置保存成功！</div>`;
            updateShiftSelects();
            // 更新旧名称快照
            shiftConfig.forEach(s => { oldShiftNames[s.id] = s.name; });

            const validTimes = shiftConfig.map(s => s.name);

            // 1. 检测重命名的时段，先更新数据库中的记录
            for (const shift of shiftConfig) {
                const oldName = oldShiftNames[shift.id];
                if (oldName && oldName !== shift.name) {
                    fetch('/api/rename-timeslot', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ old_name: oldName, new_name: shift.name })
                    }).then(r => r.json()).then(data => {
                        if (data.success && (data.updated_duty_config > 0 || data.updated_duty_bindings > 0)) {
                            showMessage('时段 ' + oldName + ' → ' + shift.name + ' 已更新 ' + data.updated_duty_config + ' 条排班和 ' + data.updated_duty_bindings + ' 条绑定', 'success');
                        }
                    }).catch(e => console.error('Rename timeslot error:', e));
                }
            }

            // 2. 将有效时段同步到后端 settings 表供其他 API 过滤
            fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valid_duty_times: validTimes })
            }).catch(e => console.error('Save valid_times error:', e));

            // 清理不在当前时段配置中的遗留学段记录
            fetch('/api/validate-timeslots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valid_duty_times: validTimes })
            }).then(r => r.json()).then(data => {
                if (data.success && (data.deleted_duty_config > 0 || data.deleted_duty_bindings > 0)) {
                    showMessage('已清理 ' + data.deleted_duty_config + ' 条遗留学段记录和 ' + data.deleted_duty_bindings + ' 条绑定', 'success');
                }
            }).catch(e => console.error('Validate timeslots error:', e));

            setTimeout(() => statusEl.innerHTML = '', 3000);
            return true;
        }

        function timeToMinutes(timeStr) {
            const [hours, mins] = timeStr.split(':').map(Number);
            return hours * 60 + mins;
        }

        function updateShiftSelects() {
            const shiftSelect = document.getElementById('shiftSelect');
            const editNewShift = document.getElementById('editNewShift');
            const options = shiftConfig.map(shift => `<option value="${shift.name}">${shift.name}</option>`).join('');
            shiftSelect.innerHTML = '<option value="">-- 请选择值班时段 --</option>' + options;
            editNewShift.innerHTML = '<option value="">-- 请选择新时段 --</option>' + options;
        }

        // 加载分组列表
        async function loadGroups() {
            const groupsList = document.getElementById('groupsList');
            groupsList.innerHTML = '<div class="loading">加载中...</div>';
            
            try {
                const response = await fetch('/api/groups');
                const result = await response.json();
                
                if (response.ok && result.success) {
                    allGroups = result.data || [];
                    renderGroups(allGroups);
                    updateGroupSelects();
                } else {
                    groupsList.innerHTML = '<div class="roster-empty">加载失败：' + (result.error || '未知错误') + '</div>';
                }
            } catch (error) {
                console.error('加载分组失败:', error);
                groupsList.innerHTML = '<div class="roster-empty">❌ 网络请求失败</div>';
            }
        }

        // 渲染分组列表
        function renderGroups(groups) {
            const groupsList = document.getElementById('groupsList');
            
            if (groups.length === 0) {
                groupsList.innerHTML = '<div class="roster-empty">暂无分组</div>';
                return;
            }
            
            groupsList.innerHTML = groups.map(group => `
                <div class="roster-item" id="group-${group.id}">
                    <div class="roster-info">
                        <span class="roster-time" style="min-width: 30px;">#${group.order_index || '-'}</span>
                        <input type="text" value="${group.name}" 
                            onchange="renameGroup(${group.id}, this.value)"
                            style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid #3a3a50; border-radius: 5px; padding: 8px 12px; color: #e0e0e0;">
                    </div>
                    <div class="roster-actions">
                        <button onclick="moveGroupUp(${group.id})" class="action-btn" style="background: rgba(108, 99, 255, 0.2); color: #6c63ff; border: 1px solid #6c63ff;">⬆️</button>
                        <button onclick="moveGroupDown(${group.id})" class="action-btn" style="background: rgba(108, 99, 255, 0.2); color: #6c63ff; border: 1px solid #6c63ff;">⬇️</button>
                        <button onclick="deleteGroup(${group.id})" class="action-btn delete-btn">🗑️ 删除</button>
                    </div>
                </div>
            `).join('');
        }

        // 更新分组选择框
        function updateGroupSelects() {
            const groupSelect = document.getElementById('groupSelect');
            const editGroupSelect = document.getElementById('editGroupSelect');
            const options = allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
            groupSelect.innerHTML = '<option value="">-- 请选择分组（可选） --</option>' + options;
            editGroupSelect.innerHTML = '<option value="">-- 请选择分组（可选） --</option>' + options;
        }

        // 创建新分组
        async function addNewGroup() {
            const name = document.getElementById('groupNameInput').value.trim();
            
            if (!name) {
                showMessage('⚠️ 请输入分组名称', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, order_index: allGroups.length + 1 })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✅ 分组创建成功！', 'success');
                    document.getElementById('groupNameInput').value = '';
                    loadGroups();
                } else {
                    showMessage('❌ 创建失败：' + result.error, 'error');
                }
            } catch (error) {
                console.error('创建分组失败:', error);
                showMessage('❌ 网络请求失败', 'error');
            }
        }

        // 重命名分组
        async function renameGroup(id, newName) {
            if (!newName || !newName.trim()) {
                showMessage('⚠️ 分组名称不能为空', 'error');
                loadGroups(); // 恢复原名称
                return;
            }
            
            try {
                const response = await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, name: newName.trim() })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // 更新本地数据
                    const group = allGroups.find(g => g.id === id);
                    if (group) group.name = newName.trim();
                } else {
                    showMessage('❌ 重命名失败：' + result.error, 'error');
                    loadGroups();
                }
            } catch (error) {
                console.error('重命名分组失败:', error);
                loadGroups();
            }
        }

        // 上移分组
        async function moveGroupUp(id) {
            const group = allGroups.find(g => g.id === id);
            if (!group) return;
            
            const index = allGroups.findIndex(g => g.id === id);
            if (index === 0) {
                showMessage('⚠️ 已经是第一个分组', 'error');
                return;
            }
            
            const prevGroup = allGroups[index - 1];
            const tempOrder = group.order_index;
            
            try {
                await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, order_index: prevGroup.order_index })
                });
                
                await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: prevGroup.id, order_index: tempOrder })
                });
                
                loadGroups();
            } catch (error) {
                console.error('移动分组失败:', error);
            }
        }

        // 下移分组
        async function moveGroupDown(id) {
            const group = allGroups.find(g => g.id === id);
            if (!group) return;
            
            const index = allGroups.findIndex(g => g.id === id);
            if (index === allGroups.length - 1) {
                showMessage('⚠️ 已经是最后一个分组', 'error');
                return;
            }
            
            const nextGroup = allGroups[index + 1];
            const tempOrder = group.order_index;
            
            try {
                await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, order_index: nextGroup.order_index })
                });
                
                await fetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: nextGroup.id, order_index: tempOrder })
                });
                
                loadGroups();
            } catch (error) {
                console.error('移动分组失败:', error);
            }
        }

        // 删除分组
        async function deleteGroup(id) {
            if (!confirm('确定要删除该分组吗？')) return;
            
            try {
                const response = await fetch('/api/groups', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showMessage('✅ 分组删除成功！', 'success');
                    loadGroups();
                } else {
                    showMessage('❌ 删除失败：' + result.error, 'error');
                }
            } catch (error) {
                console.error('删除分组失败:', error);
                showMessage('❌ 网络请求失败', 'error');
            }
        }

        async function loadRoster() {
            const rosterList = document.getElementById('rosterList');
            rosterList.innerHTML = '<div class="loading">加载中...</div>';
            const today = DateUtils.todayBeijing();
            
            try {
                const personsRes = await fetch('/api/persons');
                const personsData = await personsRes.json();
                if (personsData.success) {
                    allowedPersonsList = personsData.data || [];
                }
                
                const response = await fetch('/api/bindings');
                const result = await response.json();
                if (response.ok && result.success) {
                    allRoster = result.data || [];
                    allRoster.sort((a, b) => {
                        const aIdx = shiftConfig.findIndex(s => s.name === a.duty_time);
                        const bIdx = shiftConfig.findIndex(s => s.name === b.duty_time);
                        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                    });
                    displayRoster(allRoster);
                } else {
                    showMessage('加载失败：' + (result.error || '未知错误'), 'error');
                }
            } catch (error) {
                console.error('加载排班失败:', error);
                showMessage('网络请求失败', 'error');
            }
        }

        function displayRoster(data) {
            const rosterList = document.getElementById('rosterList');
            
            if (data.length === 0) {
                rosterList.innerHTML = '<div class="roster-empty">' + (currentSearch ? '未找到匹配的排班' : '今日暂无排班（可在下方添加）') + '</div>';
            } else {
                data.sort((a, b) => {
                    const aIdx = shiftConfig.findIndex(s => s.name === a.duty_time);
                    const bIdx = shiftConfig.findIndex(s => s.name === b.duty_time);
                    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                });
                
                rosterList.innerHTML = data.map(item => {
                    const safeTime = String(item.duty_time || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const safeName = String(item.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const safeGroupName = String(item.group_name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const groupIdVal = item.group_id || 'null';
                    const groupHtml = item.group_name ? '<span class="roster-group">' + safeGroupName + '</span>' : '';
                    return '<div class="roster-item">' +
                        '<div class="roster-info">' +
                            '<span class="roster-time">' + safeTime + '</span>' +
                            '<span class="roster-name">' + safeName + '</span>' +
                            groupHtml +
                        '</div>' +
                        '<div class="roster-actions">' +
                            '<button onclick="showEditForm(\'' + safeTime + '\', \'' + safeName + '\', ' + groupIdVal + ')" class="action-btn edit-time-btn">\u270F\uFE0F 修改时段</button>' +
                            '<button onclick="deleteShift(\'' + safeTime + '\', \'' + safeName + '\')" class="action-btn delete-btn">\ud83d\uddd1\ufe0f 删除</button>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }
        }

        function searchRoster() {
            const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
            const searchBtn = document.querySelector('.search-box .search-btn');
            
            if (!keyword) {
                displayRoster(allRoster);
                currentSearch = '';
                showMessage('已显示全部排班', 'success');
                return;
            }
            
            searchBtn.classList.add('searching');
            
            currentSearch = keyword;
            const filtered = allRoster.filter(item => item.name.toLowerCase().includes(keyword));
            
            setTimeout(() => {
                displayRoster(filtered);
                searchBtn.classList.remove('searching');
                
                if (filtered.length === 0) {
                    showMessage('未找到匹配 "' + keyword + '" 的排班', 'error');
                } else {
                    showMessage('找到 ' + filtered.length + ' 条匹配结果', 'success');
                }
            }, 100);
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            currentSearch = '';
            displayRoster(allRoster);
        }

        async function batchDeleteConfig() {
            if (!checkAdminAuth()) return;
            var keyword = document.getElementById('searchInput').value.trim().toLowerCase();
            var targets = keyword
                ? allRoster.filter(function(item) { return item.name.toLowerCase().includes(keyword); })
                : allRoster;
            if (targets.length === 0) {
                showMessage('没有可删除的排班', 'error');
                return;
            }
            var names = targets.map(function(item) { return item.name; });
            var confirmMsg = '确定要删除以下 ' + targets.length + ' 人的排班吗？\n\n' +
                names.slice(0, 20).join('、') + (names.length > 20 ? '...等共 ' + names.length + ' 人' : '') + '\n\n此操作不可撤销！';
            if (!confirm(confirmMsg)) return;

            var today = DateUtils.todayBeijing();
            try {
                var resp = await fetch('/api/config', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: today, names: names })
                });
                var result = await resp.json();
                if (resp.ok) {
                    targets.forEach(function(t) {
                        if (t.duty_time) {
                            fetch('/api/bindings', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ duty_time: t.duty_time, name: t.name })
                            });
                        }
                    });
                    showMessage('已删除 ' + targets.length + ' 条排班', 'success');
                    setTimeout(function() { loadRoster(); }, 500);
                } else {
                    showMessage('删除失败：' + result.error, 'error');
                }
            } catch (e) {
                console.error('批量删除失败:', e);
                showMessage('网络请求失败', 'error');
            }
        }

        async function assignShift() {
            if (!checkAdminAuth()) return;
            
            const shift = document.getElementById('shiftSelect').value.trim();
            const name = document.getElementById('nameInput').value.trim();
            const groupId = document.getElementById('groupSelect').value || null;
            
            if (!shift) { showMessage('⚠️ 请选择值班时段', 'error'); return; }
            if (!name) { showMessage('⚠️ 请输入昵称', 'error'); return; }
            
            const today = DateUtils.todayBeijing();
            
            try {
                // 1. 添加到当天排班
                const config = [{ duty_date: today, duty_time: shift, name: name }];
                if (groupId) config[0].group_id = parseInt(groupId);
                
                const configRes = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: today, config: config })
                });
                
                // 2. 同时添加到绑定表（永久有效）
                await fetch('/api/bindings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duty_time: shift, name: name, group_id: groupId })
                }).catch(e => console.warn('添加到绑定表失败:', e));
                
                const result = await configRes.json();
                if (configRes.ok) {
                    // 添加到人员白名单
                    await fetch('/api/persons', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name })
                    }).catch(e => console.warn('添加到人员名单失败:', e));
                    
                    showMessage('✅ 安排成功！', 'success');
                    document.getElementById('shiftSelect').value = '';
                    document.getElementById('nameInput').value = '';
                    document.getElementById('groupSelect').value = '';
                    setTimeout(() => loadRoster(), 1000);
                } else {
                    showMessage('❌ 安排失败：' + result.error, 'error');
                }
            } catch (error) {
                console.error('安排值班失败:', error);
                showMessage('❌ 网络请求失败', 'error');
            }
        }

        function showEditForm(oldShift, name, currentGroupId) {
            document.getElementById('editOldShift').value = oldShift;
            document.getElementById('editName').value = name;
            document.getElementById('editNewShift').value = '';
            if (currentGroupId) {
                document.getElementById('editGroupSelect').value = currentGroupId;
            } else {
                document.getElementById('editGroupSelect').value = '';
            }
            document.getElementById('editForm').classList.add('active');
            document.getElementById('editForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function cancelEdit() {
            document.getElementById('editForm').classList.remove('active');
        }

        async function saveEditShift() {
            if (!checkAdminAuth()) return;
            
            const oldShift = document.getElementById('editOldShift').value;
            const name = document.getElementById('editName').value;
            const newShift = document.getElementById('editNewShift').value;
            const groupId = document.getElementById('editGroupSelect').value || null;
            
            if (!newShift) { showMessage('⚠️ 请选择新时段', 'error'); return; }
            if (newShift === oldShift) { showMessage('⚠️ 新时段与原时段相同', 'error'); return; }
            
            const today = DateUtils.todayBeijing();
            
            try {
                // 1. 先删除旧的特定时段排班（时段 + 姓名）
                await Promise.all([
                    fetch('/api/config', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: today, duty_time: oldShift, name: name })
                    }),
                    fetch('/api/bindings', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ duty_time: oldShift, name: name })
                    })
                ]);
                
                // 2. 再添加新的时段排班
                const config = [{ duty_date: today, duty_time: newShift, name: name }];
                if (groupId) config[0].group_id = parseInt(groupId);
                
                const addResponse = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        date: today, 
                        config: config 
                    })
                });
                
                const addResult = await addResponse.json();
                if (addResponse.ok) {
                    fetch('/api/bindings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ duty_time: newShift, name: name, group_id: groupId || null })
                    });
                    showMessage('✅ 修改成功！', 'success');
                    cancelEdit();
                    setTimeout(() => loadRoster(), 500);
                } else {
                    showMessage('❌ 修改失败：' + addResult.error, 'error');
                }
            } catch (error) {
                console.error('修改时段失败:', error);
                showMessage('❌ 网络请求失败', 'error');
            }
        }

        // 加载打卡周期设置
        async function loadCycleSettings() {
            let cycleStart = null;
            let settingsData = null;
            
            // 优先尝试从后端获取最新设置（只调用一次）
            try {
                const res = await fetch('/api/settings');
                settingsData = await res.json();
                console.log('从后端获取设置:', settingsData);
                if (settingsData.success && settingsData.cycleStartDate) {
                    cycleStart = settingsData.cycleStartDate;
                }
            } catch (e) {
                console.error('Failed to load settings', e);
            }

            // 如果后端没有，则读取 localStorage
            if (!cycleStart) {
                cycleStart = localStorage.getItem('cycleStartDate');
            }
            
            // 显示数据
            if (cycleStart) {
                localStorage.setItem('cycleStartDate', cycleStart);
                document.getElementById('cycleStartDate').value = cycleStart;
                document.getElementById('currentCycleStart').innerText = cycleStart;
            } else {
                const today = DateUtils.todayBeijing();
                document.getElementById('cycleStartDate').value = today;
                document.getElementById('currentCycleStart').innerText = today;
            }
            
            // 加载统计信息（复用 settingsData，避免重复请求）
            loadCycleStats(cycleStart, settingsData);
        }

        // 加载周期统计
        async function loadCycleStats(cycleStart, cachedSettingsData = null) {
            try {
                // 使用缓存的设置数据，避免重复请求
                const data = cachedSettingsData || (await fetch('/api/settings').then(res => res.json()));
                
                console.log('统计 API 返回数据:', data);
                
                if (data.success) {
                    document.getElementById('totalRecords').innerText = data.totalRecords || 0;
                    
                    // 计算已打卡天数 - 需要获取详细记录
                    if (cycleStart) {
                        const recordsUrl = `/api/records?start_date=${cycleStart}`;
                        const recordsResponse = await fetch(recordsUrl);
                        const recordsData = await recordsResponse.json();
                        
                        console.log('打卡记录数据:', recordsData);
                        
                        // 统一处理 {success: true, data: [...]} 格式
                        const records = recordsData.success ? (recordsData.data || []) : [];
                        
                        if (records.length > 0) {
                            const uniqueDates = new Set(records.map(r => r.duty_date));
                            document.getElementById('checkedDays').innerText = uniqueDates.size;
                        } else {
                            document.getElementById('checkedDays').innerText = 0;
                        }
                    }
                }
            } catch (error) {
                console.error('加载统计失败:', error);
            }
        }

        // 保存打卡周期设置
        async function saveCycleSettings() {
            if (!checkAdminAuth()) return;
            
            const newStartDate = document.getElementById('cycleStartDate').value;
            const oldStartDate = localStorage.getItem('cycleStartDate');
            
            if (!newStartDate) {
                showMessage('⚠️ 请选择起始日期', 'error');
                return;
            }
            
            // 如果日期没有变化，提示用户
            if (newStartDate === oldStartDate) {
                showMessage('⚠️ 起始日期没有变化', 'error');
                return;
            }
            
            // 确认是否要清空记录
            const confirmed = confirm(
                `⚠️ 警告：保存新的打卡设置后，将清空所有历史打卡记录！\n\n` +
                `当前起始日期：${oldStartDate || '未设置'}\n` +
                `新的起始日期：${newStartDate}\n\n` +
                `确定要继续吗？`
            );
            
            if (!confirmed) return;
            
            try {
                // 1. 清空所有打卡记录
                const clearResponse = await fetch('/api/admin/clear-records', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '')
                    }
                });
                
                const clearResult = await clearResponse.json();
                
                if (!clearResponse.ok) {
                    throw new Error(clearResult.error || '清空记录失败');
                }
                
                // 2. 保存新的周期起始日期到数据库和 localStorage
                const saveRes = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cycleStartDate: newStartDate })
                });
                const saveResult = await saveRes.json();
                console.log('保存 settings 结果:', saveResult, 'status:', saveRes.status);
                
                if (!saveRes.ok) {
                    throw new Error(saveResult.error || '保存 settings 失败');
                }
                
                localStorage.setItem('cycleStartDate', newStartDate);
                document.getElementById('currentCycleStart').innerText = newStartDate;
                
                showMessage('✅ 打卡设置已保存，历史记录已清空！', 'success');
                
                // 刷新统计信息
                loadCycleStats();
            } catch (error) {
                console.error('保存设置失败:', error);
                showMessage('❌ 保存失败：' + error.message, 'error');
            }
        }

        async function deleteShift(dutyTime, name) {
            if (!checkAdminAuth()) return;
            if (!confirm(`确定要删除 ${dutyTime} ${name} 的排班吗？`)) return;
            const today = DateUtils.todayBeijing();
            
            try {
                const response = await fetch('/api/config', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        date: today, 
                        duty_time: dutyTime,
                        name: name 
                    })
                });
                
                const result = await response.json();
                if (response.ok) {
                    fetch('/api/bindings', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ duty_time: dutyTime, name: name })
                    });
                    showMessage('✅ 删除成功', 'success');
                    setTimeout(() => loadRoster(), 500);
                } else {
                    showMessage('❌ 删除失败：' + result.error, 'error');
                }
            } catch (error) {
                console.error('删除排班失败:', error);
                showMessage('❌ 网络请求失败', 'error');
            }
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

        // 管理登录功能 - 使用 localStorage 存储登录状态
        // 遮罩层登录处理
        function handleOverlayLogin() {
            const username = document.getElementById('overlayUsername').value.trim();
            const password = document.getElementById('overlayPassword').value.trim();
            const msgEl = document.getElementById('overlayMessage');

            if (!username || !password) {
                msgEl.innerText = '⚠️ 请输入账号和密码';
                msgEl.style.color = '#ff6b6b';
                return;
            }

            msgEl.innerText = '正在登录...';
            msgEl.style.color = '#b0b0c0';

            const apiUrl = window.location.origin + '/api/admin/login';
            fetch(apiUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify({username: username, password: password})
            })
            .then(res => {
                console.log('API 响应状态:', res.status);
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    msgEl.innerText = '✅ 登录成功';
                    msgEl.style.color = '#4CAF50';
                    localStorage.setItem('isAdminLoggedIn', 'true');
                    localStorage.setItem('adminUsername', username);
                    localStorage.setItem('adminToken', data.token || '');
                    console.log('登录成功，准备进入后台并加载数据');

                    setTimeout(() => {
                        const overlay = document.getElementById('loginOverlay');
                        const prompt = document.getElementById('loginPrompt');
                        if (overlay) overlay.style.setProperty('display', 'none', 'important');
                        if (prompt) prompt.style.setProperty('display', 'none', 'important');
                        
                        const adminInfo = document.getElementById('adminInfo');
                        if (adminInfo) adminInfo.style.display = 'block';
                        
                        const adminName = document.getElementById('adminName');
                        if (adminName) adminName.innerText = username;

                        // 关键修复：登录后显式加载所有数据
                        if (typeof loadCycleSettings === 'function') loadCycleSettings();
                        if (typeof loadRoster === 'function') loadRoster();
                        
                        console.log('已调用数据加载函数');
                    }, 500);
                } else {
                    msgEl.innerText = '❌ ' + (data.error || '登录失败');
                    msgEl.style.color = '#ff6b6b';
                }
            })
            .catch(err => {
                msgEl.innerText = '❌ 网络请求失败';
                msgEl.style.color = '#ff6b6b';
                console.error('Login fetch error:', err);
            });
        }

        // 管理登录功能
        function showLoginModal() {
            document.getElementById('loginModal').style.display = 'flex';
            document.getElementById('loginMessage').innerText = '';
            document.getElementById('adminUsername').value = '';
            document.getElementById('adminPassword').value = '';
            // 保持遮罩层显示
            document.getElementById('loginOverlay').style.display = 'flex';
        }

        // 原有的登录逻辑（备用）
        function handleLogin() {
            const username = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value.trim();
            const msgEl = document.getElementById('loginMessage');
            
            // 调用后端 API 进行认证
            fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // 存储管理员信息到 localStorage (页面会话有效)
                    localStorage.setItem('isAdminLoggedIn', 'true');
                    localStorage.setItem('adminUsername', username);
                    localStorage.setItem('adminToken', data.token || '');
                    
                    // 隐藏登录弹窗和遮罩
                    document.getElementById('loginModal').style.display = 'none';
                    document.getElementById('loginOverlay').style.display = 'none';
                    // 隐藏登录提示区域
                    document.getElementById('loginPrompt').style.display = 'none';
                    // 显示管理员信息
                    document.getElementById('adminInfo').style.display = 'block';
                    document.getElementById('adminName').innerText = username;
                    
                    // 刷新页面数据
                    loadRoster();
                } else {
                    msgEl.innerText = '❌ ' + (data.error || '登录失败');
                }
            })
            .catch(error => {
                console.error('登录请求失败:', error);
                msgEl.innerText = '❌ 网络请求失败';
            });
        }

        function handleLogout() {
            localStorage.removeItem('isAdminLoggedIn');
            localStorage.removeItem('adminUsername');
            localStorage.removeItem('adminToken');
            location.reload();
        }

        // 页面加载时检查登录状态
        window.addEventListener('DOMContentLoaded', function() {
            const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
            if (isLoggedIn === 'true') {
                const username = localStorage.getItem('adminUsername');
                // 隐藏登录弹窗和遮罩
                const loginModal = document.getElementById('loginModal');
                const loginOverlay = document.getElementById('loginOverlay');
                const loginPrompt = document.getElementById('loginPrompt');
                const adminInfo = document.getElementById('adminInfo');
                const adminName = document.getElementById('adminName');
                
                if (loginModal) loginModal.style.setProperty('display', 'none', 'important');
                if (loginOverlay) loginOverlay.style.setProperty('display', 'none', 'important');
                if (loginPrompt) loginPrompt.style.setProperty('display', 'none', 'important');
                if (adminInfo) adminInfo.style.setProperty('display', 'block', 'important');
                if (adminName) adminName.innerText = username || '管理员';
                
                console.log('✅ 管理员已登录:', username);
            }
        });

        // 支持回车登录
        document.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const loginModal = document.getElementById('loginModal');
                if (loginModal && loginModal.style.display !== 'none') {
                    handleLogin();
                }
            }
        });

        // 检查登录状态的辅助函数
        function checkAdminAuth() {
            const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
            if (isLoggedIn !== 'true') {
                alert('请先登录管理员账号');
                showLoginModal();
                return false;
            }
            return true;
        }

        function loadAnnouncements() {
            fetch('/api/announcements').then(r => r.json()).then(data => {
                var list = (data.success ? data.data : []) || [];
                var tbody = document.getElementById('announcementBody');
                if (list.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#8c92ac;">暂无公告</td></tr>';
                    return;
                }
                tbody.innerHTML = list.map(function(a) {
                    return '<tr>' +
                        '<td style="text-align:left;">' + a.content + '</td>' +
                        '<td>' + a.created_at + '</td>' +
                        '<td><button onclick="deleteAnnouncement(' + a.id + ')" style="padding:4px 10px;background:#f44336;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:12px;">删除</button></td>' +
                    '</tr>';
                }).join('');
            }).catch(function(e) {
                console.error('Load announcements error:', e);
            });
        }

        function addAnnouncement() {
            var input = document.getElementById('announcementInput');
            var content = input.value.trim();
            if (!content) { alert('请输入公告内容'); return; }

            fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    input.value = '';
                    loadAnnouncements();
                } else {
                    alert(data.error || '添加失败');
                }
            }).catch(function(e) {
                alert('网络错误: ' + e.message);
            });
        }

        function deleteAnnouncement(id) {
            if (!confirm('确定要删除这条公告吗？')) return;
            fetch('/api/announcements?id=' + encodeURIComponent(id), { method: 'DELETE' })
                .then(r => r.json()).then(data => {
                    if (data.success) loadAnnouncements();
                    else alert(data.error || '删除失败');
                }).catch(function(e) {
                    alert('网络错误: ' + e.message);
                });
        }

        function updateBatchSelects() {
            var batchShift = document.getElementById('batchShift');
            var batchGroup = document.getElementById('batchGroup');

            batchShift.innerHTML = '<option value="">-- 请选择值班时段 --</option>';
            shiftConfig.forEach(function(s) {
                batchShift.innerHTML += '<option value="' + s.name + '">' + s.name + '</option>';
            });

            batchGroup.innerHTML = '<option value="">-- 不指定分组 --</option>';
            allGroups.forEach(function(g) {
                batchGroup.innerHTML += '<option value="' + g.id + '">' + g.name + '</option>';
            });

            var today = new Date();
            var bj = new Date(today.getTime() + 8 * 60 * 60 * 1000);
            var pad = function(n) { return String(n).padStart(2, '0'); };
            var dateStr = bj.getUTCFullYear() + '-' + pad(bj.getUTCMonth() + 1) + '-' + pad(bj.getUTCDate());
            document.getElementById('batchDate').value = dateStr;
            document.getElementById('smartImportDate').value = dateStr;
        }

        function batchAddConfig() {
            var date = document.getElementById('batchDate').value;
            var shift = document.getElementById('batchShift').value;
            var groupId = document.getElementById('batchGroup').value;
            var namesText = document.getElementById('batchNames').value.trim();

            if (!date) { alert('请选择日期'); return; }
            if (!shift) { alert('请选择时段'); return; }
            if (!namesText) { alert('请输入人员名单'); return; }

            var names = namesText.split(/[\n,;，；]+/).map(function(n) { return n.trim(); }).filter(function(n) { return n; });

            if (names.length === 0) { alert('未解析到有效姓名'); return; }

            var result = document.getElementById('batchResult');
            result.textContent = '添加中...';
            result.style.color = '#8c92ac';

            fetch('/api/batch-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    names: names,
                    start_date: date,
                    end_date: DateUtils.todayBeijing(),
                    duty_time: shift,
                    group_id: groupId || null
                })
            }).then(r => r.json()).then(data => {
                if (data.success) {
                    result.textContent = '成功添加 ' + data.inserted + ' 人' + (data.skipped > 0 ? '，跳过 ' + data.skipped + ' 人（已存在）' : '');
                    result.style.color = '#4CAF50';
                    document.getElementById('batchNames').value = '';
                    names.forEach(function(n) {
                        fetch('/api/bindings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ duty_time: shift, name: n, group_id: groupId || null })
                        });
                    });
                } else {
                    result.textContent = '失败: ' + (data.error || '未知错误');
                    result.style.color = '#f44336';
                }
            }).catch(function(e) {
                result.textContent = '网络错误: ' + e.message;
                result.style.color = '#f44336';
            });
        }

        var smartImportParsed = [];

        function parseChineseTime(startStr, endStr) {
            function parseOne(p) {
                p = p.replace(/\s+/g, '');
                var hm = p.match(/^(\d+):(\d+)$/);
                if (hm) {
                    var h = parseInt(hm[1]), m = parseInt(hm[2]);
                    if (h === 24) h = 0;
                    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
                }
                var cm = p.match(/^(\d+)点(\d+)?$/);
                if (cm) {
                    var h2 = parseInt(cm[1]), m2 = cm[2] ? parseInt(cm[2]) : 0;
                    if (h2 === 24) h2 = 0;
                    return String(h2).padStart(2, '0') + ':' + String(m2).padStart(2, '0');
                }
                return null;
            }
            var s = parseOne(startStr), e = parseOne(endStr);
            return s && e ? s + '-' + e : null;
        }

        function smartImportPreview() {
            var text = document.getElementById('smartImportText').value;
            var dateEl = document.getElementById('smartImportDate');
            var today = new Date();
            var bj = new Date(today.getTime() + 8 * 60 * 60 * 1000);
            var pad = function(n) { return String(n).padStart(2, '0'); };
            if (!dateEl.value) {
                dateEl.value = bj.getUTCFullYear() + '-' + pad(bj.getUTCMonth() + 1) + '-' + pad(bj.getUTCDate());
            }

            smartImportParsed = parseSmartImport(text);
            var preview = document.getElementById('smartImportPreview');
            var result = document.getElementById('smartImportResult');

            if (smartImportParsed.length === 0) {
                preview.innerHTML = '<p style="color:#ff6b6b;text-align:center;">未解析到有效排班数据，请检查格式</p>';
                result.textContent = '';
                return;
            }

            var html = '<table class="shift-table" style="font-size:12px;"><thead><tr><th>分组</th><th>时段</th><th>人员</th></tr></thead><tbody>';
            smartImportParsed.forEach(function(item) {
                html += '<tr><td>' + (item.group || '-') + '</td><td>' + item.duty_time + '</td><td style="text-align:left;">' + item.names.join('、') + '</td></tr>';
            });
            html += '</tbody></table>';
            preview.innerHTML = html;
            result.textContent = '解析到 ' + smartImportParsed.length + ' 个排班条目';
            result.style.color = '#4CAF50';
        }

        function parseSmartImport(text) {
            var lines = text.split('\n');
            var currentGroup = null;
            var currentSlot = null;
            var results = [];
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;

                // Skip numbered list headers
                if (/^\d+[、.．]/.test(line)) continue;

                // Group name detection: "会议室值班" or "会议室值班："
                if (/(值班|分组)\s*[：:]?\s*$/.test(line)) {
                    currentGroup = line.replace(/[：:]/g, '').replace(/\s+/g, '').replace(/值班$/, '').replace(/分组$/, '').trim();
                    currentSlot = null;
                    continue;
                }

                // Skip header lines like "六、23点～24点查缺补漏"，but extract time from them
                if (/^[一二三四五六七八九十]+[、.．]/.test(line)) {
                    var inner = line.match(/(\d+点(?:\s*\d+)?)\s*[～~到\-]\s*(\d+点(?:\s*\d+)?|\d+:\d+)/);
                    if (inner) {
                        var dt = parseChineseTime(inner[1], inner[2]);
                        if (dt) currentSlot = dt;
                    }
                    continue;
                }

                // Try time slot pattern: "8点～9点30" or "8点～9点30：张三，李四" or "18点 30～20点"
                var tm = line.match(/^(\d+点(?:\s*\d+)?)\s*[～~到\-]\s*(\d+点(?:\s*\d+)?|\d+:\d+)([：:]\s*(.*))?$/);
                if (tm) {
                    var startStr = tm[1], endStr = tm[2];
                    var namesAfter = tm[4] ? tm[4].trim() : '';
                    var dutyTime = parseChineseTime(startStr, endStr);
                    if (dutyTime) {
                        if (namesAfter && /[,，、]/.test(namesAfter)) {
                            var namesArr = namesAfter.split(/[,，、]+/).map(function(n) { return n.trim(); }).filter(function(n) { return n && !/^\d/.test(n); });
                            if (namesArr.length > 0) {
                                results.push({ group: currentGroup, duty_time: dutyTime, names: namesArr });
                            }
                            currentSlot = dutyTime;
                        } else {
                            currentSlot = dutyTime;
                        }
                    }
                    continue;
                }

                // Comma line with names
                if (/[,，、]/.test(line) && currentGroup) {
                    var cleanLine = line.replace(/^[^,，、]+[：:]/g, '').replace(/^\d+[、.．]\s*/, '').replace(/查缺补漏.*$/, '');
                    var namesOnly = cleanLine.split(/[,，、]+/).map(function(n) { return n.trim(); }).filter(function(n) { return n && !/^\d/.test(n) && !/[：:]/.test(n) && n.length > 0 && !/^[\u4e00-\u9fa5]{1,2}[:：]/.test(n); });
                    if (namesOnly.length > 0 && currentSlot) {
                        results.push({ group: currentGroup, duty_time: currentSlot, names: namesOnly });
                    }
                }
            }

            return results;
        }

        function smartImportSubmit() {
            if (smartImportParsed.length === 0) {
                smartImportPreview();
                if (smartImportParsed.length === 0) return;
            }

            var date = document.getElementById('smartImportDate').value;
            if (!date) { alert('请选择日期'); return; }

            if (!confirm('确定要导入 ' + smartImportParsed.length + ' 个排班条目到 ' + date + ' 吗？')) return;

            var result = document.getElementById('smartImportResult');
            result.textContent = '导入中...';
            result.style.color = '#8c92ac';

            var completed = 0, total = 0;
            var pending = 0;
            var today = DateUtils.todayBeijing();
            smartImportParsed.forEach(function(item) {
                var names = item.names;
                total += names.length;
                pending++;
                fetch('/api/batch-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        names: names,
                        start_date: date,
                        end_date: today,
                        duty_time: item.duty_time,
                        group_id: item.group ? findGroupId(item.group) : null
                    })
                }).then(function(r) { return r.json(); }).then(function(data) {
                    if (data.success && data.inserted > 0) completed += data.inserted;
                    names.forEach(function(n) {
                        fetch('/api/bindings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ duty_time: item.duty_time, name: n, group_id: item.group ? findGroupId(item.group) : null })
                        });
                    });
                }).catch(function() {}).finally(function() {
                    pending--;
                    if (pending === 0) {
                        result.textContent = '导入完成: 成功 ' + completed + '/' + total;
                        result.style.color = '#4CAF50';
                    }
                });
            });
        }

        function findGroupId(groupName) {
            if (!groupName) return null;
            for (var i = 0; i < allGroups.length; i++) {
                if (allGroups[i].name === groupName || allGroups[i].name.indexOf(groupName) !== -1 || groupName.indexOf(allGroups[i].name) !== -1) {
                    return allGroups[i].id;
                }
            }
            return null;
        }
    </script>
