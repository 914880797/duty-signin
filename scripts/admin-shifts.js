        function loadShiftConfig() {
            shiftConfig = JSON.parse(localStorage.getItem('shiftConfig')) || AppUtils.DEFAULT_SHIFT_OBJECTS;
            oldShiftNames = {};
            shiftConfig.forEach(s => { oldShiftNames[s.id] = s.name; });
            renderShiftConfig();
            // 自动同步有效时段到后端，防止未保存导致旧时段残留
            syncValidTimesToBackend();
        }

        function syncValidTimesToBackend() {
            const validTimes = shiftConfig.map(s => s.name);
            adminFetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valid_duty_times: validTimes })
            }).then(r => r.json()).then(data => {
                if (data.success && data.deleted) {
                    // 后台静默清理完成
                }
            }).catch(e => console.error('syncValidTimes error:', e));

            adminFetch('/api/validate-timeslots', {
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
                    <td><input type="text" class="form-input" value="${AppUtils.escapeHtml(shift.name)}" onchange="updateShiftName(${shift.id}, this.value)" style="padding: 8px;"></td>
                    <td><input type="time" class="time-input" value="${AppUtils.escapeHtml(shift.startTime === '24:00' ? '00:00' : shift.startTime)}" onchange="updateShiftTime(${shift.id}, 'start', this.value)"></td>
                    <td><input type="time" class="time-input" value="${AppUtils.escapeHtml(shift.endTime === '24:00' ? '00:00' : shift.endTime)}" onchange="updateShiftTime(${shift.id}, 'end', this.value)"></td>
                    <td><button onclick="deleteShiftConfig(${shift.id})" class="delete-shift-btn">\uD83D\uDDD1\uFE0F 删除</button></td>
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
                adminFetch('/api/cleanup-timeslot', {
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
                    adminFetch('/api/rename-timeslot', {
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
            adminFetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ valid_duty_times: validTimes })
            }).catch(e => console.error('Save valid_times error:', e));

            // 清理不在当前时段配置中的遗留学段记录
            adminFetch('/api/validate-timeslots', {
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
            const options = shiftConfig.map(shift => '<option value="' + AppUtils.escapeHtml(shift.name) + '">' + AppUtils.escapeHtml(shift.name) + '</option>').join('');
            shiftSelect.innerHTML = '<option value="">-- 请选择值班时段 --</option>' + options;
            editNewShift.innerHTML = '<option value="">-- 请选择新时段 --</option>' + options;
        }
