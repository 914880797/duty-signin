        async function loadRoster() {
            const rosterList = document.getElementById('rosterList');
            rosterList.innerHTML = '<div class="loading">加载中...</div>';
            const today = DateUtils.todayBeijing();
            
            try {
                const personsData = await adminFetch('/api/persons');
                if (personsData.success) {
                    allowedPersonsList = personsData.data || [];
                }

                const result = await adminFetch('/api/bindings');
                if (result.success) {
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
                    const safeTime = AppUtils.escapeHtml(item.duty_time || '');
                    const safeName = AppUtils.escapeHtml(item.name || '');
                    const safeGroupName = AppUtils.escapeHtml(item.group_name || '');
                    const attrTime = String(item.duty_time || '').replace(/'/g, "\\'");
                    const attrName = String(item.name || '').replace(/'/g, "\\'");
                    const groupIdVal = item.group_id || 'null';
                    const groupHtml = item.group_name ? '<span class="roster-group">' + safeGroupName + '</span>' : '';
                    return '<div class="roster-item">' +
                        '<div class="roster-info">' +
                            '<span class="roster-time">' + safeTime + '</span>' +
                            '<span class="roster-name">' + safeName + '</span>' +
                            groupHtml +
                        '</div>' +
                        '<div class="roster-actions">' +
                            '<button onclick="showEditForm(\'' + attrTime + '\', \'' + attrName + '\', ' + groupIdVal + ')" class="action-btn edit-time-btn">\u270F\uFE0F 修改时段</button>' +
                            '<button onclick="deleteShift(\'' + attrTime + '\', \'' + attrName + '\')" class="action-btn delete-btn">\ud83d\uddd1\ufe0f 删除</button>' +
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
                var result = await adminFetch('/api/config', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: today, names: names })
                });
                if (result.success) {
                    targets.forEach(function(t) {
                        if (t.duty_time) {
                            adminFetch('/api/bindings', {
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
                
                const result = await adminFetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: today, config: config })
                });

                // 2. 同时添加到绑定表（永久有效）
                adminFetch('/api/bindings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duty_time: shift, name: name, group_id: groupId })
                }).catch(e => console.warn('添加到绑定表失败:', e));

                if (result.success) {
                    // 添加到人员白名单
                    adminFetch('/api/persons', {
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
                    adminFetch('/api/config', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ date: today, duty_time: oldShift, name: name })
                    }),
                    adminFetch('/api/bindings', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ duty_time: oldShift, name: name })
                    })
                ]);
                
                // 2. 再添加新的时段排班
                const config = [{ duty_date: today, duty_time: newShift, name: name }];
                if (groupId) config[0].group_id = parseInt(groupId);
                
                const addResult = await adminFetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        date: today, 
                        config: config 
                    })
                });

                if (addResult.success) {
                    adminFetch('/api/bindings', {
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
