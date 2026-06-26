        // 加载分组列表
        async function loadGroups() {
            const groupsList = document.getElementById('groupsList');
            groupsList.innerHTML = '<div class="loading">加载中...</div>';
            
            try {
                const result = await adminFetch('/api/groups');

                if (result.success) {
                    allGroups = result.data || [];
                    renderGroups(allGroups);
                    updateGroupSelects();
                } else {
                    groupsList.innerHTML = '<div class="roster-empty">加载失败：' + AppUtils.escapeHtml(result.error || '未知错误') + '</div>';
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
                        <input type="text" value="${AppUtils.escapeHtml(group.name)}" 
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
            const options = allGroups.map(g => '<option value="' + g.id + '">' + AppUtils.escapeHtml(g.name) + '</option>').join('');
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
                const result = await adminFetch('/api/groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, order_index: allGroups.length + 1 })
                });

                if (result.success) {
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
                const result = await adminFetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, name: newName.trim() })
                });

                if (result.success) {
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
                await adminFetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, order_index: prevGroup.order_index })
                });
                
                await adminFetch('/api/groups', {
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
                await adminFetch('/api/groups', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id, order_index: nextGroup.order_index })
                });
                
                await adminFetch('/api/groups', {
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
                const result = await adminFetch('/api/groups', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });

                if (result.success) {
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
