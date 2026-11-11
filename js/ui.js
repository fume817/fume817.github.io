/**
 * UI.js
 * 画面の動き、トランジション、アニメーション効果を管理するモジュール
 */

// UI要素のゲッター（DOM読み込みタイミングに依存せず安全に取得）
const elements = {
  get container() { return document.querySelector(".container"); },
  get loadingView() { return document.getElementById("loadingView"); },
  get firstView() { return document.getElementById("firstView"); },
  get scndView() { return document.getElementById("scndView"); },
  get usernameInput() { return document.getElementById("username"); },
  get peerIdInput() { return document.getElementById("PeerID"); },
  get errorText() { return document.getElementById("error"); },
  get usernameDisplay() { return document.getElementById("usernameDisplay"); },
  get peerIdDisplay() { return document.getElementById("peerIdDisplay"); },
  get scndUsernameDisplay() { return document.getElementById("scndUsernameDisplay"); },
  get scndPeerIdDisplay() { return document.getElementById("scndPeerIdDisplay"); },
  get startBtn() { return document.getElementById("btn"); },
  get userAvatar() { return document.getElementById("userAvatar"); },
};

/**
 * 初期化時のローディング表示を非表示にし、対象のビューを表示
 * @param {'first'|'second'} viewType
 */
export function showInitialView(viewType) {
  if (elements.loadingView) {
    elements.loadingView.style.display = "none";
  }

  if (viewType === "second") {
    if (elements.firstView) elements.firstView.style.display = "none";
    if (elements.scndView) {
      elements.scndView.style.display = "block";
      elements.scndView.classList.add("slide-in-right");
    }
  } else {
    if (elements.scndView) elements.scndView.style.display = "none";
    if (elements.firstView) {
      elements.firstView.style.display = "block";
      elements.firstView.classList.add("slide-in-right");
      setStep(1);
    }
  }
}

/**
 * 登録済みユーザー画面（ようこそ）の情報をセット
 * @param {{name: string, peerId: string}} user
 */
export function setRegisteredUserInfo(user) {
  if (elements.scndUsernameDisplay) {
    elements.scndUsernameDisplay.textContent = user.name || "名無し";
  }
  if (elements.scndPeerIdDisplay) {
    elements.scndPeerIdDisplay.textContent = user.peerId || "---";
  }
  if (elements.userAvatar) {
    const initial = user.name ? user.name.trim().charAt(0).toUpperCase() : "?";
    elements.userAvatar.textContent = initial;
  }
}

/**
 * 確認画面（ステップ3）の情報を更新
 * @param {string} username
 * @param {string} peerId
 */
export function updateConfirmInfo(username, peerId) {
  if (elements.usernameDisplay) {
    elements.usernameDisplay.textContent = username;
  }
  if (elements.peerIdDisplay) {
    elements.peerIdDisplay.textContent = peerId;
  }
}

/**
 * ステップ番号に応じたパネル切り替え（アニメーション付き）
 * @param {number} fromStep
 * @param {number} toStep
 */
export function transitionStep(fromStep, toStep) {
  const currentPanel = document.getElementById(`step-${fromStep}`);
  const nextPanel = document.getElementById(`step-${toStep}`);
  const isForward = toStep > fromStep;

  if (!currentPanel || !nextPanel) return;

  currentPanel.classList.remove("slide-in-right", "slide-in-left", "active");
  nextPanel.classList.remove("slide-out-left", "slide-out-right");

  const exitClass = isForward ? "slide-out-left" : "slide-out-right";
  currentPanel.classList.add(exitClass);

  setTimeout(() => {
    currentPanel.classList.remove(exitClass);
    currentPanel.style.display = "none";

    const enterClass = isForward ? "slide-in-right" : "slide-in-left";
    nextPanel.style.display = "block";
    nextPanel.classList.add("active", enterClass);

    updateStepDots(toStep);

    if (toStep === 1 && elements.usernameInput) elements.usernameInput.focus();
    if (toStep === 2 && elements.peerIdInput) elements.peerIdInput.focus();
  }, 250);
}

/**
 * 直接特定のステップを表示
 * @param {number} stepNumber
 */
export function setStep(stepNumber) {
  document.querySelectorAll(".step-panel").forEach((panel) => {
    panel.classList.remove("active", "slide-in-right", "slide-in-left");
    panel.style.display = "none";
  });

  const targetPanel = document.getElementById(`step-${stepNumber}`);
  if (targetPanel) {
    targetPanel.style.display = "block";
    targetPanel.classList.add("active");
  }

  updateStepDots(stepNumber);
}

function updateStepDots(activeStep) {
  const dots = document.querySelectorAll(".step-dot");
  dots.forEach((dot, index) => {
    const step = index + 1;
    dot.classList.remove("active", "completed");
    if (step === activeStep) {
      dot.classList.add("active");
    } else if (step < activeStep) {
      dot.classList.add("completed");
    }
  });
}

/**
 * エラー演出
 * @param {string} message
 * @param {HTMLElement} [targetInput]
 */
export function showError(message, targetInput) {
  if (elements.errorText) {
    elements.errorText.textContent = message;
    elements.errorText.classList.add("visible");
  }

  if (targetInput) {
    targetInput.classList.add("input-error", "shake");
    targetInput.focus();

    setTimeout(() => {
      targetInput.classList.remove("shake");
    }, 450);
  }
}

/**
 * エラー状態のリセット
 */
export function clearError() {
  if (elements.errorText) {
    elements.errorText.textContent = "";
    elements.errorText.classList.remove("visible");
  }

  if (elements.usernameInput) {
    elements.usernameInput.classList.remove("input-error");
  }
  if (elements.peerIdInput) {
    elements.peerIdInput.classList.remove("input-error");
  }
}

/**
 * ボタンの処理中状態アニメーション
 * @param {HTMLElement} buttonElement
 * @param {string} loadingText
 */
export function setButtonLoading(buttonElement, loadingText = "処理中...") {
  if (!buttonElement) return;
  buttonElement.dataset.originalText = buttonElement.innerHTML;
  buttonElement.disabled = true;
  buttonElement.innerHTML = `<span class="spinner" style="width: 18px; height: 18px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>${loadingText}`;
}

/**
 * ボタンの通常状態復帰
 * @param {HTMLElement} buttonElement
 */
export function resetButton(buttonElement) {
  if (!buttonElement || !buttonElement.dataset.originalText) return;
  buttonElement.disabled = false;
  buttonElement.innerHTML = buttonElement.dataset.originalText;
}

/**
 * 成功アニメーション演出を加えてページ遷移
 * @param {string} targetUrl
 */
export function animateAndNavigate(targetUrl) {
  if (elements.container) {
    elements.container.style.transition = "all 0.5s ease";
    elements.container.style.opacity = "0";
    elements.container.style.transform = "scale(0.95) translateY(-20px)";
  }
  setTimeout(() => {
    window.location.href = targetUrl;
  }, 400);
}

/* ===================================================
   チャット画面 (chat.html) 用のUI・アニメーション関数
   =================================================== */

/**
 * 1件分のメッセージ吹き出し要素を生成して追加
 * @param {{me: number, type: string, content: string, createdAt?: number}} chat
 * @param {HTMLElement} [chatContainer]
 */
export function appendChatBubble(chat, chatContainer = document.getElementById("Chat")) {
  if (!chatContainer) return;

  const bubbleWrapper = document.createElement("div");
  bubbleWrapper.className = `bubble-wrapper ${chat.me ? "me" : "other"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${chat.me ? "me" : "other"}`;

  if (chat.type === "image") {
    const img = document.createElement("img");
    img.src = chat.content;
    img.className = "chat-image";
    bubble.appendChild(img);
  } else {
    bubble.textContent = chat.content;
  }

  const timeSpan = document.createElement("span");
  timeSpan.className = "chat-time";
  const date = chat.createdAt ? new Date(chat.createdAt) : new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  timeSpan.textContent = `${hours}:${minutes}`;

  bubbleWrapper.appendChild(bubble);
  bubbleWrapper.appendChild(timeSpan);

  chatContainer.appendChild(bubbleWrapper);
  scrollChatToBottom(chatContainer);
}

/**
 * チャット履歴をまとめて描画
 * @param {Array<{me: number, type: string, content: string, createdAt?: number}>} list
 * @param {HTMLElement} [chatContainer]
 */
export function renderChatHistory(list, chatContainer = document.getElementById("Chat")) {
  if (!chatContainer) return;
  chatContainer.innerHTML = "";
  for (const chat of list) {
    appendChatBubble(chat, chatContainer);
  }
  scrollChatToBottom(chatContainer);
}

/**
 * チャットエリアを最下部へスクロール
 * @param {HTMLElement} [chatContainer]
 */
export function scrollChatToBottom(chatContainer = document.getElementById("Chat")) {
  if (!chatContainer) return;
  requestAnimationFrame(() => {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: "smooth",
    });
  });
}

/**
 * システムメッセージ・通知をチャット欄に追加
 * @param {string} text
 * @param {HTMLElement} [chatContainer]
 */
export function appendSystemNotice(text, chatContainer = document.getElementById("Chat")) {
  if (!chatContainer) return;
  const noticeWrapper = document.createElement("div");
  noticeWrapper.className = "system-notice-wrapper";
  const notice = document.createElement("div");
  notice.className = "system-notice";
  notice.textContent = text;
  noticeWrapper.appendChild(notice);
  chatContainer.appendChild(noticeWrapper);
  scrollChatToBottom(chatContainer);
}

/**
 * ステータス表示の更新（色とアニメーション）
 * @param {string} text
 * @param {'online'|'connecting'|'connected'|'offline'|'error'} state
 */
export function updateChatStatus(text, state = "online") {
  const statusDisplay = document.getElementById("statusDisplay");
  if (!statusDisplay) return;

  statusDisplay.textContent = text;
  statusDisplay.className = `status-text status-${state}`;
}

/**
 * 接続待機パネル（#firstChat）の表示/非表示切り替え
 * @param {boolean} visible
 */
export function setFirstChatVisible(visible) {
  const firstChat = document.getElementById("firstChat");
  if (!firstChat) return;
  firstChat.style.display = visible ? "block" : "none";
}

/**
 * チャット上部ヘッダーの相手情報を更新
 * @param {string} name
 * @param {string} peerId
 */
export function updateChatHeader(name, peerId) {
  const titleEl = document.getElementById("chatWithTitle");
  const idEl = document.getElementById("chatWithId");
  if (titleEl) titleEl.textContent = name || "相手";
  if (idEl) idEl.textContent = peerId ? `ID: ${peerId}` : "未接続";
}

/**
 * サイドバーの相手一覧リストを描画
 * @param {Array<{name: string, peerId: string}>} companions
 * @param {function} onSelectCompanion
 * @param {string} [activePeerId]
 */
export function renderCompanionList(companions, onSelectCompanion, activePeerId) {
  const container = document.getElementById("companionList");
  if (!container) return;

  container.innerHTML = "";

  if (!companions || companions.length === 0) {
    const emptyNotice = document.createElement("p");
    emptyNotice.className = "message";
    emptyNotice.style.fontSize = "0.78rem";
    emptyNotice.textContent = "対話履歴のある相手はいません";
    container.appendChild(emptyNotice);
    return;
  }

  companions.forEach((comp) => {
    const item = document.createElement("div");
    item.className = `companion-item ${comp.peerId === activePeerId ? "active" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "companion-avatar";
    avatar.textContent = comp.name ? comp.name.trim().charAt(0).toUpperCase() : "?";

    const textDiv = document.createElement("div");
    textDiv.className = "companion-text";

    const nameRow = document.createElement("div");
    nameRow.className = "companion-name-row";
    nameRow.textContent = comp.name || "ユーザー";

    const idRow = document.createElement("div");
    idRow.className = "companion-id-row";
    idRow.textContent = comp.peerId;

    textDiv.appendChild(nameRow);
    textDiv.appendChild(idRow);

    item.appendChild(avatar);
    item.appendChild(textDiv);

    item.addEventListener("click", () => {
      if (onSelectCompanion) {
        onSelectCompanion(comp);
      }
    });

    container.appendChild(item);
  });
}
