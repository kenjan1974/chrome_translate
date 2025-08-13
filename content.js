let apiKey;
let customShortcuts = {};
let isApiKeyReady = false; // 新增準備狀態標記

// 預設快速鍵設定
const defaultShortcuts = {
  shortcut1: { key: "1", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為簡體中文" },
  shortcut2: { key: "2", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為繁體中文" },
  shortcut3: { key: "3", altKey: true, ctrlKey: false, shiftKey: false, description: "中文翻譯為英文" },
  shortcut4: { key: "4", altKey: true, ctrlKey: false, shiftKey: false, description: "英文翻譯為中文" }
};

// 預載入常用的翻譯前綴
const translationPrefixes = {
  "轉換為簡體中文": "請將以下繁體中文轉換為簡體中文，只需要回覆轉換後的結果：",
  "轉換為繁體中文": "請將以下簡體中文轉換為繁體中文，只需要回覆轉換後的結果：",
  "中文翻譯為英文": "請將以下中文翻譯為英文，只需要回覆翻譯結果：",
  "英文翻譯為中文": "請將以下英文翻譯為中文，只需要回覆翻譯結果："
};

// 啟動時預載入設定
chrome.storage.local.get(["openaiApiKey", "customShortcuts"], (res) => {
  apiKey = res.openaiApiKey;
  customShortcuts = res.customShortcuts || defaultShortcuts;
  isApiKeyReady = !!apiKey; // 標記 API Key 是否就緒
});

// 監聽 storage 變化，即時更新設定
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.openaiApiKey) {
      apiKey = changes.openaiApiKey.newValue;
    }
    if (changes.customShortcuts) {
      customShortcuts = changes.customShortcuts.newValue || defaultShortcuts;
    }
  }
});

// 檢查元素是否為可編輯的文字輸入欄位
function isEditableElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName.toLowerCase();
  const type = element.type ? element.type.toLowerCase() : '';
  
  // 支援的輸入類型
  const supportedInputTypes = ['text', 'email', 'password', 'search', 'tel', 'url'];
  
  return (
    // textarea 元素
    tagName === 'textarea' ||
    // input 元素且類型符合
    (tagName === 'input' && supportedInputTypes.includes(type)) ||
    // 可編輯的 div 或其他元素
    element.isContentEditable ||
    element.contentEditable === 'true'
  );
}

// 獲取或設定元素的文字內容
function getElementText(element) {
  if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
    return element.value;
  } else if (element.isContentEditable) {
    return element.innerText || element.textContent;
  }
  return '';
}

function setElementText(element, text) {
  if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
    element.value = text;
    // 觸發 input 事件，讓網頁知道內容已改變
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.isContentEditable) {
    element.innerText = text;
    // 觸發 input 事件
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// 顯示處理狀態
function showProcessingStatus(element, originalText) {
  const processingText = "處理中...";
  setElementText(element, processingText);
  
  // 返回還原函式
  return () => setElementText(element, originalText);
}

// 建立持續連線的 fetch 配置
const fetchConfig = {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Connection": "keep-alive", // 保持連線
  },
  keepalive: true // 保持連線活躍
};

// 修改翻譯函式，快速檢查 API Key
async function translateText(text, prefix) {
  if (!isApiKeyReady || !apiKey) {
    throw new Error("API Key 未設定");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    ...fetchConfig,
    headers: {
      ...fetchConfig.headers,
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: `${prefix}${text}` }],
      max_tokens: 300,
      temperature: 0.1,
      stream: false // 確保不使用串流模式
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "翻譯失敗");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// 新增快取系統
const translationCache = new Map();
const CACHE_SIZE = 100; // 限制快取大小

async function translateWithCache(text, prefix) {
  const cacheKey = `${prefix}:${text}`;
  
  // 檢查快取
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  // 呼叫 API
  const result = await translateText(text, prefix);
  
  // 儲存到快取（限制大小）
  if (translationCache.size >= CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, result);
  
  return result;
}

// 檢查按鍵事件是否符合快速鍵設定
function matchesShortcut(event, shortcut) {
  return event.key.toLowerCase() === shortcut.key.toLowerCase() &&
         event.altKey === shortcut.altKey &&
         event.ctrlKey === shortcut.ctrlKey &&
         event.shiftKey === shortcut.shiftKey;
}

// 根據快速鍵獲取對應的翻譯指令
function getTranslationPrefix(description) {
  return translationPrefixes[description] || `請處理以下文字：`;
}

// 主要的快速鍵處理函式
async function handleKeyDown(e) {
  // 快速檢查快速鍵匹配
  const matchedShortcut = Object.values(customShortcuts).find(shortcut =>
    e.key.toLowerCase() === shortcut.key.toLowerCase() &&
    e.altKey === shortcut.altKey &&
    e.ctrlKey === shortcut.ctrlKey &&
    e.shiftKey === shortcut.shiftKey
  );

  if (!matchedShortcut) return;

  e.preventDefault();
  e.stopPropagation();

  const activeElement = document.activeElement;
  if (!isEditableElement(activeElement)) return;

  const originalText = getElementText(activeElement);
  if (!originalText.trim()) return;

  // 立即顯示載入狀態
  const loadingText = "🔄 翻譯中...";
  setElementText(activeElement, loadingText);

  try {
    // 使用快取版本的翻譯函式
    const translatedText = await translateWithCache(originalText, getTranslationPrefix(matchedShortcut.description));
    setElementText(activeElement, translatedText);
  } catch (error) {
    // 錯誤時恢復原文
    setElementText(activeElement, originalText);
    console.error("翻譯錯誤:", error);
    
    // 短暫顯示錯誤訊息
    const errorText = "❌ 翻譯失敗";
    setElementText(activeElement, errorText);
    setTimeout(() => {
      setElementText(activeElement, originalText);
    }, 2000);
  }
}

// 添加全域事件監聽器
document.addEventListener('keydown', handleKeyDown, true);

// 為了確保在動態載入的內容上也能正常工作，使用 MutationObserver
const observer = new MutationObserver((mutations) => {
  // 當 DOM 結構發生變化時，確保事件監聽器仍然有效
  // 由於我們使用的是全域監聽器，通常不需要額外處理
});

// 開始觀察 DOM 變化
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// 注入樣式，用於視覺反饋（可選）
const style = document.createElement('style');
style.textContent = `
  .translate-helper-processing {
    background-color: #fff3cd !important;
    border-color: #ffeaa7 !important;
  }
`;
document.head.appendChild(style);

console.log('文字轉換小幫手已載入 - 在任何文字輸入框中使用 Alt+1~4 快速鍵');
