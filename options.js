const input = document.getElementById("apiKey");
const saveBtn = document.getElementById("save");
const resetBtn = document.getElementById("reset");
const toggleApiKeyBtn = document.getElementById("toggleApiKey");

// 預設快速鍵設定
const defaultShortcuts = {
  shortcut1: { key: "1", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為簡體中文" },
  shortcut2: { key: "2", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為繁體中文" },
  shortcut3: { key: "3", altKey: true, ctrlKey: false, shiftKey: false, description: "中文翻譯為英文" },
  shortcut4: { key: "4", altKey: true, ctrlKey: false, shiftKey: false, description: "英文翻譯為中文" }
};

let currentRecording = null;

// 切換 API Key 顯示/隱藏
function toggleApiKeyVisibility() {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  toggleApiKeyBtn.textContent = isPassword ? '🙈' : '👁️';
  toggleApiKeyBtn.title = isPassword ? '隱藏 API Key' : '顯示 API Key';
}

// 載入設定
chrome.storage.local.get(["openaiApiKey", "customShortcuts"], (res) => {
  if (res.openaiApiKey) input.value = res.openaiApiKey;
  
  const shortcuts = res.customShortcuts || defaultShortcuts;
  loadShortcutSettings(shortcuts);
});

// 載入快速鍵設定到介面
function loadShortcutSettings(shortcuts) {
  Object.keys(shortcuts).forEach(id => {
    const shortcut = shortcuts[id];
    const inputElement = document.getElementById(id);
    if (inputElement) {
      inputElement.value = formatShortcutDisplay(shortcut);
    }
  });
}

// 格式化快速鍵顯示
function formatShortcutDisplay(shortcut) {
  const parts = [];
  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());
  return parts.join(" + ");
}

// 解析按鍵事件為快速鍵物件
function parseKeyEvent(e) {
  return {
    key: e.key,
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey
  };
}

// 驗證快速鍵是否有效
function isValidShortcut(shortcut) {
  // 至少需要一個修飾鍵
  if (!shortcut.altKey && !shortcut.ctrlKey && !shortcut.shiftKey) {
    return false;
  }
  
  // 不允許只有修飾鍵
  const modifierKeys = ['Alt', 'Control', 'Shift', 'Meta'];
  if (modifierKeys.includes(shortcut.key)) {
    return false;
  }
  
  return true;
}

// 檢查快速鍵是否重複
function isDuplicateShortcut(newShortcut, excludeId) {
  const currentShortcuts = getCurrentShortcuts();
  
  return Object.keys(currentShortcuts).some(id => {
    if (id === excludeId) return false;
    
    const existing = currentShortcuts[id];
    return existing.key === newShortcut.key &&
           existing.altKey === newShortcut.altKey &&
           existing.ctrlKey === newShortcut.ctrlKey &&
           existing.shiftKey === newShortcut.shiftKey;
  });
}

// 獲取目前所有快速鍵設定
function getCurrentShortcuts() {
  const shortcuts = {};
  ['shortcut1', 'shortcut2', 'shortcut3', 'shortcut4'].forEach(id => {
    const inputElement = document.getElementById(id);
    const value = inputElement.value;
    if (value && value !== inputElement.placeholder) {
      shortcuts[id] = parseShortcutDisplay(value);
    }
  });
  return shortcuts;
}

// 解析顯示文字為快速鍵物件
function parseShortcutDisplay(display) {
  const parts = display.split(' + ');
  const key = parts[parts.length - 1].toLowerCase();
  
  return {
    key: key,
    altKey: parts.includes('Alt'),
    ctrlKey: parts.includes('Ctrl'),
    shiftKey: parts.includes('Shift')
  };
}

// 設定快速鍵錄製事件
function setupShortcutRecording() {
  document.querySelectorAll('.change-shortcut').forEach(button => {
    button.addEventListener('click', (e) => {
      const targetId = e.target.dataset.target;
      const inputElement = document.getElementById(targetId);
      const buttonElement = e.target;
      
      if (currentRecording) {
        // 停止之前的錄製
        stopRecording();
      }
      
      // 開始錄製
      currentRecording = targetId;
      inputElement.classList.add('recording');
      inputElement.value = '按下快速鍵...';
      buttonElement.classList.add('recording');
      buttonElement.textContent = '錄製中';
      
      // 聚焦到輸入框以捕獲按鍵
      inputElement.focus();
    });
  });
}

// 停止錄製
function stopRecording() {
  if (currentRecording) {
    const inputElement = document.getElementById(currentRecording);
    const buttonElement = document.querySelector(`[data-target="${currentRecording}"]`);
    
    inputElement.classList.remove('recording');
    buttonElement.classList.remove('recording');
    buttonElement.textContent = '修改';
    
    currentRecording = null;
  }
}

// 處理快速鍵錄製
function handleShortcutRecording(e) {
  if (!currentRecording) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const shortcut = parseKeyEvent(e);
  const inputElement = document.getElementById(currentRecording);
  
  if (!isValidShortcut(shortcut)) {
    inputElement.value = '無效快速鍵';
    setTimeout(() => {
      inputElement.value = '按下快速鍵...';
    }, 1000);
    return;
  }
  
  if (isDuplicateShortcut(shortcut, currentRecording)) {
    inputElement.value = '快速鍵重複';
    setTimeout(() => {
      inputElement.value = '按下快速鍵...';
    }, 1000);
    return;
  }
  
  inputElement.value = formatShortcutDisplay(shortcut);
  stopRecording();
}

// 儲存設定
saveBtn.addEventListener("click", () => {
  const key = input.value.trim();
  if (!key) return alert("API Key 不可為空");
  
  // 收集快速鍵設定
  const shortcuts = {};
  ['shortcut1', 'shortcut2', 'shortcut3', 'shortcut4'].forEach(id => {
    const inputElement = document.getElementById(id);
    const value = inputElement.value;
    
    if (value && value !== inputElement.placeholder && !value.includes('按下快速鍵')) {
      shortcuts[id] = {
        ...parseShortcutDisplay(value),
        description: defaultShortcuts[id].description
      };
    } else {
      shortcuts[id] = defaultShortcuts[id];
    }
  });
  
  chrome.storage.local.set({ 
    openaiApiKey: key,
    customShortcuts: shortcuts
  }, () => {
    alert("設定已儲存");
  });
});

// 重設為預設值
resetBtn.addEventListener("click", () => {
  if (confirm("確定要重設為預設快速鍵嗎？")) {
    loadShortcutSettings(defaultShortcuts);
    chrome.storage.local.set({ 
      customShortcuts: defaultShortcuts
    }, () => {
      alert("快速鍵已重設為預設值");
    });
  }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  setupShortcutRecording();
  
  // 綁定 API Key 顯示切換按鈕
  toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
  toggleApiKeyBtn.title = '顯示 API Key';
  
  // 監聽全域按鍵事件
  document.addEventListener('keydown', handleShortcutRecording);
  
  // 點擊其他地方停止錄製
  document.addEventListener('click', (e) => {
    if (!e.target.classList.contains('change-shortcut') && 
        !e.target.classList.contains('shortcut-input')) {
      stopRecording();
    }
  });
});
