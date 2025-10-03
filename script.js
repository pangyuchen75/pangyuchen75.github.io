// 初始化配置
const config = {
    autoSave: true,
    autoSaveInterval: 30000,
    maxClips: 100,
    editorTheme: 'default',
    fontSize: '16px'
};

// 全局变量
let clips = [];
let currentSettings = { ...config };
let autoSaveIntervalId = null;

// 等待所有库加载完成
function waitForLibraries() {
    return new Promise((resolve) => {
        const checkLibraries = () => {
            if (window.marked && window.hljs && window.katex) {
                resolve();
            } else {
                setTimeout(checkLibraries, 100);
            }
        };
        checkLibraries();
    });
}

// 检查当前页面类型
function isClipsPage() {
    return window.location.pathname.includes('clips.html') || 
           document.getElementById('back-to-home-btn') !== null;
}

function isHomePage() {
    return !isClipsPage();
}

// 更新剪贴板页面统计栏
function updateStatsBar() {
    if (!isClipsPage()) return;
    
    const totalCountEl = document.getElementById('total-count');
    const lastSavedTimeEl = document.getElementById('last-saved-time');
    
    if (totalCountEl) {
        totalCountEl.textContent = clips.length;
    }
    
    if (lastSavedTimeEl && clips.length > 0) {
        const lastClip = clips[0]; // 最新的内容在数组最前面
        lastSavedTimeEl.textContent = `最后保存: ${lastClip.date}`;
    } else if (lastSavedTimeEl) {
        lastSavedTimeEl.textContent = '最后保存: 暂无';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM加载完成，开始初始化...');
    
    try {
        // 等待所有必需的库加载完成
        await waitForLibraries();
        console.log('所有库加载完成');
        
        // 从本地存储加载数据
        try {
            const savedClips = localStorage.getItem('enhancedClips');
            const savedSettings = localStorage.getItem('clipboardSettings');
            
            clips = savedClips ? JSON.parse(savedClips) : [];
            currentSettings = savedSettings ? { ...config, ...JSON.parse(savedSettings) } : config;
            
            console.log('数据加载完成，clips数量:', clips.length);
        } catch (e) {
            console.error('加载数据失败:', e);
            clips = [];
            currentSettings = { ...config };
        }

        // 配置marked
        const renderer = new marked.Renderer();
        renderer.link = function(href, title, text) {
            return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        };
        
        marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false,
            renderer: renderer
        });

        // 根据页面类型初始化
        if (isHomePage()) {
            initHomePage();
        } else {
            initClipsPage();
        }

        console.log('初始化完成');

    } catch (error) {
        console.error('初始化失败:', error);
        alert('应用初始化失败，请刷新页面重试。错误信息: ' + error.message);
    }
});

// 主页初始化函数
function initHomePage() {
    // 获取主页特有的DOM元素
    const clipboardContent = document.getElementById('clipboard-content');
    const clipTitle = document.getElementById('clip-title');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const autoSaveBtn = document.getElementById('auto-save-btn');
    const staticPreview = document.getElementById('static-preview');
    const formatButtons = document.querySelectorAll('[data-format]');
    const themeButtons = document.querySelectorAll('.theme-btn');

    // 统计元素
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const lineCountEl = document.getElementById('line-count');
    const saveCountEl = document.getElementById('save-count');

    // 应用设置
    applySettings();

    // 初始化
    updatePreviews();
    updateStats();
    updateSaveCount();

    // 启动自动保存
    startAutoSave();

    // === 事件监听器 ===

    // 保存内容
    saveBtn.addEventListener('click', saveContent);

    // 清空内容
    clearBtn.addEventListener('click', clearContent);

    // 自动保存切换
    autoSaveBtn.addEventListener('click', toggleAutoSave);

    // 格式按钮
    formatButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            insertText(format);
        });
    });

    // 主题切换
    themeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            themeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const theme = this.getAttribute('data-theme');
            staticPreview.className = `preview-content theme-${theme}`;
        });
    });

    // 文件导入
    document.getElementById('import-file-btn').addEventListener('click', function() {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', handleFileImport);

    // 导出功能
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    document.getElementById('export-html-btn').addEventListener('click', exportToHTML);
    document.getElementById('print-btn').addEventListener('click', printContent);
    document.getElementById('clear-all-btn').addEventListener('click', clearAllClips);

    // 预览区域功能
    document.getElementById('copy-html-btn').addEventListener('click', copyHTML);
    document.getElementById('copy-text-btn').addEventListener('click', copyText);
    document.getElementById('share-link-btn').addEventListener('click', shareLink);

    // 查看剪贴板按钮
    const viewClipsBtn = document.getElementById('view-clips-btn');
    if (viewClipsBtn) {
        viewClipsBtn.addEventListener('click', function() {
            window.location.href = 'clips.html';
        });
    }

    // 实时预览和统计
    clipboardContent.addEventListener('input', updatePreviews);

    // === 主页特有功能函数 ===

    function updatePreviews() {
        try {
            const content = clipboardContent.value;
            console.log('更新预览，内容长度:', content.length);
            
            renderPreviewContent(content, staticPreview);
            updateStats();
        } catch (e) {
            console.error('预览更新错误:', e);
            staticPreview.innerHTML = '<div class="error-message">预览渲染错误</div>';
        }
    }

    function updateStats() {
        const content = clipboardContent.value;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const chars = content.length;
        const lines = content.split('\n').length;
        
        if (wordCountEl) wordCountEl.textContent = words;
        if (charCountEl) charCountEl.textContent = chars;
        if (lineCountEl) lineCountEl.textContent = lines;
    }

    function insertText(text) {
        const start = clipboardContent.selectionStart;
        const end = clipboardContent.selectionEnd;
        const selectedText = clipboardContent.value.substring(start, end);
        
        clipboardContent.value = clipboardContent.value.substring(0, start) + 
                                text.replace('选中文本', selectedText) + 
                                clipboardContent.value.substring(end);
        
        clipboardContent.focus();
        clipboardContent.setSelectionRange(start + text.length, start + text.length);
        updatePreviews();
    }

    function clearContent() {
        if (confirm('确定要清空当前内容吗？')) {
            clipboardContent.value = '';
            clipTitle.value = '';
            updatePreviews();
            showNotification('内容已清空');
        }
    }

    function copyHTML() {
        const html = staticPreview.innerHTML;
        navigator.clipboard.writeText(html)
            .then(() => {
                showNotification('HTML已复制到剪贴板！');
            })
            .catch(err => {
                showNotification('复制失败', 'error');
            });
    }

    function copyText() {
        const text = clipboardContent.value;
        navigator.clipboard.writeText(text)
            .then(() => {
                showNotification('文本已复制到剪贴板！');
            })
            .catch(err => {
                showNotification('复制失败', 'error');
            });
    }

    function shareLink() {
        const content = encodeURIComponent(clipboardContent.value);
        const title = encodeURIComponent(clipTitle.value || '未命名文档');
        const url = `${window.location.origin}${window.location.pathname}?content=${content}&title=${title}`;
        navigator.clipboard.writeText(url)
            .then(() => {
                showNotification('分享链接已复制到剪贴板！');
            })
            .catch(err => {
                showNotification('复制失败', 'error');
            });
    }

    function startAutoSave() {
        if (currentSettings.autoSave) {
            autoSaveIntervalId = setInterval(() => {
                if (clipboardContent && clipboardContent.value.trim()) {
                    const autoSaveClip = {
                        id: 'autosave',
                        title: clipTitle.value || '自动保存',
                        content: clipboardContent.value,
                        date: new Date().toLocaleString('zh-CN')
                    };
                    localStorage.setItem('autoSaveContent', JSON.stringify(autoSaveClip));
                    console.log('内容已自动保存');
                }
            }, currentSettings.autoSaveInterval);
        }
    }

    // 加载自动保存的内容（仅主页）
    const autoSaveContent = localStorage.getItem('autoSaveContent');
    if (autoSaveContent && clipboardContent && !clipboardContent.value.trim()) {
        if (confirm('发现自动保存的内容，是否加载？')) {
            try {
                const autoSaveData = JSON.parse(autoSaveContent);
                clipboardContent.value = autoSaveData.content;
                if (clipTitle && autoSaveData.title && autoSaveData.title !== '自动保存') {
                    clipTitle.value = autoSaveData.title;
                }
                updatePreviews();
                showNotification('自动保存的内容已加载');
            } catch (e) {
                console.error('加载自动保存内容失败:', e);
            }
        }
    }
}

// 剪贴板页面初始化函数
function initClipsPage() {
    const searchClips = document.getElementById('search-clips');
    const clipboardList = document.getElementById('clipboard-list');
    const refreshBtn = document.getElementById('refresh-btn');

    // 初始化剪贴板列表
    renderClips();
    updateStatsBar();

    // 搜索功能
    searchClips.addEventListener('input', function() {
        renderClips(this.value);
    });

    // 刷新按钮
    refreshBtn.addEventListener('click', function() {
        // 重新从本地存储加载数据
        try {
            const savedClips = localStorage.getItem('enhancedClips');
            clips = savedClips ? JSON.parse(savedClips) : [];
            renderClips(searchClips.value);
            updateStatsBar();
            showNotification('列表已刷新');
        } catch (e) {
            console.error('刷新失败:', e);
            showNotification('刷新失败', 'error');
        }
    });

    // 返回主页按钮
    document.getElementById('back-to-home-btn').addEventListener('click', function() {
        window.location.href = 'index.html';
    });

    // 清空全部按钮
    document.getElementById('clear-all-btn').addEventListener('click', clearAllClips);

    // 导出数据按钮
    document.getElementById('export-data-btn').addEventListener('click', exportData);

    // 事件委托 - 处理剪贴板列表中的按钮
    clipboardList.addEventListener('click', function(e) {
        const target = e.target.closest('button');
        if (!target) return;
        
        const index = parseInt(target.getAttribute('data-index'));
        
        if (target.classList.contains('copy-btn')) {
            copyToClipboard(index);
        } else if (target.classList.contains('edit-btn')) {
            editClip(index);
        } else if (target.classList.contains('delete-btn')) {
            deleteClip(index);
        } else if (target.classList.contains('preview-toggle')) {
            togglePreview(index);
        }
    });
}

// === 通用功能函数 ===

function renderClips(filter = '') {
    const clipboardList = document.getElementById('clipboard-list');
    // 确保剪贴板列表元素存在
    if (!clipboardList) {
        console.log('剪贴板列表元素不存在，跳过渲染');
        return;
    }
    
    console.log('渲染剪贴板列表，filter:', filter);
    
    if (clips.length === 0) {
        clipboardList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <p>暂无保存的内容</p>
                <p>${isHomePage() ? '添加您的内容到编辑器并保存' : '返回主页添加内容并保存'}</p>
            </div>
        `;
        return;
    }
    
    let filteredClips = clips;
    if (filter) {
        filteredClips = clips.filter(clip => 
            clip.content.toLowerCase().includes(filter.toLowerCase()) ||
            (clip.title && clip.title.toLowerCase().includes(filter.toLowerCase()))
        );
    }
    
    if (filteredClips.length === 0) {
        clipboardList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>没有找到匹配的内容</p>
                <p>尝试使用其他关键词搜索</p>
            </div>
        `;
        return;
    }
    
    clipboardList.innerHTML = '';
    filteredClips.forEach((clip, index) => {
        const clipElement = document.createElement('div');
        clipElement.className = 'clip-item';
        clipElement.innerHTML = `
            <div class="clip-header">
                <span class="clip-title">${escapeHtml(clip.title || '未命名文档')}</span>
                <span class="clip-date">${escapeHtml(clip.date)}</span>
            </div>
            <div class="clip-content">${escapeHtml(clip.content.substring(0, 100))}${clip.content.length > 100 ? '...' : ''}</div>
            <div class="clip-actions">
                <button class="btn btn-sm copy-btn" data-index="${index}">
                    <i class="fas fa-copy"></i> 复制
                </button>
                <button class="btn btn-sm edit-btn" data-index="${index}">
                    <i class="fas fa-edit"></i> 编辑
                </button>
                <button class="btn btn-sm preview-toggle" data-index="${index}">
                    <i class="fas fa-eye"></i> 预览
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-index="${index}">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
            <div class="clip-preview" id="preview-${clip.id}" style="display: none;"></div>
        `;
        clipboardList.appendChild(clipElement);
    });

    // 更新统计栏（仅剪贴板页面）
    if (isClipsPage()) {
        updateStatsBar();
    }
}

function togglePreview(index) {
    const clip = clips[index];
    const previewElement = document.getElementById(`preview-${clip.id}`);
    
    if (previewElement.style.display === 'none') {
        // 显示预览
        previewElement.style.display = 'block';
        renderPreviewContent(clip.content, previewElement);
    } else {
        // 隐藏预览
        previewElement.style.display = 'none';
    }
}

function renderPreviewContent(content, element) {
    try {
        console.log('开始渲染预览内容');
        
        // 第一步：预处理数学公式
        let mathBlocks = [];
        let processedContent = content;
        
        // 处理块级公式 $$...$$
        processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, function(match, formula) {
            const id = `math-block-${mathBlocks.length}`;
            mathBlocks.push({
                id: id,
                content: formula,
                type: 'block'
            });
            return `@@${id}@@`;
        });
        
        // 处理行内公式 $...$
        processedContent = processedContent.replace(/\$([^$\\]*(?:\\.[^$\\]*)*)\$/g, function(match, formula) {
            // 跳过已经被块级公式处理的内容
            if (match.includes('@@')) return match;
            
            const id = `math-inline-${mathBlocks.length}`;
            mathBlocks.push({
                id: id,
                content: formula,
                type: 'inline'
            });
            return `@@${id}@@`;
        });
        
        // 第二步：使用 marked 渲染 Markdown
        let html = marked.parse(processedContent);
        
        // 第三步：恢复数学公式并用 KaTeX 渲染
        mathBlocks.forEach(math => {
            try {
                const katexHtml = katex.renderToString(math.content.trim(), {
                    displayMode: math.type === 'block',
                    throwOnError: false,
                    output: 'html'
                });
                html = html.replace(`@@${math.id}@@`, katexHtml);
            } catch (e) {
                console.error('KaTeX 渲染错误:', e);
                // 直接显示原始公式内容
                html = html.replace(`@@${math.id}@@`, 
                    math.type === 'block' ? `$$${math.content}$$` : `$${math.content}$`);
            }
        });
        
        element.innerHTML = html;
        
        // 应用代码高亮
        element.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
        
        console.log('预览渲染完成');
    } catch (e) {
        console.error('渲染错误:', e);
        element.innerHTML = `<div class="error-message">渲染错误: ${e.message}</div>`;
    }
}

function copyToClipboard(index) {
    const clip = clips[index];
    navigator.clipboard.writeText(clip.content)
        .then(() => {
            showNotification('内容已复制到剪贴板！');
        })
        .catch(err => {
            showNotification('复制失败', 'error');
        });
}

function editClip(index) {
    const clip = clips[index];
    if (isHomePage()) {
        // 在主页编辑
        document.getElementById('clipboard-content').value = clip.content;
        document.getElementById('clip-title').value = clip.title;
        updatePreviews();
        showNotification('内容已加载到编辑器');
    } else {
        // 在剪贴板页面编辑 - 跳转到主页
        localStorage.setItem('editClip', JSON.stringify(clip));
        window.location.href = 'index.html';
    }
}

function deleteClip(index) {
    if (confirm('确定要删除这条内容吗？')) {
        clips.splice(index, 1);
        saveClips();
        renderClips();
        showNotification('内容已删除');
    }
}

function clearAllClips() {
    if (confirm('确定要清空所有内容吗？此操作不可恢复！')) {
        clips = [];
        saveClips();
        renderClips();
        showNotification('所有内容已清空');
    }
}

function saveContent() {
    const clipboardContent = document.getElementById('clipboard-content');
    const clipTitle = document.getElementById('clip-title');
    
    const content = clipboardContent.value.trim();
    const title = clipTitle.value.trim();
    
    if (!content) {
        showNotification('请输入内容后再保存！', 'error');
        return;
    }
    
    const newClip = {
        id: Date.now(),
        title: title || '未命名文档 ' + new Date().toLocaleTimeString(),
        content: content,
        date: new Date().toLocaleString('zh-CN')
    };
    
    clips.unshift(newClip);
    
    // 限制保存数量
    if (clips.length > currentSettings.maxClips) {
        clips = clips.slice(0, currentSettings.maxClips);
    }
    
    saveClips();
    updateSaveCount();
    showNotification('内容已保存！');
}

function saveClips() {
    try {
        localStorage.setItem('enhancedClips', JSON.stringify(clips));
        console.log('内容已保存到本地存储');
    } catch (e) {
        console.error('保存失败:', e);
        showNotification('保存失败，存储空间可能已满', 'error');
    }
}

function updateSaveCount() {
    const saveCountEl = document.getElementById('save-count');
    if (saveCountEl) {
        saveCountEl.textContent = clips.length;
    }
}

function toggleAutoSave() {
    const autoSaveBtn = document.getElementById('auto-save-btn');
    
    if (autoSaveIntervalId) {
        // 关闭自动保存
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
        autoSaveBtn.innerHTML = '<i class="fas fa-sync"></i> 自动保存: 关闭';
        autoSaveBtn.classList.remove('btn-success');
        autoSaveBtn.classList.add('btn-secondary');
        showNotification('自动保存已关闭');
    } else {
        // 开启自动保存
        autoSaveIntervalId = setInterval(() => {
            const clipboardContent = document.getElementById('clipboard-content');
            const content = clipboardContent.value.trim();
            
            if (content) {
                const autoSaveClip = {
                    id: 'autosave',
                    title: document.getElementById('clip-title').value || '自动保存',
                    content: content,
                    date: new Date().toLocaleString('zh-CN')
                };
                localStorage.setItem('autoSaveContent', JSON.stringify(autoSaveClip));
                console.log('内容已自动保存');
            }
        }, currentSettings.autoSaveInterval);
        
        autoSaveBtn.innerHTML = '<i class="fas fa-sync"></i> 自动保存: 开启';
        autoSaveBtn.classList.remove('btn-secondary');
        autoSaveBtn.classList.add('btn-success');
        showNotification('自动保存已开启');
    }
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const clipboardContent = document.getElementById('clipboard-content');
        const clipTitle = document.getElementById('clip-title');
        
        if (clipboardContent) {
            clipboardContent.value = e.target.result;
            
            // 设置文件名为标题
            if (clipTitle) {
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除扩展名
                clipTitle.value = fileName;
            }
            
            updatePreviews();
            showNotification('文件导入成功！');
        }
    };
    
    reader.onerror = function() {
        showNotification('文件读取失败', 'error');
    };
    
    reader.readAsText(file);
    
    // 重置文件输入
    event.target.value = '';
}

function exportToPDF() {
    const staticPreview = document.getElementById('static-preview');
    const title = document.getElementById('clip-title').value || '未命名文档';
    
    // 使用html2pdf.js库进行PDF导出
    if (typeof html2pdf === 'undefined') {
        // 动态加载html2pdf库
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = function() {
            generatePDF(staticPreview, title);
        };
        document.head.appendChild(script);
        showNotification('正在加载PDF导出功能...', 'info');
    } else {
        generatePDF(staticPreview, title);
    }
}

function generatePDF(element, title) {
    const opt = {
        margin: 10,
        filename: `${title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save()
        .then(() => {
            showNotification('PDF导出成功！');
        })
        .catch(err => {
            console.error('PDF导出失败:', err);
            showNotification('PDF导出失败', 'error');
        });
}

function exportToHTML() {
    const staticPreview = document.getElementById('static-preview');
    const title = document.getElementById('clip-title').value || '未命名文档';
    const htmlContent = staticPreview.innerHTML;
    
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { font-family: 'Courier New', monospace; }
        .math-display { text-align: center; margin: 20px 0; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    <div>${htmlContent}</div>
</body>
</html>`;
    
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('HTML导出成功！');
}

function printContent() {
    const staticPreview = document.getElementById('static-preview');
    const printWindow = window.open('', '_blank');
    const title = document.getElementById('clip-title').value || '未命名文档';
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(title)}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css">
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
                code { font-family: 'Courier New', monospace; }
                .math-display { text-align: center; margin: 20px 0; }
                img { max-width: 100%; height: auto; }
                @media print {
                    body { max-width: none; }
                    pre { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            <div>${staticPreview.innerHTML}</div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function exportData() {
    const data = {
        clips: clips,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipboard-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('数据导出成功！');
}

function applySettings() {
    // 应用字体大小
    const editor = document.getElementById('clipboard-content');
    if (editor) {
        editor.style.fontSize = currentSettings.fontSize;
    }
    
    // 应用主题
    const staticPreview = document.getElementById('static-preview');
    if (staticPreview) {
        staticPreview.className = `preview-content theme-${currentSettings.editorTheme}`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'success') {
    // 创建通知元素
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            transition: all 0.3s ease;
            transform: translateX(100%);
            opacity: 0;
        `;
        document.body.appendChild(notification);
    }
    
    // 设置样式和内容
    notification.textContent = message;
    notification.style.backgroundColor = type === 'error' ? '#e74c3c' : 
                                      type === 'info' ? '#3498db' : '#27ae60';
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
    
    // 3秒后隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        notification.style.opacity = '0';
    }, 3000);
}
