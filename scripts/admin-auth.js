
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
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    msgEl.innerText = '登录成功';
                    msgEl.style.color = '#4CAF50';
                    localStorage.setItem('isAdminLoggedIn', 'true');
                    localStorage.setItem('adminUsername', username);
                    localStorage.setItem('adminToken', data.token || '');

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
        async function checkAdminAuth() {
            const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
            const token = localStorage.getItem('token');
            if (isLoggedIn !== 'true' || !token) {
                alert('请先登录管理员账号');
                showLoginModal();
                return false;
            }

            try {
                const data = await adminFetch('/api/admin/check-config');
                if (!data.success) {
                    alert('登录已过期，请重新登录');
                    localStorage.removeItem('isAdminLoggedIn');
                    localStorage.removeItem('token');
                    showLoginModal();
                    return false;
                }
                return true;
            } catch (e) {
                return true;
            }
        }
