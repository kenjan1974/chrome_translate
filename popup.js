let apiKey;
let customShortcuts = {};

// 預設快速鍵設定
const defaultShortcuts = {
  shortcut1: { key: "1", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為簡體中文" },
  shortcut2: { key: "2", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為繁體中文" },
  shortcut3: { key: "3", altKey: true, ctrlKey: false, shiftKey: false, description: "中文翻譯為英文" },
  shortcut4: { key: "4", altKey: true, ctrlKey: false, shiftKey: false, description: "英文翻譯為中文" },
  shortcut5: { key: "5", altKey: true, ctrlKey: false, shiftKey: false, description: "中文站名轉日文漢字" },
  shortcut6: { key: "6", altKey: true, ctrlKey: false, shiftKey: false, description: "中文站名轉日文平假名" },
  shortcut7: { key: "7", altKey: true, ctrlKey: false, shiftKey: false, description: "中文站名轉英文站名" }
};

const shortcutIds = Object.keys(defaultShortcuts);

// 載入 API Key 狀態和快速鍵設定
chrome.storage.local.get(["openaiApiKey", "customShortcuts"], (res) => {
  apiKey = res.openaiApiKey;
  customShortcuts = normalizeShortcuts(res.customShortcuts);
  updateApiKeyStatus();
  updateShortcutDisplay();
});

function normalizeShortcuts(shortcuts) {
  return shortcutIds.reduce((result, id) => {
    result[id] = {
      ...defaultShortcuts[id],
      ...(shortcuts?.[id] || {}),
      description: defaultShortcuts[id].description
    };
    return result;
  }, {});
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

// 更新快速鍵顯示
function updateShortcutDisplay() {
  const shortcutElements = {
    'shortcut1': document.querySelector('[data-shortcut="1"]'),
    'shortcut2': document.querySelector('[data-shortcut="2"]'),
    'shortcut3': document.querySelector('[data-shortcut="3"]'),
    'shortcut4': document.querySelector('[data-shortcut="4"]'),
    'shortcut5': document.querySelector('[data-shortcut="5"]'),
    'shortcut6': document.querySelector('[data-shortcut="6"]'),
    'shortcut7': document.querySelector('[data-shortcut="7"]')
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
        model: "o4-mini",
        messages: [
          { role: "user", content: "請回應：測試成功" }
        ],
        max_completion_tokens: 10
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
      customShortcuts = normalizeShortcuts(changes.customShortcuts.newValue);
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
