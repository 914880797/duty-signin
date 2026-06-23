        function updateClock() {
            var bj = DateUtils.getBeijingNow();
            var h = String(bj.getUTCHours()).padStart(2, '0');
            var m = String(bj.getUTCMinutes()).padStart(2, '0');
            var s = String(bj.getUTCSeconds()).padStart(2, '0');
            document.getElementById('current-time').innerText = h + ':' + m + ':' + s;
            var Y = bj.getUTCFullYear();
            var M = String(bj.getUTCMonth() + 1).padStart(2, '0');
            var D = String(bj.getUTCDate()).padStart(2, '0');
            document.getElementById('current-date').innerText = Y + '/' + M + '/' + D;
        }
        setInterval(updateClock, 1000);
        updateClock();

        function loadShiftConfig() {
            var shiftConfig = JSON.parse(localStorage.getItem('shiftConfig'));
            if (shiftConfig && shiftConfig.length > 0) {
                renderShiftGrid(shiftConfig);
                return;
            }
            loadShiftConfigFromSettings();
        }

        async function loadShiftConfigFromSettings() {
            try {
                var res = await fetch('/api/settings');
                var data = await res.json();
                var validTimes = data.validDutyTimes || [];
                if (validTimes.length > 0) {
                    var shifts = validTimes.map(function(t, i) { return { id: i + 1, name: t }; });
                    localStorage.setItem('shiftConfig', JSON.stringify(shifts));
                    renderShiftGrid(shifts);
                    return;
                }
            } catch (e) { console.error('加载时段失败:', e); }
            var shifts = AppUtils.DEFAULT_SHIFTS.map(function(t, i) { return { id: i + 1, name: t }; });
            renderShiftGrid(shifts);
        }

        function renderShiftGrid(shiftConfig) {
            var grid = document.getElementById('shiftGrid');
            grid.innerHTML = shiftConfig.map(function(shift) {
                var isNight = isNightShift(shift.name);
                return '<div class="shift-item' + (isNight ? ' night' : '') + '">' +
                    (isNight ? '🌙 ' : '') + AppUtils.escapeHtml(shift.name) + (isNight ? ' (夜班)' : '') + '</div>';
            }).join('');
        }

        function isNightShift(name) {
            if (!name) return false;
            var match = name.match(/^24:00-(\d{2}):(\d{2})$/);
            if (match) {
                var eh = parseInt(match[1]);
                return eh >= 0 && eh < 8;
            }
            return false;
        }

        loadShiftConfig();
        loadAnnouncements();

        function loadAnnouncements() {
            fetch('/api/announcements').then(r => r.json()).then(data => {
                var list = (data.success ? data.data : []) || [];
                var bar = document.getElementById('announcementBar');
                var text = document.getElementById('announcementText');

                if (list.length === 0) {
                    bar.style.display = 'none';
                    return;
                }

                bar.style.display = 'flex';
                var joined = list.map(function(a) { return a.content.slice(0, 15); }).join('　　');
                text.textContent = joined;
                text.classList.remove('empty');
            }).catch(function() {
                document.getElementById('announcementBar').style.display = 'none';
            });
        }

        async function handleSignin(event) {
            event.preventDefault();
            var nameEl = document.getElementById('name');
            var name = nameEl.value.trim();
            var btn = document.querySelector('.submit-btn');
            if (!name) { nameEl.focus(); return; }
            var currentTime = DateUtils.getBeijingNow().toISOString().substr(11, 5);
            btn.innerText = '打卡中...';
            btn.disabled = true;
            try {
                var response = await fetch('/api/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, duty_time: '', current_time: currentTime })
                });
                var result = await response.json();
                if (response.ok) {
                    alert('✅ 打卡成功！\n日期：' + result.date + '\n时间：' + result.time + '\n值班时段：' + result.duty_time);
                    nameEl.value = '';
                    nameEl.focus();
                } else if (response.status === 400) {
                    alert('⚠️ ' + result.error);
                } else if (response.status === 403) {
                    alert('❌ ' + result.error + '\n\n请确认您的姓名是否与排班表中的完全一致');
                } else {
                    alert('❌ ' + result.error);
                }
            } catch (error) {
                console.error('打卡请求失败:', error);
                alert('❌ 网络请求失败，请检查网络连接');
            } finally {
                btn.innerText = '立即打卡';
                btn.disabled = false;
            }
        }
