let apiKey;
let customShortcuts = {};

// 預設快速鍵設定
const defaultShortcuts = {
  shortcut1: { key: "1", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為簡體中文" },
  shortcut2: { key: "2", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為繁體中文" },
  shortcut3: { key: "3", altKey: true, ctrlKey: false, shiftKey: false, description: "中文翻譯為英文" },
  shortcut4: { key: "4", altKey: true, ctrlKey: false, shiftKey: false, description: "英文翻譯為中文" }
};

// 載入 API Key 狀態和快速鍵設定
chrome.storage.local.get(["openaiApiKey", "customShortcuts"], (res) => {
  apiKey = res.openaiApiKey;
  customShortcuts = res.customShortcuts || defaultShortcuts;
  updateApiKeyStatus();
  updateShortcutDisplay();
});

// 格式化快速鍵顯示
function formatShortcutDisplay(shortcut) {
  const parts = [];
  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  parts.push(shortcut.key.toUpperCase());
  return parts.join(" + ");
}

// 更新快速鍵顯示
function updateShortcutDisplay() {
  const shortcutElements = {
    'shortcut1': document.querySelector('[data-shortcut="1"]'),
    'shortcut2': document.querySelector('[data-shortcut="2"]'),
    'shortcut3': document.querySelector('[data-shortcut="3"]'),
    'shortcut4': document.querySelector('[data-shortcut="4"]')
  };

  Object.keys(shortcutElements).forEach(id => {
    const element = shortcutElements[id];
    if (element && customShortcuts[id]) {
      element.textContent = formatShortcutDisplay(customShortcuts[id]);
    }
  });
}

// 更新 API Key 狀態顯示
function updateApiKeyStatus() {
  const statusElement = document.getElementById("apiKeyStatus");
  const testButton = document.getElementById("testButton");
  
  if (apiKey && apiKey.startsWith('sk-')) {
    statusElement.textContent = "✅ API Key 已設定";
    statusElement.className = "status success";
    testButton.disabled = false;
  } else {
    statusElement.textContent = "❌ 請先設定 API Key";
    statusElement.className = "status error";
    testButton.disabled = true;
  }
}

// 測試 API Key 是否有效
async function testApiKey() {
  if (!apiKey) {
    alert("請先設定 API Key");
    return;
  }

  const testButton = document.getElementById("testButton");
  const originalText = testButton.textContent;
  testButton.textContent = "測試中...";
  testButton.disabled = true;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "user", content: "請回應：測試成功" }
        ],
        max_tokens: 10
      }),
    });

    if (response.ok) {
      alert("✅ API Key 測試成功！");
    } else {
      const error = await response.json();
      alert(`❌ API Key 測試失敗：${error.error?.message || '未知錯誤'}`);
    }
  } catch (error) {
    alert(`❌ 測試失敗：${error.message}`);
  }

  testButton.textContent = originalText;
  testButton.disabled = false;
}

// 開啟設定頁面
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// 監聽 storage 變化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.openaiApiKey) {
      apiKey = changes.openaiApiKey.newValue;
      updateApiKeyStatus();
    }
    if (changes.customShortcuts) {
      customShortcuts = changes.customShortcuts.newValue || defaultShortcuts;
      updateShortcutDisplay();
    }
  }
});

// 綁定事件
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("testButton").addEventListener("click", testApiKey);
  document.getElementById("settingsButton").addEventListener("click", openSettings);
  updateApiKeyStatus();
  updateShortcutDisplay();
});
