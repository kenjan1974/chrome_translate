let apiKey;
let customShortcuts = {};

// 預設快速鍵設定
const defaultShortcuts = {
  shortcut1: { key: "1", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為簡體中文" },
  shortcut2: { key: "2", altKey: true, ctrlKey: false, shiftKey: false, description: "轉換為繁體中文" },
  shortcut3: { key: "3", altKey: true, ctrlKey: false, shiftKey: false, description: "中文翻譯為英文" },
  shortcut4: { key: "4", altKey: true, ctrlKey: false, shiftKey: false, description: "英文翻譯為中文" }
};

// 載入 API Key 和快速鍵設定
chrome.storage.local.get(["openaiApiKey", "customShortcuts"], (res) => {
  apiKey = res.openaiApiKey;
  customShortcuts = res.customShortcuts || defaultShortcuts;
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

// 呼叫 OpenAI API 進行翻譯
async function translateText(text, prefix) {
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
          {
            role: "system",
            content: "你是一個翻譯助理，只回傳轉換後的文字，不要多餘說明。",
          },
          { role: "user", content: prefix + text },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("翻譯失敗:", error);
    throw error;
  }
}

// 檢查按鍵事件是否符合快速鍵設定
function matchesShortcut(event, shortcut) {
  return event.key.toLowerCase() === shortcut.key.toLowerCase() &&
         event.altKey === shortcut.altKey &&
         event.ctrlKey === shortcut.ctrlKey &&
         event.shiftKey === shortcut.shiftKey;
}

// 根據快速鍵獲取對應的翻譯指令
function getTranslationPrefix(event) {
  for (const [shortcutId, shortcut] of Object.entries(customShortcuts)) {
    if (matchesShortcut(event, shortcut)) {
      switch (shortcutId) {
        case 'shortcut1':
          return "將以下文字轉換為簡體中文：";
        case 'shortcut2':
          return "將以下文字轉換為繁體中文：";
        case 'shortcut3':
          return "將以下中文翻譯為英文：";
        case 'shortcut4':
          return "將以下英文翻譯為中文：";
      }
    }
  }
  return null;
}

// 主要的快速鍵處理函式
async function handleKeyDown(e) {
  // 檢查當前聚焦的元素是否為可編輯的輸入欄位
  const activeElement = document.activeElement;
  if (!isEditableElement(activeElement)) return;
  
  // 檢查是否符合任何設定的快速鍵
  const prefix = getTranslationPrefix(e);
  if (!prefix) return;

  // 阻止預設行為
  e.preventDefault();
  e.stopPropagation();

  const originalText = getElementText(activeElement);
  
  // 檢查是否有文字內容
  if (!originalText.trim()) {
    alert("請先輸入要轉換的文字");
    return;
  }

  // 檢查是否有 API Key
  if (!apiKey) {
    alert("請先在擴充功能設定頁面輸入 OpenAI API Key");
    return;
  }

  // 顯示處理狀態
  const restoreOriginal = showProcessingStatus(activeElement, originalText);

  try {
    // 進行翻譯
    const translatedText = await translateText(originalText, prefix);
    setElementText(activeElement, translatedText);
    
    // 保持焦點在原元素上
    activeElement.focus();
  } catch (error) {
    // 發生錯誤時還原原始文字
    restoreOriginal();
    alert("轉換失敗，請檢查 API Key 與網路連線");
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
