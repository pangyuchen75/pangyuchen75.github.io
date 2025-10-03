// 初始化配置
const config = {
    autoSave: true,
    autoSaveInterval: 30000,
    maxClips: 100,
    editorTheme: 'default',
    fontSize: '16px'
};

document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const clipboardContent = document.getElementById('clipboard-content');
    const clipTitle = document.getElementById('clip-title');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const autoSaveBtn = document.getElementById('auto-save-btn');
    const searchClips = document.getElementById('search-clips');
    const clipboardList = document.getElementById('clipboard-list');
    const notification = document.getElementById('notification');
    const livePreview = document.getElementById('live-preview');
    const staticPreview = document.getElementById('static-preview');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const formatButtons = document.querySelectorAll('[data-format]');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const closeModal = document.querySelector('.close-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    
    // 统计元素
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const lineCountEl = document.getElementById('line-count');
    const saveCountEl = document.getElementById('save-count');

    // 从本地存储加载数据
    let clips = JSON.parse(localStorage.getItem('enhancedClips')) || [];
    let settings = JSON.parse(localStorage.getItem('clipboardSettings')) || config;
    
    // 应用设置
    applySettings();

    // 配置marked和语法高亮
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                    console.log('代码高亮错误:', e);
                }
            }
            return hljs.highlightAuto(code).value;
        }
    });

    // 初始化
    updatePreviews();
    updateStats();
    renderClips();
    updateSaveCount();

    // === 事件监听器 ===

    // 保存内容
    saveBtn.addEventListener('click', saveContent);

    // 清空内容
    clearBtn.addEventListener('click', clearContent);

    // 自动保存切换
    autoSaveBtn.addEventListener('click', toggleAutoSave);

    // 搜索功能
    searchClips.addEventListener('input', function() {
        renderClips(this.value);
    });

    // 标签切换
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            if (tabId === 'preview') {
                updatePreviews();
            }
        });
    });

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

    // 设置模态框
    settingsBtn.addEventListener('click', function() {
        settingsModal.style.display = 'flex';
    });

    closeModal.addEventListener('click', function() {
        settingsModal.style.display = 'none';
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

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

    // 内容管理功能
    document.getElementById('import-example-btn').addEventListener('click', importExample);
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
        }
    });

    // 实时预览和统计
    clipboardContent.addEventListener('input', updatePreviews);

    // === 功能函数 ===

    function renderClips(filter = '') {
        if (clips.length === 0) {
            clipboardList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard"></i>
                    <p>暂无保存的内容</p>
                    <p>添加您的内容到编辑器并保存</p>
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
                    <span class="clip-title">${clip.title || '未命名文档'}</span>
                    <span class="clip-date">${clip.date}</span>
                </div>
                <div class="clip-content">${clip.content.substring(0, 100)}${clip.content.length > 100 ? '...' : ''}</div>
                <div class="clip-preview" id="preview-${clip.id}"></div>
                <div class="clip-actions">
                    <button class="btn btn-sm copy-btn" data-index="${index}">
                        <i class="fas fa-copy"></i> 复制
                    </button>
                    <button class="btn btn-sm edit-btn" data-index="${index}">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn btn-sm btn-danger delete-btn" data-index="${index}">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            `;
            clipboardList.appendChild(clipElement);
            
            renderPreviewContent(clip.content, document.getElementById(`preview-${clip.id}`));
        });
    }

    function renderPreviewContent(content, element) {
        try {
            // 第一步：预处理数学公式区域，保护它们不被 Markdown 处理
            let mathBlocks = [];
            let processedContent = content;
            
            // 处理块级公式 $$...$$
            processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                const id = `math-block-${mathBlocks.length}`;
                mathBlocks.push({
                    id: id,
                    content: formula,
                    type: 'block'
                });
                return `@@${id}@@`;
            });
            
            // 处理行内公式 $...$
            processedContent = processedContent.replace(/\$([^$\\]*(?:\\.[^$\\]*)*)\$/g, (match, formula) => {
                // 跳过已经被块级公式处理的内容
                if (match.startsWith('@@') && match.endsWith('@@')) {
                    return match;
                }
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
                    const errorMsg = math.type === 'block' 
                        ? `<div class="katex-error">公式渲染错误: ${math.content}</div>`
                        : `<span class="katex-error">${math.content}</span>`;
                    html = html.replace(`@@${math.id}@@`, errorMsg);
                }
            });
            
            element.innerHTML = html;
            
            // 应用代码高亮
            element.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } catch (e) {
            console.error('渲染错误:', e);
            element.innerHTML = `<div class="error-message">渲染错误: ${e.message}</div>`;
        }
    }

    function updatePreviews() {
        const content = clipboardContent.value;
        renderPreviewContent(content, livePreview);
        renderPreviewContent(content, staticPreview);
        updateStats();
    }

    function updateStats() {
        const content = clipboardContent.value;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const chars = content.length;
        const lines = content.split('\n').length;
        
        wordCountEl.textContent = words;
        charCountEl.textContent = chars;
        lineCountEl.textContent = lines;
    }

    function updateSaveCount() {
        saveCountEl.textContent = clips.length;
    }

    function saveContent() {
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
        
        if (clips.length > config.maxClips) {
            clips = clips.slice(0, config.maxClips);
        }
        
        localStorage.setItem('enhancedClips', JSON.stringify(clips));
        updateSaveCount();
        renderClips();
        showNotification('内容已保存！');
    }

    function clearContent() {
        if (confirm('确定要清空当前内容吗？')) {
            clipboardContent.value = '';
            clipTitle.value = '';
            updatePreviews();
            showNotification('内容已清空');
        }
    }

    function toggleAutoSave() {
        config.autoSave = !config.autoSave;
        autoSaveBtn.innerHTML = `<i class="fas fa-sync"></i> 自动保存: ${config.autoSave ? '开启' : '关闭'}`;
        autoSaveBtn.classList.toggle('btn-info', config.autoSave);
        autoSaveBtn.classList.toggle('btn-secondary', !config.autoSave);
        showNotification(`自动保存已${config.autoSave ? '开启' : '关闭'}`);
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

    function copyToClipboard(index) {
        const clip = clips[index];
        navigator.clipboard.writeText(clip.content)
            .then(() => {
                showNotification('内容已复制到剪贴板！');
            })
            .catch(err => {
                showNotification('复制失败，请重试', 'error');
            });
    }

    function editClip(index) {
        const clip = clips[index];
        clipboardContent.value = clip.content;
        clipTitle.value = clip.title;
        updatePreviews();
        showNotification('内容已加载到编辑器');
    }

    function deleteClip(index) {
        if (confirm('确定要删除这个内容吗？')) {
            clips.splice(index, 1);
            localStorage.setItem('enhancedClips', JSON.stringify(clips));
            renderClips(searchClips.value);
            updateSaveCount();
            showNotification('内容已删除');
        }
    }

    function showNotification(message, type = 'success') {
        notification.textContent = message;
        notification.className = 'notification';
        notification.classList.add(type);
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function applySettings() {
        clipboardContent.style.fontSize = config.fontSize;
    }

    function saveSettings() {
        config.fontSize = document.getElementById('font-size').value;
        config.autoSaveInterval = parseInt(document.getElementById('auto-save-interval').value) * 1000;
        config.maxClips = parseInt(document.getElementById('max-clips').value);
        
        localStorage.setItem('clipboardSettings', JSON.stringify(config));
        applySettings();
        settingsModal.style.display = 'none';
        showNotification('设置已保存！');
    }

    function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            clipboardContent.value = e.target.result;
            updatePreviews();
            showNotification('文件导入成功！');
        };
        reader.readAsText(file);
        
        // 重置文件输入
        event.target.value = '';
    }

    function exportToPDF() {
        showNotification('PDF导出功能正在开发中...', 'warning');
    }

    function exportToHTML() {
        const content = document.getElementById('static-preview').innerHTML;
        const blob = new Blob([`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>导出内容</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<style>
body { font-family: Arial, sans-serif; padding: 20px; }
pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
</style>
</head>
<body>${content}</body>
</html>`], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'content.html';
        a.click();
        showNotification('HTML已导出！');
    }

    function printContent() {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>打印内容</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; }
                </style>
            </head>
            <body>
                ${document.getElementById('static-preview').innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    function clearAllClips() {
        if (confirm('确定要清空所有保存的内容吗？此操作不可恢复！')) {
            localStorage.removeItem('enhancedClips');
            clips = [];
            renderClips();
            updateSaveCount();
            showNotification('所有内容已清空');
        }
    }

    function copyHTML() {
        const html = document.getElementById('static-preview').innerHTML;
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
        const url = `${window.location.origin}${window.location.pathname}?content=${content}`;
        navigator.clipboard.writeText(url)
            .then(() => {
                showNotification('分享链接已复制到剪贴板！');
            })
            .catch(err => {
                showNotification('复制失败', 'error');
            });
    }

    function importExample() {
        const exampleContent = `# 示例内容

这是一个导入的示例内容，展示了各种功能：

## 数学公式
二次方程：$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a}$

## 代码示例
\`\`\`python
def hello_world():
print("Hello, World!")
return True
\`\`\`

## 功能列表
- Markdown支持
- 数学公式渲染
- 代码高亮
- 文件操作
- 主题切换`;

        clipboardContent.value = exampleContent;
        clipTitle.value = '示例文档';
        updatePreviews();
        showNotification('示例内容已导入！');
    }

    function exportData() {
        const data = JSON.stringify(clips, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'clipboard-data.json';
        a.click();
        showNotification('数据已导出！');
    }

    // 自动保存
    setInterval(() => {
        if (config.autoSave && clipboardContent.value.trim()) {
            const autoSaveClip = {
                id: 'autosave',
                title: '自动保存',
                content: clipboardContent.value,
                date: new Date().toLocaleString('zh-CN')
            };
            localStorage.setItem('autoSaveContent', JSON.stringify(autoSaveClip));
        }
    }, config.autoSaveInterval);

    // 加载自动保存的内容
    const autoSaveContent = JSON.parse(localStorage.getItem('autoSaveContent'));
    if (autoSaveContent && confirm('发现自动保存的内容，是否加载？')) {
        clipboardContent.value = autoSaveContent.content;
        updatePreviews();
    }
});
