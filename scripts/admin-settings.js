        async function loadCycleSettings() {
            let cycleStart = null;
            let settingsData = null;
            
            // 优先尝试从后端获取最新设置（只调用一次）
            try {
                const res = await adminFetch('/api/settings');
                settingsData = await res.json();
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
                const data = cachedSettingsData || (await adminFetch('/api/settings').then(res => res.json()));
                
                if (data.success) {
                    document.getElementById('totalRecords').innerText = data.totalRecords || 0;
                    
                    if (cycleStart) {
                        const recordsUrl = `/api/records?start_date=${cycleStart}`;
                        const recordsResponse = await adminFetch(recordsUrl);
                        const recordsData = await recordsResponse.json();
                        
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
                const clearResponse = await adminFetch('/api/admin/clear-records', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const clearResult = await clearResponse.json();
                
                if (!clearResponse.ok) {
                    throw new Error(clearResult.error || '清空记录失败');
                }
                
                // 2. 保存新的周期起始日期到数据库和 localStorage
                const saveRes = await adminFetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cycleStartDate: newStartDate })
                });
                const saveResult = await saveRes.json();

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
                const response = await adminFetch('/api/config', {
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
                    adminFetch('/api/bindings', {
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
