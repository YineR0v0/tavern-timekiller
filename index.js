
(function() {
    const EXTENSION_ID = 'tavern-timekiller-host';
    const SCRIPT_NAME = 'index.js';
    
    // 1. 尝试通过 document.currentScript 获取路径
    let extensionRoot = '';
    if (document.currentScript && document.currentScript.src) {
        extensionRoot = document.currentScript.src;
    } else {
        // 2. 尝试遍历 script 标签查找
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
             if (script.src && script.src.includes(`extensions`) && script.src.includes(SCRIPT_NAME)) {
                 // 优先匹配包含 tavern-timekiller 的路径
                 if (script.src.includes('tavern-timekiller')) {
                    extensionRoot = script.src;
                    break;
                 }
                 // 备用：匹配任何看起来像是在 extensions 目录下的此脚本
                 if (!extensionRoot) extensionRoot = script.src;
             }
        }
    }

    // 清理路径：去掉文件名，只保留目录
    if (extensionRoot) {
        extensionRoot = extensionRoot.substring(0, extensionRoot.lastIndexOf('/'));
    } else {
        // 3. 最后的回退方案：假设用户没有重命名文件夹
        console.warn('Tavern Timekiller: Could not detect path dynamically, falling back to default.');
        extensionRoot = 'scripts/extensions/tavern-timekiller';
    }

    console.log(`Tavern Timekiller: Root set to ${extensionRoot}`);

    // 清理旧实例
    const oldHost = document.getElementById(EXTENSION_ID);
    if (oldHost) oldHost.remove();

    // 创建宿主容器
    const host = document.createElement('div');
    host.id = EXTENSION_ID;
    Object.assign(host.style, {
        position: 'fixed', top: '0', left: '0', width: '0', height: '0', 
        zIndex: '20000' // 降低层级，避免遮挡系统级弹窗，但高于普通UI
    });
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // 启动按钮 (小树苗)
    const launcherBtn = document.createElement('div');
    launcherBtn.innerHTML = '🌱';
    Object.assign(launcherBtn.style, {
        position: 'fixed', bottom: '20px', right: '20px', width: '50px', height: '50px',
        backgroundColor: '#1a1b26', border: '2px solid #4ade80', borderRadius: '50%',
        color: 'white', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 0 15px rgba(74, 222, 128, 0.4)', zIndex: '20001',
        userSelect: 'none', transition: 'transform 0.2s', fontFamily: 'Segoe UI Emoji, sans-serif'
    });
    
    launcherBtn.onmouseenter = () => launcherBtn.style.transform = 'scale(1.1)';
    launcherBtn.onmouseleave = () => launcherBtn.style.transform = 'scale(1)';
    
    // 创建 iframe
    const iframe = document.createElement('iframe');
    // 关键修复：确保路径以 extensions 开头或 http 开头，防止加载成根目录
    if (!extensionRoot.includes('http') && !extensionRoot.startsWith('scripts/')) {
         // 如果路径看起来很奇怪，强制修正
         if (extensionRoot.startsWith('/')) extensionRoot = extensionRoot.substring(1);
    }
    
    iframe.src = `${extensionRoot}/index.html`;
    
    Object.assign(iframe.style, {
        border: 'none', width: '100vw', height: '100vh',
        position: 'fixed', top: '0', left: '0',
        pointerEvents: 'none', // 默认不拦截点击
        background: 'transparent' // 确保背景透明
    });

    // 监听来自 React 应用的消息
    window.addEventListener('message', (event) => {
        if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;

        // 当游戏窗口打开时，启用点击拦截
        if (event.data && event.data.type === 'ST_MAKE_INTERACTIVE') {
            iframe.style.pointerEvents = 'auto';
        }
        // 当游戏窗口关闭/最小化时，禁用点击拦截，允许操作酒馆
        if (event.data && event.data.type === 'ST_MAKE_INACTIVE') {
            iframe.style.pointerEvents = 'none';
        }
    });

    launcherBtn.onclick = () => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage('TOGGLE_WINDOW', '*');
        } else {
            console.error('Tavern Timekiller: Iframe not found or not ready.');
            // 如果加载失败，尝试重新加载 iframe
            iframe.src = iframe.src;
        }
    };

    shadow.appendChild(iframe);
    shadow.appendChild(launcherBtn);
})();
