        function loadAnnouncements() {
            adminFetch('/api/announcements').then(r => r.json()).then(data => {
                var list = (data.success ? data.data : []) || [];
                var tbody = document.getElementById('announcementBody');
                if (list.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#8c92ac;">暂无公告</td></tr>';
                    return;
                }
                tbody.innerHTML = list.map(function(a) {
                    return '<tr>' +
                        '<td style="text-align:left;">' + AppUtils.escapeHtml(a.content) + '</td>' +
                        '<td>' + AppUtils.escapeHtml(a.created_at) + '</td>' +
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

            adminFetch('/api/announcements', {
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
            adminFetch('/api/announcements?id=' + encodeURIComponent(id), { method: 'DELETE' })
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
                batchShift.innerHTML += '<option value="' + AppUtils.escapeHtml(s.name) + '">' + AppUtils.escapeHtml(s.name) + '</option>';
            });

            batchGroup.innerHTML = '<option value="">-- 不指定分组 --</option>';
            allGroups.forEach(function(g) {
                batchGroup.innerHTML += '<option value="' + g.id + '">' + AppUtils.escapeHtml(g.name) + '</option>';
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

            adminFetch('/api/batch-config', {
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
                        adminFetch('/api/bindings', {
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
                html += '<tr><td>' + AppUtils.escapeHtml(item.group || '-') + '</td><td>' + AppUtils.escapeHtml(item.duty_time) + '</td><td style="text-align:left;">' + AppUtils.escapeHtml(item.names.join('、')) + '</td></tr>';
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
                adminFetch('/api/batch-config', {
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
                        adminFetch('/api/bindings', {
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
