
(function() {
    const EXTENSION_ID = 'tavern-timekiller-host';
    const SCRIPT_NAME = 'index.js';
    
    // --- 1. 路径检测逻辑 (Robust Path Detection) ---
    // Try to find the script tag that loaded this script to determine the base path
    let extensionRoot = '';
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
         if (script.src && script.src.includes(SCRIPT_NAME)) {
             // Look for the specific extension folder name if possible
             if (script.src.includes('tavern-timekiller')) {
                extensionRoot = script.src.substring(0, script.src.lastIndexOf('/'));
                break;
             }
         }
    }
    
    // Fallback: use default relative path if detection failed (Standard ST install)
    if (!extensionRoot) {
        extensionRoot = 'scripts/extensions/tavern-timekiller';
    }

    console.log('[Tavern Timekiller] Extension Root:', extensionRoot);

    // --- 2. 清理旧实例 ---
    const oldHost = document.getElementById(EXTENSION_ID);
    if (oldHost) oldHost.remove();

    // --- 3. 创建宿主容器 ---
    const host = document.createElement('div');
    host.id = EXTENSION_ID;
    Object.assign(host.style, {
        position: 'fixed', top: '0', left: '0', width: '0', height: '0', 
        zIndex: '20000',
        pointerEvents: 'none' // Host itself shouldn't block clicks
    });
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // --- 4. 创建启动按钮 ---
    const launcherBtn = document.createElement('div');
    launcherBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="12" x2="10" y2="12"></line>
        <line x1="8" y1="10" x2="8" y2="14"></line>
        <line x1="15" y1="13" x2="15.01" y2="13"></line>
        <line x1="18" y1="11" x2="18.01" y2="11"></line>
        <rect x="2" y="6" width="20" height="12" rx="2"></rect>
    </svg>`;
    
    Object.assign(launcherBtn.style, {
        position: 'fixed', bottom: '100px', right: '20px', 
        width: '48px', height: '48px',
        backgroundColor: '#1a1b26', border: '2px solid #4ade80', borderRadius: '50%',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', zIndex: '20001',
        userSelect: 'none', transition: 'transform 0.1s', touchAction: 'none',
        pointerEvents: 'auto' // Button must be clickable
    });

    launcherBtn.title = "Tavern Timekiller";
    launcherBtn.onmouseenter = () => launcherBtn.style.transform = 'scale(1.1)';
    launcherBtn.onmouseleave = () => launcherBtn.style.transform = 'scale(1)';

    // --- 5. 创建 iframe ---
    const iframe = document.createElement('iframe');
    // Ensure src does not double slashes if root ends with /
    const cleanRoot = extensionRoot.endsWith('/') ? extensionRoot.slice(0, -1) : extensionRoot;
    iframe.src = `${cleanRoot}/index.html`;
    
    Object.assign(iframe.style, {
        border: 'none', width: '100vw', height: '100vh',
        position: 'fixed', top: '0', left: '0',
        pointerEvents: 'none',
        background: 'transparent',
        zIndex: '20002' // Ensure iframe is above button when active if needed, or managed by App visibility
    });

    // --- SillyTavern 数据同步与交互逻辑 ---
    const syncTavernData = () => {
        if (!iframe.contentWindow) return;

        // 获取 SillyTavern CSS 变量
        const style = getComputedStyle(document.body);
        const tavernColors = {
            bgBase: style.getPropertyValue('--bg_color') || '#0b0f19',
            bgHeader: style.getPropertyValue('--drawer_bg') || style.getPropertyValue('--bg_color') || '#111b27',
            textMain: style.getPropertyValue('--main_text_color') || '#e2e8f0',
            textDim: style.getPropertyValue('--italics_text_color') || '#94a3b8',
            border: style.getPropertyValue('--border_color') || '#1e293b',
            primary: style.getPropertyValue('--smart-theme-accent') || '#4ade80', 
            panel: style.getPropertyValue('--block_bg') || style.getPropertyValue('--element_bg') || '#1e293b'
        };

        // 获取用户名 ({{user}}) 和 角色名 ({{char}})
        let userName = 'User';
        let charName = 'Character';

        // Robust context retrieval
        try {
            if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
                const context = window.SillyTavern.getContext();
                if (context) {
                    userName = context.name1 || userName;
                    charName = context.name2 || charName;
                }
            } else {
                // Fallback for older versions or if API not ready
                if (typeof window.name1 !== 'undefined') userName = window.name1;
                if (typeof window.name2 !== 'undefined') charName = window.name2;
            }
        } catch (e) {
            console.warn('[Tavern Timekiller] Error getting context:', e);
        }

        iframe.contentWindow.postMessage({
            type: 'TK_SYNC_DATA',
            payload: {
                colors: tavernColors,
                userName: userName,
                charName: charName
            }
        }, '*');
    };

    // 执行 SillyTavern Slash Command
    const executeSlashCommand = (command) => {
        const cmdHandler = window.slash_commands || (window.SillyTavern && window.SillyTavern.slash_commands);
        if (cmdHandler && typeof cmdHandler.processSlashCommand === 'function') {
            cmdHandler.processSlashCommand(command);
        } else {
            console.warn('[Tavern Timekiller] Slash commands API not found.');
        }
    };

    // 监听来自 iframe 的消息
    window.addEventListener('message', (event) => {
        if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;

        // 窗口交互状态
        if (event.data && event.data.type === 'ST_MAKE_INTERACTIVE') {
            iframe.style.pointerEvents = 'auto';
            syncTavernData();
        }
        if (event.data && event.data.type === 'ST_MAKE_INACTIVE') {
            iframe.style.pointerEvents = 'none';
        }
        // 数据同步请求
        if (event.data && event.data.type === 'TK_REQUEST_SYNC') {
            syncTavernData();
        }
        // 执行酒馆命令
        if (event.data && event.data.type === 'TK_EXECUTE_COMMAND') {
            executeSlashCommand(event.data.payload);
        }
    });

    // --- 6. 拖动逻辑 (Drag & Click Handling) ---
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    const DRAG_THRESHOLD = 5;

    const handleDragStart = (e) => {
        isDragging = false; // Reset drag state
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;
        const rect = launcherBtn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        // Clear layout positioning to allow absolute
        launcherBtn.style.bottom = 'auto';
        launcherBtn.style.right = 'auto';
        launcherBtn.style.left = `${initialLeft}px`;
        launcherBtn.style.top = `${initialTop}px`;
        launcherBtn.style.transition = 'none';
        
        document.addEventListener(e.type.includes('touch') ? 'touchmove' : 'mousemove', handleDragMove, { passive: false });
        document.addEventListener(e.type.includes('touch') ? 'touchend' : 'mouseup', handleDragEnd);
    };

    const handleDragMove = (e) => {
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;

        if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            isDragging = true;
        }

        if (isDragging) {
            e.preventDefault();
            launcherBtn.style.left = `${initialLeft + dx}px`;
            launcherBtn.style.top = `${initialTop + dy}px`;
        }
    };

    const handleDragEnd = (e) => {
        document.removeEventListener(e.type.includes('touch') ? 'touchmove' : 'mousemove', handleDragMove);
        document.removeEventListener(e.type.includes('touch') ? 'touchend' : 'mouseup', handleDragEnd);
        launcherBtn.style.transition = 'transform 0.1s';
        
        // If it wasn't a drag, treat it as a click
        if (!isDragging) {
            handleClick();
        }
    };

    const handleClick = () => {
        console.log('[Tavern Timekiller] Toggle clicked');
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage('TOGGLE_WINDOW', '*');
        } else {
            console.warn('[Tavern Timekiller] Iframe not ready, reloading src');
            iframe.src = iframe.src;
        }
    };

    launcherBtn.addEventListener('mousedown', handleDragStart);
    launcherBtn.addEventListener('touchstart', handleDragStart, { passive: false });
    
    // Fallback: Context menu to force reload/reset
    launcherBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const action = confirm('Tavern Timekiller Options:\nOK to Reload Extension\nCancel to Close');
        if (action) iframe.src = iframe.src;
    });

    shadow.appendChild(iframe);
    shadow.appendChild(launcherBtn);
})();
